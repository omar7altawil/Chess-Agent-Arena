import { Chess, DEFAULT_POSITION, Move, Square } from "chess.js";
import type {
  CapturedSnapshot,
  GameResult,
  GameStatus,
  LegalMove,
  MoveRecord,
  PlayerColor,
  PlayerType
} from "../shared/types.js";

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};

export function toChessColor(color: PlayerColor): "w" | "b" {
  return color === "white" ? "w" : "b";
}

export function fromChessColor(color: "w" | "b"): PlayerColor {
  return color === "w" ? "white" : "black";
}

export function oppositeColor(color: PlayerColor): PlayerColor {
  return color === "white" ? "black" : "white";
}

export function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function parseUci(move: string): { from: string; to: string; promotion?: string } | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
    return null;
  }
  return {
    from: move.slice(0, 2),
    to: move.slice(2, 4),
    promotion: move.length === 5 ? move[4] : undefined
  };
}

export class ChessGame {
  private chess: Chess;
  private moveRecords: MoveRecord[] = [];
  private manualResult: { result: GameResult; reason: string } | null = null;
  private drawOfferState: { by: PlayerColor; explanation?: string } | null = null;
  private capturedBy: CapturedSnapshot = { white: [], black: [] };

  constructor(startingFen?: string | null) {
    this.chess = new Chess(startingFen || DEFAULT_POSITION);
  }

  getFen(): string {
    return this.chess.fen();
  }

  getPgn(): string {
    return this.chess.pgn({ newline: "\n" });
  }

