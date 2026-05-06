# PRD: Chess Agent Arena — Local LLM Chess Game

**Project name:** Chess Agent Arena
**Product type:** Local-first 2D chess game with LLM-agent players
**Scope:** Initial chess game only, not the full multi-game platform
**Primary use case:** A user runs the chess game locally, configures one or more LLM agents, and plays Human vs Agent or watches Agent vs Agent matches on a polished 2D animated chessboard.

---

## 1. Product Summary

Chess Agent Arena is a local-first chess game where LLM agents play chess through structured tools. The game should feel like a modern browser chess app: a clean 2D board, smooth piece animations, drag-and-drop moves, legal-move highlighting, captured pieces, move history, clocks, resign/draw controls, and full-game replay.

The initial goal is not to build a public website, leaderboard, or generic platform. The goal is to build one robust local chess game where a user can configure agents, prompts, models, tool access, and run matches on their own machine.

The LLM agent should not be trusted to enforce chess rules or remember the board. The chess engine must be authoritative. Agents should only observe and act through allowed tools.

---

## 2. Core Concept

The user should be able to run a local app:

```bash
chess-agent-arena dev --config configs/local.match.yaml
```

Then open:

```text
http://localhost:3000
```

From the browser, the user can:

* Start a new chess game.
* Choose Human vs Agent, Agent vs Agent, Human vs Human, or Agent vs Bot.
* Configure agent model, prompt, tool access, and settings.
* Play on a 2D animated chessboard.
* Watch agent moves happen live.
* See move history and public agent explanations.
* Export the game as PGN, FEN snapshots, and JSON replay.

---

## 3. Product Goals

### 3.1 MVP Goals

1. Build a complete local web chess game.
2. Provide a polished 2D board with smooth animations.
3. Enforce all legal chess moves in code.
4. Support Human vs LLM Agent.
5. Support LLM Agent vs LLM Agent.
6. Support Human vs Human for testing.
7. Support Agent vs simple bot.
8. Allow users to configure agents using YAML or JSON files.
9. Allow users to use their own API keys through environment variables.
10. Support OpenAI-compatible chat/tool-calling APIs first.
11. Support local OpenAI-compatible endpoints when possible.
12. Provide structured chess tools for agents.
13. Log every move, tool call, model response summary, error, and game result.
14. Export PGN, final FEN, event JSONL, replay JSON, and match summary.
15. Provide optional Stockfish analysis/evaluation as a separate tool tier, not enabled by default.
16. Keep the architecture small enough to extend later.

### 3.2 Non-Goals

The initial version should not include:

1. User accounts.
2. Public online multiplayer.
3. Cloud-hosted SaaS.
4. Public leaderboard.
5. Payments.
6. Social features.
7. Puzzle training mode.
8. Opening database.
9. Complex tournament bracket system.
10. Multi-game framework.
11. Arbitrary user-created games.
12. Mobile native app.
13. Anti-cheat for public competitive play.
14. Real-money wagering.

---

## 4. Target User

The initial user is a technical person who wants to experiment with LLM agents in chess.

Examples:

* AI developer testing tool-using agents.
* Prompt engineer comparing chess prompts.
* Researcher studying legality, state tracking, and planning.
* Hobbyist watching models play chess.
* Builder testing local models against hosted models.

The user is comfortable with:

* Running a local dev server.
* Editing YAML or JSON config files.
* Providing API keys through `.env`.
* Reading logs and exported files.

---

## 5. Game Modes

### 5.1 Required MVP Modes

#### Mode 1: Human vs Agent

A human plays on the 2D board against an LLM agent.

Requirements:

* Human moves by drag-and-drop or click-square/click-square.
* Agent moves automatically after its turn begins.
* Board updates with animation.
* Move history updates after each move.
* Game ends normally on checkmate, stalemate, draw, resignation, or timeout if clocks are enabled.

#### Mode 2: Agent vs Agent

Two configured LLM agents play each other.

Requirements:

* User can watch moves live.
* User can pause/resume the match.
* User can step through moves after completion.
* Each agent may have different model, prompt, tools, and temperature.

#### Mode 3: Human vs Human

Local human vs human on same browser.

Purpose:

* Debugging board UI.
* Testing chess engine.
* Verifying move legality.

#### Mode 4: Agent vs Bot

LLM agent plays against a non-LLM bot.

Required bots:

* Random legal move bot.
* Simple heuristic bot.

Purpose:

* Cheap testing without two model calls.
* Baseline comparison.

### 5.2 Optional Later Modes

* Headless CLI Agent vs Agent.
* Batch experiments.
* Local tournament mode.
* Position challenge mode.
* Human vs Agent from custom FEN.

---

## 6. Chess Rules and Gameplay Requirements

### 6.1 Rules Engine

The chess rules engine must be authoritative.

It must support:

