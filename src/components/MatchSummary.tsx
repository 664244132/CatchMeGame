import type { PlayerData } from "../game/types"

interface Props {
  players: PlayerData[]
  totalRounds: number
  onPlayAgain: () => void
  isHost?: boolean
}

export default function MatchSummary({
  players,
  totalRounds,
  onPlayAgain,
  isHost = true,
}: Props) {
  const sorted = [...players].sort((a, b) => b.survivalCount - a.survivalCount)
  const winner = sorted[0]

  const medals = ["🥇", "🥈", "🥉", "4th"]

  return (
    <div className="lobby-bg min-h-screen w-full flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto custom-scrollbar relative">
      {/* Confetti-ish background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={`confetti-${i}`}
            className="absolute w-2 h-2 rounded-sm"
            style={{
              left: `${(i * 17 + 3) % 100}%`,
              background: [
                "#ff6b6b",
                "#ffd93d",
                "#6bcb77",
                "#4d96ff",
                "#ff9ff3",
              ][i % 5],
              animation: `confetti-fall ${2 + (i % 4) * 0.8}s linear infinite`,
              animationDelay: `${(i * 0.25) % 3}s`,
              top: `-${10 + (i % 3) * 5}%`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-md w-full my-auto py-4">
        <div className="text-center mb-4 sm:mb-6">
          <div className="text-5xl sm:text-6xl mb-2">🏆</div>
          <div
            className="font-display text-3xl sm:text-5xl text-white leading-none mb-1 sm:mb-2"
            style={{ textShadow: "0 0 40px rgba(255,215,0,0.5)" }}
          >
            {winner.isHuman ? "YOU WIN!" : `${winner.name} Wins!`}
          </div>
          <p className="text-white/50 text-xs sm:text-base">
            {totalRounds} rounds completed
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 mb-4 sm:mb-6 backdrop-blur-sm max-h-60 sm:max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          <h3 className="text-center text-white/50 text-xs uppercase tracking-widest mb-2 font-bold">
            Final Standings
          </h3>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                i === 0
                  ? "bg-yellow-500/20 border-yellow-400/50 shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <span className="text-2xl w-8 text-center">
                {medals[i] ?? `${i + 1}`}
              </span>
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{
                  backgroundColor: `#${p.color.toString(16).padStart(6, "0")}`,
                }}
              />
              <div className="flex-1">
                <div className="text-white font-medium">
                  {p.isHuman ? `★ ${p.name}` : p.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-white text-xl">
                  {p.survivalCount}
                </div>
                <div className="text-white/40 text-xs">survived</div>
              </div>
              <div className="text-right ml-2">
                <div className="font-display text-white/70 text-sm">
                  {p.bombsDeflected}
                </div>
                <div className="text-white/30 text-xs">tags</div>
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:brightness-110 active:scale-95 transition-all rounded-2xl py-4 text-white font-display text-2xl shadow-lg cursor-pointer"
          >
            🎉 Play Again
          </button>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-violet-300 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-400 animate-ping" />
              Waiting for Host to return to lobby...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
