import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Coins,
  FileJson,
  FileText,
  Filter,
  RefreshCw,
  Trophy,
  User,
  XCircle
} from "lucide-react";
import { fetchResults } from "../api";
import type { ResultsSummary } from "../types";

type ResultsFilter = "all" | "model_match" | "completed" | "failed";

export function ResultsPage() {
  const [results, setResults] = useState<ResultsSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ResultsFilter>("all");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetchResults()
      .then(setResults)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const lower = search.toLowerCase().trim();
    return results.filter((result) => {
      if (filter === "model_match" && !result.isModelMatch) return false;
      if (filter === "completed" && result.status !== "completed") return false;
      if (filter === "failed" && result.status !== "failed") return false;
      if (!lower) return true;
      return [result.id, result.white, result.black, result.whiteModel ?? "", result.blackModel ?? ""]
        .some((value) => value.toLowerCase().includes(lower));
    });
  }, [filter, results, search]);

  const matchups = useMemo(
    () => buildMatchups(filtered.filter((result) => result.isModelMatch && result.status === "completed")),
    [filtered]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, result) => {
        acc.tokens += result.totalTokens ?? 0;
        acc.cost += result.totalCostUsd ?? 0;
        if (result.status === "completed") acc.completed += 1;
        if (result.status === "failed") acc.failed += 1;
        return acc;
      },
      { tokens: 0, cost: 0, completed: 0, failed: 0 }
    );
  }, [filtered]);

  return (
    <main className="results-layout">
      <div className="results-header">
        <div>
          <h2>Match Results</h2>
          <p>{loading ? "Loading runs…" : `${filtered.length} of ${results.length} runs`}</p>
        </div>
        <div className="results-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or model"
          />
          <button onClick={load}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div className="results-summary-bar">
        <span><Trophy size={14} /> {totals.completed} completed</span>
        <span><AlertCircle size={14} /> {totals.failed} failed</span>
        {totals.tokens > 0 && <span><Brain size={14} /> {compactNumber(totals.tokens)} tokens</span>}
        {totals.cost > 0 && <span><Coins size={14} /> ${totals.cost.toFixed(4)}</span>}
      </div>

      <div className="results-filter-bar">
        <Filter size={14} />
        {(["all", "model_match", "completed", "failed"] as ResultsFilter[]).map((value) => (
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {labelForFilter(value)}
          </button>
        ))}
      </div>

      {matchups.length > 0 && filter !== "failed" && (
        <section className="matchup-panel">
          <h3>Model matchups</h3>
          <div className="matchup-list">
            {matchups.map((matchup) => (
              <article key={matchup.key} className="matchup-card">
                <header>
                  <strong>{matchup.left}</strong>
                  <span>vs</span>
                  <strong>{matchup.right}</strong>
                </header>
                <div className="matchup-stats">
                  <span className="win">{matchup.leftWins}W</span>
                  <span className="draw">{matchup.draws}D</span>
                  <span className="loss">{matchup.rightWins}L</span>
                  <span className="hint">({matchup.games} games · {matchup.leftWinRate.toFixed(0)}% L-WR)</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="results-grid">
        {!loading && filtered.length === 0 && <div className="empty-state">No runs match the current filters.</div>}
        {filtered.map((result) => (
          <ResultCard key={`${result.id}-${result.updatedAt}`} result={result} />
        ))}
      </div>
    </main>
  );
}

function ResultCard({ result }: { result: ResultsSummary }) {
  return (
    <article className={`result-card status-${result.status}`}>
      <div className="result-card-head">
        <span className="result-time">{new Date(result.updatedAt).toLocaleString()}</span>
        <StatusPill status={result.status} label={result.outcomeLabel} />
      </div>
      <div className="result-players">
        <PlayerLine color="white" name={result.white} type={result.whiteType} model={result.whiteModel} />
        <PlayerLine color="black" name={result.black} type={result.blackType} model={result.blackModel} />
      </div>
      <div className="result-stats">
        <span><Clock size={13} /> {result.plies} plies</span>
        {typeof result.totalTokens === "number" && result.totalTokens > 0 && (
          <span><Brain size={13} /> {compactNumber(result.totalTokens)} tokens</span>
        )}
        {typeof result.totalCostUsd === "number" && result.totalCostUsd > 0 && (
          <span><Coins size={13} /> ${result.totalCostUsd.toFixed(5)}</span>
        )}
      </div>
      {result.issueSummary && <div className="result-issue"><AlertCircle size={13} /> {result.issueSummary}</div>}
      <div className="result-links">
        <a href={`/api/results/${result.id}/game.pgn`} target="_blank" rel="noreferrer"><FileText size={14} /> PGN</a>
        <a href={`/api/results/${result.id}/replay.json`} target="_blank" rel="noreferrer"><FileJson size={14} /> Replay</a>
        {result.metricsPath && (
          <a href={`/api/results/${result.id}/metrics.json`} target="_blank" rel="noreferrer"><BarChart3 size={14} /> Metrics</a>
        )}
      </div>
    </article>
  );
}

function PlayerLine({ color, name, type, model }: { color: "white" | "black"; name: string; type: string; model?: string }) {
  const icon = type === "human" ? <User size={13} /> : type === "bot" ? <Bot size={13} /> : <Brain size={13} />;
  return (
    <div className={`result-player ${color}`}>
      <span className={`color-dot ${color}`} />
      {icon}
      <strong>{name}</strong>
      {model && <span className="hint">{model}</span>}
    </div>
  );
}

function StatusPill({ status, label }: { status: ResultsSummary["status"]; label: string }) {
  const icon = status === "completed" ? <CheckCircle2 size={13} /> : status === "failed" ? <XCircle size={13} /> : <AlertCircle size={13} />;
  return (
    <span className={`status-pill status-${status}`}>{icon} {label}</span>
  );
}

function labelForFilter(filter: ResultsFilter): string {
  if (filter === "all") return "All";
  if (filter === "model_match") return "Model matches";
  if (filter === "completed") return "Completed";
  return "Failed";
}

function compactNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

interface MatchupSummary {
  key: string;
  left: string;
  right: string;
  games: number;
  leftWins: number;
  rightWins: number;
  draws: number;
  leftWinRate: number;
}

function buildMatchups(results: ResultsSummary[]): MatchupSummary[] {
  const buckets = new Map<string, MatchupSummary>();
  for (const result of results) {
    const left = result.whiteModel ?? result.white;
    const right = result.blackModel ?? result.black;
    if (!left || !right) continue;
    const [a, b] = [left, right].sort();
    const bucket = buckets.get(`${a}__${b}`) ?? {
      key: `${a}__${b}`,
      left: a,
      right: b,
      games: 0,
      leftWins: 0,
      rightWins: 0,
      draws: 0,
      leftWinRate: 0
    };
    bucket.games += 1;
    if (result.result === "1-0") {
      if (left === a) bucket.leftWins += 1;
      else bucket.rightWins += 1;
    } else if (result.result === "0-1") {
      if (right === a) bucket.leftWins += 1;
      else bucket.rightWins += 1;
    } else if (result.result === "1/2-1/2") {
      bucket.draws += 1;
    }
    buckets.set(bucket.key, bucket);
  }
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      leftWinRate: bucket.games > 0 ? ((bucket.leftWins + bucket.draws * 0.5) / bucket.games) * 100 : 0
    }))
    .sort((a, b) => b.games - a.games);
}
