# 🎮 CatchMeGame (Hot Potato 3D) - Complete Project Documentation

**CatchMeGame** คือเว็บเกม 3 มิติแนวปาร์ตี้แบบ Fast-paced Casual Action (สไตล์ Hot Potato / Bomb Tag) ที่พัฒนาขึ้นด้วยเทคโนโลยีเว็บสมัยใหม่: **React 19**, **Three.js (0.186.1)**, **TypeScript 5.7**, **Tailwind CSS v4** และขับเคลื่อนด้วย **Vite 8**

เอกสารฉบับนี้รวบรวมรายละเอียดสถาปัตยกรรมระบบ, โครงสร้างไฟล์และโฟลเดอร์, วงจรชีวิตของเกม, การเชื่อมโยงระหว่าง Three.js WebGL และ React UI, ตลอดจนมาตรฐานการพัฒนาโค้ดและสถานะล่าสุดหลังการ Refactor

---

## 🛠️ 1. สถาปัตยกรรมระบบ (System Architecture)

ระบบของเกมถูกออกแบบโดยยึดหลัก **Decoupled Architecture** ตามแนวทางใน [`REFACTORCODE.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/REFACTORCODE.md) เพื่อแยก Presentation (Three.js 3D Visuals & React HUD) ออกจาก Game Logic & Physics Engine:

```mermaid
flowchart TD
    subgraph UI_Layer ["🎨 React UI Layer (Presentation & HUD)"]
        App["App.tsx (Root Controller & State Coordinator)"]
        Lobby["components/Lobby.tsx (Room Code & Capacity 50P)"]
        HUD["components/HUD.tsx (Live Bomb & Dash HUD + Drawer)"]
        RoundEnd["components/RoundEnd.tsx (Scrollable Standings)"]
        Summary["components/MatchSummary.tsx (Podium & Trophies)"]
        Joystick["components/VirtualJoystick.tsx (Mobile 8-Way & Touch Buttons)"]
        CanvasComp["components/GameCanvas.tsx (Three.js WebGL Bridge)"]
    end

    subgraph Net_Layer ["🌐 Networking Layer (Zero-Server P2P Transport)"]
        NetMgr["game/networkManager.ts (Type-Safe BroadcastChannel & Room Codes)"]
    end

    subgraph Engine_Layer ["⚡ Three.js Engine Layer (Host-Authoritative 3D Simulation)"]
        Engine["game/GameEngine.ts (Core Loop, Physics, 90x90m Arena, Pure PvP)"]
        MeshFactory["game/meshFactory.ts (Procedural Low-Poly 3D Meshes)"]
        Constants["game/constants.ts (90x90m Arena, 17 Platforms, 50 Colors)"]
        Types["game/types.ts (Discriminated Unions & Float32Array Zero-GC)"]
    end

    App --> Lobby
    App --> HUD
    App --> RoundEnd
    App --> Summary
    App --> Joystick
    App --> CanvasComp
    CanvasComp --> Engine
    Lobby <--> NetMgr
    App <--> NetMgr
    Engine <--> NetMgr
    Engine --> MeshFactory
    Engine --> Constants
    Engine --> Types
    Engine -.->|State Snapshot (~30 FPS)| App
```

### 1.1 การแบ่งแยกส่วนงาน (Separation of Concerns)
1. **Engine Layer ([`src/game/`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/)):**
   - **[`GameEngine.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/GameEngine.ts):** ควบคุม Game Loop (`requestAnimationFrame`), Host-authoritative Physics Step, การตรวจจับการชนแบบ AABB Platform และ Arena Boundary Clamp, การเคลื่อนที่ของผู้เล่นจริง (Pure PvP 2–50 คน ไม่ใช้บอท AI), การส่งต่อระเบิด (Tag System ระยะ 1.9 เมตร), Zero-GC Particle System และการติดตามของกล้อง (Smooth Lerp Camera)
   - **[`networkManager.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/networkManager.ts):** จัดการระบบห้องด้วยรหัสห้อง (Room Code), การเชื่อมต่อแบบเรียลไทม์ผ่าน `BroadcastChannel`, การซิงค์ตำแหน่งและสถานะของเกม (Host-Authoritative) ข้ามหน้าต่าง/แท็บเบราว์เซอร์แบบ Zero-Server โดยไม่ต้องพึ่งพาเซิร์ฟเวอร์ภายนอก (สอดคล้องกับ Rule 10 และ 14)
   - **[`meshFactory.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/meshFactory.ts):** โรงงานสร้างโมเดล 3D โพลีต่ำแบบ Procedural (โมเดลหนู, แมว, ชนวนระเบิด, เห็ดเรืองแสงตกแต่ง 24 จุด, ละอองดาวบนฟ้า 600 จุด) แยกเป็นอิสระจาก Engine Loop (Rule 1)
   - **[`constants.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/constants.ts):** จัดเก็บตัวเลขและค่าคงที่ทั้งหมด (Data-Driven Architecture) เช่น ขนาดสนาม 90x90 เมตร, แท่นกระโดด 17 แพลตฟอร์ม, จานสี 50 เฉดสี (`PLAYER_PALETTE`), ความเร็ว, แรงกระโดด, เวลาระเบิด 4 วินาที และพิกัดจุดเกิด
   - **[`types.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/types.ts):** กำหนด Type และ Interface ทั้งหมดอย่างรัดกุมด้วย Discriminated Unions สำหรับ Network Messages (`JoinRoomPayload`, `SyncStatePayload`, `PlayerInputPayload` ฯลฯ) และ `Float32Array` velocities ตามมาตรฐาน [`TypeScriptCodingGuide.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/TypeScriptCodingGuide.md)
2. **React UI Layer ([`src/components/`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/)):**
   - **[`GameCanvas.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/GameCanvas.tsx):** คอมโพเนนต์เชื่อมต่อ React เข้ากับ Three.js WebGL Canvas พร้อมระบบ Lifecycle (Mount/Resize/OrientationChange/Dispose) และการล้างหน่วยความจำอย่างถูกต้อง
   - **[`HUD.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/HUD.tsx):** แผงควบคุมและแสดงผลสดในเกม (หลอดเวลาระเบิด 4 วินาที, เข็มคูลดาวน์ Dash, สถานะผู้ถือระเบิด, ข้อความแจ้งเตือน และ Mobile Player Drawer รายชื่อผู้เล่นสูงสุด 50 คน)
   - **[`VirtualJoystick.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/VirtualJoystick.tsx):** แผงควบคุมเสมือนบนจอมือถือ (Thumb Joystick 8 ทิศทาง 360 องศา และปุ่ม Jump/Dash สัมผัส)
   - **[`Lobby.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/Lobby.tsx):** หน้าต่างล็อบบี้ สร้างห้อง เข้าร่วมห้องด้วยรหัส และห้องพักคอยแบบ Responsive รองรับ 2–50 คน
   - **[`RoundEnd.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/RoundEnd.tsx):** หน้าต่างสรุปผลเมื่อจบแต่ละรอบ พร้อม Scrollable Standings
   - **[`MatchSummary.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/MatchSummary.tsx):** หน้าจอสรุปผลการแข่งขันเมื่อเล่นครบทุกรอบ แสดงถ้วยรางวัลและแท่นรับรางวัลแบบ Responsive

---

## ⚡ 2. สถาปัตยกรรมประสิทธิภาพสูง (Zero-GC Optimization & Frame Pacing)

ตามกฎข้อ 5 และข้อ 6 ใน [`REFACTORCODE.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/REFACTORCODE.md) ตัวเกมได้รับการปรับปรุงประสิทธิภาพขั้นสูงเพื่อการแสดงผล 60 FPS นิ่งสนิทบนเว็บเบราว์เซอร์:
- **Vector Caching (Zero-GC in Update):** ใน `GameEngine.ts` มีการประกาศเวกเตอร์รีไซเคิลล่วงหน้า (`_fwdVec`, `_rightVec`, `_dirVec`, `_camTargetVec`, `_lookTargetVec`) เพื่อนำกลับมาใช้ซ้ำในฟังก์ชัน `movePlayer()` และ `updateCamera()` โดยไม่เรียก `new THREE.Vector3()` หรือ `.clone()` ในทุกเฟรม
- **Zero-GC Explosion Particle Physics:** ระบบอนุภาคการระเบิด (`explosions`) ใช้ Flat `Float32Array` ในการจัดเก็บความเร็ว (vx, vy, vz) แทน `THREE.Vector3[]` 48 ตัว คำนวณแรงโน้มถ่วงและตำแหน่งแบบ In-place และสั่ง `dispose()` ทั้ง Geometry, Material และ Light ทันทีที่อนุภาคหมดอายุ
- **Loop Allocation Pruning:** เลิกใช้ `.filter(...)` และ `.map(...)` ในลูปเกม `update()` หันมาใช้การวนลูปแบบตรงด้วยดัชนี (`for (let i = 0; i < len; i++)`) ร่วมกับ Guard Clauses เพื่อขจัดการสร้าง Garbage Collection Spikes
- **Throttled State Emission:** ปรับความถี่ในการส่ง State Snapshot จาก Three.js เข้าสู่ React Hook เป็น ~30 FPS เพื่อลดภาระ Re-render ของ React Tree โดยที่ความลื่นไหลของตัวเกม 3D ยังคงทำงานเต็ม 60 FPS

