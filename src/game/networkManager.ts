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

/**
 * NetworkManager - ระบบจัดการเครือข่ายห้องและการสื่อสารแบบเรียลไทม์ (Real-Time Room Network)
 *
 * รองรับ:
 * 1. ระบบ Room Code: สร้างรหัสห้องสุ่ม 6 หลัก และเข้าร่วมห้องด้วยรหัส
 * 2. Handshake ด้วย ACK: ป้องกันปัญหาสมัครเข้าห้องแล้วหมุนโหลดค้าง
 * 3. Room Registry (LocalStorage Fallback): เก็บสถานะห้องข้ามแท็บเบราว์เซอร์ เพื่อให้ตรวจสอบห้องที่มีอยู่จริงได้ทันที
 * 4. Host-Authoritative Architecture: หัวหน้าห้องเป็นผู้ควบคุมการเริ่มเกมและซิงค์ข้อมูล
 * 5. Zero-Server / Serverless Transport: ใช้ BroadcastChannel ร่วมกับ LocalStorage
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

  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<NetworkEventCallback<any>>> = new Map();

  // ตัวจัดการเวลา (Timers) ป้องกันการหมุนค้างและจัดการ Heartbeat
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
  // 1. ระบบ LocalStorage Room Registry (ตรวจสอบและค้นหาห้องข้ามแท็บ)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * ดักฟังการเปลี่ยนแปลงของ LocalStorage เมื่อแท็บ Host อัปเดตสถานะห้อง
   */
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

    // ล้างห้องเมื่อปิดหน้าต่างเบราว์เซอร์
    window.addEventListener('beforeunload', () => {
      if (this.isHost && this.roomCode) {
        this.removeRoomFromStorage(this.roomCode);
      }
    });
  }

  /**
   * จัดการอัปเดตเมื่อได้รับข้อมูลห้องจาก LocalStorage
   */
  private handleStorageRoomUpdate(roomData: RoomRegistryItem) {
    if (this.isHost) return;

    // อัปเดตรายชื่อผู้เล่นจาก Storage หากมีข้อมูลใหม่
    if (Array.isArray(roomData.players) && roomData.players.length > 0) {
      this.players = roomData.players;
      this.emit('lobby_updated', [...this.players]);
    }

    // หาก Host กดเริ่มเกมใน Storage และเครื่องนี้ยังไม่เริ่ม ให้เริ่มเกมตาม
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

  /**
   * บันทึกข้อมูลห้องลงใน LocalStorage
   */
  public saveRoomToStorage(room: RoomRegistryItem): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${ROOM_STORAGE_KEY_PREFIX}${room.code}`, JSON.stringify(room));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  /**
   * ดึงข้อมูลห้องจาก LocalStorage
   */
  public getRoomFromStorage(code: string): RoomRegistryItem | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${ROOM_STORAGE_KEY_PREFIX}${code.toUpperCase()}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RoomRegistryItem;

      // ตรวจสอบว่าห้องยังไม่หมดอายุ (Heartbeat ไม่เกิน 90 วิ)
      if (Date.now() - parsed.updatedAt > ROOM_TIMEOUT_MS) {
        this.removeRoomFromStorage(code);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * ลบข้อมูลห้องออกจาก LocalStorage
   */
  public removeRoomFromStorage(code: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${ROOM_STORAGE_KEY_PREFIX}${code.toUpperCase()}`);
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
  }

  /**
   * อัปเดตข้อมูลห้องในฐานะ Host
   */
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
  // 2. การสร้างและเข้าร่วมห้อง (Room Creation & Joining)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * สุ่มสร้างรหัสห้องใหม่ 6 ตัวอักษร เช่น 'CAT-784'
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CAT-';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * สร้างห้องใหม่ในฐานะ Host
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

    this.initChannel(code);
    this.updateHostRoomStorage('WAITING');

    // ส่งสัญญาณ Heartbeat ทุกๆ 2.5 วินาที เพื่อรักษาห้องให้คงอยู่
    this.heartbeatInterval = window.setInterval(() => {
      this.updateHostRoomStorage(this.isGameRunning ? 'PLAYING' : 'WAITING');
    }, 2500);

    return code;
  }

  /**
   * เข้าร่วมห้องที่มีอยู่แล้วด้วยรหัสห้อง (Room Code)
   * มีระบบ Handshake + ACK + Auto-retry ป้องกันการหมุนโหลดค้าง
   */
  public joinRoom(code: string, playerName = 'Guest Player'): void {
    this.leaveRoom();

    const normalizedCode = code.trim().toUpperCase();
    this.roomCode = normalizedCode;
    this.isHost = false;
    this.isGameRunning = false;
    this.isConnectedToHost = false;
    this.joinAttempts = 0;
    this.clientToken = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // ตรวจสอบห้องใน Storage ก่อนทันที
    const existingRoom = this.getRoomFromStorage(normalizedCode);
    if (!existingRoom) {
      // หากใน Storage ยังไม่พบ ให้เปิด Channel ลองคุยกับ Host ดูก่อน (อาจเป็นต่าง Context)
      console.log(`Room ${normalizedCode} not found in immediate storage, trying BroadcastChannel...`);
    } else {
      // หากพบข้อมูลห้องใน Storage ให้นำรายชื่อผู้เล่นเดิมมาแสดงล่วงหน้า
      this.players = existingRoom.players;
      this.currentTotalRounds = existingRoom.totalRounds;
    }

    // สร้างข้อมูลผู้เล่นชั่วคราว
    const tempId = Math.floor(Math.random() * 8999) + 1000;
    const colorIndex = (tempId % (PLAYER_PALETTE.length - 1)) + 1;

    this.localPlayer = {
      id: tempId,
      name: playerName,
      isHost: false,
      color: PLAYER_PALETTE[colorIndex],
      clientToken: this.clientToken,
    };

    // เชื่อมต่อ BroadcastChannel
    this.initChannel(normalizedCode);

    // เริ่มต้นกระบวนการส่งคำขอเข้าห้องพร้อมระบบ Retry
    this.sendJoinRoomRequest();
  }

  /**
   * ส่งคำขอเข้าห้อง (JOIN_ROOM) พร้อมระบบจับเวลา Timeout ป้องกันการหมุนค้าง
   */
  private sendJoinRoomRequest(): void {
    if (!this.localPlayer || !this.roomCode || this.isConnectedToHost) return;

    this.joinAttempts++;
    this.emit('join_status', {
      status: 'CONNECTING',
      attempt: this.joinAttempts,
      message: 'กำลังติดต่อหัวหน้าห้อง...',
    });

    // ส่งข้อความ JOIN_ROOM ไปยัง Host
    const payload: JoinRoomPayload = {
      player: this.localPlayer,
      name: this.localPlayer.name,
      requestedId: this.localPlayer.id,
      clientToken: this.clientToken,
    };
    this.sendMessage('JOIN_ROOM', payload);

    // ตั้งเวลา 1.2 วินาที หากยังไม่ได้รับการตอบกลับ (ACK) ให้ลองส่งซ้ำ
    this.joinRetryTimeout = window.setTimeout(() => {
      if (this.isConnectedToHost) return;

      if (this.joinAttempts < 4) {
        this.sendJoinRoomRequest();
      } else {
        // หากลองครบ 4 ครั้ง (~5 วินาที) แล้วยังไม่มีการตอบกลับ
        const roomCheck = this.roomCode ? this.getRoomFromStorage(this.roomCode) : null;
        if (roomCheck) {
          // หากพบห้องใน Storage แต่อาจติดขัด Broadcast ให้ดึงข้อมูลมาเชื่อมต่อตรง
          this.isConnectedToHost = true;
          this.players = roomCheck.players;
          this.emit('join_success', {
            players: this.players,
            roomCode: this.roomCode,
          });
          this.emit('lobby_updated', [...this.players]);
        } else {
          // แจ้งเตือนข้อผิดพลาด ไม่ปล่อยให้หมุนค้าง
          this.emit('join_failed', {
            reason: `ไม่พบรหัสห้อง "${this.roomCode}" หรือหัวหน้าห้องปิดหน้าต่างไปแล้ว กรุณาตรวจสอบรหัสห้องอีกครั้ง`,
          });
        }
      }
    }, 1200);
  }

  /**
   * ออกจากห้องปัจจุบันและคืนทรัพยากร
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
  // 3. การรับส่งข้อความผ่านแชนเนล (Channel Communication)
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

  public sendMessage(type: NetworkMessageType, payload: unknown): void {
    if (!this.channel || !this.localPlayer) return;

    const message = {
      type,
      senderId: this.localPlayer.id,
      payload,
    } as NetworkMessage;

    try {
      this.channel.postMessage(message);
    } catch (e) {
      console.error('Failed to postMessage:', e);
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
   * ตรรกะจัดการข้อความเน็ตเวิร์กบนเครื่อง Host
   */
  private handleHostMessage(msg: NetworkMessage) {
    // 1. ผู้เล่นใหม่ขอเข้าร่วมห้อง (JOIN_ROOM)
    if (msg.type === 'JOIN_ROOM') {
      const payload = msg.payload as JoinRoomPayload;
      if (!payload || !payload.clientToken) return;

      // ตรวจสอบความจุห้องสูงสุด 50 คน
      if (this.players.length >= 50) {
        this.sendMessage('JOIN_ROOM_ACK', {
          success: false,
          message: 'ห้องเต็มแล้ว (สูงสุด 50 คน)',
          clientToken: payload.clientToken,
          assignedId: -1,
          players: this.players,
        } as JoinRoomAckPayload);
        return;
      }

      // ตรวจสอบว่าผู้เล่นนี้เคยลงทะเบียนไว้หรือยัง (ป้องกันการส่งซ้ำจาก Retry)
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

      // ส่งข้อความยืนยัน (ACK) ให้ Guest ทราบทันที
      this.sendMessage('JOIN_ROOM_ACK', {
        success: true,
        clientToken: payload.clientToken,
        assignedId: targetPlayer.id,
        players: this.players,
        totalRounds: this.currentTotalRounds,
        isGameRunning: this.isGameRunning,
      } as JoinRoomAckPayload);

      // กระจายรายชื่อผู้เล่นทั้งหมดให้ทุกคนในห้องอัปเดต
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
   * ตรรกะจัดการข้อความเน็ตเวิร์กบนเครื่อง Client
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

      // หยุดตัวนับเวลา Retry
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

      // หากเป็นตัวเราเองที่ได้รับ assignedId
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
  // 4. คำสั่งของ Host สำหรับควบคุมเกม (Host Commands)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Host สั่งเริ่มเกม (ส่งรายชื่อผู้เล่น, จำนวนรอบ, และผู้ถือระเบิดคนแรก)
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
  // 5. ระบบ Event Emitter (Subscription & Memory Leak Prevention)
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
