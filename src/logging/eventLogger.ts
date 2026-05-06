import { mkdir, readFile, readdir, stat, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { MatchConfig, MoveRecord, PlayerColor, ResultsSummary } from "../shared/types.js";
import { ChessGame } from "../chess/engine.js";
import { sanitizeConfig } from "../config/loadConfig.js";

interface ModelUsageRollup {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  totalLatencyMs: number;
  failures: number;
}

export class EventLogger {
  readonly outputDir: string;
  private readonly eventsPath: string;
  private readonly modelCallsPath: string;

  constructor(private readonly config: MatchConfig) {
    this.outputDir = path.resolve(process.cwd(), config.match.output_dir);
    this.eventsPath = path.join(this.outputDir, "events.jsonl");
    this.modelCallsPath = path.join(this.outputDir, "model_calls.jsonl");
  }

  async init(): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(path.join(this.outputDir, "config.resolved.yaml"), YAML.stringify(sanitizeConfig(this.config)), "utf8");
    await writeFile(this.eventsPath, "", "utf8");
    await writeFile(this.modelCallsPath, "", "utf8");
  }

  async logEvent(event: Record<string, unknown>): Promise<void> {
    await appendFile(this.eventsPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, "utf8");
  }

  async logModelCall(event: Record<string, unknown>): Promise<void> {
    await appendFile(this.modelCallsPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, "utf8");
  }

  async writeFinal(game: ChessGame): Promise<void> {
    const result = game.getResult();
    const finalFen = game.getFen();
    const history = game.getMoveHistory();
    const events = await readJsonl(this.eventsPath);
    const modelCalls = await readJsonl(this.modelCallsPath);
    const usageByColor = rollupUsage(modelCalls);
    const toolStats = rollupToolCalls(events);

    const metrics = {
      result,
      end_reason: game.getEndReason(),
      plies: game.getPly(),
      final_fen: finalFen,
      duration_ms: estimateDurationMs(events),
      total_tokens: usageByColor.white.totalTokens + usageByColor.black.totalTokens,
      total_cost_usd: round(usageByColor.white.costUsd + usageByColor.black.costUsd, 6),
      white: buildPlayerMetrics("white", this.config, history, usageByColor.white, toolStats.white),
      black: buildPlayerMetrics("black", this.config, history, usageByColor.black, toolStats.black)
    };

    const replay = {
      initial_fen: history[0]?.fenBefore ?? "startpos",
      final_fen: finalFen,
      result,
      end_reason: game.getEndReason(),
      moves: history,
      fens: history.map((move) => move.fenAfter)
    };

    await Promise.all([
      writeFile(path.join(this.outputDir, "game.pgn"), game.getPgn(), "utf8"),
      writeFile(path.join(this.outputDir, "final.fen"), `${finalFen}\n`, "utf8"),
      writeFile(path.join(this.outputDir, "metrics.json"), JSON.stringify(metrics, null, 2), "utf8"),
      writeFile(path.join(this.outputDir, "replay.json"), JSON.stringify(replay, null, 2), "utf8"),
      writeFile(path.join(this.outputDir, "summary.md"), buildSummary(this.config, game, metrics), "utf8")
    ]);
  }
}

export async function listResults(root = path.resolve(process.cwd(), "runs")): Promise<ResultsSummary[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const summaries: Array<ResultsSummary | null> = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const outputDir = path.join(root, entry.name);
          const metricsPath = path.join(outputDir, "metrics.json");
          const configPath = path.join(outputDir, "config.resolved.yaml");
          const eventsPath = path.join(outputDir, "events.jsonl");
          try {
            const configText = await readFile(configPath, "utf8");
            const metricsText = await readFile(metricsPath, "utf8").catch(() => null);
            const metrics = metricsText ? JSON.parse(metricsText) as Record<string, unknown> : null;
            const config = YAML.parse(configText) as MatchConfig;
            const stats = await newestExistingStat([metricsPath, eventsPath, configPath]);
            const whiteSide = (metrics?.white as Record<string, unknown> | undefined) ?? {};
            const blackSide = (metrics?.black as Record<string, unknown> | undefined) ?? {};
            const status = classifyRun(metrics, config);
            const endReason = (metrics?.end_reason as string | null | undefined) ?? null;
            const result = status === "completed" ? ((metrics?.result as ResultsSummary["result"]) ?? null) : null;
            const whiteType = config.players.white.type;
            const blackType = config.players.black.type;
            const plies = Number(metrics?.plies ?? await countMoveEvents(eventsPath));
            return {
              id: config.match.id,
              outputDir,
              updatedAt: stats.mtime.toISOString(),
              status,
              result,
              endReason,
              white: config.players.white.name,
              black: config.players.black.name,
              whiteType,
              blackType,
              whiteModel: typeof whiteSide.model === "string" ? whiteSide.model : undefined,
              blackModel: typeof blackSide.model === "string" ? blackSide.model : undefined,
              plies,
              finalFen: String(metrics?.final_fen ?? ""),
              isModelMatch: whiteType === "llm" || blackType === "llm",
              isBotOnly: whiteType === "bot" && blackType === "bot",
              isDevRun: /mock|smoke|test/i.test(config.match.id),
              outcomeLabel: buildOutcomeLabel(status, result, endReason),
              issueSummary: status === "failed" ? summarizeIssue(endReason) : undefined,
              totalTokens: typeof metrics?.total_tokens === "number" ? metrics.total_tokens : undefined,
              totalCostUsd: typeof metrics?.total_cost_usd === "number" ? metrics.total_cost_usd : undefined,
              pgnPath: path.join(outputDir, "game.pgn"),
              replayPath: path.join(outputDir, "replay.json"),
              metricsPath: metricsText ? metricsPath : undefined
            } satisfies ResultsSummary;
          } catch {
            return null;
          }
        })
    );
    const filtered: ResultsSummary[] = summaries.filter((summary): summary is ResultsSummary => summary !== null);
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

