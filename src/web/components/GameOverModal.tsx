import { ArrowLeftRight, RefreshCw, Settings2, Trophy, X } from "lucide-react";
import { useState } from "react";
import type { GameSnapshot } from "../types";

export function GameOverModal({
  game,
  onClose,
  onRematch,
  onSwapRematch,
  onNewMatch
}: {
  game: GameSnapshot;
  onClose: () => void;
  onRematch?: () => void;
  onSwapRematch?: () => void;
  onNewMatch?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    onClose();
  };
  const winner = game.result === "1-0" ? game.players.white.name : game.result === "0-1" ? game.players.black.name : null;
  return (
    <div className="modal-backdrop">
      <div className="game-modal">
        <button className="icon-only modal-close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
        <Trophy size={28} />
        <h2>{game.result}</h2>
        <p className="modal-subtitle">{winner ? `${winner} wins` : "Drawn game"}</p>
        <p className="modal-end-reason">{game.endReason ?? "Game complete"}</p>
        <div className="modal-actions">
          <button className="primary" onClick={() => { close(); onRematch?.(); }} disabled={!onRematch}>
            <RefreshCw size={15} /> Rematch
          </button>
          <button onClick={() => { close(); onSwapRematch?.(); }} disabled={!onSwapRematch}>
            <ArrowLeftRight size={15} /> Swap colors
          </button>
          <button onClick={() => { close(); onNewMatch?.(); }} disabled={!onNewMatch}>
            <Settings2 size={15} /> New match
          </button>
        </div>
        <button className="ghost" onClick={close}>Review game</button>
      </div>
    </div>
  );
}
