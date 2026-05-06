import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, KeyRound, Loader2, Search, Settings, User } from "lucide-react";
import { fetchOpenRouterKeyStatus, fetchOpenRouterModels, saveOpenRouterKey, testOpenRouterModel } from "../api";
import type { GameSnapshot, MatchConfig, OpenRouterModelSummary, PlayerConfig } from "../types";

type ArenaPlayerType = "human" | "llm";
const PLAYER_TYPES: ArenaPlayerType[] = ["human", "llm"];
const FALLBACK_MODEL = "openrouter/free";

export function ConfigPanel({ game, onNewGame }: { game: GameSnapshot; onNewGame: (config: MatchConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [whiteType, setWhiteType] = useState<ArenaPlayerType>(browserType(game.config.players.white.type, "white"));
  const [blackType, setBlackType] = useState<ArenaPlayerType>(browserType(game.config.players.black.type, "black"));
  const [whiteName, setWhiteName] = useState(game.config.players.white.name);
  const [blackName, setBlackName] = useState(game.config.players.black.name);
  const [whiteModel, setWhiteModel] = useState(modelFor(game.config.players.white));
  const [blackModel, setBlackModel] = useState(modelFor(game.config.players.black));
  const [whiteToolMode, setWhiteToolMode] = useState<"native" | "json">(game.config.players.white.agent?.model.tool_mode ?? "native");
  const [blackToolMode, setBlackToolMode] = useState<"native" | "json">(game.config.players.black.agent?.model.tool_mode ?? "native");
  const [apiKey, setApiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [models, setModels] = useState<OpenRouterModelSummary[]>([]);
  const [freeOnly, setFreeOnly] = useState(true);
  const [modelQuery, setModelQuery] = useState("");
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchOpenRouterKeyStatus()
      .then((status) => setKeyConfigured(status.configured))
      .catch(() => setKeyConfigured(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setModelsLoading(true);
    setModelError(null);
    fetchOpenRouterModels(freeOnly)
      .then((items) => {
        setModels(items);
        const firstFreeTools = preferredModel(items) ?? items.find((model) => model.free && model.supportsTools);
        const firstFree = items.find((model) => model.free);
        const preferred = firstFreeTools ?? firstFree;
        if (preferred) {
          setWhiteModel((current) => current === FALLBACK_MODEL ? preferred.id : current);
          setBlackModel((current) => current === FALLBACK_MODEL ? preferred.id : current);
        }
      })
      .catch((error: Error) => setModelError(error.message))
      .finally(() => setModelsLoading(false));
  }, [freeOnly, open]);

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    const source = query
      ? models.filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(query))
      : models;
    return source.slice(0, 140);
  }, [modelQuery, models]);

  const resolvedWhiteModel = resolveModel(whiteModel, models);
  const resolvedBlackModel = resolveModel(blackModel, models);
  const llmNeedsModel = (whiteType === "llm" && !resolvedWhiteModel) || (blackType === "llm" && !resolvedBlackModel);

  const draftConfig = useMemo(() => {
    const copy = structuredClone(game.config);
    copy.match.id = `local_${Date.now()}`;
    copy.match.output_dir = `runs/${copy.match.id}`;
    copy.players.white = buildPlayer(whiteType, whiteName, game.config.players.white, resolvedWhiteModel || whiteModel, whiteToolMode);
    copy.players.black = buildPlayer(blackType, blackName, game.config.players.black, resolvedBlackModel || blackModel, blackToolMode);
    return copy;
  }, [blackModel, blackName, blackToolMode, blackType, game.config, resolvedBlackModel, resolvedWhiteModel, whiteModel, whiteName, whiteToolMode, whiteType]);

  const saveKey = async () => {
    setKeyMessage(null);
    try {
      const status = await saveOpenRouterKey(apiKey);
      setKeyConfigured(status.configured);
      setApiKey("");
      setKeyMessage("OpenRouter key saved for this local server session.");
    } catch (error) {
      setKeyMessage(error instanceof Error ? error.message : "Unable to save key.");
    }
  };

  const useHumanVsModel = () => {
    setWhiteType("human");
    setBlackType("llm");
    setWhiteName("Human Player");
    setBlackName("OpenRouter Agent");
  };

  const useModelVsModel = () => {
    setWhiteType("llm");
    setBlackType("llm");
    setWhiteName("White Model");
    setBlackName("Black Model");
  };

  return (
    <section className="panel config-panel">
      <button className="panel-toggle" onClick={() => setOpen((value) => !value)}>
        <Settings size={17} /> Configure Match
      </button>
      {open && (
        <div className="config-body">
          <div className="openrouter-setup">
            <div className="setup-head">
              <h3><KeyRound size={16} /> OpenRouter</h3>
              <span className={keyConfigured ? "key-status ready" : "key-status"}>
                {keyConfigured ? <Check size={14} /> : <KeyRound size={14} />}
                {keyConfigured ? "key ready" : "no key"}
              </span>
            </div>
            <div className="key-row">
              <input
                type="password"
                value={apiKey}
                placeholder="Paste OpenRouter API key"
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
              />
              <button onClick={() => void saveKey()}>Save</button>
            </div>
            {keyMessage && <p className="hint">{keyMessage}</p>}
            <div className="model-toolbar">
              <label className="checkbox-line">
                <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
                Prefer free models
              </label>
              <div className="search-box">
                <Search size={15} />
                <input value={modelQuery} placeholder="Search models" onChange={(event) => setModelQuery(event.target.value)} />
              </div>
              <button onClick={() => {
                setModelsLoading(true);
                fetchOpenRouterModels(freeOnly)
                  .then(setModels)
                  .catch((error: Error) => setModelError(error.message))
                  .finally(() => setModelsLoading(false));
              }}>
                {modelsLoading ? <Loader2 className="spin" size={15} /> : "Refresh"}
              </button>
              <button onClick={() => {
                const modelToTest = resolvedBlackModel || resolvedWhiteModel || filteredModels[0]?.id || "";
                setTestLoading(true);
                setTestMessage(null);
                testOpenRouterModel(modelToTest)
                  .then((result) => setTestMessage(`Model OK: ${result.model} (${result.latencyMs}ms)`))
                  .catch((error: Error) => setTestMessage(error.message))
                  .finally(() => setTestLoading(false));
              }}>
                {testLoading ? <Loader2 className="spin" size={15} /> : "Test model"}
              </button>
            </div>
            {modelError && <p className="hint error-text">{modelError}</p>}
            {testMessage && <p className={`hint ${testMessage.startsWith("Model OK") ? "" : "error-text"}`}>{testMessage}</p>}
          </div>

          <div className="preset-row" aria-label="Arena presets">
            <button onClick={useHumanVsModel}><User size={15} /> Human vs Model</button>
            <button onClick={useModelVsModel}><BrainCircuit size={15} /> Model vs Model</button>
          </div>

          <PlayerEditor
            label="White"
            type={whiteType}
            name={whiteName}
            model={whiteModel}
            toolMode={whiteToolMode}
            models={filteredModels}
            onType={(type) => {
              setWhiteType(type);
              if (type === "human") setWhiteName("Human Player");
              if (type === "llm" && /bot/i.test(whiteName)) setWhiteName("White Model");
            }}
            onName={setWhiteName}
            onModel={(nextModel) => {
              setWhiteModel(nextModel);
              const selected = models.find((item) => item.id === nextModel);
              if (selected && !selected.supportsTools) setWhiteToolMode("json");
            }}
            onToolMode={setWhiteToolMode}
          />
          <PlayerEditor
            label="Black"
            type={blackType}
            name={blackName}
            model={blackModel}
            toolMode={blackToolMode}
            models={filteredModels}
            onType={(type) => {
              setBlackType(type);
              if (type === "human") setBlackName("Human Player");
              if (type === "llm" && /bot/i.test(blackName)) setBlackName("OpenRouter Agent");
            }}
            onName={setBlackName}
            onModel={(nextModel) => {
              setBlackModel(nextModel);
              const selected = models.find((item) => item.id === nextModel);
              if (selected && !selected.supportsTools) setBlackToolMode("json");
            }}
            onToolMode={setBlackToolMode}
          />
          {llmNeedsModel && <p className="hint error-text">Select a listed OpenRouter model or type a model id manually before starting an LLM match.</p>}
          <button className="primary wide" disabled={llmNeedsModel} onClick={() => onNewGame(draftConfig)}>
            Start New Match
          </button>
        </div>
      )}
    </section>
  );
}

