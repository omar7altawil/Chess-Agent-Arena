import { ListOrdered } from "lucide-react";
import type { GameSnapshot } from "../types";

export function MoveList({
  game,
  activePly,
  onSelectPly
}: {
  game: GameSnapshot;
  activePly: number;
  onSelectPly: (ply: number) => void;
}) {
  const pairs = [];
  for (let index = 0; index < game.history.length; index += 2) {
    pairs.push({
      moveNumber: game.history[index].moveNumber,
      white: game.history[index],
      black: game.history[index + 1]
    });
  }
  return (
    <section className="panel move-panel">
      <h2><ListOrdered size={17} /> Moves</h2>
      <div className="move-list">
        {pairs.length === 0 && <span className="empty">No moves yet</span>}
        {pairs.map((pair) => (
          <div className="move-row" key={pair.moveNumber}>
            <span>{pair.moveNumber}</span>
            <button className={activePly === pair.white.ply ? "active" : ""} onClick={() => onSelectPly(pair.white.ply)}>
              {pair.white.san}
            </button>
            {pair.black ? (
              <button className={activePly === pair.black.ply ? "active" : ""} onClick={() => onSelectPly(pair.black!.ply)}>
                {pair.black.san}
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
