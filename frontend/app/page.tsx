"use client";

import { ArrowRight, Check, ChevronDown, ChevronUp, Circle, Clock3, Database, FileCode2, Github, Play, ShieldCheck, Sparkles, Terminal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askFaqQuestion, createRehearsal, getRunResult, getRunStatus, type FaqTurn, type QueryResult, type RunStage, type RunStatus } from "@/lib/api";

const pipeline = [
	{ key: "provisioning" as RunStage, label: "Creating isolated database" },
	{ key: "seeding" as RunStage, label: "Generating edge cases" },
	{ key: "migrating" as RunStage, label: "Running migration" },
	{ key: "querying" as RunStage, label: "Checking constraints" },
	{ key: "analyzing" as RunStage, label: "Inspecting affected rows" },
];
const migrationSql = "DROP INDEX orders_created_at_idx;\nCREATE INDEX orders_status_idx\nON orders (status);";
const InteractiveBotElement = "interactive-bot" as any;

function BrandMark() { return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 80 80" role="img"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M40 8v64M8 40h64M18 18l44 44M18 62l44-44" strokeWidth="4.5" opacity="0.9" /><circle cx="40" cy="40" r="11" strokeWidth="3" opacity="0.8" /></g></svg></span>; }
type DemoState = "idle" | "running" | "done" | "error";

