import { Activity, AlertCircle, BadgeInfo, CircleDot, Trophy } from "lucide-react";
import type { GameSnapshot } from "../types";

export function SidePanel({ game }: { game: GameSnapshot }) {
  const statusText = statusLabel(game);
  return (
    <section className="panel status-panel">
      <h2><Activity size={17} /> Match</h2>
      <div className="status-grid">
        <Metric label="Turn" value={game.status === "completed" ? "—" : game.turn} />
        <Metric label="Move" value={String(game.moveNumber)} />
        <Metric label="Ply" value={String(game.ply)} />
        <Metric label="Result" value={game.result === "*" ? "—" : game.result} />
      </div>
      <div className={`status-line ${game.check ? "warning" : ""}`}>
        {game.check ? <AlertCircle size={15} /> : <CircleDot size={15} />}
        {statusText}
      </div>
      <div className="captured-row">
        <span>White captured</span>
        <strong>{pieceNames(game.captured.white)}</strong>
      </div>
      <div className="captured-row">
        <span>Black captured</span>
        <strong>{pieceNames(game.captured.black)}</strong>
      </div>
      {game.drawOffer && (
        <div className="notice">
          <BadgeInfo size={16} />
          Draw offered by {game.drawOffer.by}
        </div>
      )}
      {game.status === "completed" && (
        <div className="notice result">
          <Trophy size={16} />
          {game.result} {game.endReason ? `· ${game.endReason}` : ""}
        </div>
      )}
    </section>
  );
}

function statusLabel(game: GameSnapshot): string {
  if (game.status === "completed") return game.endReason ?? "Game complete";
  if (game.check) return `${game.turn} is in check`;
  if (game.paused) return "Match paused";
  if (!game.started) return "Press Start to begin";
  return `${game.turn} to move`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function pieceNames(pieces: string[]): string {
  return pieces.length ? pieces.map((piece) => piece[0].toUpperCase()).join(" ") : "none";
}