---

## 📂 3. โครงสร้างโฟลเดอร์ในโปรเจกต์ (Project Directory Structure)

```text
CatchMeGame/
├── 📂 .figma/                          # Figma Context & Cache
├── 📂 markdowns/                       # คลังคู่มือเอกสารและกฎมาตรฐานการพัฒนา
│   ├── 📜 AboutProject.md              # สถาปัตยกรรมระบบ โครงสร้างไฟล์ และภาพรวมโปรเจกต์หลัง Refactor
│   ├── 📜 DEBUG.md                     # คู่มือการตรวจสอบบัคและวิเคราะห์ปัญหาสำหรับ AI Agents
│   ├── 📜 LOG.md                       # ประวัติการพัฒนาและบันทึกการปรับปรุงระบบแบบกระชับ
│   ├── 📜 REFACTORCODE.md              # กฎเหล็ก 15 ข้อสำหรับการ Refactor โค้ด
│   ├── 📜 PROJECT.md                   # ภาพรวมโปรเจกต์ กติกา และฟีเจอร์เกม 50P PvP
│   ├── 📜 TECHSTACK.md                 # ตารางระบุเวอร์ชันและเทคโนโลยีที่ใช้งาน
│   ├── 📜 GameDetails.md               # รายละเอียดเกมเพลย์ สนาม 90x90m และกลไกระเบิด 4s
│   ├── 📜 DESIGN.md                    # การออกแบบสไตล์ภาพและ UI Design System
│   ├── 📜 SECURITY.md                  # นโยบายความปลอดภัยและ Audit Checklist
│   ├── 📜 USE_CASE_DIAGRAM.md          # แผนภาพความสัมพันธ์ Use Case ของระบบ Multiplayer
│   ├── 📜 DeMorgansLaws.md             # กฎการแปลงตรรกะ De Morgan & Early Return
│   ├── 📜 TypeScriptCodingGuide.md     # คู่มือมาตรฐานการเขียน TypeScript
│   ├── 📜 REACTCodingGuide.md          # คู่มือมาตรฐานการเขียน React 19
│   ├── 📜 TailwindCodingGuide.md       # คู่มือมาตรฐานการเขียน Tailwind CSS v4
│   ├── 📜 CSSCodingGuide.md            # คู่มือมาตรฐาน CSS Box-sizing & Spacing
│   ├── 📜 HTMLCodingGuide.md           # คู่มือมาตรฐาน Semantic HTML
│   └── 📜 JavascriptCodingGuide.md     # คู่มือมาตรฐาน JavaScript
├── 📂 src/                             # ซอร์สโค้ดของแอปพลิเคชัน
│   ├── 📂 components/                  # React UI Components
│   │   ├── 📜 GameCanvas.tsx           # ตัวเชื่อมโยง Three.js Canvas กับ React พร้อม Event Cleanup
│   │   ├── 📜 HUD.tsx                  # แถบแสดงสถานะขณะเล่น (Timer 4s, Dash, Bombs, Mobile Drawer)
│   │   ├── 📜 Lobby.tsx                # หน้าต่างล็อบบี้ สร้าง/เข้าห้อง และความจุ 2–50 คน
│   │   ├── 📜 MatchSummary.tsx         # สรุปคะแนนการแข่งขันเมื่อครบทุกรอบ พร้อมโพเดียมรางวัล
│   │   ├── 📜 RoundEnd.tsx             # สรุปผลเมื่อจบแต่ละรอบ พร้อมตาราง Scrollable
│   │   └── 📜 VirtualJoystick.tsx      # แผงจอยสติ๊ก 8 ทิศทางและปุ่มสัมผัสบนมือถือ
│   ├── 📂 game/                        # โมดูล Three.js Game Engine
│   │   ├── 📜 constants.ts             # ค่าคงที่ สนาม 90x90m, แท่น 17 แพลตฟอร์ม และจานสี 50 สี
│   │   ├── 📜 GameEngine.ts            # แกนกลางควบคุม Game Loop, Physics, Pure PvP 50 คน, Zero-GC
│   │   ├── 📜 meshFactory.ts           # โรงงานสร้างโมเดล 3D แบบ Procedural
│   │   ├── 📜 networkManager.ts        # ระบบจัดการห้อง Room Code และ P2P Broadcast Network (Type-Safe)
│   │   └── 📜 types.ts                 # Type Definitions และ Discriminated Union Interfaces
│   ├── 📜 App.tsx                      # Component รากหลัก ควบคุม Game Phase และ Network Sync
│   ├── 📜 index.css                    # Tailwind CSS v4 Global Styling พร้อม Mobile Safe Area Insets
│   ├── 📜 main.tsx                     # Entrypoint ของ React 19
│   └── 📜 vite-env.d.ts                # TypeScript Vite Declarations
├── 📜 .antigravityignore               # ข้อยกเว้นไฟล์สำหรับ AI Agent และ Git ครอบคลุม 9 หมวดหมู่
├── 📜 .gitignore                       # ข้อยกเว้น Git มาตรฐาน
├── 📜 AGENTS.md                        # รายละเอียดโปรเจกต์และสภาพแวดล้อมเซิร์ฟเวอร์
├── 📜 index.html                       # HTML Shell พร้อม Mobile Viewport Fit Cover
├── 📜 package.json                     # NPM Dependencies & Scripts
├── 📜 tsconfig.json                    # TypeScript Configuration
└── 📜 vite.config.ts                   # การตั้งค่า Vite 8 และ Tailwind v4
```

