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
 * to the phase that moved. `effects` additionally emits `effect.expired` (§11) per expired
 * effect — expiry's only observability signal, since §6.1 says expiry itself produces no
 * `StateChange`. `week.started` (§11, `info`) is emitted once, after all four systems run —
 * "after start-of-week systems" is what §11's own table says.
 *
 * `time_commit` was real logic as of W51 for the effects-layering mechanism alone: no
 * `JobDefinition`/`CourseDefinition` was wired yet, so the base commitment it recomputed was
 * always 0. **W54 wires the course half** — the base commitment is now the sum of every
 * *active* `CourseEnrollment`'s `CourseDefinition.weeklyTimeCost`, looked up from the
 * `courses` list threaded in from `advance.ts` (the same plain-parameter shape
 * `endOfWeek.ts`'s `jobs` already uses). The job half stays unwired — §3's own "job and
 * course commitments" is still only half true, a gap `10-simulation-kind.md`'s own §15
 * ledger already tracks, not one this unit closes. An `activeEffect`'s `Modifier` targeting
 * `calendar.committedTimeUnits` still layers over that base the same way `derived.ts` layers
 * every other modifier (`modifiers.ts`), clamped to the calendar invariant (§2.1).
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { CourseDefinition } from "./content.js";
import { SIMULATION_EVENTS } from "./events.js";
import type { SimulationKindState } from "./state.js";
import { collectModifiers, combineModifiers } from "./modifiers.js";

function ranSystem(emit: ResolutionEmitter, system: string): void {
  emit.emit(SIMULATION_EVENTS.systemRan.name, SIMULATION_EVENTS.systemRan.severity, { data: { system, phase: "start_of_week" } });
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

/** Expire `activeEffects` whose `expiresAtWeek` is strictly before the new week — an effect
 *  expiring in week 12 still applies throughout week 12 (kept while the new week is still
 *  12), and is only removed once the new week moves past it, at the start of week 13
 *  (§6.1). Permanent effects (`expiresAtWeek` absent) are never removed here. Emits
 *  `effect.expired` (§11) per expired effect — the only per-item signal this expiry gets;
 *  §6.1 is explicit that expiry itself "has nothing to undo" so it produces no
 *  `StateChange`. */
function effects(state: SimulationKindState, emit: ResolutionEmitter): SimulationKindState {
  const activeEffects: typeof state.activeEffects = [];
  for (const effect of state.activeEffects) {
    if (effect.expiresAtWeek !== undefined && effect.expiresAtWeek < state.calendar.currentWeek) {
      emit.emit(SIMULATION_EVENTS.effectExpired.name, SIMULATION_EVENTS.effectExpired.severity, { data: { effectId: effect.id } });
      continue;
    }
    activeEffects.push(effect);
  }
  return { ...state, activeEffects };
}

const COMMITTED_TIME_PATH = "calendar.committedTimeUnits";

/**
 * Recomputes `committedTimeUnits` from course commitments (§3) — the job half of "job and
 * course commitments" stays unwired (this file's own header). The base commitment is the sum
 * of `CourseDefinition.weeklyTimeCost` for every *active* `CourseEnrollment`; an enrollment
 * whose course no longer resolves against `courses` contributes nothing, the same silent-drop
 * `endOfWeek.ts`'s `advanceEmployment` uses for a missing `JobDefinition`. A `StatusEffect`
 * targeting `calendar.committedTimeUnits` still changes the recomputed value, layered per
 * §6.1's order and clamped to the calendar invariant (§2.1: `0 ≤ committedTimeUnits +
 * spentTimeUnits ≤ totalTimeUnits`) — `spentTimeUnits` is already 0 here, reset by
 * `timeAdvance` above.
 */
function timeCommit(state: SimulationKindState, courses: readonly CourseDefinition[]): SimulationKindState {
  const baseCommitment = state.player.education.enrollments
    .filter((e) => e.status === "active")
    .reduce((sum, e) => sum + (courses.find((c) => c.id === e.courseId)?.weeklyTimeCost ?? 0), 0);
  const modifiers = collectModifiers(state.activeEffects, COMMITTED_TIME_PATH);
  const combined = combineModifiers(baseCommitment, modifiers);
  const committedTimeUnits = Math.min(
    Math.max(0, combined),
    state.calendar.totalTimeUnits - state.calendar.spentTimeUnits,
  );
  return { ...state, calendar: { ...state.calendar, committedTimeUnits } };
}

/**
 * **Stub in name only — genuinely nothing to do.** "Presenting" a deferred
 * `PendingEventResponse` is a client/projection concern (§2.3: it already carries
 * `presentWeek`, the week a client knows to surface it); no state changes hands here.
 */
function events(state: SimulationKindState): SimulationKindState {
  return state;
}

export function runStartOfWeek(
  state: SimulationKindState,
  emit: ResolutionEmitter,
  courses: readonly CourseDefinition[] = [],
): SimulationKindState {
  let next = timeAdvance(state);
  ranSystem(emit, "time_advance");

  next = effects(next, emit);
  ranSystem(emit, "effects");

  next = timeCommit(next, courses);
  ranSystem(emit, "time_commit");

  next = events(next);
  ranSystem(emit, "events");

  emit.emit(SIMULATION_EVENTS.weekStarted.name, SIMULATION_EVENTS.weekStarted.severity, { data: { week: next.calendar.currentWeek } });

  return next;
}
