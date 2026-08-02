/**
 * Simulation kind — the end-of-week systems (10-simulation-kind.md §3, upstream §12.2).
 *
 * Contract: `10-simulation-kind.md` §3.
 *
 * Fourteen systems, in the normative order the contract fixes:
 * `employment, education, finance_income, inventory, housing, finance_reconcile, needs,
 * relationships, opportunities, events, headline, goals, failure, achievements`.
 * `history` is deliberately absent, not stubbed — it is not adopted state (§2), so there
 * is nothing for a system to mutate; skipping it entirely is the correct behavior, not a
 * missing one.
 *
 * Most systems here need content types (`JobDefinition`, `CourseDefinition`,
 * `HousingDefinition`, `EventDefinition`, `GoalDefinition`, `AchievementDefinition`, …)
 * that don't exist until the content-definition-types build unit — each is an explicit,
 * documented stub rather than silently doing nothing. `needs` (drift) and `opportunities`
 * (expiry only) are real logic: both are mechanics this contract already fully specifies
 * without needing a single content type. Every system emits `kind.simulation.system.ran`
 * at `trace` (§11), the same ordering-verification technique `startOfWeek.ts` uses.
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { NeedKey } from "./actor.js";
import type { SimulationKindState } from "./state.js";

const SYSTEM_NAME = "kind.simulation.system.ran";

function ranSystem(emit: ResolutionEmitter, system: string): void {
  emit.emit(SYSTEM_NAME, "trace", { data: { system, phase: "end_of_week" } });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Weekly need drift, real logic against provisional rates — `TODO.md`'s *Known Open
 * Items* already tracks these as needing a balancing pass once the sim harness runs;
 * the mechanism (drift, then clamp once, emitting one `StateChange` per touched need) is
 * genuine, only the numbers are placeholder.
 */
const DRIFT_PER_WEEK: Readonly<Record<NeedKey, number>> = {
  health: -1,
  energy: -3,
  happiness: -2,
  satiety: -4,
  stress: 2,
};

function needs(state: SimulationKindState): { state: SimulationKindState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  const nextNeeds = { ...state.player.needs };

  for (const key of (Object.keys(DRIFT_PER_WEEK) as NeedKey[]).sort()) {
    const before = state.player.needs[key];
    const after = clamp(before + DRIFT_PER_WEEK[key], 0, 100);
    if (after === before) continue;
    nextNeeds[key] = after;
    changes.push({
      path: `player.needs.${key}`,
      op: "set",
      value: after,
      previous: before,
      reason: "need_drift",
      visible: true,
    });
  }

  return {
    state: { ...state, player: { ...state.player, needs: nextNeeds } },
    changes,
  };
}

/**
 * Expiry only, real logic — `expiresAtWeek` past the current week is a pure check against
 * already-built state. Revoke (needs job-position tracking) and offer (needs
 * `OpportunityDefinition`) are stubbed; see §2.3's own lifecycle ordering — revoke and
 * expire both run before offer upstream, but with offer stubbed there is nothing after
 * expire to sequence against yet.
 */
function opportunities(state: SimulationKindState): SimulationKindState {
  const activeOpportunities = state.activeOpportunities.filter(
    (o) => o.expiresAtWeek > state.calendar.currentWeek,
  );
  return { ...state, activeOpportunities };
}

/** **Stub.** Needs `JobDefinition`/`Employment.performance` rules against real job content. */
function employment(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Needs `CourseDefinition`. */
function education(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Wages/scheduled expenses need `JobDefinition`/`CourseDefinition`. */
function financeIncome(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Maintenance rules need `ItemDefinition`. */
function inventory(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Rent levied needs `HousingDefinition.weeklyCostCents`. */
function housing(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Late fees/eviction advancement need `housing`'s own rent charge above. */
function financeReconcile(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** No relationship-decay rule is specified anywhere in this contract yet. */
function relationships(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Firing scheduled/random events needs `EventDefinition`/`EventOutcome`. */
function events(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Needs `HeadlineDefinition`. */
function headline(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Evaluating `GoalState.satisfiedThisWeek` needs `GoalDefinition.conditions`. */
function goals(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Needs `GoalDefinition.failureConditions`. */
function failure(state: SimulationKindState): SimulationKindState {
  return state;
}

/** **Stub.** Needs `AchievementDefinition.condition`. */
function achievements(state: SimulationKindState): SimulationKindState {
  return state;
}

export function runEndOfWeek(
  state: SimulationKindState,
  emit: ResolutionEmitter,
): { state: SimulationKindState; changes: StateChange[] } {
  let next = employment(state);
  ranSystem(emit, "employment");

  next = education(next);
  ranSystem(emit, "education");

  next = financeIncome(next);
  ranSystem(emit, "finance_income");

  next = inventory(next);
  ranSystem(emit, "inventory");

  next = housing(next);
  ranSystem(emit, "housing");

  next = financeReconcile(next);
  ranSystem(emit, "finance_reconcile");

  const needsResult = needs(next);
  next = needsResult.state;
  ranSystem(emit, "needs");

  next = relationships(next);
  ranSystem(emit, "relationships");

  next = opportunities(next);
  ranSystem(emit, "opportunities");

  next = events(next);
  ranSystem(emit, "events");

  next = headline(next);
  ranSystem(emit, "headline");

  next = goals(next);
  ranSystem(emit, "goals");

  next = failure(next);
  ranSystem(emit, "failure");

  next = achievements(next);
  ranSystem(emit, "achievements");

  return { state: next, changes: needsResult.changes };
}
