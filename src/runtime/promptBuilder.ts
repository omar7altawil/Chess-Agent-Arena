import type { AgentConfig, MatchConfig, PlayerColor } from "../shared/types.js";
import { ChessGame } from "../chess/engine.js";

export function buildTurnPrompt(config: MatchConfig, game: ChessGame, color: PlayerColor, agent: AgentConfig): string {
  const legalMoves = game.getLegalMovesFor(color);
  const recentHistory = game
    .getMoveHistory()
    .slice(-12)
    .map((move) => `${move.moveNumber}${move.color === "white" ? "." : "..."} ${move.san} (${move.uci})`)
    .join(" ");
  const memory = agent.memory.mode === "external_summary"
    ? buildMemorySummary(game, agent.memory.max_summary_chars)
    : "Memory disabled.";

  return [
    `You are ${color}.`,
    `Current position FEN: ${game.getFen()}`,
    `Current turn: ${game.getTurn()}`,
    `Game status: ${game.getStatus()}`,
    `You are ${game.isCheck() && game.getTurn() === color ? "" : "not "}in check.`,
    `Legal moves (${legalMoves.length}): ${legalMoves.map((move) => `${move.uci}=${move.san}`).join(", ")}`,
    `Recent move history: ${recentHistory || "No moves yet."}`,
    `Memory summary: ${memory}`,
    `Tool calls remaining this turn: ${agent.behavior.max_tool_calls_per_turn}`,
    "You must use make_move for one legal move, resign if hopeless, or respond to a pending draw offer when appropriate.",
    "If native tool calls are unavailable, return strict JSON like {\"tool\":\"make_move\",\"arguments\":{\"move\":\"g1f3\",\"explanation\":\"I develop the knight.\"}}.",
    "Only include short public explanations. Do not include hidden reasoning."
  ].join("\n");
}

function buildMemorySummary(game: ChessGame, maxChars: number): string {
  const captures = game.getCaptured();
  const explanations = game
    .getMoveHistory()
    .filter((move) => move.explanation)
    .slice(-6)
    .map((move) => `${move.color} ${move.san}: ${move.explanation}`)
    .join(" ");
  const summary = [
    `Ply ${game.getPly()}, move ${game.getMoveNumber()}.`,
    `Captured by White: ${captures.white.join(", ") || "none"}.`,
    `Captured by Black: ${captures.black.join(", ") || "none"}.`,
    explanations ? `Recent public explanations: ${explanations}` : ""
  ]
    .filter(Boolean)
    .join(" ");
  return summary.slice(0, maxChars);
}
