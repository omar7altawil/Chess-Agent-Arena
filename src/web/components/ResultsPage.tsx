import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, FileJson, FileText, RefreshCw, Trophy } from "lucide-react";
import { fetchResults } from "../api";
import type { ResultsSummary } from "../types";

type ResultsFilter = "model" | "completed" | "issues" | "all";

export function ResultsPage() {
  const [results, setResults] = useState<ResultsSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultsFilter>("model");

  const load = () => {
    fetchResults().then(setResults).catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return results.filter((result) => {
      if (filter === "model") return result.isModelMatch && !result.isBotOnly && !result.isDevRun;
      if (filter === "completed") return result.status === "completed" && result.isModelMatch && !result.isDevRun;
      if (filter === "issues") return result.status === "failed";
      return true;
    });
  }, [filter, results]);

  const stats = useMemo(() => ({
    modelRuns: results.filter((result) => result.isModelMatch && !result.isBotOnly && !result.isDevRun).length,
    completed: results.filter((result) => result.status === "completed" && result.isModelMatch && !result.isDevRun).length,
    issues: results.filter((result) => result.status === "failed").length,
    active: results.filter((result) => result.status === "active" || result.status === "incomplete").length
  }), [results]);

  return (
    <main className="results-layout arena-results">
      <div className="results-header">
        <div>
          <h2>Model Arena Runs</h2>
          <p>Compare human-vs-model and model-vs-model chess experiments.</p>
        </div>
        <button onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="arena-summary">
        <SummaryCard label="Model runs" value={stats.modelRuns} />
        <SummaryCard label="Scored games" value={stats.completed} />
        <SummaryCard label="Provider issues" value={stats.issues} tone={stats.issues ? "warn" : undefined} />
        <SummaryCard label="Unscored" value={stats.active} />
      </div>

      <div className="result-filters" aria-label="Result filters">
        <button className={filter === "model" ? "active" : ""} onClick={() => setFilter("model")}>Model runs</button>
        <button className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>Scored</button>
        <button className={filter === "issues" ? "active" : ""} onClick={() => setFilter("issues")}>Issues</button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All files</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="results-table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state">No runs match this filter.</div>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Match</th>
                <th>Models</th>
                <th>Outcome</th>
                <th>Plies</th>
                <th>Updated</th>
                <th>Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((result) => (
                <tr key={`${result.id}-${result.updatedAt}`}>
                  <td><StatusBadge result={result} /></td>
                  <td>
                    <strong>{result.white} vs {result.black}</strong>
                    <span className="run-id">{result.id}</span>
                  </td>
                  <td>
                    <div className="model-list">
                      <ModelPill label="White" type={result.whiteType} model={result.whiteModel} />
                      <ModelPill label="Black" type={result.blackType} model={result.blackModel} />
                    </div>
                  </td>
                  <td>
                    <div className="outcome-cell">
                      <strong>{result.outcomeLabel}</strong>
                      <span title={result.endReason ?? undefined}>
                        {result.issueSummary ?? cleanReason(result.endReason)}
                      </span>
                    </div>
                  </td>
                  <td>{result.plies}</td>
                  <td>{new Date(result.updatedAt).toLocaleString()}</td>
                  <td>
                    <div className="artifact-links">
                      <ArtifactLink href={`/api/results/${result.id}/game.pgn`} icon={<FileText size={15} />} label="PGN" enabled={Boolean(result.pgnPath)} />
                      <ArtifactLink href={`/api/results/${result.id}/replay.json`} icon={<FileJson size={15} />} label="Replay" enabled={Boolean(result.replayPath)} />
                      <ArtifactLink href={`/api/results/${result.id}/metrics.json`} icon={<BarChart3 size={15} />} label="Metrics" enabled={Boolean(result.metricsPath)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`summary-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ result }: { result: ResultsSummary }) {
  const icon = result.status === "failed" ? <AlertTriangle size={14} /> : result.status === "completed" ? <Trophy size={14} /> : null;
  return <span className={`status-badge ${result.status}`}>{icon}{result.status}</span>;
}

function ModelPill({ label, type, model }: { label: string; type: string; model?: string }) {
  const text = type === "llm" ? model ?? "model" : type;
  return (
    <span className={`model-pill ${type}`}>
      <small>{label}</small>
      {text}
    </span>
  );
}

function ArtifactLink({ href, icon, label, enabled }: { href: string; icon: React.ReactNode; label: string; enabled: boolean }) {
  if (!enabled) {
    return <span className="artifact-link disabled">{icon}{label}</span>;
  }
  return <a className="artifact-link" href={href} target="_blank" rel="noreferrer">{icon}{label}</a>;
}

function cleanReason(reason: string | null): string {
  if (!reason) return "Awaiting completion";
  if (reason === "max plies reached") return "Reached configured ply cap";
  return reason.length > 96 ? `${reason.slice(0, 96)}...` : reason;
}
