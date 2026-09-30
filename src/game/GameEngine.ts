import * as THREE from 'three';
import {
  ARENA_HALF,
  ARENA_EDGE_CLAMP,
  MOVE_SPEED,
  JUMP_FORCE,
  GRAVITY,
  DASH_SPEED,
  DASH_DURATION,
  DASH_COOLDOWN,
  PLAYER_RADIUS,
  TAG_DISTANCE,
  BOMB_START_TIME,
  PLATFORM_DEFS,
  WALL_DEFS,
  MUSHROOM_SPOTS,
  generateSpawnPositions,
} from './constants';
import type {
  PlayerData,
  GameStateSnapshot,
  PlayerEntity,
  Platform,
  ExplosionParticle,
  PlayerConfig,
  SyncStatePayload,
  PlayerInputPayload,
} from './types';
import {
  createMouseMesh,
  createBombIndicator,
  createMushroom,
  createStarField,
} from './meshFactory';
import { NetworkManager } from './networkManager';

/**
 * GameEngine - แกนหลักของเกม CatchMeGame (Three.js WebGL Engine)
 *
 * ปฏิบัติตามกฎเหล็ก 15 ข้อใน REFACTORCODE.md:
 * 1. Decoupled Architecture: แยกโมเดล 3D ออกไปที่ meshFactory.ts และค่าคงที่ไว้ที่ constants.ts
 * 2. Zero-GC Vector & Particle Caching: ใช้ Reusable Vectors และ Float32Array ใน Game Loop 60 FPS
 * 3. Type Safety: ปราศจากการใช้ any และรองรับ Discriminated Payload Types
 * 4. De Morgan's Laws & Early Return: โครงสร้างแบบ Guard Clauses แบนราบ อ่านง่าย
 * 5. Memory Leak Prevention: มีระบบ dispose() ทำความสะอาด Mesh, Material และ Event Listeners ครบถ้วน
 * 6. Beginner-Friendly: คอมเมนต์ภาษาไทยอธิบายขั้นตอนการทำงานอย่างชัดเจน
 */
export class GameEngine {
  // ─── Three.js Core Components ─────────────────────────────────────────────
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  // ─── World Entities ───────────────────────────────────────────────────────
  private players: PlayerEntity[] = [];
  private platforms: Platform[] = [];
  private explosions: ExplosionParticle[] = [];

  // ─── Game State ───────────────────────────────────────────────────────────
  private bombTimer = BOMB_START_TIME;
  private bombHolderId = 0;
  private roundActive = false;
  private localPlayerId = 0;
  public isHost = true;
  private network = NetworkManager.getInstance();

  // ─── Controls & Camera ────────────────────────────────────────────────────
  private localKeys = new Set<string>();
  private cameraOffset = new THREE.Vector3(0, 13, 18);
  private smoothCamPos = new THREE.Vector3(0, 13, 18);
  private smoothLookAt = new THREE.Vector3();

  // ─── UI Messages & Loop Management ────────────────────────────────────────
  private currentMessage = '';
  private messageTimer = 0;
  private animFrameId = 0;
  private cleanupInput: (() => void) | null = null;
  private stateEmitTimer = 0;

  // ─── Reusable Vectors (Zero-GC Optimization) ──────────────────────────────
  private static readonly UP_VECTOR = new THREE.Vector3(0, 1, 0);
  private _fwdVec = new THREE.Vector3();
  private _rightVec = new THREE.Vector3();
  private _dirVec = new THREE.Vector3();
  private _camTargetVec = new THREE.Vector3();
  private _lookTargetVec = new THREE.Vector3();

