import { useState } from 'react';
import type { GameStateSnapshot } from '../game/types';
import { BOMB_START_TIME } from '../game/constants';
import VirtualJoystick from './VirtualJoystick';

interface Props {
  state: GameStateSnapshot;
  round: number;
  totalRounds: number;
}

/**
 * HUD - หน้าต่างส่วนติดต่อผู้ใช้ในเกม (Heads-Up Display)
 *
 * รองรับ Responsive 100% ทุกขนาดหน้าจอ:
 * 1. Mobile Top Bar: แสดงรอบ, เวลาระเบิด, และจำนวนคนรอดในขนาดกะทัดรัด ไม่บังวิสัยทัศน์ 3D
 * 2. Responsive Player Drawer: รองรับรายชื่อผู้เล่นสูงสุด 50 คน พร้อมปุ่มเปิด-ปิดรายชื่อสำหรับจอมือถือ
 * 3. Mobile Touch Controls: เชื่อมต่อ VirtualJoystick (จอยสติ๊กซ้าย + ปุ่มกระโดด/Dash ขวา)
 * 4. Safe Area Insets: ปรับระยะเว้นขอบบน-ล่างให้พอดีกับติ่งกล้องและขอบจอมือถือ
 */
export default function HUD({ state, round, totalRounds }: Props) {
  const { players, bombTimer, message, dashCooldown, bombDistance } = state;
  const [showPlayerList, setShowPlayerList] = useState(false);

  const alive = players.filter((p) => !p.isDead);
  const cat = players.find((p) => p.isCat && !p.isDead);
  const human = players.find((p) => p.isHuman);
  const humanIsIt = human?.isCat && !human.isDead;

  // คำนวณเปอร์เซ็นต์เวลาระเบิด (อ้างอิงจาก BOMB_START_TIME = 15.0 วินาที)
  const timerPct = Math.max(0, bombTimer / BOMB_START_TIME);
  const timerUrgent = bombTimer < 3.5;
  const dashPct = Math.max(0, 1 - dashCooldown / 2);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP STATUS BAR (ปรับขนาดอัตโนมัติทั้งมือถือและจอคอมพิวเตอร์) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-2.5 sm:p-4 gap-2 z-20">
        {/* กล่องแสดงรอบปัจจุบัน */}
        <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 shrink-0 shadow-lg">
          <div className="text-white/50 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
            Round
          </div>
          <div className="text-white font-display text-base sm:text-xl leading-tight">
            {round} <span className="text-white/40 text-xs sm:text-sm">/ {totalRounds}</span>
          </div>
        </div>

        {/* กล่องเวลาระเบิดตรงกลาง (Center Bomb Timer) พร้อม Radar Distance Badge */}
        {cat && (
          <div className="flex-1 flex justify-center max-w-xs sm:max-w-md mx-1">
            <div
              className={`relative flex flex-col items-center px-3.5 py-1.5 sm:px-6 sm:py-2 rounded-2xl border transition-all duration-150 backdrop-blur-md shadow-xl ${
                timerUrgent
                  ? 'bg-red-600/85 border-red-400 shadow-[0_0_25px_rgba(255,60,0,0.8)] scale-102'
                  : 'bg-black/60 border-white/20'
              }`}
            >
              <div className="text-white/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-0.5 truncate max-w-[210px] sm:max-w-none text-center flex items-center justify-center gap-1.5 flex-wrap">
                <span>💣 <span className="text-yellow-300 font-bold">{cat.name}</span> has the bomb!</span>
                {bombDistance !== undefined && !humanIsIt && (
                  <span className="bg-red-500/80 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-red-300/40 tracking-normal shadow-sm flex items-center gap-0.5 animate-pulse">
                    <span>📍</span>
                    <span>{Math.round(bombDistance)}m</span>
                  </span>
                )}
                {humanIsIt && (
                  <span className="bg-yellow-400 text-black text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full tracking-normal shadow-sm animate-bounce">
                    YOU!
                  </span>
                )}
              </div>

              <div
                className={`font-display text-2xl sm:text-4xl leading-none tabular-nums font-bold ${
                  timerUrgent ? 'text-yellow-300 animate-pulse' : 'text-white'
                }`}
              >
                {Math.max(0, bombTimer).toFixed(1)}s
              </div>

              {/* หลอดเวลาลดลงแบบเรียลไทม์ */}
              <div className="mt-1.5 w-24 sm:w-44 h-1.5 sm:h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    timerUrgent ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${timerPct * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ปุ่มแสดงจำนวนผู้รอดชีวิต (กดเพื่อเปิดดูรายชื่อผู้เล่นทั้งหมดได้) */}
        <button
          type="button"
          onClick={() => setShowPlayerList(!showPlayerList)}
          className="pointer-events-auto bg-black/60 hover:bg-black/80 active:scale-95 transition-all backdrop-blur-md border border-white/20 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 text-right shrink-0 shadow-lg cursor-pointer"
        >
          <div className="text-white/50 text-[10px] sm:text-xs font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
            <span>Alive</span>
            <span className="text-xs">👥</span>
          </div>
          <div className="text-emerald-400 font-display text-base sm:text-xl leading-tight">
            {alive.length} <span className="text-white/40 text-xs sm:text-sm">/ {players.length}</span>
          </div>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2. PLAYER LIST (Desktop แสดงข้างซ้าย / Mobile เปิดเป็น Drawer) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* Desktop view: ลิสต์ผู้เล่นด้านซ้ายบน ใต้รอบการเล่น */}
      <div className="hidden lg:flex absolute top-20 left-3 flex-col gap-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1 z-10 pointer-events-auto">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs backdrop-blur-sm transition-all ${
              p.isDead
                ? 'opacity-40 bg-black/40 border-white/10 text-white/50'
                : p.isCat
                ? 'bg-orange-600/80 border-orange-400 text-white shadow-[0_0_12px_rgba(255,100,0,0.5)]'
                : p.isHuman
                ? 'bg-blue-600/70 border-blue-400 text-white'
                : 'bg-black/50 border-white/15 text-white'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: `#${p.color.toString(16).padStart(6, '0')}` }}
            />
            <span className="font-medium truncate max-w-[100px]">
              {p.isHuman ? '★ ' : ''}
              {p.name}
            </span>
            {p.isCat && !p.isDead && <span className="text-xs">💣</span>}
            {p.isDead && <span className="text-xs">💀</span>}
            <span className="ml-auto pl-2 text-white/60 font-mono">{p.survivalCount}</span>
          </div>
        ))}
      </div>

      {/* Mobile Drawer view: ปรากฏเมื่อกดปุ่มผู้เล่นมุมขวาบน */}
      {showPlayerList && (
        <div className="lg:hidden absolute inset-0 bg-black/70 backdrop-blur-md z-40 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900/95 border border-white/20 rounded-3xl p-5 max-w-sm w-full max-h-[75vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-3">
              <div className="text-white font-display text-lg">
                👥 ผู้เล่นทั้งหมด ({alive.length} คนรอด)
              </div>
              <button
                type="button"
                onClick={() => setShowPlayerList(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar space-y-2 flex-1 pr-1">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm ${
                    p.isDead
                      ? 'opacity-40 bg-black/30 border-white/10 text-white/40'
                      : p.isCat
                      ? 'bg-orange-500/20 border-orange-400 text-orange-200 font-bold'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: `#${p.color.toString(16).padStart(6, '0')}` }}
                    />
                    <span>
                      {p.isHuman ? '★ ' : ''}
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {p.isCat && !p.isDead && <span className="text-orange-400">💣 IT</span>}
                    {p.isDead && <span className="text-red-400">💀 Dead</span>}
                    {!p.isDead && !p.isCat && <span className="text-emerald-400">✓ Alive</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 3. YOU ARE IT BANNER (เตือนแบบกระชับไม่บังจอเมื่อถือระเบิด) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {humanIsIt && (
        <div className={`absolute ${message ? 'top-26 sm:top-28' : 'top-18 sm:top-22'} left-0 right-0 flex justify-center px-4 z-20 pointer-events-none transition-all`}>
          <div className="bg-gradient-to-r from-orange-600 via-red-600 to-amber-600 border border-yellow-300 rounded-full px-4 py-1.5 sm:px-6 sm:py-2 shadow-[0_0_25px_rgba(255,80,0,0.7)] text-center animate-pulse">
            <span className="font-display text-white text-xs sm:text-sm drop-shadow">
              ⚡ YOU HAVE THE BOMB! TAG SOMEONE! 💥
            </span>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 4. FLOATING MESSAGE (ข้อความแจ้งเตือนด้านบนขนาดกะทัดรัด ไม่บังกลางจอ) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {message && (
        <div className="absolute top-18 sm:top-22 left-1/2 -translate-x-1/2 pointer-events-none z-30 px-3 max-w-[90vw] sm:max-w-lg w-auto transition-all">
          <div className="bg-black/80 border border-white/25 rounded-full px-4 py-1.5 sm:px-6 sm:py-2 text-center shadow-xl backdrop-blur-md">
            <p className="font-display text-white text-xs sm:text-base leading-tight tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
              {message}
            </p>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 5. DESKTOP CONTROLS REMINDER (แสดงเฉพาะบนหน้าจอคอมพิวเตอร์) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block absolute bottom-4 right-4 bg-black/60 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white/60 leading-relaxed backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-1.5 mb-1">
          <kbd className="text-white/80 font-bold">W</kbd>
          <kbd className="text-white/80 font-bold">A</kbd>
          <kbd className="text-white/80 font-bold">S</kbd>
          <kbd className="text-white/80 font-bold">D</kbd>
          <span>Move</span>
          <span className="mx-1 text-white/30">|</span>
          <kbd className="text-white/80 font-bold">Space</kbd>
          <span>Jump</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <kbd className="text-white/80 font-bold">Shift</kbd>
            <span>Dash</span>
          </div>
          <span className="text-[11px] font-bold">
            {dashCooldown > 0 ? (
              <span className="text-orange-400">CD {dashCooldown.toFixed(1)}s</span>
            ) : (
              <span className="text-emerald-400">READY</span>
            )}
          </span>
        </div>
        {/* แถบเกจคูลดาวน์ Dash */}
        <div className="mt-1.5 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-100"
            style={{ width: `${dashPct * 100}%` }}
          />
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 6. MOBILE TOUCH CONTROLS (Virtual Joystick + Action Buttons) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <VirtualJoystick dashCooldown={dashCooldown} />
    </div>
  );
}
