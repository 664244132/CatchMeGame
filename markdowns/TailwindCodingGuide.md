# 🎨 Tailwind CSS Coding Guide

**ข้อกำหนดและแนวทางปฏิบัติที่ดีสำหรับการใช้งาน Tailwind CSS** เพื่อให้การเขียนสไตล์ในโปรเจกต์เป็นระเบียบ อ่านง่าย และดูแลรักษาได้ในระยะยาว

---

## 📌 1. การจัดกลุ่มเพื่อความอ่านง่าย (Readability)
แนะนำให้ใช้การแยกสไตล์กลุ่มต่างๆ (เช่น Layout, Visual Tone, Interaction States) ออกจากกันอย่างเป็นสัดส่วน หรือใช้เครื่องมือจัดเรียง Class เช่น `prettier-plugin-tailwindcss` เพื่อลดความซับซ้อนของคลาสที่เรียงต่อกันยาวๆ 
```tsx
// ❌ Bad: เรียงสลับไปมาอ่านยาก
<div className="text-white hover:bg-blue-600 p-4 absolute flex bg-blue-500 top-0">

// ✅ Good: จัดกลุ่ม Layout > Spacing > Colors > States
<div className="absolute top-0 flex p-4 bg-blue-500 text-white hover:bg-blue-600">
```

## 📱 2. การเขียนแบบ Mobile-First (Responsive)
ออกแบบสไตล์เริ่มต้นสำหรับหน้าจอขนาดเล็กเป็นหลัก และใช้ Breakpoint เฉพาะเมื่อขยายหน้าจอกว้างขึ้น (`sm:`, `md:`, `lg:`) เพื่อเลี่ยงสไตล์ที่ตกขอบ
```tsx
// ❌ Bad: ทำจอใหญ่ก่อนแล้วค่อยแก้จอมือถือ
<div className="w-full lg:w-1/2 md:w-3/4"> 

// ✅ Good: เริ่มจากจอมือถือ แล้วขยายออก
<div className="w-full md:w-3/4 lg:w-1/2">
```

## 🎯 3. การคลุมสถานะที่ครบถ้วน (State Variants)
ต้องให้ความสำคัญกับสถานะต่างๆ เสมอ เช่น `hover:`, `focus-visible:` และ `disabled:` ร่วมกัน เพื่อให้ส่วนติดต่อผู้ใช้งาน (UI) รองรับการสั่งงานทุกรูปแบบ โดยเฉพาะการใช้คีย์บอร์ด
```tsx
// ✅ Good: ควบคุมทุกสถานะอย่างชัดเจน
<button className="bg-blue-500 hover:bg-blue-600 focus-visible:ring-2 disabled:opacity-50">
  Click Me
</button>
```

## 📏 4. ความคงเส้นคงวาของระยะห่าง (Spacing & Layout)
ยึดใช้งาน Spacing Scale มาตรฐานของ Tailwind (เช่น `p-4`, `m-2`) แทนการใช้ Custom Bracket เฉพาะจุด เพื่อความมั่นคงของโครงสร้างเลย์เอาต์สากล
```tsx
// ❌ Bad: ใช้ค่าเฉพาะเจาะจงที่ทำลายสเกล
<div className="p-[19px] mt-[13px]">

// ✅ Good: ใช้สเกลมาตรฐาน
<div className="p-5 mt-3">
```

## 🎨 5. การทำงานร่วมกับ Theme Tokens
หลีกเลี่ยงการฝังค่าสี Hex หรือพิกเซลแบบแข็ง (Hard-coded) ในส่วนประกอบ ให้เปลี่ยนมาดึงชื่อโทเค็นจากธีมหลักใน `tailwind.config.js` เพื่อความสะดวกในการควบคุมสไตล์
```tsx
// ❌ Bad:
<div className="bg-[#1DA1F2] text-[#14171A]">

// ✅ Good:
<div className="bg-brand-blue text-brand-dark">
```