* Standard starting position.
* Legal moves for all pieces.
* Check.
* Checkmate.
* Stalemate.
* Castling kingside and queenside.
* En passant.
* Pawn promotion.
* Draw by insufficient material.
* Draw by threefold repetition if enabled.
* Draw by fifty-move rule if enabled.
* Resignation.
* Draw offer / draw acceptance.
* Game clocks if enabled.

### 6.2 Board Coordinates

The system should use standard algebraic coordinates:

```text
a1, b1, c1 ... h8
```

The UI should display board coordinates around the board.

### 6.3 Move Formats

The system should support and store:

* UCI move format, such as `e2e4`, `e7e8q`.
* SAN notation, such as `e4`, `Nf3`, `O-O`, `Qxe7#`.
* FEN for board state.
* PGN for game export.

Internal engine actions should prefer UCI because it is unambiguous.

### 6.4 Promotion

For human players:

* Show a promotion picker when a pawn reaches the last rank.
* Options: queen, rook, bishop, knight.

For agents:

* `make_move` must require promotion piece when needed.
* If the agent omits promotion, the runtime should return a validation error.

Example UCI promotion:

```text
e7e8q
```

### 6.5 Castling

Castling should be handled by the rules engine. The UI should animate both king and rook.

### 6.6 En Passant

En passant should be handled by the rules engine. The UI should animate the capturing pawn and remove the captured pawn.

### 6.7 Game End Conditions

The game should detect and display:

* White wins by checkmate.
* Black wins by checkmate.
* White wins by resignation.
* Black wins by resignation.
* Draw by stalemate.
* Draw by insufficient material.
* Draw by threefold repetition.
* Draw by fifty-move rule.
* Draw by agreement.
* Win/loss by timeout if clocks are enabled.
* Agent loses by repeated invalid action failure if configured.

---

## 7. 2D Chess UI Requirements

The UI should be modern, clean, animated, and familiar to users of online chess boards. It should not copy any proprietary brand, assets, layout, or trademarked design, but it should match the expected quality of a modern 2D chess experience.

### 7.1 Required Board Features

1. 8x8 2D chessboard.
2. Light and dark squares.
3. Coordinates on board edges.
4. White orientation by default.
5. Flip board button.
6. Drag-and-drop piece movement.
7. Click source square then destination square movement.
8. Legal destination highlights after selecting a piece.
9. Last move highlight.
10. Check highlight on king.
11. Premove is not required for MVP.
12. Arrows/drawing tools are not required for MVP.

### 7.2 Piece Animation

Required animations:

* Smooth move animation from source to target.
* Capture animation.
* Castling animation for king and rook.
* Promotion replacement animation.
* Checkmate/game-end modal animation.

Animation should be fast and not block gameplay.

Recommended duration:

```text
150ms to 250ms per move
```

### 7.3 Board Interaction

Human move flow:

1. User selects or drags a piece.
2. UI highlights legal moves.
3. User drops or clicks target square.
4. UI sends move request to game engine.
5. Engine validates.
6. If valid, UI animates move.
7. If invalid, piece snaps back.

### 7.4 Side Panel

The side panel should show:

* Player names.
* Player type: Human, Agent, Bot.
* Clock if enabled.
* Captured pieces or material difference.
* Move history in SAN.
* Current turn.
* Game status.
* Agent public explanation for latest move.
* Agent thinking/loading indicator.
* Buttons: resign, offer draw, new game, export PGN, flip board.

### 7.5 Agent Activity Panel

For LLM matches, show a collapsible panel with:

* Agent currently thinking.
* Tool calls used this turn.
* Tool-call count remaining.
* Latest public explanation.
* Invalid action warnings.

Do not show private chain-of-thought. Only show public explanation and structured tool-call summaries.

### 7.6 Replay Controls

After a game completes, the user should be able to:

* Go to start.
* Step backward one move.
* Step forward one move.
* Go to end.
* Use keyboard arrows.
* Copy FEN at current move.
* Export PGN.

---

## 8. Agent Concept

An agent is an LLM-controlled chess player.

Each agent has:

* Name.
* Color assignment for a match.
* Model provider.
* Model name.
* System prompt.
* Temperature.
* Tool list.
* Tool-call budget.
* Memory mode.
* Optional Stockfish access.
* Invalid action policy.

The agent should not directly move pieces by producing free text. It must call tools or return a valid structured action.

---

## 9. Chess Tools for LLM Agents

Tools are the only way an LLM agent can inspect or act in the game.

### 9.1 Tool Design Principles

1. Tools should be typed and schema-validated.
2. Tools should expose only legal information.
3. Tools should never expose hidden chain-of-thought.
4. Tools should never let the agent bypass the chess engine.
5. Tools should be logged.
6. Tools should be configurable per agent.
7. Strong tools such as engine evaluation must be separated into tool tiers.

---

