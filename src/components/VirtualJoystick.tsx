import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  dashCooldown: number;
}

/**
 * VirtualJoystick - แผงควบคุมระบบสัมผัสบนหน้าจอมือถือและแท็บเล็ต (Touch Controls)
 *
 * ฟังก์ชันหลัก:
 * 1. Thumb Joystick (ฝั่งซ้าย): รองรับการเลื่อนทิศทาง 8 ทิศทางแบบ 360 องศา พร้อมแอนิเมชันคืนจุดกึ่งกลาง
 * 2. Action Buttons (ฝั่งขวา): ปุ่มกระโดด (Jump ⬆️) และปุ่มพุ่งตัว (Dash ⚡) พร้อมเกจคูลดาวน์สด
 * 3. Unified Input Dispatcher: ส่งคำสั่งผ่าน Custom Event ตรงเข้า Engine โดยใช้ KeyboardEvent มาตรฐาน
 *    ทำให้ระบบเกมเชื่อมต่อได้อย่างไร้รอยต่อทั้งบน Desktop และ Mobile โดยไม่ต้องแยกโค้ดฟิสิกส์
 */
export default function VirtualJoystick({ dashCooldown }: Props) {
  // ตรวจจับว่าเป็นอุปกรณ์ที่รองรับการสัมผัส (Touch Device) หรือไม่
  const [hasTouch, setHasTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  });

  // พิกัดของหัวปุ่มจอยสติ๊ก (Offset จากจุดศูนย์กลาง)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const baseRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);
  const activeKeys = useRef<Set<string>>(new Set());

  // ฟังก์ชันจำลองการกด/ปล่อยปุ่มคีย์บอร์ด
  const sendKey = useCallback((code: string, isDown: boolean) => {
    if (isDown) {
      if (!activeKeys.current.has(code)) {
        activeKeys.current.add(code);
        document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      }
    } else {
      if (activeKeys.current.has(code)) {
        activeKeys.current.delete(code);
        document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
    }
  }, []);

  // ล้างการกดปุ่มทั้งหมดเมื่อปล่อยนิ้ว
  const releaseAllDirectionKeys = useCallback(() => {
    const keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
    keys.forEach((k) => sendKey(k, false));
  }, [sendKey]);

  // คำนวณทิศทางการเคลื่อนที่ของจอยสติ๊ก
  const updateJoystick = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;

      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 45; // ระยะเลื่อนสูงสุดของปุ่ม

      // คำนวณตำแหน่ง Knob ให้อยู่ในรัศมีวงกลม
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxRadius);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      setKnobPos({ x: knobX, y: knobY });

      // Threshold เพื่อป้องกันการขยับนิ้วเล็กน้อยโดยไม่ตั้งใจ
      if (dist < 12) {
        releaseAllDirectionKeys();
        return;
      }

      // ทิศทางแบบเวกเตอร์ (Normalizing)
      const nx = dx / dist;
      const ny = dy / dist;

      // 8 ทิศทาง (WASD Thresholds)
      sendKey('KeyW', ny < -0.38);
      sendKey('KeyS', ny > 0.38);
      sendKey('KeyA', nx < -0.38);
      sendKey('KeyD', nx > 0.38);
    },
    [sendKey, releaseAllDirectionKeys],
  );

  // ─── Touch Event Handlers สำหรับจอยสติ๊ก ────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsDragging(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsDragging(false);
        setKnobPos({ x: 0, y: 0 });
        releaseAllDirectionKeys();
        break;
      }
    }
  };

  // คืนค่าปุ่มทั้งหมดเมื่อคอมโพเนนต์ถูก Unmount
  useEffect(() => {
    return () => {
      releaseAllDirectionKeys();
      sendKey('Space', false);
      sendKey('ShiftLeft', false);
    };
  }, [releaseAllDirectionKeys, sendKey]);

  // หากไม่ใช่หน้าจอสัมผัส และไม่ใช่โหมดทดสอบ จะซ่อนจอยสติ๊กอัตโนมัติ
  if (!hasTouch) return null;

  const isDashReady = dashCooldown <= 0;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30">
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 1. VIRTUAL JOYSTICK (ฝั่งซ้ายล่างสำหรับบังคับทิศทาง) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute left-4 sm:left-8 bottom-6 sm:bottom-8 pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={baseRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-black/40 border-2 border-white/20 backdrop-blur-md shadow-2xl flex items-center justify-center active:border-violet-400/50 transition-colors"
        >
          {/* ขีดบอกทิศทางจอยสติ๊ก 4 ทิศ */}
          <div className="absolute top-2 w-1.5 h-2.5 bg-white/30 rounded-full" />
          <div className="absolute bottom-2 w-1.5 h-2.5 bg-white/30 rounded-full" />
          <div className="absolute left-2 w-2.5 h-1.5 bg-white/30 rounded-full" />
          <div className="absolute right-2 w-2.5 h-1.5 bg-white/30 rounded-full" />

          {/* วงแหวนไกด์ด้านใน */}
          <div className="w-14 h-14 rounded-full border border-white/10" />

          {/* หัว Knob ที่ผู้เล่นลากสัมผัส */}
          <div
            className={`absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform ${
              isDragging
                ? 'bg-gradient-to-tr from-violet-500 to-fuchsia-500 shadow-violet-500/50 scale-105'
                : 'bg-gradient-to-tr from-white/30 to-white/10 border border-white/40'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div className="w-4 h-4 rounded-full bg-white/80 shadow-inner" />
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2. ACTION BUTTONS (ฝั่งขวาล่าง: กระโดด Jump และ พุ่ง Dash) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute right-4 sm:right-8 bottom-6 sm:bottom-8 pointer-events-auto flex items-end gap-3 sm:gap-4"
        style={{ touchAction: 'none' }}
      >
        {/* ปุ่ม Dash ⚡ (พุ่งตัว) */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            if (isDashReady) sendKey('ShiftLeft', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            sendKey('ShiftLeft', false);
          }}
          className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center font-display shadow-xl active:scale-90 transition-all ${
            isDashReady
              ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white border-2 border-cyan-300 shadow-cyan-500/30'
              : 'bg-black/60 border-2 border-white/20 text-white/40'
          }`}
        >
          <span className="text-2xl leading-none">⚡</span>
          <span className="text-[10px] font-bold tracking-wider mt-0.5 uppercase">
            {isDashReady ? 'DASH' : `${dashCooldown.toFixed(1)}s`}
          </span>

          {/* เกจคูลดาวน์รอบปุ่ม */}
          {!isDashReady && (
            <div
              className="absolute inset-0 rounded-full border-2 border-orange-400 opacity-60 animate-pulse pointer-events-none"
            />
          )}
        </button>

        {/* ปุ่ม Jump ⬆️ (กระโดด) */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey('Space', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            sendKey('Space', false);
          }}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-black border-2 border-yellow-200 font-display flex flex-col items-center justify-center shadow-xl shadow-yellow-500/30 active:scale-90 transition-all"
        >
          <span className="text-2xl leading-none">⬆️</span>
          <span className="text-[10px] font-black tracking-wider mt-0.5 uppercase">JUMP</span>
        </button>
      </div>
    </div>
  );
}
