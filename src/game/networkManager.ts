import { PLAYER_PALETTE } from './constants';
import type {
  LobbyPlayer,
  NetworkMessage,
  NetworkMessageType,
  PlayerConfig,
  PlayerInputPayload,
  SyncStatePayload,
  RoundEndPayload,
} from './types';

/**
 * รูปแบบ Callback สำหรับการรับฟังเหตุการณ์ทางเครือข่าย
 */
export type NetworkEventCallback<T = unknown> = (payload: T) => void;

/**
 * NetworkManager - ระบบจัดการเครือข่ายห้องและการสื่อสารแบบเรียลไทม์ (Real-Time Room Network)
 *
 * รองรับ:
 * 1. ระบบ Room Code: สร้างรหัสห้องสุ่ม 6 หลัก และเข้าร่วมห้องด้วยรหัส
 * 2. Host-Authoritative Architecture: หัวหน้าห้องเป็นผู้ควบคุมการเริ่มเกมและซิงค์ข้อมูล
 * 3. Zero-Server / Serverless Transport: ใช้ BroadcastChannel สำหรับการทดสอบข้ามแท็บ/หน้าต่างได้ทันที
 *    โดยไม่ต้องพึ่งพาเซิร์ฟเวอร์ฐานข้อมูลภายนอก (ตามกฎข้อ 10 และ 14 ใน REFACTORCODE.md)
 */
export class NetworkManager {
  private static instance: NetworkManager | null = null;

  public roomCode: string | null = null;
  public isHost = false;
  public localPlayer: LobbyPlayer | null = null;
  public players: LobbyPlayer[] = [];

  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<NetworkEventCallback<any>>> = new Map();

  private constructor() {}

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. การสร้างและเข้าร่วมห้อง (Room Creation & Joining)
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
  public createRoom(hostName = 'Host Player'): string {
    this.leaveRoom();

    const code = this.generateRoomCode();
    this.roomCode = code;
    this.isHost = true;

    this.localPlayer = {
      id: 0,
      name: hostName,
      isHost: true,
      color: PLAYER_PALETTE[0],
    };
    this.players = [this.localPlayer];

    this.initChannel(code);
    return code;
  }

  /**
   * เข้าร่วมห้องที่มีอยู่แล้วด้วยรหัสห้อง (Room Code)
   */
  public joinRoom(code: string, playerName = 'Guest Player'): void {
    this.leaveRoom();

    const normalizedCode = code.trim().toUpperCase();
    this.roomCode = normalizedCode;
    this.isHost = false;

    // สุ่มสร้าง ID ชั่วคราวจาก timestamp จนกว่า Host จะกำหนด ID ถาวรให้
    const tempId = Math.floor(Math.random() * 8999) + 1000;
    const colorIndex = (tempId % (PLAYER_PALETTE.length - 1)) + 1;

    this.localPlayer = {
      id: tempId,
      name: playerName,
      isHost: false,
      color: PLAYER_PALETTE[colorIndex],
    };
    this.players = [this.localPlayer];

    this.initChannel(normalizedCode);

    // ส่งข้อความแจ้ง Host เพื่อขอเข้าร่วมห้อง
    this.sendMessage('JOIN_ROOM', {
      player: this.localPlayer,
    });
  }