## 10. Required MVP Tools

### 10.1 Tool: `get_board_state`

Returns the current board state.

#### Input

```json
{}
```

#### Output

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "turn": "black",
  "move_number": 1,
  "check": false,
  "legal_move_count": 20,
  "last_move": "e2e4"
}
```

### 10.2 Tool: `get_legal_moves`

Returns all legal moves for the agent’s side.

#### Input

```json
{
  "notation": "uci"
}
```

#### Output

```json
{
  "turn": "black",
  "moves": [
    {
      "uci": "e7e5",
      "san": "e5",
      "from": "e7",
      "to": "e5",
      "piece": "pawn",
      "capture": false,
      "promotion": null,
      "check": false,
      "checkmate": false
    }
  ]
}
```

### 10.3 Tool: `inspect_square`

Returns information about one square.

#### Input

```json
{
  "square": "e4"
}
```

#### Output

```json
{
  "square": "e4",
  "piece": {
    "type": "pawn",
    "color": "white"
  },
  "attacked_by_white": ["d3", "f3"],
  "attacked_by_black": [],
  "is_legal_origin_for_agent": false
}
```

### 10.4 Tool: `get_move_history`

Returns move history.

#### Input

```json
{
  "limit": 20
}
```

#### Output

```json
{
  "moves": [
    {
      "move_number": 1,
      "white": { "uci": "e2e4", "san": "e4" },
      "black": { "uci": "e7e5", "san": "e5" }
    }
  ],
  "pgn_so_far": "1. e4 e5"
}
```

### 10.5 Tool: `get_game_status`

Returns status of the game.

#### Input

```json
{}
```

#### Output

```json
{
  "status": "active",
  "turn": "white",
  "white_in_check": false,
  "black_in_check": false,
  "checkmate": false,
  "stalemate": false,
  "draw_reason": null,
  "can_claim_draw": false
}
```

### 10.6 Tool: `make_move`

The main action tool. The agent submits a legal move.

#### Input

```json
{
  "move": "g1f3",
  "explanation": "I develop the knight toward the center and prepare kingside castling."
}
```

#### Output

```json
{
  "accepted": true,
  "uci": "g1f3",
  "san": "Nf3",
  "fen_after": "rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1",
  "game_over": false,
  "result": null
}
```

If invalid:

```json
{
  "accepted": false,
  "error": "Illegal move: g1g3 is not legal in the current position.",
  "legal_moves_hint": ["g1f3", "g1h3"]
}
```

### 10.7 Tool: `resign`

Allows an agent to resign.

#### Input

```json
{
  "explanation": "I am down decisive material and have no realistic counterplay."
}
```

#### Output

```json
{
  "accepted": true,
  "result": "0-1",
  "reason": "white resigned"
}
```

### 10.8 Tool: `offer_draw`

Allows an agent to offer a draw.

#### Input

```json
{
  "explanation": "The position appears equal and simplified."
}
```

#### Output

```json
{
  "accepted": true,
  "draw_offer_pending": true
}
```

For MVP, draw offers can be simple:

* Human can accept or decline.
* Bot can auto-decline unless configured.
* Agent can accept if `respond_to_draw_offer` is implemented.

### 10.9 Tool: `respond_to_draw_offer`

Optional but useful for Agent vs Agent.

#### Input

```json
{
  "response": "decline",
  "explanation": "I still have attacking chances."
}
```

#### Output

```json
{
  "accepted": true,
  "draw_offer_pending": false,
  "game_over": false
}
```

---

## 11. Optional Engine Tools

These tools are optional and must be disabled by default because they change the nature of the experiment. If enabled, the match must clearly mark the agent as engine-assisted.

### 11.1 Tool: `evaluate_position`

Uses Stockfish or another UCI engine to evaluate the current position.

#### Input

```json
{
  "depth": 8
}
```

#### Output

```json
{
  "evaluation": {
    "type": "centipawn",
    "value": 34,
    "perspective": "white"
  },
  "best_line": ["g1f3", "b8c6", "f1b5"]
}
```

### 11.2 Tool: `suggest_engine_moves`

Returns top engine moves.

#### Input

```json
{
  "depth": 8,
  "limit": 3
}
```

#### Output

```json
{
  "suggestions": [
    { "uci": "g1f3", "san": "Nf3", "score": 34 },
    { "uci": "d2d4", "san": "d4", "score": 20 }
  ]
}
```

### 11.3 Engine Tool Warning

If engine tools are enabled, the UI and logs must display:

```text
Engine assistance enabled for this agent.
```

Engine-assisted games should not be compared directly with non-engine games.

---

## 12. Tool Tiers

Tool tiers allow fair experiments.

### 12.1 Tier 0: Move Only

Tools:

* `make_move`
* `resign`

The prompt includes FEN and legal moves directly.

### 12.2 Tier 1: Basic Chess Tools

Tools:

* `get_board_state`
* `get_legal_moves`
* `get_move_history`
* `get_game_status`
* `make_move`
* `resign`
* `offer_draw`

Recommended default.

### 12.3 Tier 2: Inspection Tools

Tools:

* Tier 1 tools
* `inspect_square`

### 12.4 Tier 3: Engine Evaluation

Tools:

* Tier 2 tools
* `evaluate_position`

### 12.5 Tier 4: Engine Move Suggestions

Tools:

* Tier 3 tools
* `suggest_engine_moves`

Tier 4 is basically an engine-assisted agent. It should be used for experiments only, not for evaluating raw LLM chess ability.

---

## 13. Agent Configuration

### 13.1 Match Config File

Example: `configs/local.match.yaml`

```yaml
match:
  id: local_chess_test_001
  output_dir: runs/local_chess_test_001
  max_plies: 300
  auto_start: true

