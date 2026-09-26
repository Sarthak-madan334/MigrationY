# ui_ux.md — Design System & Screen Spec

**This is the highest-leverage document in this repo.** UX & Design is a full rubric category, and it is entirely within our control — unlike judge familiarity with the algorithm, a slow network, or a flaky external service. Every screen below is designed to look intentional, not templated. Read this fully before writing any frontend code, and match it exactly.

## 1. Design philosophy

Three words: **clinical, confident, cinematic.**

- **Clinical** — this is a tool that proves things with data, not a toy. Typography and layout borrow from lab-report / flight-instrument aesthetics: precise numbers, monospace where data is literal, generous whitespace, no decorative clutter.
- **Confident** — no hedging language in the UI. Verdicts are stated plainly ("REGRESSION DETECTED," not "there might be an issue").
- **Cinematic** — the rehearsal *is* the demo. The live-run screen is the centerpiece; it should feel like watching something happen, not like waiting for a spinner.

## 2. Visual identity

### 2.1 Color system

Dark-mode-first (reads better on a projector, and "lab instrument" aesthetics lean dark).

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0B0E14` | App background |
| `--bg-surface` | `#141821` | Cards, panels |
| `--bg-surface-raised` | `#1C2129` | Elevated cards (active step, modals) |
| `--border-subtle` | `#262C38` | Card borders, dividers |
| `--text-primary` | `#F2F4F8` | Headlines, primary data |
| `--text-secondary` | `#8A93A6` | Labels, captions |
| `--accent-signal` | `#00D9A3` | Pass / healthy / success state |
| `--accent-alert` | `#FF4D4D` | Regression / failure / the "red node" moment |
| `--accent-warn` | `#FFB020` | Marginal/borderline results |
| `--accent-focus` | `#5B8CFF` | Interactive elements, links, active states |
| `--mono-data` | `#00FFC2` | Monospace data readouts (latency numbers, query text) — slight glow, terminal feel |

Light mode is a v2 nice-to-have, not built for the demo. Note: `--accent-alert` red and `--accent-signal` green are also distinguished by icon + label, never by color alone.

### 2.2 Typography

| Role | Font | Notes |
|---|---|---|
| Display / headlines | **Space Grotesk** (Google Fonts) | Geometric, technical, slightly unusual without being gimmicky |
| Body / UI text | **Inter** | Neutral, highly legible at small sizes |
| Data / code / query text | **JetBrains Mono** | Anything that is literal data — latency numbers, SQL, condition strings — is always monospace. This is a deliberate signal: "this text is a fact, not copy." |

Scale: 12 / 14 / 16 / 20 / 28 / 40 / 56px. Headlines use tight letter-spacing (-0.02em); monospace data uses default tracking for legibility.

### 2.3 Iconography & motion language

