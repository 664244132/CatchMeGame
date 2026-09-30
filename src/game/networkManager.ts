import { Peer, type DataConnection } from 'peerjs';
import { PLAYER_PALETTE } from './constants';
import type {
  LobbyPlayer,
  NetworkMessage,
  NetworkMessageType,
  PlayerConfig,
  PlayerInputPayload,
  SyncStatePayload,
  RoundEndPayload,
  JoinRoomPayload,
  JoinRoomAckPayload,
  PlayerJoinedPayload,
  StartGamePayload,
  RoomRegistryItem,
} from './types';

/**
 * รูปแบบ Callback สำหรับการรับฟังเหตุการณ์ทางเครือข่าย
 */
export type NetworkEventCallback<T = unknown> = (payload: T) => void;

const ROOM_STORAGE_KEY_PREFIX = 'catchme_room_reg_';
const ROOM_TIMEOUT_MS = 90000; // 90 วินาที หากไม่มี Heartbeat ถือว่าห้องปิดแล้ว
const PEER_PREFIX = 'catchme3d_';

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  },
};

/**
 * จัดรูปแบบรหัสห้องให้เป็นมาตรฐานสากล:
 * - ตัดช่องว่างและขีด
 * - แปลงเป็นตัวพิมพ์ใหญ่
 * - รองรับกรณีพิมพ์ CAT- หรือ ROOM นำหน้า
 * เช่น 'cat-a8f2' -> 'A8F2', 'A 8 F 2' -> 'A8F2'
 */
export function normalizeRoomCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^(CAT|ROOM)/, '');
}

/**
 * NetworkManager - ระบบจัดการเครือข่ายห้องและการสื่อสารแบบเรียลไทม์ (Cross-Device WebRTC P2P)
 *
 * รองรับ:
 * 1. WebRTC DataChannel (PeerJS): เล่นข้ามอุปกรณ์ได้จริง 100% (คอม ↔ มือถือ / คอม ↔ คอม ผ่าน WiFi หรือ Internet)
 * 2. Handshake ด้วย ACK: ป้องกันปัญหาสมัครเข้าห้องแล้วหมุนโหลดค้าง
 * 3. Dual-Transport Fallback: มี BroadcastChannel & LocalStorage รองรับการทดสอบ 2 แท็บบนเครื่องเดียวกัน
 * 4. Host-Authoritative Architecture: หัวหน้าห้องเป็นผู้ควบคุมการเริ่มเกมและซิงค์ฟิสิกส์ 3D
 * 5. Zero-Server / No Database (Rule 10 & 14): ไม่ใช้ฐานข้อมูล ข้อมูลเกมวิ่งตรง P2P
 */
export class NetworkManager {
  private static instance: NetworkManager | null = null;

  public roomCode: string | null = null;
  public isHost = false;
  public localPlayer: LobbyPlayer | null = null;
  public players: LobbyPlayer[] = [];
  public clientToken = '';
  public currentTotalRounds = 5;
  public isGameRunning = false;

  // WebRTC P2P (PeerJS)
  private peer: Peer | null = null;
  private peerConnections: Map<string, DataConnection> = new Map(); // clientToken -> DataConnection (ฝั่ง Host)
  private hostConnection: DataConnection | null = null; // DataConnection ไปยัง Host (ฝั่ง Guest)

  // Local BroadcastChannel (สำหรับเล่น 2 แท็บบนเบราว์เซอร์เดียวกัน)
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<NetworkEventCallback<any>>> = new Map();

  // ตัวจัดการเวลา (Timers) และการเชื่อมต่อ
  private heartbeatInterval: number | null = null;
  private joinRetryTimeout: number | null = null;
  private joinAttempts = 0;
  private isConnectedToHost = false;