ui:
  board_theme: classic
  piece_set: standard
  animation_ms: 180
  show_legal_moves: true
  show_last_move: true
  show_coordinates: true
  enable_sound: false

chess:
  starting_position: standard
  starting_fen: null
  rules:
    threefold_repetition: true
    fifty_move_rule: true
    insufficient_material: true
  clocks:
    enabled: false
    initial_seconds: 600
    increment_seconds: 2

players:
  white:
    type: human
    name: Human Player

  black:
    type: llm
    name: Cautious Chess Agent
    agent_config: agents/cautious_chess_agent.yaml
```

### 13.2 Agent Config File

Example: `agents/cautious_chess_agent.yaml`

```yaml
id: cautious_chess_agent
name: Cautious Chess Agent
type: llm

model:
  provider: openai_compatible
  model_name: gpt-4.1-mini
  base_url: ${OPENAI_BASE_URL}
  api_key_env: OPENAI_API_KEY
  temperature: 0.2
  max_output_tokens: 1200
  timeout_seconds: 60

prompt:
  system_prompt_file: prompts/cautious_chess_agent.md

behavior:
  tool_tier: tier_1
  max_tool_calls_per_turn: 5
  max_invalid_actions_per_turn: 2
  require_make_move: true
  allow_resign: true
  allow_draw_offer: true

memory:
  mode: external_summary
  max_summary_chars: 3000

tools:
  - get_board_state
  - get_legal_moves
  - get_move_history
  - get_game_status
  - make_move
  - resign
  - offer_draw
```

### 13.3 Agent Prompt File

Example: `prompts/cautious_chess_agent.md`

```markdown
You are playing a legal game of chess as an LLM agent.

Your goal is to play strong, legal chess and avoid illegal moves.

Rules:
- You can only act through the available tools.
- The chess engine is authoritative.
- Do not invent board state.
- Always check legal moves before making a move if uncertain.
- Prefer safe development, king safety, central control, and avoiding material loss.
- If in check, respond legally to the check.
- Never output private chain-of-thought.
- When calling make_move, include a short public explanation in one sentence.

You should play carefully and legally.
```

---

## 14. Prompt Construction

For every LLM turn, the runtime should build a prompt with:

1. Agent system prompt.
2. Agent color.
3. Current FEN.
4. Current turn.
5. Legal move list or tool access instructions.
6. Move history summary.
7. Check/game status.
8. Clock information if enabled.
9. Memory summary if enabled.
10. Available tools.
11. Tool budget.
12. Requirement to call `make_move`, `resign`, or valid draw response.

### 14.1 Example Turn Context

```text
You are Black.
Current position FEN:
rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2

Move history:
1. e4 e5 2. Nf3

Game status:
- Active game
- You are not in check
- Legal moves available: 29

Tool calls remaining this turn: 5
You must make one legal move using make_move.
```

---

## 15. Model Provider Support

### 15.1 Required Provider Type

Support first:

```yaml
provider: openai_compatible
```

This should work with:

* Hosted OpenAI-compatible APIs.
* Local model servers that expose OpenAI-compatible APIs.
* LM Studio, Ollama, vLLM, or similar when configured with compatible endpoint behavior.

### 15.2 Tool Calling Modes

The system should support two modes.

#### Mode A: Native Tool Calling

Use the provider’s official tool/function-calling mechanism.

#### Mode B: JSON Action Mode

Fallback mode for models that do not support native tool calling.

The model must return strict JSON:

```json
{
  "tool": "make_move",
  "arguments": {
    "move": "g1f3",
    "explanation": "I develop the knight and support central control."
  }
}
```

The runtime must validate the JSON and reject malformed output.

### 15.3 Environment Variables

Example `.env`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
LOCAL_OPENAI_BASE_URL=http://localhost:11434/v1
STOCKFISH_PATH=/usr/local/bin/stockfish
```

Raw API keys must never be logged.

---