- Icons: [Lucide](https://lucide.dev) exclusively — consistent stroke width (1.5px), no mixed icon sets.
- Motion: fast and purposeful, never decorative-for-its-own-sake. Standard easing `cubic-bezier(0.16, 1, 0.3, 1)` ("ease-out-expo" feel — snappy arrival, no bounce). Standard durations: 150ms micro-interactions, 400ms panel transitions, 800–1200ms for the "reveal" animations described below.
- One deliberate signature motion: the **pulse-to-verdict** animation (§4.3) — everything else stays restrained so this moment stands out.

## 3. Information architecture

```
/                → Landing (pitch, "Connect Repo" CTA)
/connect         → Repo connection + migration/query manifest selection
/run/:id         → Live Rehearsal Run (the centerpiece screen)
/run/:id/report  → Results Dashboard
/run/:id/cause   → Root-Cause Drill-down (deep link from a regressed query)
/history         → Past runs (list view)
```

Five real screens. No screen exists that isn't earning its place in the demo or the judged flow.

## 4. Screen-by-screen spec

### 4.1 Landing (`/`)

- Full-bleed dark hero. Headline in Space Grotesk 56px: **"Your migration passes on normal data."** — sub-line in `--accent-alert`, same size: **"We find the 2% that doesn't."**
- Beneath: one sentence of body copy (Inter, `--text-secondary`), then a single primary CTA button: **Connect a Repo**.
- Below the fold: a static 3-icon row (Generate → Rehearse → Prove) as the elevator-pitch visual, each icon + 4-word caption. No feature-bullet wall — restraint here reads as confidence.
- No navbar clutter: logo mark top-left, GitHub-star/repo link top-right, nothing else.

### 4.2 Connect (`/connect`)

- Step indicator across the top: `1 Connect Repo — 2 Select Migration — 3 Select Query Manifest`. Use a horizontal stepper with the completed step in `--accent-signal`, active step in `--accent-focus`, upcoming steps in `--text-secondary`.
- Repo connect: standard GitHub OAuth button, then a searchable repo list (card per repo: name, last commit, primary language badge).
- Migration select: once repo is connected, auto-detect files under common migration directories (`migrations/`, `db/migrate/`, `alembic/versions/`) and list them with a diff preview (added/changed lines, syntax-highlighted).
- Query manifest: either upload a small YAML/SQL file, or — for the demo — offer a **"Use sample query manifest"** one-click path so the flow never stalls on a missing artifact.
- Primary CTA at the bottom, right-aligned, disabled until all three steps are satisfied: **Run Rehearsal →**

### 4.3 Live Rehearsal Run (`/run/:id`) — THE CENTERPIECE SCREEN

This is the screen judges will remember. It must never look like a generic progress bar.

**Layout:** A vertical pipeline, rendered as a sequence of connected nodes (think: a subway-line diagram, not a percentage bar), one node per stage:

```
● Provisioning shadow DB
● Generating adversarial dataset   (12 corruption profiles applied)
● Applying migration
● Running query manifest           (7 of 7 queries)
● Analyzing results
```

- Each node transitions **idle (grey outline) → active (pulsing `--accent-focus` ring, animated) → complete (solid `--accent-signal` fill with a checkmark)** in strict left-to-right sequence. The active node's pulse is the one signature animation in the whole app — a soft radial glow expanding and fading on an 1100ms loop — everything else is restrained specifically so this reads as special.
- To the right of the pipeline, a **live terminal-style log panel** (JetBrains Mono, `--mono-data` text on `--bg-surface`) streams real backend events as they happen ("Seeded 500,000 rows into `orders`," "Running query 4/7: `SELECT ... WHERE status IS NULL`," "⚠ Query 4 latency: 38ms → 1,612ms"). This turns dead air into content — there is never a moment with nothing happening on screen.
- When a regression is detected mid-run, that query's log line flashes once in `--accent-alert` and a small badge appends to its pipeline node: `1 regression found`. The run keeps going — we don't interrupt the pipeline, we annotate it.
- On completion, the whole pipeline area cross-fades (400ms) into the Results Dashboard — no click required, no dead end.

### 4.4 Results Dashboard (`/run/:id/report`)

- Top banner, full-width, color-coded by outcome: if any regression exists, this banner is `--accent-alert` background at 12% opacity with a bold headline: **"1 of 7 queries regressed."** If clean: `--accent-signal` equivalent, **"All 7 queries passed rehearsal."**
- Below: a **query results table**, one row per query from the manifest:

  | Query | Before | After | Δ | Verdict |
  |---|---|---|---|---|
  | `SELECT * FROM orders WHERE status IS NULL` | `41ms` | `1,612ms` | **39.3×** | 🔴 Regressed |
  | `SELECT COUNT(*) FROM orders` | `12ms` | `13ms` | 1.1× | 🟢 Passed |

  Numbers are monospace, right-aligned, tabular-nums. The Δ column for any regression is set in `--accent-alert`, bold, larger type (20px vs 14px for the rest of the row) — this is the number a judge's eye should land on first.
- Each regressed row is clickable → expands inline (accordion, 300ms ease) to show a compact before/after `EXPLAIN` plan diff (index scan → sequential scan, rendered as two small tree diagrams side by side), plus a **"See exact cause →"** link into the drill-down screen.
- A persistent **"Export reproducible case"** button top-right on any regressed run — downloads a runnable script. This is a Feasibility/Impact signal as much as a UX one: the tool leaves you with an artifact, not just a screen.

### 4.5 Root-Cause Drill-down (`/run/:id/cause`) — THE "WOW" MOMENT

This is where "Innovation & Creativity" becomes visible, not just claimed.

- Headline stated as a plain-language finding, large (28px), not a chart title: **"2% of rows trigger this regression."** Directly below, in monospace on a dark code-style panel: the exact isolated condition, e.g. `legacy_format = TRUE AND created_at < '2019-03-01'`.
- Below that: a **bisection trail** — a compact horizontal sequence of shrinking bar segments (500,000 rows → 61,204 → 8,010 → 1,140 → 183), each labeled with its row count, animating in left-to-right on load (staggered 120ms per segment) to visually narrate "the agent searched, and converged." This is the single visual that proves automated investigation happened, rather than a human eyeballing a chart.
- Side-by-side query plan diff (full detail here, vs. the compact version on the dashboard): tree-structured `EXPLAIN` output, with the divergent node (the seq scan that should have been an index scan) highlighted in `--accent-alert` with a small "◀ divergence" label — deliberately visually similar to a Merkle-tree-style diff, since "one red node in a tree" is an unusually legible way to show "here is the one thing that's wrong."
- Footer action row: **Download minimal repro (183 rows, .sql)** / **Copy as GitHub PR comment** — the second option formats the finding as ready-to-paste Markdown, reinforcing that this is meant to plug into a real workflow, not just live in a dashboard.

### 4.6 History (`/history`)

- Simple table, not a priority screen for the demo but present for completeness: run timestamp, repo, migration file, verdict badge (🔴/🟢), link to report. Confirms the tool is a recurring practice, not a one-off script.

## 5. Interaction & feedback principles

- **Never show a bare spinner.** Every wait state has content (the pipeline + live log in §4.3 is the general pattern — apply it anywhere else a request takes >500ms).
- **State the verdict before the detail.** Every screen leads with the plain-language conclusion, then supports it with data — never the reverse.
- **Color never carries meaning alone.** Every red/green state is paired with an icon and a text label (accessibility + judged-on-a-bad-projector safety).
- **Numbers are always monospace and right-aligned** wherever they appear in a table, so magnitude comparisons are visually scannable at a glance.
- **One signature animation, used consistently** (the pulse-to-verdict in §4.3) — restraint elsewhere makes this one moment land harder instead of competing with a dozen lesser animations.

## 6. Responsive behavior

Primary target is a laptop screen shared to a projector (1440×900 typical). Build desktop-first; a graceful single-column collapse below 900px is sufficient — this product will not be judged on a phone.

## 7. Accessibility baseline

- Minimum contrast ratio 4.5:1 for all text against its background (verify `--text-secondary` on `--bg-surface` specifically — adjust opacity up if needed).
- All interactive elements reachable and operable via keyboard (tab order follows visual order).
- `--accent-alert` / `--accent-signal` distinction always backed by icon + label, per §5.

## 8. What "10/10 UX" means for this build, concretely

If time runs short, protect these four things above everything else, in this order:
1. The Live Rehearsal Run pipeline animation (§4.3) — this is the single highest-leverage screen.
2. The plain-language verdict banner + Δ column on the Results Dashboard (§4.4).
3. The bisection trail visualization on the drill-down (§4.5).
4. Consistent color/type tokens from §2 applied everywhere (cheap to do, very visible if skipped — mismatched fonts/colors read as "unfinished" faster than almost anything else).

Everything else in this document (History screen, light mode, full keyboard nav polish) is safe to cut under time pressure without damaging the score in this category.
