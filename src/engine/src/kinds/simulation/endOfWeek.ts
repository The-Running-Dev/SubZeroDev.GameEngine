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
 * Most systems here need content types (`CourseDefinition`, `HousingDefinition`'s full
 * lifecycle, `EventDefinition`, `AchievementDefinition`, …) that this unit deliberately
 * doesn't wire — the "Stable Life" vertical slice (`plans/36`'s W39) needs only enough
 * real logic to prove a goal can be won and lost, not full mechanical depth; each unwired
 * system is an explicit, documented stub rather than silently doing nothing.
 * `needs` (drift), `opportunities` (expiry only), `goals`/`failure`, `employment`/
 * `finance_income`/`housing` (W53), `education` (W54), `finance_reconcile` (W55), and now
 * `inventory` (W56)
 * are real logic. Every system emits
 * `kind.simulation.system.ran` at `trace` (§11), the same ordering-verification technique
 * `startOfWeek.ts` uses. `goals`/`failure` additionally emit `goal.achieved`/`goal.failed`
 * (§11, `info`) per goal transitioning this week — `week.ended` itself is `advance.ts`'s
 * own emit, once, after this whole pipeline returns.
 *
 * **`employment`/`finance_income`/`housing` (W53).** `employment` does two jobs: it
 * resolves `CareerState.pendingApplications` whose `resolvesWeek` has arrived into a real
 * `Employment` (§7.2's own reasoning for why hiring lives here and not in
 * `resolvers.ts`'s `apply_for_job`), and it advances any existing `Employment.performance`
 * — toward `JobPerformanceRules.weeklyDriftToward` absent work this week, or up by a fixed
 * bonus if `player.flags.workedThisWeek` — then checks each uncontested `PromotionPath`
 * (contested promotion competition is out of scope here, §5.1's own `Requirement`
 * evaluation reused via `evaluateSimulationCondition`). `finance_income` pays
 * `Employment.weeklyPayCents` (plus overtime, from `player.flags.workedOvertimeThisWeek`)
 * into `cashCents` — real logic, but still a stub for wages, scheduled expenses, or courses
 * this unit doesn't wire. `housing` levies `HousingState.weeklyCostCents` against that same
 * `cashCents`, real enough to prove §3's own ordering claim: "`finance_income` ... must run
 * *before* `housing`, so rent is payable from this week's own wages." Both read
 * `jobs: readonly JobDefinition[]`, threaded in from `advance.ts`'s own `content.jobs` —
 * the same parameter shape `goalDefs` already uses.
 *
 * **`finance_reconcile` (W55).** `housing` (above) charges the full rent unconditionally —
 * `cashCents` may go negative, proving §3's ordering claim by an actual overdraw — but
 * returns `missedCents`, computed from this week's own charge alone (never read back off a
 * balance that may already carry prior weeks' unresolved debt), which this system alone
 * consumes. A nonzero `missedCents` levies a placeholder 10% late fee on top
 * of it into `HousingState.overdueRentCents`, increments `missedPayments`, and advances
 * `evictionStage` by exactly one rung on a fixed ladder (`none → warning → penalty →
 * formal_notice → hearing_scheduled → evicted`) — never more than one, regardless of how
 * large the shortfall. A week `housing` fully collected is a no-op here: arrears already on
 * the books are untouched, since this system only ever escalates. The only cure is
 * `resolvers.ts`'s `pay_bills`, which clears `overdueRentCents`/`missedPayments` and resets
 * `evictionStage` to `"none"` — a player action, not an end-of-week system, the same split
 * `financeIncome`/`housing` already draw between "happens regardless" and "something the
 * player did."
 *
 * **`education` (W54).** Advances every *active* `CourseEnrollment` by one week: `weeksCompleted`
 * always increments, `attendedUnits`/`missedSessions` split on whether `resolvers.ts`'s
 * `attend_class` set `player.flags.attendedClass:<courseId>` this week (cleared here once
 * read, the same clear-after-both-consumers-have-seen-it discipline `financeIncome` already
 * uses for the two work flags). Once `weeksCompleted` reaches `CourseDefinition.durationWeeks`,
 * `CourseFailureRules` decides pass or fail — attendance ratio, missed-session count, total
 * `studyUnits` against `minimumStudyUnitsPerWeek × durationWeeks`, and (if set) a stress cap.
 * A pass applies the course's `"skill"`-type `Reward`s (raising `player.skills.<id>` to at
 * least the reward's value — never lowering an already-higher skill) and, if
 * `awardsCredential` is set, appends a `Credential`; a fail sets `retainedProgress` from
 * `CourseFailureRules.progressRetainedOnFailure`. Either way the enrollment's own `status`
 * flips and it stays in `enrollments` as history — unlike a filled `JobOpening`, nothing here
 * removes it. Threaded `courses: readonly CourseDefinition[]` the same plain-parameter way
 * `jobs` already is.
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { Credential, CourseEnrollment, Employment, EvictionStage, NeedKey } from "./actor.js";
import type { CourseDefinition, GoalDefinition, GoalFailurePrecedence, ItemDefinition, JobDefinition } from "./content.js";
import { evaluateSimulationCondition } from "./conditions.js";
import { governingMaintenanceRule } from "./resolvers.js";
import type { Cents, GoalState, SimulationKindState, StatusEffect } from "./state.js";

const SYSTEM_NAME = "kind.simulation.system.ran";
const GOAL_ACHIEVED_EVENT = "kind.simulation.goal.achieved";
const GOAL_FAILED_EVENT = "kind.simulation.goal.failed";
const APPLICATION_LOST_EVENT = "kind.simulation.employment.application_lost";

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
 * genuine, only the numbers are placeholder. Drifts the *base* value (§6.1) — `derived.ts`
 * layers any active `player.needs.*` modifier over this on read, so drift and modifiers
 * never fight over the same stored number.
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

const PERFORMANCE_WORK_BONUS = 8;
/** Fraction of the gap to `weeklyDriftToward` closed each week absent work — placeholder,
 *  same caveat as `DRIFT_PER_WEEK`. */
const PERFORMANCE_DRIFT_RATE = 0.2;

function findJob(jobs: readonly JobDefinition[], jobId: string): JobDefinition | undefined {
  return jobs.find((j) => j.id === jobId);
}

/** Resolves every `pendingApplications` entry whose `resolvesWeek` has arrived. Hires into
 *  `currentEmployment` if the player isn't already employed; otherwise the application is
 *  simply dropped (this kind has no concept of holding two jobs, and no "decline offer"
 *  action exists yet for the player to have refused it explicitly). At most one hire per
 *  week — this kind's own single-actor scope, not a contested-position race (§7.10's own
 *  "rivals are a real, still-open gap"). Removes the filled `JobOpening` so a second
 *  `apply_for_job` against the same posting fails `requirement_unmet` (no open posting to
 *  find), not because anything here tracks `positionsAvailable` down to zero. An application
 *  whose `jobId` no longer resolves against `jobs` (content removed or renamed) is dropped
 *  the same way, but emits `employment.application_lost` first — the only trace of it
 *  otherwise. */
function resolveApplications(
  state: SimulationKindState,
  jobs: readonly JobDefinition[],
  emit: ResolutionEmitter,
): SimulationKindState {
  const week = state.calendar.currentWeek;
  const alreadyEmployed = state.player.career.currentEmployment !== undefined;

  const remaining: typeof state.player.career.pendingApplications = [];
  let hired: Employment | undefined;
  let filledJobId: string | undefined;

  for (const application of state.player.career.pendingApplications) {
    if (application.resolvesWeek > week) {
      remaining.push(application);
      continue;
    }
    if (alreadyEmployed || hired) continue;
    const job = findJob(jobs, application.jobId);
    if (!job) {
      emit.emit(APPLICATION_LOST_EVENT, "warn", { data: { jobId: application.jobId } });
      continue;
    }
    hired = {
      jobId: job.id,
      employerId: job.employerId,
      startedWeek: week,
      performance: 50,
      attendanceRatio: 100,
      warnings: 0,
      weeklyPayCents: job.compensation.baseWeeklyPayCents,
      weeksAtCurrentPay: 0,
    };
    filledJobId = job.id;
  }

  if (!hired && remaining.length === state.player.career.pendingApplications.length) return state;

  return {
    ...state,
    player: {
      ...state.player,
      career: {
        ...state.player.career,
        pendingApplications: remaining,
        ...(hired ? { currentEmployment: hired } : {}),
      },
    },
    world: filledJobId === undefined
      ? state.world
      : { ...state.world, jobMarket: { openings: state.world.jobMarket.openings.filter((o) => o.jobId !== filledJobId) } },
  };
}

/** Advances `Employment.performance` toward `weeklyDriftToward` absent work this week, or up
 *  by a fixed bonus if the player worked. Checks every uncontested `PromotionPath` in listed
 *  order and takes the first one whose `minimumWeeksInRole`, `minimumPerformance` and
 *  `requirements` are all satisfied — `minimumWeeksInRole` measures tenure *in the role*, so
 *  a promotion resets `startedWeek` to the promotion week along with `weeksAtCurrentPay`;
 *  otherwise a later `PromotionPath` would keep measuring from the original hire date and a
 *  multi-step career path could chain faster than `minimumWeeksInRole` intends. */
function advanceEmployment(state: SimulationKindState, jobs: readonly JobDefinition[]): SimulationKindState {
  const employment = state.player.career.currentEmployment;
  if (!employment) return state;
  const job = findJob(jobs, employment.jobId);
  if (!job) return state;

  const workedThisWeek = state.player.flags["workedThisWeek"] === true;
  const performance = workedThisWeek
    ? clamp(employment.performance + PERFORMANCE_WORK_BONUS, 0, 100)
    : clamp(Math.round(employment.performance + PERFORMANCE_DRIFT_RATE * (job.performance.weeklyDriftToward - employment.performance)), 0, 100);

  let next: Employment = { ...employment, performance };

  for (const path of job.promotionPaths) {
    if (path.contested) continue;
    if (state.calendar.currentWeek - employment.startedWeek < path.minimumWeeksInRole) continue;
    if (performance < path.minimumPerformance) continue;
    if (!path.requirements.every((r) => evaluateSimulationCondition(r.condition, state))) continue;
    const target = findJob(jobs, path.toJobId);
    if (!target) continue;
    next = {
      ...next,
      jobId: target.id,
      employerId: target.employerId,
      startedWeek: state.calendar.currentWeek,
      weeklyPayCents: target.compensation.baseWeeklyPayCents,
      weeksAtCurrentPay: 0,
    };
    break;
  }

  return {
    ...state,
    player: {
      ...state.player,
      career: { ...state.player.career, currentEmployment: next, totalWeeksEmployed: state.player.career.totalWeeksEmployed + 1 },
    },
  };
}

/** Real logic (W53) — resolves due applications into a hire, then advances whatever
 *  `Employment` results. A hire that lands *this same week* is not advanced yet — the
 *  employee hasn't worked a week under it, so `totalWeeksEmployed` and performance
 *  drift/promotion would otherwise be evaluated against zero elapsed time. */
function employment(state: SimulationKindState, jobs: readonly JobDefinition[], emit: ResolutionEmitter): SimulationKindState {
  const wasEmployed = state.player.career.currentEmployment !== undefined;
  const resolved = resolveApplications(state, jobs, emit);
  const hiredThisWeek = !wasEmployed && resolved.player.career.currentEmployment !== undefined;
  return hiredThisWeek ? resolved : advanceEmployment(resolved, jobs);
}

function findCourse(courses: readonly CourseDefinition[], courseId: string): CourseDefinition | undefined {
  return courses.find((c) => c.id === courseId);
}

function attendanceFlagKey(courseId: string): string {
  return `attendedClass:${courseId}`;
}

/** Real logic (W54). See this file's own header for the pass/fail rule and what a
 *  completion awards. Returns state changes so clients receive audit records for skill
 *  awards, completions, and failures alongside action-resolver changes. */
function education(state: SimulationKindState, courses: readonly CourseDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  let working = state;
  const changes: StateChange[] = [];
  const nextEnrollments: CourseEnrollment[] = [];
  let credentials = state.player.education.credentials;
  let completedCourseIds = state.player.education.completedCourseIds;
  let failedCourseIds = state.player.education.failedCourseIds;
  let flags = state.player.flags;

  for (const enrollment of state.player.education.enrollments) {
    if (enrollment.status !== "active") {
      nextEnrollments.push(enrollment);
      continue;
    }
    const course = findCourse(courses, enrollment.courseId);
    if (!course) {
      nextEnrollments.push(enrollment);
      continue;
    }

    const flagKey = attendanceFlagKey(enrollment.courseId);
    const attended = flags[flagKey] === true;
    if (flagKey in flags) flags = { ...flags, [flagKey]: false };

    const weeksCompleted = enrollment.weeksCompleted + 1;
    const attendedUnits = enrollment.attendedUnits + (attended ? 1 : 0);
    const missedSessions = enrollment.missedSessions + (attended ? 0 : 1);

    if (weeksCompleted < course.durationWeeks) {
      nextEnrollments.push({ ...enrollment, weeksCompleted, attendedUnits, missedSessions });
      continue;
    }

    const attendanceRatio = Math.round((attendedUnits / weeksCompleted) * 100);
    const failed = attendanceRatio < course.failureRules.minimumAttendanceRatio
      || missedSessions > course.failureRules.maximumMissedSessions
      || enrollment.studyUnits < course.failureRules.minimumStudyUnitsPerWeek * course.durationWeeks
      || (course.failureRules.maximumStress !== undefined && state.player.needs.stress > course.failureRules.maximumStress);

    if (failed) {
      nextEnrollments.push({
        ...enrollment, weeksCompleted, attendedUnits, missedSessions,
        status: "failed", retainedProgress: course.failureRules.progressRetainedOnFailure,
      });
      if (!failedCourseIds.includes(course.id)) failedCourseIds = [...failedCourseIds, course.id];
      changes.push({ path: `player.education.enrollments.${course.id}.status`, op: "set", value: "failed", previous: "active", reason: "education_course_failed", visible: true });
      continue;
    }

    nextEnrollments.push({ ...enrollment, weeksCompleted, attendedUnits, missedSessions, status: "completed" });
    if (!completedCourseIds.includes(course.id)) completedCourseIds = [...completedCourseIds, course.id];
    changes.push({ path: `player.education.enrollments.${course.id}.status`, op: "set", value: "completed", previous: "active", reason: "education_course_completed", visible: true });

    for (const reward of course.rewards) {
      if (reward.type !== "skill" || reward.target === undefined || typeof reward.value !== "number") continue;
      const skillId = reward.target;
      const current = working.player.skills[skillId] ?? 0;
      const awarded = Math.min(100, Math.max(0, Math.max(current, reward.value)));
      if (awarded === current) continue;
      working = { ...working, player: { ...working.player, skills: { ...working.player.skills, [skillId]: awarded } } };
      changes.push({ path: `player.skills.${skillId}`, op: "set", value: awarded, previous: current, reason: "education_skill_awarded", visible: true });
    }

    if (course.awardsCredential !== undefined && course.awardsCredential !== "none") {
      const credential: Credential = {
        id: `${course.id}-credential-${state.calendar.currentWeek}`,
        courseId: course.id,
        awardedWeek: state.calendar.currentWeek,
        level: course.awardsCredential,
        labelKey: course.nameKey,
      };
      credentials = [...credentials, credential];
      changes.push({ path: "player.education.credentials", op: "set", value: credential.id, reason: "education_credential_awarded", visible: true });
    }
  }

  return {
    state: {
      ...working,
      player: {
        ...working.player,
        flags,
        education: { enrollments: nextEnrollments, credentials, completedCourseIds, failedCourseIds },
      },
    },
    changes,
  };
}

/** Real logic (W53) — pays `Employment.weeklyPayCents` into `cashCents`, plus overtime pay
 *  from `job.compensation.overtimeRate` when `player.flags.workedOvertimeThisWeek` (set by
 *  `resolvers.ts`'s `work_overtime`), scaled off the employee's current `weeklyPayCents` —
 *  the same basis as the base wage above it, so a `negotiate_job_terms` raise (§7.9) is
 *  reflected in overtime pay too, not just the base. Wages a course or scheduled expense
 *  would add are still unwired (`CourseDefinition`, out of scope — W54). Runs *before*
 *  `housing` (§3) so rent is payable out of this same week's wages.
 *
 *  Clears both weekly work flags here — but only when there's an `Employment` to have set
 *  them, the same condition `advanceEmployment` used to gate its own (too-early) clear on —
 *  once both consumers (`advanceEmployment`'s own performance-bonus read, above in
 *  `employment()`, and this system's own overtime read) have seen them for the week.
 *  Clearing earlier, inside `advanceEmployment`, meant this system always read
 *  `workedOvertimeThisWeek` as already-reset and never paid overtime. */
export function financeIncome(state: SimulationKindState, jobs: readonly JobDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  const employment = state.player.career.currentEmployment;
  if (!employment) return { state, changes: [] };

  const flags = { ...state.player.flags, workedThisWeek: false, workedOvertimeThisWeek: false };
  const clearedState: SimulationKindState = { ...state, player: { ...state.player, flags } };
  const job = findJob(jobs, employment.jobId);

  let pay = employment.weeklyPayCents;
  const workedOvertime = state.player.flags["workedOvertimeThisWeek"] === true;
  if (workedOvertime && job?.compensation.overtimeRate) {
    pay += Math.round(employment.weeklyPayCents * job.compensation.overtimeRate / 10_000);
  }
  if (pay === 0) return { state: clearedState, changes: [] };

  const before = state.player.finances.cashCents;
  return {
    state: {
      ...clearedState,
      player: { ...clearedState.player, finances: { ...clearedState.player.finances, cashCents: before + pay } },
    },
    changes: [{ path: "player.finances.cashCents", op: "increment", value: pay, previous: before, reason: "wage_payment", visible: true }],
  };
}

/** A per-item `StatusEffect`'s id, derived from the instance's own natural key (§6) so the
 *  sync below is a pure set comparison rather than a search. Colon-separated for the same
 *  reason `attendedClass:<courseId>` is — it cannot collide with a campaign-authored id. */
function itemEffectId(instanceId: string): string {
  return `item:${instanceId}`;
}

/**
 * Real logic (W56) — two jobs, in this order.
 *
 * **Decay.** Every item ages one week (`weeksSinceMaintenance`), and if the **governing**
 * `MaintenanceRule` — the first listed, `resolvers.ts`'s `governingMaintenanceRule`, shared
 * so the two cannot diverge — has had its `intervalWeeks` elapse since the last service, its
 * `conditionLossIfSkipped` comes off `condition`, clamped to `0–100`. Summing every elapsed
 * rule instead would charge condition for rules `maintain_item` can never service, and let one
 * service clear penalties it never paid for. An item with no `maintenanceRules` never decays —
 * §7.5 gives condition no other decay source, and inventing a flat rate for a possession the
 * content says needs no upkeep would be a rule this contract does not have. Skipping
 * maintenance keeps costing every week the interval stays elapsed; `resolvers.ts`'s
 * `maintain_item` is the only thing that resets the clock.
 *
 * **Effect sync.** `ItemDefinition.effects` reach `activeEffects` from here, not from `shop`
 * — `resolvers.ts`'s own header states why (`apply` has no `ctx`, and a `modifiers` array is
 * not addressable by the scalar natural-key convention). Every `sourceKind: "item"` effect is
 * rebuilt from the inventory each week, so **an item at zero condition simply stops
 * contributing its modifiers and stays in inventory** — exactly the distinction W56.3 draws,
 * and the reason a repaired item resumes contributing without anything having to remember it
 * once did. Effects from any other source are carried through untouched.
 *
 * `breakageChanceAtZeroCondition` (§7.5) is deliberately **not** applied: it is a random draw,
 * and the end-of-week pipeline is handed an emitter, not a `KindContext` — there is no
 * `ctx.derive` here to take a deterministic substream from. `InventoryItem.broken` therefore
 * only ever moves through `repair_item`. Recorded as an open item rather than resolved by
 * making the roll deterministic, which would misrepresent a chance as a certainty.
 */
function inventory(state: SimulationKindState, items: readonly ItemDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  const findItem = (definitionId: string): ItemDefinition | undefined => items.find((d) => d.id === definitionId);

  const nextInventory = state.player.inventory.map((item) => {
    const weeksSinceMaintenance = item.weeksSinceMaintenance + 1;
    const rule = governingMaintenanceRule(findItem(item.definitionId));
    const loss = rule !== undefined && weeksSinceMaintenance >= rule.intervalWeeks ? rule.conditionLossIfSkipped : 0;
    const condition = clamp(item.condition - loss, 0, 100);
    if (condition !== item.condition) {
      changes.push({
        path: `player.inventory.${item.instanceId}.condition`, op: "set", value: condition,
        previous: item.condition, reason: "item_condition_decayed", visible: true,
      });
    }
    return { ...item, weeksSinceMaintenance, condition };
  });

  const carried = state.activeEffects.filter((effect) => effect.sourceKind !== "item");
  const itemEffects: StatusEffect[] = [];
  for (const item of nextInventory) {
    if (item.condition <= 0) continue;
    const def = findItem(item.definitionId);
    if (!def || def.effects.length === 0) continue;
    const id = itemEffectId(item.instanceId);
    itemEffects.push({
      id,
      sourceId: item.instanceId,
      sourceKind: "item",
      modifiers: def.effects,
      // Preserved across weeks: `appliedWeek` breaks `set`-modifier priority ties
      // (`modifiers.ts`), so rebuilding it each week would silently re-date the effect.
      appliedWeek: state.activeEffects.find((e) => e.id === id)?.appliedWeek ?? state.calendar.currentWeek,
      stacking: def.stacking,
      descriptionKey: def.nameKey,
      visible: true,
    });
  }

  return {
    state: {
      ...state,
      player: { ...state.player, inventory: nextInventory },
      activeEffects: [...carried, ...itemEffects],
    },
    changes,
  };
}

/** Real logic (W53; revised W55) — levies `HousingState.weeklyCostCents` against
 *  `cashCents` unconditionally, same as W53: `cashCents` may go negative (§3's own ordering
 *  claim is proved by exactly this — rent charged before wages arrive genuinely overdraws,
 *  not merely "goes unpaid"). `missedCents` is *not* read back off the resulting negative
 *  balance, though — that would double-count an already-negative balance carried in from a
 *  prior unresolved week into this week's own arrears levy. Instead it's computed from what
 *  this week's own charge alone could and couldn't cover against the cash on hand *before*
 *  this charge, so `finance_reconcile` (below) only ever levies a fee against balances
 *  `housing` charged this week, per its own contract. */
export function housing(state: SimulationKindState): { state: SimulationKindState; changes: StateChange[]; missedCents: Cents } {
  const rent = state.player.housing.weeklyCostCents;
  if (rent === 0) return { state, changes: [], missedCents: 0 };
  const before = state.player.finances.cashCents;
  const missedCents = Math.max(0, rent - Math.max(0, before));
  return {
    state: {
      ...state,
      player: { ...state.player, finances: { ...state.player.finances, cashCents: before - rent } },
    },
    changes: [{ path: "player.finances.cashCents", op: "decrement", value: rent, previous: before, reason: "rent_charged", visible: true }],
    missedCents,
  };
}

const EVICTION_LADDER: readonly EvictionStage[] = [
  "none", "warning", "penalty", "formal_notice", "hearing_scheduled", "evicted",
];

function advanceEvictionStage(stage: EvictionStage): EvictionStage {
  const index = EVICTION_LADDER.indexOf(stage);
  return EVICTION_LADDER[Math.min(index + 1, EVICTION_LADDER.length - 1)]!;
}

/** Basis points — 10%, levied on the rent `housing` (above) just failed to collect in
 *  full. Placeholder, the same status every other unbalanced numeric rule in this kind
 *  carries (`negotiateJobTermsResolver`'s `NEGOTIATE_RAISE_BPS`, `TODO.md`'s *Known Open
 *  Items*). */
const LATE_FEE_BPS = 1000;

/** Real logic (W55) — `missedCents` (from `housing`, above, in the same pass) is the only
 *  input: this system levies a late fee on top of it, adds both to `HousingState.
 *  overdueRentCents`, and advances `evictionStage` by exactly one rung on the ladder —
 *  never more than one, regardless of how large `missedCents` is, so a single very bad
 *  week reads the same as any other missed week. A week where `housing` collected the
 *  full rent (`missedCents === 0`) is a no-op: arrears already on the books stay exactly
 *  where they are until the player clears them with `pay_bills` (`resolvers.ts`) — this
 *  system only ever escalates, never cures. */
export function financeReconcile(state: SimulationKindState, missedCents: Cents): { state: SimulationKindState; changes: StateChange[] } {
  if (missedCents <= 0) return { state, changes: [] };

  const lateFee = Math.round((missedCents * LATE_FEE_BPS) / 10_000);
  const arrears = missedCents + lateFee;
  const housingBefore = state.player.housing;
  const nextStage = advanceEvictionStage(housingBefore.evictionStage);

  const changes: StateChange[] = [
    {
      path: "player.housing.overdueRentCents", op: "increment", value: arrears,
      previous: housingBefore.overdueRentCents, reason: "rent_overdue", visible: true,
    },
    {
      path: "player.housing.missedPayments", op: "increment", value: 1,
      previous: housingBefore.missedPayments, reason: "rent_overdue", visible: true,
    },
  ];
  if (nextStage !== housingBefore.evictionStage) {
    changes.push({
      path: "player.housing.evictionStage", op: "set", value: nextStage,
      previous: housingBefore.evictionStage, reason: "eviction_advanced", visible: true,
    });
  }

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        housing: {
          ...housingBefore,
          overdueRentCents: housingBefore.overdueRentCents + arrears,
          missedPayments: housingBefore.missedPayments + 1,
          evictionStage: nextStage,
        },
      },
    },
    changes,
  };
}

