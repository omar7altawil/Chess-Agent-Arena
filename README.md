# Chess Agent Arena

**A local-first chess arena for testing LLM models in real chess matches.**

Chess Agent Arena lets you run **Human vs Model** and **Model vs Model** chess matches from your browser. It uses OpenRouter for broad model access, keeps chess rules authoritative with `chess.js`, saves results locally, and gives you a clean place to compare model legality, latency, failures, and outcomes.

![Chess Agent Arena game screen](docs/assets/chess-agent-arena-game.png)

## Why It Exists

LLMs can sound confident while losing track of structured state. Chess makes that failure mode obvious: every move is either legal or illegal, every position can be replayed, and every model faces the same board.

This project is built for:

- Comparing OpenRouter models on the same chess positions.
- Playing against an LLM from a normal browser chess board.
- Watching two models play each other live.
- Tracking completed games separately from provider errors and incomplete runs.
- Keeping all keys, logs, PGN files, FEN snapshots, and metrics on your machine.

It is not a hosted chess server, public leaderboard, or account-based SaaS.

## Features

- **Browser match setup** for Human vs Model and Model vs Model.
- **OpenRouter model picker** with free-model filtering, search, manual model IDs, and model test requests.
- **Local key storage** through `.chess-agent-arena.secrets.json` or `.env`.
- **Legal move highlighting** when you select a piece on the board.
- **Authoritative chess validation** through `chess.js`; models never own board state.
- **Live match view** with turn, move count, captured pieces, move history, model activity, and replay controls.
- **PGN and FEN export** from the browser.
- **Results dashboard** for completed games, failed runs, model matchups, usage, and saved artifacts.
- **Local run folders** with PGN, replay JSON, metrics JSON, event logs, and model-call logs.
- **Redacted secrets** in backend errors and logs.

## Quickstart

Requirements:

- Node.js 22+
- npm
- An OpenRouter API key for model matches

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

In the app:

1. Open **Configure Match**.
2. Paste your OpenRouter key and click **Save**.
3. Click **Test model** for the selected model.
4. Choose **Human vs Model** or **Model vs Model**.
5. Pick models from the list or enter a manual OpenRouter model ID.
6. Start the match.

The browser setup is the intended path for normal use. You do not need to edit YAML files just to play or compare models.

## OpenRouter Setup

The app can save your key locally:

```text
.chess-agent-arena.secrets.json
```

That file is ignored by git. You can clear the key from the browser setup panel.

You can also use `.env`:

```bash
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

The OpenRouter panel supports:

- Saving and clearing the local key.
- Refreshing the available model list.
- Showing free models first.
- Searching models.
- Selecting a listed model.
- Entering a manual model ID.
- Sending a test request before starting a match.

Free OpenRouter models may be rate-limited by their upstream providers. When that happens, the backend logs the provider status and the Results page marks the run as an issue instead of treating it like a completed chess result.

## Running The App

```bash
npm run dev
```

If port `3000` is already in use:

```bash
npx tsx src/cli/index.ts dev --config configs/local.match.yaml --port 3001
```

Then open:

```text
http://localhost:3001
```

Useful checks:

```bash
npm run validate
npm test
npm run typecheck
npm run build
```

Export a saved game's PGN:

```bash
npx tsx src/cli/index.ts export-pgn runs/<match_id>
```

## What You Can Test

### Human vs Model

Play against an LLM model and inspect how it behaves move by move.

Useful questions:

- Does the model make legal moves under tactical pressure?
- Does it recover cleanly after a rejected move attempt?
- How long does it take per move?
- Are its short public explanations useful?

### Model vs Model

Run two models against each other with the same starting position.

Useful questions:

- Which model completes more games without invalid move attempts?
- Which model has lower latency?
- How often does a model lose because of provider errors or malformed output?
- Which prompts produce cleaner, more stable play?

## Safe Move Validation

The core rule is simple:

**Models suggest moves. The chess engine decides whether those moves are legal.**

The runtime gives the active model the current game context, asks it for a move, validates the move with `chess.js`, then updates the board only after validation passes. Invalid move attempts are logged, surfaced in the UI, and can end a run if the model repeatedly fails.

This keeps model evaluation honest: a model cannot invent board state, move the wrong color, skip a turn, or bypass chess rules.

## Results And Artifacts

Every match writes a local run folder:

```text
runs/<match_id>/
```

Typical files:

- `config.resolved.yaml`
- `events.jsonl`
- `model_calls.jsonl`
- `game.pgn`
- `final.fen`
- `replay.json`
- `summary.md`
- `metrics.json`

The Results page is built for model evaluation:

- Completed games show final chess scores.
- Failed runs show the provider/runtime issue instead of a fake score.
- Incomplete runs are not scored as final games.
- Model matchups are grouped so you can compare outcomes across runs.
- PGN, replay, and metrics are available from saved artifacts.

## Project Structure

```text
src/
  chess/       chess.js wrapper and legal move enforcement
  runtime/     match runner and model-turn lifecycle
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

Most users can configure matches from the browser. The files are there for repeatable experiments and development.

## Privacy And Safety

- API keys are not committed by default.
- `.env` is ignored.
- `.chess-agent-arena.secrets.json` is ignored.
- Raw keys are redacted from provider error messages.
- Run logs contain model IDs, move attempts, usage, latency, and errors, but not raw API keys.

Before publishing your fork:

```bash
git status --short --ignored=matching
rg -n "sk-or-v1-[[:alnum:]]+" -g "!node_modules" -g "!dist" -g "!dist-web" -g "!runs" .
```

If a real key was ever pasted into chat, an issue, or a commit, rotate it.

## Current Status

The MVP currently supports:

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
- Model-focused Results page

Known limitations:

- No public multiplayer.
- No accounts.
- No cloud sync.
- No built-in Stockfish analysis yet.
- Free OpenRouter models may be rate-limited upstream.

## Roadmap

- Better model retry policies and fallback chains.
- Saved experiment presets.
- Replay viewer improvements from the Results page.
- Aggregate model comparison stats.
- Optional post-game Stockfish analysis.
- Prompt comparison reports.
- Shareable static replay export.

## Development

Run checks before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

Chess Agent Arena is intentionally local-first and small enough to hack on. Contributions that improve model reliability, experiment reporting, replay UX, or provider support are welcome.
