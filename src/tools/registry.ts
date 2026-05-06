import { z } from "zod";
import type { ChatTool } from "../model/types.js";
import type { AgentConfig, PlayerColor } from "../shared/types.js";
import { ChessGame } from "../chess/engine.js";

interface ToolContext {
  game: ChessGame;
  agentColor: PlayerColor;
  agent: AgentConfig;
}

interface ToolExecution {
  ok: boolean;
  output: Record<string, unknown>;
  finalAction?: boolean;
  explanation?: string;
  invalid?: boolean;
}

interface ChessTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: unknown, context: ToolContext): ToolExecution;
}

const emptySchema = z.object({}).passthrough();
const moveSchema = z.object({
  move: z.string(),
  explanation: z.string().optional().default("")
});
const inspectSquareSchema = z.object({
  square: z.string().regex(/^[a-h][1-8]$/)
});
const notationSchema = z.object({
  notation: z.enum(["uci", "san"]).optional().default("uci")
});
const historySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional().default(20)
});
const resignSchema = z.object({
  explanation: z.string().optional().default("")
});
const offerDrawSchema = z.object({
  explanation: z.string().optional().default("")
});
const respondDrawSchema = z.object({
  response: z.enum(["accept", "decline"]),
  explanation: z.string().optional().default("")
});

const tools: Record<string, ChessTool> = {
  get_board_state: {
    name: "get_board_state",
    description: "Return the current FEN, turn, move number, check status, legal move count, and last move.",
    parameters: objectSchema({}),
    execute(args, { game }) {
      emptySchema.parse(args);
      const lastMove = game.getLastMove();
      return {
        ok: true,
        output: {
          fen: game.getFen(),
          turn: game.getTurn(),
          move_number: game.getMoveNumber(),
          check: game.isCheck(),
          legal_move_count: game.getLegalMoves().length,
          last_move: lastMove?.uci ?? null
        }
      };
    }
  },
  get_legal_moves: {
    name: "get_legal_moves",
    description: "Return all legal moves for the agent's side in UCI and SAN notation.",
    parameters: objectSchema({
      notation: { type: "string", enum: ["uci", "san"], default: "uci" }
    }),
    execute(args, { game, agentColor }) {
      notationSchema.parse(args);
      return {
        ok: true,
        output: {
          turn: game.getTurn(),
          moves: game.getLegalMovesFor(agentColor)
        }
      };
    }
  },
  inspect_square: {
    name: "inspect_square",
    description: "Inspect one board square and list attackers by color.",
    parameters: objectSchema({
      square: { type: "string", pattern: "^[a-h][1-8]$" }
    }, ["square"]),
    execute(args, { game, agentColor }) {
      const { square } = inspectSquareSchema.parse(args);
      const piece = game.getPiece(square);
      const legalOrigins = new Set(game.getLegalMovesFor(agentColor).map((move) => move.from));
      return {
        ok: true,
        output: {
          square,
          piece: piece ? { type: piece.type, color: piece.color === "w" ? "white" : "black" } : null,
          attacked_by_white: game.attackers(square, "white"),
          attacked_by_black: game.attackers(square, "black"),
          is_legal_origin_for_agent: legalOrigins.has(square)
        }
      };
    }
  },
  get_move_history: {
    name: "get_move_history",
    description: "Return recent move history and PGN so far.",
    parameters: objectSchema({
      limit: { type: "number", minimum: 1, maximum: 200, default: 20 }
    }),
    execute(args, { game }) {
      const { limit } = historySchema.parse(args);
      return {
        ok: true,
        output: {
          moves: toPairedHistory(game.getMoveHistory()).slice(-limit),
          pgn_so_far: game.getPgn()
        }
      };
    }
  },
  get_game_status: {
    name: "get_game_status",
    description: "Return active/completed state, turn, checks, draw status, and result.",
    parameters: objectSchema({}),
    execute(args, { game }) {
      emptySchema.parse(args);
      const turn = game.getTurn();
      return {
        ok: true,
        output: {
          status: game.getStatus(),
          turn,
          white_in_check: turn === "white" && game.isCheck(),
          black_in_check: turn === "black" && game.isCheck(),
          checkmate: game.getEndReason()?.includes("checkmated") ?? false,
          stalemate: game.getEndReason() === "stalemate",
          draw_reason: game.getResult() === "1/2-1/2" ? game.getEndReason() : null,
          can_claim_draw: false,
          result: game.getResult()
        }
      };
    }
  },
  make_move: {
    name: "make_move",
    description: "Submit one legal move in UCI notation, with an optional one-sentence public explanation.",
    parameters: objectSchema({
      move: { type: "string", pattern: "^[a-h][1-8][a-h][1-8][qrbn]?$" },
      explanation: { type: "string" }
    }, ["move"]),
    execute(args, { game, agentColor }) {
      const { move, explanation } = moveSchema.parse(args);
      if (game.getTurn() !== agentColor) {
        return {
          ok: false,
          invalid: true,
          finalAction: false,
          output: {
            accepted: false,
            error: `It is ${game.getTurn()}'s turn, not ${agentColor}'s turn.`
          }
        };
      }
      const result = game.makeMove(move, "llm", explanation);
      if (!result.ok) {
        return {
          ok: false,
          invalid: true,
          output: {
            accepted: false,
            error: result.error,
            legal_moves_hint: result.legalMovesHint
          }
        };
      }
      return {
        ok: true,
        finalAction: true,
        explanation,
        output: {
          accepted: true,
          uci: result.move.uci,
          san: result.move.san,
          fen_after: result.move.fenAfter,
          game_over: game.isGameOver(),
          result: game.getResult() === "*" ? null : game.getResult()
        }
      };
    }
  },
  resign: {
    name: "resign",
    description: "Resign the game with a short public explanation.",
    parameters: objectSchema({
      explanation: { type: "string" }
    }),
    execute(args, { game, agentColor }) {
      const { explanation } = resignSchema.parse(args);
      const result = game.resign(agentColor, explanation || `${agentColor} resigned`);
      return {
        ok: true,
        finalAction: true,
        explanation,
        output: {
          accepted: true,
          result: result.result,
          reason: result.reason
        }
      };
    }
  },
  offer_draw: {
    name: "offer_draw",
    description: "Offer a draw with a short public explanation.",
    parameters: objectSchema({
      explanation: { type: "string" }
    }),
    execute(args, { game, agentColor }) {
      const { explanation } = offerDrawSchema.parse(args);
      game.offerDraw(agentColor, explanation);
      return {
        ok: true,
        explanation,
        output: {
          accepted: true,
          draw_offer_pending: true
        }
      };
    }
  },
  respond_to_draw_offer: {
    name: "respond_to_draw_offer",
    description: "Accept or decline a pending draw offer.",
    parameters: objectSchema({
      response: { type: "string", enum: ["accept", "decline"] },
      explanation: { type: "string" }
    }, ["response"]),
    execute(args, { game, agentColor }) {
      const { response, explanation } = respondDrawSchema.parse(args);
      const result = game.respondToDrawOffer(agentColor, response, explanation);
      return {
        ok: result.accepted,
        finalAction: response === "accept" && result.gameOver,
        explanation,
        output: {
          accepted: result.accepted,
          draw_offer_pending: game.getDrawOffer() !== null,
          game_over: result.gameOver
        }
      };
    }
  }
};

