# Migration Rehearsal Agent

> Your migration passes on normal data. We find the 2% of rows that make it 40x slower — before your users do.

This repo's `.md` files are the full spec for building **Migration Rehearsal Agent** with an AI coding agent (Claude Code, Cursor, etc.) or a human team. Read them in this order:

| # | File | What it's for |
|---|------|----------------|
| 1 | [`product.md`](./product.md) | What we're building and why. Problem, users, value prop, demo narrative. |
| 2 | [`architecture.md`](./architecture.md) | System design, components, data flow, tech stack. |
| 3 | [`ui_ux.md`](./ui_ux.md) | Full visual design system and screen-by-screen UX spec. This is the highest-leverage doc for the demo — read it fully before writing any frontend code. |
| 4 | [`api_spec.md`](./api_spec.md) | REST API contract between frontend and backend. |
| 5 | [`scaffold.md`](./scaffold.md) | Exact folder/file structure to generate. |
| 6 | [`implementation_plan.md`](./implementation_plan.md) | Phased build plan with checkpoints and a "demo-safe at every stage" rule. |
| 7 | [`agent_instructions.md`](./agent_instructions.md) | Direct instructions for the AI coding agent doing the building — conventions, guardrails, definition of done. |
| 8 | [`essentials.md`](./essentials.md) | One-page cheat sheet: setup, env vars, commands, common pitfalls. |

## One-line pitch

Connect a repo → point at a migration → the agent spins up a shadow database, floods it with realistic-but-nasty data (nulls, duplicates, skew, old formats, huge tables), runs your migration and your real application queries against it, and if anything breaks or slows down catastrophically, it **automatically narrows down the exact rows/condition responsible** and hands you a reproducible case — before you ever run it in production.

## Why this doc set exists

These files are written so an AI coding agent can build the product with minimal back-and-forth: `product.md` gives intent, `architecture.md` and `scaffold.md` give shape, `ui_ux.md` gives the exact visual bar to hit, `api_spec.md` gives the contract, `implementation_plan.md` sequences the work, and `agent_instructions.md` is the standing operating rules that apply across all of it.
