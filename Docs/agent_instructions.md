# agent_instructions.md — Standing Instructions for the Building Agent

These rules apply across every phase in `implementation_plan.md`. Read this before starting, and re-check it before each phase.

## 1. Read order

Before writing code: `product.md` → `architecture.md` → `ui_ux.md` → `api_spec.md` → `scaffold.md` → `implementation_plan.md`. Do not start frontend work without having read `ui_ux.md` in full — it is the spec, not a suggestion.

## 2. Non-negotiables

- **The bisection result must be computed, never hardcoded.** If a demo needs a guaranteed regression, achieve it by choosing a migration/query pair that genuinely regresses (see `essentials.md` "seed scenario"), not by faking the bisector's output. A judge asking "how does this work?" must get a true answer.
- **Never leave the app in a broken end-to-end state overnight or between sessions.** Every commit should leave `implementation_plan.md`'s current phase checkpoint passable, even if narrower in scope.
- **Match `ui_ux.md` exactly on colors, type, and the pipeline animation.** These are the cheapest-to-get-right, most-visible-if-wrong details. Do not substitute default component-library styling "for now" — it reads as unfinished even mid-build.
- **No bare spinners.** Any wait state over ~500ms needs the live-log/pipeline pattern from `ui_ux.md` §4.3, or at minimum a labeled skeleton state — never a plain loading indicator with no context.
- **Every screen states its verdict in plain language before showing supporting detail** (per `ui_ux.md` §5). If you build a screen that leads with a chart or table before a stated conclusion, revise it.

## 3. When ambiguity comes up

If a spec doc doesn't cover a decision (e.g. exact corruption rate defaults, exact retry policy on shadow DB provisioning failure), make a reasonable choice, note the assumption in a code comment, and move on — do not block progress waiting for clarification on non-critical details. Do stop and flag clearly if the ambiguity affects one of the "Non-negotiables" above.

## 4. Code conventions

- **Backend:** Python 3.11+, FastAPI, Pydantic v2 models mirroring `api_spec.md` exactly (field names must match). Type-hint everything. Async endpoints for anything touching the shadow DB or GitHub API.
- **Frontend:** TypeScript, Next.js App Router, Tailwind using the token values from `ui_ux.md` §2.1 (define them as CSS variables in `styles/tokens.css`, reference via Tailwind config, not ad-hoc hex codes scattered in components).
- **Naming:** match the file/module names in `scaffold.md` exactly so the docs and the repo stay navigable together.
- **Tests:** at minimum, unit tests for `generator/corrupt.py` (does each profile actually produce the corruption it claims to) and `bisector/delta_debug.py` (does it converge to a known minimal condition on a synthetic fixture). These are the two components where a silent logic bug would be most damaging to credibility.

## 5. What to do if something can't be finished in time

Cut in this order (matches `implementation_plan.md` Phase 3 sequencing and `ui_ux.md` §8):
1. History screen — cut first, no loss to the core story.
2. Light mode / full keyboard-nav polish — never built for v1, not a cut, just not in scope.
3. Full GitHub OAuth (Phase 4) — fall back to the "use sample manifest" + a pre-connected demo repo path; state in the pitch that live OAuth is the next integration step.
4. MySQL support — was always a stretch goal, not core scope.
Never cut: the Live Rehearsal Run pipeline screen, the plain-language verdict banner, or the bisection trail visualization. These three carry the UX score and the "wow" moment respectively.

## 6. Tone in generated copy

Any UI copy the agent writes (button labels, empty states, error messages) should match `product.md`'s confident, plain-spoken register — e.g. "1 of 7 queries regressed," not "It looks like there might be a potential issue with one of your queries." Avoid hedging language throughout the product.