## 🌙 6. การจับคู่ชุดสีโหมดมืด (Dark Mode Variants)
ต้องทำการสลับชุดสีคู่กันทั้ง สีกรอบ, พื้นหลัง, สีข้อความ และสถานะลิงก์ในโหมดมืด (`dark:`) เพื่อรักษาระดับ Contrast ที่ชัดเจน
```tsx
// ✅ Good: รองรับ Dark mode สมบูรณ์แบบ
<div className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
```

## 🧩 7. การยุบขอบเขตส่วนประกอบ (Class Reuse & Boundaries)
เมื่อเกิดการทำสไตล์ซ้ำๆ ขององค์ประกอบเดิม ให้สร้าง Component Boundary ใน React หรือใช้การจัดการคลาสที่สามารถใช้ซ้ำได้ แทนที่จะก็อปปี้คลาสเดิมซ้ำไปมาหลายๆ จุด

## 🚫 8. การจำกัดการใช้ค่าอิสระ (Arbitrary Values with Restraint)
อนุญาตให้ใช้ Arbitrary values (เช่น `grid-cols-[1fr_200px]`) เฉพาะในกรณีสัดส่วน Layout ที่มีความซับซ้อนจริงๆ เท่านั้น ส่วนองค์ประกอบทั่วไปให้ใช้มาตราวัดปกติ
```tsx
// ❌ Bad:
<div className="w-[100%] h-[100vh]">

// ✅ Good:
<div className="w-full h-screen">
```

## 👁️ 9. การเข้าถึงที่ครอบคลุม (Accessibility - a11y)
ออกแบบปุ่มที่เป็นไอคอนอย่างเดียวโดยมี Focus Ring คมชัด และแนบป้ายคำอธิบาย `sr-only` เสมอ เพื่ออำนวยความสะดวกให้ผู้ที่ใช้งาน Screen Reader
```tsx
// ✅ Good: มี sr-only เพื่อคนตาบอด
<button className="focus-visible:ring-2 focus-visible:outline-none">
  <span className="sr-only">Close Modal</span>
  <XIcon className="w-4 h-4" />
</button>
```

## ⚔️ 10. การป้องกันสไตล์ชนกัน (Conditional Conflicts)
เมื่อต้องสลับสไตล์ตามเงื่อนไข (Conditional Classes) ให้วางระบบเงื่อนไขให้ขาดจากกันเป็นเอกเทศ หรือใช้ไลบรารีอย่าง `tailwind-merge` + `clsx` ป้องกันสไตล์ตีกัน
```tsx
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

// ✅ Good: ป้องกัน Class ชนกันเมื่อมีการใช้งาน Dynamic Props
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## 📦 11. การตกแต่งขอบกล่องข้อความและ Alert (Uniform Border Standard)
ห้ามใช้เส้นขอบหนาเฉพาะฝั่งหัว/ฝั่งซ้ายของพื้นหลัง เช่น `border-l-4 border-[#8B5CF6]`, `border-l-4`, `border-l-2` บนกล่องแจ้งเตือน (Alert / Callout Boxes), กล่องคำคม หรือ Container ให้ใช้เส้นขอบรอบด้านแบบสม่ำเสมอ `border border-[#1E1E26]` หรือ `border border-purple-900/30 rounded-lg` เพื่อความสะอาด สบายตา และเป็นเอกสารทางการ
```tsx
// ❌ Bad: มีเส้นหนาเฉพาะฝั่งซ้าย/หัวกล่อง
<div className="p-4 rounded-lg border-l-4 border-[#8B5CF6] bg-[#080810]">

// ✅ Good: ใช้เส้นขอบสม่ำเสมอรอบด้าน (Uniform Border) และใช้ Icon สื่อความหมาย
<div className="p-4 rounded-lg border border-[#1E1E26] bg-[#080810] flex items-start gap-3.5">
```