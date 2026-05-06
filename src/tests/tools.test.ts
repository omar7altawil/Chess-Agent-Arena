import { describe, expect, it } from "vitest";
import { ChessGame } from "../chess/engine.js";
import { executeTool, getToolDefinitions } from "../tools/registry.js";
import type { AgentConfig } from "../shared/types.js";

const agent: AgentConfig = {
  id: "test",
  name: "Test Agent",
  type: "llm",
  model: {
    provider: "openrouter",
    model_name: "test/model",
    base_url: "https://openrouter.ai/api/v1",
    api_key_env: "OPENROUTER_API_KEY",
    temperature: 0.2,
    max_output_tokens: 400,
    timeout_seconds: 10,
    tool_mode: "native"
  },
  prompt: {
    system_prompt_file: "",
    system_prompt: "Test."
  },
  behavior: {
    tool_tier: "tier_1",
    max_tool_calls_per_turn: 5,
    max_invalid_actions_per_turn: 2,
    require_make_move: true,
    allow_resign: true,
    allow_draw_offer: true
  },
  memory: {
    mode: "none",
    max_summary_chars: 1000
  },
  tools: ["get_board_state", "get_legal_moves", "make_move", "resign"]
};

describe("tool registry", () => {
  it("exposes enabled tool definitions", () => {
    expect(getToolDefinitions(agent).map((tool) => tool.function.name)).toEqual([
      "get_board_state",
      "get_legal_moves",
      "make_move",
      "resign"
    ]);
  });

  it("applies valid moves through make_move", () => {
    const game = new ChessGame();
    const result = executeTool("make_move", { move: "e2e4", explanation: "Claim the center." }, { game, agentColor: "white", agent });
    expect(result.ok).toBe(true);
    expect(result.finalAction).toBe(true);
    expect(game.getLastMove()?.uci).toBe("e2e4");
  });

  it("rejects disabled tools and illegal moves", () => {
    const game = new ChessGame();
    const disabled = executeTool("inspect_square", { square: "e4" }, { game, agentColor: "white", agent });
    expect(disabled.ok).toBe(false);
    expect(disabled.invalid).toBe(true);

    const illegal = executeTool("make_move", { move: "e2e5" }, { game, agentColor: "white", agent });
    expect(illegal.ok).toBe(false);
    expect(illegal.invalid).toBe(true);
    expect(illegal.output.accepted).toBe(false);
  });
});
