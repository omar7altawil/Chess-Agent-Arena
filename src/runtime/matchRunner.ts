import { EventEmitter } from "node:events";
import { ChessGame } from "../chess/engine.js";
import { buildPgnHeaders } from "../chess/pgn.js";
import { chooseBotMove } from "../players/bots.js";
import type {
  AgentActivity,
  AgentModelCallRecord,
  AgentToolCallRecord,
  GameSnapshot,
  MatchConfig,
  MoveRecord,
  PlayerColor,
  PlayerConfig,
  PlayerSnapshot
} from "../shared/types.js";
import { EMPTY_ACTIVITY } from "../config/defaults.js";
import { EventLogger } from "../logging/eventLogger.js";
import { runAgentTurn } from "./agentTurnRunner.js";

const ACTIVITY_HISTORY_LIMIT = 20;

export class MatchRunner extends EventEmitter {
  readonly game: ChessGame;
  readonly logger: EventLogger;
  private started = false;
  private paused = false;
  private advancing = false;
  private finalWritten = false;
  private activity: AgentActivity = clone(EMPTY_ACTIVITY);
  private toolCallHistory: AgentToolCallRecord[] = [];
  private modelCallHistory: AgentModelCallRecord[] = [];

  constructor(private config: MatchConfig) {
    super();
    this.game = new ChessGame(config.chess.starting_fen);
    this.game.setHeaders(buildPgnHeaders(config, "*"));
    this.logger = new EventLogger(config);
  }

  async init(): Promise<void> {
    await this.logger.init();
    console.log(`[match] created id=${this.config.match.id} output=${this.config.match.output_dir}`);
    await this.logger.logEvent({
      type: "match_created",
      match_id: this.config.match.id,
      white: this.config.players.white.name,
      black: this.config.players.black.name
    });
    this.emitSnapshot();
  }

  async start(): Promise<void> {
    this.started = true;
    this.paused = false;
    console.log(`[match] started id=${this.config.match.id}`);
    await this.logger.logEvent({ type: "match_started", ply: this.game.getPly() });
    this.emitSnapshot();
    void this.advanceAutomatedTurns();
  }

  async pause(): Promise<void> {
    this.paused = true;
    await this.logger.logEvent({ type: "match_paused", ply: this.game.getPly() });
    this.emitSnapshot();
  }

  async resume(): Promise<void> {
    this.paused = false;
    this.started = true;
    await this.logger.logEvent({ type: "match_resumed", ply: this.game.getPly() });
    this.emitSnapshot();
    void this.advanceAutomatedTurns();
  }

  async humanMove(uci: string, explanation = "Human move."): Promise<{ ok: boolean; error?: string; move?: MoveRecord }> {
    if (!this.started) {
      await this.start();
    }
    const color = this.game.getTurn();
    const player = this.getPlayer(color);
    if (player.type !== "human") {
      return { ok: false, error: `It is ${player.name}'s turn.` };
    }
    const result = this.game.makeMove(uci, "human", explanation);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    await this.logger.logEvent({
      type: "move",
      ply: result.move.ply,
      color,
      actor: "human",
      uci: result.move.uci,
      san: result.move.san,
      fen_after: result.move.fenAfter
    });
    await this.maybeWriteFinal();
    this.emitSnapshot();
    void this.advanceAutomatedTurns();
    return { ok: true, move: result.move };
  }

  async resign(color: PlayerColor): Promise<void> {
    const result = this.game.resign(color);
    await this.logger.logEvent({ type: "resignation", color, result: result.result, reason: result.reason });
    await this.maybeWriteFinal();
    this.emitSnapshot();
  }

  async offerDraw(color: PlayerColor, explanation?: string): Promise<void> {
    this.game.offerDraw(color, explanation);
    await this.logger.logEvent({ type: "draw_offer", color, explanation });
    this.emitSnapshot();
  }

