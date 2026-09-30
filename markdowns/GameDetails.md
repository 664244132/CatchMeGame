# 🎮 CatchMeGame - Game Details & Design Specifications

เอกสารฉบับนี้รวบรวมรายละเอียดการออกแบบเกมเพลย์, การออกแบบโมเดลและสภาพแวดล้อม, ระบบตรรกะและการทำงาน (Game Logic), ตลอดจนระบบแสดงผลของเกม **CatchMeGame (Hot Potato 3D)** พัฒนาบนเทคโนโลยี **React 19**, **Three.js (0.186.1)**, **TypeScript** และ **Tailwind CSS v4**

---

## 📑 สารบัญ (Table of Contents)

1. [🎮 1. การออกแบบตัวเกม (Game Design Overview)](#section-1-game-design-overview)
2. [👥 2. ตัวละครและผู้เล่น (Characters & 50P Capacity)](#section-2-characters-50p-capacity)
3. [🏟️ 3. การออกแบบสนามประลองและสิ่งกีดขวาง (Arena & Environment Design)](#section-3-arena-environment-design)
4. [⚙️ 4. ตรรกะและระบบการทำงานภายในเกม (Game Logic & System Mechanics)](#section-4-game-logic-system-mechanics)
5. [📱 5. การควบคุมบนทุกอุปกรณ์ (Cross-Platform Controls)](#section-5-cross-platform-controls)
6. [✨ 6. ประสิทธิภาพและการปรับแต่งหน่วยความจำ (Performance & Zero-GC)](#section-6-performance-zero-gc)

---

<a id="section-1-game-design-overview"></a>
## 🎮 1. การออกแบบตัวเกม (Game Design Overview)

### 1.1 แนวเกมและกลุ่มเป้าหมาย (Genre & Target Audience)
- **แนวเกม (Genre):** 3D Fast-paced Casual Action / Bomb Tag / Hot Potato Party Game
- **ธีมหลัก (Theme):** สมรภูมิปาร์ตี้นีออนสดใส กราฟิกสไตล์ Low-poly เรขาคณิตผสมแสงไฟบรรยากาศลึกลับ (Cyber-Fantasy Glow)
- **กลุ่มเป้าหมาย (Target Audience):** ผู้เล่นทั่วไปที่ต้องการความสนุก ตื่นเต้น เร้าใจ เล่นจบได้ไว และเข้าใจกฎง่ายในเวลาไม่ถึง 1 นาที

### 1.2 กฎกติกาหลัก (Core Rules)
- ในแต่ละรอบจะมีตัวละคร 1 ตัวที่ได้รับบทเป็น **"ผู้ถือระเบิด" (The Cat / IT)**
- ลูกระเบิดมีเวลานับถอยหลัง **4.0 วินาที** ก่อนที่จะระเบิด
- ผู้ถือระเบิดต้องวิ่งไปแตะตัวผู้เล่นคนอื่นในระยะ **1.9 เมตร** เพื่อส่งต่อระเบิด
- เมื่อเกิดการส่งต่อระเบิดสำเร็จ เวลาระเบิดจะถูกรีเซ็ตกลับเป็น **4.0 วินาที** ใหม่ทันที
- เมื่อเวลานับถอยหลังหมดลง ผู้ถือระเบิดจะเกิดการระเบิดเป็นละอองไฟและตกรอบในรอบนั้นทันที
- ผู้ที่รอดชีวิตเป็นคนสุดท้ายในแต่ละรอบจะได้รับคะแนนชัยชนะ (Survival Point)
- เมื่อเล่นครบตามจำนวนรอบที่เลือกไว้ในล็อบบี้ (3, 5, หรือ 7 รอบ) ผู้ที่มีคะแนนการรอดชีวิตสูงสุดจะเป็นผู้ชนะเลิศ

---

<a id="section-2-characters-50p-capacity"></a>
## 👥 2. ตัวละครและผู้เล่น (Characters & 50P Capacity)

โปรเจกต์รองรับผู้เล่นคนจริงล้วน **(Pure PvP, No AI)** ยืดหยุ่นตั้งแต่ **2 ถึง 50 คน**:
- **Host Player (หัวหน้าห้อง):** เป็นผู้สร้างห้อง กำหนดจำนวนรอบ และกดเริ่มเกมได้ทันทีเมื่อพร้อม
- **Guest Players (ผู้เข้าร่วม):** ป้อนรหัสห้อง 6 หลักเพื่อเข้าร่วม
- **50-Color Unique Palette (`PLAYER_PALETTE`):** ผู้เล่นแต่ละคนจะได้รับสีประจำตัวเฉพาะจากจานสี 50 เฉดสีใน `constants.ts` เพื่อป้องกันสีตัวละครซ้ำกัน
- **Dynamic Spawn Distribution:** ใช้ฟังก์ชัน `generateSpawnPositions()` กระจายตัวผู้เล่นรอบวงกลมรัศมี 10–34 เมตร เพื่อความยุติธรรมในการเริ่มต้นรอบ

---

<a id="section-3-arena-environment-design"></a>
## 🏟️ 3. การออกแบบสนามประลองและสิ่งกีดขวาง (Arena & Environment Design)

- **พื้นสนามประลองขนาดใหญ่:** สี่เหลี่ยมจัตุรัสขนาด **90 x 90 เมตร** (`ARENA_HALF = 45`) พร้อมการเบี่ยงเบนยอดเหลี่ยมเล็กน้อย (Subtle Vertex Displacement) เพื่อให้ได้ความรู้สึก Low-poly ทรงเสน่ห์
- **กำแพงนีออนโปร่งแสง 4 ทิศ:** กำแพงเรืองแสงสีชมพู เขียวมินต์ เหลือง และม่วง ป้องกันตัวละครหลุดออกนอกฉาก
- **แท่นกระโดดต่างระดับ (17 Platforms):** แท่นสี่เหลี่ยม 17 จุดทั่วสนาม (แท่นมุม, แท่นขอบ และแท่นหอคอยกลางสูง 3.0 เมตร) สำหรับกระโดดขึ้นไปหลบหลีกหรือดักส่งระเบิด
- **เห็ดเรืองแสงตกแต่ง (Glowing Mushrooms):** เห็ดทรงกรวยเรขาคณิต **24 จุด** รอบสนาม
- **ละอองดวงดาว (Starfield):** จุดดาวระยิบระยับ **600 จุด** ลอยอยู่บนฟากฟ้าเหนือสนามประลอง

---

<a id="section-4-game-logic-system-mechanics"></a>
## ⚙️ 4. ตรรกะและระบบการทำงานภายในเกม (Game Logic & System Mechanics)

### 4.1 ระบบการเคลื่อนที่และการพุ่งตัว (Movement & Dash Mechanics)
- **ความเร็วเดินปกติ:** 10 เมตร/วินาที
- **การพุ่งตัว (Dash):** เพิ่มความเร็วชั่วขณะเป็น 24 เมตร/วินาที นาน 0.18 วินาที พร้อมคูลดาวน์ 2.0 วินาที
- **การกระโดด (Jump):** ให้แรงดีดตัวแกน Y ที่ 14 เมตร/วินาที ภายใต้แรงโน้มถ่วง `-30 m/s²`

### 4.2 การชนและฟิสิกส์ (AABB & Clamping)
- ตัวละครมีรัศมีการชน `PLAYER_RADIUS = 0.5` เมตร
- แพลตฟอร์มใช้การตรวจจับแบบ Axis-Aligned Bounding Box (AABB) โดยหากตัวละครอยู่ต่ำกว่าระดับขอบบน จะถูกแรงผลักด้านข้างดันออกจากแพลตฟอร์มอย่างนุ่มนวล
- หากตัวละครอยู่บนขอบบน จะยืนบนพื้นผิวแท่นกระโดดได้ตามปกติ
- สนามมีการจำกัดขอบเขตด้วย `ARENA_EDGE_CLAMP = 43.5` เมตร ป้องกันการตกขอบฉาก 100%

---

<a id="section-5-cross-platform-controls"></a>
## 📱 5. การควบคุมบนทุกอุปกรณ์ (Cross-Platform Controls)

### 5.1 Desktop Keyboard
- **เดินหน้า / ถอยหลัง:** `[W] / [S]` หรือ `[Arrow Up] / [Arrow Down]`
- **เลี้ยวซ้าย / เลี้ยวขวา:** `[A] / [D]` หรือ `[Arrow Left] / [Arrow Right]`
- **พุ่งตัว (Dash):** `[Shift Left]` หรือ `[Shift Right]`
- **กระโดด (Jump):** `[Spacebar]`

### 5.2 Mobile Touch Controls
- **Virtual Thumb Joystick:** จอยสติ๊กสัมผัสฝั่งซ้ายล่าง เคลื่อนที่ได้ 360 องศา (8 ทิศทาง) พร้อมแอนิเมชันสปริงคืนจุดกึ่งกลาง
- **Action Buttons:** ปุ่มสัมผัสฝั่งขวาล่าง:
  - ปุ่ม ⬆️ สำหรับกระโดด (Jump)
  - ปุ่ม ⚡ สำหรับพุ่งตัว (Dash) พร้อมแอนิเมชันวงแหวนคูลดาวน์
- **Mobile Safe Area & Viewport:** รองรับติ่งกล้องและขอบจอด้วย Safe Area Insets (`--sat`, `--sab`, `--sal`, `--sar`) และปิดการซูมด้วย `viewport-fit=cover`

---

<a id="section-6-performance-zero-gc"></a>
## ✨ 6. ประสิทธิภาพและการปรับแต่งหน่วยความจำ (Performance & Zero-GC)

- **Zero-GC Vector Caching:** เลี่ยงการสร้าง Vector ใหม่ในเฟรมเรต 60 FPS ตามกฎข้อ 5 ใน [`REFACTORCODE.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/REFACTORCODE.md)
- **Zero-GC Particle Simulation:** ใช้อาร์เรย์แบนราบ `Float32Array` ในการคำนวณตำแหน่งและแรงโน้มถ่วงของอนุภาคระเบิด 48 จุด
- **Memory Disposal Lifecycle:** คืนหน่วยความจำ WebGL (`geometry.dispose()`, `material.dispose()`) เสมอเมื่อเอนทิตีหมดอายุ ป้องกัน Memory Leaks
- **State Throttling:** ส่ง State Snapshot เข้า React Hook ที่ความถี่ 30 FPS เพื่อให้ UI ทำงานลื่นไหลโดยไม่หน่วง Three.js Canvas