export function getToolDefinitions(agent: AgentConfig): ChatTool[] {
  return agent.tools
    .filter((name) => tools[name])
    .map((name) => {
      const tool = tools[name];
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      };
    });
}

export function executeTool(name: string, args: unknown, context: ToolContext): ToolExecution {
  if (!context.agent.tools.includes(name)) {
    return {
      ok: false,
      invalid: true,
      output: {
        accepted: false,
        error: `Tool '${name}' is not enabled for this agent.`
      }
    };
  }
  const tool = tools[name];
  if (!tool) {
    return {
      ok: false,
      invalid: true,
      output: {
        accepted: false,
        error: `Unknown tool '${name}'.`
      }
    };
  }
  try {
    return tool.execute(args, context);
  } catch (error) {
    return {
      ok: false,
      invalid: true,
      output: {
        accepted: false,
        error: error instanceof Error ? error.message : "Tool arguments failed validation."
      }
    };
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function toPairedHistory(history: ReturnType<ChessGame["getMoveHistory"]>) {
  const pairs: Array<{
    move_number: number;
    white?: { uci: string; san: string };
    black?: { uci: string; san: string };
  }> = [];
  for (const move of history) {
    let pair = pairs.find((item) => item.move_number === move.moveNumber);
    if (!pair) {
      pair = { move_number: move.moveNumber };
      pairs.push(pair);
    }
    pair[move.color] = { uci: move.uci, san: move.san };
  }
  return pairs;
}