## 16. Local Application Requirements

### 16.1 Main Local Commands

#### Start the local web app

```bash
chess-agent-arena dev --config configs/local.match.yaml
```

#### Run a headless match

```bash
chess-agent-arena run --config configs/agent-vs-agent.yaml
```

#### Validate config

```bash
chess-agent-arena validate --config configs/local.match.yaml
```

#### Generate example files

```bash
chess-agent-arena init
```

#### Replay a saved game

```bash
chess-agent-arena replay runs/local_chess_test_001/replay.json
```

#### Export PGN

```bash
chess-agent-arena export-pgn runs/local_chess_test_001
```

### 16.2 Browser App Requirements

When the dev server starts, user should see:

* Board.
* Side panel.
* Match controls.
* Agent configuration summary.
* Start game button if auto-start disabled.

### 16.3 Headless Mode

Headless mode is useful for Agent vs Agent experiments.

It should:

* Run without browser.
* Print turn-by-turn logs.
* Save the same output files.
* Support random/heuristic bots.

---

## 17. Output Files

Each game should create a local run folder.

Example:

```text
runs/local_chess_test_001/
  config.resolved.yaml
  game.pgn
  final.fen
  events.jsonl
  replay.json
  summary.md
  metrics.json
  model_calls.jsonl
```

### 17.1 `config.resolved.yaml`

Stores full resolved match configuration.

Must not include raw API keys.

### 17.2 `game.pgn`

Standard PGN export.

Should include headers:

```text
[Event "Chess Agent Arena Local Match"]
[Site "Local"]
[Date "2026.05.06"]
[White "Human Player"]
[Black "Cautious Chess Agent"]
[Result "1-0"]
```

### 17.3 `final.fen`

Final board position.

### 17.4 `events.jsonl`

Append-only event log.

Example:

```json
{"ply":12,"player":"black","type":"move","uci":"g8f6","san":"Nf6","fen_after":"..."}
```

### 17.5 `replay.json`

Compact replay file for UI playback.

Should include:

* Initial FEN.
* Move list.
* SAN list.
* FEN after each ply.
* Captures.
* Checks/checkmates.
* Agent explanations.
* Game result.

### 17.6 `summary.md`

Human-readable summary.

Should include:

* Players.
* Agent configs.
* Tool tiers.
* Final result.
* Move list.
* Key events.
* Metrics.

### 17.7 `metrics.json`

Machine-readable metrics.

Example:

```json
{
  "result": "1-0",
  "end_reason": "checkmate",
  "plies": 87,
  "white": {
    "type": "human",
    "moves": 44
  },
  "black": {
    "type": "llm",
    "model": "gpt-4.1-mini",
    "invalid_actions": 1,
    "tool_calls": 184,
    "average_latency_ms": 4200
  }
}
```

---

## 18. Metrics

### 18.1 Game Metrics

* Result: `1-0`, `0-1`, or `1/2-1/2`.
* End reason.
* Number of plies.
* Total duration.
* Opening moves.
* Final FEN.
* Checkmate/stalemate/draw state.

### 18.2 Player Metrics

For each player:

* Moves made.
* Captures.
* Checks given.
* Castled: true/false.
* Promotions.
* Resigned: true/false.
* Draw offers.
* Time used if clocks enabled.

### 18.3 Agent Metrics

For LLM agents:

* Model provider.
* Model name.
* Temperature.
* Tool tier.
* Tools enabled.
* Tool calls total.
* Tool calls per move.
* Invalid actions.
* Malformed responses.
* Retry count.
* Average latency per move.
* Tokens used if provider returns usage.
* Estimated cost if configured.

### 18.4 Optional Chess Quality Metrics

If Stockfish is available and analysis is enabled after the game:

* Average centipawn loss.
* Blunders.
* Mistakes.
* Inaccuracies.
* Best move agreement rate.

This should be post-game analysis by default, not an in-game tool unless explicitly enabled.

---

## 19. Invalid Action Handling

### 19.1 Invalid Agent Actions

Invalid actions include:

* Illegal move.
* Move not in UCI format when UCI required.
* Missing promotion piece.
* Moving opponent’s piece.
* Moving when not agent’s turn.
* Calling disabled tool.
* Calling unknown tool.
* Returning malformed JSON.
* Failing to call `make_move` within budget.
* Trying to access engine tools when disabled.

### 19.2 Default Policy

```yaml
invalid_action_policy:
  max_invalid_actions_per_turn: 2
  on_invalid_action: retry
  include_legal_moves_hint: true
  on_exceeded: forfeit_game
```

Chess should usually forfeit the game after repeated invalid actions because forfeiting a turn is not a normal chess rule.

### 19.3 Retry Message Example

```text
Invalid move: e2e5 is illegal in the current position. You are Black. Choose one legal move from get_legal_moves and call make_move again.
```

---

