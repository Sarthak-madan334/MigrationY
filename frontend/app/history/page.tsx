"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileSearch, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRunHistory, type RunHistoryItem } from "@/lib/api";

const verdictStyle = {
	regressed: { label: "Regressed", icon: AlertTriangle, className: "text-alert" },
	clean: { label: "Passed", icon: CheckCircle2, className: "text-signal" },
	running: { label: "Running", icon: Clock3, className: "text-focus" },
	failed: { label: "Failed", icon: XCircle, className: "text-alert" },
} as const;

export default function HistoryPage() {
	const [runs, setRuns] = useState<RunHistoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let active = true;
		getRunHistory()
			.then((response) => { if (active) setRuns(response.runs); })
			.catch(() => { if (active) setError(true); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, []);

	return <main className="shell">
		<header className="mb-14 flex items-center justify-between">
			<Link className="flex items-center gap-3 font-display text-sm font-semibold tracking-wide" href="/"><span className="flex h-8 w-8 items-center justify-center border border-focus text-focus"><span className="h-2 w-2 bg-signal" /></span> MIGRATION REHEARSAL</Link>
			<div className="eyebrow">History</div>
		</header>
		<div className="mb-10"><div className="eyebrow mb-4">Recorded rehearsals</div><h1 className="font-display text-4xl tracking-[-0.03em]">Run history</h1><p className="mt-3 text-muted">Review current-session rehearsals and reopen their reports.</p></div>
		{loading ? <section className="panel flex min-h-[280px] flex-col items-center justify-center text-center" role="status"><LoaderCircle className="mb-4 animate-spin text-focus" size={24} /><h2 className="font-display text-xl">Loading rehearsal history…</h2><p className="mt-2 text-sm text-muted">Fetching runs recorded by the backend.</p></section> : null}
		{!loading && error ? <section className="panel flex min-h-[280px] flex-col items-center justify-center px-6 text-center" role="alert"><XCircle className="mb-4 text-warn" size={25} /><h2 className="font-display text-xl">Run history is unavailable.</h2><p className="mt-2 text-sm text-muted">The backend could not return the current session's runs.</p><Link className="button-secondary mt-6" href="/connect">Start a rehearsal</Link></section> : null}
		{!loading && !error && runs.length === 0 ? <section className="panel flex min-h-[280px] items-center justify-center"><div className="text-center"><Clock3 className="mx-auto mb-4 text-muted" size={25} /><div className="font-mono text-sm text-muted">NO RUNS IN THIS SESSION</div><p className="mt-3 text-sm text-muted">Run history is kept in memory and clears when the backend restarts.</p><Link className="button-secondary mt-6" href="/connect"><FileSearch size={15} /> Start first rehearsal</Link></div></section> : null}
		{!loading && !error && runs.length ? <section className="overflow-hidden border border-border bg-surface">
			<div className="grid grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)_140px_140px] gap-4 border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted"><div>Repository</div><div>Migration</div><div>Started</div><div>Verdict</div></div>
			{runs.map((run) => {
				const verdict = verdictStyle[run.verdict];
				const Icon = verdict.icon;
				const destination = run.verdict === "running" || run.verdict === "failed" ? `/run/${run.run_id}` : `/run/${run.run_id}/report`;
				return <Link key={run.run_id} href={destination} className="grid grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)_140px_140px] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-raised">
					<div className="min-w-0"><div className="truncate font-mono text-sm text-ink">{run.repo}</div><div className="mt-1 truncate font-mono text-[11px] text-muted">{run.run_id.slice(0, 8)}</div></div>
					<div className="truncate font-mono text-xs text-mono" title={run.migration}>{run.migration}</div>
					<time className="font-mono text-xs text-muted" dateTime={run.created_at}>{new Date(run.created_at).toLocaleString()}</time>
					<div className={`inline-flex items-center gap-2 font-mono text-xs ${verdict.className}`}><Icon size={14} />{verdict.label}<ArrowRight className="ml-auto text-muted" size={13} /></div>
				</Link>;
			})}
		</section> : null}
	</main>;
}