async function newestExistingStat(paths: string[]) {
  const stats = await Promise.all(paths.map(async (candidate) => {
    try {
      return await stat(candidate);
    } catch {
      return null;
    }
  }));
  const existing = stats.flatMap((item) => item ? [item] : []);
  if (existing.length === 0) {
    throw new Error("No run files found.");
  }
  return existing.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

async function countMoveEvents(eventsPath: string): Promise<number> {
  try {
    const text = await readFile(eventsPath, "utf8");
    return text.split("\n").filter((line) => line.includes('"type":"move"')).length;
  } catch {
    return 0;
  }
}

function classifyRun(metrics: Record<string, unknown> | null, config: MatchConfig): ResultsSummary["status"] {
  if (!metrics) {
    return "active";
  }
  const endReason = String(metrics.end_reason ?? "");
  if (isTechnicalFailure(endReason)) {
    return "failed";
  }
  if (endReason === "max plies reached") {
    return "incomplete";
  }
  if (config.players.white.type !== "llm" && config.players.black.type !== "llm") {
    return "incomplete";
  }
  return "completed";
}

function isTechnicalFailure(reason: string): boolean {
  return /failed:|model request failed|missing api key|exceeded invalid action|tool-call budget|malformed|provider returned error/i.test(reason);
}

function buildOutcomeLabel(status: ResultsSummary["status"], result: ResultsSummary["result"], endReason: string | null): string {
  if (status === "completed") {
    return result ?? "Completed";
  }
  if (status === "failed") {
    return "Run failed";
  }
  if (status === "incomplete") {
    return endReason === "max plies reached" ? "Max plies" : "Not scored";
  }
  return "In progress";
}

function summarizeIssue(reason: string | null): string {
  if (!reason) return "Unknown issue";
  if (/429/.test(reason)) return "Provider rate limit";
  if (/missing api key/i.test(reason)) return "Missing API key";
  if (/exceeded invalid action/i.test(reason)) return "Invalid action limit";
  if (/tool-call budget/i.test(reason)) return "No final move";
  const cleaned = reason.replace(/\{.*$/s, "").replace(/^.*failed:\s*/i, "").trim();
  return cleaned.slice(0, 120) || "Model/provider error";
}

function buildPlayerMetrics(
  color: PlayerColor,
  config: MatchConfig,
  history: MoveRecord[],
  usage: ModelUsageRollup,
  toolStats: { calls: number; invalid: number; byTool: Record<string, number> }
) {
  const player = config.players[color];
  const moves = history.filter((move) => move.color === color);
  const captures = moves.filter((move) => move.capture).length;
  const checks = moves.filter((move) => move.check && !move.checkmate).length;
  const promotions = moves.filter((move) => move.promotion).length;
  const castled = moves.some((move) => move.san === "O-O" || move.san === "O-O-O");
  return {
    type: player.type,
    name: player.name,
    bot: player.bot,
    model: player.agent?.model.model_name,
    temperature: player.agent?.model.temperature,
    tool_tier: player.agent?.behavior.tool_tier,
    tool_mode: player.agent?.model.tool_mode,
    moves: moves.length,
    captures,
    checks_given: checks,
    promotions,
    castled,
    tool_calls: toolStats.calls,
    invalid_actions: toolStats.invalid,
    tools_used: toolStats.byTool,
    model_calls: usage.calls,
    prompt_tokens: usage.promptTokens || undefined,
    completion_tokens: usage.completionTokens || undefined,
    total_tokens: usage.totalTokens || undefined,
    cost_usd: usage.costUsd ? round(usage.costUsd, 6) : undefined,
    avg_latency_ms: usage.calls > 0 ? Math.round(usage.totalLatencyMs / usage.calls) : undefined
  };
}

async function readJsonl(filePath: string): Promise<Array<Record<string, unknown>>> {
  try {
    const text = await readFile(filePath, "utf8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return {};
        }
      });
  } catch {
    return [];
  }
}

