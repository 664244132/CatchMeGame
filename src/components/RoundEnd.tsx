import type { PlayerData } from '../game/types';

interface Props {
  round: number;
  totalRounds: number;
  players: PlayerData[];
  onNext: () => void;
  isHost?: boolean;
}

export default function RoundEnd({ round, totalRounds, players, onNext, isHost = true }: Props) {
  const sorted = [...players].sort((a, b) => b.survivalCount - a.survivalCount);
  const isLast = round >= totalRounds;

  return (
    <div className="lobby-bg min-h-screen w-full flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-md w-full my-auto py-4">
        <div className="text-center mb-4 sm:mb-6">
          <div className="font-display text-3xl sm:text-5xl text-white mb-1 sm:mb-2">
            {isLast ? '🏆 Match Over!' : `Round ${round} Done!`}
          </div>
          <p className="text-white/50 text-xs sm:text-sm">
            {isLast ? 'Final results' : `${totalRounds - round} round${totalRounds - round !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 mb-4 sm:mb-6 backdrop-blur-sm max-h-60 sm:max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border transition-all ${
                i === 0 && !isLast
                  ? 'bg-yellow-500/20 border-yellow-400/40'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <span className="font-display text-xl sm:text-2xl w-6 sm:w-8 text-center text-white/60">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <div
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shrink-0"
                style={{ backgroundColor: `#${p.color.toString(16).padStart(6, '0')}` }}
              />
              <div className="flex-1 truncate">
                <div className="text-white font-medium text-xs sm:text-sm leading-tight truncate">
                  {p.isHuman ? `★ ${p.name}` : p.name}
                </div>
                <div className="text-white/40 text-[10px] sm:text-xs mt-0.5">
                  {p.isDead ? '💀 Eliminated' : '✓ Survived'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-white text-base sm:text-lg">{p.survivalCount}</div>
                <div className="text-white/40 text-[10px] sm:text-xs">survived</div>
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={onNext}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:brightness-110 active:scale-95 transition-all rounded-2xl py-3.5 sm:py-4 text-white font-display text-xl sm:text-2xl shadow-lg cursor-pointer min-h-[48px]"
          >
            {isLast ? '🏆 See Final Scores' : '▶ Next Round'}
          </button>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-violet-300 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-400 animate-ping" />
              Waiting for Host to start next round...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
