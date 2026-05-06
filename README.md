# Chess Agent Arena

Local-first chess arena for humans, bots, and configurable LLM agents.

The app runs a browser chessboard backed by an authoritative `chess.js` rules engine. Humans can play locally, bots can play automatically, and LLM agents can play only through structured chess tools. OpenRouter is the default hosted provider path because it exposes many models through an OpenAI-compatible API.

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

The default config is Human vs OpenRouter Agent. Add an OpenRouter key in the browser before expecting the model side to move.

## OpenRouter Setup

You can paste the key directly in the browser from **Configure Match → OpenRouter**. The key is saved to `.chess-agent-arena.secrets.json`, which is gitignored, and is reloaded on the next server start. The raw key is not written to run logs.

You can also add an API key to `.env`:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Then run:

```bash
npx tsx src/cli/index.ts dev --config configs/human-vs-agent.yaml
```

Agent files live in `agents/`, and prompts live in `prompts/`. The default OpenRouter agent uses:

```yaml
model:
  provider: openrouter
  model_name: openai/gpt-4o-mini
  base_url: ${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}
  api_key_env: OPENROUTER_API_KEY
  tool_mode: native
```

From the browser you can refresh OpenRouter’s model list, prefer free models, search models, select a model for either side, or type a model id manually. The model list is loaded from OpenRouter’s Models API and includes free/tool-support tags.

Use **Test model** in the OpenRouter setup panel before starting an LLM match. The backend terminal also prints `[openrouter]`, `[model]`, `[agent]`, `[tool]`, and `[move]` logs so provider failures and tool-call behavior are visible.

Change `model_name` in YAML to any OpenRouter model that supports the behavior you want to test. If native tool calling is unreliable for a model, set `tool_mode: json`.

## Commands

```bash
npm run dev
npm run validate
npm test
npm run build
```

Direct CLI examples:

```bash
npx tsx src/cli/index.ts dev --config configs/local.match.yaml
npx tsx src/cli/index.ts run --config configs/agent-vs-agent.yaml
npx tsx src/cli/index.ts validate --config configs/human-vs-agent.yaml
npx tsx src/cli/index.ts export-pgn runs/local_chess_test_001
```

## What Works

- Human vs Model and Model vs Model match setup in the browser. Bot players remain available for smoke tests and internal baselines through config files.
- Drag-and-drop and click-to-move board input.
- Clear selected-piece legal move highlighting, last move highlighting, check highlighting, board flip, promotion picker, move history, replay controls, PGN/FEN export, and results page.
- Random and heuristic bot players.
- LLM tools: `get_board_state`, `get_legal_moves`, `inspect_square`, `get_move_history`, `get_game_status`, `make_move`, `resign`, `offer_draw`, and `respond_to_draw_offer`.
- OpenAI-compatible chat completions with native tool calls or strict JSON action fallback.
- Run outputs in `runs/<match_id>/`: `config.resolved.yaml`, `events.jsonl`, `model_calls.jsonl`, `game.pgn`, `final.fen`, `replay.json`, `summary.md`, and `metrics.json`.

## Configuration

Match files live in `configs/`.

```yaml
players:
  white:
    type: human
    name: Human Player

  black:
    type: llm
    name: OpenRouter Chess Agent
    agent_config: agents/openrouter_chess_agent.yaml
```

Bot players are supported by config for cheap local smoke tests, but they are not the main browser workflow:

```yaml
type: bot
bot: heuristic
```

Supported bots are `random` and `heuristic`.

## Tool Tiers

Agents list their enabled tools explicitly. The default agent uses tier 1:

```yaml
tools:
  - get_board_state
  - get_legal_moves
  - get_move_history
  - get_game_status
  - make_move
  - resign
  - offer_draw
```

Disabled tools are rejected at runtime. Engine assistance tools are intentionally not enabled in this MVP.

## Local Models

Use any OpenAI-compatible local endpoint by changing the agent config:

```yaml
model:
  provider: openai_compatible
  model_name: local-model-name
  base_url: ${LOCAL_OPENAI_BASE_URL}
  api_key_env: OPENAI_API_KEY
  tool_mode: json
```

For local servers that do not require a real key, set a placeholder value in `.env`.

## Notes

- API keys are loaded from environment variables and are not written into run logs.
- The chess engine owns all rules and state. Agents can only observe and act through validated tools.
- Stockfish analysis is not implemented yet; the app works without Stockfish.
