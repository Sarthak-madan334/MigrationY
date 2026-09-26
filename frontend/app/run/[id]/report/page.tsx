"use client";

import { ArrowLeft, Download, FileWarning, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { QueryResultsTable } from "@/components/QueryResultsTable";
import { VerdictBanner } from "@/components/VerdictBanner";
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
			.catch(() => { if (active) setError("The backend could not return this run's results."); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [id]);

	const regressions = result?.queries.filter((query) => query.verdict === "regressed") ?? [];
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

	return <main className="shell">
		<header className="mb-14 flex items-center justify-between">
			<Link className="flex items-center gap-2 font-mono text-xs text-muted hover:text-ink" href={`/run/${id}`}><ArrowLeft size={14} /> Back to live run</Link>
			<div className="eyebrow">Results / computed report</div>
		</header>
		{loading ? <div className="panel flex min-h-[320px] flex-col items-center justify-center text-center" role="status">
			<LoaderCircle className="mb-4 animate-spin text-focus" size={24} />
			<h1 className="font-display text-xl">Loading the measured results…</h1>
			<p className="mt-2 text-sm text-muted">Retrieving query timings and execution plans from the rehearsal.</p>
		</div> : null}
		{!loading && result ? <>
			<div className="mb-8"><div className="eyebrow mb-4">Rehearsal verdict</div><h1 className="font-display text-4xl tracking-[-0.03em]">The workload has been measured.</h1></div>
			<VerdictBanner regressed={regressions.length} total={result.queries.length} />
			<div className="mt-8 flex flex-wrap items-center justify-between gap-4">
				<div><div className="font-display text-xl">Query results</div><div className="mt-1 text-sm text-muted">Before and after measurements from the shadow database.</div></div>
				{regressions.length ? <button className="button-secondary" onClick={exportRepro} disabled={exporting}>
					{exporting ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}
					{exporting ? "Preparing minimal repro…" : "Export reproducible case"}
				</button> : null}
			</div>
			<div className="mt-4"><QueryResultsTable queries={result.queries} runId={id} /></div>
		</> : null}
		{!loading && error ? <div className="panel flex min-h-[300px] flex-col items-center justify-center px-6 text-center" role="alert">
			<FileWarning className="mb-5 text-warn" size={28} />
			<h1 className="font-display text-2xl">Results are unavailable.</h1>
			<p className="mt-3 max-w-md text-sm leading-6 text-muted">{error}</p>
			<Link className="button-secondary mt-7" href={`/run/${id}`}>Return to the live run</Link>
		</div> : null}
	</main>;
}
