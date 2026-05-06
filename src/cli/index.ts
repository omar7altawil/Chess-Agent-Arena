#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMatchConfig } from "../config/loadConfig.js";
import { loadLocalSecrets } from "../config/secrets.js";
import { startLocalServer } from "../server/createServer.js";
import { MatchRunner } from "../runtime/matchRunner.js";

const program = new Command();

program
  .name("chess-agent-arena")
  .description("Local chess arena for humans, bots, and configurable LLM agents.")
  .version("0.1.0");

program
  .command("dev")
  .description("Start the local web app.")
  .requiredOption("-c, --config <path>", "Match config path")
  .option("-p, --port <port>", "Port override")
  .action(async (options: { config: string; port?: string }) => {
    await loadLocalSecrets();
    const config = await loadMatchConfig(options.config);
    const port = Number(options.port ?? config.server?.port ?? 3000);
    const server = await startLocalServer(config, port);
    console.log(`Chess Agent Arena running at ${server.url}`);
  });

program
  .command("run")
  .description("Run a headless match from config.")
  .requiredOption("-c, --config <path>", "Match config path")
  .action(async (options: { config: string }) => {
    await loadLocalSecrets();
    const config = await loadMatchConfig(options.config);
    const runner = new MatchRunner(config);
    await runner.init();
    const snapshot = await runner.runToCompletion();
    console.log(`Result: ${snapshot.result}`);
    console.log(`End reason: ${snapshot.endReason ?? "active"}`);
    console.log(`Output: ${path.resolve(process.cwd(), config.match.output_dir)}`);
  });

program
  .command("validate")
  .description("Validate a match config and referenced agent configs.")
  .requiredOption("-c, --config <path>", "Match config path")
  .action(async (options: { config: string }) => {
    const config = await loadMatchConfig(options.config);
    console.log(`OK: ${config.match.id}`);
  });

program
  .command("init")
  .description("Generate local files (.env, runs/) so the app is ready to start.")
  .action(async () => {
    const fs = await import("node:fs/promises");
    await mkdir("runs", { recursive: true });
    try {
      await fs.access(".env");
      console.log(".env already present, leaving it untouched.");
    } catch {
      try {
        const example = await fs.readFile(".env.example", "utf8");
        await writeFile(".env", example, "utf8");
        console.log("Wrote .env from .env.example. Open it and add OPENROUTER_API_KEY to use LLM agents.");
      } catch {
        await writeFile(
          ".env",
          "OPENROUTER_API_KEY=\nOPENROUTER_BASE_URL=https://openrouter.ai/api/v1\n",
          "utf8"
        );
        console.log("Wrote a minimal .env. Add OPENROUTER_API_KEY to use LLM agents.");
      }
    }
    console.log("Example configs live in configs/, agents/, and prompts/.");
    console.log("Run 'npm run match' to start the app on the Setup view, or 'npm run dev' for a quick Human-vs-Bot game.");
  });

program
  .command("export-pgn")
  .description("Print a run's PGN.")
  .argument("<runDir>", "Run directory")
  .action(async (runDir: string) => {
    const pgn = await import("node:fs/promises").then((fs) => fs.readFile(path.join(runDir, "game.pgn"), "utf8"));
    console.log(pgn);
  });

program
  .command("replay")
  .description("Print a replay JSON file.")
  .argument("<replayJson>", "Replay JSON path")
  .action(async (replayJson: string) => {
    const replay = await import("node:fs/promises").then((fs) => fs.readFile(replayJson, "utf8"));
    console.log(replay);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
