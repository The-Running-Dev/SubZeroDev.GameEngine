/**
 * Simulation kind — the start-of-week systems (10-simulation-kind.md §3, upstream §12.1).
 *
 * Contract: `10-simulation-kind.md` §3.
 *
 * Four systems, in the normative order the contract fixes: `time_advance`, `effects`,
 * `time_commit`, `events`. Two are real logic (pure calendar/effect mechanics, needing no
 * campaign content); two are explicit stubs, documented at each site rather than silently
 * doing nothing — `time_commit` needs `JobDefinition`/`CourseDefinition` schedules that
 * don't exist until the content-definition-types build unit, and `events`' "present
 * responses deferred from last week" needs no state mutation at all: `PendingEventResponse`
 * already carries the `presentWeek` a client reads to know one is due.
 *
 * Each system emits `kind.simulation.system.ran` at `trace` (§11) — this is what makes
 * ordering independently verifiable even while most systems are stubs: the two-phase time
 * split is "the kind of rule the determinism harness cannot catch and the replay oracle
 * can" (§3's own callout), and a stream naming each system in order localizes a regression
 * to the phase that moved.
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { SimulationKindState } from "./state.js";

const SYSTEM_NAME = "kind.simulation.system.ran";

function ranSystem(emit: ResolutionEmitter, system: string): void {
  emit.emit(SYSTEM_NAME, "trace", { data: { system, phase: "start_of_week" } });
}

/** Increment the week, reset `spentTimeUnits`. Must run *before* `effects` — `expiresAtWeek`
 *  is compared against the new week number (§3). */
function timeAdvance(state: SimulationKindState): SimulationKindState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      currentWeek: state.calendar.currentWeek + 1,
      spentTimeUnits: 0,
    },
  };
}

/** Expire `activeEffects` whose `expiresAtWeek` is at or before the new week — an effect
 *  expiring in week 12 still applied throughout week 12; removal happens at the start of
 *  week 13 (§6.1). Permanent effects (`expiresAtWeek` absent) are never removed here. */
function effects(state: SimulationKindState): SimulationKindState {
  const activeEffects = state.activeEffects.filter(
    (effect) => effect.expiresAtWeek === undefined || effect.expiresAtWeek > state.calendar.currentWeek,
  );
  return { ...state, activeEffects };
}

/**
 * **Stub.** Recomputing `committedTimeUnits` from job and course commitments needs
 * `JobDefinition.schedule.weeklyTimeCost`/`CourseDefinition.weeklyTimeCost` — content
 * types this unit doesn't have. Returns `calendar` unchanged; a future unit replaces this
 * once those types exist, matching this contract's own "pipeline now, per-system logic
 * once content exists" split.
 */
function timeCommit(state: SimulationKindState): SimulationKindState {
  return state;
}

/**
 * **Stub in name only — genuinely nothing to do.** "Presenting" a deferred
 * `PendingEventResponse` is a client/projection concern (§2.3: it already carries
 * `presentWeek`, the week a client knows to surface it); no state changes hands here.
 */
function events(state: SimulationKindState): SimulationKindState {
  return state;
}

export function runStartOfWeek(state: SimulationKindState, emit: ResolutionEmitter): SimulationKindState {
  let next = timeAdvance(state);
  ranSystem(emit, "time_advance");

  next = effects(next);
  ranSystem(emit, "effects");

  next = timeCommit(next);
  ranSystem(emit, "time_commit");

  next = events(next);
  ranSystem(emit, "events");

  return next;
}