## 20. Memory

### 20.1 MVP Memory Modes

Support two memory modes.

#### Mode 1: None

The agent receives only current FEN, legal tools, and current game context.

```yaml
memory:
  mode: none
```

#### Mode 2: External Summary

The app maintains a short game summary and includes it in the prompt.

```yaml
memory:
  mode: external_summary
  max_summary_chars: 3000
```

### 20.2 Memory Should Include

* Recent moves.
* Material situation summary.
* Castling status.
* Checks and threats if computed.
* Agent’s previous public explanations.

### 20.3 Memory Should Not Include

* Hidden chain-of-thought.
* Raw private model messages from the opponent.
* Any unavailable engine evaluation unless engine tools are enabled.

---

## 21. Bot Players

### 21.1 Random Bot

Chooses a random legal move.

Required for testing.

### 21.2 Heuristic Bot

A simple hand-coded chess bot.

Suggested behavior:

1. If checkmate is available, play it.
2. If own king is in check, choose a legal escape.
3. Prefer captures with positive material value.
4. Prefer checking moves.
5. Prefer developing minor pieces.
6. Prefer castling early.
7. Otherwise choose random legal move.

This bot does not need to be strong. It only needs to be a better baseline than random.

### 21.3 Optional Stockfish Bot

A bot controlled directly by Stockfish.

Must be clearly marked as engine bot.

---

## 22. Game Engine Requirements

### 22.1 Recommended Approach

Use a reliable chess rules library rather than hand-writing all chess rules.

Requirements:

* Legal move generation.
* FEN support.
* PGN support.
* SAN support.
* Check/checkmate/stalemate detection.
* Draw detection.

The UI and agent runtime should call this engine for all rules.

### 22.2 Core Engine Functions

The internal game service should provide:

```ts
createGame(config)
loadFen(fen)
getFen()
getPgn()
getLegalMoves(color)
makeMove(uciMove)
undoMove()
isCheck()
isCheckmate()
isStalemate()
isDraw()
getResult()
getMoveHistory()
serializeGame()
```

### 22.3 State Ownership

The chess engine owns:

* Board state.
* Turn.
* Castling rights.
* En passant target.
* Halfmove clock.
* Fullmove number.
* Legal moves.
* Result.

The LLM owns none of these.

---

## 23. Frontend Requirements

### 23.1 Recommended App Structure

The frontend should have:

* Main game page.
* Board component.
* Piece component.
* Side panel component.
* Move list component.
* Clock component.
* Agent activity component.
* Replay controls.
* Settings drawer.
* Game-over modal.

### 23.2 State Updates

After every valid move:

1. Backend/game state updates.
2. UI receives new FEN and move event.
3. UI animates move.
4. UI updates move list.
5. UI updates captured pieces and clocks.
6. If game over, UI shows result modal.

### 23.3 Responsiveness

MVP should support desktop-first.

Minimum viewport:

```text
1280x720 desktop layout
```

Nice-to-have:

* Tablet responsive layout.
* Mobile layout later.

### 23.4 Visual Quality Requirements

The UI should feel polished:

* Smooth animations.
* Clean square colors.
* High-quality SVG pieces.
* Clear typography.
* No clutter.
* Obvious active player.
* Clear game-over state.

---

## 24. Backend / Runtime Requirements

### 24.1 Runtime Responsibilities

The backend/runtime should:

* Load config.
* Start game state.
* Serve local UI.
* Manage current turn.
* Validate human moves.
* Run agent turns.
* Execute tools.
* Log events.
* Export files.
* Handle game end.

### 24.2 Agent Turn Lifecycle

1. Detect it is agent’s turn.
2. Build observation.
3. Build model request.
4. Send tools and prompt to provider.
5. Receive tool call or JSON action.
6. Validate tool call.
7. Execute inspection tools if requested.
8. Continue until `make_move`, `resign`, or draw response.
9. Validate final action.
10. Apply move through chess engine.
11. Log result.
12. Send update to UI.

### 24.3 Concurrency

For MVP:

* One local match active at a time is acceptable.
* Agent turns should not overlap.
* UI should prevent human moves while agent is thinking.

---

## 25. Suggested File Structure

