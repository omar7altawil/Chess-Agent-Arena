import type {
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
  GameSnapshot,
  MatchConfig,
  OpenRouterKeyStatus,
  OpenRouterModelSummary,
  OpenRouterTestResult,
  PlayerColor,
  PlayerConfig,
  ResultsSummary
};

export type ViewName = "game" | "results";

export interface PendingPromotion {
  from: string;
  to: string;
}
