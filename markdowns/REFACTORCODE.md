# 📜 กฎเหล็กการพัฒนาและ Refactor โค้ดสำหรับโปรเจกต์ CatchMeGame

**คุณคือ Senior Software Engineer**
**บังคับต้องอ่านและปฏิบัติตามกฎ 15 ข้อนี้อย่างเคร่งครัดเมื่อพัฒนาหรือปรับปรุงโปรเจกต์ CatchMeGame**

---

## 🚨 กฎเหล็ก 15 ข้อสำหรับการพัฒนาและ Refactor โค้ด

### 1. **Decoupled Architecture & Observer Pattern (กฎแยก Logic ออกจาก Visual/UI):**
   - ห้ามเขียนตรรกะเกม (Game Logic & Physics) ผูกติดกับ Visual Effects, 3D Mesh Generation หรือ React UI โดยตรง
   - **แนวทางปฏิบัติ:** แยกโมดูลการสร้างโมเดล 3D ไว้ใน `meshFactory.ts`, แยกค่าคงที่ไว้ใน `constants.ts` และสื่อสารกับ UI ผ่าน Callbacks / State Snapshots อย่างชัดเจน

### 2. **Data-Driven Architecture (การแยกค่าคงที่ออกจากลอจิก):**
   - ห้าม Hardcode ค่าความเร็ว, เวลา, พิกัดจุดเกิด, หรือขนาดสนามลงใน Game Loop โดยตรง
   - **แนวทางปฏิบัติ:** ประกาศค่าคงที่ทั้งหมดไว้ใน `constants.ts` เพื่อให้ทีมงานปรับแต่งสมดุลเกมได้อย่างสะดวก

### 3. **Interface-Based Programming & Type Safety:**
   - กำหนด Interface และ Type ชัดเจนใน `types.ts` สำหรับทุก Entity, State Snapshot และ Configuration
   - หลีกเลี่ยงการใช้ `any` และบังคับใช้การตรวจสอบ Type อย่างเข้มงวด

### 4. **De Morgan's Laws & Early Return (โครงสร้างโค้ดแบบ Flat):**
   - **ห้าม** เขียนเงื่อนไข `!(A && B)` หรือ `!(A || B)` ให้แปลงเป็น `!A || !B` หรือ `!A && !B` ตามกฎ De Morgan เสมอ
   - ใช้ **Early Return (Guard Clauses)** ออกจากฟังก์ชันทันทีเมื่อเงื่อนไขไม่ตรง เพื่อลดระดับความลึกของการซ้อน `if-else`

### 5. **หลีกเลี่ยงการสร้างขยะหน่วยความจำ (Garbage Collection & Zero-GC in Update):**
   - **ห้าม** ใช้คำสั่ง `new` (เช่น `new THREE.Vector3()`, `new Array()`) ภายในฟังก์ชัน `update(dt)` หรือ Game Loop
   - ให้สร้างและแคชเวกเตอร์ไว้ล่วงหน้าในตัวแปรคลาส แล้วนำกลับมาใช้ซ้ำ (Cache & Reuse)

### 6. **หลีกเลี่ยงการค้นหาหรือจัดสรร Array ซ้ำๆ ใน Game Loop:**
   - **ห้าม** เรียกใช้ `.filter(...)` หรือ `.map(...)` ใน `update(dt)` ทุกเฟรม เพราะจะทำให้เกิด Heap Allocation มหาศาล
   - ใช้วิธีการวนลูปแบบดัชนี (`for (let i = 0; i < len; i++)`) ร่วมกับ Guard Clauses แทน

### 7. **Event Subscription & Memory Leak Prevention:**
   - ทุกครั้งที่มีการผูก Event Listener (เช่น `keydown`, `keyup`, `resize`) หรือ `requestAnimationFrame` ต้องมีฟังก์ชันล้าง (Cleanup / `dispose()`) เสมอเมื่อ Component Unmount เพื่อป้องกัน Memory Leak

### 8. **Safe Navigation & Null Safety:**
   - ตรวจสอบค่า Null หรือ Undefined ก่อนเรียกใช้งาน Object เสมอ และใช้ Safe Optional Chaining (`?.`) เพื่อป้องกัน Runtime Errors

### 9. **Naming Conventions มาตรฐานสากล:**
   - **PascalCase:** ชื่อ Class, Type, Interface, และ React Component (เช่น `GameEngine`, `PlayerData`, `GameCanvas`)
   - **camelCase:** ชื่อฟังก์ชัน, ตัวแปรภายใน, และ Properties (เช่น `moveHuman`, `bombTimer`, `dashCooldown`)
   - **UPPER_SNAKE_CASE:** สำหรับค่าคงที่สากล (เช่น `ARENA_HALF`, `MOVE_SPEED`, `BOMB_START_TIME`)

### 10. **Physics & Boundary Optimization:**
   - ตรวจสอบการชน AABB และการ Clamp ขอบเขตสนามอย่างรัดกุม โดยไม่ให้หลุดออกนอกฉากหรือทะลุกำแพง (Tunneling)

### 11. **Centralized Input Management:**
   - จัดการอินพุตการควบคุมไว้ที่ศูนย์กลางใน `GameEngine` และล้าง Event Listener ใน `cleanupInput` เสมอ

### 12. **Beginner-Friendly & Clean Code:**
   - เขียนโค้ดให้อ่านง่าย มีโครงสร้างชัดเจน คอมเมนต์อธิบายตรรกะที่สำคัญเป็นภาษาไทย และหลีกเลี่ยงโค้ดที่ซับซ้อนเกินจำเป็น

### 13. **Do Not Delete or Modify Existing Code Unnecessarily (Rule 8):**
   - ห้ามลบหรือแก้ไขฟังก์ชันการทำงานเดิมที่มีอยู่แล้วในโปรเจกต์โดยไม่ได้รับการร้องขอจากผู้ใช้

### 14. **ห้ามแก้ไขฐานข้อมูลด้วยตนเอง (Rule 10 - No Direct DB Writes):**
   - หากในอนาคตมีการเชื่อมต่อระบบ Database ห้ามรันคำสั่งแก้ไขฐานข้อมูลเองเด็ดขาด ให้เตรียมคำสั่งให้ผู้ใช้เป็นคนดำเนินการเท่านั้น

### 15. **ห้ามใช้คำสั่ง Git Commit หรือ Git Push (Rule 11 - No Auto-Commits):**
   - ห้ามรันคำสั่ง `git push` หรือ `git commit` ด้วยตนเองเด็ดขาด ผู้ใช้จะเป็นคนตรวจสอบโค้ดและควบคุมการ Commit เองเสมอ