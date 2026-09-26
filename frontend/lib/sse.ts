import { apiBase, getRunStatus, type RunStage, type RunStatus } from "./api";

export type RunConnection = "connecting" | "streaming" | "polling" | "disconnected";
const maxDisconnectTimeMs = 30_000;

function isTerminal(stage: RunStage) {
  return stage === "done" || stage === "failed";
}

export function subscribeToRunStatus(
  runId: string,
  onStatus: (status: RunStatus) => void,
  onConnection: (connection: RunConnection) => void,
  onTimeout: () => void,
) {
  let stopped = false;
  let pollingTimer: number | undefined;
  let pollingInFlight = false;
  let disconnectedSince: number | null = null;
  const streamUrl = `${apiBase.replace(/\/$/, "")}/rehearsal/${encodeURIComponent(runId)}/stream`;
  const source = new EventSource(streamUrl, { withCredentials: true });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    source.close();
    if (pollingTimer !== undefined) window.clearInterval(pollingTimer);
  };

  const receive = (status: RunStatus) => {
    onStatus(status);
    if (isTerminal(status.stage)) stop();
  };

  const poll = async () => {
    if (stopped || pollingInFlight) return;
    pollingInFlight = true;
    try {
      receive(await getRunStatus(runId));
      disconnectedSince = null;
      if (!stopped) onConnection("polling");
    } catch {
      if (!stopped) {
        disconnectedSince ??= Date.now();
        onConnection("disconnected");
        if (Date.now() - disconnectedSince >= maxDisconnectTimeMs) {
          stop();
          onTimeout();
        }
      }
    } finally {
      pollingInFlight = false;
    }
  };

  const fallBackToPolling = () => {
    if (stopped || pollingTimer !== undefined) return;
    source.close();
    disconnectedSince ??= Date.now();
    onConnection("polling");
    pollingTimer = window.setInterval(poll, 1500);
    void poll();
  };

  source.onopen = () => onConnection("streaming");
  source.onmessage = (event) => {
    try {
      receive(JSON.parse(event.data) as RunStatus);
    } catch {
      fallBackToPolling();
    }
  };
  source.onerror = fallBackToPolling;

  return stop;
}
