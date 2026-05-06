import express from "express";
import { createServer as createViteServer } from "vite";
import type { Server } from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { MatchConfig } from "../shared/types.js";
import { hydrateAgents, validateMatchConfigObject } from "../config/loadConfig.js";
import { createMatchConfigFromPlayers } from "../config/defaults.js";
import { listResults } from "../logging/eventLogger.js";
import { MatchRunner } from "../runtime/matchRunner.js";
import { getOpenRouterKeyStatus, loadLocalSecrets, saveOpenRouterKey } from "../config/secrets.js";

export interface LocalServer {
  runner: MatchRunner;
  server: Server;
  url: string;
}

export async function startLocalServer(initialConfig: MatchConfig, port = 3000): Promise<LocalServer> {
  await loadLocalSecrets();
  let runner = new MatchRunner(initialConfig);
  const clients = new Set<express.Response>();
  const broadcastSnapshot = () => {
    const payload = JSON.stringify(runner.getSnapshot());
    for (const client of clients) {
      client.write("event: snapshot\n");
      client.write(`data: ${payload}\n\n`);
    }
  };
  let snapshotListener = () => broadcastSnapshot();
  const attachRunner = (nextRunner: MatchRunner) => {
    runner.off("snapshot", snapshotListener);
    runner = nextRunner;
    snapshotListener = () => broadcastSnapshot();
    runner.on("snapshot", snapshotListener);
    broadcastSnapshot();
  };
  await runner.init();
  runner.on("snapshot", snapshotListener);
  if (initialConfig.match.auto_start) {
    await runner.start();
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/game", (_req, res) => {
    res.json(runner.getSnapshot());
  });

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.add(res);
    res.write("event: snapshot\n");
    res.write(`data: ${JSON.stringify(runner.getSnapshot())}\n\n`);
    req.on("close", () => {
      clients.delete(res);
    });
  });

  app.post("/api/game/start", async (_req, res, next) => {
    try {
      await runner.start();
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/game/pause", async (_req, res, next) => {
    try {
      await runner.pause();
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/game/resume", async (_req, res, next) => {
    try {
      await runner.resume();
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/game/move", async (req, res, next) => {
    try {
      const move = String(req.body?.move ?? "");
      const result = await runner.humanMove(move);
      if (!result.ok) {
        res.status(400).json(result);
        return;
      }
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/game/resign", async (req, res, next) => {
    try {
      const color = req.body?.color === "black" ? "black" : "white";
      await runner.resign(color);
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/game/new", async (req, res, next) => {
    try {
      const config = req.body?.config
        ? validateMatchConfigObject(req.body.config)
        : createMatchConfigFromPlayers(req.body.white, req.body.black);
      await hydrateAgents(config, process.cwd());
      const nextRunner = new MatchRunner(config);
      await nextRunner.init();
      attachRunner(nextRunner);
      if (config.match.auto_start) {
        await runner.start();
      }
      res.json(runner.getSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/results", async (_req, res, next) => {
    try {
      res.json(await listResults());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/results/:id/:file", async (req, res, next) => {
    try {
      const safeId = req.params.id.replace(/[^a-zA-Z0-9_.-]/g, "");
      const safeFile = req.params.file.replace(/[^a-zA-Z0-9_.-]/g, "");
      const filePath = path.resolve(process.cwd(), "runs", safeId, safeFile);
      if (!filePath.startsWith(path.resolve(process.cwd(), "runs"))) {
        res.status(400).send("Invalid path");
        return;
      }
      res.type(path.extname(filePath) === ".json" ? "application/json" : "text/plain");
      res.send(await readFile(filePath, "utf8"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/openrouter/key", (_req, res) => {
    res.json(getOpenRouterKeyStatus());
  });

  app.post("/api/openrouter/key", async (req, res, next) => {
    const apiKey = String(req.body?.apiKey ?? "").trim();
    if (apiKey.length < 8) {
      res.status(400).json({ error: "Enter a valid OpenRouter API key." });
      return;
    }
    try {
      await saveOpenRouterKey(apiKey);
      console.log("[openrouter] API key saved to local secrets file (redacted).");
      res.json(getOpenRouterKeyStatus());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/openrouter/models", async (req, res, next) => {
    try {
      const freeOnly = req.query.freeOnly === "true";
      const models = await fetchOpenRouterModels();
      const filtered = models
        .filter((model) => !freeOnly || model.free)
        .sort((a, b) => {
          const rankDiff = preferredModelRank(a.id) - preferredModelRank(b.id);
          if (rankDiff !== 0) return rankDiff;
          if (a.free !== b.free) return a.free ? -1 : 1;
          if (a.supportsTools !== b.supportsTools) return a.supportsTools ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/openrouter/test", async (req, res, next) => {
    try {
      const model = String(req.body?.model ?? "").trim();
      if (!model) {
        res.status(400).json({ error: "Select or enter a model id first." });
        return;
      }
      const result = await testOpenRouterModel(model);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);

  const server = app.listen(port);
  return {
    runner,
    server,
    url: `http://localhost:${port}`
  };
}

async function testOpenRouterModel(model: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("No OpenRouter key configured.");
  }

  const startedAt = Date.now();
  console.log(`[openrouter] test request model=${model}`);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Chess Agent Arena"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly OK." }],
      max_tokens: 8,
      temperature: 0
    })
  });
  const latencyMs = Date.now() - startedAt;
  const bodyText = await response.text();
  console.log(`[openrouter] test response status=${response.status} model=${model} latency_ms=${latencyMs}`);
  if (!response.ok) {
    throw new Error(`OpenRouter test failed (${response.status}): ${redactSecrets(bodyText).slice(0, 500)}`);
  }
  const body = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> };
  return {
    ok: true,
    model,
    status: response.status,
    latencyMs,
    message: body.choices?.[0]?.message?.content?.slice(0, 120) ?? ""
  };
}

function redactSecrets(input: string): string {
  return input
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted-openrouter-key]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-api-key]");
}

function preferredModelRank(id: string): number {
  const preferred = [
    "openrouter/free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "z-ai/glm-4.5-air:free",
    "minimax/minimax-m2.5:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ];
  const index = preferred.indexOf(id);
  return index === -1 ? 1000 : index;
}

async function fetchOpenRouterModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      ...(process.env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } : {})
    }
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch OpenRouter models (${response.status}).`);
  }
  const body = await response.json() as { data?: Array<Record<string, unknown>> };
  return (body.data ?? [])
    .filter((model) => Array.isArray((model.architecture as { output_modalities?: unknown[] } | undefined)?.output_modalities)
      ? ((model.architecture as { output_modalities: unknown[] }).output_modalities).includes("text")
      : true)
    .map((model) => {
      const pricing = model.pricing as { prompt?: string; completion?: string } | undefined;
      const supported = Array.isArray(model.supported_parameters) ? model.supported_parameters.map(String) : [];
      const id = String(model.id ?? "");
      const promptPrice = pricing?.prompt ?? "";
      const completionPrice = pricing?.completion ?? "";
      return {
        id,
        name: String(model.name ?? id),
        description: typeof model.description === "string" ? model.description.slice(0, 260) : undefined,
        contextLength: typeof model.context_length === "number" ? model.context_length : undefined,
        promptPrice,
        completionPrice,
        free: id.endsWith(":free") || (promptPrice === "0" && completionPrice === "0"),
        supportsTools: supported.includes("tools"),
        supportsStructuredOutputs: supported.includes("structured_outputs"),
        created: typeof model.created === "number" ? model.created : undefined
      };
    })
    .filter((model) => model.id);
}