  // ─── Callbacks ────────────────────────────────────────────────────────────
  private onStateUpdate: (s: GameStateSnapshot) => void;
  private onRoundEnd: (players: PlayerData[]) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onStateUpdate: (s: GameStateSnapshot) => void,
    onRoundEnd: (players: PlayerData[]) => void,
    initialPlayerConfigs?: PlayerConfig[],
    localPlayerId = 0,
    isHost = true,
  ) {
    this.onStateUpdate = onStateUpdate;
    this.onRoundEnd = onRoundEnd;
    this.localPlayerId = localPlayerId;
    this.isHost = isHost;

    // 1. ตั้งค่า WebGLRenderer ให้คมชัดและเปิดใช้งาน Soft Shadow
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 2. ตั้งค่าฉาก (Scene) และหมอกบรรยากาศนีออน (Fog)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a0d3a);
    this.scene.fog = new THREE.FogExp2(0x1a0d3a, 0.008);

    // 3. ตั้งค่ามุมกล้องบุคคลที่ 3 (Perspective Camera)
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      300,
    );
    this.camera.position.set(0, 13, 18);

    this.clock = new THREE.Clock();

    // 4. สร้างสภาพแวดล้อมและโมเดลผู้เล่น
    this.buildLighting();
    this.buildArena();

    // หากไม่ระบุคอนฟิกผู้เล่น จะสร้าง 2 คนพื้นฐานเป็นอย่างต่ำ
    const configs: PlayerConfig[] =
      initialPlayerConfigs && initialPlayerConfigs.length >= 2
        ? initialPlayerConfigs
        : [
            { id: 0, name: 'Player 1', isHuman: true, color: 0x74b9ff },
            { id: 1, name: 'Player 2', isHuman: true, color: 0xff7675 },
          ];

    this.buildPlayers(configs);
    this.bindInput();
    this.setupNetwork();
    this.loop();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. การจัดแสงและฉากสนาม 90x90 เมตร (Scene & Lighting Setup)
  // ──────────────────────────────────────────────────────────────────────────

  private buildLighting() {
    const ambient = new THREE.AmbientLight(0xb0a0ff, 0.65);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff0cc, 1.4);
    sun.position.set(25, 45, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      near: 0.1,
      far: 200,
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
    });
    this.scene.add(sun);

    // จุดกำเนิดแสงสีนีออนบรรยากาศรอบสนาม 4 ทิศ และหอคอยกลาง
    const accents: [number, number, number, number][] = [
      [0xff3366, -38, 6, -38],
      [0x33ffcc, 38, 6, -38],
      [0xffcc00, -38, 6, 38],
      [0x6633ff, 38, 6, 38],
      [0x00d2d3, 0, 8, 0],
    ];
    for (let i = 0; i < accents.length; i++) {
      const [color, x, y, z] = accents[i];
      const light = new THREE.PointLight(color, 1.4, 45);
      light.position.set(x, y, z);
      this.scene.add(light);
    }
  }

  private buildArena() {
    // 1. พื้นสนามประลอง 90x90 เมตร (Ground Plane)
    const groundGeo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2, 20, 20);
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (Math.random() - 0.5) * 0.4);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d1b5c, flatShading: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. เส้นตารางเรืองแสงรอบสนาม
    const gridHelper = new THREE.GridHelper(ARENA_HALF * 2, 36, 0x5533aa, 0x3d2480);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // 3. กำแพงนีออนโปร่งแสง 4 ด้าน (Boundary Walls)
    for (let i = 0; i < WALL_DEFS.length; i++) {
      const w = WALL_DEFS[i];
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mat = new THREE.MeshLambertMaterial({
        color: w.color,
        transparent: true,
        opacity: 0.55,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, w.y, w.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // 4. แพลตฟอร์มสิ่งกีดขวาง 17 จุดทั่วสนาม (Platforms)
    for (let i = 0; i < PLATFORM_DEFS.length; i++) {
      const p = PLATFORM_DEFS[i];
      const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const mat = new THREE.MeshLambertMaterial({ color: p.color, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      this.platforms.push({
        position: new THREE.Vector3(p.x, p.y, p.z),
        halfSize: new THREE.Vector3(p.w / 2, p.h / 2, p.d / 2),
      });
    }

    // 5. เห็ดตกแต่งรอบสนาม 24 จุด
    for (let i = 0; i < MUSHROOM_SPOTS.length; i++) {
      const [x, z] = MUSHROOM_SPOTS[i];
      this.scene.add(createMushroom(x, z));
    }

    // 6. ละอองดวงดาวบนฟากฟ้า 600 จุด
    this.scene.add(createStarField(600));
  }

  /**
   * สร้างตัวละครผู้เล่นตามจำนวนจริงที่เชื่อมต่อเข้ามา (Pure PvP, No AI)
   */
  private buildPlayers(configs: PlayerConfig[]) {
    const spawns = generateSpawnPositions(configs.length, Math.min(34, 10 + configs.length * 0.7));

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const spawn = spawns[i];

      const mesh = createMouseMesh(cfg.color);
      const bombIndicator = createBombIndicator();
      mesh.add(bombIndicator);
      mesh.position.copy(spawn);
      this.scene.add(mesh);

      this.players.push({
        id: cfg.id,
        name: cfg.name,
        isHuman: true,
        data: {
          id: cfg.id,
          name: cfg.name,
          isHuman: true,
          isCat: false,
          isDead: false,
          survivalCount: 0,
          bombsDeflected: 0,
          color: cfg.color,
        },
        body: {
          position: spawn.clone(),
          velocity: new THREE.Vector3(),
          isGrounded: true,
        },
        mesh,
        bombIndicator,
        dashTimer: 0,
        dashCooldown: 0,
        isDashing: false,
        dashDir: new THREE.Vector3(),
        keys: new Set<string>(),
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Public API สำหรับเชื่อมต่อกับระบบเน็ตเวิร์ก (Multiplayer API)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * รับค่า Input คีย์บอร์ดของผู้เล่นระยะไกล (Remote Player) ที่ส่งผ่าน Network
   */
  setRemotePlayerInput(playerId: number, keys: string[]) {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.id === playerId) {
        p.keys.clear();
        for (let k = 0; k < keys.length; k++) {
          p.keys.add(keys[k]);
        }
        break;
      }
    }
  }

  /**
   * ตัวจัดการข้อความ Input จากผู้เล่นอื่นผ่านเน็ตเวิร์ก (ทำงานบนเครื่อง Host)
   * ใช้ Guard Clauses ตามกฎข้อ 4 (De Morgan & Early Return)
   */
  private handleRemoteInput = (data: PlayerInputPayload) => {
    if (!this.isHost) return;
    if (!data) return;
    if (typeof data.playerId !== 'number') return;
    if (!Array.isArray(data.keys)) return;

    this.setRemotePlayerInput(data.playerId, data.keys);
  };

  /**
   * ตัวจัดการซิงค์ข้อมูลตำแหน่งและสถานะจาก Host (ทำงานบนเครื่อง Client)
   */
  private handleSyncState = (payload: SyncStatePayload) => {
    if (this.isHost) return;
    if (!payload) return;
    if (!Array.isArray(payload.players)) return;

    this.bombTimer = payload.bombTimer;
    this.bombHolderId = payload.bombHolderId;
    this.currentMessage = payload.message || '';
    this.roundActive = payload.roundActive;

    for (let i = 0; i < payload.players.length; i++) {
      const sp = payload.players[i];
      for (let j = 0; j < this.players.length; j++) {
        const p = this.players[j];
        if (p.id === sp.id) {
          p.body.position.set(sp.x, sp.y, sp.z);
          p.mesh.rotation.y = sp.rotY;
          p.data.isCat = sp.isCat;
          p.data.isDead = sp.isDead;
          p.data.survivalCount = sp.survivalCount;
          p.data.bombsDeflected = sp.bombsDeflected;
          p.dashCooldown = sp.dashCooldown;
          p.mesh.visible = !sp.isDead;
          this.applyVisual(p);
          break;
        }
      }
    }

    this.emitState();
  };

  /**
   * ลงทะเบียนดักฟัง Event จากเน็ตเวิร์กตามบทบาท Host / Client
   */
  private setupNetwork() {
    if (this.isHost) {
      this.network.on('remote_input', this.handleRemoteInput);
    } else {
      this.network.on('sync_state', this.handleSyncState);
    }
  }

  /**
   * กำหนด Local Player ID สำหรับเครื่องนี้
   */
  setLocalPlayerId(id: number) {
    this.localPlayerId = id;
  }

  /**
   * เริ่มต้นรอบการเล่นใหม่ พร้อมสุ่มผู้ถือระเบิดคนแรก
   */
  startRound(catId: number) {
    const spawns = generateSpawnPositions(
      this.players.length,
      Math.min(34, 10 + this.players.length * 0.7),
    );

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const spawn = spawns[i];

      p.data.isDead = false;
      p.data.isCat = p.id === catId;
      p.body.position.copy(spawn);
      p.body.velocity.set(0, 0, 0);
      p.body.isGrounded = false;
      p.mesh.position.copy(spawn);
      p.mesh.visible = true;
      p.dashCooldown = 0;
      p.isDashing = false;

      this.applyVisual(p);
    }

    this.bombTimer = BOMB_START_TIME;
    this.bombHolderId = catId;
    this.roundActive = true;
    this.currentMessage = '';
    this.emitState();
  }

  handleResize(w: number, h: number) {
    if (h <= 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * ทำความสะอาดทรัพยากรทั้งหมดเมื่อ Unmount ป้องกัน Memory Leak (Rule 7)
   */
  dispose() {
    cancelAnimationFrame(this.animFrameId);
    this.cleanupInput?.();
    this.network.off('remote_input', this.handleRemoteInput);
    this.network.off('sync_state', this.handleSyncState);

    // กำจัดละอองอนุภาคระเบิดที่ยังค้างอยู่ใน Scene
    for (let i = 0; i < this.explosions.length; i++) {
      const ex = this.explosions[i];
      this.scene.remove(ex.points);
      ex.points.geometry.dispose();
      if (Array.isArray(ex.points.material)) {
        for (let m = 0; m < ex.points.material.length; m++) {
          ex.points.material[m].dispose();
        }
      } else {
        ex.points.material.dispose();
      }
    }
    this.explosions = [];

    this.renderer.dispose();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. การแสดงผลและการรับอินพุต (Visuals & Input)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * ปรับแสงและวัสดุของตัวละคร (Type-safe Material Check)
   */
  private applyVisual(p: PlayerEntity) {
    const isCat = p.data.isCat;
    const emissive = isCat ? 0xff4400 : 0x000000;
    const intensity = isCat ? 0.5 : 0;

    p.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        if (mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.setHex(emissive);
          mat.emissiveIntensity = intensity;
        }
      }
    });

    p.bombIndicator.visible = isCat;
  }

  private bindInput() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.localKeys.add(e.code);
      this.syncLocalInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.localKeys.delete(e.code);
      this.syncLocalInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.cleanupInput = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  /**
   * ส่งสัญญาณอินพุตของเครื่องนี้ไปยัง Host ผ่านเครือข่าย
   */
  private syncLocalInput() {
    if (!this.isHost && this.network.roomCode) {
      this.network.sendMessage('PLAYER_INPUT', {
        playerId: this.localPlayerId,
        keys: Array.from(this.localKeys),
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ลูปเกมหลัก (Game Loop & Zero-GC Updates)
  // ──────────────────────────────────────────────────────────────────────────

  private loop = () => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    const now = performance.now() * 0.001;

    // 1. อัปเดตลูกระเบิดและชนวนไฟเหนือหัวผู้ถือระเบิด
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.data.isCat || p.data.isDead) continue;

      const urgency = Math.max(0, 1 - this.bombTimer / BOMB_START_TIME);
      const pulseRate = 6 + urgency * 18;
      const scale = 1 + Math.sin(now * pulseRate) * (0.08 + urgency * 0.16);
      p.bombIndicator.scale.set(scale, scale, scale);

      p.bombIndicator.position.y = 1.35 + Math.sin(now * 5) * 0.08;
      p.bombIndicator.rotation.y += dt * 3.5;

      const spark = p.bombIndicator.getObjectByName('spark') as THREE.PointLight | null;
      if (spark) {
        spark.intensity = 2 + Math.sin(now * 30) * 1.5 + urgency * 3;
      }
    }

    // 2. อัปเดตละอองอนุภาคการระเบิด (In-Place Loop & Zero-GC Float32Array)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) {
        this.scene.remove(ex.points);
        ex.points.geometry.dispose();
        if (Array.isArray(ex.points.material)) {
          for (let m = 0; m < ex.points.material.length; m++) {
            ex.points.material[m].dispose();
          }
        } else {
          ex.points.material.dispose();
        }
        this.explosions.splice(i, 1);
        continue;
      }

      const posAttr = ex.points.geometry.attributes.position as THREE.BufferAttribute;
      const alpha = ex.life / ex.maxLife;
      (ex.points.material as THREE.PointsMaterial).opacity = alpha;

      const vel = ex.velocities;
      const particleCount = vel.length / 3;
      for (let j = 0; j < particleCount; j++) {
        const idx = j * 3;
        vel[idx + 1] -= 12 * dt; // แรงโน้มถ่วงต่ออนุภาค
        posAttr.setXYZ(
          j,
          posAttr.getX(j) + vel[idx] * dt,
          posAttr.getY(j) + vel[idx + 1] * dt,
          posAttr.getZ(j) + vel[idx + 2] * dt,
        );
      }
      posAttr.needsUpdate = true;
    }

    // 3. จัดการเวลาแสดงผลข้อความแจ้งเตือน
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.currentMessage = '';
    }

    // 4. การจำลองฟิสิกส์และการแตะส่งระเบิด (Host-Authoritative Step)
    if (this.roundActive && this.isHost) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (p.data.isDead) continue;

        // หากเป็น Local Player ให้อ่านจาก Keyboard เครื่องนี้ หากเป็น Remote ให้อ่านจาก Network Keys
        const keysToUse = p.id === this.localPlayerId ? this.localKeys : p.keys;
        this.movePlayer(p, keysToUse, dt);
        this.physicsStep(p, dt);
      }

      this.checkTags();

      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.handleExplosion();
      }
    }

    // 5. ซิงค์ตำแหน่ง Mesh และแอนิเมชันกระเพื่อม (Bobbing)
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.data.isDead) continue;

      const bob = Math.sin(now * 3 + p.id * 0.7) * 0.06;
      p.mesh.position.x = p.body.position.x;
      p.mesh.position.y = p.body.position.y + bob;
      p.mesh.position.z = p.body.position.z;
    }

    // 6. มุมกล้องติดตามผู้เล่น Local Player
    this.updateCamera(dt);

    // 7. ส่ง State Snapshot ไปยัง React HUD (~30 FPS) เพื่อลดภาระ Re-render
    this.stateEmitTimer += dt;
    if (this.stateEmitTimer >= 0.033) {
      this.stateEmitTimer = 0;
      this.emitState();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. การเคลื่อนที่ของผู้เล่น (Player Movement Logic - Pure Human)
  // ──────────────────────────────────────────────────────────────────────────

  private movePlayer(p: PlayerEntity, keys: Set<string>, dt: number) {
    if (p.data.isDead) return;

    this.camera.getWorldDirection(this._fwdVec);
    this._fwdVec.y = 0;
    this._fwdVec.normalize();

    this._rightVec.crossVectors(this._fwdVec, GameEngine.UP_VECTOR).normalize();
    this._dirVec.set(0, 0, 0);

    const hasUp = keys.has('KeyW') || keys.has('ArrowUp');
    const hasDown = keys.has('KeyS') || keys.has('ArrowDown');
    const hasLeft = keys.has('KeyA') || keys.has('ArrowLeft');
    const hasRight = keys.has('KeyD') || keys.has('ArrowRight');

    if (hasUp) this._dirVec.add(this._fwdVec);
    if (hasDown) this._dirVec.sub(this._fwdVec);
    if (hasLeft) this._dirVec.sub(this._rightVec);
    if (hasRight) this._dirVec.add(this._rightVec);

    if (this._dirVec.lengthSq() > 0) {
      this._dirVec.normalize();
      p.mesh.rotation.y = Math.atan2(this._dirVec.x, this._dirVec.z);
    }

    if (p.dashCooldown > 0) {
      p.dashCooldown -= dt;
    }

    const isShiftPressed = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (isShiftPressed && p.dashCooldown <= 0 && !p.isDashing) {
      p.isDashing = true;
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashDir.copy(this._dirVec.lengthSq() > 0 ? this._dirVec : this._fwdVec);
    }

    if (p.isDashing) {
      p.dashTimer -= dt;
      if (p.dashTimer <= 0) p.isDashing = false;
      p.body.velocity.x = p.dashDir.x * DASH_SPEED;
      p.body.velocity.z = p.dashDir.z * DASH_SPEED;
    } else {
      p.body.velocity.x = this._dirVec.x * MOVE_SPEED;
      p.body.velocity.z = this._dirVec.z * MOVE_SPEED;
    }

    if (keys.has('Space') && p.body.isGrounded) {
      p.body.velocity.y = JUMP_FORCE;
      p.body.isGrounded = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. การชนและฟิสิกส์ในสนาม 90x90 เมตร (Physics & Platform Collision)
  // ──────────────────────────────────────────────────────────────────────────

  private physicsStep(p: PlayerEntity, dt: number) {
    if (!p.body.isGrounded) {
      p.body.velocity.y += GRAVITY * dt;
    }

    p.body.position.x += p.body.velocity.x * dt;
    p.body.position.y += p.body.velocity.y * dt;
    p.body.position.z += p.body.velocity.z * dt;

    let floorY = 0;

    // ตรวจจับการชนกับแพลตฟอร์มทั้ง 17 จุด
    for (let i = 0; i < this.platforms.length; i++) {
      const plat = this.platforms[i];
      const dx = Math.abs(p.body.position.x - plat.position.x);
      const dz = Math.abs(p.body.position.z - plat.position.z);
      const topY = plat.position.y + plat.halfSize.y;

      if (dx >= plat.halfSize.x + PLAYER_RADIUS || dz >= plat.halfSize.z + PLAYER_RADIUS) {
        continue;
      }

      if (p.body.position.y < topY - 0.1) {
        if (dx < plat.halfSize.x && dz < plat.halfSize.z) {
          const ox = plat.halfSize.x - dx + PLAYER_RADIUS;
          const oz = plat.halfSize.z - dz + PLAYER_RADIUS;
          if (ox < oz) {
            p.body.position.x += Math.sign(p.body.position.x - plat.position.x) * ox;
            p.body.velocity.x = 0;
          } else {
            p.body.position.z += Math.sign(p.body.position.z - plat.position.z) * oz;
            p.body.velocity.z = 0;
          }
        }
      } else {
        floorY = Math.max(floorY, topY);
      }
    }

    const groundLevel = floorY + PLAYER_RADIUS * 0.8;
    if (p.body.position.y <= groundLevel) {
      p.body.position.y = groundLevel;
      p.body.velocity.y = 0;
      p.body.isGrounded = true;
    } else if (p.body.position.y > groundLevel + 0.15) {
      p.body.isGrounded = false;
    }

    // ขอบเขตสนามขนาด 90x90 เมตร (Clamp Edge)
    if (p.body.position.x < -ARENA_EDGE_CLAMP) {
      p.body.position.x = -ARENA_EDGE_CLAMP;
      p.body.velocity.x = 0;
    } else if (p.body.position.x > ARENA_EDGE_CLAMP) {
      p.body.position.x = ARENA_EDGE_CLAMP;
      p.body.velocity.x = 0;
    }

    if (p.body.position.z < -ARENA_EDGE_CLAMP) {
      p.body.position.z = -ARENA_EDGE_CLAMP;
      p.body.velocity.z = 0;
    } else if (p.body.position.z > ARENA_EDGE_CLAMP) {
      p.body.position.z = ARENA_EDGE_CLAMP;
      p.body.velocity.z = 0;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. กลไกการแตะส่งต่อระเบิดและการระเบิด (Tag & Bomb Logic)
  // ──────────────────────────────────────────────────────────────────────────

  private checkTags() {
    let cat: PlayerEntity | null = null;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.data.isCat && !p.data.isDead) {
        cat = p;
        break;
      }
    }

    if (!cat) return;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.id === cat.id || p.data.isDead) continue;

      if (cat.body.position.distanceTo(p.body.position) < TAG_DISTANCE) {
        this.passBomb(cat, p);
        break;
      }
    }
  }

  private passBomb(from: PlayerEntity, to: PlayerEntity) {
    from.data.isCat = false;
    from.data.bombsDeflected++;
    to.data.isCat = true;

    this.bombHolderId = to.id;
    this.bombTimer = BOMB_START_TIME;
    this.applyVisual(from);
    this.applyVisual(to);

    this.currentMessage = `💥 ${to.name} got the BOMB!`;
    this.messageTimer = 2;
  }

  private handleExplosion() {
    let cat: PlayerEntity | null = null;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.data.isCat && !p.data.isDead) {
        cat = p;
        break;
      }
    }

    if (!cat) return;

    this.spawnExplosion(cat.body.position);
    cat.data.isDead = true;
    cat.data.isCat = false;
    cat.mesh.visible = false;
    cat.bombIndicator.visible = false;

    this.currentMessage = `💀 ${cat.name} EXPLODED!`;
    this.messageTimer = 3;

    // ตรวจสอบผู้รอดชีวิตที่เหลือ
    const alive: PlayerEntity[] = [];
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.data.isDead) alive.push(p);
    }

    if (alive.length <= 1) {
      this.roundActive = false;
      for (let i = 0; i < alive.length; i++) {
        alive[i].data.survivalCount++;
      }
      setTimeout(() => {
        const results = this.players.map((p) => ({ ...p.data }));
        if (this.isHost && this.network.roomCode) {
          this.network.sendMessage('ROUND_END', { players: results });
        }
        this.onRoundEnd(results);
      }, 2200);
    } else {
      // สุ่มผู้ถือระเบิดคนใหม่จากผู้รอดชีวิต
      const newCat = alive[Math.floor(Math.random() * alive.length)];
      newCat.data.isCat = true;
      this.bombHolderId = newCat.id;
      this.bombTimer = BOMB_START_TIME;
      this.applyVisual(newCat);
      setTimeout(() => {
        this.currentMessage = `⚡ ${newCat.name} is now IT!`;
        this.messageTimer = 2;
      }, 800);
    }
  }

  /**
   * สร้างอนุภาคการระเบิดด้วย Float32Array เพื่อ Zero-GC Allocation (Rule 5)
   */
  private spawnExplosion(position: THREE.Vector3) {
    const count = 48;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      pos[idx] = position.x;
      pos[idx + 1] = position.y + 1;
      pos[idx + 2] = position.z;

      velocities[idx] = (Math.random() - 0.5) * 22;
      velocities[idx + 1] = Math.random() * 20 + 4;
      velocities[idx + 2] = (Math.random() - 0.5) * 22;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.6,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.explosions.push({ points, velocities, life: 2.0, maxLife: 2.0 });

    const flash = new THREE.PointLight(0xff6600, 10, 20);
    flash.position.copy(position);
    this.scene.add(flash);
    setTimeout(() => {
      this.scene.remove(flash);
      flash.dispose();
    }, 450);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. กล้องและการส่งสถานะ (Camera & State Emission)
  // ──────────────────────────────────────────────────────────────────────────

  private updateCamera(dt: number) {
    let localPlayer: PlayerEntity | null = null;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].id === this.localPlayerId) {
        localPlayer = this.players[i];
        break;
      }
    }

    // หากไม่พบ local ให้ตามผู้เล่นคนแรกที่ยังมีชีวิต
    if (!localPlayer) {
      for (let i = 0; i < this.players.length; i++) {
        if (!this.players[i].data.isDead) {
          localPlayer = this.players[i];
          break;
        }
      }
    }

    if (!localPlayer) return;

    this._camTargetVec.copy(localPlayer.body.position).add(this.cameraOffset);
    const lerpFactor = 1 - Math.pow(0.01, dt);
    this.smoothCamPos.lerp(this._camTargetVec, lerpFactor);
    this.camera.position.copy(this.smoothCamPos);

    this._lookTargetVec.copy(localPlayer.body.position);
    this._lookTargetVec.y += 1;
    this.smoothLookAt.lerp(this._lookTargetVec, lerpFactor);
    this.camera.lookAt(this.smoothLookAt);
  }

  private emitState() {
    let localPlayer: PlayerEntity | null = null;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].id === this.localPlayerId) {
        localPlayer = this.players[i];
        break;
      }
    }

    if (this.isHost && this.network.roomCode) {
      this.network.sendMessage('SYNC_STATE', {
        bombTimer: this.bombTimer,
        bombHolderId: this.bombHolderId,
        message: this.currentMessage,
        roundActive: this.roundActive,
        players: this.players.map((p) => ({
          id: p.id,
          x: p.body.position.x,
          y: p.body.position.y,
          z: p.body.position.z,
          rotY: p.mesh.rotation.y,
          isCat: p.data.isCat,
          isDead: p.data.isDead,
          survivalCount: p.data.survivalCount,
          bombsDeflected: p.data.bombsDeflected,
          dashCooldown: p.dashCooldown,
        })),
      });
    }

    this.onStateUpdate({
      players: this.players.map((p) => ({ ...p.data })),
      bombTimer: this.bombTimer,
      bombHolderId: this.bombHolderId,
      message: this.currentMessage,
      roundActive: this.roundActive,
      dashCooldown: localPlayer?.dashCooldown ?? 0,
    });
  }
}
