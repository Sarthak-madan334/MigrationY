"use client";

import { ArrowRight, Check, FileCode2, Github, LoaderCircle, LogOut, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { beginGitHubOAuth, createRehearsal, disconnectGitHub, getGitHubSession, listGitHubMigrations, listGitHubRepos, type GitHubMigration, type GitHubRepo, type GitHubUser } from "@/lib/api";

export default function ConnectPage() {
	const [manifestReady, setManifestReady] = useState(false);
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
	const selectedRepo = repos.find((repo) => repo.id === selectedRepoId);
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
		if (query.get("github_error") === "authorization_cancelled") setError("GitHub authorization was cancelled. You can retry or use the local sample.");
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
				? "GitHub OAuth is not configured on this backend. Use the local sample repository for now."
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
		if (!sampleMode) return;
		setStarting(true);
		setError(null);
		try {
			const run = await createRehearsal();
			window.location.href = `/run/${run.run_id}`;
		} catch {
			setError("The backend did not accept the rehearsal request.");
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
				<div className="eyebrow eyebrow-inline">Connect / phase 01</div>
			</header>

			<div className="connect-intro">
				<div className="eyebrow">Ready the rehearsal</div>
				<h1 className="connect-title">Connect the change surface.</h1>
				<p className="connect-subtitle">Choose the repository, migration, and workload the shadow database should prove.</p>
			</div>

			<div className="connect-steps" aria-label="Rehearsal setup steps">
				<div className={`connect-step ${sampleMode || githubUser ? "is-complete" : "is-active"}`} style={{ animationDelay: "0ms" }}>
					<div className="step-label">{sampleMode || githubUser ? <Check size={14} /> : <span className="step-dot" />} 01 / CONNECT REPO</div>
					<div className="step-name">{sampleMode ? "Local sample repository" : selectedRepo?.full_name ?? "Choose a repository"}</div>
					<div className="step-meta">{sampleMode ? "No OAuth required" : githubUser ? `Connected as @${githubUser.login}` : "Read-only public repository access"}</div>
				</div>
				<div className={`connect-step ${selectedMigrationPath ? "is-active" : "is-upcoming"}`} style={{ animationDelay: "120ms" }}>
					<div className="step-label"><span className="step-dot" /> 02 / SELECT MIGRATION</div>
					<div className="step-name">{sampleMode ? "phase0/add_status_index.sql" : selectedMigrationPath || "Select a repository first"}</div>
					<div className="step-meta">{sampleMode ? "PostgreSQL · +1 index" : selectedMigration?.detected_dialect ?? "Detected from GitHub"}</div>
				</div>
				<div className="connect-step is-upcoming" style={{ animationDelay: "240ms" }}>
					<div className="step-label">03 / SELECT MANIFEST</div>
					<div className="step-name">Representative workload</div>
					<div className="step-meta">Six sample queries · null pressure profile</div>
				</div>
			</div>

			<div className="file-grid">
				<section className="file-panel" style={{ animationDelay: "180ms" }}>
					<div className="file-panel-header">
						<div>
							<div className="panel-title">Repository and migration</div>
							<div className="panel-subtitle">Connect GitHub or use the local sample.</div>
						</div>
						<Github className="panel-icon" size={19} />
					</div>
					<label className="block">
						<span className="code-label">Repository</span>
						<select className="manifest-toggle mt-2" value={selectedRepoId} onChange={(event) => setSelectedRepoId(event.target.value)} aria-label="Select repository">
							<option value="sample">MigrationZ local sample</option>
							{repos.map((repo) => <option value={repo.id} key={repo.id}>{repo.full_name}</option>)}
						</select>
					</label>
					{githubUser ? <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted"><span>GitHub account: @{githubUser.login}</span><button className="manifest-action inline-flex items-center gap-1" onClick={disconnect}><LogOut size={13} /> Disconnect</button></div> : <button className="button-secondary mt-3" onClick={connectGitHub} disabled={connecting || checkingSession}>{connecting ? <LoaderCircle className="animate-spin" size={15} /> : <Github size={15} />}{connecting ? "Connecting..." : "Connect GitHub"}</button>}
					{!sampleMode ? <label className="mt-4 block">
						<span className="code-label">Detected migration</span>
						{loadingMigrations ? <span className="manifest-toggle mt-2 justify-start">Loading migration files...</span> : migrations.length ? <select className="manifest-toggle mt-2" value={selectedMigrationPath} onChange={(event) => setSelectedMigrationPath(event.target.value)} aria-label="Select migration">{migrations.map((migration) => <option value={migration.path} key={migration.path}>{migration.path}</option>)}</select> : <span className="manifest-toggle mt-2 justify-start">No migration files detected</span>}
					</label> : <div className="code-block mt-4">
						<div className="code-label">migrations / phase0 / add_status_index.sql</div>
						<div className="diff-line" style={{ animationDelay: "220ms" }}>+ CREATE INDEX orders_status_idx</div>
						<div className="diff-line" style={{ animationDelay: "300ms" }}>+ ON orders (status);</div>
					</div>}
					{!sampleMode && selectedMigration ? <pre className="code-block mt-3 max-h-36 overflow-auto whitespace-pre-wrap">{selectedMigration.diff_preview}</pre> : null}
				</section>

				<section className="file-panel" style={{ animationDelay: "260ms" }}>
					<div className="file-panel-header">
						<div>
							<div className="panel-title">Query manifest</div>
							<div className="panel-subtitle">Use the Phase 0 workload for this rehearsal.</div>
						</div>
						<Upload className="panel-icon" size={19} />
					</div>
					<button
						className={`manifest-toggle ${manifestReady ? "is-ready" : ""}`}
						onClick={() => setManifestReady(!manifestReady)}
					>
						<span>
							<span className="manifest-file">sample_query_manifest.yaml</span>
							<span className="manifest-summary">6 representative PostgreSQL queries</span>
						</span>
						{manifestReady ? <Check className="manifest-check" size={18} /> : <span className="manifest-action">USE SAMPLE</span>}
					</button>
				</section>
			</div>

			<div className="connect-footer">
				{sampleMode ? <><div className="footer-note"><Github size={15} /> OAuth is optional for the local sample rehearsal.</div><button className="button-primary" disabled={!manifestReady || starting} onClick={startRun}>{starting ? "Starting rehearsal..." : "Run Rehearsal"}<ArrowRight size={16} /></button></> : <><div className="footer-note"><FileCode2 size={15} /> Repository and migration selected for GitHub integration.</div><button className="button-secondary" onClick={() => { setSelectedRepoId("sample"); setManifestReady(false); }}>Use local sample</button></>}
			</div>
			{error ? <div className="error-banner"><X size={14} /> {error}</div> : null}
		</main>
	);
}
