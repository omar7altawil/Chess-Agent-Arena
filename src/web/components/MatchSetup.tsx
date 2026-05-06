import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BrainCircuit,
  Check,
  Copy,
  Eraser,
  ExternalLink,
  KeyRound,
  Loader2,
  Play,
  Search,
  Swords,
  TriangleAlert,
  User,
  Wand2
} from "lucide-react";
import {
  deleteOpenRouterKey,
  fetchOpenRouterKeyStatus,
  fetchOpenRouterModels,
  saveOpenRouterKey,
  testOpenRouterModel
} from "../api";
import type {
  GameSnapshot,
  MatchConfig,
  OpenRouterKeyStatus,
  OpenRouterModelSummary,
  PlayerColor,
  PlayerConfig
} from "../types";

const FALLBACK_MODEL = "openrouter/auto";
const DEFAULT_PROMPT_FILE = "prompts/cautious_chess_agent.md";
const ALL_TOOLS = [
  "get_board_state",
  "get_legal_moves",
  "inspect_square",
  "get_move_history",
  "get_game_status",
  "make_move",
  "resign",
  "offer_draw",
  "respond_to_draw_offer"
];

type SetupPlayerType = "human" | "llm";

interface PlayerDraft {
  type: SetupPlayerType;
  name: string;
  model: string;
}

