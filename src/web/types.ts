import type {
  AgentActivity,
  AgentModelCallRecord,
  AgentToolCallRecord,
  GameSnapshot,
  MatchConfig,
  OpenRouterKeyStatus,
  OpenRouterModelSummary,
  OpenRouterTestResult,
  PlayerColor,
  PlayerConfig,
  ResultsSummary
} from "../shared/types";

export type {
  AgentActivity,
  AgentModelCallRecord,
  AgentToolCallRecord,
  GameSnapshot,
  MatchConfig,
  OpenRouterKeyStatus,
  OpenRouterModelSummary,
  OpenRouterTestResult,
  PlayerColor,
  PlayerConfig,
  ResultsSummary
};

export type ViewName = "setup" | "game" | "results";

export interface PendingPromotion {
  from: string;
  to: string;
}