  /**
   * ออกจากห้องปัจจุบันและคืนทรัพยากร
   */
  public leaveRoom(): void {
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
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. การรับส่งข้อความผ่านแชนเนล (Channel Communication)
  // ──────────────────────────────────────────────────────────────────────────

  private initChannel(code: string) {
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

    this.channel.postMessage(message);
  }

  private handleIncomingMessage(msg: NetworkMessage) {
    // 1. จัดการข้อความฝั่ง Host
    if (this.isHost) {
      this.handleHostMessage(msg);
      return;
    }

    // 2. จัดการข้อความฝั่ง Guest/Client
    this.handleClientMessage(msg);
  }

  /**
   * ตรรกะจัดการข้อความเน็ตเวิร์กบนเครื่อง Host
   */
  private handleHostMessage(msg: NetworkMessage) {
    if (msg.type === 'JOIN_ROOM') {
      const payload = msg.payload as { player?: LobbyPlayer };
      const newPlayer = payload?.player;
      if (!newPlayer) return;

      // ตรวจสอบความจุห้องสูงสุด 50 คน
      if (this.players.length >= 50) return;

      const assignedId = this.players.length;
      const color = PLAYER_PALETTE[assignedId % PLAYER_PALETTE.length];

      const assignedPlayer: LobbyPlayer = {
        ...newPlayer,
        id: assignedId,
        color,
      };

      // ป้องกันผู้เล่นซ้ำ
      const isDuplicate = this.players.some(
        (p) => p.name === assignedPlayer.name && p.id === assignedPlayer.id,
      );
      if (isDuplicate) return;

      this.players.push(assignedPlayer);
      this.emit('lobby_updated', [...this.players]);

      // ส่งรายชื่อผู้เล่นล่าสุดกลับไปให้ทุกคนในห้อง
      this.sendMessage('PLAYER_JOINED', {
        players: this.players,
        assignedId,
      });
      return;
    }

    if (msg.type === 'PLAYER_LEFT') {
      const payload = msg.payload as { playerId?: number };
      if (typeof payload?.playerId !== 'number') return;

      this.players = this.players.filter((p) => p.id !== payload.playerId);
      this.emit('lobby_updated', [...this.players]);
      this.sendMessage('PLAYER_LEFT', { players: this.players });
      return;
    }

    if (msg.type === 'PLAYER_INPUT') {
      this.emit('remote_input', msg.payload as PlayerInputPayload);
      return;
    }
  }

  /**
   * ตรรกะจัดการข้อความเน็ตเวิร์กบนเครื่อง Client
   */
  private handleClientMessage(msg: NetworkMessage) {
    if (msg.type === 'PLAYER_JOINED') {
      const payload = msg.payload as { players?: LobbyPlayer[]; assignedId?: number };
      const currentPlayers = payload?.players;
      if (!Array.isArray(currentPlayers)) return;

      this.players = currentPlayers;

      // อัปเดต ID ของเครื่องเราตามที่ Host กำหนดให้
      if (payload.assignedId !== undefined && this.localPlayer && this.localPlayer.id > 50) {
        const match = currentPlayers.find((p) => p.name === this.localPlayer?.name);
        if (match) {
          this.localPlayer.id = match.id;
          this.localPlayer.color = match.color;
        }
      }

      this.emit('lobby_updated', [...this.players]);
      return;
    }

    if (msg.type === 'PLAYER_LEFT') {
      const payload = msg.payload as { players?: LobbyPlayer[] };
      if (Array.isArray(payload?.players)) {
        this.players = payload.players;
        this.emit('lobby_updated', [...this.players]);
      }
      return;
    }

    if (msg.type === 'START_GAME') {
      this.emit('game_started', msg.payload);
      return;
    }

    if (msg.type === 'SYNC_STATE') {
      this.emit('sync_state', msg.payload as SyncStatePayload);
      return;
    }

    if (msg.type === 'ROUND_END') {
      this.emit('round_end', msg.payload as RoundEndPayload);
      return;
    }

    if (msg.type === 'NEXT_ROUND') {
      this.emit('next_round', msg.payload);
      return;
    }

    if (msg.type === 'MATCH_OVER') {
      this.emit('match_over', msg.payload);
      return;
    }

    if (msg.type === 'RESET_LOBBY') {
      this.emit('reset_lobby', msg.payload);
      return;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. คำสั่งของ Host สำหรับควบคุมเกม (Host Commands)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Host สั่งเริ่มเกม (ส่งรายชื่อผู้เล่น, จำนวนรอบ, และผู้ถือระเบิดคนแรก)
   */
  public hostStartGame(totalRounds: number): { catId: number; playerConfigs: PlayerConfig[] } {
    if (!this.isHost) throw new Error('Only the host can start the game!');

    const catId = Math.floor(Math.random() * this.players.length);
    const playerConfigs: PlayerConfig[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: true,
      color: p.color,
    }));

    const payload = {
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
  // 4. ระบบ Event Emitter (Subscription & Memory Leak Prevention)
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
