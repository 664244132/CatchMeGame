import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import type { GameStateSnapshot, PlayerData, PlayerConfig } from '../game/types';

interface Props {
  catId: number;
  onStateUpdate: (s: GameStateSnapshot) => void;
  onRoundEnd: (players: PlayerData[]) => void;
  engineRef: React.MutableRefObject<GameEngine | null>;
  playerConfigs?: PlayerConfig[];
  localPlayerId?: number;
  isHost?: boolean;
}

export default function GameCanvas({
  catId,
  onStateUpdate,
  onRoundEnd,
  engineRef,
  playerConfigs,
  localPlayerId = 0,
  isHost = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(
      canvas,
      onStateUpdate,
      onRoundEnd,
      playerConfigs,
      localPlayerId,
      isHost,
    );
    engineRef.current = engine;

    // เริ่มต้นรอบการเล่นเมื่อ Engine พร้อม
    if (!startedRef.current) {
      startedRef.current = true;
      setTimeout(() => engine.startRound(catId), 100);
    }

    const onResize = () => {
      engine.handleResize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      engine.dispose();
      engineRef.current = null;
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