export function MatchSetup({
  game,
  onStart,
  onCancel,
  onError,
  variant = "primary"
}: {
  game: GameSnapshot;
  onStart: (config: MatchConfig) => void;
  onCancel?: () => void;
  onError?: (error: string | null) => void;
  variant?: "primary" | "rail";
}) {
  const [keyStatus, setKeyStatus] = useState<OpenRouterKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<OpenRouterModelSummary[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(true);
  const [modelQuery, setModelQuery] = useState("");
  const [white, setWhite] = useState<PlayerDraft>(() => buildDraft(game.config.players.white, "Human"));
  const [black, setBlack] = useState<PlayerDraft>(() => buildDraft(game.config.players.black, "LLM Agent", "llm"));
  const [test, setTest] = useState<{ color: PlayerColor | null; loading: boolean; message: string | null; ok: boolean }>(
    { color: null, loading: false, message: null, ok: false }
  );

  useEffect(() => {
    fetchOpenRouterKeyStatus().then(setKeyStatus).catch(() => setKeyStatus(null));
  }, []);

  useEffect(() => {
    setModelsLoading(true);
    setModelError(null);
    fetchOpenRouterModels(freeOnly)
      .then((items) => {
        setModels(items);
        const fallback = preferredModel(items);
        if (fallback) {
          setWhite((draft) => draft.model === FALLBACK_MODEL ? { ...draft, model: fallback.id } : draft);
          setBlack((draft) => draft.model === FALLBACK_MODEL ? { ...draft, model: fallback.id } : draft);
        }
      })
      .catch((error: Error) => setModelError(error.message))
      .finally(() => setModelsLoading(false));
  }, [freeOnly]);

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    const list = query
      ? models.filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(query))
      : models;
    return list.slice(0, 200);
  }, [modelQuery, models]);

  const llmReady = (draft: PlayerDraft) => draft.type !== "llm" || !!draft.model.trim();
  const requiresKey = white.type === "llm" || black.type === "llm";
  const setupReady = llmReady(white) && llmReady(black) && (!requiresKey || keyStatus?.configured);

  const startMatch = () => {
    onError?.(null);
    if (!setupReady) {
      onError?.("Pick a model for both LLM sides and configure an OpenRouter key.");
      return;
    }
    const config = buildMatchConfig(game.config, white, black);
    onStart(config);
  };

  const swapColors = () => {
    setWhite(black);
    setBlack(white);
  };

  const mirrorWhiteToBlack = () => setBlack({ ...white, name: white.name === black.name ? black.name : `Mirror ${white.name}` });
  const mirrorBlackToWhite = () => setWhite({ ...black, name: black.name === white.name ? white.name : `Mirror ${black.name}` });

  const saveKey = async () => {
    setKeyMessage(null);
    try {
      const status = await saveOpenRouterKey(apiKey);
      setKeyStatus(status);
      setApiKey("");
      setKeyMessage("OpenRouter key saved.");
    } catch (error) {
      setKeyMessage(error instanceof Error ? error.message : "Unable to save key.");
    }
  };

  const clearKey = async () => {
    try {
      const status = await deleteOpenRouterKey();
      setKeyStatus(status);
      setKeyMessage("OpenRouter key cleared.");
    } catch (error) {
      setKeyMessage(error instanceof Error ? error.message : "Unable to clear key.");
    }
  };

  const runTest = async (color: PlayerColor) => {
    const draft = color === "white" ? white : black;
    if (!draft.model.trim()) {
      setTest({ color, loading: false, message: "Pick a model first.", ok: false });
      return;
    }
    setTest({ color, loading: true, message: null, ok: false });
    try {
      const result = await testOpenRouterModel(draft.model.trim());
      setTest({ color, loading: false, message: `OK · ${result.model} · ${result.latencyMs}ms`, ok: true });
    } catch (error) {
      setTest({ color, loading: false, message: error instanceof Error ? error.message : "Test failed.", ok: false });
    }
  };

  return (
    <div className={`match-setup ${variant}`}>
      <header className="setup-header">
        <div>
          <h2><Swords size={20} /> Match Setup</h2>
          <p>Pick a player for each color and start the match.</p>
        </div>
        {variant === "primary" && onCancel && (
          <button onClick={onCancel}>Back to game</button>
        )}
      </header>

      {requiresKey && (
        <section className="setup-key panel">
          <div className="setup-key-head">
            <h3><KeyRound size={16} /> OpenRouter</h3>
            <span className={`key-status ${keyStatus?.configured ? "ready" : ""}`}>
              {keyStatus?.configured ? <Check size={14} /> : <KeyRound size={14} />}
              {keyStatus?.configured ? `key ready ${keyStatus.masked ?? ""}` : "no key configured"}
            </span>
          </div>
          <div className="key-row">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              placeholder="Paste OpenRouter API key"
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <button onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide" : "Show"}</button>
            <button className="primary" disabled={apiKey.length < 8} onClick={() => void saveKey()}>Save</button>
            {keyStatus?.configured && (
              <button onClick={() => void clearKey()}><Eraser size={15} /> Clear</button>
            )}
            <a className="external-link" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> get key
            </a>
          </div>
          {keyMessage && <p className={`hint ${keyMessage.startsWith("Open") || keyMessage.includes("cleared") ? "" : "error-text"}`}>{keyMessage}</p>}
        </section>
      )}

      {requiresKey && (
        <section className="setup-toolbar panel">
          <div className="setup-toolbar-row">
            <label className="checkbox-line">
              <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
              Free models only
            </label>
            <div className="search-box">
              <Search size={15} />
              <input value={modelQuery} placeholder="Search models" onChange={(event) => setModelQuery(event.target.value)} />
            </div>
            <button onClick={() => {
              setModelsLoading(true);
              setModelError(null);
              fetchOpenRouterModels(freeOnly)
                .then(setModels)
                .catch((error: Error) => setModelError(error.message))
                .finally(() => setModelsLoading(false));
            }}>
              {modelsLoading ? <Loader2 className="spin" size={15} /> : "Refresh"}
            </button>
            <span className="hint">{models.length} models loaded</span>
          </div>
          {modelError && <p className="hint error-text"><TriangleAlert size={14} /> {modelError}</p>}
          <div className="setup-mirror-row">
            <button onClick={mirrorWhiteToBlack}><Copy size={14} /> Mirror White → Black</button>
            <button onClick={mirrorBlackToWhite}><Copy size={14} /> Mirror Black → White</button>
            <button onClick={swapColors}><ArrowLeftRight size={14} /> Swap colors</button>
          </div>
        </section>
      )}

      <div className="setup-grid">
        <PlayerCard
          color="white"
          draft={white}
          onChange={setWhite}
          models={filteredModels}
          allModels={models}
          onTest={() => void runTest("white")}
          test={test.color === "white" ? test : null}
        />
        <PlayerCard
          color="black"
          draft={black}
          onChange={setBlack}
          models={filteredModels}
          allModels={models}
          onTest={() => void runTest("black")}
          test={test.color === "black" ? test : null}
        />
      </div>

      <div className="setup-actions">
        <button className="primary wide" disabled={!setupReady} onClick={startMatch}>
          <Play size={16} /> Start Match
        </button>
        {!setupReady && requiresKey && !keyStatus?.configured && (
          <p className="hint error-text">An OpenRouter key is required for LLM players.</p>
        )}
      </div>
    </div>
  );
}

