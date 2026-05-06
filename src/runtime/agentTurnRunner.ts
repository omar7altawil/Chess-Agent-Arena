import { OpenAICompatibleClient } from "../model/openAICompatibleClient.js";
import { parseJsonAction } from "../model/jsonActionParser.js";
import type { ChatMessage, ToolCall } from "../model/types.js";
import { executeTool, getToolDefinitions } from "../tools/registry.js";
import { buildTurnPrompt } from "./promptBuilder.js";
import type {
  AgentConfig,
  AgentModelCallRecord,
  AgentToolCallRecord,
  MatchConfig,
  PlayerColor
} from "../shared/types.js";
import { ChessGame } from "../chess/engine.js";
import type { EventLogger } from "../logging/eventLogger.js";

export interface AgentTurnOutcome {
  completed: boolean;
  explanation?: string;
  toolCalls: number;
  invalidActions: number;
  warnings: string[];
  toolCallRecords: AgentToolCallRecord[];
  modelCallRecords: AgentModelCallRecord[];
}

export interface AgentTurnPartial {
  toolCalls?: number;
  invalidActions?: number;
  warnings?: string[];
  explanation?: string;
  toolCallRecord?: AgentToolCallRecord;
  modelCallRecord?: AgentModelCallRecord;
}

export async function runAgentTurn(options: {
  config: MatchConfig;
  game: ChessGame;
  color: PlayerColor;
  agent: AgentConfig;
  logger: EventLogger;
  onActivity?: (activity: AgentTurnPartial) => void;
}): Promise<AgentTurnOutcome> {
  const { config, game, color, agent, logger, onActivity } = options;
  const client = new OpenAICompatibleClient(agent);
  const messages: ChatMessage[] = [
    { role: "system", content: agent.prompt.system_prompt || "You are a chess agent." },
    { role: "user", content: buildTurnPrompt(config, game, color, agent) }
  ];
  const warnings: string[] = [];
  const toolCallRecords: AgentToolCallRecord[] = [];
  const modelCallRecords: AgentModelCallRecord[] = [];
  let toolCalls = 0;
  let invalidActions = 0;
  let latestExplanation: string | undefined;

  console.log(`[agent] turn start color=${color} agent="${agent.name}" model=${agent.model.model_name} mode=${agent.model.tool_mode ?? "native"}`);

  for (let step = 0; step < agent.behavior.max_tool_calls_per_turn; step += 1) {
    console.log(`[agent] model step=${step + 1}/${agent.behavior.max_tool_calls_per_turn} color=${color}`);
    const requestStart = Date.now();
    const response = await client.createChatCompletion({
      model: agent.model.model_name,
      messages,
      tools: agent.model.tool_mode === "json" ? undefined : getToolDefinitions(agent),
      ...(agent.model.tool_mode === "json" ? {} : { tool_choice: "auto" as const }),
      parallel_tool_calls: false,
      temperature: agent.model.temperature,
      max_tokens: agent.model.max_output_tokens
    });
    const latencyMs = Date.now() - requestStart;
    const usage = response.usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number }
      | undefined;
    const modelCallRecord: AgentModelCallRecord = {
      ts: new Date().toISOString(),
      color,
      model: agent.model.model_name,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      costUsd: typeof usage?.cost === "number" ? usage.cost : undefined,
      latencyMs,
      finishReason: response.choices[0]?.finish_reason ?? null
    };
    modelCallRecords.push(modelCallRecord);
    onActivity?.({ modelCallRecord });

    await logger.logModelCall({
      color,
      provider: agent.model.provider,
      model: agent.model.model_name,
      usage: response.usage ?? null,
      latency_ms: latencyMs,
      finish_reason: response.choices[0]?.finish_reason ?? null
    });

    const message = response.choices[0]?.message;
    if (!message) {
      warnings.push("Model returned no message.");
      invalidActions += 1;
      console.warn(`[agent] no message returned color=${color}`);
      continue;
    }

    if (message.tool_calls?.length) {
      console.log(`[agent] tool_calls count=${message.tool_calls.length} color=${color}`);
      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
      for (const toolCall of message.tool_calls) {
        const { execution, args } = await executeModelToolCall(toolCall, { game, color, agent });
        toolCalls += 1;
        if (execution.explanation) latestExplanation = execution.explanation;
        if (execution.invalid) invalidActions += 1;
        const record = buildToolCallRecord({
          ply: game.getPly(),
          color,
          tool: toolCall.function.name,
          execution,
          args
        });
        toolCallRecords.push(record);
        await logger.logEvent({
          type: "tool_call",
          ply: record.ply,
          color,
          tool: record.tool,
          ok: record.ok,
          output: execution.output
        });
        console.log(
          `[tool] ${record.tool} color=${color} ok=${record.ok} final=${record.finalAction} invalid=${record.invalid}`
        );
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(execution.output)
        });
        onActivity?.({ toolCalls, invalidActions, warnings, explanation: latestExplanation, toolCallRecord: record });
        if (record.finalAction && record.ok) {
          return finishOutcome(true);
        }
        if (invalidActions > agent.behavior.max_invalid_actions_per_turn) {
          game.forfeit(color, `${agent.name} exceeded invalid action limit`);
          warnings.push("Invalid action limit exceeded; game forfeited.");
          console.warn(`[agent] invalid action limit exceeded color=${color}`);
          return finishOutcome(false);
        }
      }
      continue;
    }

    const jsonAction = parseJsonAction(message.content);
    if (jsonAction) {
      console.log(`[agent] json action tool=${jsonAction.tool} color=${color}`);
      messages.push({ role: "assistant", content: message.content ?? null });
      const execution = executeTool(jsonAction.tool, jsonAction.arguments, { game, agentColor: color, agent });
      toolCalls += 1;
      if (execution.explanation) latestExplanation = execution.explanation;
      if (execution.invalid) invalidActions += 1;
      const record = buildToolCallRecord({
        ply: game.getPly(),
        color,
        tool: jsonAction.tool,
        execution,
        args: jsonAction.arguments
      });
      toolCallRecords.push(record);
      await logger.logEvent({
        type: "tool_call",
        ply: record.ply,
        color,
        tool: record.tool,
        ok: record.ok,
        output: execution.output
      });
      console.log(
        `[tool] ${record.tool} color=${color} ok=${record.ok} final=${record.finalAction} invalid=${record.invalid}`
      );
      messages.push({
        role: "user",
        content: `Tool result: ${JSON.stringify(execution.output)}`
      });
      onActivity?.({ toolCalls, invalidActions, warnings, explanation: latestExplanation, toolCallRecord: record });
      if (record.finalAction && record.ok) {
        return finishOutcome(true);
      }
      if (invalidActions > agent.behavior.max_invalid_actions_per_turn) {
        game.forfeit(color, `${agent.name} exceeded invalid action limit`);
        warnings.push("Invalid action limit exceeded; game forfeited.");
        console.warn(`[agent] invalid action limit exceeded color=${color}`);
        return finishOutcome(false);
      }
      continue;
    }

    invalidActions += 1;
    warnings.push("Model returned text without a tool call or JSON action.");
    console.warn(`[agent] invalid text response color=${color}: ${(message.content ?? "").slice(0, 220)}`);
    messages.push({
      role: "user",
      content: "Invalid response. Call an enabled tool or return strict JSON with tool and arguments."
    });
    onActivity?.({ toolCalls, invalidActions, warnings, explanation: latestExplanation });
  }

  game.forfeit(color, `${agent.name} failed to make a legal move within the tool-call budget`);
  warnings.push("Tool-call budget exceeded; game forfeited.");
  console.warn(`[agent] tool budget exceeded color=${color}`);
  return finishOutcome(false);

  function finishOutcome(completed: boolean): AgentTurnOutcome {
    return {
      completed,
      explanation: latestExplanation,
      toolCalls,
      invalidActions,
      warnings,
      toolCallRecords,
      modelCallRecords
    };
  }
}

