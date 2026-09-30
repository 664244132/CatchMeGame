import type * as THREE from 'three';

/**
 * สถานะของเกมในแต่ละช่วง (Game Phase)
 */
export enum GamePhase {
  LOBBY = 'LOBBY',
  ROUND_ACTIVE = 'ROUND_ACTIVE',
  ROUND_END = 'ROUND_END',
  MATCH_SUMMARY = 'MATCH_SUMMARY',
}

/**
 * บทบาทในระบบเน็ตเวิร์ก (Network Role)
 */
export type NetworkRole = 'HOST' | 'CLIENT';

/**
 * ข้อมูลผู้เล่นที่อยู่ในห้องพักคอย (Lobby Player)
 */
export interface LobbyPlayer {
  id: number;
  name: string;
  isHost: boolean;
  color: number;
}

/**
 * ข้อมูลสถานะของห้องเล่นเกม (Room State)
 */
export interface RoomState {
  roomCode: string;
  hostId: number;
  players: LobbyPlayer[];
  totalRounds: number;
}

/**
 * ข้อมูลของผู้เล่นแต่ละคน (สำหรับแสดงผล UI และจัดเก็บสถิติ)
 */
export interface PlayerData {
  id: number;
  name: string;
  isHuman: boolean;
  isCat: boolean;
  isDead: boolean;
  survivalCount: number;
  bombsDeflected: number;
  color: number;
}

/**
 * ภาพรวมสถานะเกมล่าสุดที่ส่งไปอัปเดตให้ฝั่ง React Component (State Snapshot)
 */
export interface GameStateSnapshot {
  players: PlayerData[];
  bombTimer: number;
  bombHolderId: number;
  message: string;
  roundActive: boolean;
  dashCooldown: number;
}

/**
 * โครงสร้างฟิสิกส์สำหรับการเคลื่อนที่ของตัวละคร
 */
export interface PhysicsBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded: boolean;
}

/**
 * เอนทิตีตัวละครภายใน GameEngine (สำหรับผู้เล่นคนจริง ไม่ใช้ AI)
 */
export interface PlayerEntity {
  id: number;
  name: string;
  isHuman: boolean;
  data: PlayerData;
  body: PhysicsBody;
  mesh: THREE.Group;
  bombIndicator: THREE.Group;
  dashTimer: number;
  dashCooldown: number;
  isDashing: boolean;
  dashDir: THREE.Vector3;
  keys: Set<string>; // คีย์บอร์ดอินพุตของผู้เล่นคนนี้ (ส่งผ่านเน็ตเวิร์กหรือกดเอง)
}

/**
 * ข้อมูลแพลตฟอร์มสิ่งกีดขวางในฉาก
 */
export interface Platform {
  position: THREE.Vector3;
  halfSize: THREE.Vector3;
}

/**
 * ละอองอนุภาคเอฟเฟกต์การระเบิด
 * Zero-GC: ใช้ Float32Array จัดเก็บความเร็ว (vx, vy, vz) แทน Vector3[] เพื่อลดภาระ Garbage Collection
 */
export interface ExplosionParticle {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  maxLife: number;
}

/**
 * คอนฟิกเริ่มต้นสำหรับผู้เล่นแต่ละคน
 */
export interface PlayerConfig {
  id: number;
  name: string;
  isHuman: boolean;
  color: number;
}

// ─── Network Messaging Types (Discriminated Unions) ───────────────────────────

export type NetworkMessageType =
  | 'JOIN_ROOM'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'START_GAME'
  | 'PLAYER_INPUT'
  | 'SYNC_STATE'
  | 'ROUND_END'
  | 'NEXT_ROUND'
  | 'MATCH_OVER'
  | 'RESET_LOBBY';

/**
 * ข้อมูลตำแหน่งและสถานะของผู้เล่นที่ซิงค์ผ่านเน็ตเวิร์ก
 */
export interface SyncedPlayerState {
  id: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isCat: boolean;
  isDead: boolean;
  survivalCount: number;
  bombsDeflected: number;
  dashCooldown: number;
}

export interface JoinRoomPayload {
  name: string;
  requestedId?: number;
}

export interface PlayerJoinedPayload {
  player: LobbyPlayer;
  players: LobbyPlayer[];
}

export interface PlayerLeftPayload {
  playerId: number;
  players: LobbyPlayer[];
}

export interface StartGamePayload {
  initialCatId: number;
  totalRounds: number;
}

export interface PlayerInputPayload {
  playerId: number;
  keys: string[];
}

export interface SyncStatePayload {
  bombTimer: number;
  bombHolderId: number;
  message: string;
  roundActive: boolean;
  players: SyncedPlayerState[];
}

export interface RoundEndPayload {
  players: PlayerData[];
}

export interface NextRoundPayload {
  roundNumber: number;
  initialCatId: number;
}

export interface MatchOverPayload {
  results: PlayerData[];
}

export type ResetLobbyPayload = Record<string, never>;

/**
 * Discriminated Union สำหรับ Network Message ทั้งหมด
 */
export type NetworkMessage =
  | { type: 'JOIN_ROOM'; senderId: number; payload: JoinRoomPayload }
  | { type: 'PLAYER_JOINED'; senderId: number; payload: PlayerJoinedPayload }
  | { type: 'PLAYER_LEFT'; senderId: number; payload: PlayerLeftPayload }
  | { type: 'START_GAME'; senderId: number; payload: StartGamePayload }
  | { type: 'PLAYER_INPUT'; senderId: number; payload: PlayerInputPayload }
  | { type: 'SYNC_STATE'; senderId: number; payload: SyncStatePayload }
  | { type: 'ROUND_END'; senderId: number; payload: RoundEndPayload }
  | { type: 'NEXT_ROUND'; senderId: number; payload: NextRoundPayload }
  | { type: 'MATCH_OVER'; senderId: number; payload: MatchOverPayload }
  | { type: 'RESET_LOBBY'; senderId: number; payload: ResetLobbyPayload };
