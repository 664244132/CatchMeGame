# 🛠️ คู่มือการดีแบ๊กและแนวทางการพัฒนาสำหรับ AI Agents (CatchMeGame Debug Guide)

คู่มือนี้จัดทำขึ้นเพื่อให้ **AI Agents ทุกตัว** ที่เข้ามาร่วมวิเคราะห์ แก้ไขบัค หรือพัฒนาโปรเจกต์ **CatchMeGame** (React 19 + TypeScript 5.7 + Three.js 0.186 + Vite 8 + Tailwind CSS v4) สามารถทำงานได้อย่างมีประสิทธิภาพสูงสุด ปฏิบัติตามมาตรฐานความปลอดภัย และวินิจฉัยปัญหาได้อย่างแม่นยำ รวดเร็ว โดยไม่ต้องเดาสุ่ม

---

## 🚨 1. กฎเหล็กด้านความปลอดภัยและข้อจำกัดสำหรับ AI Agents (Hard Constraints)

1. **ห้ามใช้คำสั่ง Git Commit หรือ Git Push เด็ดขาด (Rule 11 - No Auto-Commits):**
   - ห้ามรันคำสั่ง `git commit` หรือ `git push` ด้วยตนเองเด็ดขาด ผู้ใช้จะเป็นผู้ตรวจสอบโค้ดและ Commit ขึ้น GitHub ด้วยตนเองเสมอ
2. **ห้ามแก้ไขหรือยุ่งเกี่ยวกับฐานข้อมูลโดยตรง (Rule 10 - No Direct DB Writes):**
   - ห้ามสร้างตาราง หรือแก้ไขฐานข้อมูลเอง หากในอนาคตมีการเชื่อมต่อระบบ Database หรือ Backend ให้จัดเตรียมคำสั่ง SQL หรือ API Schema ให้ผู้ใช้นำไปดำเนินการเองเท่านั้น
3. **ห้ามลบไฟล์หรือดึงแพ็กเกจใหม่โดยไม่จำเป็น (Rule 8):**
   - ห้ามลบโค้ดการทำงานเดิมโดยไม่ได้รับการร้องขอ และห้ามรัน `npm install` เพิ่มเติมโดยไม่ได้รับอนุญาตจากผู้ใช้
