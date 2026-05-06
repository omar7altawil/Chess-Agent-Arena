import { describe, expect, it } from "vitest";
import { ChessGame } from "../chess/engine.js";
import { chooseBotMove } from "../players/bots.js";

describe("bots", () => {
  it("random bot chooses legal moves", () => {
    const game = new ChessGame();
    for (let i = 0; i < 20 && !game.isGameOver(); i += 1) {
      const choice = chooseBotMove(game, "random");
      expect(game.getLegalMoves().map((move) => move.uci)).toContain(choice.move);
      expect(game.makeMove(choice.move, "bot", choice.explanation).ok).toBe(true);
    }
  });

  it("heuristic bot chooses legal moves", () => {
    const game = new ChessGame();
    for (let i = 0; i < 20 && !game.isGameOver(); i += 1) {
      const choice = chooseBotMove(game, "heuristic");
      expect(game.getLegalMoves().map((move) => move.uci)).toContain(choice.move);
      expect(game.makeMove(choice.move, "bot", choice.explanation).ok).toBe(true);
    }
  });
});
