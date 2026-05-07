# Chess Agent Arena

**A local chess playground for watching LLM models play, fail, recover, and occasionally surprise you.**

Chess Agent Arena started from a simple question:

> What if the game itself included the agent harness?

Instead of building a separate evaluation script, this project puts the model loop inside a playable browser chess game. You can play against a model, let two models challenge each other, watch the board update live, and inspect what happened afterward. Chess is the first game because the rules are strict, the state is compact, and illegal moves are easy to catch.

This is a fun exploration project, not a polished rating authority. The bigger idea is a local arena where games can become testbeds for agent behavior.

![Chess Agent Arena game screen](docs/assets/chess-agent-arena-game.png)

## What It Does Today

- Play **Human vs Model** from the browser.
- Run **Model vs Model** matches and watch them live.
- Use OpenRouter to try many models, including free models when available.
- Paste and save your OpenRouter key locally.
- Pick a model from the browser list or type any model ID manually.
- Highlight legal moves when you select a piece.
- Validate every move with `chess.js`, so the model cannot invent the board.
- Export PGN/FEN and keep replay, metrics, event, and model-call logs locally.
- Browse saved results without treating failed or incomplete runs as real final scores.

## Why Chess?

Chess is a nice first arena because it is unforgiving in useful ways:

- The model has to act on real state.
- A move is legal or it is not.
- Games can be replayed.
- Different models can face the same position.
- Provider errors, slow thinking, malformed replies, and bad moves are all visible.

That makes it a good playground for comparing models without pretending this is a formal benchmark.

## The Fun Part

The game is not just a UI around an LLM call. The app owns the match loop:

- Current board state
- Legal move validation
- Turn handling
- Model requests
- Invalid move handling
- Live updates
- Replay and artifacts
- Result tracking

That is the part I want to keep exploring. Chess is the first version, but the same idea could grow into other games where agents have to understand rules, make decisions, and live with the consequences.

## Quickstart

Requirements:

- Node.js 22+
- npm
- OpenRouter API key for model matches

```bash
git clone <repo-url>
cd chess-agent-arena
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Then:

1. Open **Configure Match**.
2. Paste your OpenRouter key and click **Save**.
3. Click **Test model**.
4. Choose **Human vs Model** or **Model vs Model**.
5. Pick models or enter a model ID manually.
6. Start the match.

If port `3000` is busy:

```bash
npx tsx src/cli/index.ts dev --config configs/local.match.yaml --port 3001
```

## OpenRouter

OpenRouter is the default path because it makes it easy to try a wide mix of models from one place.

The browser setup panel can:

- Save and clear your local key.
- Refresh models from OpenRouter.
- Prefer free models.
- Search models.
- Select a listed model.
- Accept a manual model ID.
- Send a quick test request.

The saved key lives in:

```text
.chess-agent-arena.secrets.json
```

That file is ignored by git. You can also use `.env`:

```bash
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Free models can be rate-limited. When that happens, the backend logs the provider error and the Results page marks the run as an issue instead of pretending the game ended normally.

## Model Arena

The most interesting mode is letting models play each other.

Example experiments:

- Same model, different prompts.
- Fast model vs stronger model.
- Free model vs free model.
- Manual model ID vs OpenRouter-listed model.
- Same opening position, different providers.

Future idea: add match clocks or thinking-time limits so a model cannot spend forever on one move. That would make the arena feel more like a game and make latency part of the challenge.

## Results

Every run writes local artifacts under:

```text
runs/<match_id>/
```

Typical files:

- `game.pgn`
- `final.fen`
- `replay.json`
- `metrics.json`
- `events.jsonl`
- `model_calls.jsonl`
- `summary.md`
- `config.resolved.yaml`

The Results page is meant to stay honest:

- Completed games show final chess scores.
- Failed runs show the actual issue.
- Incomplete runs are not scored as final games.
- Model matchups are grouped for easier comparison.

## Useful Commands

```bash
npm run dev          # start the local browser app
npm run validate     # validate the default config
npm test             # run tests
npm run typecheck    # run TypeScript checks
npm run build        # build server and web app
```

Export PGN from a saved run:

```bash
npx tsx src/cli/index.ts export-pgn runs/<match_id>
```

## Project Shape

```text
src/
  chess/       chess.js wrapper and legal move enforcement
  runtime/     match loop and model-turn lifecycle
  model/       OpenRouter/OpenAI-compatible client
  logging/     events, metrics, PGN, replay, summaries
  server/      Express + Vite local server
  web/         React chess UI and results dashboard
  tests/       engine, runtime, provider, and UI behavior tests
```

Configs, model profiles, and prompts live in:

```text
configs/
agents/
prompts/
```

Most setup can happen from the browser. The files are useful when you want repeatable experiments.

## Privacy

- `.env` is ignored.
- `.chess-agent-arena.secrets.json` is ignored.
- Raw keys are redacted from provider errors.
- Run logs include model IDs, moves, usage, latency, and errors, but not raw API keys.

Before publishing your fork:

```bash
git status --short --ignored=matching
rg -n "sk-or-v1-[[:alnum:]]+" -g "!node_modules" -g "!dist" -g "!dist-web" -g "!runs" .
```

If a real key was ever pasted into chat, an issue, or a commit, rotate it.

## Current Status

Working now:

- Browser match setup
- Human vs Model
- Model vs Model
- OpenRouter key save/test flow
- Free model filtering and manual model IDs
- Legal move highlighting
- Legal chess enforcement
- Live board updates
- PGN/FEN export
- Local run artifacts
- Results page

Not built yet:

- Public multiplayer
- Accounts
- Cloud sync
- Built-in Stockfish analysis
- Match clocks or per-move time limits
- Larger game arena beyond chess

## Where This Could Go

- Time-limited model matches.
- Saved experiment presets.
- Better replay viewer.
- Aggregate model comparison stats.
- Prompt comparison reports.
- Optional post-game chess analysis.
- More games using the same agent-harness idea.

## Development

Run checks before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

Contributions are welcome, especially around model reliability, replay UX, results, provider support, and making the arena more fun to experiment with.
