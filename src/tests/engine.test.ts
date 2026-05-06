import { describe, expect, it } from "vitest";
import { ChessGame } from "../chess/engine.js";

describe("ChessGame", () => {
  it("generates legal opening moves and applies UCI moves", () => {
    const game = new ChessGame();
    expect(game.getLegalMoves()).toHaveLength(20);
    const result = game.makeMove("e2e4", "human");
    expect(result.ok).toBe(true);
    expect(game.getFen()).toContain(" b ");
    expect(game.getLastMove()?.san).toBe("e4");
  });

  it("rejects illegal UCI moves with hints", () => {
    const game = new ChessGame();
    const result = game.makeMove("e2e5", "human");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Illegal move");
      expect(result.legalMovesHint).toContain("e2e4");
    }
  });

  it("handles castling", () => {
    const game = new ChessGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const result = game.makeMove("e1g1", "human");
    expect(result.ok).toBe(true);
    expect(game.getFen().split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
  });

  it("handles en passant", () => {
    const game = new ChessGame("8/8/8/3pP3/8/8/8/4K2k w - d6 0 1");
    const result = game.makeMove("e5d6", "human");
    expect(result.ok).toBe(true);
    expect(game.getFen().split(" ")[0]).toBe("8/8/3P4/8/8/8/8/4K2k");
  });

  it("requires promotion suffix and promotes pawns", () => {
    const game = new ChessGame("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const missing = game.makeMove("a7a8", "human");
    expect(missing.ok).toBe(false);
    const promoted = game.makeMove("a7a8q", "human");
    expect(promoted.ok).toBe(true);
    expect(game.getFen().split(" ")[0]).toBe("Q3k3/8/8/8/8/8/8/4K3");
  });

  it("detects checkmate result", () => {
    const game = new ChessGame();
    for (const move of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
      const result = game.makeMove(move, "human");
      expect(result.ok).toBe(true);
    }
    expect(game.isGameOver()).toBe(true);
    expect(game.getResult()).toBe("0-1");
    expect(game.getEndReason()).toContain("checkmated");
  });
});
