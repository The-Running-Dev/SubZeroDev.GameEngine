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
 * `HousingDefinition`, `EventDefinition`, `AchievementDefinition`, …) that this unit
 * deliberately doesn't wire — the "Stable Life" vertical slice (`plans/36`'s W39) needs
 * only enough real logic to prove a goal can be won and lost, not full mechanical depth;
 * each unwired system is an explicit, documented stub rather than silently doing nothing.
 * `needs` (drift), `opportunities` (expiry only), and now `goals`/`failure` are real logic.
 * Every system emits `kind.simulation.system.ran` at `trace` (§11), the same
 * ordering-verification technique `startOfWeek.ts` uses. `goals`/`failure` additionally
 * emit `goal.achieved`/`goal.failed` (§11, `info`) per goal transitioning this week —
 * `week.ended` itself is `advance.ts`'s own emit, once, after this whole pipeline returns.
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { NeedKey } from "./actor.js";
import type { GoalDefinition, GoalFailurePrecedence } from "./content.js";
import { evaluateSimulationCondition } from "./conditions.js";
import type { GoalState, SimulationKindState } from "./state.js";

const SYSTEM_NAME = "kind.simulation.system.ran";
const GOAL_ACHIEVED_EVENT = "kind.simulation.goal.achieved";
const GOAL_FAILED_EVENT = "kind.simulation.goal.failed";

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

function goalDef(goalDefs: readonly GoalDefinition[], id: string): GoalDefinition | undefined {
  return goalDefs.find((def) => def.id === id);
}

/**
 * Real logic. Evaluates each active `GoalState`'s `GoalDefinition.conditions` (§7.8) —
 * persistent per §2.4: `consecutiveWeeksSatisfied` increments on a satisfied week and
 * resets to zero the moment it isn't (no partial credit), `status` becomes `"completed"`
 * once that counter reaches `requiredDurationWeeks` (default 1 — satisfied once is enough
 * unless a goal says otherwise).
 *
 * **Precedence with `failure` lives here, not there.** The end-of-week order fixes `goals`
 * before `failure` (§3) — that fixed order is what makes `goalFailurePrecedence` (upstream
 * §12.3) a completion-side decision: `"goals_win"` (default) completes a goal this week
 * even if its failure condition also tripped, leaving nothing for `failure` to catch;
 * `"failure_wins"` defers instead, so the still-active goal falls through to `failure`
 * below. Neither mode needs the systems to run in a different order.
 */
function goals(
  state: SimulationKindState,
  goalDefs: readonly GoalDefinition[],
  precedence: GoalFailurePrecedence,
  emit: ResolutionEmitter,
): SimulationKindState {
  const nextGoals: GoalState[] = state.goals.map((goal) => {
    if (goal.status !== "active") return goal;
    const def = goalDef(goalDefs, goal.definitionId);
    if (!def) return goal;

    const met = evaluateSimulationCondition(def.conditions, state);
    if (!met) return { ...goal, satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0 };

    const failed = def.failureConditions !== undefined
      && evaluateSimulationCondition(def.failureConditions, state);
    if (failed && precedence === "failure_wins") {
      return { ...goal, satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0 };
    }

    const consecutiveWeeksSatisfied = goal.consecutiveWeeksSatisfied + 1;
    const firstSatisfiedWeek = goal.firstSatisfiedWeek ?? state.calendar.currentWeek;
    const required = def.requiredDurationWeeks ?? 1;

    if (consecutiveWeeksSatisfied >= required) {
      emit.emit(GOAL_ACHIEVED_EVENT, "info", { data: { goalId: goal.definitionId } });
      return {
        ...goal,
        status: "completed",
        satisfiedThisWeek: true,
        consecutiveWeeksSatisfied,
        firstSatisfiedWeek,
        completedWeek: state.calendar.currentWeek,
      };
    }
    return { ...goal, satisfiedThisWeek: true, consecutiveWeeksSatisfied, firstSatisfiedWeek };
  });

  return { ...state, goals: nextGoals };
}

/**
 * Real logic. Catches whatever `goals` (above) left `"active"` with a tripped
 * `failureConditions` — under `"goals_win"` (default), that's any goal that failed without
 * also completing; under `"failure_wins"`, it's a goal `goals` deliberately deferred
 * because both conditions tripped the same week.
 */
function failure(state: SimulationKindState, goalDefs: readonly GoalDefinition[], emit: ResolutionEmitter): SimulationKindState {
  const nextGoals: GoalState[] = state.goals.map((goal) => {
    if (goal.status !== "active") return goal;
    const def = goalDef(goalDefs, goal.definitionId);
    if (!def?.failureConditions) return goal;

    const failed = evaluateSimulationCondition(def.failureConditions, state);
    if (!failed) return goal;

    emit.emit(GOAL_FAILED_EVENT, "info", { data: { goalId: goal.definitionId } });
    return { ...goal, status: "failed", failedWeek: state.calendar.currentWeek };
  });

  return { ...state, goals: nextGoals };
}

/** **Stub.** Needs `AchievementDefinition.condition`. */
function achievements(state: SimulationKindState): SimulationKindState {
  return state;
}

export function runEndOfWeek(
  state: SimulationKindState,
  emit: ResolutionEmitter,
  goalDefs: readonly GoalDefinition[],
  goalFailurePrecedence: GoalFailurePrecedence,
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

  next = goals(next, goalDefs, goalFailurePrecedence, emit);
  ranSystem(emit, "goals");

  next = failure(next, goalDefs, emit);
  ranSystem(emit, "failure");

  next = achievements(next);
  ranSystem(emit, "achievements");

  return { state: next, changes: needsResult.changes };
}