```text
chess-agent-arena/
  README.md
  package.json
  .env.example

  configs/
    local.match.yaml
    agent-vs-agent.yaml
    human-vs-agent.yaml

  agents/
    cautious_chess_agent.yaml
    aggressive_chess_agent.yaml
    local_model_agent.yaml

  prompts/
    cautious_chess_agent.md
    aggressive_chess_agent.md

  src/
    cli/
      index.ts
      commands/
        dev.ts
        run.ts
        validate.ts
        replay.ts
        exportPgn.ts

    chess/
      engine.ts
      types.ts
      moveValidation.ts
      pgn.ts
      fen.ts
      result.ts

    players/
      humanPlayer.ts
      randomBot.ts
      heuristicBot.ts
      llmAgent.ts
      stockfishBot.ts

    tools/
      registry.ts
      getBoardState.ts
      getLegalMoves.ts
      inspectSquare.ts
      getMoveHistory.ts
      getGameStatus.ts
      makeMove.ts
      resign.ts
      offerDraw.ts
      engineTools.ts

    model/
      types.ts
      openAICompatibleClient.ts
      jsonActionParser.ts
      toolCallAdapter.ts

    runtime/
      matchRunner.ts
      agentTurnRunner.ts
      promptBuilder.ts
      memory.ts
      invalidActionPolicy.ts
      eventBus.ts

    logging/
      eventLogger.ts
      replayBuilder.ts
      summaryWriter.ts
      metrics.ts
      pgnExporter.ts

    web/
      app/
      components/
        ChessBoard.tsx
        ChessPiece.tsx
        MoveList.tsx
        SidePanel.tsx
        AgentActivityPanel.tsx
        ReplayControls.tsx
        GameOverModal.tsx
      styles/

    tests/
      engine.test.ts
      legalMoves.test.ts
      pgn.test.ts
      tools.test.ts
      agentRuntime.test.ts
      replay.test.ts
```

---

## 26. Suggested Implementation Phases

### Phase 1: Chess Engine Integration

Tasks:

1. Set up project.
2. Add chess rules library.
3. Implement game state wrapper.
4. Support standard starting position.
5. Support custom FEN.
6. Generate legal moves.
7. Apply UCI moves.
8. Export FEN and PGN.
9. Detect checkmate/stalemate/draw.

Acceptance criteria:

* Human-vs-human game can complete in code.
* Legal moves are enforced.
* PGN and FEN export work.
* Special moves work: castling, en passant, promotion.

### Phase 2: 2D Board UI

Tasks:

1. Build 8x8 board.
2. Add SVG pieces.
3. Add drag-and-drop.
4. Add click-to-move.
5. Highlight legal moves.
6. Highlight last move.
7. Highlight check.
8. Add move animations.
9. Add promotion picker.
10. Add move list.
11. Add game-over modal.

Acceptance criteria:

* User can play a full legal chess game in browser.
* Illegal moves snap back or are rejected.
* Special moves animate correctly.
* Game status updates correctly.

### Phase 3: Local Config and CLI

Tasks:

1. Add YAML config loading.
2. Add `.env` support.
3. Add `dev`, `run`, `validate`, `init`, `replay`, `export-pgn` commands.
4. Save output files.

Acceptance criteria:

* User can start app from config.
* User can generate example configs.
* Headless bot-vs-bot works.
* Output folder is created.

### Phase 4: Bots

Tasks:

1. Implement random bot.
2. Implement heuristic bot.
3. Add bot config.
4. Test bot-vs-bot and human-vs-bot.

Acceptance criteria:

* Random bot always plays legal moves.
* Heuristic bot always plays legal moves.
* Bot games complete without crashes.

### Phase 5: Tool System

Tasks:

1. Implement tool registry.
2. Implement required chess tools.
3. Add tool permissions by agent config.
4. Log tool calls.
5. Validate tool input/output.

Acceptance criteria:

* Tools return correct chess information.
* Disabled tools are rejected.
* `make_move` applies only legal moves.

### Phase 6: LLM Agent Runtime

Tasks:

1. Implement OpenAI-compatible client.
2. Implement native tool-calling mode.
3. Implement JSON action fallback.
4. Build prompt constructor.
5. Add invalid action retry policy.
6. Add public explanation capture.
7. Run Human vs Agent.
8. Run Agent vs Agent.

Acceptance criteria:

* LLM agent plays legal moves through tools.
* Invalid moves trigger retry.
* Repeated invalid failures end the game cleanly.
* Agent vs Agent can complete a game.

### Phase 7: Replay and Export

Tasks:

1. Save event log.
2. Build replay JSON.
3. Add browser replay controls.
4. Add PGN export.
5. Add summary markdown.
6. Add metrics JSON.

Acceptance criteria:

* Completed games can be replayed.
* PGN opens in chess tools.
* Summary and metrics are accurate.

### Phase 8: Optional Stockfish Integration

Tasks:

1. Add UCI engine wrapper.
2. Add post-game analysis.
3. Add optional engine evaluation tools.
4. Add Stockfish bot.

Acceptance criteria:

* If Stockfish path configured, post-game analysis works.
* Engine-assisted agents are clearly marked.
* App still works without Stockfish.

---

## 27. Testing Requirements

### 27.1 Unit Tests

Required tests:

* FEN load/export.
* Legal move generation.
* UCI move application.
* SAN generation.
* Check detection.
* Checkmate detection.
* Stalemate detection.
* Castling.
* En passant.
* Promotion.
* Draw detection.
* Tool permission checking.
* Invalid action handling.
* PGN export.

