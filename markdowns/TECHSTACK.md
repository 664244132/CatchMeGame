# 🛠️ CatchMeGame - Tech Stack & Version Specifications

เอกสารสรุปสถาปัตยกรรม เทคโนโลยี เอนจิน ไลบรารี และเวอร์ชันที่ใช้งานจริงภายในโปรเจกต์ **CatchMeGame**

---

## 📊 Summary Table (ตารางสรุปเทคโนโลยีหลัก)

| หมวดหมู่ (Category) | เทคโนโลยี / ไลบรารี (Technology / Library) | เวอร์ชั่น (Version) | หน้าที่และความรับผิดชอบ (Role & Description) |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.0.0` | จัดการ UI Lifecycle, Screens, HUD, State Flow และ Modals |
| **3D Graphics Engine** | Three.js | `^0.186.1` | เรนเดอร์กราฟิก 3D WebGL, จัดการแสงเงา, ฟิสิกส์ และ Game Loop |
| **Programming Language** | TypeScript | `^5.7.0` | ภาษาพัฒนาหลัก พร้อม Type Safety ทั้งฝั่ง UI และ Engine |
| **CSS Framework** | Tailwind CSS | `^4.0.0` | สไตล์ชีตยูทิลิตี้ จัดการเลย์เอาต์ สไตล์ Glassmorphism และ Responsive |
| **Build Tool & Dev Server** | Vite | `^8.0.5` | บิลด์เครื่องมือความเร็วสูง พร้อม Hot Module Replacement (HMR) |
| **CSS Vite Plugin** | `@tailwindcss/vite` | `^4.0.0` | ปลั๊กอินเชื่อมต่อ Tailwind v4 เข้ากับ Vite โดยตรง |
| **React Vite Plugin** | `@vitejs/plugin-react` | `^6.0.0` | ปลั๊กอินรองรับ Fast Refresh และ JSX Transform |
| **Formatting Tool** | oxfmt | `^0.2.0` | จัดรูปแบบโค้ดให้เป็นระเบียบตามมาตรฐาน |

---

## 🎮 1. สถาปัตยกรรม Three.js WebGL

- **Renderer:** `THREE.WebGLRenderer`
  - เปิดใช้งาน `antialias: true`
  - รองรับเงาแบบนุ่มนวล `THREE.PCFSoftShadowMap`
  - โทนแมปปิ้งสีสไตล์ภาพยนตร์ `THREE.ACESFilmicToneMapping` พร้อม Exposure `1.1`
  - ปรับความละเอียดอัตโนมัติตาม `window.devicePixelRatio` (จำกัดเพดานสูงสุด 2x)
- **Camera:** `THREE.PerspectiveCamera`
  - FOV: 60 องศา, Near: 0.1, Far: 200
  - ติดตามผู้เล่นแบบ Smooth Lerp Tracking ด้วย Exponential Decay
- **Physics & Collision:**
  - AABB Collision Detection สำหรับแท่นกระโดดต่างระดับ (Platforms)
  - Arena Boundary Clamp ป้องกันตัวละครหลุดออกนอกฉาก
  - Tag Distance Sphere Check (1.9 เมตร)
- **Memory & Performance Management:**
  - Zero-GC Vector Caching หลีกเลี่ยงการสร้าง Vector ใหม่ในเฟรมเรต 60 FPS
  - In-Place Particle Management สำหรับเอฟเฟกต์การระเบิด
  - Throttled State Emission (30 FPS) เพื่อลดภาระ Re-render ของ React

---

## 🕹️ 2. ระบบการควบคุม (Input Controls)

- **Move Forward/Backward:** `[W] / [S]` หรือ `[Arrow Up] / [Arrow Down]`
- **Move Left/Right:** `[A] / [D]` หรือ `[Arrow Left] / [Arrow Right]`
- **Dash (พุ่งตัว):** `[Shift Left]` หรือ `[Shift Right]` (คูลดาวน์ 2.0 วินาที)
- **Jump (กระโดด):** `[Spacebar]`
- **Camera Perspective:** มุมมองบุคคลที่ 3 (Third-Person Isometric-Follow View)
