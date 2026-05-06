import { useState } from "react";
import { BrainCircuit, Check, ChevronDown, ChevronRight, Coins, Loader2, TriangleAlert, X, Zap } from "lucide-react";
import type { AgentActivity } from "../types";

export function AgentActivityPanel({ activity }: { activity: AgentActivity }) {
  const [showCalls, setShowCalls] = useState(true);
  const totalTokens = activity.recentModelCalls.reduce((sum, call) => sum + (call.totalTokens ?? 0), 0);
  const totalCost = activity.recentModelCalls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0);
  const lastLatency = activity.recentModelCalls.at(-1)?.latencyMs;

  return (
    <section className="panel activity-panel">
      <h2><BrainCircuit size={17} /> Agent Activity</h2>
      <div className="thinking-line">
        {activity.thinking ? <Loader2 className="spin" size={17} /> : <BrainCircuit size={17} />}
        <span>{activity.thinking ? `${activity.playerName} is thinking…` : activity.playerName ? `${activity.playerName} idle` : "No agent active"}</span>
      </div>

      <div className="status-grid compact activity-stats">
        <div>
          <span>Tool calls</span>
          <strong>{activity.toolCallsThisTurn}</strong>
        </div>
        <div>
          <span>Invalid</span>
          <strong className={activity.invalidActionsThisTurn > 0 ? "warn" : ""}>{activity.invalidActionsThisTurn}</strong>
        </div>
        <div>
          <span>Tokens</span>
          <strong>{totalTokens > 0 ? compactNumber(totalTokens) : "—"}</strong>
        </div>
        <div>
          <span>Latency</span>
          <strong>{lastLatency != null ? `${lastLatency}ms` : "—"}</strong>
        </div>
      </div>

      {totalCost > 0 && (
        <div className="cost-line"><Coins size={14} /> ${totalCost.toFixed(5)} this match</div>
      )}

      {activity.latestExplanation && (
        <p className="explanation">"{activity.latestExplanation}"</p>
      )}

      {activity.warnings.map((warning) => (
        <div className="warning-line" key={warning}>
          <TriangleAlert size={15} /> {warning}
        </div>
      ))}

      {activity.recentToolCalls.length > 0 && (
        <div className="tool-timeline">
          <button className="timeline-toggle" onClick={() => setShowCalls((value) => !value)}>
            {showCalls ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Recent tool calls ({activity.recentToolCalls.length})
          </button>
          {showCalls && (
            <ul>
              {activity.recentToolCalls.slice().reverse().map((call) => (
                <li key={`${call.ts}-${call.tool}-${call.ply}`} className={call.ok ? "ok" : "fail"}>
                  <span className="tl-icon">
                    {call.ok ? <Check size={12} /> : <X size={12} />}
                  </span>
                  <span className={`tl-color ${call.color}`} />
                  <span className="tl-name">{call.tool}</span>
                  {call.finalAction && <span className="tl-final"><Zap size={10} /> final</span>}
                  <span className="tl-summary">{call.outputSummary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function compactNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}
