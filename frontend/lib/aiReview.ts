import type { RehearsalResult } from "./api";

function planAccessPath(plan: string) {
	return plan.split(/\r?\n/).map((line) => line.trim()).find((line) => /(?:Index Scan|Seq Scan|Bitmap Heap Scan|Bitmap Index Scan|Sort)/.test(line)) ?? "Execution plan changed";
}

export function buildAiReview(result: RehearsalResult) {
	const regressions = result.queries.filter((query) => query.verdict === "regressed");
	const lead = regressions[0];
	if (!lead) {
		return {
			clean: true,
			title: "No measured query regression detected.",
			summary: `All ${result.queries.length} measured queries passed the rehearsal checks. The migration did not trigger a flagged plan change or latency regression in this demo workload.`,
			recommendation: "Keep the migration under review for production-scale data and workload patterns before release.",
			finding: null as null | { id: string; sql: string; before: string; after: string; factor: number },
		};
	}
	return {
		clean: false,
		title: `${regressions.length} measured ${regressions.length === 1 ? "query needs" : "queries need"} review.`,
		summary: `${lead.id} changed execution strategy during the rehearsal. The measured query plan is the primary evidence; small demo timings can vary and should be interpreted alongside that plan.`,
		recommendation: lead.sql.toLowerCase().includes("order by created_at") && /Index Scan/.test(lead.plan_before) && /Sort/.test(lead.plan_after)
			? "Preserve or replace the created_at access path before rollout, then rehearse the revised migration again."
			: "Review the changed query plan and migration together, then rerun the rehearsal after adjusting the index or schema change.",
		finding: {
			id: lead.id,
			sql: lead.sql,
			before: planAccessPath(lead.plan_before),
			after: planAccessPath(lead.plan_after),
			factor: lead.regression_factor,
		},
	};
}

export function demoProfileLabel(result: RehearsalResult) {
	if (result.demo_scenario === "safe") return "Demo database · Safe baseline";
	if (result.demo_scenario === "regression") return "Demo database · Intentional regression";
	return "Imported repository migration";
}