function PlayerEditor({
  label,
  type,
  name,
  model,
  toolMode,
  models,
  onType,
  onName,
  onModel,
  onToolMode
}: {
  label: string;
  type: ArenaPlayerType;
  name: string;
  model: string;
  toolMode: "native" | "json";
  models: OpenRouterModelSummary[];
  onType: (type: ArenaPlayerType) => void;
  onName: (name: string) => void;
  onModel: (model: string) => void;
  onToolMode: (mode: "native" | "json") => void;
}) {
  return (
    <div className="player-editor">
      <label>{label}</label>
      <input value={name} onChange={(event) => onName(event.target.value)} />
      <div className="segmented">
        {PLAYER_TYPES.map((value) => (
          <button key={value} className={type === value ? "active" : ""} onClick={() => onType(value)}>
            {value === "human" ? <User size={15} /> : <BrainCircuit size={15} />}
            {value}
          </button>
        ))}
      </div>
      {type === "llm" && (
        <div className="llm-editor">
          <select value={model} onChange={(event) => onModel(event.target.value)}>
            <option value={model}>{model}</option>
            {models.filter((item) => item.id !== model).map((item) => (
              <option key={item.id} value={item.id}>
                {item.free ? "Free - " : ""}{item.name} ({item.id}){item.supportsTools ? " / tools" : ""}
              </option>
            ))}
          </select>
          <input value={model} onChange={(event) => onModel(event.target.value)} placeholder="Manual model id, e.g. qwen/qwen3-coder:free" />
          <div className="segmented">
            <button className={toolMode === "native" ? "active" : ""} onClick={() => onToolMode("native")}>native tools</button>
            <button className={toolMode === "json" ? "active" : ""} onClick={() => onToolMode("json")}>JSON action</button>
          </div>
          <p className="hint">Use native tools for models with tool support; use JSON action for weaker or non-tool models.</p>
        </div>
      )}
    </div>
  );
}

