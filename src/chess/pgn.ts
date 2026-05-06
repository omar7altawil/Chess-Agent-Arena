import type { MatchConfig } from "../shared/types.js";

export function buildPgnHeaders(config: MatchConfig, result: string): Record<string, string> {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  return {
    Event: "Chess Agent Arena Local Match",
    Site: "Local",
    Date: date,
    White: config.players.white.name,
    Black: config.players.black.name,
    Result: result
  };
}
