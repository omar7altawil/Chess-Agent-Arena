import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { AgentConfig, MatchConfig, PlayerConfig } from "../shared/types.js";

const playerSchema = z.object({
  type: z.enum(["human", "bot", "llm"]),
  name: z.string().min(1),
  bot: z.enum(["random", "heuristic"]).optional(),
  agent_config: z.string().optional(),
  agent: z.any().optional()
});

const matchSchema = z.object({
  match: z.object({
    id: z.string().min(1),
    output_dir: z.string().min(1),
    max_plies: z.coerce.number().int().positive().default(300),
    auto_start: z.coerce.boolean().default(true)
  }),
  server: z.object({ port: z.coerce.number().int().positive().optional() }).optional(),
  ui: z.object({
    board_theme: z.string().default("classic"),
    piece_set: z.string().default("standard"),
    animation_ms: z.coerce.number().int().nonnegative().default(180),
    show_legal_moves: z.coerce.boolean().default(true),
    show_last_move: z.coerce.boolean().default(true),
    show_coordinates: z.coerce.boolean().default(true),
    enable_sound: z.coerce.boolean().default(false)
  }),
  chess: z.object({
    starting_position: z.enum(["standard", "fen"]).default("standard"),
    starting_fen: z.string().nullable().default(null),
    rules: z.object({
      threefold_repetition: z.coerce.boolean().default(true),
      fifty_move_rule: z.coerce.boolean().default(true),
      insufficient_material: z.coerce.boolean().default(true)
    }),
    clocks: z.object({
      enabled: z.coerce.boolean().default(false),
      initial_seconds: z.coerce.number().int().positive().default(600),
      increment_seconds: z.coerce.number().int().nonnegative().default(2)
    })
  }),
  players: z.object({
    white: playerSchema,
    black: playerSchema
  })
});

const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("llm"),
  model: z.object({
    provider: z.string().min(1),
    model_name: z.string().min(1),
    base_url: z.string().min(1),
    api_key_env: z.string().min(1),
    temperature: z.coerce.number().default(0.2),
    max_output_tokens: z.coerce.number().int().positive().default(900),
    timeout_seconds: z.coerce.number().int().positive().default(60),
    tool_mode: z.enum(["native", "json"]).optional().default("native")
  }),
  prompt: z.object({
    system_prompt_file: z.string().min(1),
    system_prompt: z.string().optional()
  }),
  behavior: z.object({
    tool_tier: z.string().default("tier_1"),
    max_tool_calls_per_turn: z.coerce.number().int().positive().default(5),
    max_invalid_actions_per_turn: z.coerce.number().int().nonnegative().default(2),
    require_make_move: z.coerce.boolean().default(true),
    allow_resign: z.coerce.boolean().default(true),
    allow_draw_offer: z.coerce.boolean().default(true)
  }),
  memory: z.object({
    mode: z.enum(["none", "external_summary"]).default("external_summary"),
    max_summary_chars: z.coerce.number().int().positive().default(3000)
  }),
  tools: z.array(z.string()).default([])
});

export async function loadMatchConfig(configPath: string, cwd = process.cwd()): Promise<MatchConfig> {
  const absoluteConfigPath = path.resolve(cwd, configPath);
  const configText = await readFile(absoluteConfigPath, "utf8");
  const parsed = YAML.parse(resolveEnv(configText));
  const config = matchSchema.parse(parsed) as MatchConfig;
  await hydrateAgents(config, path.dirname(absoluteConfigPath));
  return config;
}

export async function hydrateAgents(config: MatchConfig, baseDir = process.cwd()): Promise<void> {
  await Promise.all([
    hydratePlayer(config.players.white, baseDir),
    hydratePlayer(config.players.black, baseDir)
  ]);
}

export function validateMatchConfigObject(value: unknown): MatchConfig {
  return matchSchema.parse(value) as MatchConfig;
}

export function sanitizeConfig(config: MatchConfig): MatchConfig {
  return JSON.parse(JSON.stringify(config)) as MatchConfig;
}

async function hydratePlayer(player: PlayerConfig, baseDir: string): Promise<void> {
  if (player.type !== "llm") {
    return;
  }

  if (player.agent) {
    if (!player.agent.prompt.system_prompt) {
      const prompt = await readReferencedFile(process.cwd(), player.agent.prompt.system_prompt_file);
      player.agent.prompt.system_prompt = prompt.text;
    }
    return;
  }

  if (!player.agent_config) {
    throw new Error(`LLM player '${player.name}' is missing agent_config.`);
  }

  const { absolutePath: absoluteAgentPath, text: agentText } = await readReferencedFile(baseDir, player.agent_config);
  const agent = agentSchema.parse(YAML.parse(resolveEnv(agentText))) as AgentConfig;
  const prompt = await readReferencedFile(path.dirname(absoluteAgentPath), agent.prompt.system_prompt_file);
  agent.prompt.system_prompt = prompt.text;
  player.agent = agent;
}

async function readReferencedFile(baseDir: string, reference: string): Promise<{ absolutePath: string; text: string }> {
  const candidates = path.isAbsolute(reference)
    ? [reference]
    : [
        path.resolve(baseDir, reference),
        path.resolve(baseDir, "..", reference),
        path.resolve(process.cwd(), reference)
      ];
  for (const candidate of candidates) {
    try {
      return {
        absolutePath: candidate,
        text: await readFile(candidate, "utf8")
      };
    } catch {
      // Try the next conventional location.
    }
  }
  throw new Error(`Unable to read referenced file: ${reference}`);
}

function resolveEnv(input: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?}/gi, (_match, key: string, fallback: string | undefined) => {
    return process.env[key] ?? fallback ?? "";
  });
}
