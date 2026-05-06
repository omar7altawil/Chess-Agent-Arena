import type { AgentConfig } from "../shared/types.js";
import type { ChatCompletionRequest, ChatCompletionResponse } from "./types.js";

export class OpenAICompatibleClient {
  constructor(private readonly agent: AgentConfig) {}

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const apiKey = process.env[this.agent.model.api_key_env];
    if (!apiKey) {
      throw new Error(`Missing API key environment variable: ${this.agent.model.api_key_env}`);
    }

    const url = toChatCompletionsUrl(this.agent.model.base_url);
    let attemptedModel = request.model;
    try {
      let attempt = await sendRequest(url, apiKey, request, this.agent.model.tool_mode ?? "native");
      attemptedModel = attempt.model;

      if (!attempt.response.ok && shouldFallbackToOpenRouterFree(this.agent.model.provider, attempt.model, attempt.response.status)) {
        console.warn(`[model] fallback model=${attempt.model} status=${attempt.response.status} -> openrouter/free`);
        attempt = await sendRequest(url, apiKey, { ...request, model: "openrouter/free" }, this.agent.model.tool_mode ?? "native");
        attemptedModel = attempt.model;
      }

      if (!attempt.response.ok) {
        throw new Error(`Model request failed (${attempt.response.status}): ${redactSecrets(attempt.bodyText).slice(0, 600)}`);
      }
      try {
        return JSON.parse(attempt.bodyText) as ChatCompletionResponse;
      } catch {
        throw new Error(`Model response was not valid JSON: ${redactSecrets(attempt.bodyText).slice(0, 300)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown model request failure";
      console.error(`[model] error model=${attemptedModel}: ${redactSecrets(message)}`);
      throw error;
    }
  }
}

async function sendRequest(
  url: string,
  apiKey: string,
  request: ChatCompletionRequest,
  mode: string
): Promise<{ response: Response; bodyText: string; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  const startedAt = Date.now();
  console.log(`[model] request provider=openrouter-compatible model=${request.model} mode=${mode} tools=${request.tools?.length ?? 0}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Chess Agent Arena"
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const bodyText = await response.text();
    console.log(`[model] response status=${response.status} model=${request.model} latency_ms=${Date.now() - startedAt}`);
    return { response, bodyText, model: request.model };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldFallbackToOpenRouterFree(provider: string, model: string, status: number): boolean {
  return provider === "openrouter" && model !== "openrouter/free" && [429, 502, 503, 529].includes(status);
}

function redactSecrets(input: string): string {
  return input
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted-openrouter-key]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-api-key]");
}

function toChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}