---

## 🎮 4. กติกาและลูปการเล่นของเกม (Multiplayer Gameplay Loop)

1. **Lobby & Room Code (ห้องเล่นเกม):**
   - **สร้างห้อง (Create Room):** หัวหน้าห้อง (Host) สร้างห้องและได้รับรหัสห้องสุ่ม (เช่น `CAT-784`)
   - **เข้าร่วมห้อง (Join Room):** ผู้เล่นคนอื่นนำรหัสห้องไปกรอกเพื่อเข้าร่วมห้องเดียวกัน
   - **ยืดหยุ่น 2–50 คน (Flexible Capacity):** Host สามารถกด "START GAME" เริ่มเล่นได้ทันทีเมื่อมีคนพร้อม (ตั้งแต่ 2 ถึง 50 คน ไม่ต้องรอบอท AI)
2. **Round Start:** ระบบสุ่มเลือกผู้เล่น 1 คนให้เป็นผู้ถือระเบิดคนแรก โดยทุกคนเกิดกระจายตัวรอบวงกลมในสนามขนาด 90x90 เมตร
3. **Bomb Countdown (4 วินาที):**
   - ผู้ถือระเบิดจะมีลูกระเบิดลอยอยู่เหนือหัวพร้อมไฟกะพริบและจังหวะเต้นถี่ขึ้นเรื่อยๆ
   - ต้องวิ่งเข้าไปชน (Tag) ผู้เล่นคนอื่นในระยะ 1.9 เมตร เพื่อส่งต่อระเบิด
   - เมื่อส่งระเบิดสำเร็จ เวลาระเบิดจะถูกรีเซ็ตกลับเป็น 4 วินาที
4. **Dash & Jump Abilities:**
   - กด `Shift` (หรือแตะปุ่ม ⚡ บนมือถือ) เพื่อพุ่งตัว (Dash) หลบหนีหรือไล่ล่า (ความเร็ว 24m/s, คูลดาวน์ 2.0 วินาที)
   - กด `Spacebar` (หรือแตะปุ่ม ⬆️ บนมือถือ) เพื่อกระโดดขึ้นบนแท่นต่างระดับ 17 แพลตฟอร์มทั่วสนาม
5. **Explosion & Elimination:**
   - เมื่อเวลาระเบิดหมด ผู้ถือระเบิดจะระเบิดเป็นอนุภาคไฟกระจายและตกรอบ
   - ผู้เล่นที่เหลือจะสุ่มได้รับบทเป็นผู้ถือระเบิดคนใหม่ จนกระทั่งเหลือผู้รอดชีวิตคนสุดท้าย
6. **Round End & Match Summary:**
   - เมื่อจบรอบ Host กดเริ่มรอบถัดไป หรือเข้าสู่หน้าสรุปคะแนนผู้ชนะเลิศร่วมกัน