# 🛡️ คู่มือมาตรฐานความปลอดภัยและความถูกต้องของโค้ด (CatchMeGame Security & Integrity Policy)

เอกสารนี้ระบุมาตรฐานความปลอดภัย ความสมบูรณ์ของข้อมูล และแนวทางการตรวจสอบโค้ด (Audit Guide) ของโปรเจกต์เกม **CatchMeGame** เพื่อให้ **AI Agents** และนักพัฒนาใช้เป็นแนวทางปฏิบัติอย่างเคร่งครัด

---

## 🔒 1. นโยบายความปลอดภัยของเกม (Client & Application Security)

1. **Input & Memory Sanitization:**
   - การดักฟัง Keyboard และ Window Events ต้องมีการทำความสะอาด (Cleanup Listener) ในฟังก์ชัน `dispose()` หรือตอน Unmount เสมอ เพื่อป้องกัน Memory Leak และ Event Trigger ค้าง
2. **WebGL Context & Resource Management:**
   - เมื่อ Component ถูกทำลาย จะต้องเรียก `renderer.dispose()`, `cancelAnimationFrame` และลบ Object ออกจาก Three.js Scene อย่างถูกต้อง
3. **No Hardcoded Secrets or Credentials:**
   - **ห้าม** ฝัง API Key, Secret Tokens หรือ Private Key ลงในซอร์สโค้ดเด็ดขาด
   - หากในอนาคตมีระบบบันทึกคะแนน Leaderboard ออนไลน์ ต้องเชื่อมต่อผ่าน HTTPS และ Environment Variables อย่างรัดกุม

---

## 🚨 2. ข้อจำกัดและกฎความปลอดภัยที่ต้องปฏิบัติตาม (Hard Constraints)

1. **ห้ามทำการแก้ไขฐานข้อมูลด้วยตนเอง (Rule 10 - No Direct DB Writes):**
   - หากในอนาคตมีระบบฐานข้อมูล (Database) หรือ Backend **ห้าม** AI Agent รันคำสั่งแก้ไขตารางเองเด็ดขาด ให้เตรียมคำสั่งหรือ Schema ให้ผู้ใช้เป็นผู้นำไปดำเนินการเองเท่านั้น
2. **ห้ามใช้คำสั่ง Git Commit หรือ Git Push (Rule 11 - No Auto-Commits):**
   - **ห้าม** รันคำสั่ง `git commit` หรือ `git push` ใน Terminal หรือผ่านเครื่องมือใดๆ เด็ดขาด ผู้ใช้จะเป็นคนตรวจสอบและ Commit ขึ้น GitHub เองเสมอ
3. **ห้ามลบหรือแก้ไขโค้ดเดิมโดยไม่จำเป็น (Rule 8):**
   - การปรับปรุงหรือ Refactor ต้องคงฟังก์ชันการทำงานเดิมของเกมไว้ครบถ้วน
4. **ห้ามติดตั้งหรือดึงไลบรารีใหม่โดยไม่ได้รับอนุญาต:**
   - การเพิ่ม Dependencies ใหม่ ต้องได้รับความเห็นชอบจากผู้ใช้ก่อนเสมอ

---

## 📋 3. AI Agent Automated Code & Security Audit Checklist

ทุกครั้งที่ AI Agent เข้ามาแก้ไข เพิ่มเติม หรือตรวจสอบซอร์สโค้ดในโปรเจกต์ **บังคับต้องผ่านการตรวจสอบตาม Checklist 10 ข้อนี้:**

- [ ] **1. Zero-GC in Update Loop:** ปราศจากการใช้คำสั่ง `new THREE.Vector3()` หรือการสร้าง Array ใหม่ในลูป `update(dt)` ใช่หรือไม่?
- [ ] **2. Memory Leak Prevention:** มีการลบ Event Listeners และสั่ง `cancelAnimationFrame` ใน `dispose()` ครบถ้วนหรือไม่?
- [ ] **3. De Morgan's Laws & Early Return:** เงื่อนไข `if-else` ไม่มีรูปแบบ `!(A && B)` หรือ `!(A || B)` และใช้ Guard Clauses แล้วหรือไม่?
- [ ] **4. Decoupled Architecture:** โมเดล 3D และค่าคงที่ถูกแยกออกจาก GameEngine ตามหลัก Separation of Concerns ใช่หรือไม่?
- [ ] **5. Type Safety Compliance:** มีการระบุประเภทตัวแปรอย่างชัดเจนตาม `TypeScriptCodingGuide.md` และไม่ใช้ `any` พร่ำเพรื่อหรือไม่?
- [ ] **6. No Hardcoded Credentials:** ตรวจสอบว่าไม่มี Secret Tokens หรือ Password หลุดรอดลงในซอร์สโค้ดใช่หรือไม่?
- [ ] **7. No Direct Database Mutation:** ไม่มีการรันคำสั่งแก้ไขฐานข้อมูลโดยพลการ (Rule 10)?
- [ ] **8. No Auto Git Commands:** ไม่มีการเรียกใช้คำสั่ง `git commit` หรือ `git push` (Rule 11)?
- [ ] **9. Beginner-Friendly Documentation:** โค้ดมีการคอมเมนต์อธิบายตรรกะที่สำคัญเป็นภาษาไทยเพื่อให้อ่านเข้าใจง่าย (Rule 6)?
- [ ] **10. Documentation Integrity:** อัปเดตประวัติการทำงานลงใน `markdowns/LOG.md` ทุกครั้งหลังจบงานหรือไม่?
