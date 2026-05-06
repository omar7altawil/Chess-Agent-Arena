import type { AgentActivity, MatchConfig, PlayerConfig } from "../shared/types.js";

export const EMPTY_ACTIVITY: AgentActivity = {
  thinking: false,
  color: null,
  playerName: null,
  latestExplanation: null,
  toolCallsThisTurn: 0,
  invalidActionsThisTurn: 0,
  warnings: [],
  recentToolCalls: [],
  recentModelCalls: []
};

export function createMatchConfigFromPlayers(white: PlayerConfig, black: PlayerConfig): MatchConfig {
  const id = readableRunId(white, black);
  return {
    match: {
      id,
      output_dir: `runs/${id}`,
      max_plies: 300,
      auto_start: true
    },
    server: { port: 3000 },
    ui: {
      board_theme: "classic",
      piece_set: "standard",
      animation_ms: 180,
      show_legal_moves: true,
      show_last_move: true,
      show_coordinates: true,
      enable_sound: false
    },
    chess: {
      starting_position: "standard",
      starting_fen: null,
      rules: {
        threefold_repetition: true,
        fifty_move_rule: true,
        insufficient_material: true
      },
      clocks: {
        enabled: false,
        initial_seconds: 600,
        increment_seconds: 2
      }
    },
    players: { white, black }
  };
}

export function readableRunId(white: PlayerConfig, black: PlayerConfig): string {
  const date = new Date();
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  const slug = `${playerSlug(white)}_vs_${playerSlug(black)}`;
  return `${slug}_${datePart}_${timePart}`;
}

function playerSlug(player: PlayerConfig): string {
  if (player.type === "llm") {
    const model = player.agent?.model.model_name ?? "llm";
    return shortModelSlug(model);
  }
  if (player.type === "bot") {
    return `${player.bot ?? "bot"}_bot`;
  }
  return "human";
}

function shortModelSlug(model: string): string {
  const last = model.split("/").pop() ?? model;
  return last
    .replace(/:free$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .toLowerCase() || "llm";
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
