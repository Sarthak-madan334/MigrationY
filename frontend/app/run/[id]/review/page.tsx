"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Database, FileSearch, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { buildAiReview, demoProfileLabel } from "@/lib/aiReview";
import { getRunResult, type RehearsalResult } from "@/lib/api";

export default function AiReviewPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const [result, setResult] = useState<RehearsalResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		getRunResult(id)
			.then((data) => { if (active) setResult(data); })
			.catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "The rehearsal report could not be loaded."); });
		return () => { active = false; };
	}, [id]);

	if (error) return <main className="shell py-12"><Link className="button-secondary" href={`/run/${id}/report`}><ArrowLeft size={15} /> Back to report</Link><div className="panel mt-8 p-8 text-center"><h1 className="font-display text-2xl">Review unavailable</h1><p className="mt-3 text-sm text-muted">{error}</p></div></main>;
	if (!result) return <main className="shell flex min-h-[60vh] flex-col items-center justify-center text-center"><LoaderCircle className="mb-4 animate-spin text-focus" size={25} /><h1 className="font-display text-xl">Preparing review…</h1><p className="mt-2 text-sm text-muted">Loading the measured query evidence.</p></main>;

	const review = buildAiReview(result);
	const flagged = result.queries.filter((query) => query.verdict === "regressed");

	return <main className="shell pb-16">
		<header className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
			<Link className="flex items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-ink" href={`/run/${id}/report`}><ArrowLeft size={14} /> Back to results</Link>
			<div className="font-mono text-[11px] uppercase tracking-[0.18em] text-focus">Review note <span className="text-muted">/ {id.slice(0, 8)}</span></div>
		</header>

		<div className="mb-7 flex flex-wrap items-center gap-3">
			<span className="grid h-11 w-11 place-items-center border border-focus/30 bg-focus/10 text-focus"><Sparkles size={20} /></span>
			<div><div className="eyebrow">AI review preview</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><Database size={13} />{demoProfileLabel(result)}</div></div>
		</div>
		<h1 className="max-w-3xl font-display text-4xl tracking-[-0.04em] sm:text-5xl">{review.clean ? "A clean result, with evidence." : "A regression worth catching."}</h1>
		<p className="mt-4 max-w-3xl text-sm leading-7 text-muted">This review turns the rehearsal measurements into a concise engineering summary. Every finding below points back to the query plans and timings from this run.</p>

		<section className={`mt-9 border p-6 md:p-8 ${review.clean ? "border-signal/30 bg-signal/[0.04]" : "border-alert/30 bg-alert/[0.04]"}`}>
			<div className="flex items-start gap-4">
				{review.clean ? <CheckCircle2 className="mt-1 shrink-0 text-signal" size={23} /> : <AlertTriangle className="mt-1 shrink-0 text-alert" size={23} />}
				<div><div className={`font-display text-2xl ${review.clean ? "text-signal" : "text-alert"}`}>{review.title}</div><p className="mt-3 max-w-3xl text-sm leading-7 text-ink">{review.summary}</p></div>
			</div>
		</section>

		<div className="mt-5 grid gap-3 sm:grid-cols-3">
			<div className="panel p-5"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Queries reviewed</div><div className="mt-2 font-display text-3xl">{result.queries.length}</div></div>
			<div className="panel p-5"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Flagged</div><div className={`mt-2 font-display text-3xl ${flagged.length ? "text-alert" : "text-signal"}`}>{flagged.length}</div></div>
			<div className="panel p-5"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Verdict</div><div className={`mt-2 font-display text-xl ${review.clean ? "text-signal" : "text-alert"}`}>{review.clean ? "Passed" : "Needs review"}</div></div>
		</div>

		<section className="panel mt-8 p-6 md:p-8">
			<div className="flex items-center gap-3"><FileSearch className="text-focus" size={19} /><div><div className="eyebrow">Evidence from this run</div><h2 className="mt-1 font-display text-2xl">What changed</h2></div></div>
			{review.finding ? <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
				<div><div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Flagged query · {review.finding.id}</div><pre className="mt-3 overflow-x-auto border border-border bg-raised p-4 font-mono text-xs leading-6 text-mono">{review.finding.sql}</pre><div className="mt-3 text-xs text-muted">Measured after/before latency: <span className="font-mono text-ink">{review.finding.factor.toFixed(2)}×</span></div></div>
				<div className="space-y-3"><div className="border border-border bg-raised p-4"><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Before migration</div><pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-ink">{review.finding.before}</pre></div><div className="flex justify-center text-muted"><ArrowRight size={16} /></div><div className="border border-alert/30 bg-alert/[0.05] p-4"><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-alert">After migration</div><pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-ink">{review.finding.after}</pre></div></div>
			</div> : <p className="mt-5 text-sm leading-7 text-muted">No query was flagged. The measured workload stayed within the rehearsal’s checks for this demo profile.</p>}
		</section>

		<section className="mt-5 border border-focus/25 bg-focus/[0.04] p-6 md:p-8">
			<div className="eyebrow">Suggested next step</div>
			<p className="mt-3 max-w-3xl text-base leading-7 text-ink">{review.recommendation}</p>
			<Link className="button-secondary mt-5" href={`/run/${id}/report`}>Return to query evidence <ArrowRight size={15} /></Link>
		</section>

		<p className="mt-6 text-xs leading-5 text-muted">Demonstration preview: this is a deterministic, evidence-based summary, not a live AI-generated review. Validate changes with production-scale data and workload before release.</p>
	</main>;
}
