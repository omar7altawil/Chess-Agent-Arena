import { ArrowLeftRight, RefreshCw, Settings2 } from "lucide-react";
import type { GameSnapshot } from "../types";

export function ConfigPanel({
  game,
  onOpenSetup,
  onRematch,
  onSwapRematch
}: {
  game: GameSnapshot;
  onOpenSetup: () => void;
  onRematch: () => void;
  onSwapRematch: () => void;
}) {
  const canRematch = game.status === "completed" || game.history.length > 0;
  return (
    <section className="panel match-actions-panel">
      <h2><Settings2 size={17} /> Match</h2>
      <div className="match-actions-grid">
        <button className="primary" onClick={onOpenSetup}>
          <Settings2 size={15} /> New match…
        </button>
        <button onClick={onRematch} disabled={!canRematch}>
          <RefreshCw size={15} /> Rematch
        </button>
        <button onClick={onSwapRematch} disabled={!canRematch}>
          <ArrowLeftRight size={15} /> Rematch (swap)
        </button>
      </div>
      <p className="hint">
        Rematch reuses the current configuration. Swap flips colors so each side plays both.
      </p>
    </section>
  );
}