function modelFor(player: PlayerConfig): string {
  return player.agent?.model.model_name ?? FALLBACK_MODEL;
}

function resolveModel(model: string, models: OpenRouterModelSummary[]): string {
  const trimmed = model.trim();
  if (trimmed && trimmed !== FALLBACK_MODEL) return trimmed;
  return preferredModel(models)?.id ?? models.find((item) => item.free && item.supportsTools)?.id ?? models.find((item) => item.free)?.id ?? "";
}

function preferredModel(models: OpenRouterModelSummary[]): OpenRouterModelSummary | undefined {
  const preferredIds = [
    "openrouter/free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "z-ai/glm-4.5-air:free",
    "minimax/minimax-m2.5:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ];
  return preferredIds.map((id) => models.find((model) => model.id === id && model.free && model.supportsTools)).find(Boolean);
}

function buildPlayer(
  type: ArenaPlayerType,
  name: string,
  source: PlayerConfig,
  model: string,
  toolMode: "native" | "json"
): PlayerConfig {
  if (type === "llm") {
    return {
      type,
      name,
      agent_config: source.agent_config ?? "agents/openrouter_chess_agent.yaml",
      agent: buildAgent(source, name, model, toolMode)
    };
  }
  return { type, name };
}

function browserType(type: PlayerConfig["type"], color: "white" | "black"): ArenaPlayerType {
  if (type === "llm") return "llm";
  if (type === "bot" && color === "black") return "llm";
  return "human";
}

function buildAgent(source: PlayerConfig, name: string, model: string, toolMode: "native" | "json") {
  const base = source.agent ? structuredClone(source.agent) : {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_agent`,
    name,
    type: "llm" as const,
    model: {
      provider: "openrouter",
      model_name: model,
      base_url: "https://openrouter.ai/api/v1",
      api_key_env: "OPENROUTER_API_KEY",
      temperature: 0.2,
      max_output_tokens: 900,
      timeout_seconds: 60,
      tool_mode: toolMode
    },
    prompt: {
      system_prompt_file: "prompts/cautious_chess_agent.md"
    },
    behavior: {
      tool_tier: "tier_1",
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
    tools: ["get_board_state", "get_legal_moves", "get_move_history", "get_game_status", "make_move", "resign", "offer_draw"]
  };
  base.name = name;
  base.model.provider = "openrouter";
  base.model.base_url = "https://openrouter.ai/api/v1";
  base.model.api_key_env = "OPENROUTER_API_KEY";
  base.model.model_name = model.trim() || FALLBACK_MODEL;
  base.model.tool_mode = toolMode;
  return base;
}