export default function LandingPage() {
	const previewRef = useRef<HTMLElement>(null);
	const [demoState, setDemoState] = useState<DemoState>("idle");
	const [status, setStatus] = useState<RunStatus | null>(null);
	const [result, setResult] = useState<{ verdict: "regressed" | "clean"; queries: QueryResult[] } | null>(null);
	const [runError, setRunError] = useState<string | null>(null);
	const [evidenceOpen, setEvidenceOpen] = useState(false);
	const [faqOpen, setFaqOpen] = useState(false);

	const startRehearsal = async () => {
		if (demoState === "running") return;
		setDemoState("running"); setRunError(null); setStatus({ run_id: "pending", stage: "queued", log: [], progress_pct: 0 }); setResult(null); setEvidenceOpen(false);
		previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		try {
			const run = await createRehearsal();
			let finished = false;
			while (!finished) {
				const next = await getRunStatus(run.run_id); setStatus(next);
				if (next.stage === "failed") throw new Error(next.log.at(-1)?.message ?? "The rehearsal failed.");
				if (next.stage === "done") { const completed = await getRunResult(run.run_id); setResult(completed); setDemoState("done"); finished = true; }
				else await new Promise((resolve) => window.setTimeout(resolve, 700));
			}
		} catch (error) { setRunError(error instanceof Error ? error.message : "The rehearsal could not start."); setDemoState("error"); }
	};

	const leadRegression = result?.queries.filter((query) => query.verdict === "regressed").sort((a, b) => b.regression_factor - a.regression_factor)[0];
	const activeStage = status ? pipeline.findIndex((item) => item.key === status.stage) : -1;

	return <main className="landing-page">
		<header className="hero-header is-visible"><Link className="brand-link" href="/" aria-label="MigrationZ home"><BrandMark /><span className="brand-text">MigrationZ</span></Link><a className="repo-link" href="https://github.com/Sarthak-madan334/MRA"><Github size={15} /><span>Sarthak-madan334/MRA</span><ArrowRight size={13} /></a></header>
		<section className="hero-shell"><div className="hero-spotlight" aria-hidden="true" /><div className="hero-copy"><div className="eyebrow">Database change intelligence / local rehearsal</div><h1 className="hero-title">Your migration passes<br />on clean data.<br /><span className="highlight-callout">Production data isn&apos;t clean.</span></h1><p className="hero-subtitle">Generate realistic edge cases, rehearse the migration in isolation, and prove exactly what breaks.</p><div className="hero-actions"><button className="button-primary" onClick={startRehearsal} disabled={demoState === "running"}><Play size={15} fill="currentColor" /><span>{demoState === "running" ? "Rehearsal running..." : "Run a Rehearsal"}</span><ArrowRight size={16} /></button><Link className="button-secondary" href="/connect">Connect GitHub <Github size={15} /></Link></div><div className="hero-reassurance">No signup <span>·</span> No production database <span>·</span> Runs in an isolated rehearsal</div><div className="hero-stat mono-data">Demo profile: 50,000 rows · PostgreSQL 16 · shadow database</div></div><div className="hero-mascot" aria-label="Migration Rehearsal agent is ready"><InteractiveBotElement greeting="Ready when you are" aria-label="Migration Rehearsal agent" /></div></section>
		<section className="preview-section" id="rehearsal" ref={previewRef}><div className="section-kicker"><span>01</span> LIVE REHEARSAL PREVIEW</div><div className={`rehearsal-console ${demoState === "running" ? "is-running" : ""} ${demoState === "done" ? "is-complete" : ""}`}><div className="console-topbar"><div className="console-title"><span className="status-dot" /> REHEARSAL <span className="console-id">/ phase-1-demo</span></div><div className="console-status">{demoState === "idle" ? "READY" : demoState === "running" ? "EXECUTING" : demoState === "done" ? "MEASURED" : "RETRY REQUIRED"}</div></div>{demoState !== "running" && demoState !== "done" ? <div className="console-grid"><div className="console-editor"><div className="console-label">MIGRATION</div><div className="code-editor"><div className="code-line"><span className="code-number">01</span><span className="code-keyword">DROP INDEX</span> <span className="code-value">orders_created_at_idx;</span></div><div className="code-line"><span className="code-number">02</span><span className="code-keyword">CREATE INDEX</span> <span className="code-value">orders_status_idx</span></div><div className="code-line"><span className="code-number">03</span><span className="code-keyword">ON</span> <span className="code-value">orders (status);</span><span className="code-cursor" /></div></div></div><div className="console-config"><div className="console-label">DATASET</div><div className="dataset-value"><Database size={16} className="text-focus" /><div><strong>Production-shaped</strong><span>50,000 orders · null pressure</span></div></div><div className="dataset-meta"><span>PostgreSQL 16</span><span>isolated shadow DB</span></div></div><button className="console-run button-primary" onClick={startRehearsal}><Play size={14} fill="currentColor" /> RUN REHEARSAL <ArrowRight size={15} /></button></div> : null}{demoState === "running" ? <RunningConsole status={status} activeStage={activeStage} /> : null}{demoState === "done" && result ? <ResultConsole result={result} leadRegression={leadRegression} evidenceOpen={evidenceOpen} setEvidenceOpen={setEvidenceOpen} /> : null}{demoState === "error" ? <div className="run-error"><TriangleAlert size={20} /><div><strong>Rehearsal unavailable</strong><span>{runError}</span></div><button className="button-secondary" onClick={startRehearsal}>Try again</button></div> : null}</div></section>
		<section className="feature-strip"><Feature icon={<Sparkles size={17} />} number="01" title="GENERATE EDGE CASES" copy="Find the data production quietly accumulated." tone="focus" /><Feature icon={<ShieldCheck size={17} />} number="02" title="REHEARSE THE MIGRATION" copy="Run the real schema change in isolation." tone="signal" /><Feature icon={<FileCode2 size={17} />} number="03" title="PROVE THE FAILURE" copy="Return exact evidence and a reproducible case." tone="alert" /></section>
		<section className="contrast-section"><div className="section-kicker"><span>02</span> WHY REHEARSAL</div><div className="contrast-grid"><Contrast title="WITHOUT REHEARSAL" tone="muted" steps={["Migration looks valid", "Production", "Rows break it"]} /><div className="contrast-divider">VS</div><Contrast title="WITH MIGRATION REHEARSAL" tone="signal" steps={["Migration tested", "Violating rows discovered", "Blocked before production"]} /></div></section>
		<section className="how-section" id="how-it-works"><div className="section-kicker"><span>03</span> HOW IT WORKS</div><div className="how-grid"><HowStep icon={<FileCode2 size={18} />} label="SCHEMA" copy="Read the structure and migration." /><HowStep icon={<Sparkles size={18} />} label="DATA" copy="Generate realistic edge conditions." /><HowStep icon={<Database size={18} />} label="REHEARSE" copy="Execute against an isolated database and observe the result." /></div><div className="evidence-claim"><Terminal size={16} /> Every finding comes with evidence.</div></section>
		<FaqPanel open={faqOpen} setOpen={setFaqOpen} />
	</main>;
}

