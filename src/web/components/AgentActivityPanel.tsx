import { BrainCircuit, Loader2, TriangleAlert } from "lucide-react";
import type { AgentActivity } from "../../shared/types";

export function AgentActivityPanel({ activity }: { activity: AgentActivity }) {
  return (
    <section className="panel activity-panel">
      <h2><BrainCircuit size={17} /> Agent Activity</h2>
      <div className="thinking-line">
        {activity.thinking ? <Loader2 className="spin" size={17} /> : <BrainCircuit size={17} />}
        <span>{activity.thinking ? `${activity.playerName} is thinking` : "Idle"}</span>
      </div>
      <div className="status-grid compact">
        <div>
          <span>Tool calls</span>
          <strong>{activity.toolCallsThisTurn}</strong>
        </div>
        <div>
          <span>Invalid</span>
          <strong>{activity.invalidActionsThisTurn}</strong>
        </div>
      </div>
      {activity.latestExplanation && (
        <p className="explanation">{activity.latestExplanation}</p>
      )}
      {activity.warnings.map((warning) => (
        <div className="warning-line" key={warning}>
          <TriangleAlert size={15} /> {warning}
        </div>
      ))}
    </section>
  );
}
