import type {
  GameSnapshot,
  MatchConfig,
  OpenRouterKeyStatus,
  OpenRouterModelSummary,
  OpenRouterTestResult,
  ResultsSummary
} from "./types";

export async function fetchGame(): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game");
}

export async function postMove(move: string): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/move", {
    method: "POST",
    body: JSON.stringify({ move })
  });
}

export async function postStart(): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/start", { method: "POST" });
}

export async function postPause(): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/pause", { method: "POST" });
}

export async function postResume(): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/resume", { method: "POST" });
}

export async function postResign(color: string): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/resign", {
    method: "POST",
    body: JSON.stringify({ color })
  });
}

export async function postNewGame(config: MatchConfig): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/new", {
    method: "POST",
    body: JSON.stringify({ config })
  });
}

export async function postRematch(swapColors = false): Promise<GameSnapshot> {
  return request<GameSnapshot>("/api/game/rematch", {
    method: "POST",
    body: JSON.stringify({ swapColors })
  });
}

export async function deleteOpenRouterKey(): Promise<OpenRouterKeyStatus> {
  return request<OpenRouterKeyStatus>("/api/openrouter/key", {
    method: "DELETE"
  });
}

export async function fetchResults(): Promise<ResultsSummary[]> {
  return request<ResultsSummary[]>("/api/results");
}

export async function fetchOpenRouterKeyStatus(): Promise<OpenRouterKeyStatus> {
  return request<OpenRouterKeyStatus>("/api/openrouter/key");
}

export async function saveOpenRouterKey(apiKey: string): Promise<OpenRouterKeyStatus> {
  return request<OpenRouterKeyStatus>("/api/openrouter/key", {
    method: "POST",
    body: JSON.stringify({ apiKey })
  });
}

export async function fetchOpenRouterModels(freeOnly = false): Promise<OpenRouterModelSummary[]> {
  const params = freeOnly ? "?freeOnly=true" : "";
  return request<OpenRouterModelSummary[]>(`/api/openrouter/models${params}`);
}

export async function testOpenRouterModel(model: string): Promise<OpenRouterTestResult> {
  return request<OpenRouterTestResult>("/api/openrouter/test", {
    method: "POST",
    body: JSON.stringify({ model })
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || body.error?.message || body.error || body.message || response.statusText);
  }
  return response.json() as Promise<T>;
}