/** **Stub, and stays one after W56.** No weekly relationship rule — decay, drift, or
 *  otherwise — is specified anywhere in this contract: §6.11 declares the state and §7.7 the
 *  NPC, but nothing names what a week does to either. `resolvers.ts`'s `socialize` moves a
 *  `RelationshipState`; writing the missing weekly rule is `/contract`'s work, not a slice's
 *  (W56's own *Out of scope*). */
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
  jobs: readonly JobDefinition[] = [],
  courses: readonly CourseDefinition[] = [],
  items: readonly ItemDefinition[] = [],
): { state: SimulationKindState; changes: StateChange[] } {
  let next = employment(state, jobs, emit);
  ranSystem(emit, "employment");

  const educationResult = education(next, courses);
  next = educationResult.state;
  ranSystem(emit, "education");

  const financeIncomeResult = financeIncome(next, jobs);
  next = financeIncomeResult.state;
  ranSystem(emit, "finance_income");

  const inventoryResult = inventory(next, items);
  next = inventoryResult.state;
  ranSystem(emit, "inventory");

  const housingResult = housing(next);
  next = housingResult.state;
  ranSystem(emit, "housing");

  const financeReconcileResult = financeReconcile(next, housingResult.missedCents);
  next = financeReconcileResult.state;
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

  return {
    state: next,
    changes: [
      ...educationResult.changes, ...financeIncomeResult.changes, ...inventoryResult.changes,
      ...housingResult.changes, ...financeReconcileResult.changes, ...needsResult.changes,
    ],
  };
}