  async runToCompletion(): Promise<GameSnapshot> {
    await this.start();
    while (!this.game.isGameOver() && this.game.getPly() < this.config.match.max_plies) {
      await this.advanceAutomatedTurns();
      if (this.getPlayer(this.game.getTurn()).type === "human") {
        throw new Error("Headless run reached a human turn. Use bot or llm players for headless mode.");
      }
      await delay(5);
    }
    if (!this.game.isGameOver() && this.game.getPly() >= this.config.match.max_plies) {
      this.game.forceDraw("max plies reached");
    }
    await this.maybeWriteFinal();
    this.emitSnapshot();
    return this.getSnapshot();
  }

  getSnapshot(): GameSnapshot {
    const turn = this.game.getTurn();
    return {
      runId: this.config.match.id,
      fen: this.game.getFen(),
      pgn: this.game.getPgn(),
      turn,
      status: this.game.isGameOver() ? "completed" : this.started ? "active" : "idle",
      result: this.game.getResult(),
      endReason: this.game.getEndReason(),
      check: this.game.isCheck(),
      moveNumber: this.game.getMoveNumber(),
      ply: this.game.getPly(),
      players: {
        white: playerSnapshot("white", this.config.players.white),
        black: playerSnapshot("black", this.config.players.black)
      },
      legalMoves: this.game.getLegalMovesFor(turn),
      history: this.game.getMoveHistory(),
      captured: this.game.getCaptured(),
      lastMove: this.game.getLastMove(),
      activity: { ...this.activity },
      started: this.started,
      paused: this.paused,
      drawOffer: this.game.getDrawOffer(),
      config: this.config
    };
  }

  private getPlayer(color: PlayerColor): PlayerConfig {
    return this.config.players[color];
  }

  private async advanceAutomatedTurns(): Promise<void> {
    if (this.advancing) {
      return;
    }
    this.advancing = true;
    try {
      while (this.started && !this.paused && !this.game.isGameOver()) {
        if (this.game.getPly() >= this.config.match.max_plies) {
          this.game.forceDraw("max plies reached");
          await this.maybeWriteFinal();
          this.emitSnapshot();
          break;
        }

        const color = this.game.getTurn();
        const player = this.getPlayer(color);
        if (player.type === "human") {
          break;
        }

        if (player.type === "bot") {
          await this.playBotTurn(color, player);
          await delay(260);
          continue;
        }

        if (player.type === "llm") {
          await this.playLlmTurn(color, player);
          await delay(120);
          continue;
        }
      }
    } finally {
      this.advancing = false;
    }
  }

  private async playBotTurn(color: PlayerColor, player: PlayerConfig): Promise<void> {
    console.log(`[bot] turn color=${color} player="${player.name}" kind=${player.bot ?? "random"}`);
    this.activity = this.makeActivity({
      thinking: true,
      color,
      playerName: player.name
    });
    this.emitSnapshot();
    const choice = chooseBotMove(this.game, player.bot ?? "random");
    const result = this.game.makeMove(choice.move, "bot", choice.explanation);
    if (!result.ok) {
      console.error(`[bot] illegal move color=${color}: ${result.error}`);
      this.game.forfeit(color, `${player.name} selected an illegal move`);
      await this.logger.logEvent({ type: "bot_error", color, error: result.error });
    } else {
      console.log(`[move] ${color} bot ${result.move.uci} ${result.move.san}`);
      await this.logger.logEvent({
        type: "move",
        ply: result.move.ply,
        color,
        actor: "bot",
        uci: result.move.uci,
        san: result.move.san,
        explanation: choice.explanation,
        fen_after: result.move.fenAfter
      });
    }
    this.activity = this.makeActivity({ latestExplanation: choice.explanation });
    await this.maybeWriteFinal();
    this.emitSnapshot();
  }