function rollupUsage(calls: Array<Record<string, unknown>>): { white: ModelUsageRollup; black: ModelUsageRollup } {
  const empty = (): ModelUsageRollup => ({
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    totalLatencyMs: 0,
    failures: 0
  });
  const out = { white: empty(), black: empty() };
  for (const call of calls) {
    const color = call.color === "black" ? "black" : "white";
    const target = out[color];
    target.calls += 1;
    const usage = call.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } | null;
    if (usage) {
      target.promptTokens += usage.prompt_tokens ?? 0;
      target.completionTokens += usage.completion_tokens ?? 0;
      target.totalTokens += usage.total_tokens ?? 0;
      target.costUsd += typeof usage.cost === "number" ? usage.cost : 0;
    }
    if (typeof call.latency_ms === "number") {
      target.totalLatencyMs += call.latency_ms;
    }
  }
  return out;
}

function rollupToolCalls(events: Array<Record<string, unknown>>): {
  white: { calls: number; invalid: number; byTool: Record<string, number> };
  black: { calls: number; invalid: number; byTool: Record<string, number> };
} {
  const empty = () => ({ calls: 0, invalid: 0, byTool: {} as Record<string, number> });
  const out = { white: empty(), black: empty() };
  for (const event of events) {
    if (event.type !== "tool_call") continue;
    const color = event.color === "black" ? "black" : "white";
    const target = out[color];
    target.calls += 1;
    if (event.ok === false) target.invalid += 1;
    const tool = String(event.tool ?? "unknown");
    target.byTool[tool] = (target.byTool[tool] ?? 0) + 1;
  }
  return out;
}

function estimateDurationMs(events: Array<Record<string, unknown>>): number | undefined {
  if (events.length < 2) return undefined;
  const first = String(events[0]?.ts ?? "");
  const last = String(events[events.length - 1]?.ts ?? "");
  if (!first || !last) return undefined;
  const ms = new Date(last).getTime() - new Date(first).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSummary(config: MatchConfig, game: ChessGame, metrics: Record<string, unknown>): string {
  const history = game.getMoveHistory();
  const moveText = history.map((move) => `${move.moveNumber}${move.color === "white" ? "." : "..."} ${move.san}`).join(" ");
  const playerLine = (color: PlayerColor) => {
    const player = config.players[color];
    const m = (metrics[color] as Record<string, unknown> | undefined) ?? {};
    const parts: string[] = [`${player.name} (${player.type}`];
    if (player.bot) parts.push(`/ ${player.bot}`);
    if (player.agent) parts.push(`/ ${player.agent.model.model_name}`);
    parts.push(")");
    const stats = [
      m.moves != null ? `${m.moves} moves` : null,
      m.tool_calls ? `${m.tool_calls} tool calls` : null,
      m.invalid_actions ? `${m.invalid_actions} invalid` : null,
      m.total_tokens ? `${m.total_tokens} tokens` : null,
      m.cost_usd ? `$${m.cost_usd}` : null,
      m.avg_latency_ms ? `${m.avg_latency_ms}ms avg` : null
    ].filter(Boolean);
    return `- **${color}**: ${parts.join("")} — ${stats.join(", ") || "no stats"}`;
  };
  return [
    "# Chess Agent Arena Summary",
    "",
    `- Match: ${config.match.id}`,
    playerLine("white"),
    playerLine("black"),
    `- Result: ${game.getResult()}`,
    `- End reason: ${game.getEndReason() ?? "active"}`,
    `- Plies: ${game.getPly()}`,
    metrics.duration_ms ? `- Duration: ${Math.round((metrics.duration_ms as number) / 1000)}s` : null,
    metrics.total_tokens ? `- Total tokens: ${metrics.total_tokens}` : null,
    metrics.total_cost_usd ? `- Total cost: $${metrics.total_cost_usd}` : null,
    `- Final FEN: ${game.getFen()}`,
    "",
    "## Moves",
    "",
    moveText || "No moves recorded."
  ].filter(Boolean).join("\n");
}
