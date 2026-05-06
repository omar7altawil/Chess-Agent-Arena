import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Clipboard,
  Download,
  FileText,
  Flag,
  FlipHorizontal2,
  History,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  Swords
} from "lucide-react";
import { AgentActivityPanel } from "./components/AgentActivityPanel";
import { ChessBoard } from "./components/ChessBoard";
import { ConfigPanel } from "./components/ConfigPanel";
import { GameOverModal } from "./components/GameOverModal";
import { MatchSetup } from "./components/MatchSetup";
import { MoveList } from "./components/MoveList";
import { ReplayControls } from "./components/ReplayControls";
import { ResultsPage } from "./components/ResultsPage";
import { SidePanel } from "./components/SidePanel";
import {
  fetchGame,
  postNewGame,
  postPause,
  postRematch,
  postResign,
  postResume,
  postStart
} from "./api";
import type { GameSnapshot, MatchConfig, ViewName } from "./types";

export function App() {
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [view, setView] = useState<ViewName>("game");
  const [replayPly, setReplayPly] = useState<number | null>(null);

  useEffect(() => {
    fetchGame()
      .then((snapshot) => {
        setGame(snapshot);
        if (!snapshot.started && snapshot.history.length === 0) {
          setView("setup");
        }
      })
      .catch((err: Error) => setError(err.message));
    const events = new EventSource("/api/events");
    events.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as GameSnapshot;
      setGame(snapshot);
      setReplayPly((current) => (current === null ? null : Math.min(current, snapshot.history.length)));
    });
    events.onerror = () => setError("Live connection interrupted. The app will keep the last known board state.");
    return () => events.close();
  }, []);

  const replayFen = useMemo(() => {
    if (!game || replayPly === null) return null;
    if (replayPly <= 0) return game.history[0]?.fenBefore ?? game.fen;
    return game.history[replayPly - 1]?.fenAfter ?? game.fen;
  }, [game, replayPly]);

  const boardFen = replayFen ?? game?.fen ?? "start";

  const handleAction = useCallback(async (action: () => Promise<GameSnapshot>) => {
    try {
      setError(null);
      setGame(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }, []);

  const handleNewConfig = useCallback((config: MatchConfig) => {
    void handleAction(() => postNewGame(config));
    setReplayPly(null);
    setView("game");
  }, [handleAction]);

  const handleRematch = useCallback((swap: boolean) => {
    void handleAction(() => postRematch(swap));
    setReplayPly(null);
    setView("game");
  }, [handleAction]);

  if (!game) {
    return <div className="app-shell loading">Loading Chess Agent Arena…</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-line">
            <Swords size={21} />
            <h1>Chess Agent Arena</h1>
          </div>
          <MatchSummary game={game} />
        </div>
        <nav className="view-tabs" aria-label="Main views">
          <button className={view === "setup" ? "active" : ""} onClick={() => setView("setup")}>
            <Settings2 size={16} /> Setup
          </button>
          <button className={view === "game" ? "active" : ""} onClick={() => setView("game")}>
            <BrainCircuit size={16} /> Game
          </button>
          <button className={view === "results" ? "active" : ""} onClick={() => setView("results")}>
            <History size={16} /> Results
          </button>
        </nav>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {view === "results" && <ResultsPage />}

      {view === "setup" && (
        <main className="setup-layout">
          <MatchSetup
            game={game}
            variant="primary"
            onStart={handleNewConfig}
            onCancel={() => setView("game")}
            onError={setError}
          />
        </main>
      )}

      {view === "game" && (
        <main className="game-layout">
          <section className="board-section">
            <div className="board-header">
              <PlayerStrip game={game} color={orientation === "white" ? "black" : "white"} />
            </div>
            <ChessBoard
              game={game}
              fen={boardFen}
              orientation={orientation}
              replaying={replayPly !== null}
              onMove={(snapshot) => setGame(snapshot)}
              onError={setError}
            />
            <div className="board-footer">
              <PlayerStrip game={game} color={orientation === "white" ? "white" : "black"} />
            </div>
          </section>

          <aside className="right-rail">
            <div className="control-bar">
              {!game.started ? (
                <button className="primary" onClick={() => void handleAction(postStart)}>
                  <Play size={16} /> Start
                </button>
              ) : game.paused ? (
                <button className="primary" onClick={() => void handleAction(postResume)}>
                  <Play size={16} /> Resume
                </button>
              ) : (
                <button onClick={() => void handleAction(postPause)}>
                  <Pause size={16} /> Pause
                </button>
              )}
              <button onClick={() => setOrientation((value) => (value === "white" ? "black" : "white"))}>
                <FlipHorizontal2 size={16} /> Flip
              </button>
              <button onClick={() => setReplayPly(null)}>
                <RefreshCw size={16} /> Live
              </button>
              <button onClick={() => void handleAction(() => postResign(game.turn))} disabled={game.status === "completed"}>
                <Flag size={16} /> Resign
              </button>
            </div>

            <SidePanel game={game} />
            <AgentActivityPanel activity={game.activity} />
            <MoveList game={game} activePly={replayPly ?? game.history.length} onSelectPly={setReplayPly} />
            <ReplayControls
              ply={replayPly ?? game.history.length}
              maxPly={game.history.length}
              onChange={setReplayPly}
              onLive={() => setReplayPly(null)}
            />
            <ExportPanel game={game} />
            <ConfigPanel
              game={game}
              onOpenSetup={() => setView("setup")}
              onRematch={() => handleRematch(false)}
              onSwapRematch={() => handleRematch(true)}
            />
          </aside>
        </main>
      )}

      {view === "game" && game.status === "completed" && (
        <GameOverModal
          game={game}
          onClose={() => setReplayPly(game.history.length)}
          onRematch={() => handleRematch(false)}
          onSwapRematch={() => handleRematch(true)}
          onNewMatch={() => setView("setup")}
        />
      )}
    </div>
  );
}

function MatchSummary({ game }: { game: GameSnapshot }) {
  const statusLabel = game.status === "completed"
    ? `${game.result} · ${game.endReason ?? "complete"}`
    : game.paused
      ? "Paused"
      : game.started
        ? `${game.turn} to move · ply ${game.ply}`
        : "Ready to start";
  return (
    <div className="match-summary">
      <PlayerChip game={game} color="white" />
      <span className="vs">vs</span>
      <PlayerChip game={game} color="black" />
      <span className="match-status">{statusLabel}</span>
    </div>
  );
}

function PlayerChip({ game, color }: { game: GameSnapshot; color: "white" | "black" }) {
  const player = game.players[color];
  const active = game.turn === color && game.status !== "completed" && game.started;
  return (
    <span className={`player-chip ${color} ${active ? "active" : ""}`}>
      <span className={`color-dot ${color}`} />
      <strong>{player.name}</strong>
      {player.model && <span className="chip-tag">{player.model}</span>}
      {player.bot && <span className="chip-tag">{player.bot}</span>}
    </span>
  );
}

function PlayerStrip({ game, color }: { game: GameSnapshot; color: "white" | "black" }) {
  const player = game.players[color];
  const active = game.turn === color && game.status !== "completed";
  const icon = player.type === "human" ? <Swords size={16} /> : player.type === "bot" ? <Bot size={16} /> : <BrainCircuit size={16} />;
  return (
    <div className={`player-strip ${active ? "active" : ""}`}>
      <span className={`color-dot ${color}`} />
      <span className="player-icon">{icon}</span>
      <strong>{player.name}</strong>
      <span>{player.type}{player.bot ? ` / ${player.bot}` : ""}</span>
      {player.model && <span className="model-chip">{player.model}</span>}
    </div>
  );
}

function ExportPanel({ game }: { game: GameSnapshot }) {
  const copyFen = async () => navigator.clipboard.writeText(game.fen);
  const copyPgn = async () => navigator.clipboard.writeText(game.pgn);
  const downloadPgn = () => {
    const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${game.runId}.pgn`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="panel export-panel">
      <h2><FileText size={17} /> Export</h2>
      <div className="split-buttons">
        <button onClick={() => void copyFen()}><Clipboard size={16} /> FEN</button>
        <button onClick={() => void copyPgn()}><Clipboard size={16} /> PGN</button>
        <button onClick={downloadPgn}><Download size={16} /> PGN</button>
      </div>
    </section>
  );
}

