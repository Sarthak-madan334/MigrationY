"use client";

import { Activity, AlertTriangle, ArrowLeft, ArrowRight, Clock3, Database, Download, FileWarning, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { QueryResultsTable } from "@/components/QueryResultsTable";
import { VerdictBanner } from "@/components/VerdictBanner";
import { buildAiReview, demoProfileLabel } from "@/lib/aiReview";
import { bisectQuery, getReproScriptUrl, getRunResult, type RehearsalResult } from "@/lib/api";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return <ReportContent id={id} />;
}

function ReportContent({ id }: { id: string }) {
	const [result, setResult] = useState<RehearsalResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		let active = true;
		getRunResult(id)
			.then((next) => { if (active) setResult(next); })
			.catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "The backend could not return this run's results."); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [id]);

	const regressions = result?.queries.filter((query) => query.verdict === "regressed") ?? [];
	const leadRegression = regressions[0];
	const review = result ? buildAiReview(result) : null;

	async function exportRepro() {
		const query = regressions[0];
		if (!query || exporting) return;
		setExporting(true);
		setError(null);
		try {
			await bisectQuery(id, query.id);
			const response = await fetch(getReproScriptUrl(id, query.id), { credentials: "include" });
			if (!response.ok) throw new Error("Repro download failed");
			const objectUrl = URL.createObjectURL(await response.blob());
			const download = document.createElement("a");
			download.href = objectUrl;
			download.download = "repro.sql";
			document.body.appendChild(download);
			download.click();
			download.remove();
			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		} catch {
			setError("The minimal repro could not be prepared. Open the query's root-cause view to retry.");
		} finally {
			setExporting(false);
		}
	}

	return <main className="shell pb-16">
		<header className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
			<Link className="flex items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-ink" href={`/run/${id}`}><ArrowLeft size={14} /> Live run</Link>
			<div className="font-mono text-[11px] uppercase tracking-[0.18em] text-focus">Migration report <span className="text-muted">/ {id.slice(0, 8)}</span></div>
		</header>
		{loading ? <div className="panel flex min-h-[320px] flex-col items-center justify-center text-center" role="status">
			<LoaderCircle className="mb-4 animate-spin text-focus" size={24} />
			<h1 className="font-display text-xl">Loading measured results…</h1>
			<p className="mt-2 text-sm text-muted">Retrieving query timings and execution plans from the rehearsal.</p>
		</div> : null}
		{!loading && result && review ? <>
			<section className="mb-8 flex flex-wrap items-end justify-between gap-5">
				<div>
					<div className="eyebrow mb-4">Rehearsal verdict</div>
					<h1 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">Migration review</h1>
					<p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Measured query plans and timings from an isolated PostgreSQL rehearsal.</p>
				</div>
				<div className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted"><Database size={14} className="text-focus" />{demoProfileLabel(result)}</div>
			</section>

			<VerdictBanner regressed={regressions.length} total={result.queries.length} />

			<section className="mt-4 grid gap-3 sm:grid-cols-3">
				<div className="panel p-5"><div className="flex items-center gap-2 text-muted"><Activity size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.15em]">Queries measured</span></div><div className="mt-3 font-display text-3xl">{result.queries.length}</div><div className="mt-1 text-xs text-muted">Compared before and after</div></div>
				<div className="panel p-5"><div className="flex items-center gap-2 text-muted">{regressions.length ? <AlertTriangle size={15} className="text-alert" /> : <ShieldCheck size={15} className="text-signal" />}<span className="font-mono text-[10px] uppercase tracking-[0.15em]">Needs review</span></div><div className={`mt-3 font-display text-3xl ${regressions.length ? "text-alert" : "text-signal"}`}>{regressions.length}</div><div className="mt-1 text-xs text-muted">Flagged query plan changes</div></div>
				<div className="panel p-5"><div className="flex items-center gap-2 text-muted"><Clock3 size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.15em]">Run duration</span></div><div className="mt-3 font-display text-3xl">{result.duration_ms.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="ml-1 font-mono text-sm text-muted">ms</span></div><div className="mt-1 text-xs text-muted">End-to-end rehearsal time</div></div>
			</section>

			<section className={`mt-6 overflow-hidden border ${review.clean ? "border-signal/30 bg-signal/[0.04]" : "border-alert/30 bg-alert/[0.04]"}`}>
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
					<div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border border-focus/30 bg-focus/10 text-focus"><Sparkles size={17} /></span><div><h2 className="font-display text-lg">AI review preview</h2><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Simulated summary · derived from measured evidence</p></div></div>
					<Link className="button-secondary" href={`/run/${id}/review`}>Open full review <ArrowRight size={15} /></Link>
				</div>
				<div className="grid gap-5 p-5 md:grid-cols-[1.3fr_1fr] md:p-6">
					<div><div className={`font-display text-xl ${review.clean ? "text-signal" : "text-alert"}`}>{review.title}</div><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{review.summary}</p></div>
					<div className="border-l border-border pl-5"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Suggested next step</div><p className="mt-2 text-sm leading-6 text-ink">{review.recommendation}</p></div>
				</div>
				<div className="border-t border-border/70 px-5 py-3 text-[11px] leading-5 text-muted">Demo mode: this review is a deterministic preview generated from the rehearsal output; no external AI model was called.</div>
			</section>

			{leadRegression ? <section className="panel mt-6 border-l-2 border-l-alert p-5 md:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow">First flagged query · {leadRegression.id}</div><p className="mt-2 text-sm text-muted">Review the changed plan before approving this migration.</p></div><Link className="button-secondary" href={`/run/${id}/cause?query=${encodeURIComponent(leadRegression.id)}`}>Inspect root cause <ArrowRight size={15} /></Link></div>
				<pre className="mt-4 overflow-x-auto border border-border bg-raised p-4 font-mono text-xs leading-6 text-mono">{leadRegression.sql}</pre>
			</section> : null}

			<div className="mt-10 flex flex-wrap items-end justify-between gap-4">
				<div><div className="font-display text-2xl">Query evidence</div><div className="mt-1 text-sm text-muted">Expand a row to compare its before and after execution plan.</div></div>
				{regressions.length && result.can_bisect ? <button className="button-secondary" onClick={exportRepro} disabled={exporting}>{exporting ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}{exporting ? "Preparing minimal repro…" : "Export reproducible case"}</button> : null}
			</div>
			<div className="mt-4"><QueryResultsTable queries={result.queries} runId={id} canBisect={result.can_bisect} /></div>
		</> : null}
		{!loading && error ? <div className="panel flex min-h-[300px] flex-col items-center justify-center px-6 text-center" role="alert">
			<FileWarning className="mb-5 text-warn" size={28} />
			<h1 className="font-display text-2xl">Results are unavailable.</h1>
			<p className="mt-3 max-w-md text-sm leading-6 text-muted">{error}</p>
			<Link className="button-secondary mt-7" href={`/run/${id}`}>Return to the live run</Link>
		</div> : null}
	</main>;
}
