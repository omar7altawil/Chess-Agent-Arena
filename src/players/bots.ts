import { Chess } from "chess.js";
import { ChessGame, moveToUci } from "../chess/engine.js";
import type { BotKind, LegalMove } from "../shared/types.js";

const PIECE_VALUE: Record<string, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0
};

export function chooseBotMove(game: ChessGame, kind: BotKind = "random"): { move: string; explanation: string } {
  const legalMoves = game.getLegalMoves();
  if (legalMoves.length === 0) {
    throw new Error("No legal moves are available.");
  }
  if (kind === "heuristic") {
    const move = chooseHeuristicMove(legalMoves);
    return {
      move: move.uci,
      explanation: describeHeuristicMove(move)
    };
  }
  const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return {
    move: move.uci,
    explanation: "Random bot selected a legal move."
  };
}

function chooseHeuristicMove(moves: LegalMove[]): LegalMove {
  const scored = moves.map((move) => ({
    move,
    score: scoreMove(move) + Math.random() * 0.2
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

function scoreMove(move: LegalMove): number {
  let score = 0;
  if (move.checkmate) score += 100000;
  if (move.check) score += 80;
  if (move.capture && move.captured) {
    score += (PIECE_VALUE[move.captured] ?? 0) - (PIECE_VALUE[move.piece] ?? 0) * 0.18 + 120;
  }
  if (move.san === "O-O" || move.san === "O-O-O") score += 70;
  if ((move.piece === "knight" || move.piece === "bishop") && ["1", "8"].includes(move.from[1])) {
    score += 35;
  }
  if (["d4", "e4", "d5", "e5"].includes(move.to)) score += 22;
  if (move.promotion === "queen") score += 850;
  return score;
}

function describeHeuristicMove(move: LegalMove): string {
  if (move.checkmate) return "Heuristic bot found a checkmating move.";
  if (move.capture) return "Heuristic bot prefers this capture based on material value.";
  if (move.check) return "Heuristic bot gives check while keeping the move legal.";
  if (move.san === "O-O" || move.san === "O-O-O") return "Heuristic bot castles to improve king safety.";
  return "Heuristic bot selected an active legal move.";
}

export function playRandomGame(maxPlies = 300): ChessGame {
  const game = new ChessGame();
  for (let i = 0; i < maxPlies && !game.isGameOver(); i += 1) {
    const chess = new Chess(game.getFen());
    const legal = chess.moves({ verbose: true });
    const move = legal[Math.floor(Math.random() * legal.length)];
    game.makeMove(moveToUci(move), "bot", "Random playout.");
  }
  return game;
}