  setHeaders(headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      this.chess.setHeader(key, value);
    }
  }

  getTurn(): PlayerColor {
    return fromChessColor(this.chess.turn());
  }

  getMoveNumber(): number {
    return this.chess.moveNumber();
  }

  getPly(): number {
    return this.moveRecords.length;
  }

  isCheck(): boolean {
    return this.chess.isCheck();
  }

  isGameOver(): boolean {
    return this.manualResult !== null || this.chess.isGameOver();
  }

  getStatus(): GameStatus {
    return this.isGameOver() ? "completed" : "active";
  }

  getResult(): GameResult {
    if (this.manualResult) {
      return this.manualResult.result;
    }
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === "w" ? "0-1" : "1-0";
    }
    if (this.chess.isDraw()) {
      return "1/2-1/2";
    }
    return "*";
  }

  getEndReason(): string | null {
    if (this.manualResult) {
      return this.manualResult.reason;
    }
    if (this.chess.isCheckmate()) {
      return `${fromChessColor(this.chess.turn())} checkmated`;
    }
    if (this.chess.isStalemate()) {
      return "stalemate";
    }
    if (this.chess.isInsufficientMaterial()) {
      return "insufficient material";
    }
    if (this.chess.isThreefoldRepetition()) {
      return "threefold repetition";
    }
    if (this.chess.isDrawByFiftyMoves()) {
      return "fifty-move rule";
    }
    if (this.chess.isDraw()) {
      return "draw";
    }
    return null;
  }

  getLegalMoves(): LegalMove[] {
    return this.chess.moves({ verbose: true }).map((move) => this.toLegalMove(move));
  }

  getLegalMovesFor(color: PlayerColor): LegalMove[] {
    if (this.getTurn() !== color || this.isGameOver()) {
      return [];
    }
    return this.getLegalMoves();
  }

  getMoveHistory(): MoveRecord[] {
    return [...this.moveRecords];
  }

  getLastMove(): MoveRecord | null {
    return this.moveRecords.at(-1) ?? null;
  }

  getCaptured(): CapturedSnapshot {
    return {
      white: [...this.capturedBy.white],
      black: [...this.capturedBy.black]
    };
  }

  getDrawOffer(): { by: PlayerColor; explanation?: string } | null {
    return this.drawOfferState ? { ...this.drawOfferState } : null;
  }

  getBoard() {
    return this.chess.board();
  }

  getPiece(square: string) {
    return this.chess.get(square as Square);
  }

  attackers(square: string, color?: PlayerColor): string[] {
    const attackedBy = color ? toChessColor(color) : undefined;
    return this.chess.attackers(square as Square, attackedBy).map(String);
  }

  makeMove(uci: string, actor: PlayerType, explanation?: string): { ok: true; move: MoveRecord } | { ok: false; error: string; legalMovesHint: string[] } {
    if (this.isGameOver()) {
      return { ok: false, error: "The game is already over.", legalMovesHint: [] };
    }

    const parsed = parseUci(uci);
    if (!parsed) {
      return {
        ok: false,
        error: `Move '${uci}' is not valid UCI notation.`,
        legalMovesHint: this.getLegalMoves().map((move) => move.uci)
      };
    }

    const legalMoves = this.chess.moves({ verbose: true });
    const exact = legalMoves.find((move) => moveToUci(move) === uci);
    if (!exact) {
      const promotionNeeded = legalMoves.some((move) => move.from === parsed.from && move.to === parsed.to && move.promotion);
      const suffix = promotionNeeded ? " Promotion piece is required, for example e7e8q." : "";
      return {
        ok: false,
        error: `Illegal move: ${uci} is not legal in the current position.${suffix}`,
        legalMovesHint: legalMoves.slice(0, 12).map(moveToUci)
      };
    }

    const fenBefore = this.getFen();
    let move: Move;
    try {
      move = this.chess.move({
        from: parsed.from,
        to: parsed.to,
        promotion: parsed.promotion
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : `Illegal move: ${uci}`,
        legalMovesHint: legalMoves.slice(0, 12).map(moveToUci)
      };
    }

    const record: MoveRecord = {
      ...this.toLegalMove(move),
      ply: this.moveRecords.length + 1,
      moveNumber: Math.ceil((this.moveRecords.length + 1) / 2),
      fenBefore,
      fenAfter: this.getFen(),
      explanation,
      actor
    };

    if (move.captured) {
      this.capturedBy[fromChessColor(move.color)].push(move.captured);
    }
    this.drawOfferState = null;
    this.moveRecords.push(record);
    return { ok: true, move: record };
  }

  resign(color: PlayerColor, reason?: string): { result: GameResult; reason: string } {
    const result: GameResult = color === "white" ? "0-1" : "1-0";
    const text = reason || `${color} resigned`;
    this.manualResult = { result, reason: text };
    return this.manualResult;
  }

  forfeit(color: PlayerColor, reason: string): { result: GameResult; reason: string } {
    const result: GameResult = color === "white" ? "0-1" : "1-0";
    this.manualResult = { result, reason };
    return this.manualResult;
  }

  forceDraw(reason: string): { result: GameResult; reason: string } {
    this.manualResult = { result: "1/2-1/2", reason };
    return this.manualResult;
  }

  offerDraw(color: PlayerColor, explanation?: string): { by: PlayerColor; explanation?: string } {
    this.drawOfferState = { by: color, explanation };
    return this.drawOfferState;
  }

  respondToDrawOffer(color: PlayerColor, response: "accept" | "decline", explanation?: string): { accepted: boolean; gameOver: boolean } {
    if (!this.drawOfferState || this.drawOfferState.by === color) {
      return { accepted: false, gameOver: this.isGameOver() };
    }
    if (response === "accept") {
      this.manualResult = { result: "1/2-1/2", reason: explanation || "draw by agreement" };
    }
    this.drawOfferState = null;
    return { accepted: true, gameOver: this.isGameOver() };
  }

  private toLegalMove(move: Move): LegalMove {
    return {
      uci: moveToUci(move),
      san: move.san,
      from: move.from,
      to: move.to,
      piece: PIECE_NAMES[move.piece] ?? move.piece,
      color: fromChessColor(move.color),
      capture: move.isCapture(),
      captured: move.captured ? PIECE_NAMES[move.captured] ?? move.captured : undefined,
      promotion: move.promotion ? PIECE_NAMES[move.promotion] ?? move.promotion : null,
      check: move.san.includes("+") || move.san.includes("#"),
      checkmate: move.san.includes("#")
    };
  }
}
