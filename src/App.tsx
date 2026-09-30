import { useState, useRef, useCallback, useEffect } from 'react';
import { GamePhase } from './game/types';
import type { GameStateSnapshot, PlayerData, PlayerConfig } from './game/types';
import type { GameEngine } from './game/GameEngine';
import { NetworkManager } from './game/networkManager';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import Lobby from './components/Lobby';
import RoundEnd from './components/RoundEnd';
import MatchSummary from './components/MatchSummary';

const INITIAL_STATE: GameStateSnapshot = {
  players: [],
  bombTimer: 4,
  bombHolderId: 0,
  message: '',
  roundActive: false,
  dashCooldown: 0,
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [totalRounds, setTotalRounds] = useState(5);
  const [round, setRound] = useState(1);
  const [gameState, setGameState] = useState<GameStateSnapshot>(INITIAL_STATE);
  const [roundPlayers, setRoundPlayers] = useState<PlayerData[]>([]);
  const [finalPlayers, setFinalPlayers] = useState<PlayerData[]>([]);
  const [catId, setCatId] = useState(0);

  // ข้อมูลห้องและการเชื่อมต่อเน็ตเวิร์ก
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState(0);

  const engineRef = useRef<GameEngine | null>(null);

  // ดักฟังการสั่งเริ่มรอบถัดไปและผลสรุปจบรอบจาก Host ข้ามเน็ตเวิร์ก
  useEffect(() => {
    const network = NetworkManager.getInstance();
    const onNextRound = (payload: { nextRound: number; catId: number }) => {
      setRound(payload.nextRound);
      setCatId(payload.catId);
      setPhase(GamePhase.ROUND_ACTIVE);
      setTimeout(() => {
        engineRef.current?.startRound(payload.catId);
      }, 60);
    };

    const onRoundEndNet = (payload: { players: PlayerData[] }) => {
      setRoundPlayers(payload.players);
      setPhase(GamePhase.ROUND_END);
    };

    const onMatchOver = (payload: { players: PlayerData[] }) => {
      setFinalPlayers(payload.players);
      setPhase(GamePhase.MATCH_SUMMARY);
    };

    const onResetLobby = () => {
      setRound(1);
      setGameState(INITIAL_STATE);
      setPhase(GamePhase.LOBBY);
    };

    network.on('next_round', onNextRound);
    network.on('round_end', onRoundEndNet);
    network.on('match_over', onMatchOver);
    network.on('reset_lobby', onResetLobby);
    return () => {
      network.off('next_round', onNextRound);
      network.off('round_end', onRoundEndNet);
      network.off('match_over', onMatchOver);
      network.off('reset_lobby', onResetLobby);
    };
  }, []);

  const handleStateUpdate = useCallback((s: GameStateSnapshot) => {
    setGameState(s);
  }, []);

  const handleRoundEnd = useCallback((players: PlayerData[]) => {
    setRoundPlayers(players);
    setPhase(GamePhase.ROUND_END);
  }, []);

  // เริ่มต้นเกมจากหน้า Lobby (ทั้งฝั่ง Host และ Guest)
  const handleStartGame = (
    rounds: number,
    configs: PlayerConfig[],
    initialCatId: number,
    hostFlag: boolean,
    localId: number,
  ) => {
    setTotalRounds(rounds);
    setRound(1);
    setPlayerConfigs(configs);
    setCatId(initialCatId);
    setIsHost(hostFlag);
    setLocalPlayerId(localId);
    setPhase(GamePhase.ROUND_ACTIVE);
  };

  const handleNextRound = () => {
    if (round >= totalRounds) {
      setFinalPlayers(roundPlayers);
      setPhase(GamePhase.MATCH_SUMMARY);
      if (isHost) {
        NetworkManager.getInstance().sendMessage('MATCH_OVER', { players: roundPlayers });
      }
    } else {
      const nextRound = round + 1;
      setRound(nextRound);

      // หากเป็น Host ให้ส่งสัญญาณเปลี่ยนรอบไปยังผู้เล่นคนอื่น
      let newCatId = Math.floor(Math.random() * playerConfigs.length);
      if (isHost) {
        newCatId = NetworkManager.getInstance().hostNextRound(nextRound);
      }

      setCatId(newCatId);
      setPhase(GamePhase.ROUND_ACTIVE);
      setTimeout(() => {
        engineRef.current?.startRound(newCatId);
      }, 60);
    }
  };

  const handlePlayAgain = () => {
    if (isHost) {
      NetworkManager.getInstance().sendMessage('RESET_LOBBY', {});
    }
    setRound(1);
    setGameState(INITIAL_STATE);
    setPhase(GamePhase.LOBBY);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Three.js 3D WebGL Canvas */}
      {phase !== GamePhase.LOBBY && phase !== GamePhase.MATCH_SUMMARY && (
        <div
          className={`absolute inset-0 ${
            phase !== GamePhase.ROUND_ACTIVE ? 'opacity-30 pointer-events-none' : ''
          }`}
        >
          <GameCanvas
            catId={catId}
            onStateUpdate={handleStateUpdate}
            onRoundEnd={handleRoundEnd}
            engineRef={engineRef}
            playerConfigs={playerConfigs}
            localPlayerId={localPlayerId}
            isHost={isHost}
          />
        </div>
      )}

      {/* หน้าต่างต่างๆ ของเกม */}
      {phase === GamePhase.LOBBY && <Lobby onStartGame={handleStartGame} />}

      {phase === GamePhase.ROUND_ACTIVE && (
        <HUD state={gameState} round={round} totalRounds={totalRounds} />
      )}

      {phase === GamePhase.ROUND_END && (
        <RoundEnd
          round={round}
          totalRounds={totalRounds}
          players={roundPlayers}
          onNext={handleNextRound}
          isHost={isHost}
        />
      )}

      {phase === GamePhase.MATCH_SUMMARY && (
        <MatchSummary
          players={finalPlayers}
          totalRounds={totalRounds}
          onPlayAgain={handlePlayAgain}
          isHost={isHost}
        />
      )}
    </div>
  );
}
