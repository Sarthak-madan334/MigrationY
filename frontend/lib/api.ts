export type RunStage = "queued" | "provisioning" | "seeding" | "migrating" | "querying" | "analyzing" | "bisecting" | "done" | "failed";

export type RunStatus = {
  run_id: string;
  stage: RunStage;
  log: { ts: string; level: "info" | "warn" | "error"; message: string }[];
  progress_pct: number;
};

export type QueryResult = {
  id: string;
  sql: string;
  latency_before_ms: number;
  latency_after_ms: number;
  regression_factor: number;
  verdict: "regressed" | "passed";
  plan_before: string;
  plan_after: string;
};

export type RehearsalResult = { run_id: string; verdict: "regressed" | "clean"; can_bisect: boolean; queries: QueryResult[] };
export type RunHistoryItem = { run_id: string; repo: string; migration: string; verdict: "regressed" | "clean" | "running" | "failed"; created_at: string };
export type BisectResult = {
  query_id: string;
  minimal_condition: string;
  minimal_row_count: number;
  bisection_trail: number[];
  repro_script_url: string;
};
export type GitHubUser = { login: string; avatar_url: string };
export type GitHubRepo = { id: string; full_name: string; default_branch: string };
export type GitHubMigration = { path: string; diff_preview: string; detected_dialect: string };
export type GitHubMigrationSource = { path: string; sql: string };
export type FaqTurn = { question: string; answer: string };

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://migrationy.onrender.com/api" : "http://localhost:8000/api");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ? `${response.status}: ${payload.detail}` : `API request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function createRehearsal(source?: { repo_id: string; migration_path: string; migration_sql: string }) {
  return request<{ run_id: string; status: "queued" }>("/rehearsal/run", { method: "POST", body: JSON.stringify({ repo_id: source?.repo_id ?? "phase-0-demo", migration_path: source?.migration_path ?? "phase0/add_status_index.sql", migration_sql: source?.migration_sql, query_manifest: null, corruption_profile: { null_pressure: 0.15, duplication_rate: 0, legacy_format_rate: 0, row_count_per_table: 50 } }) });
}

export function getRunStatus(runId: string) { return request<RunStatus>(`/rehearsal/${runId}/status`); }
export function getRunResult(runId: string) { return request<RehearsalResult>(`/rehearsal/${runId}/result`); }
export function getRunHistory() { return request<{ runs: RunHistoryItem[] }>("/rehearsal/history"); }
export function bisectQuery(runId: string, queryId: string) {
  return request<BisectResult>(`/rehearsal/${encodeURIComponent(runId)}/bisect`, {
    method: "POST",
    body: JSON.stringify({ query_id: queryId }),
  });
}
export function getReproScriptUrl(runId: string, queryId: string) {
  return `${apiBase}/rehearsal/${encodeURIComponent(runId)}/cause/${encodeURIComponent(queryId)}/repro.sql`;
}
export function beginGitHubOAuth() { return request<{ authorization_url: string }>("/auth/github/authorize"); }
export function getGitHubSession() { return request<{ user: GitHubUser }>("/auth/github/session"); }
export function listGitHubRepos() { return request<{ repos: GitHubRepo[] }>("/repos"); }
export function listGitHubMigrations(repoId: string) { return request<{ migrations: GitHubMigration[] }>(`/repos/${encodeURIComponent(repoId)}/migrations`); }
export function getGitHubMigrationSource(repoId: string, path: string) { return request<GitHubMigrationSource>(`/repos/${encodeURIComponent(repoId)}/migrations/content?path=${encodeURIComponent(path)}`); }
export function disconnectGitHub() { return request<void>("/auth/github/logout", { method: "POST" }); }
export function askFaqQuestion(question: string, history: FaqTurn[] = []) { return request<{ answer: string }>("/faq/ask", { method: "POST", body: JSON.stringify({ question, history }) }); }