function PlayerCard({
  color,
  draft,
  onChange,
  models,
  allModels,
  onTest,
  test
}: {
  color: PlayerColor;
  draft: PlayerDraft;
  onChange: (draft: PlayerDraft) => void;
  models: OpenRouterModelSummary[];
  allModels: OpenRouterModelSummary[];
  onTest: () => void;
  test: { loading: boolean; message: string | null; ok: boolean } | null;
}) {
  const set = (patch: Partial<PlayerDraft>) => onChange({ ...draft, ...patch });
  const selectedModel = allModels.find((model) => model.id === draft.model);

  return (
    <article className={`player-card ${color}`}>
      <header className="player-card-head">
        <span className={`color-dot ${color}`} />
        <h3>{color === "white" ? "White" : "Black"}</h3>
        <input className="player-name" value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </header>

      <div className="segmented full">
        <button className={draft.type === "human" ? "active" : ""} onClick={() => set({ type: "human" })}>
          <User size={14} /> Human
        </button>
        <button className={draft.type === "llm" ? "active" : ""} onClick={() => set({ type: "llm" })}>
          <BrainCircuit size={14} /> LLM
        </button>
      </div>

      {draft.type === "llm" && (
        <div className="player-section">
          <label>Model</label>
          <select value={draft.model} onChange={(event) => set({ model: event.target.value })}>
            {!models.some((item) => item.id === draft.model) && draft.model && (
              <option value={draft.model}>{draft.model}</option>
            )}
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.free ? "Free · " : ""}{item.name}
              </option>
            ))}
          </select>
          {selectedModel && (
            <p className="hint">
              {selectedModel.contextLength ? `${(selectedModel.contextLength / 1000).toFixed(0)}k context · ` : ""}
              {selectedModel.free ? "free" : `$${selectedModel.promptPrice}/in · $${selectedModel.completionPrice}/out`}
            </p>
          )}
          <button className="test-btn" onClick={onTest}>
            {test?.loading ? <Loader2 className="spin" size={14} /> : <Wand2 size={14} />} Test model
          </button>
          {test?.message && (
            <p className={`hint ${test.ok ? "ok-text" : "error-text"}`}>{test.message}</p>
          )}
        </div>
      )}
    </article>
  );
}

function buildDraft(player: PlayerConfig, defaultName: string, defaultType: SetupPlayerType = "human"): PlayerDraft {
  const type: SetupPlayerType = player.type === "llm" ? "llm" : player.type === "human" ? "human" : defaultType;
  const model = player.agent?.model.model_name ?? FALLBACK_MODEL;
  const name = player.name && player.name !== "Pick a player" ? player.name : defaultName;
  return { type, name, model };
}

function buildMatchConfig(source: MatchConfig, white: PlayerDraft, black: PlayerDraft): MatchConfig {
  const config = JSON.parse(JSON.stringify(source)) as MatchConfig;
  config.match.id = `setup_${Date.now()}`;
  config.match.output_dir = `runs/${config.match.id}`;
  config.match.auto_start = true;
  config.players.white = buildPlayer(white, source.players.white);
  config.players.black = buildPlayer(black, source.players.black);
  return config;
}

function buildPlayer(draft: PlayerDraft, source: PlayerConfig): PlayerConfig {
  if (draft.type === "human") {
    return { type: "human", name: draft.name || "Human Player" };
  }
  const baseAgent = source.agent ?? defaultAgent(draft);
  return {
    type: "llm",
    name: draft.name || "LLM Agent",
    agent_config: source.agent_config ?? "agents/openrouter_chess_agent.yaml",
    agent: {
      ...baseAgent,
      name: draft.name || baseAgent.name,
      model: {
        ...baseAgent.model,
        provider: "openrouter",
        model_name: draft.model.trim() || FALLBACK_MODEL,
        base_url: "https://openrouter.ai/api/v1",
        api_key_env: "OPENROUTER_API_KEY",
        temperature: 0.2,
        tool_mode: "native"
      },
      prompt: {
        system_prompt_file: baseAgent.prompt.system_prompt_file || DEFAULT_PROMPT_FILE
      },
      behavior: {
        ...baseAgent.behavior,
        tool_tier: "all"
      },
      tools: ALL_TOOLS
    }
  };
}

function defaultAgent(draft: PlayerDraft) {
  return {
    id: "openrouter_chess_agent",
    name: draft.name,
    type: "llm" as const,
    model: {
      provider: "openrouter",
      model_name: draft.model,
      base_url: "https://openrouter.ai/api/v1",
      api_key_env: "OPENROUTER_API_KEY",
      temperature: 0.2,
      max_output_tokens: 900,
      timeout_seconds: 60,
      tool_mode: "native" as const
    },
    prompt: {
      system_prompt_file: DEFAULT_PROMPT_FILE
    },
    behavior: {
      tool_tier: "all",
      max_tool_calls_per_turn: 5,
      max_invalid_actions_per_turn: 2,
      require_make_move: true,
      allow_resign: true,
      allow_draw_offer: true
    },
    memory: {
      mode: "external_summary" as const,
      max_summary_chars: 3000
    },
    tools: ALL_TOOLS
  };
}

function preferredModel(items: OpenRouterModelSummary[]): OpenRouterModelSummary | undefined {
  const preferredIds = [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "z-ai/glm-4.5-air:free",
    "meta-llama/llama-3.3-70b-instruct:free"
  ];
  return preferredIds
    .map((id) => items.find((model) => model.id === id))
    .find((model) => Boolean(model && model.supportsTools)) ?? items.find((model) => model.free && model.supportsTools);
}