function buildToolCallRecord(input: {
  ply: number;
  color: PlayerColor;
  tool: string;
  execution: { ok: boolean; invalid?: boolean; finalAction?: boolean; output: Record<string, unknown> };
  args: unknown;
}): AgentToolCallRecord {
  const { ply, color, tool, execution, args } = input;
  const output = execution.output ?? {};
  return {
    ts: new Date().toISOString(),
    ply,
    color,
    tool,
    ok: execution.ok,
    invalid: Boolean(execution.invalid),
    finalAction: Boolean(execution.finalAction),
    arguments: isPlainObject(args) ? args as Record<string, unknown> : {},
    outputSummary: summarizeOutput(tool, output),
    error: typeof (output as { error?: unknown }).error === "string"
      ? ((output as { error: string }).error)
      : undefined
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeOutput(tool: string, output: Record<string, unknown>): string {
  if (tool === "make_move" && output.accepted) {
    return `${output.san ?? output.uci ?? ""}`.trim() || "move accepted";
  }
  if (output.accepted === false) {
    return String(output.error ?? "rejected");
  }
  if (tool === "get_legal_moves" && Array.isArray(output.moves)) {
    return `${output.moves.length} legal moves`;
  }
  if (tool === "get_board_state") {
    return `turn=${output.turn ?? "?"} ply=${output.move_number ?? "?"}`;
  }
  if (tool === "resign") {
    return `result ${output.result ?? "?"}`;
  }
  if (tool === "offer_draw") {
    return "draw offered";
  }
  if (tool === "respond_to_draw_offer") {
    return `response: ${output.draw_offer_pending === false ? "resolved" : "pending"}`;
  }
  return "ok";
}

async function executeModelToolCall(
  toolCall: ToolCall,
  context: { game: ChessGame; color: PlayerColor; agent: AgentConfig }
) {
  let args: unknown;
  try {
    args = typeof toolCall.function.arguments === "string"
      ? toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {}
      : toolCall.function.arguments ?? {};
  } catch {
    return {
      args: {} as Record<string, unknown>,
      execution: {
        ok: false,
        invalid: true,
        output: {
          accepted: false,
          error: `Malformed JSON arguments for ${toolCall.function.name}.`
        }
      }
    };
  }
  return {
    args,
    execution: executeTool(toolCall.function.name, args, {
      game: context.game,
      agentColor: context.color,
      agent: context.agent
    })
  };
}
