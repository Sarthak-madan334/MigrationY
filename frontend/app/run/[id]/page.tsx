"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { LiveLogPanel } from "@/components/LiveLogPanel";
import { PipelineStages } from "@/components/PipelineStages";
import { getRunStatus, type RunStage, type RunStatus } from "@/lib/api";
import { subscribeToRunStatus, type RunConnection } from "@/lib/sse";

const fallbackLogs = [{ ts: "--:--:--", level: "info" as const, message: "Waiting for the orchestration stream..." }];

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return <RunContent id={id} />;
}

function RunContent({ id }: { id: string }) {
	const [status, setStatus] = useState<RunStatus>({ run_id: id, stage: "queued", log: fallbackLogs, progress_pct: 0 });
	const [connection, setConnection] = useState<RunConnection>("connecting");
	const [refreshing, setRefreshing] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [connectionAttempt, setConnectionAttempt] = useState(0);

	async function refreshStatus() {
		setRefreshing(true);
		try {
			const next = await getRunStatus(id);
			setStatus(next);
			setConnectionError(null);
		} catch (error) {
			setConnection("disconnected");
			setConnectionError(error instanceof Error ? error.message : "The backend could not return this run's status.");
		} finally {
			window.setTimeout(() => setRefreshing(false), 400);
		}
	}

	useEffect(() => {
		return subscribeToRunStatus(
			id,
			setStatus,
			(next) => {
				setConnection(next);
				if (next === "streaming" || next === "polling") setConnectionError(null);
			},
			() => setConnectionError("The backend did not respond for 30 seconds. Check the API and retry this run."),
		);
	}, [id, connectionAttempt]);

	useEffect(() => {
		if (status.stage !== "done") return;
		const timer = window.setTimeout(() => { window.location.replace(`/run/${id}/report`); }, 600);
		return () => window.clearTimeout(timer);
	}, [id, status.stage]);

	const visibleStage: RunStage = status.stage;
	const log = status.log.length ? status.log : fallbackLogs;
	const progressValue = Math.min(Math.max(status.progress_pct ?? 0, 0), 100);
	const retryConnection = () => {
		setConnectionError(null);
		setConnection("connecting");
		setConnectionAttempt((attempt) => attempt + 1);
		void refreshStatus();
	};

	return (
		<main className="run-shell">
			<header className="run-header">
				<Link className="brand-link" href="/">
					<span className="brand-mark" aria-hidden="true">
						<svg viewBox="0 0 80 80" role="img">
							<g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
								<path d="M40 8v64M8 40h64M18 18l44 44M18 62l44-44" strokeWidth="4.5" opacity="0.9" />
								<circle cx="40" cy="40" r="11" strokeWidth="3" opacity="0.8" />
							</g>
						</svg>
					</span>
					<span className="brand-text">MIGRATION REHEARSAL</span>
				</Link>
				<div className="run-id">RUN / {id.slice(0, 8)}</div>
			</header>

			<div className="run-headline-row">
				<div>
					<div className="eyebrow">Live rehearsal run</div>
					<h1 className="run-title">Watching the migration under pressure.</h1>
					<p className="run-subtitle">The pipeline records each state change. The verdict comes after the workload finishes.</p>
				</div>
				<div className="progress-summary" aria-live="polite">
					<div className="progress-ring" style={{ background: `conic-gradient(var(--accent-focus) ${progressValue * 3.6}deg, rgba(148, 163, 184, 0.18) 0deg)` }}>
						<span>{progressValue}%</span>
					</div>
					<div className="progress-copy">
						<div className="progress-label">Pipeline progress</div>
						<div className="progress-meta">{connection === "streaming" ? "Live status stream" : connection === "polling" ? "Polling status" : connection === "disconnected" ? "Reconnecting to backend" : "Connecting to backend"}</div>
					</div>
				</div>
			</div>

			<div className="run-panels">
				<section className="panel run-panel pipeline-panel">
					<div className="panel-head">
						<div className="panel-kicker">Execution pipeline</div>
						<button
							type="button"
							className="refresh-button"
							title="Refresh pipeline status"
							onClick={refreshStatus}
							aria-label="Refresh pipeline status"
						>
							<RefreshCw className={refreshing ? "spin-refresh" : ""} size={15} />
						</button>
					</div>
					<PipelineStages stage={visibleStage} failedStage={status.failed_stage} />
				</section>
				<LiveLogPanel lines={log} connection={connection} />
			</div>

			{status.stage === "failed" ? (
				<div className="error-banner" role="alert">{status.log.at(-1)?.message ?? "The rehearsal failed. Check the backend and try again."}</div>
			) : null}
			{connectionError ? <div className="error-banner" role="alert"><span>{connectionError}</span><button type="button" className="button-secondary" onClick={retryConnection}><RefreshCw size={14} /> Retry connection</button></div> : null}
			{connection === "disconnected" && !connectionError ? <p className="mt-4 text-sm text-warn" role="status">The backend is unreachable. Retrying the run status automatically.</p> : null}
			{status.stage === "done" ? (
				<div className="run-footer">
					<Link className="button-primary" href={`/run/${id}/report`}>Open results <ArrowRight size={16} /></Link>
				</div>
			) : null}
		</main>
	);
}
