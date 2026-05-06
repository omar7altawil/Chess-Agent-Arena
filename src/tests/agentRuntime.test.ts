import { describe, expect, it, vi } from "vitest";
import { MatchRunner } from "../runtime/matchRunner.js";
import type { AgentConfig, MatchConfig } from "../shared/types.js";

const agent: AgentConfig = {
  id: "mock_agent",
  name: "Mock Agent",
  type: "llm",
  model: {
    provider: "openrouter",
    model_name: "mock/model",
    base_url: "https://openrouter.ai/api/v1",
    api_key_env: "OPENROUTER_API_KEY",
    temperature: 0.1,
    max_output_tokens: 400,
    timeout_seconds: 10,
    tool_mode: "native"
  },
  prompt: {
    system_prompt_file: "",
    system_prompt: "Play a legal chess move."
  },
  behavior: {
    tool_tier: "tier_1",
    max_tool_calls_per_turn: 3,
    max_invalid_actions_per_turn: 1,
    require_make_move: true,
    allow_resign: true,
    allow_draw_offer: true
  },
  memory: {
    mode: "none",
    max_summary_chars: 1000
  },
  tools: ["get_legal_moves", "make_move", "resign"]
};

const config: MatchConfig = {
  match: {
    id: "mock_agent_runtime",
    output_dir: "runs/test_mock_agent_runtime",
    max_plies: 10,
    auto_start: true
  },
  ui: {
    board_theme: "classic",
    piece_set: "standard",
    animation_ms: 0,
    show_legal_moves: true,
    show_last_move: true,
    show_coordinates: true,
    enable_sound: false
  },
  chess: {
    starting_position: "standard",
    starting_fen: null,
    rules: {
      threefold_repetition: true,
      fifty_move_rule: true,
      insufficient_material: true
    },
    clocks: {
      enabled: false,
      initial_seconds: 600,
      increment_seconds: 0
    }
  },
  players: {
    white: {
      type: "llm",
      name: "Mock Agent",
      agent
    },
    black: {
      type: "bot",
      name: "Random Bot",
      bot: "random"
    }
  }
};

describe("agent runtime", () => {
  it("applies a model tool-call move", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "make_move",
                  arguments: JSON.stringify({
                    move: "e2e4",
                    explanation: "I claim central space."
                  })
                }
              }
            ]
          },
          finish_reason: "tool_calls"
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const runner = new MatchRunner(config);
    await runner.init();
    await runner.runToCompletion();

    expect(runner.game.getMoveHistory()[0].uci).toBe("e2e4");
    expect(runner.game.getMoveHistory()[0].actor).toBe("llm");
    vi.unstubAllGlobals();
  });
});