  private constructor() {
    this.setupStorageListener();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ระบบ Room Code & การจัดการพื้นที่เก็บข้อมูลเฉพาะเครื่อง (Local Fallback)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * สุ่มสร้างรหัสห้อง 4 หลักที่จดจำและพิมพ์ง่าย (เช่น 'A8F2')
   * ละเว้นตัวอักษรที่สับสนง่าย เช่น 0, O, 1, I
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private setupStorageListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (!this.roomCode || !event.key) return;

      const targetKey = `${ROOM_STORAGE_KEY_PREFIX}${this.roomCode}`;
      if (event.key !== targetKey || !event.newValue) return;

      try {
        const roomData = JSON.parse(event.newValue) as RoomRegistryItem;
        this.handleStorageRoomUpdate(roomData);
      } catch (err) {
        console.error('Failed to parse room update from storage:', err);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (this.isHost && this.roomCode) {
        this.removeRoomFromStorage(this.roomCode);
      }
    });
  }

  private handleStorageRoomUpdate(roomData: RoomRegistryItem) {
    if (this.isHost) return;

    if (Array.isArray(roomData.players) && roomData.players.length > 0) {
      this.players = roomData.players;
      this.emit('lobby_updated', [...this.players]);
    }

    if (roomData.status === 'PLAYING' && !this.isGameRunning) {
      this.isGameRunning = true;
      const playerConfigs: PlayerConfig[] = this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: true,
        color: p.color,
      }));

      this.emit('game_started', {
        totalRounds: roomData.totalRounds || this.currentTotalRounds,
        catId: 0,
        playerConfigs,
      });
    }
  }

  public saveRoomToStorage(room: RoomRegistryItem): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${ROOM_STORAGE_KEY_PREFIX}${room.code}`, JSON.stringify(room));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  public getRoomFromStorage(code: string): RoomRegistryItem | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${ROOM_STORAGE_KEY_PREFIX}${code.toUpperCase()}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RoomRegistryItem;
      if (Date.now() - parsed.updatedAt > ROOM_TIMEOUT_MS) {
        this.removeRoomFromStorage(code);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public removeRoomFromStorage(code: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${ROOM_STORAGE_KEY_PREFIX}${code.toUpperCase()}`);
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
  }

  private updateHostRoomStorage(status: 'WAITING' | 'PLAYING' = 'WAITING'): void {
    if (!this.isHost || !this.roomCode || !this.localPlayer) return;

    const roomItem: RoomRegistryItem = {
      code: this.roomCode,
      hostName: this.localPlayer.name,
      hostId: this.localPlayer.id,
      players: this.players,
      status,
      totalRounds: this.currentTotalRounds,
      updatedAt: Date.now(),
    };
    this.saveRoomToStorage(roomItem);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. การสร้างห้อง (Create Room as Host)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * สร้างห้องใหม่ในฐานะ Host
   * เปิดทั้ง WebRTC P2P Listener และ Local Channel
   */
  public createRoom(hostName = 'Host Player', rounds = 5): string {
    this.leaveRoom();

    const code = this.generateRoomCode();
    this.roomCode = code;
    this.isHost = true;
    this.currentTotalRounds = rounds;
    this.isGameRunning = false;
    this.clientToken = `host_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    this.localPlayer = {
      id: 0,
      name: hostName,
      isHost: true,
      color: PLAYER_PALETTE[0],
      clientToken: this.clientToken,
    };
    this.players = [this.localPlayer];

    // 1. เริ่มต้น WebRTC Host Peer (ใช้รหัสห้องเป็น Peer ID สากล)
    const hostPeerId = `${PEER_PREFIX}${code}`;
    try {
      this.peer = new Peer(hostPeerId, PEER_CONFIG);

      this.peer.on('open', (id) => {
        console.log(`[WebRTC] Host peer opened successfully with ID: ${id}`);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingPeerConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.warn('[WebRTC] Host peer warning/error:', err);
      });
    } catch (err) {
      console.error('[WebRTC] Failed to initialize host peer:', err);
    }

    // 2. เริ่มต้น BroadcastChannel & Storage สำรองสำหรับเล่นบนเครื่องเดียวกัน
    this.initChannel(code);
    this.updateHostRoomStorage('WAITING');

    this.heartbeatInterval = window.setInterval(() => {
      this.updateHostRoomStorage(this.isGameRunning ? 'PLAYING' : 'WAITING');
    }, 2500);

    return code;
  }

  /**
   * จัดการการเชื่อมต่อ WebRTC ขาเข้าจาก Guest (มือถือหรือเครื่องอื่น)
   */
  private handleIncomingPeerConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('[WebRTC] Guest peer connection opened:', conn.peer);
    });

    conn.on('data', (data: unknown) => {
      const msg = data as NetworkMessage;
      if (!msg || !msg.type) return;

      // จดจำ Connection ของผู้เล่นตาม ClientToken
      if (msg.type === 'JOIN_ROOM') {
        const payload = msg.payload as JoinRoomPayload;
        if (payload?.clientToken) {
          this.peerConnections.set(payload.clientToken, conn);
        }
      }

      this.handleHostMessage(msg);
    });

    conn.on('close', () => {
      for (const [token, c] of this.peerConnections.entries()) {
        if (c === conn) {
          this.peerConnections.delete(token);
          const p = this.players.find((pl) => pl.clientToken === token);
          if (p) {
            this.handleHostMessage({
              type: 'PLAYER_LEFT',
              senderId: p.id,
              payload: { playerId: p.id },
            });
          }
          break;
        }
      }
    });

    conn.on('error', (err) => {
      console.warn('[WebRTC] DataConnection error:', err);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. การเข้าร่วมห้อง (Join Room as Guest - Cross Device P2P)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * เข้าร่วมห้องด้วยรหัสห้อง
   * รองรับการเชื่อมต่อข้ามเครื่องผ่าน WebRTC (มือถือ ↔ คอมพิวเตอร์) และ Local Fallback
   */
  public joinRoom(code: string, playerName = 'Guest Player'): void {
    this.leaveRoom();

    const normalizedCode = normalizeRoomCode(code);
    if (!normalizedCode) {
      this.emit('join_failed', { reason: 'กรุณากรอกรหัสห้องให้ถูกต้อง' });
      return;
    }

    this.roomCode = normalizedCode;
    this.isHost = false;
    this.isGameRunning = false;
    this.isConnectedToHost = false;
    this.joinAttempts = 0;
    this.clientToken = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const tempId = Math.floor(Math.random() * 8999) + 1000;
    const colorIndex = (tempId % (PLAYER_PALETTE.length - 1)) + 1;

    this.localPlayer = {
      id: tempId,
      name: playerName,
      isHost: false,
      color: PLAYER_PALETTE[colorIndex],
      clientToken: this.clientToken,
    };

    // 1. เปิด BroadcastChannel สำหรับกรณีเล่นในเครื่องเดียวกัน
    this.initChannel(normalizedCode);

    // 2. เริ่มต้นเชื่อมต่อสัญญาณ WebRTC ข้ามเครือข่าย
    this.emit('join_status', {
      status: 'CONNECTING',
      attempt: 1,
      message: 'กำลังเชื่อมต่อสัญญาณ P2P (WebRTC)...',
    });

    const hostPeerId = `${PEER_PREFIX}${normalizedCode}`;
    const guestPeerId = `${PEER_PREFIX}${normalizedCode}_g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      this.peer = new Peer(guestPeerId, PEER_CONFIG);

      this.peer.on('open', () => {
        this.emit('join_status', {
          status: 'CONNECTING',
          attempt: 1,
          message: 'พบสัญญาณเน็ตเวิร์ก กำลังเชื่อมต่อไปยังหัวหน้าห้อง...',
        });

        const conn = this.peer!.connect(hostPeerId, { reliable: true });
        this.hostConnection = conn;

        conn.on('open', () => {
          console.log('[WebRTC] Connected directly to host peer!');
          this.emit('join_status', {
            status: 'CONNECTING',
            attempt: 1,
            message: 'เชื่อมต่อโฮสต์สำเร็จ กำลังลงทะเบียนเข้าห้อง...',
          });

          // ส่งคำขอ JOIN_ROOM ผ่าน WebRTC DataChannel
          const payload: JoinRoomPayload = {
            player: this.localPlayer!,
            name: this.localPlayer!.name,
            requestedId: this.localPlayer!.id,
            clientToken: this.clientToken,
          };

          const message: NetworkMessage = {
            type: 'JOIN_ROOM',
            senderId: this.localPlayer!.id,
            payload,
          };
          conn.send(message);
        });

        conn.on('data', (data: unknown) => {
          const msg = data as NetworkMessage;
          if (msg && msg.type) {
            this.handleClientMessage(msg);
          }
        });

        conn.on('close', () => {
          console.log('[WebRTC] Disconnected from host');
        });

        conn.on('error', (err) => {
          console.warn('[WebRTC] Host connection error:', err);
        });
      });

      this.peer.on('error', (err: any) => {
        console.warn('[WebRTC] Guest peer error:', err);
        if (err.type === 'peer-unavailable') {
          // หาก WebRTC ไม่พบโฮสต์ ให้ตรวจสอบ Local Storage ดูก่อน
          setTimeout(() => {
            if (this.isConnectedToHost) return;
            const roomCheck = this.roomCode ? this.getRoomFromStorage(this.roomCode) : null;
            if (!roomCheck) {
              this.emit('join_failed', {
                reason: `ไม่พบรหัสห้อง "${this.roomCode}" หรือหัวหน้าห้องปิดหน้าต่างไปแล้ว กรุณาตรวจสอบรหัสห้องอีกครั้ง`,
              });
            }
          }, 800);
        }
      });
    } catch (err) {
      console.error('[WebRTC] Error initializing guest peer:', err);
    }

    // 3. เริ่มส่งคำขอผ่าน BroadcastChannel สำรองควบคู่ไปด้วย
    this.sendJoinRoomRequest();
  }

  /**
   * ส่งคำขอเข้าห้องผ่านช่องทางสำรอง (BroadcastChannel / LocalStorage)
   */
  private sendJoinRoomRequest(): void {
    if (!this.localPlayer || !this.roomCode || this.isConnectedToHost) return;

    this.joinAttempts++;

    const payload: JoinRoomPayload = {
      player: this.localPlayer,
      name: this.localPlayer.name,
      requestedId: this.localPlayer.id,
      clientToken: this.clientToken,
    };
    this.sendMessage('JOIN_ROOM', payload);

    this.joinRetryTimeout = window.setTimeout(() => {
      if (this.isConnectedToHost) return;

      if (this.joinAttempts < 4) {
        this.sendJoinRoomRequest();
      } else {
        // หากส่งครบ 4 ครั้งและยังไม่ได้รับการตอบกลับ
        const roomCheck = this.roomCode ? this.getRoomFromStorage(this.roomCode) : null;
        if (roomCheck) {
          this.isConnectedToHost = true;
          this.players = roomCheck.players;
          this.emit('join_success', {
            players: this.players,
            roomCode: this.roomCode,
          });
          this.emit('lobby_updated', [...this.players]);
        } else if (!this.hostConnection?.open) {
          this.emit('join_failed', {
            reason: `ไม่พบรหัสห้อง "${this.roomCode}" หรือหัวหน้าห้องปิดหน้าต่างไปแล้ว กรุณาตรวจสอบรหัสห้องอีกครั้ง`,
          });
        }
      }
    }, 1500);
  }

  /**
   * ออกจากห้องและคืนทรัพยากรทั้งหมด (ทั้ง WebRTC และ Broadcast)
   */
  public leaveRoom(): void {
    if (this.joinRetryTimeout) {
      clearTimeout(this.joinRetryTimeout);
      this.joinRetryTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.isHost && this.roomCode) {
      this.removeRoomFromStorage(this.roomCode);
    }

    if (this.localPlayer && this.roomCode) {
      this.sendMessage('PLAYER_LEFT', { playerId: this.localPlayer.id });
    }

    // ปิดการเชื่อมต่อ WebRTC
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    for (const conn of this.peerConnections.values()) {
      conn.close();
    }
    this.peerConnections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // ปิด BroadcastChannel
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.roomCode = null;
    this.isHost = false;
    this.localPlayer = null;
    this.players = [];
    this.isConnectedToHost = false;
    this.isGameRunning = false;
    this.joinAttempts = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. การรับส่งข้อความผ่านเครือข่าย (Unified Messaging: WebRTC + Broadcast)
  // ──────────────────────────────────────────────────────────────────────────

  private initChannel(code: string) {
    if (this.channel) {
      this.channel.close();
    }

    this.channel = new BroadcastChannel(`catchme_room_${code}`);

    this.channel.onmessage = (event: MessageEvent<NetworkMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      this.handleIncomingMessage(msg);
    };
  }

  /**
   * ส่งข้อความเครือข่ายไปยังผู้เล่นอื่น (ส่งทั้งผ่าน WebRTC DataChannel และ BroadcastChannel)
   */
  public sendMessage(type: NetworkMessageType, payload: unknown): void {
    if (!this.localPlayer) return;

    const message: NetworkMessage = {
      type,
      senderId: this.localPlayer.id,
      payload,
    } as NetworkMessage;

    // 1. ส่งผ่าน WebRTC DataChannel
    if (this.isHost) {
      for (const conn of this.peerConnections.values()) {
        if (conn.open) {
          try {
            conn.send(message);
          } catch (e) {
            console.warn('[WebRTC] Failed to send message to guest peer:', e);
          }
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(message);
      } catch (e) {
        console.warn('[WebRTC] Failed to send message to host peer:', e);
      }
    }

    // 2. ส่งผ่าน BroadcastChannel สำหรับเครื่องเดียวกัน
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {
        // ignore
      }
    }
  }

  private handleIncomingMessage(msg: NetworkMessage) {
    if (this.isHost) {
      this.handleHostMessage(msg);
      return;
    }
    this.handleClientMessage(msg);
  }

  /**
   * ตรรกะจัดการข้อความบนเครื่อง Host
   */
  private handleHostMessage(msg: NetworkMessage) {
    // 1. ผู้เล่นขอเข้าร่วมห้อง (JOIN_ROOM)
    if (msg.type === 'JOIN_ROOM') {
      const payload = msg.payload as JoinRoomPayload;
      if (!payload || !payload.clientToken) return;

      if (this.players.length >= 50) {
        const ackPayload: JoinRoomAckPayload = {
          success: false,
          message: 'ห้องเต็มแล้ว (สูงสุด 50 คน)',
          clientToken: payload.clientToken,
          assignedId: -1,
          players: this.players,
        };
        this.sendDirectAck(payload.clientToken, ackPayload);
        return;
      }

      let targetPlayer = this.players.find((p) => p.clientToken === payload.clientToken);

      if (!targetPlayer) {
        const assignedId = this.players.length;
        const color = PLAYER_PALETTE[assignedId % PLAYER_PALETTE.length];
        const newPlayerName = (payload.name || payload.player?.name || `Player ${assignedId + 1}`).trim();

        targetPlayer = {
          id: assignedId,
          name: newPlayerName,
          isHost: false,
          color,
          clientToken: payload.clientToken,
        };

        this.players.push(targetPlayer);
        this.updateHostRoomStorage(this.isGameRunning ? 'PLAYING' : 'WAITING');
        this.emit('lobby_updated', [...this.players]);
      }

      const ackPayload: JoinRoomAckPayload = {
        success: true,
        clientToken: payload.clientToken,
        assignedId: targetPlayer.id,
        players: this.players,
        totalRounds: this.currentTotalRounds,
        isGameRunning: this.isGameRunning,
      };

      // ส่ง ACK ยืนยันให้ผู้เล่นคนนั้น
      this.sendDirectAck(payload.clientToken, ackPayload);

      // กระจายรายชื่อผู้เล่นทั้งหมดให้ทุกคนในห้องทราบ
      this.sendMessage('PLAYER_JOINED', {
        player: targetPlayer,
        players: this.players,
        assignedId: targetPlayer.id,
        clientToken: payload.clientToken,
      } as PlayerJoinedPayload);
      return;
    }

    // 2. ผู้เล่นออกจากห้อง (PLAYER_LEFT)
    if (msg.type === 'PLAYER_LEFT') {
      const payload = msg.payload as { playerId?: number };
      if (typeof payload?.playerId !== 'number') return;

      this.players = this.players.filter((p) => p.id !== payload.playerId);
      this.updateHostRoomStorage(this.isGameRunning ? 'PLAYING' : 'WAITING');
      this.emit('lobby_updated', [...this.players]);
      this.sendMessage('PLAYER_LEFT', { playerId: payload.playerId, players: this.players });
      return;
    }

    // 3. อินพุตจากผู้เล่นอื่น (PLAYER_INPUT)
    if (msg.type === 'PLAYER_INPUT') {
      this.emit('remote_input', msg.payload as PlayerInputPayload);
      return;
    }
  }

  /**
   * ส่ง ACK ตรงไปยังผู้เล่นคนนั้นโดยเฉพาะ
   */
  private sendDirectAck(clientToken: string, payload: JoinRoomAckPayload) {
    const conn = this.peerConnections.get(clientToken);
    if (conn && conn.open) {
      try {
        conn.send({
          type: 'JOIN_ROOM_ACK',
          senderId: this.localPlayer?.id ?? 0,
          payload,
        } as NetworkMessage);
      } catch (e) {
        console.warn('Failed to send direct WebRTC ACK:', e);
      }
    }

    // ส่งผ่าน BroadcastChannel ด้วย
    this.sendMessage('JOIN_ROOM_ACK', payload);
  }

  /**
   * ตรรกะจัดการข้อความบนเครื่อง Client / Guest
   */
  private handleClientMessage(msg: NetworkMessage) {
    // 1. รับการตอบรับเข้าห้องจาก Host (JOIN_ROOM_ACK)
    if (msg.type === 'JOIN_ROOM_ACK') {
      const payload = msg.payload as JoinRoomAckPayload;
      if (!payload || payload.clientToken !== this.clientToken) return;

      if (!payload.success) {
        this.emit('join_failed', { reason: payload.message || 'ไม่สามารถเข้าร่วมห้องได้' });
        return;
      }

      if (this.joinRetryTimeout) {
        clearTimeout(this.joinRetryTimeout);
        this.joinRetryTimeout = null;
      }

      this.isConnectedToHost = true;
      this.players = payload.players;

      if (this.localPlayer) {
        this.localPlayer.id = payload.assignedId;
        const myData = payload.players.find((p) => p.id === payload.assignedId);
        if (myData) {
          this.localPlayer.color = myData.color;
          this.localPlayer.name = myData.name;
        }
      }

      if (payload.totalRounds) {
        this.currentTotalRounds = payload.totalRounds;
      }

      this.emit('join_success', {
        players: this.players,
        roomCode: this.roomCode,
        isGameRunning: payload.isGameRunning,
      });
      this.emit('lobby_updated', [...this.players]);
      return;
    }

    // 2. รับการอัปเดตสมาชิกในห้อง (PLAYER_JOINED)
    if (msg.type === 'PLAYER_JOINED') {
      const payload = msg.payload as PlayerJoinedPayload;
      const currentPlayers = payload?.players;
      if (!Array.isArray(currentPlayers)) return;

      this.players = currentPlayers;

      if (payload.clientToken === this.clientToken && this.localPlayer) {
        this.isConnectedToHost = true;
        if (payload.assignedId !== undefined) {
          this.localPlayer.id = payload.assignedId;
        }
      }

      this.emit('lobby_updated', [...this.players]);
      return;
    }

    // 3. สมาชิกออกจากห้อง (PLAYER_LEFT)
    if (msg.type === 'PLAYER_LEFT') {
      const payload = msg.payload as { players?: LobbyPlayer[] };
      if (Array.isArray(payload?.players)) {
        this.players = payload.players;
        this.emit('lobby_updated', [...this.players]);
      }
      return;
    }

    // 4. Host สั่งเริ่มเกม (START_GAME)
    if (msg.type === 'START_GAME') {
      this.isGameRunning = true;
      this.emit('game_started', msg.payload);
      return;
    }

    // 5. ซิงค์สถานะเกม (SYNC_STATE)
    if (msg.type === 'SYNC_STATE') {
      this.emit('sync_state', msg.payload as SyncStatePayload);
      return;
    }

    // 6. จบรอบ (ROUND_END)
    if (msg.type === 'ROUND_END') {
      this.emit('round_end', msg.payload as RoundEndPayload);
      return;
    }

    // 7. เริ่มรอบถัดไป (NEXT_ROUND)
    if (msg.type === 'NEXT_ROUND') {
      this.emit('next_round', msg.payload);
      return;
    }

    // 8. จบการแข่งขันครบทุกรอบ (MATCH_OVER)
    if (msg.type === 'MATCH_OVER') {
      this.emit('match_over', msg.payload);
      return;
    }

    // 9. กลับสู่ล็อบบี้ (RESET_LOBBY)
    if (msg.type === 'RESET_LOBBY') {
      this.isGameRunning = false;
      this.emit('reset_lobby', msg.payload);
      return;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. คำสั่งของ Host สำหรับควบคุมเกม (Host Commands)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Host สั่งเริ่มเกม
   */
  public hostStartGame(totalRounds: number): { catId: number; playerConfigs: PlayerConfig[] } {
    if (!this.isHost) throw new Error('Only the host can start the game!');

    this.isGameRunning = true;
    this.currentTotalRounds = totalRounds;
    this.updateHostRoomStorage('PLAYING');

    const catId = Math.floor(Math.random() * this.players.length);
    const playerConfigs: PlayerConfig[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: true,
      color: p.color,
    }));

    const payload: StartGamePayload = {
      totalRounds,
      catId,
      playerConfigs,
    };

    this.sendMessage('START_GAME', payload);
    return { catId, playerConfigs };
  }

  /**
   * Host สั่งเริ่มรอบถัดไป
   */
  public hostNextRound(nextRound: number): number {
    if (!this.isHost) throw new Error('Only the host can advance rounds!');

    const newCatId = Math.floor(Math.random() * this.players.length);
    this.sendMessage('NEXT_ROUND', { nextRound, catId: newCatId });
    return newCatId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ระบบ Event Emitter (Subscription & Memory Leak Prevention)
  // ──────────────────────────────────────────────────────────────────────────

  public on<T = any>(event: string, callback: NetworkEventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off<T = any>(event: string, callback: NetworkEventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit<T = any>(event: string, payload: T): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    callbacks.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error(`Error in network listener for ${event}:`, e);
      }
    });
  }
}
