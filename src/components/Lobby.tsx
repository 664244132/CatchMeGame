import { useState, useEffect } from 'react';
import { NetworkManager, normalizeRoomCode } from '../game/networkManager';
import type { LobbyPlayer, PlayerConfig } from '../game/types';

interface Props {
  onStartGame: (
    totalRounds: number,
    playerConfigs: PlayerConfig[],
    catId: number,
    isHost: boolean,
    localPlayerId: number,
  ) => void;
}

type LobbyView = 'MAIN' | 'JOIN' | 'WAITING';

export default function Lobby({ onStartGame }: Props) {
  const [view, setView] = useState<LobbyView>('MAIN');
  const [playerName, setPlayerName] = useState(() => `Player ${Math.floor(Math.random() * 90 + 10)}`);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [totalRounds, setTotalRounds] = useState(5);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStatusText, setConnectStatusText] = useState('');

  const network = NetworkManager.getInstance();

  useEffect(() => {
    // ดักฟังการอัปเดตสมาชิกในห้อง
    const onLobbyUpdated = (updatedPlayers: LobbyPlayer[]) => {
      setPlayers(updatedPlayers);
    };

    // ดักฟังเมื่อ Host สั่งเริ่มเกม (สำหรับฝั่ง Guest)
    const onGameStarted = (payload: {
      totalRounds: number;
      catId: number;
      playerConfigs: PlayerConfig[];
    }) => {
      const localId = network.localPlayer?.id ?? 0;
      onStartGame(payload.totalRounds, payload.playerConfigs, payload.catId, false, localId);
    };

    // ดักฟังการยืนยันเข้าห้องสำเร็จ (ACK)
    const onJoinSuccess = (payload: { players: LobbyPlayer[]; roomCode: string }) => {
      setIsConnecting(false);
      setRoomCode(payload.roomCode);
      setPlayers(payload.players);
      setView('WAITING');
      setErrorMsg('');
    };

    // ดักฟังกรณีเข้าห้องไม่สำเร็จ / หาห้องไม่พบ (Timeout or Not Found)
    const onJoinFailed = (payload: { reason: string }) => {
      setIsConnecting(false);
      setErrorMsg(payload.reason || 'ไม่พบห้อง หรือไม่สามารถเชื่อมต่อได้');
    };

    // ดักฟังสถานะระหว่างการเชื่อมต่อ
    const onJoinStatus = (payload: { message: string }) => {
      setConnectStatusText(payload.message);
    };

    network.on('lobby_updated', onLobbyUpdated);
    network.on('game_started', onGameStarted);
    network.on('join_success', onJoinSuccess);
    network.on('join_failed', onJoinFailed);
    network.on('join_status', onJoinStatus);

    return () => {
      network.off('lobby_updated', onLobbyUpdated);
      network.off('game_started', onGameStarted);
      network.off('join_success', onJoinSuccess);
      network.off('join_failed', onJoinFailed);
      network.off('join_status', onJoinStatus);
    };
  }, [network, onStartGame]);

  // ─── 1. สร้างห้องใหม่ (Create Room as Host) ───────────────────────────────
  const handleCreateRoom = () => {
    const name = playerName.trim() || 'Host Player';
    const code = network.createRoom(name);
    setRoomCode(code);
    setIsHost(true);
    setPlayers(network.players);
    setView('WAITING');
    setErrorMsg('');
  };

  // ─── 2. เข้าร่วมห้องด้วยรหัส (Join Room as Guest) ───────────────────────────
  const handleJoinRoom = () => {
    const code = normalizeRoomCode(roomCodeInput);
    if (!code) {
      setErrorMsg('กรุณากรอกรหัสห้อง (Room Code 4 หลัก เช่น A8F2)');
      return;
    }

    const name = playerName.trim() || 'Guest Player';
    setIsConnecting(true);
    setConnectStatusText('กำลังค้นหาและเชื่อมต่อสัญญาณกับโฮสต์...');
    setErrorMsg('');
    setIsHost(false);
    network.joinRoom(code, name);
  };

  // ─── 3. Host กดเริ่มเกม (Start Game) ──────────────────────────────────────
  const handleHostStart = () => {
    if (!isHost) return;
    try {
      const { catId, playerConfigs } = network.hostStartGame(totalRounds);
      const localId = network.localPlayer?.id ?? 0;
      onStartGame(totalRounds, playerConfigs, catId, true, localId);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถเริ่มเกมได้');
    }
  };

  // ─── 4. เล่นด่วน 2 คน (Quick Match) ───────────────────────────────────────
  const handleQuickMatch = () => {
    const configs: PlayerConfig[] = [
      { id: 0, name: playerName.trim() || 'You', isHuman: true, color: 0x74b9ff },
      { id: 1, name: 'Player 2', isHuman: true, color: 0xff7675 },
    ];
    const initialCat = Math.floor(Math.random() * 2);
    onStartGame(totalRounds, configs, initialCat, true, 0);
  };

  // ─── 5. คัดลอกรหัสห้อง ────────────────────────────────────────────────────
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── 6. ออกจากห้อง ────────────────────────────────────────────────────────
  const handleLeaveRoom = () => {
    network.leaveRoom();
    setIsConnecting(false);
    setView('MAIN');
    setRoomCode('');
    setPlayers([]);
    setIsHost(false);
    setErrorMsg('');
  };

  return (
    <div className="lobby-bg min-h-screen w-full flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 overflow-y-auto custom-scrollbar relative">
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-3xl sm:text-4xl"
            style={{
              left: `${(i * 19 + 7) % 100}%`,
              top: `${(i * 31 + 5) % 90}%`,
              animation: `float-dec ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${(i * 0.4) % 3}s`,
              opacity: 0.15 + (i % 5) * 0.07,
              fontSize: `${1.2 + (i % 4) * 0.4}rem`,
            }}
          >
            {['💣', '⚡', '🐱', '🐭', '✨', '💥'][i % 6]}
          </div>
        ))}
      </div>

      <div className="relative z-10 max-w-lg w-full my-auto py-3 sm:py-6">
        {/* Title */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-block mb-2 sm:mb-3 px-3 py-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 text-[10px] sm:text-xs font-semibold tracking-widest uppercase">
            3D Multiplayer Party Game
          </div>
          <h1
            className="font-display text-4xl sm:text-6xl text-white leading-none mb-1 sm:mb-2"
            style={{ textShadow: '0 0 35px rgba(255,200,0,0.45)' }}
          >
            🎉 Hot Potato
          </h1>
          <p className="text-white/60 text-xs sm:text-base mt-1 sm:mt-2">
            Multiplayer Room Arena (รองรับสูงสุด 50 คน • ไม่มี AI)
          </p>
        </div>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* VIEW 1: หน้าเมนูหลัก (MAIN MENU) */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'MAIN' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 backdrop-blur-md shadow-2xl">
            {/* Input ชื่อผู้เล่น */}
            <div className="mb-5">
              <label className="block text-white/70 text-xs uppercase tracking-wider mb-2 font-medium">
                ชื่อของคุณ (Player Name):
              </label>
              <input
                type="text"
                value={playerName}
                maxLength={16}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="พิมพ์ชื่อของคุณ..."
                className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3 text-white text-base focus:outline-none focus:border-yellow-400/70 transition-all font-medium"
              />
            </div>

            {/* ปุ่มเลือกจำนวนรอบ */}
            <div className="mb-6">
              <label className="block text-white/70 text-xs uppercase tracking-wider mb-2 font-medium">
                จำนวนรอบการแข่งขัน (Total Rounds):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 7].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTotalRounds(r)}
                    className={`py-2.5 rounded-xl border font-display text-lg transition-all ${
                      totalRounds === r
                        ? 'bg-yellow-400 text-black border-yellow-400 font-bold shadow-[0_0_15px_rgba(255,200,0,0.3)]'
                        : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {r} Rounds
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:brightness-110 active:scale-98 transition-all rounded-2xl py-3.5 text-black font-display text-xl font-bold shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>👑</span> สร้างห้องใหม่ (Create Room)
              </button>

              <button
                type="button"
                onClick={() => setView('JOIN')}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 active:scale-98 transition-all rounded-2xl py-3.5 text-white font-display text-xl font-bold shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔑</span> ใส่รหัสเพื่อเข้าห้อง (Join Room)
              </button>

              <button
                type="button"
                onClick={handleQuickMatch}
                className="w-full bg-white/10 hover:bg-white/15 active:scale-98 border border-white/20 transition-all rounded-2xl py-3 text-white/80 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡</span> เล่นด่วนทันที (Quick 2P Local)
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* VIEW 2: หน้ากรอกรหัสห้อง (JOIN ROOM) */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'JOIN' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 backdrop-blur-md shadow-2xl">
            <h2 className="font-display text-white text-xl sm:text-2xl text-center mb-3 sm:mb-4">
              🔑 เข้าร่วมห้องเล่นเกม
            </h2>

            <div className="mb-4">
              <label className="block text-white/70 text-xs uppercase tracking-wider mb-2 font-medium">
                กรอกรหัสห้อง 4 หลัก (Room Code):
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="เช่น A8F2"
                maxLength={8}
                className="w-full bg-black/50 border border-white/30 rounded-2xl px-4 py-3 sm:py-3.5 text-white font-display text-2xl sm:text-3xl tracking-widest text-center uppercase focus:outline-none focus:border-violet-400 transition-all font-bold"
              />
              <p className="text-white/40 text-[11px] text-center mt-1.5">
                🌐 เล่นข้ามเครื่องได้ (เช่น เปิดบนมือถือเพื่อเข้าห้องบนคอมพิวเตอร์)
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="space-y-2.5 sm:space-y-3">
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleJoinRoom}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 active:scale-98 transition-all rounded-2xl py-3 sm:py-3.5 text-white font-display text-lg sm:text-xl font-bold shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[48px]"
              >
                {isConnecting ? (
                  <>
                    <span className="animate-spin text-xl">⏳</span>
                    <span className="text-base sm:text-lg">{connectStatusText || 'กำลังค้นหาห้อง...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔑</span> เข้าห้องทันที (Join Room)
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isConnecting}
                onClick={() => {
                  setErrorMsg('');
                  setIsConnecting(false);
                  setView('MAIN');
                }}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-2.5 sm:py-3 text-white/70 font-medium text-xs sm:text-sm transition-all cursor-pointer min-h-[44px]"
              >
                ◀ ย้อนกลับ (Back)
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* VIEW 3: ห้องพักคอย (WAITING ROOM LOBBY) */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'WAITING' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 backdrop-blur-md shadow-2xl">
            {/* กล่องแสดง Room Code ขนาดใหญ่ */}
            <div className="bg-black/40 border border-white/15 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 text-center relative">
              <div className="text-white/50 text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1">
                Room Code ของคุณ (เล่นข้ามเครื่องได้)
              </div>
              <div className="font-display text-4xl sm:text-5xl text-yellow-300 tracking-widest font-black">
                {roomCode}
              </div>
              <p className="text-white/50 text-[11px] mt-1.5">
                🌐 นำรหัสนี้ไปกรอกบนมือถือหรือเครื่องอื่นเพื่อเล่นด้วยกันได้ทันที
              </p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-all cursor-pointer"
              >
                <span>📋</span> {copied ? 'คัดลอกเรียบร้อย!' : 'แตะเพื่อคัดลอกรหัส'}
              </button>
            </div>

            {/* หัวข้อสมาชิกในห้อง */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-display text-lg">
                👥 ผู้เล่นในห้อง ({players.length} / 50 คน)
              </div>
              <div className="text-xs text-yellow-400/90 font-medium">
                {isHost ? '👑 คุณคือหัวหน้าห้อง' : '👤 สมาชิกในห้อง'}
              </div>
            </div>

            {/* รายชื่อผู้เล่นที่เข้ามาในห้อง */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 mb-5">
              {players.map((p, index) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${
                    p.id === network.localPlayer?.id
                      ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-200'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: `#${p.color.toString(16).padStart(6, '0')}` }}
                    />
                    <span className="font-medium text-sm">
                      {p.name} {p.id === network.localPlayer?.id && '(คุณ)'}
                    </span>
                  </div>
                  <div>
                    {p.isHost && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                        👑 Host
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ปุ่มเริ่มเกม (เฉพาะ Host) หรือ ข้อความรอสำหรับ Guest */}
            {isHost ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleHostStart}
                  className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:brightness-110 active:scale-98 transition-all rounded-2xl py-4 text-white font-display text-2xl font-bold shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>▶</span> START GAME ({players.length} Players)
                </button>
                <p className="text-white/40 text-xs text-center">
                  * คุณสามารถกดเริ่มเกมได้ทันที ไม่จำเป็นต้องรอให้ครบ 50 คน
                </p>
              </div>
            ) : (
              <div className="text-center py-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <div className="text-2xl mb-1">🟢</div>
                <div className="text-emerald-300 font-display text-base font-bold">
                  เชื่อมต่อห้องสำเร็จแล้ว!
                </div>
                <div className="text-white/80 text-xs mt-1">
                  หัวหน้าห้อง: <span className="text-yellow-300 font-semibold">{players.find((p) => p.isHost)?.name || 'Host'}</span>
                </div>
                <div className="text-yellow-300 font-display text-sm mt-3 flex items-center justify-center gap-2">
                  <span className="animate-spin text-base">⏳</span>
                  <span>กำลังรอให้หัวหน้าห้องกดเริ่มเกม...</span>
                </div>
                <div className="text-white/40 text-[11px] mt-1">
                  * เมื่อหัวหน้าห้องกดปุ่ม START GAME หน้าจอจะเข้าสู่เกม 3D ทันที
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="w-full mt-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl py-2.5 text-red-300 font-medium text-xs transition-all cursor-pointer"
            >
              ออกจากห้อง (Leave Room)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
