"use client";

import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { QueryResult } from "@/lib/api";
import { PlanDiff } from "./PlanDiff";

export function QueryResultsTable({ queries, runId, canBisect = true }: { queries: QueryResult[]; runId: string; canBisect?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <div className="overflow-hidden border border-border bg-surface"><div className="grid grid-cols-[minmax(220px,1fr)_100px_100px_90px_120px] gap-4 border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted"><div>Query</div><div className="text-right">Before</div><div className="text-right">After</div><div className="text-right">Δ</div><div>Verdict</div></div>
    {queries.map((query) => { const isExpanded = expanded === query.id; const regressed = query.verdict === "regressed"; return <div key={query.id} className="border-b border-border last:border-0"><button className="grid w-full grid-cols-[minmax(220px,1fr)_100px_100px_90px_120px] items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-raised" onClick={() => setExpanded(isExpanded ? null : query.id)}><div className="flex min-w-0 items-center gap-3"><span className="text-muted">{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span className="truncate font-mono text-xs text-mono">{query.sql}</span></div><div className="text-right font-mono text-sm text-ink">{query.latency_before_ms.toFixed(0)}ms</div><div className="text-right font-mono text-sm text-ink">{query.latency_after_ms.toFixed(0)}ms</div><div className={`text-right font-mono ${regressed ? "text-xl font-semibold text-alert" : "text-sm text-signal"}`}>{query.regression_factor.toFixed(1)}×</div><div className={`font-mono text-xs ${regressed ? "text-alert" : "text-signal"}`}>{regressed ? "● Regressed" : "● Passed"}</div></button>{isExpanded ? <div className="space-y-4 bg-raised px-5 pb-5 pl-12"><PlanDiff before={query.plan_before} after={query.plan_after} />{canBisect ? <a className="inline-flex items-center gap-2 font-mono text-xs text-focus hover:underline" href={`/run/${runId}/cause?query=${encodeURIComponent(query.id)}`}>See exact cause <ExternalLink size={13} /></a> : <p className="font-mono text-xs text-muted">Root cause bisection is available for the built-in sample migration.</p>}</div> : null}</div>; })}
  </div>;
}
