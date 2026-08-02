/**
 * Simulation kind — `Kind.outcome` (10-simulation-kind.md §12, Terminal Identity).
 *
 * Contract: `10-simulation-kind.md` §12.
 *
 * Reads `state.goals` alone, per the contract's own signature (`outcome(state)` — no
 * `ctx`, no campaign). `resolution` is `null` while any goal is still `"active"`.
 *
 * **`week_limit_reached` is never returned here.** §12's own callout says its precedence
 * against the other two resolutions is "genuinely open... unresolved in the upstream
 * source," and separately, `state` alone carries no `weekLimit` to compare against
 * (that lives on `ScenarioDefinition`, content this function never sees) — so returning
 * it would mean inventing both the value and the precedence. Deferred, not forgotten.
 *
 * **Mixed outcomes across multiple goals are resolved conservatively, not per any settled
 * rule.** §12 documents that `goalFailurePrecedence` can produce `"goals_met"` even while
 * some goal failed, but doesn't say when an *overall* multi-goal scenario counts as won
 * given a mix of completed and failed goals — that call belongs to whatever scenario
 * content (W40) first actually needs it answered. Until then: any failed goal makes the
 * whole resolution `"failed"`. This is verified only against this unit's own single-goal
 * tests; a real multi-goal scenario may need this revisited.
 */

import type { SimulationKindState } from "./state.js";

export interface SimulationOutcome {
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;
  goalsMet: readonly string[];
  goalsFailed: readonly string[];
}

export function outcome(state: SimulationKindState): SimulationOutcome {
  const goalsMet = state.goals
    .filter((goal) => goal.status === "completed")
    .map((goal) => goal.definitionId)
    .sort();
  const goalsFailed = state.goals
    .filter((goal) => goal.status === "failed")
    .map((goal) => goal.definitionId)
    .sort();

  const stillActive = state.goals.some((goal) => goal.status === "active");
  if (state.goals.length === 0 || stillActive) {
    return { resolution: null, goalsMet, goalsFailed };
  }

  return { resolution: goalsFailed.length > 0 ? "failed" : "goals_met", goalsMet, goalsFailed };
}
