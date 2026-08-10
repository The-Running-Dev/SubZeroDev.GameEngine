/**
 * Simulation kind — `Kind.outcome` (10-simulation-kind.md §12, Terminal Identity).
 *
 * Contract: `10-simulation-kind.md` §12.
 *
 * **Reads `state.resolution` back; it never computes one.** It cannot: `Kind.outcome(state)`
 * (04 §3) receives no campaign, so `ScenarioDefinition.weekLimit` (§7.8) is unreachable from
 * here, and a resolution reconstructed from `goals` after the fact could disagree with the
 * one `end_week` actually decided. §3's `goals`/`failure` and `week_limit` systems
 * (`endOfWeek.ts`) write `SimulationKindState.resolution` once, while campaign data is still
 * in scope; this function is a projection of that record and nothing more — the same shape
 * `12-world-graph-kind.md` §8 established for the identical seam problem.
 *
 * **Precedence, per §12 (W57).** `goals`/`failure` always win: `week_limit_reached` is
 * reported only for a week that resolved neither. A week that both exhausts `weekLimit` and
 * lands every goal reports `goals_met`; a week that both fails and exhausts it reports
 * `failed`, the more specific fact. The ordering lives in `END_WEEK_SYSTEM_ORDER`, not here —
 * `week_limit` runs after `failure` and writes only into a still-`null` `resolution`.
 *
 * **Mixed outcomes across multiple goals stay conservative, unchanged from W40.** §12
 * documents that `goalFailurePrecedence` can produce `"goals_met"` even while some goal
 * failed, but doesn't say when an *overall* multi-goal scenario counts as won given a mix.
 * Until a real multi-goal scenario needs it answered: any failed goal makes the whole
 * resolution `"failed"`. That rule lives in `endOfWeek.ts`'s `failure` system, where the
 * decision is actually taken.
 */

import type { SimulationKindState } from "./state.js";

export interface SimulationOutcome {
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;
  goalsMet: readonly string[];
  goalsFailed: readonly string[];
}

export function outcome(state: SimulationKindState): SimulationOutcome {
  const terminal = state.resolution;
  return {
    resolution: terminal?.resolution ?? null,
    goalsMet: terminal?.goalsMet ?? [],
    goalsFailed: terminal?.goalsFailed ?? [],
  };
}
