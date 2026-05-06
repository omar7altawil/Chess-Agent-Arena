import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const SECRET_PATH = path.resolve(process.cwd(), ".chess-agent-arena.secrets.json");

interface LocalSecrets {
  openrouterApiKey?: string;
  updatedAt?: string;
}

let openRouterKeySource: "environment" | "local_file" | null = process.env.OPENROUTER_API_KEY ? "environment" : null;

export async function loadLocalSecrets(): Promise<void> {
  if (process.env.OPENROUTER_API_KEY) {
    openRouterKeySource = "environment";
    return;
  }

  try {
    const text = (await readFile(SECRET_PATH, "utf8")).replace(/^\uFEFF/, "");
    const secrets = JSON.parse(text) as LocalSecrets;
    if (secrets.openrouterApiKey) {
      process.env.OPENROUTER_API_KEY = secrets.openrouterApiKey;
      openRouterKeySource = "local_file";
    }
  } catch {
    openRouterKeySource = null;
  }
}

export async function saveOpenRouterKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OpenRouter key cannot be empty.");
  }

  process.env.OPENROUTER_API_KEY = trimmed;
  openRouterKeySource = "local_file";

  await mkdir(path.dirname(SECRET_PATH), { recursive: true });
  await writeFile(
    SECRET_PATH,
    JSON.stringify({ openrouterApiKey: trimmed, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export async function clearOpenRouterKey(): Promise<void> {
  delete process.env.OPENROUTER_API_KEY;
  openRouterKeySource = null;
  try {
    await unlink(SECRET_PATH);
  } catch {
    // No local secrets file present — nothing to remove.
  }
}

export function getOpenRouterKeyStatus() {
  const configured = Boolean(process.env.OPENROUTER_API_KEY);
  return {
    configured,
    keyEnv: "OPENROUTER_API_KEY",
    source: configured ? openRouterKeySource ?? "environment" : null,
    localPath: SECRET_PATH,
    masked: configured ? maskKey(process.env.OPENROUTER_API_KEY ?? "") : null
  };
}

function maskKey(key: string): string {
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
