export type PlayerColor = "white" | "black";
export type ChessColor = "w" | "b";
export type PlayerType = "human" | "bot" | "llm";
export type BotKind = "random" | "heuristic";
export type GameStatus = "idle" | "active" | "completed";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type ToolMode = "native" | "json";

export interface MatchConfig {
  match: {
    id: string;
    output_dir: string;
    max_plies: number;
    auto_start: boolean;
  };
  server?: {
    port?: number;
  };
  ui: {
    board_theme: string;
    piece_set: string;
    animation_ms: number;
    show_legal_moves: boolean;
    show_last_move: boolean;
    show_coordinates: boolean;
    enable_sound: boolean;
  };
  chess: {
    starting_position: "standard" | "fen";
    starting_fen: string | null;
    rules: {
      threefold_repetition: boolean;
      fifty_move_rule: boolean;
      insufficient_material: boolean;
    };
    clocks: {
      enabled: boolean;
      initial_seconds: number;
      increment_seconds: number;
    };
  };
  players: {
    white: PlayerConfig;
    black: PlayerConfig;
  };
}

export interface PlayerConfig {
  type: PlayerType;
  name: string;
  bot?: BotKind;
  agent_config?: string;
  agent?: AgentConfig;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: "llm";
  model: {
    provider: string;
    model_name: string;
    base_url: string;
    api_key_env: string;
    temperature: number;
    max_output_tokens: number;
    timeout_seconds: number;
    tool_mode?: ToolMode;
  };
  prompt: {
    system_prompt_file: string;
    system_prompt?: string;
  };
  behavior: {
    tool_tier: string;
    max_tool_calls_per_turn: number;
    max_invalid_actions_per_turn: number;
    require_make_move: boolean;
    allow_resign: boolean;
    allow_draw_offer: boolean;
  };
  memory: {
    mode: "none" | "external_summary";
    max_summary_chars: number;
  };
  tools: string[];
}

export interface LegalMove {
  uci: string;
  san: string;
  from: string;
  to: string;
  piece: string;
  color: PlayerColor;
  capture: boolean;
  captured?: string;
  promotion: string | null;
  check: boolean;
  checkmate: boolean;
}

export interface MoveRecord extends LegalMove {
  ply: number;
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
  explanation?: string;
  actor: PlayerType;
}

export interface PlayerSnapshot {
  color: PlayerColor;
  name: string;
  type: PlayerType;
  bot?: BotKind;
  model?: string;
  toolTier?: string;
}

export interface CapturedSnapshot {
  white: string[];
  black: string[];
}

export interface AgentToolCallRecord {
  ts: string;
  ply: number;
  color: PlayerColor;
  tool: string;
  ok: boolean;
  invalid: boolean;
  finalAction: boolean;
  arguments: Record<string, unknown>;
  outputSummary: string;
  error?: string;
}

export interface AgentModelCallRecord {
  ts: string;
  color: PlayerColor;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  finishReason?: string | null;
}

export interface AgentActivity {
  thinking: boolean;
  color: PlayerColor | null;
  playerName: string | null;
  latestExplanation: string | null;
  toolCallsThisTurn: number;
  invalidActionsThisTurn: number;
  warnings: string[];
  recentToolCalls: AgentToolCallRecord[];
  recentModelCalls: AgentModelCallRecord[];
}

export interface GameSnapshot {
  runId: string;
  fen: string;
  pgn: string;
  turn: PlayerColor;
  status: GameStatus;
  result: GameResult;
  endReason: string | null;
  check: boolean;
  moveNumber: number;
  ply: number;
  players: {
    white: PlayerSnapshot;
    black: PlayerSnapshot;
  };
  legalMoves: LegalMove[];
  history: MoveRecord[];
  captured: CapturedSnapshot;
  lastMove: MoveRecord | null;
  activity: AgentActivity;
  started: boolean;
  paused: boolean;
  drawOffer: {
    by: PlayerColor;
    explanation?: string;
  } | null;
  config: MatchConfig;
}

export interface ResultsSummary {
  id: string;
  outputDir: string;
  updatedAt: string;
  status: "completed" | "failed" | "incomplete" | "active";
  result: GameResult | null;
  endReason: string | null;
  white: string;
  black: string;
  whiteType: PlayerType;
  blackType: PlayerType;
  whiteModel?: string;
  blackModel?: string;
  plies: number;
  finalFen: string;
  isModelMatch: boolean;
  isBotOnly: boolean;
  isDevRun: boolean;
  outcomeLabel: string;
  issueSummary?: string;
  totalTokens?: number;
  totalCostUsd?: number;
  pgnPath?: string;
  replayPath?: string;
  metricsPath?: string;
}

export interface OpenRouterModelSummary {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  promptPrice: string;
  completionPrice: string;
  free: boolean;
  supportsTools: boolean;
  supportsStructuredOutputs: boolean;
  created?: number;
}

export interface OpenRouterKeyStatus {
  configured: boolean;
  keyEnv: string;
  source: "environment" | "local_file" | null;
  localPath: string;
  masked: string | null;
}

export interface OpenRouterTestResult {
  ok: boolean;
  model: string;
  status: number;
  latencyMs: number;
  message: string;
}