### 27.2 UI Tests

Required tests:

* Drag legal move.
* Drag illegal move and snap back.
* Click-to-move.
* Promotion picker.
* Board flip.
* Last move highlight.
* Game-over modal.
* Replay navigation.

### 27.3 Integration Tests

Required tests:

1. Human-vs-human game completes.
2. Random bot vs random bot completes.
3. Heuristic bot vs random bot completes.
4. Mock LLM agent vs random bot completes.
5. Mock LLM returns invalid move and receives retry.
6. Mock LLM returns malformed JSON and receives retry.
7. Mock LLM fails repeatedly and loses cleanly.
8. Agent vs Agent match completes with logs.

### 27.4 Mock Model

A mock model must be available for tests.

It should simulate:

* Legal move response.
* Illegal move response.
* Malformed JSON.
* Calling disabled tool.
* No final move.
* Resignation.

---

## 28. Acceptance Criteria for MVP

The MVP is complete when:

1. User can clone repo and install dependencies.
2. User can run `chess-agent-arena init`.
3. User can start local web app from config.
4. User can play Human vs Human on a 2D animated board.
5. User can play Human vs Agent.
6. User can watch Agent vs Agent.
7. User can play against random bot and heuristic bot.
8. All standard legal moves are supported.
9. Castling, en passant, and promotion work.
10. Checkmate, stalemate, resignation, and draws are detected.
11. Agents act only through tools.
12. Illegal agent moves are rejected and retried.
13. Game does not crash when model output is malformed.
14. Move history is shown in UI.
15. Board animations work smoothly.
16. Replay controls work after game completion.
17. PGN export works.
18. FEN export works.
19. Event logs are saved.
20. Summary and metrics files are saved.
21. API keys are not written into logs.
22. README explains setup and examples clearly.

---

## 29. README Requirements

README should include:

1. What Chess Agent Arena is.
2. Screenshots or GIF after available.
3. Installation.
4. `.env` setup.
5. How to start local web app.
6. How to run headless match.
7. How to configure agents.
8. How tool tiers work.
9. How to use local models.
10. How to enable Stockfish optionally.
11. How to export PGN.
12. How to read logs and metrics.
13. Troubleshooting.

Example quickstart:

```bash
git clone <repo>
cd chess-agent-arena
cp .env.example .env
npm install
npm run build
npx chess-agent-arena init
npx chess-agent-arena dev --config configs/human-vs-agent.yaml
```

---

## 30. Example Experiments

### 30.1 Prompt Comparison

Same model, same tools, different prompts.

```text
cautious_agent vs aggressive_agent
```

Question:

> Does a cautious prompt reduce illegal moves and blunders?

### 30.2 Tool Comparison

Same model, same prompt, different tools.

```text
tier_0_agent vs tier_1_agent
```

Question:

> Does access to get_legal_moves improve move legality?

### 30.3 Engine Assistance Comparison

Same model, one agent with Stockfish evaluation and one without.

Question:

> How much does engine access change performance?

### 30.4 Local vs Hosted Model

Local model agent vs hosted model agent.

Question:

> Can a local model play full legal chess through tools?

### 30.5 Human Study

Human plays against the agent.

Question:

> Is the agent enjoyable and understandable as an opponent?

---

## 31. Design Constraints

1. Initial version is local-first.
2. Initial version is chess only.
3. Full web UI is required.
4. 2D animated board is required.
5. Config files are required.
6. Local output files are required.
7. No cloud account system.
8. No public leaderboard.
9. No hosted multiplayer.
10. LLM must not own chess state.
11. Rules engine must enforce legal moves.
12. Engine tools must be optional and clearly marked.
13. The app must work without Stockfish.
14. The app must work with bots even without an LLM API key.

---

## 32. Future Extensions, Not MVP

After MVP:

1. Batch experiment runner.
2. Local Elo rating.
3. Tournament mode.
4. Opening book.
5. Puzzle mode.
6. Human vs local model preset.
7. Better Stockfish analysis UI.
8. Blunder/mistake annotations.
9. Agent profile editor in UI.
10. Shareable replay HTML export.
11. Cloud version.
12. Public arena.
13. More games.

---

## 33. Final Build Direction

Build a polished local chess game first.

The correct first product is:

> A local 2D chess game where humans and LLM agents play full legal chess, with animated gameplay, structured tools, configurable agents, logs, PGN export, replay, and optional engine analysis.

The simplest successful version is:

```text
One chess game.
One local web app.
One config system.
Human vs Agent.
Agent vs Agent.
Legal move enforcement.
2D board animations.
Tools.
Logs.
Replay.
PGN export.
```

Do not build the larger platform until this local chess game feels good, works reliably, and proves that configurable LLM chess agents are interesting to test and watch.