4. **ปฏิบัติตามกฎเหล็ก 15 ข้อใน [`REFACTORCODE.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/REFACTORCODE.md):**
   - **Zero-GC Allocation** ในลูป `update(dt)`: ห้าม `new THREE.Vector3()` หรือสร้าง Object/Array ใหม่ทุกเฟรม
   - **Decoupled Architecture**: แยก 3D Mesh Factory ออกจาก GameEngine
   - **De Morgan's Laws & Early Return**: โครงสร้างเงื่อนไขแบนราบ (Flat) ใช้ Guard Clauses ลดความซับซ้อน
   - **Memory Leak Prevention**: ทำการ Unsubscribe Event และ `dispose()` ทรัพยากร WebGL เสมอ
5. **บันทึกประวัติการปรับปรุงลงใน [`LOG.md`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/markdowns/LOG.md) ทุกครั้ง**

---

## 💻 2. สภาพแวดล้อมระบบและคำสั่งทดสอบ (Environment & Diagnostics)

### 2.1 สภาพแวดล้อมรันไทม์ (Runtime Environment)
- **Vite Development Server:** รันอยู่เบื้องหลังแล้วอัตโนมัติบนพอร์ต `$PORT` (ค่าเริ่มต้น 8443) ไม่จำเป็นต้องสั่งเริ่มเซิร์ฟเวอร์ใหม่
- **Hot Module Replacement (HMR):** เมื่อแก้ไขไฟล์ในโฟลเดอร์ `src/` ระบบจะทำการรีโหลดการเปลี่ยนแปลงขึ้นบนหน้าพรีวิวทันที

### 2.2 การตรวจสอบ Type Check และ Build ผ่าน Terminal
เมื่อต้องการตรวจสอบว่าโค้ดไม่มี Error ทาง Syntax หรือ Type Mismatch:
```powershell
# 1. ตรวจสอบ Type Safety ด้วย TypeScript
cmd /c "npx -p typescript tsc --noEmit"

# 2. จัดรูปแบบโค้ดตามมาตรฐานโปรเจกต์
cmd /c "npx oxfmt"
```

---

## 🤖 3. ขั้นตอนการสืบค้นและวินิจฉัยบัคสำหรับ AI Agent (AI Diagnostic Workflow)

เมื่อได้รับรายงานปัญหา หรือข้อผิดพลาด (Errors/Warnings) ให้ดำเนินการตาม 5 ขั้นตอน:

```text
[ 1. LOCATE ] ──► ค้นหาตำแหน่งไฟล์ที่เกี่ยวข้อง (UI: src/components/ หรือ Engine: src/game/)
      │
      ▼
[ 2. ANALYZE ] ──► ตรวจสอบ Vector Allocations, Three.js Geometries, Event Cleanup, React Re-renders
      │
      ▼
[ 3. PROPOSE ] ──► เสนอแนวทางแก้ไขและผลกระทบเป็นภาษาไทยอย่างสุภาพและชัดเจน
      │
      ▼
[ 4. IMPLEMENT ] ──► ปรับแก้โค้ดเฉพาะจุดที่จำเป็น โดยคงฟังก์ชันเดิมไว้ครบถ้วน (Rule 8)
      │
      ▼
[ 5. VERIFY ] ──► ตรวจสอบความถูกต้องของ Type และ Zero-GC Compliance ก่อนสรุปงาน
```

### รายละเอียดโฟลเดอร์หลักสำหรับค้นหาโค้ด:
- **Game Engine & Physics:** [`src/game/GameEngine.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/GameEngine.ts) (ลูปเกม 60 FPS, ฟิสิกส์, การชน AABB, การแตะส่งระเบิด)
- **P2P Networking & Room Codes:** [`src/game/networkManager.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/networkManager.ts) (BroadcastChannel, Sync State, Host-Authoritative)
- **3D Mesh Generation:** [`src/game/meshFactory.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/meshFactory.ts) (โมเดลตัวละครหนู-แมว, เห็ด, ระเบิด, ดวงดาว)
- **Constants & Configs:** [`src/game/constants.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/constants.ts) (ขนาดสนาม 90x90m, แท่น 17 จุด, สี 50 สี, จุดเกิด)
- **Data Contracts & Types:** [`src/game/types.ts`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/game/types.ts) (Discriminated Unions, SyncedPlayerState)
- **Canvas Lifecycle:** [`src/components/GameCanvas.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/GameCanvas.tsx)
- **Game UI & HUD:** [`src/components/HUD.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/HUD.tsx), [`Lobby.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/Lobby.tsx), [`RoundEnd.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/RoundEnd.tsx), [`MatchSummary.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/MatchSummary.tsx)
- **Mobile Touch Controls:** [`src/components/VirtualJoystick.tsx`](file:///C:/Users/k2pwm/Downloads/CatchMeGame/src/components/VirtualJoystick.tsx)

---

## ⚡ 4. ตารางวิเคราะห์สาเหตุและวิธีแก้ปัญหายอดนิยม (Rapid Troubleshooting Matrix)

| อาการของปัญหา (Symptom) | สาเหตุที่พบบ่อย (Root Cause) | แนวทางแก้ไขสำหรับ AI Agent (Solution) |
| :--- | :--- | :--- |
| **เกมกระตุกเป็นจังหวะ (Micro-stutter / GC Spikes)** | มีการสร้าง Object ใหม่ในลูป `update(dt)` เช่น `new THREE.Vector3()`, `.filter()`, หรือ `.map()` ทุกเฟรม | ประกาศ Reusable Vector ล่วงหน้าใน Class Member และใช้ Float32Array ในอนุภาคระเบิด ร่วมกับการวนลูปตรงด้วยดัชนี (`for (let i = 0; i < len; i++)`) |
| **React Re-render ถี่เกินไป (HUD Lag)** | Three.js เรียก `onStateUpdate` เข้าหา React State ทุกเฟรม (60 ครั้ง/วินาที) | ใช้ตัวจับเวลาหน่วงส่ง State Snapshot เช่น ส่งทุก 33ms (~30 FPS) เพื่อลดภาระ Re-render ของ React Tree |
| **ภาพหน้าจอเกมยืดเบี้ยวตอนย่อ/ขยายจอ หรือหมุนมือถือ** | อัตราส่วนกล้อง `camera.aspect` หรือขนาด `renderer.setSize` ไม่ได้รับการอัปเดตเมื่อขนาดหน้าต่างเปลี่ยน | ตรวจสอบฟังก์ชัน `handleResize` ให้คำนวณ `camera.aspect = w / h` และเรียก `camera.updateProjectionMatrix()` เสมอ |
| **Memory Leak เมื่อสลับหน้าจอ (Canvas Duplication)** | ไม่ได้เรียก `dispose()` หรือล้าง Event Listeners เมื่อ Component Unmount | ใน `GameCanvas.tsx` ต้องมี Cleanup Function ใน `useEffect` ที่เรียก `engine.dispose()` และ `window.removeEventListener` |
| **ตัวละครทะลุพื้นหรือกำแพง (Tunneling)** | Delta time (`dt`) มีค่าสูงเกินไปเมื่อเฟรมเรตตก ทำให้การบวกตำแหน่ง `velocity * dt` ก้าวกระโดด | จำกัดค่าสูงสุดของ Delta time ด้วย `Math.min(dt, 0.05)` และใช้ค่า Clamp ขอบสนาม `ARENA_EDGE_CLAMP` |
| **ตำแหน่งผู้เล่นไม่ตรงกันข้ามแท็บ (Network Desync)** | Client ประมวลผลฟิสิกส์เองแยกต่างหาก ทำให้ตำแหน่งคลาดเคลื่อน | ยึดหลัก **Host-Authoritative**: ให้ Host เป็นผู้คำนวณฟิสิกส์และการชน แล้วส่ง `SYNC_STATE` ให้ Client แสดงผลตำแหน่งตาม Host |
| **ลูกระเบิดไม่ระเบิดเมื่อเวลาหมด** | ตัวนับเวลา `bombTimer` ไม่ถูกหักลบ หรือเงื่อนไข `handleExplosion` ตรวจไม่พบผู้ถือระเบิด | ตรวจสอบสถานะ `roundActive` และให้ค้นหาผู้เล่นที่มี `data.isCat && !data.isDead` อย่างรัดกุม |
| **ปุ่มสัมผัส/จอยสติ๊กบนมือถือไม่ตอบสนอง** | ไม่มี Event Listener รองรับ Touch Events หรือติดปัญหา Default Gesture ซูมหน้าจอ | ตรวจสอบ `touch-action: none` บนคอนโทรลเลอร์ และใช้ `TouchEvent` (`touchstart`, `touchmove`, `touchend`) ส่งสัญญาณ DOM KeyboardEvent เข้าสู่ Engine |
| **รายชื่อผู้เล่นล้นหน้าจอมือถือ (Overflow)** | จำนวนผู้เล่นสูงสุดถึง 50 คน ทำให้กล่อง HUD หรือหน้าสรุปผลขยายจนบังหน้าจอ | ใส่ Class `overflow-y-auto` และกำหนด `max-h` พร้อมปุ่ม Mobile Drawer ใน `HUD.tsx` |
| **Material สีเปลี่ยนหรือเรืองแสงค้างหลังส่งระเบิด** | ไม่ได้รีเซ็ต Emissive Color หรือ Emissive Intensity บน Mesh ของผู้ส่งระเบิด | ในฟังก์ชัน `passBomb()` ต้องเรียก `applyVisual(from)` และ `applyVisual(to)` พร้อมกัน เพื่อล้างแสงสีส้มของผู้ที่พ้นจากการถือระเบิด |