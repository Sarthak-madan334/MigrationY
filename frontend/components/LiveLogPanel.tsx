import { Terminal } from "lucide-react";
import type { RunConnection } from "@/lib/sse";

type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

const connectionLabels: Record<RunConnection, string> = {
  connecting: "connecting",
  streaming: "live stream",
  polling: "polling fallback",
  disconnected: "reconnecting",
};

export function LiveLogPanel({ lines, connection }: { lines: LogLine[]; connection: RunConnection }) {
  return (
    <section className="panel runtime-panel">
      <div className="panel-head log-header">
        <div className="panel-kicker log-kicker">
          <Terminal size={14} className="text-mono" />
          Live event stream
        </div>
        <span className={`connection-pill is-${connection}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {connectionLabels[connection]}
        </span>
      </div>

      <div className="log-console">
        {lines.length ? (
          lines.map((line, index) => (
            <div
              className={`log-line ${line.level === "warn" || line.level === "error" ? "is-warning" : "is-info"}`}
              key={`${line.ts}-${index}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="log-time">{line.ts}</span>
              <span className="log-message">{line.message}</span>
            </div>
          ))
        ) : (
          <div className="log-line is-empty">Waiting for the first backend event...</div>
        )}
      </div>
    </section>
  );
}
