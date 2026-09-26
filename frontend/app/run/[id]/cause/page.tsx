"use client";

import { ArrowLeft, Check, Copy, Download, FileWarning, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { BisectionTrail } from "@/components/BisectionTrail";
import { PlanDiff } from "@/components/PlanDiff";
import { bisectQuery, getReproScriptUrl, getRunResult, type BisectResult, type QueryResult } from "@/lib/api";

type CauseData = { query: QueryResult; bisection: BisectResult };

export default function CausePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const [cause, setCause] = useState<CauseData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let active = true;
		const loadCause = async () => {
			setLoading(true);
			setError(null);
			setCause(null);
			try {
				const report = await getRunResult(id);
				if (!report.can_bisect) throw new Error("Root cause bisection is currently available only for the built-in sample migration. This report still includes the full query and execution plan review.");
				const requestedQueryId = new URLSearchParams(window.location.search).get("query");
				const query = requestedQueryId
					? report.queries.find((item) => item.id === requestedQueryId)
					: report.queries.find((item) => item.verdict === "regressed");
				if (!query) throw new Error(requestedQueryId ? "The selected query was not found in this report." : "This run has no regressed query to bisect.");
				if (query.verdict !== "regressed") throw new Error("The selected query did not regress, so there is no root cause to bisect.");

				const bisection = await bisectQuery(id, query.id);
				if (active) setCause({ query, bisection });
			} catch (causeError) {
				if (active) setError(causeError instanceof Error ? causeError.message : "The root cause could not be computed.");
			} finally {
				if (active) setLoading(false);
			}
		};

		void loadCause();
		return () => { active = false; };
	}, [id, attempt]);

	const copyPrComment = async () => {
		if (!cause) return;
		const comment = `Migration regression reproduced in ${cause.bisection.minimal_row_count} rows.\n\n${cause.bisection.minimal_condition}\n\nQuery: ${cause.query.id}`;
		try {
			await navigator.clipboard.writeText(comment);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			setCopyError("Clipboard access is unavailable in this browser.");
		}
	};

	return <main className="shell">
		<header className="mb-10 flex items-center justify-between gap-4">
			<Link className="flex items-center gap-2 font-mono text-xs text-muted hover:text-ink" href={`/run/${id}/report`}><ArrowLeft size={14} /> Back to results</Link>
			<div className="eyebrow">Investigation / computed cause</div>
		</header>
		<div className="mb-8">
			<div className="eyebrow mb-3">Root-cause drill-down</div>
			<h1 className="font-display text-3xl">Minimal reproducing condition</h1>
			<p className="mt-2 text-sm text-muted">The bisector repeatedly reruns the selected query against smaller generated datasets.</p>
		</div>
		{loading ? <section className="panel flex min-h-[320px] flex-col items-center justify-center text-center">
			<LoaderCircle className="mb-4 animate-spin text-focus" size={24} />
			<h2 className="font-display text-xl">Bisecting the regression…</h2>
			<p className="mt-2 text-sm text-muted">Recreating the run and testing smaller row subsets.</p>
		</section> : null}
		{error && !loading ? <section className="panel flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
			<FileWarning className="mb-4 text-warn" size={26} />
			<h2 className="font-display text-xl">The root cause is unavailable.</h2>
			<p className="mt-2 max-w-lg text-sm leading-6 text-muted">{error}</p>
			<button className="button-secondary mt-6" onClick={() => setAttempt((value) => value + 1)}><RotateCcw size={15} /> Retry bisection</button>
		</section> : null}
		{cause ? <>
			<section className="panel mb-6 border-l-2 border-l-alert">
				<div className="eyebrow">Query {cause.query.id} / {cause.bisection.minimal_row_count.toLocaleString()} rows</div>
				<p className="mt-3 font-display text-xl leading-7">{cause.bisection.minimal_condition}</p>
				<pre className="mt-4 overflow-x-auto border border-border bg-surface p-4 font-mono text-xs leading-6 text-mono">{cause.query.sql}</pre>
			</section>
			<section className="panel mb-6">
				<div className="mb-4 flex items-end justify-between gap-4">
					<div><div className="eyebrow">Delta-debug trail</div><h2 className="mt-2 font-display text-xl">Dataset narrowed to a minimal repro</h2></div>
					<div className="font-mono text-xs text-muted">{cause.bisection.bisection_trail.length} accepted subsets</div>
				</div>
				<BisectionTrail steps={cause.bisection.bisection_trail.map((rowCount, index, trail) => ({
					row_count: rowCount,
					label: index === 0 ? "full input" : index === trail.length - 1 ? "minimal" : `step ${index}`,
				}))} />
			</section>
			<section className="mb-6">
				<div className="mb-4"><div className="eyebrow">Observed plan change</div><h2 className="mt-2 font-display text-xl">Before and after migration</h2></div>
				<PlanDiff before={cause.query.plan_before} after={cause.query.plan_after} />
			</section>
			<div className="flex flex-wrap gap-3">
				<a className="button-primary" href={getReproScriptUrl(id, cause.query.id)} download="repro.sql"><Download size={15} /> Download minimal repro</a>
				<button className="button-secondary" onClick={copyPrComment}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy PR comment"}</button>
			</div>
			{copyError ? <p className="mt-3 text-sm text-warn" role="status">{copyError}</p> : null}
		</> : null}
	</main>;
}