  private async playLlmTurn(color: PlayerColor, player: PlayerConfig): Promise<void> {
    if (!player.agent) {
      console.error(`[agent] missing config color=${color} player="${player.name}"`);
      this.game.forfeit(color, `${player.name} has no loaded agent configuration`);
      await this.logger.logEvent({ type: "agent_error", color, error: "Missing agent config" });
      await this.maybeWriteFinal();
      this.emitSnapshot();
      return;
    }

    console.log(`[agent] turn queued color=${color} player="${player.name}" model=${player.agent.model.model_name}`);
    this.activity = this.makeActivity({
      thinking: true,
      color,
      playerName: player.name
    });
    this.emitSnapshot();

    try {
      const beforePly = this.game.getPly();
      const outcome = await runAgentTurn({
        config: this.config,
        game: this.game,
        color,
        agent: player.agent,
        logger: this.logger,
        onActivity: (partial) => {
          if (partial.toolCallRecord) {
            this.toolCallHistory.push(partial.toolCallRecord);
            this.toolCallHistory = this.toolCallHistory.slice(-ACTIVITY_HISTORY_LIMIT);
          }
          if (partial.modelCallRecord) {
            this.modelCallHistory.push(partial.modelCallRecord);
            this.modelCallHistory = this.modelCallHistory.slice(-ACTIVITY_HISTORY_LIMIT);
          }
          this.activity = this.makeActivity({
            thinking: true,
            color,
            playerName: player.name,
            latestExplanation: partial.explanation ?? this.activity.latestExplanation,
            toolCallsThisTurn: partial.toolCalls ?? this.activity.toolCallsThisTurn,
            invalidActionsThisTurn: partial.invalidActions ?? this.activity.invalidActionsThisTurn,
            warnings: partial.warnings ?? this.activity.warnings
          });
          this.emitSnapshot();
        }
      });
      const move = this.game.getLastMove();
      if (move && move.ply > beforePly) {
        console.log(`[move] ${color} llm ${move.uci} ${move.san}`);
        await this.logger.logEvent({
          type: "move",
          ply: move.ply,
          color,
          actor: "llm",
          uci: move.uci,
          san: move.san,
          explanation: move.explanation,
          fen_after: move.fenAfter
        });
      }
      this.activity = this.makeActivity({
        latestExplanation: outcome.explanation ?? move?.explanation ?? null,
        toolCallsThisTurn: outcome.toolCalls,
        invalidActionsThisTurn: outcome.invalidActions,
        warnings: outcome.warnings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown agent error";
      console.error(`[agent] failure color=${color} player="${player.name}": ${message}`);
      this.game.forfeit(color, `${player.name} failed: ${message}`);
      this.activity = this.makeActivity({ warnings: [message] });
      await this.logger.logEvent({ type: "agent_error", color, error: message });
    }

    await this.maybeWriteFinal();
    this.emitSnapshot();
  }

  private makeActivity(partial: Partial<AgentActivity>): AgentActivity {
    return {
      thinking: false,
      color: null,
      playerName: null,
      latestExplanation: null,
      toolCallsThisTurn: 0,
      invalidActionsThisTurn: 0,
      warnings: [],
      ...partial,
      recentToolCalls: this.toolCallHistory.slice(-ACTIVITY_HISTORY_LIMIT),
      recentModelCalls: this.modelCallHistory.slice(-ACTIVITY_HISTORY_LIMIT)
    };
  }

  private async maybeWriteFinal(): Promise<void> {
    if (this.finalWritten || !this.game.isGameOver()) {
      return;
    }
    this.game.setHeaders(buildPgnHeaders(this.config, this.game.getResult()));
    await this.logger.writeFinal(this.game);
    this.finalWritten = true;
  }

  private emitSnapshot(): void {
    this.emit("snapshot", this.getSnapshot());
  }
}

function playerSnapshot(color: PlayerColor, player: PlayerConfig): PlayerSnapshot {
  return {
    color,
    name: player.name,
    type: player.type,
    bot: player.bot,
    model: player.agent?.model.model_name,
    toolTier: player.agent?.behavior.tool_tier
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
