import { AlertTriangle, Check, Circle, Database, FileSearch, FlaskConical, GitCommit, Search } from "lucide-react";
import type { RunStage } from "@/lib/api";

type Props = { stage: RunStage; failedStage?: RunStage | null; regressionCount?: number };

const stages: { key: RunStage; label: string; detail: string; icon: typeof Database }[] = [
  { key: "provisioning", label: "Provisioning shadow DB", detail: "isolated Postgres instance", icon: Database },
  { key: "seeding", label: "Generating adversarial dataset", detail: "null-pressure profile applied", icon: FlaskConical },
  { key: "migrating", label: "Applying migration", detail: "schema change under rehearsal", icon: GitCommit },
  { key: "querying", label: "Running query manifest", detail: "representative workload", icon: Search },
  { key: "analyzing", label: "Analyzing results", detail: "latency and plan comparison", icon: FileSearch }
];

const order: RunStage[] = ["queued", "provisioning", "seeding", "migrating", "querying", "analyzing", "done"];

export function PipelineStages({ stage, failedStage, regressionCount = 0 }: Props) {
  const current = order.indexOf(stage === "failed" ? failedStage ?? "queued" : stage);

  return (
    <div className="pipeline-list" aria-live="polite">
      <div className="pipeline-rail" aria-hidden="true" />
      {stages.map((item, index) => {
        const itemPosition = order.indexOf(item.key);
        const failed = stage === "failed" && failedStage === item.key;
        const complete = !failed && (stage === "done" || current > itemPosition);
        const active = stage === item.key;
        const Icon = item.icon;

        return (
          <div
            className={`pipeline-step ${complete ? "is-complete" : failed ? "is-error" : active ? "is-active" : "is-pending"}`}
            key={item.key}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className={`pipeline-node ${complete ? "is-complete" : failed ? "is-error" : active ? "is-active" : "is-pending"}`}>
              {complete ? <Check size={16} strokeWidth={2.5} /> : failed ? <AlertTriangle size={16} /> : active ? <Icon size={16} /> : <Circle size={10} />}
            </div>
            <div className="pipeline-copy">
              <div className={`pipeline-label ${active || complete || failed ? "is-visible" : "is-muted"}`}>{item.label}{failed ? " · failed" : ""}</div>
              <div className="pipeline-detail">
                {item.detail}
                {item.key === "analyzing" && regressionCount > 0 ? <span className="regression-pill">{regressionCount} regression found</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}