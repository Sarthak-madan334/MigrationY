"use client";

import { ArrowRight, Check, FileCode2, Github, LoaderCircle, LogOut, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { beginGitHubOAuth, createRehearsal, disconnectGitHub, getGitHubMigrationSource, getGitHubSession, listGitHubMigrations, listGitHubRepos, type GitHubMigration, type GitHubRepo, type GitHubUser } from "@/lib/api";

export default function ConnectPage() {
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [githubUser, setGitHubUser] = useState<GitHubUser | null>(null);
	const [repos, setRepos] = useState<GitHubRepo[]>([]);
	const [selectedRepoId, setSelectedRepoId] = useState("sample");
	const [migrations, setMigrations] = useState<GitHubMigration[]>([]);
	const [selectedMigrationPath, setSelectedMigrationPath] = useState("phase0/add_status_index.sql");
	const [checkingSession, setCheckingSession] = useState(true);
	const [loadingMigrations, setLoadingMigrations] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const sampleMode = selectedRepoId === "sample";
	const selectedMigration = migrations.find((migration) => migration.path === selectedMigrationPath);

	useEffect(() => {
		let active = true;
		const checkSession = async () => {
			try {
				const session = await getGitHubSession();
				if (!active) return;
				setGitHubUser(session.user);
				const result = await listGitHubRepos();
				if (active) setRepos(result.repos);
			} catch (sessionError) {
				if (active && !(sessionError instanceof Error && sessionError.message.includes("401"))) {
					setError("GitHub connection status could not be checked.");
				}
			} finally {
				if (active) setCheckingSession(false);
			}
		};
		void checkSession();
		const query = new URLSearchParams(window.location.search);
		if (query.get("github_error") === "authorization_cancelled") setError("GitHub authorization was cancelled. You can retry or use the built-in example.");
		if (query.has("github")) window.history.replaceState({}, "", "/connect");
		if (query.has("github_error")) window.history.replaceState({}, "", "/connect");
		return () => { active = false; };
	}, []);

	useEffect(() => {
		if (!githubUser || sampleMode) {
			setMigrations([]);
			setSelectedMigrationPath(sampleMode ? "phase0/add_status_index.sql" : "");
			return;
		}
		let active = true;
		setLoadingMigrations(true);
		setMigrations([]);
		setSelectedMigrationPath("");
		listGitHubMigrations(selectedRepoId)
			.then((result) => {
				if (!active) return;
				setMigrations(result.migrations);
				setSelectedMigrationPath(result.migrations[0]?.path ?? "");
			})
			.catch(() => { if (active) setError("Migration files could not be loaded from this repository."); })
			.finally(() => { if (active) setLoadingMigrations(false); });
		return () => { active = false; };
	}, [githubUser, sampleMode, selectedRepoId]);

	async function connectGitHub() {
		setConnecting(true);
		setError(null);
		try {
			const authorization = await beginGitHubOAuth();
			window.location.assign(authorization.authorization_url);
		} catch (oauthError) {
			setError(oauthError instanceof Error && oauthError.message.includes("503")
				? "GitHub sign-in is not configured on this backend. You can still run the built-in example."
				: "GitHub authorization could not be started.");
			setConnecting(false);
		}
	}

	async function disconnect() {
		try {
			await disconnectGitHub();
			setGitHubUser(null);
			setRepos([]);
			setSelectedRepoId("sample");
		} catch {
			setError("GitHub could not be disconnected.");
		}
	}

	async function startRun() {
		if (!sampleMode && (!selectedRepoId || !selectedMigration || selectedMigration.detected_dialect !== "postgres" || !selectedMigrationPath.toLowerCase().endsWith(".sql"))) {
			setError("Choose a PostgreSQL .sql migration to review.");
			return;
		}
		setStarting(true);
		setError(null);
		try {
			const source = sampleMode ? undefined : await getGitHubMigrationSource(selectedRepoId, selectedMigrationPath);
			const run = await createRehearsal(source ? { repo_id: selectedRepoId, migration_path: source.path, migration_sql: source.sql } : undefined);
			window.location.href = `/run/${run.run_id}`;
		} catch (runError) {
			const reason = runError instanceof Error ? runError.message : "Unknown error";
			setError(`The rehearsal could not start: ${reason}`);
			setStarting(false);
		}
	}

	return (
		<main className="connect-shell">
			<header className="connect-header">
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
				<div className="eyebrow eyebrow-inline">Database rehearsal</div>
			</header>

			<div className="connect-intro">
				<div className="eyebrow">Migration review</div>
				<h1 className="connect-title">Set up a rehearsal.</h1>
				<p className="connect-subtitle">Choose a GitHub migration to review against a small PostgreSQL dataset and sample queries.</p>
			</div>

			<div className="file-grid">
				<section className="file-panel" style={{ animationDelay: "180ms" }}>
					<div className="file-panel-header">
						<div>
							<div className="panel-title">Repository and migration</div>
							<div className="panel-subtitle">Choose a repository and migration file.</div>
						</div>
						<Github className="panel-icon" size={19} />
					</div>
					<label className="block">
						<span className="code-label">Repository</span>
						<select className="manifest-toggle mt-2" value={selectedRepoId} onChange={(event) => setSelectedRepoId(event.target.value)} aria-label="Select repository">
							<option value="sample">Built-in example</option>
							{repos.map((repo) => <option value={repo.id} key={repo.id}>{repo.full_name}</option>)}
						</select>
					</label>
					{githubUser ? <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted"><span>GitHub account: @{githubUser.login}</span><button className="manifest-action inline-flex items-center gap-1" onClick={disconnect}><LogOut size={13} /> Disconnect</button></div> : <button className="button-secondary mt-3" onClick={connectGitHub} disabled={connecting || checkingSession}>{connecting ? <LoaderCircle className="animate-spin" size={15} /> : <Github size={15} />}{connecting ? "Connecting..." : "Connect GitHub"}</button>}
					{!sampleMode ? <label className="mt-4 block">
						<span className="code-label">Detected migration</span>
						{loadingMigrations ? <span className="manifest-toggle mt-2 justify-start">Loading migration files...</span> : migrations.length ? <select className="manifest-toggle mt-2" value={selectedMigrationPath} onChange={(event) => setSelectedMigrationPath(event.target.value)} aria-label="Select migration">{migrations.map((migration) => <option value={migration.path} key={migration.path}>{migration.path}</option>)}</select> : <span className="manifest-toggle mt-2 justify-start">No migration files detected</span>}
					</label> : <div className="code-block mt-4">
						<div className="code-label">Built-in PostgreSQL migration</div>
						<div className="diff-line" style={{ animationDelay: "220ms" }}>+ CREATE INDEX orders_status_idx</div>
						<div className="diff-line" style={{ animationDelay: "300ms" }}>+ ON orders (status);</div>
					</div>}
					{!sampleMode && selectedMigration ? <pre className="code-block mt-3 max-h-36 overflow-auto whitespace-pre-wrap">{selectedMigration.diff_preview}</pre> : null}
				</section>

				<section className="file-panel" style={{ animationDelay: "260ms" }}>
					<div className="file-panel-header">
						<div>
							<div className="panel-title">Query manifest</div>
							<div className="panel-subtitle">Compare before and after with six sample queries.</div>
						</div>
						<Upload className="panel-icon" size={19} />
					</div>
					<div className="manifest-toggle is-ready">
						<span>
							<span className="manifest-file">sample_query_manifest.yaml</span>
							<span className="manifest-summary">6 representative PostgreSQL queries</span>
						</span>
						<Check className="manifest-check" size={18} />
					</div>
				</section>
			</div>

			<div className="connect-footer">
				<div className="footer-note"><FileCode2 size={15} /> {sampleMode ? "Runs the example migration against 50 generated orders and six sample queries." : "Runs on 50 generated orders and six sample queries. Migration must match the demo orders schema."}</div>
				<div className="flex items-center gap-3">
					{!sampleMode ? <button className="button-secondary" onClick={() => setSelectedRepoId("sample")}>Use built-in example</button> : null}
					<button className="button-primary" disabled={starting || (!sampleMode && (!selectedMigration || selectedMigration.detected_dialect !== "postgres" || !selectedMigrationPath.toLowerCase().endsWith(".sql")))} onClick={startRun}>{starting ? <><LoaderCircle className="animate-spin" size={15} /> Starting…</> : <>Run Rehearsal<ArrowRight size={16} /></>}</button>
				</div>
			</div>
			{error ? <div className="error-banner"><X size={14} /> {error}</div> : null}
		</main>
	);
}
