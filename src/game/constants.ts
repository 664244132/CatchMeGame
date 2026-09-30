import * as THREE from "three"

// ─── มิติและขอบเขตของสนามประลองขนาดใหญ่ (Expanded Arena Dimensions: 90x90m) ──
export const ARENA_HALF = 45
export const ARENA_EDGE_CLAMP = ARENA_HALF - 0.7

// ─── การเคลื่อนที่และฟิสิกส์ (Movement & Physics) ──────────────────────────────
export const MOVE_SPEED = 10
export const JUMP_FORCE = 14
export const GRAVITY = -30
export const DASH_SPEED = 24
export const DASH_DURATION = 0.18
export const DASH_COOLDOWN = 2.0
export const PLAYER_RADIUS = 0.5

// ─── กลไกระเบิดและการแตะส่งระเบิด (Bomb & Tag Mechanics) ─────────────────────
export const TAG_DISTANCE = 1.9
export const BOMB_START_TIME = 15.0 // เวลานับถอยหลังระเบิด 15 วินาที

// ─── แพลตฟอร์มสิ่งกีดขวาง 17 จุด (Platforms across 90x90m Arena) ─────────────
export interface PlatformDef {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: number
}

export const PLATFORM_DEFS: readonly PlatformDef[] = [
  // 1. หอคอยใจกลางสนามทรงสูง (Center High Fortress)
  { x: 0, y: 2.5, z: 0, w: 7, h: 5.0, d: 7, color: 0xff9ff3 },

  // 2. ขั้นบันไดหินรอบหอคอยกลาง 4 ทิศ (Inner Stepping Stones)
  { x: -9, y: 1.0, z: 0, w: 4, h: 2.0, d: 4, color: 0xffeaa7 },
  { x: 9, y: 1.0, z: 0, w: 4, h: 2.0, d: 4, color: 0xffeaa7 },
  { x: 0, y: 1.0, z: -9, w: 4, h: 2.0, d: 4, color: 0xffeaa7 },
  { x: 0, y: 1.0, z: 9, w: 4, h: 2.0, d: 4, color: 0xffeaa7 },

  // 3. แท่นลอยขนาดกลาง 4 มุมสนาม (Mid-Quarter Plateaus)
  { x: -20, y: 1.5, z: -20, w: 9, h: 3.0, d: 9, color: 0xff6b6b },
  { x: 20, y: 1.5, z: -20, w: 9, h: 3.0, d: 9, color: 0x6bc5ff },
  { x: -20, y: 1.5, z: 20, w: 9, h: 3.0, d: 9, color: 0xffd93d },
  { x: 20, y: 1.5, z: 20, w: 9, h: 3.0, d: 9, color: 0xa8ff78 },

  // 4. แนวสะพานลอยริมสนาม 4 ด้าน (Outer Elevated Bridges)
  { x: 0, y: 1.4, z: -32, w: 14, h: 2.8, d: 6, color: 0x54a0ff },
  { x: 0, y: 1.4, z: 32, w: 14, h: 2.8, d: 6, color: 0x5f27cd },
  { x: -32, y: 1.4, z: 0, w: 6, h: 2.8, d: 14, color: 0x00d2d3 },
  { x: 32, y: 1.4, z: 0, w: 6, h: 2.8, d: 14, color: 0xff9f43 },

  // 5. ฐานกระโดด 4 มุมขอบสนามชั้นนอก (Outer Corner Jump Bases)
  { x: -34, y: 1.8, z: -34, w: 8, h: 3.6, d: 8, color: 0xee5253 },
  { x: 34, y: 1.8, z: -34, w: 8, h: 3.6, d: 8, color: 0x10ac84 },
  { x: -34, y: 1.8, z: 34, w: 8, h: 3.6, d: 8, color: 0xf368e0 },
  { x: 34, y: 1.8, z: 34, w: 8, h: 3.6, d: 8, color: 0x48dbfb },
] as const

// ─── กำแพงขอบสนามขนาด 90 เมตร (Boundary Walls Definitions) ───────────────────
export interface WallDef {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: number
}

export const WALL_DEFS: readonly WallDef[] = [
  {
    x: 0,
    y: 2.5,
    z: -ARENA_HALF,
    w: ARENA_HALF * 2,
    h: 5,
    d: 0.8,
    color: 0xff3366,
  },
  {
    x: 0,
    y: 2.5,
    z: ARENA_HALF,
    w: ARENA_HALF * 2,
    h: 5,
    d: 0.8,
    color: 0x33ffcc,
  },
  {
    x: -ARENA_HALF,
    y: 2.5,
    z: 0,
    w: 0.8,
    h: 5,
    d: ARENA_HALF * 2,
    color: 0xffcc00,
  },
  {
    x: ARENA_HALF,
    y: 2.5,
    z: 0,
    w: 0.8,
    h: 5,
    d: ARENA_HALF * 2,
    color: 0x6633ff,
  },
] as const

// ─── ตำแหน่งเห็ดตกแต่งกระจายทั่วแผนที่ 24 จุด (Mushroom Spots) ───────────────
export const MUSHROOM_SPOTS: readonly [number, number][] = [
  [-38, -38],
  [38, -38],
  [-38, 38],
  [38, 38],
  [-38, 0],
  [38, 0],
  [0, -38],
  [0, 38],
  [-25, -12],
  [25, -12],
  [-25, 12],
  [25, 12],
  [-12, -25],
  [12, -25],
  [-12, 25],
  [12, 25],
  [-14, -14],
  [14, -14],
  [-14, 14],
  [14, 14],
  [-6, -6],
  [6, -6],
  [-6, 6],
  [6, 6],
] as const

// ─── พาเลท 50 สีสดใสสำหรับผู้เล่น (50 Unique Player Color Palette) ───────────
export const PLAYER_PALETTE: readonly number[] = [
  0x74b9ff, 0xff7675, 0xa29bfe, 0x55efc4, 0xfdcb6e, 0x00cec9, 0xe84393,
  0x6c5ce7, 0x0984e3, 0xd63031, 0x00b894, 0xffbe76, 0xff7979, 0xbadc58,
  0xc7ecee, 0xf6e58d, 0x7ed6df, 0xe056fd, 0x686de0, 0x30336b, 0x95afc0,
  0x22a6b3, 0xbe2edd, 0x4834d4, 0xeb4d4b, 0x6ab04c, 0xf9ca24, 0x130f40,
  0x535c68, 0x38ada9, 0xb8e994, 0x78e08f, 0x60a3bc, 0x4a69bd, 0x079992,
  0x3c6382, 0x82ccdd, 0xb71540, 0xe55039, 0xf6b93b, 0xfa983a, 0x1e3799,
  0x4a47a3, 0x413c69, 0xa37eba, 0xf1c40f, 0xe67e22, 0xe74c3c, 0x3498db,
  0x2ecc71,
] as const

// ─── ฟังก์ชันสร้างจุดเกิดผู้เล่นแบบวงกลมรอบสนามสูงสุด 50 คน (Spawn Positions) ──
export function generateSpawnPositions(
  count: number,
  radius = 32,
): THREE.Vector3[] {
  const spawns: THREE.Vector3[] = []
  const safeCount = Math.max(1, count)
  const angleStep = (Math.PI * 2) / safeCount

  for (let i = 0; i < safeCount; i++) {
    const angle = i * angleStep
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    spawns.push(new THREE.Vector3(x, 1, z))
  }

  return spawns
}
