import { X, Trophy } from "lucide-react";
import { useState } from "react";
import type { GameSnapshot } from "../types";

export function GameOverModal({ game, onClose }: { game: GameSnapshot; onClose: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="modal-backdrop">
      <div className="game-modal">
        <button className="icon-only modal-close" onClick={() => { setHidden(true); onClose(); }} aria-label="Close">
          <X size={18} />
        </button>
        <Trophy size={28} />
        <h2>{game.result}</h2>
        <p>{game.endReason ?? "Game complete"}</p>
        <button className="primary" onClick={() => { setHidden(true); onClose(); }}>
          Review Game
        </button>
      </div>
    </div>
  );
}