function RunningConsole({ status, activeStage }: { status: RunStatus | null; activeStage: number }) { return <div className="running-console"><div className="agent-column"><div className="console-label">REHEARSAL AGENT</div>{pipeline.map((item, index) => <div className={`agent-step ${index < activeStage ? "is-complete" : index === activeStage ? "is-active" : ""}`} key={item.key}>{index < activeStage ? <Check size={13} /> : index === activeStage ? <span className="agent-pulse" /> : <Circle size={11} />}<span>{String(index + 1).padStart(2, "0")}</span>{item.label}</div>)}</div><div className="live-console"><div className="console-label">LIVE EXECUTION <span className="live-indicator">● LIVE</span></div><div className="live-progress"><div style={{ width: `${status?.progress_pct ?? 0}%` }} /></div><div className="log-lines">{status?.log.length ? status.log.map((line, index) => <div className={line.level === "error" || line.level === "warn" ? "log-warn" : ""} key={`${line.ts}-${index}`}><span>{new Date(line.ts).toLocaleTimeString([], { hour12: false })}</span>{line.message}</div>) : <div className="log-muted">Preparing the isolated rehearsal...</div>}</div></div></div>; }
function ResultConsole({ result, leadRegression, evidenceOpen, setEvidenceOpen }: { result: { verdict: "regressed" | "clean"; queries: QueryResult[] }; leadRegression?: QueryResult; evidenceOpen: boolean; setEvidenceOpen: (open: boolean) => void }) { const regressed = result.queries.filter((query) => query.verdict === "regressed"); return <div className="result-console"><div className={`result-heading ${result.verdict === "regressed" ? "is-alert" : "is-clean"}`}>{result.verdict === "regressed" ? <TriangleAlert size={21} /> : <Check size={21} />}<div><strong>{result.verdict === "regressed" ? "REGRESSION DETECTED" : "REHEARSAL PASSED"}</strong><span>{result.verdict === "regressed" ? `${regressed.length} of ${result.queries.length} queries changed under rehearsal.` : `All ${result.queries.length} queries passed rehearsal.`}</span></div></div>{leadRegression ? <div className="result-focus"><div className="result-focus-copy"><div className="console-label">MEASURED FINDING</div><h2>{leadRegression.regression_factor.toFixed(2)}× slower after migration.</h2><p><span className="mono">{leadRegression.sql}</span><br />The planner lost its <span className="mono">created_at</span> index and fell back to a sequential scan plus sort.</p></div><div className="result-stat"><span>Before</span><strong>{leadRegression.latency_before_ms.toFixed(2)}<small>ms</small></strong><span>After</span><strong className="text-alert">{leadRegression.latency_after_ms.toFixed(2)}<small>ms</small></strong></div></div> : null}<div className="evidence-grid"><Evidence label="Queries tested" value={String(result.queries.length)} /><Evidence label="Rows seeded" value="50,000" /><Evidence label="Database" value="PostgreSQL 16" /><Evidence label="Migration status" value={result.verdict === "regressed" ? "BLOCKED" : "PASSED"} alert={result.verdict === "regressed"} /></div><button className="evidence-toggle" onClick={() => setEvidenceOpen(!evidenceOpen)}>{evidenceOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {evidenceOpen ? "Hide evidence" : "View evidence"} <ArrowRight size={14} /></button>{evidenceOpen && leadRegression ? <div className="evidence-detail"><div><div className="console-label">EXACT MIGRATION</div><pre>{migrationSql}</pre></div><div><div className="console-label">PLAN CHANGE</div><pre>{leadRegression.plan_before}{"\n\n→\n\n"}{leadRegression.plan_after}</pre></div><div className="evidence-note"><Clock3 size={15} /> Measured from the isolated shadow database. The result is computed by the rehearsal engine.</div></div> : null}<div className="found-before"><span>✓</span> Found before production.</div></div>; }
function Feature({ icon, number, title, copy, tone }: { icon: React.ReactNode; number: string; title: string; copy: string; tone: string }) { return <div className="feature-item"><div className={`feature-icon ${tone}`}>{icon}</div><div><div className="feature-number">{number}</div><div className="feature-label">{title}</div><div className="feature-copy">{copy}</div></div></div>; }
function Contrast({ title, steps, tone }: { title: string; steps: string[]; tone: string }) { return <div className={`contrast-column ${tone}`}><div className="contrast-title">{title}</div>{steps.map((step, index) => <div className="contrast-step" key={step}><span className="contrast-marker">{index === steps.length - 1 ? (tone === "signal" ? "✓" : "×") : "↓"}</span><span>{step}</span></div>)}</div>; }
function HowStep({ icon, label, copy }: { icon: React.ReactNode; label: string; copy: string }) { return <div className="how-step"><div className="how-icon">{icon}</div><div><div className="how-label">{label}</div><p>{copy}</p></div></div>; }
function Evidence({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className="evidence-cell"><span>{label}</span><strong className={alert ? "text-alert" : ""}>{value}</strong></div>; }

function MarkdownAnswer({ content }: { content: string }) {
	const blocks = content.split(/\n\s*\n/).filter(Boolean);
	return <>{blocks.map((block, index) => {
		const lines = block.split("\n");
		if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
			return <ul key={index}>{lines.map((line) => <li key={line}>{renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
		}
		return <p key={index}>{renderInlineMarkdown(lines.join(" "))}</p>;
	})}</>;
}

function renderInlineMarkdown(value: string) {
	return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
		if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
		if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
		return <span key={index}>{part}</span>;
	});
}

function FaqPanel({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
	const [expanded, setExpanded] = useState<number | null>(null);
	const [view, setView] = useState<"faq" | "thread">("faq");
	const [question, setQuestion] = useState("");
	const [turns, setTurns] = useState<FaqTurn[]>([]);
	const [loading, setLoading] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	useEffect(() => {
		if (!open) return;

		const panel = panelRef.current;
		const focusableSelector = "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
		const focusableElements = Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
		focusableElements[0]?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				return;
			}
			if (event.key !== "Tab" || focusableElements.length === 0) return;

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];
			if (event.shiftKey && document.activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
			} else if (!event.shiftKey && document.activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			triggerRef.current?.focus();
		};
	}, [open, setOpen]);
	const faqs = [
		["How does the rehearsal work?", "It provisions an isolated Postgres database, seeds it with production-shaped edge cases, runs your migration, then compares representative query plans and latency before and after."],
		["Is this safe against my schema?", "Yes. The rehearsal runs against a disposable shadow database. It never writes to your production database or changes the schema you connect from."],
		["What is a bisection?", "Bisection repeatedly narrows the dataset until it finds the smallest subset of rows or conditions that still reproduces a regression."],
	];
	const submitQuestion = async () => {
		if (!question.trim()) return;
		const nextQuestion = question.trim();
		setQuestion(""); setLoading(true);
		try {
			const response = await askFaqQuestion(nextQuestion, turns);
			setTurns((current) => [...current, { question: nextQuestion, answer: response.answer }]);
		} catch {
			setTurns((current) => [...current, { question: nextQuestion, answer: "The local answer service is unavailable. The product and architecture docs remain the source of truth." }]);
		} finally { setLoading(false); }
	};
	return <>
		<button ref={triggerRef} className="faq-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>QUESTIONS?</button>
		<button className={`faq-backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-label="Dismiss questions overlay" aria-hidden={!open} tabIndex={-1} />
		<aside ref={panelRef} className={`faq-panel ${open ? "is-open" : ""}`} role="dialog" aria-modal={open} aria-hidden={!open} aria-label="How this works"><div className="faq-panel-header"><div><div className="console-label">REFERENCE / MRA-001</div><h2>{view === "faq" ? "How this works" : "Questions"}</h2></div><button className="faq-close" onClick={() => setOpen(false)} aria-label="Close questions">×</button></div>{view === "faq" ? <><div className="faq-list">{faqs.map(([questionText, answerText], index) => <div className="faq-item" key={questionText}><button className="faq-question" onClick={() => setExpanded(expanded === index ? null : index)}><span>{questionText}</span>{expanded === index ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>{expanded === index ? <p className="faq-answer">{answerText}</p> : null}</div>)}</div><div className="faq-ask"><button className="faq-ask-trigger" onClick={() => { setView("thread"); setQuestion(""); }}>ASK SOMETHING ELSE <ArrowRight size={13} /></button></div></> : <div className="faq-thread"><button className="faq-back" onClick={() => setView("faq")}>← Back to questions</button><div className="faq-thread-history" aria-live="polite">{turns.length === 0 ? <div className="faq-empty-state"><p>Ask a question about the rehearsal process, schema safety, or how bisection works.</p><div className="faq-example-chips">{faqs.map(([questionText]) => <button className="faq-example-chip" key={questionText} onClick={() => setQuestion(questionText)}>{questionText}</button>)}</div></div> : turns.map((turn, index) => <div className="faq-turn" key={`${turn.question}-${index}`}><div className="faq-turn-question">{turn.question}</div><div className="faq-turn-answer"><MarkdownAnswer content={turn.answer} /></div></div>)}</div><div className="faq-input-row"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitQuestion(); }} placeholder="Ask about the rehearsal process, schema safety, bisection..." aria-label="Ask something else" /><button onClick={() => void submitQuestion()} disabled={loading}>Ask</button></div></div>}</aside>
	</>;
}
