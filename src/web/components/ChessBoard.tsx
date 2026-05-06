import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { postMove } from "../api";
import type { GameSnapshot, PendingPromotion } from "../types";

const PROMOTIONS = [
  { code: "q", label: "Queen" },
  { code: "r", label: "Rook" },
  { code: "b", label: "Bishop" },
  { code: "n", label: "Knight" }
];

export function ChessBoard({
  game,
  fen,
  orientation,
  replaying,
  onMove,
  onError
}: {
  game: GameSnapshot;
  fen: string;
  orientation: "white" | "black";
  replaying: boolean;
  onMove: (snapshot: GameSnapshot) => void;
  onError: (error: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(game.legalMoves.filter((move) => move.from === selected).map((move) => move.to));
  }, [game.legalMoves, selected]);
  const pieceMap = useMemo(() => parseFenPieces(game.fen), [game.fen]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (game.lastMove) {
      styles[game.lastMove.from] = squareFill(game.lastMove.from, "rgba(238, 189, 47, 0.48)");
      styles[game.lastMove.to] = squareFill(game.lastMove.to, "rgba(238, 189, 47, 0.48)");
    }
    if (selected) {
      styles[selected] = {
        ...squareFill(selected, "rgba(41, 117, 93, 0.42)"),
        boxShadow: "inset 0 0 0 4px rgba(20, 88, 66, 0.7)"
      };
    }
    for (const target of legalTargets) {
      const hasPiece = Boolean(pieceMap[target]);
      styles[target] = hasPiece ? {
        ...styles[target],
        ...squareFill(target, "rgba(214, 97, 70, 0.2)"),
        boxShadow: "inset 0 0 0 5px rgba(198, 70, 46, 0.78)"
      } : {
        ...styles[target],
        background: `radial-gradient(circle at center, rgba(18, 106, 81, 0.86) 0 14%, rgba(18, 106, 81, 0.28) 15% 25%, transparent 26%), ${squareBaseColor(target)}`
      };
    }
    if (game.check && game.status !== "completed") {
      const kingSquare = findKingSquare(game.fen, game.turn);
      if (kingSquare) {
        styles[kingSquare] = {
          ...squareFill(kingSquare, "rgba(214, 61, 57, 0.55)"),
          boxShadow: "inset 0 0 0 5px rgba(150, 31, 25, 0.74)"
        };
      }
    }
    return styles;
  }, [game.check, game.fen, game.lastMove, game.status, game.turn, legalTargets, pieceMap, selected]);

  const canMove = game.players[game.turn].type === "human" && game.status !== "completed" && !game.activity.thinking && !replaying;

  const submitMove = async (uci: string) => {
    try {
      onError(null);
      onMove(await postMove(uci));
      setSelected(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Move failed");
    }
  };

  const tryMove = (from: string, to: string) => {
    if (!canMove) return false;
    const matching = game.legalMoves.filter((move) => move.from === from && move.to === to);
    if (matching.length === 0) return false;
    if (matching.some((move) => move.promotion)) {
      setPendingPromotion({ from, to });
      return false;
    }
    void submitMove(`${from}${to}`);
    return true;
  };

  const handleDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  };

  const handleSquareClick = ({ square }: SquareHandlerArgs) => {
    if (!canMove) return;
    if (selected && legalTargets.has(square)) {
      tryMove(selected, square);
      return;
    }
    if (game.legalMoves.some((move) => move.from === square)) {
      setSelected(square);
      return;
    }
    setSelected(null);
  };

  const handlePieceClick = ({ square }: PieceHandlerArgs) => {
    if (canMove && square && game.legalMoves.some((move) => move.from === square)) {
      setSelected(square);
    }
  };

  const choosePromotion = (promotion: string) => {
    if (!pendingPromotion) return;
    void submitMove(`${pendingPromotion.from}${pendingPromotion.to}${promotion}`);
    setPendingPromotion(null);
  };

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: "arena-board",
          position: fen,
          boardOrientation: orientation,
          animationDurationInMs: game.config.ui.animation_ms,
          showAnimations: true,
          showNotation: game.config.ui.show_coordinates,
          allowDrawingArrows: false,
          allowDragging: canMove,
          canDragPiece: ({ piece }: PieceHandlerArgs) => canMove && piece.pieceType.startsWith(game.turn === "white" ? "w" : "b"),
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          onPieceClick: handlePieceClick,
          squareStyles,
          boardStyle: {
            borderRadius: 8,
            boxShadow: "0 24px 60px rgba(18, 27, 39, 0.22)"
          },
          lightSquareStyle: { backgroundColor: "#e8dfc8" },
          darkSquareStyle: { backgroundColor: "#688a67" }
        }}
      />
      {pendingPromotion && (
        <div className="promotion-popover" role="dialog" aria-label="Choose promotion piece">
          {PROMOTIONS.map((piece) => (
            <button key={piece.code} onClick={() => choosePromotion(piece.code)}>
              {piece.label}
            </button>
          ))}
          <button onClick={() => setPendingPromotion(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function squareFill(square: string, color: string): React.CSSProperties {
  return {
    background: `linear-gradient(${color}, ${color}), ${squareBaseColor(square)}`
  };
}

function squareBaseColor(square: string): string {
  return isLightSquare(square) ? "#e8dfc8" : "#688a67";
}

function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 1;
}

function parseFenPieces(fen: string): Record<string, string> {
  const pieces: Record<string, string> = {};
  const board = fen.split(" ")[0];
  let rank = 8;
  let file = 0;
  for (const char of board) {
    if (char === "/") {
      rank -= 1;
      file = 0;
      continue;
    }
    if (/\d/.test(char)) {
      file += Number(char);
      continue;
    }
    pieces[`${"abcdefgh"[file]}${rank}`] = char;
    file += 1;
  }
  return pieces;
}

function findKingSquare(fen: string, turn: string): string | null {
  const board = fen.split(" ")[0];
  const target = turn === "white" ? "K" : "k";
  let rank = 8;
  let file = 0;
  for (const char of board) {
    if (char === "/") {
      rank -= 1;
      file = 0;
      continue;
    }
    if (/\d/.test(char)) {
      file += Number(char);
      continue;
    }
    if (char === target) {
      return `${"abcdefgh"[file]}${rank}`;
    }
    file += 1;
  }
  return null;
}
