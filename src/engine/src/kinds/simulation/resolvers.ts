/**
 * Simulation kind — resolver dispatch (10-simulation-kind.md §5.1, §5.3).
 *
 * Contract: `10-simulation-kind.md` §5.1, §5.3.
 *
 * `ResolverTable` is `Record<Exclude<ActionType, "custom">, ActionResolver>` — a missing
 * resolver is a compile error, not a runtime surprise (§5.1). Most entries are still
 * `stubResolver`, since most `ActionType`s need a content type (`CourseDefinition`,
 * `HousingDefinition`, `ItemDefinition`, …) this unit deliberately doesn't wire. `eat`
 * and `rest` are real (W39/W40) — the two actions that give the player any way to counter
 * `needs` drift (`endOfWeek.ts`). W53 adds the other five real resolvers this kind has:
 * `work`, `work_overtime`, `search_for_work`, `apply_for_job`, `negotiate_job_terms` — the
 * employment slice (10 §5.1, §7.2, §7.9).
 *
 * **`apply(state, outcome)` never receives `ctx` (§5.1's own signature) — a deliberate
 * contract constraint, not an oversight.** `calculate` is the only phase with `ctx.campaign`,
 * so it is also the only phase that can look up a `JobDefinition`. Two of the five new
 * resolvers (`search_for_work`, `apply_for_job`) need `apply` to append a brand-new,
 * content-derived record (`JobOpening`, `JobApplication`) that `apply` alone cannot look up.
 * The fix is not a signature change (forbidden — `04-core.md`'s "no signature drift," and
 * `Kind.previewAction`, W48, calls `calculate` alone precisely because it must never mutate)
 * but the addressing convention `10-simulation-kind.md` §7.1 already establishes for a
 * collection member — `player.relationships.<npcId>.affinity` and friends: `calculate`
 * emits one real `StateChange` per scalar field of the new record, addressed by natural key
 * (`world.jobMarket.openings.<jobId>.postedWeek`, `.contested`, `.positionsAvailable`), and
 * `apply` reconstructs the record by reading those same paths back out of `outcome.changes`.
 * Every field either type declares (`JobOpening`, `JobApplication`) is a scalar
 * (`string`/`number`/`boolean`), so this covers both records completely — no path is
 * invented that doesn't correspond to a real, addressable field.
 *
 * **Hiring, performance and promotion are not here.** `apply_for_job` only ever files a
 * `JobApplication`; resolving it into an `Employment` needs `JobDefinition` content the same
 * way, but on a timescale (`resolvesWeek`) a single action's `apply()` cannot see across —
 * that is `endOfWeek.ts`'s `employment` system, which already receives the full `jobs` list
 * as a plain function parameter and has no `apply()`-style constraint to work around.
 *
 * **W54 adds the four education resolvers**: `enroll_course`, `attend_class`, `study` and
 * `withdraw_course` (§7.3, §6.7). `enroll_course` follows the same natural-key addressing
 * convention as `apply_for_job` — `calculate` emits one `StateChange` per scalar field of the
 * new `CourseEnrollment` (`player.education.enrollments.<courseId>.*`), and `apply`
 * reconstructs it from `outcome.changes`. `attend_class` costs no time of its own:
 * `startOfWeek.ts`'s `time_commit` already reserves a course's `weeklyTimeCost` for every
 * active enrollment regardless of whether the player shows up, so the action's only job is to
 * flip a per-course attendance flag (`player.flags.attendedClass:<courseId>`) that
 * `endOfWeek.ts`'s `education` system reads and clears. `study` is the one discretionary
 * education action that spends real time, incrementing `CourseEnrollment.studyUnits` — again
 * addressed and reconstructed the `apply_for_job` way, since `apply` cannot look up which
 * enrollment a study session targets on its own. `withdraw_course` removes the enrollment
 * outright (§10-simulation-kind.md's "or withdraw and lose the fees" — no refund, and nothing
 * elsewhere in this contract gives a withdrawn course a persisted record).
 *
 * **W55 adds the six remaining money/housing resolvers**: `move_housing`, `pay_bills`,
 * `borrow_money`, `repay_debt`, `deposit_savings`, `invest`. `move_housing` follows
 * `enroll_course`'s addressing convention (a `HousingDefinition` lookup only `calculate`
 * can make, reconstructed in `apply` from `outcome.changes`) since replacing
 * `player.housing` wholesale needs content `apply` alone can't see. The other five need no
 * such indirection — every field they touch (`cashCents`, `debtCents`, `savingsCents`,
 * `HousingState.overdueRentCents`/`missedPayments`/`evictionStage`, and `invest`'s own
 * `FinancialAccount`) is already visible to `apply` via `state` plus one carried number, the
 * same shape `eatResolver`/`restResolver` use. `pay_bills` is `endOfWeek.ts`'s
 * `financeReconcile` in reverse — the only way a player cures arrears that system levies.
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange, OutcomeMessage } from "../../core/kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { CourseEnrollment, FinancialAccount, HousingState, JobApplication } from "./actor.js";
import type { SimulationCampaign } from "./campaign.js";
import { evaluateSimulationCondition } from "./conditions.js";
import { INVESTMENT_ACCOUNT_LABEL_KEY } from "./reasons.js";
import type { JobOpening, SimulationKindState } from "./state.js";
import type { BasisPoints, Cents } from "./state.js";
import type { ActionType, GameAction } from "./plan.js";

export interface ActionValidation {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];

  calculatedTimeCost?: number;
  calculatedMoneyCostCents?: Cents;
}

export interface ActionOutcome {
  actionId: string;
  success: boolean;

  degree: "critical_failure" | "failure" | "partial" | "success" | "critical";

  reason: string;

  changes: StateChange[];
  generatedEvents: string[];
  generatedOpportunities: string[];
  messages: OutcomeMessage[];
}

export interface ActionResolver {
  canExecute(state: SimulationKindState, action: GameAction, ctx: KindContext): ActionValidation;
  calculate(state: SimulationKindState, action: GameAction, ctx: KindContext): ActionOutcome;
  apply(state: SimulationKindState, outcome: ActionOutcome): SimulationKindState;
}

export type ResolverTable = Record<Exclude<ActionType, "custom">, ActionResolver>;

/** Always valid, always a neutral no-op outcome, never mutates state. `reason:
 *  "check_succeeded"` reuses an existing base reason code (`kernel/reasons.ts`) rather
 *  than inventing an unregistered one for a placeholder that has no real gameplay
 *  meaning yet. */
export const stubResolver: ActionResolver = {
  canExecute: (): ActionValidation => ({ valid: true, errors: [], warnings: [] }),
  calculate: (_state, action): ActionOutcome => ({
    actionId: action.id,
    success: true,
    degree: "success",
    reason: "check_succeeded",
    changes: [],
    generatedEvents: [],
    generatedOpportunities: [],
    messages: [],
  }),
  apply: (state): SimulationKindState => state,
};

function clampNeed(value: number): number {
  return Math.min(100, Math.max(0, value));
}

const EAT_SATIETY_RESTORE = 25;

/** Real logic — restores `satiety` by a fixed amount, clamped to 100. The only resolver
 *  the "Stable Life" vertical slice needs to counter `needs.satiety`'s own weekly drift
 *  (`endOfWeek.ts`'s `DRIFT_PER_WEEK`). Placeholder amount, same caveat as the drift rates
 *  themselves (`TODO.md`'s *Known Open Items*). */
export const eatResolver: ActionResolver = {
  canExecute: (): ActionValidation => ({ valid: true, errors: [], warnings: [] }),
  calculate: (state, action): ActionOutcome => {
    const before = state.player.needs.satiety;
    const after = clampNeed(before + EAT_SATIETY_RESTORE);
    const changes: StateChange[] = after === before ? [] : [{
      path: "player.needs.satiety",
      op: "set",
      value: after,
      previous: before,
      reason: "action_eat",
      visible: true,
    }];
    return {
      actionId: action.id,
      success: true,
      degree: "success",
      reason: "check_succeeded",
      changes,
      generatedEvents: [],
      generatedOpportunities: [],
      messages: [],
    };
  },
  apply: (state): SimulationKindState => {
    const satiety = clampNeed(state.player.needs.satiety + EAT_SATIETY_RESTORE);
    return { ...state, player: { ...state.player, needs: { ...state.player.needs, satiety } } };
  },
};

const REST_ENERGY_RESTORE = 20;
const REST_STRESS_RELIEF = 5;

/** Real logic — restores `energy` and relieves `stress` by fixed amounts, both clamped.
 *  Counters two of `DRIFT_PER_WEEK`'s five rates; same placeholder-numbers caveat as
 *  `eatResolver`. */
export const restResolver: ActionResolver = {
  canExecute: (): ActionValidation => ({ valid: true, errors: [], warnings: [] }),
  calculate: (state, action): ActionOutcome => {
    const beforeEnergy = state.player.needs.energy;
    const afterEnergy = clampNeed(beforeEnergy + REST_ENERGY_RESTORE);
    const beforeStress = state.player.needs.stress;
    const afterStress = clampNeed(beforeStress - REST_STRESS_RELIEF);

    const changes: StateChange[] = [];
    if (afterEnergy !== beforeEnergy) {
      changes.push({
        path: "player.needs.energy", op: "set", value: afterEnergy, previous: beforeEnergy,
        reason: "action_rest", visible: true,
      });
    }
    if (afterStress !== beforeStress) {
      changes.push({
        path: "player.needs.stress", op: "set", value: afterStress, previous: beforeStress,
        reason: "action_rest", visible: true,
      });
    }

    return {
      actionId: action.id,
      success: true,
      degree: "success",
      reason: "check_succeeded",
      changes,
      generatedEvents: [],
      generatedOpportunities: [],
      messages: [],
    };
  },
  apply: (state): SimulationKindState => {
    const energy = clampNeed(state.player.needs.energy + REST_ENERGY_RESTORE);
    const stress = clampNeed(state.player.needs.stress - REST_STRESS_RELIEF);
    return { ...state, player: { ...state.player, needs: { ...state.player.needs, energy, stress } } };
  },
};

// ---------------------------------------------------------------------------
// W53 — Employment and Income
// ---------------------------------------------------------------------------

const SEARCH_TIME_COST = 2;
const APPLY_TIME_COST = 1;
const NEGOTIATE_TIME_COST = 1;
const OVERTIME_TIME_COST = 4;
/** Weeks between `apply_for_job` and its resolution — deliberately 1, not immediate:
 *  §5.1's `JobApplication.resolvesWeek` exists precisely so hiring happens in
 *  `endOfWeek.ts`'s `employment` system, not inside this resolver's own `apply`. */
const APPLICATION_RESOLVE_WEEKS = 1;
/** Basis points — 5%. Placeholder, the same status every other numeric rule in this kind
 *  not yet balance-tested carries (`TODO.md`'s *Known Open Items*). */
const NEGOTIATE_RAISE_BPS = 500;

function simulationCampaign(ctx: KindContext): SimulationCampaign {
  return ctx.campaign.content as SimulationCampaign;
}

function availableTimeUnits(state: SimulationKindState): number {
  return state.calendar.totalTimeUnits - state.calendar.committedTimeUnits - state.calendar.spentTimeUnits;
}

function locationAllows(state: SimulationKindState, campaign: SimulationCampaign, actionType: ActionType): boolean {
  const location = campaign.locations.find((l) => l.id === state.player.currentLocationId);
  return location !== undefined && location.actionTypes.includes(actionType);
}

function invalid(code: string, messageKey: string): ActionValidation {
  return { valid: false, errors: [{ code, messageKey }], warnings: [] };
}

function wrongLocationError(): ActionValidation {
  return invalid("wrong_location", "simulation.reason.wrong_location");
}

function insufficientTimeError(): ActionValidation {
  return invalid("insufficient_time", "simulation.reason.insufficient_time");
}

function insufficientFundsError(): ActionValidation {
  return invalid("insufficient_funds", "simulation.reason.insufficient_funds");
}

function requirementUnmetError(): ActionValidation {
  return invalid("requirement_unmet", "core.reason.requirement_unmet");
}

/** Applies to every resolver below that has no money cost of its own (§10's own callout
 *  in `reasons.ts`: no path here can produce `insufficient_funds` yet). */
const NO_MONEY_COST: Cents = 0;

const SEARCH_FOR_WORK_TIME_PATH = "calendar.spentTimeUnits";

export const searchForWorkResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "search_for_work")) return wrongLocationError();
    if (availableTimeUnits(state) < SEARCH_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: SEARCH_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const existingIds = new Set(state.world.jobMarket.openings.map((o) => o.jobId));
    const newJobs = campaign.jobs.filter((j) => !existingIds.has(j.id));

    const changes: StateChange[] = [
      { path: SEARCH_FOR_WORK_TIME_PATH, op: "increment", value: SEARCH_TIME_COST, reason: "action_search_for_work", visible: true },
    ];
    for (const job of newJobs) {
      const base = `world.jobMarket.openings.${job.id}`;
      changes.push({ path: `${base}.postedWeek`, op: "set", value: state.calendar.currentWeek, reason: "action_search_for_work", visible: true });
      changes.push({ path: `${base}.contested`, op: "set", value: job.contested, reason: "action_search_for_work", visible: false });
      if (job.positionsAvailable !== undefined) {
        changes.push({ path: `${base}.positionsAvailable`, op: "set", value: job.positionsAvailable, reason: "action_search_for_work", visible: false });
      }
    }

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === SEARCH_FOR_WORK_TIME_PATH)?.value;
    const postedWeekChanges = outcome.changes.filter((c) => c.path.startsWith("world.jobMarket.openings.") && c.path.endsWith(".postedWeek"));

    const newOpenings: JobOpening[] = postedWeekChanges.map((c) => {
      const jobId = c.path.split(".")[3]!;
      const contested = outcome.changes.find((cc) => cc.path === `world.jobMarket.openings.${jobId}.contested`)?.value;
      const positionsAvailable = outcome.changes.find((cc) => cc.path === `world.jobMarket.openings.${jobId}.positionsAvailable`)?.value;
      return {
        jobId,
        contested: contested === true,
        ...(typeof positionsAvailable === "number" ? { positionsAvailable } : {}),
        postedWeek: c.value as number,
      };
    });

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      world: { ...state.world, jobMarket: { openings: [...state.world.jobMarket.openings, ...newOpenings] } },
    };
  },
};

const APPLY_FOR_JOB_TIME_PATH = "calendar.spentTimeUnits";

export const applyForJobResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const jobId = action.targetId;
    const job = jobId === undefined ? undefined : campaign.jobs.find((j) => j.id === jobId);
    if (!job) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "apply_for_job")) return wrongLocationError();
    const opening = state.world.jobMarket.openings.find((o) => o.jobId === job.id);
    if (!opening) return requirementUnmetError();
    if (state.player.career.pendingApplications.some((a) => a.jobId === job.id)) return requirementUnmetError();
    for (const requirement of job.requirements) {
      if (!evaluateSimulationCondition(requirement.condition, state)) {
        return invalid(requirement.failureCode, requirement.messageKey);
      }
    }
    if (availableTimeUnits(state) < APPLY_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: APPLY_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const job = campaign.jobs.find((j) => j.id === action.targetId)!;
    const base = `player.career.pendingApplications.${job.id}`;

    const changes: StateChange[] = [
      { path: APPLY_FOR_JOB_TIME_PATH, op: "increment", value: APPLY_TIME_COST, reason: "action_apply_for_job", visible: true },
      { path: `${base}.resolvesWeek`, op: "set", value: state.calendar.currentWeek + APPLICATION_RESOLVE_WEEKS, reason: "action_apply_for_job", visible: true },
      { path: `${base}.contested`, op: "set", value: job.contested, reason: "action_apply_for_job", visible: false },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const resolvesChange = outcome.changes.find((c) => c.path.startsWith("player.career.pendingApplications.") && c.path.endsWith(".resolvesWeek"));
    if (!resolvesChange) return state;
    const jobId = resolvesChange.path.split(".")[3]!;
    const contested = outcome.changes.find((c) => c.path === `player.career.pendingApplications.${jobId}.contested`)?.value;
    const spentDelta = outcome.changes.find((c) => c.path === APPLY_FOR_JOB_TIME_PATH)?.value;

    const application: JobApplication = {
      jobId,
      submittedWeek: state.calendar.currentWeek,
      resolvesWeek: resolvesChange.value as number,
      contested: contested === true,
      outcome: "pending",
    };

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        career: { ...state.player.career, pendingApplications: [...state.player.career.pendingApplications, application] },
      },
    };
  },
};

/** Shared by `work`/`work_overtime`/`negotiate_job_terms` — all three require an active
 *  job (`requirement_unmet` otherwise; §10 names no more specific code for "not employed"). */
function requireEmployment(state: SimulationKindState): ActionValidation | undefined {
  return state.player.career.currentEmployment === undefined ? requirementUnmetError() : undefined;
}

export const workResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const employmentError = requireEmployment(state);
    if (employmentError) return employmentError;
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "work")) return wrongLocationError();
    const job = campaign.jobs.find((j) => j.id === state.player.career.currentEmployment!.jobId);
    const cost = job?.schedule.weeklyTimeCost ?? 0;
    if (availableTimeUnits(state) < cost) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: cost, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const job = campaign.jobs.find((j) => j.id === state.player.career.currentEmployment!.jobId);
    const cost = job?.schedule.weeklyTimeCost ?? 0;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: cost, reason: "action_work", visible: true },
      { path: "player.flags.workedThisWeek", op: "set", value: true, previous: state.player.flags["workedThisWeek"] ?? false, reason: "action_work", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, flags: { ...state.player.flags, workedThisWeek: true } },
    };
  },
};

export const workOvertimeResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const employmentError = requireEmployment(state);
    if (employmentError) return employmentError;
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "work_overtime")) return wrongLocationError();
    if (availableTimeUnits(state) < OVERTIME_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: OVERTIME_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: OVERTIME_TIME_COST, reason: "action_work_overtime", visible: true },
      { path: "player.flags.workedOvertimeThisWeek", op: "set", value: true, previous: state.player.flags["workedOvertimeThisWeek"] ?? false, reason: "action_work_overtime", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, flags: { ...state.player.flags, workedOvertimeThisWeek: true } },
    };
  },
};

/** The one resolver in this kind that draws randomness (§13; a substream test proves it
 *  doesn't shift any other resolver's draws). The chance of a successful negotiation is the
 *  player's `charisma` attribute read as a percent — a placeholder formula, the same status
 *  every other unbalanced numeric rule in this kind already carries. `apply` never needs
 *  `ctx`: unlike `search_for_work`/`apply_for_job`, the raise is a percentage of the
 *  *existing* `Employment.weeklyPayCents`, already in `state`, so it recomputes without any
 *  content lookup. */
export const negotiateJobTermsResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const employmentError = requireEmployment(state);
    if (employmentError) return employmentError;
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "negotiate_job_terms")) return wrongLocationError();
    if (availableTimeUnits(state) < NEGOTIATE_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: NEGOTIATE_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const roll = ctx.derive({ kind: "system", system: `simulation.negotiate.${action.id}`, seq: 0 }).nextPercent();
    const chance = state.player.attributes.charisma;
    const succeeded = roll < chance;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: NEGOTIATE_TIME_COST, reason: "action_negotiate_job_terms", visible: true },
    ];
    if (succeeded) {
      const employment = state.player.career.currentEmployment!;
      const raise = Math.round(employment.weeklyPayCents * NEGOTIATE_RAISE_BPS / 10_000);
      changes.push({
        path: "player.career.currentEmployment.weeklyPayCents", op: "increment", value: raise,
        previous: employment.weeklyPayCents, reason: "action_negotiate_job_terms", visible: true,
      });
    }

    return {
      actionId: action.id,
      success: succeeded,
      degree: succeeded ? "success" : "failure",
      reason: succeeded ? "check_succeeded" : "check_failed",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const raise = outcome.changes.find((c) => c.path === "player.career.currentEmployment.weeklyPayCents")?.value;
    const employment = state.player.career.currentEmployment;
    const raised = employment && typeof raise === "number"
      ? { ...employment, weeklyPayCents: employment.weeklyPayCents + raise }
      : undefined;
    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, career: { ...state.player.career, ...(raised ? { currentEmployment: raised } : {}) } },
    };
  },
};

// ---------------------------------------------------------------------------
// W54 — Education and Skills
// ---------------------------------------------------------------------------

const STUDY_TIME_COST = 2;
const STUDY_UNITS_PER_SESSION = 1;

function attendanceFlagKey(courseId: string): string {
  return `attendedClass:${courseId}`;
}

/** Shared by `attend_class`/`study`/`withdraw_course` — all three need an existing *active*
 *  enrollment in the targeted course; §10 names no more specific code for "not enrolled." */
function activeEnrollment(state: SimulationKindState, courseId: string | undefined): CourseEnrollment | undefined {
  if (courseId === undefined) return undefined;
  return state.player.education.enrollments.find((e) => e.courseId === courseId && e.status === "active");
}

export const enrollCourseResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const courseId = action.targetId;
    const course = courseId === undefined ? undefined : campaign.courses.find((c) => c.id === courseId);
    if (!course) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "enroll_course")) return wrongLocationError();
    if (activeEnrollment(state, course.id)) return requirementUnmetError();
    for (const requirement of course.requirements) {
      if (!evaluateSimulationCondition(requirement.condition, state)) {
        return invalid(requirement.failureCode, requirement.messageKey);
      }
    }
    if (state.player.finances.cashCents < course.tuitionCents) return insufficientFundsError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: 0, calculatedMoneyCostCents: course.tuitionCents };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const course = campaign.courses.find((c) => c.id === action.targetId)!;
    const base = `player.education.enrollments.${course.id}`;
    const cashBefore = state.player.finances.cashCents;
    const priorFailed = state.player.education.enrollments.find((e) => e.courseId === course.id && e.status === "failed");
    const retainedProgress = priorFailed?.retainedProgress ?? 0;

    const changes: StateChange[] = [
      { path: "player.finances.cashCents", op: "decrement", value: course.tuitionCents, previous: cashBefore, reason: "action_enroll_course", visible: true },
      { path: `${base}.startedWeek`, op: "set", value: state.calendar.currentWeek, reason: "action_enroll_course", visible: true },
      { path: `${base}.weeksCompleted`, op: "set", value: 0, reason: "action_enroll_course", visible: false },
      { path: `${base}.attendedUnits`, op: "set", value: 0, reason: "action_enroll_course", visible: false },
      { path: `${base}.studyUnits`, op: "set", value: 0, reason: "action_enroll_course", visible: false },
      { path: `${base}.missedSessions`, op: "set", value: 0, reason: "action_enroll_course", visible: false },
      { path: `${base}.tuitionPaidCents`, op: "set", value: course.tuitionCents, reason: "action_enroll_course", visible: true },
      { path: `${base}.tuitionOutstandingCents`, op: "set", value: 0, reason: "action_enroll_course", visible: false },
      { path: `${base}.retainedProgress`, op: "set", value: retainedProgress, reason: "action_enroll_course", visible: false },
      { path: `${base}.status`, op: "set", value: "active", reason: "action_enroll_course", visible: true },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const startedWeekChange = outcome.changes.find((c) => c.path.startsWith("player.education.enrollments.") && c.path.endsWith(".startedWeek"));
    if (!startedWeekChange) return state;
    const courseId = startedWeekChange.path.split(".")[3]!;
    const field = (name: string): unknown => outcome.changes.find((c) => c.path === `player.education.enrollments.${courseId}.${name}`)?.value;
    const tuitionPaid = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    const enrollment: CourseEnrollment = {
      courseId,
      startedWeek: startedWeekChange.value as number,
      weeksCompleted: field("weeksCompleted") as number,
      attendedUnits: field("attendedUnits") as number,
      studyUnits: field("studyUnits") as number,
      missedSessions: field("missedSessions") as number,
      tuitionPaidCents: field("tuitionPaidCents") as Cents,
      tuitionOutstandingCents: field("tuitionOutstandingCents") as Cents,
      retainedProgress: field("retainedProgress") as number,
      status: "active",
    };

    return {
      ...state,
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - (typeof tuitionPaid === "number" ? tuitionPaid : 0) },
        education: { ...state.player.education, enrollments: [...state.player.education.enrollments, enrollment] },
      },
    };
  },
};

export const attendClassResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    if (!activeEnrollment(state, action.targetId)) return requirementUnmetError();
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "attend_class")) return wrongLocationError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: 0, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const courseId = action.targetId!;
    const flagKey = attendanceFlagKey(courseId);
    const changes: StateChange[] = [
      { path: `player.flags.${flagKey}`, op: "set", value: true, previous: state.player.flags[flagKey] ?? false, reason: "action_attend_class", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const change = outcome.changes.find((c) => c.path.startsWith("player.flags.attendedClass:"));
    if (!change) return state;
    const flagKey = change.path.slice("player.flags.".length);
    return { ...state, player: { ...state.player, flags: { ...state.player.flags, [flagKey]: true } } };
  },
};

export const studyResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    if (!activeEnrollment(state, action.targetId)) return requirementUnmetError();
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "study")) return wrongLocationError();
    if (availableTimeUnits(state) < STUDY_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: STUDY_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const courseId = action.targetId!;
    const enrollment = activeEnrollment(state, courseId)!;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: STUDY_TIME_COST, reason: "action_study", visible: true },
      {
        path: `player.education.enrollments.${courseId}.studyUnits`, op: "increment", value: STUDY_UNITS_PER_SESSION,
        previous: enrollment.studyUnits, reason: "action_study", visible: true,
      },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const studyChange = outcome.changes.find((c) => c.path.startsWith("player.education.enrollments.") && c.path.endsWith(".studyUnits"));
    if (!studyChange) {
      return { ...state, calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) } };
    }
    const courseId = studyChange.path.split(".")[3]!;
    const enrollments = state.player.education.enrollments.map((e) =>
      e.courseId === courseId && e.status === "active" ? { ...e, studyUnits: e.studyUnits + (studyChange.value as number) } : e);
    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, education: { ...state.player.education, enrollments } },
    };
  },
};

export const withdrawCourseResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    if (!activeEnrollment(state, action.targetId)) return requirementUnmetError();
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "withdraw_course")) return wrongLocationError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: 0, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const courseId = action.targetId!;
    const changes: StateChange[] = [
      { path: `player.education.enrollments.${courseId}.status`, op: "set", value: "withdrawn", previous: "active", reason: "action_withdraw_course", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const change = outcome.changes.find((c) => c.path.startsWith("player.education.enrollments.") && c.path.endsWith(".status"));
    if (!change) return state;
    const courseId = change.path.split(".")[3]!;
    const enrollments = state.player.education.enrollments.filter((e) => !(e.courseId === courseId && e.status === "active"));
    const flagKey = `attendedClass:${courseId}`;
    const flags = flagKey in state.player.flags ? { ...state.player.flags, [flagKey]: false } : state.player.flags;
    return { ...state, player: { ...state.player, flags, education: { ...state.player.education, enrollments } } };
  },
};

// ---------------------------------------------------------------------------
// W55 — Housing, Debt, and Reconciliation
// ---------------------------------------------------------------------------

const MOVE_HOUSING_TIME_COST = 4;
/** `pay_bills`/`borrow_money`/`repay_debt`/`deposit_savings`/`invest` are paperwork, not
 *  labor — a small fixed cost, same placeholder status as every other unbalanced constant
 *  in this file. `pay_bills` alone costs none: it settles a debt already owed, not a new
 *  transaction the player negotiates. */
const FINANCE_ACTION_TIME_COST = 1;

function totalMoveCost(def: { upfrontCostCents: Cents; depositCents?: Cents }): Cents {
  return def.upfrontCostCents + (def.depositCents ?? 0);
}

/** Shared by `borrow_money`/`repay_debt`/`deposit_savings`/`invest` — none has a content
 *  type to size itself against (unlike `enroll_course`'s `tuitionCents` or `move_housing`'s
 *  `HousingDefinition`), so the amount is the one genuinely free-form number this kind's
 *  action model carries: a positive integer `Cents` the player chose, not an engine-derived
 *  cost (§4's own rule is about costs, not about data an action operates on — the same
 *  distinction that already lets `plan.remove`'s `index` be free-form). `isSafeInteger`,
 *  not `isInteger` — `isInteger` accepts magnitudes like `Number.MAX_VALUE` that overflow
 *  `canonicalStringify` (W55.4) the moment they're added to an existing balance. */
function amountCentsParam(action: GameAction): Cents | undefined {
  const raw = action.parameters["amountCents"];
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
}

/** Guards every resolver above that adds a player-chosen `amountCents` onto an existing
 *  balance: `amountCentsParam` alone only bounds the input, not the sum. A resulting balance
 *  that would fall outside the safe integer range is rejected the same way a malformed
 *  amount is — `requirement_unmet`, not a silent overflow into a value `canonicalStringify`
 *  (W55.4) cannot serialize. */
function wouldOverflow(...resultingBalances: readonly number[]): boolean {
  return resultingBalances.some((balance) => !Number.isSafeInteger(balance));
}

/** `move_housing` to a home the player cannot afford (§10-simulation-kind.md's own
 *  `HousingDefinition.upfrontCostCents`/`depositCents`) is rejected `insufficient_funds`
 *  and leaves `player.housing` untouched — `canExecute` never reaches `calculate`. Moving
 *  while `HousingState.overdueRentCents` is nonzero is rejected the same way: `pay_bills`
 *  (below) is this kind's only cure for arrears, and letting a move erase them for free
 *  would make it a second one, silently discarding the eviction ladder's progress along
 *  with the debt. Once arrears are clear (by construction, `missedPayments`/`evictionStage`
 *  are already `0`/`"none"` too — both are always reset alongside `overdueRentCents`),
 *  moving in resets the new home's own arrears ledger to zero: a fresh lease has no history
 *  with the old landlord's eviction ladder (`endOfWeek.ts`'s `financeReconcile`). */
export const moveHousingResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const housingId = action.targetId;
    const def = housingId === undefined ? undefined : campaign.housing.find((h) => h.id === housingId);
    if (!def) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "move_housing")) return wrongLocationError();
    if (def.id === state.player.housing.definitionId) return requirementUnmetError();
    if (state.player.housing.overdueRentCents > 0) return requirementUnmetError();
    for (const requirement of def.requirements) {
      if (!evaluateSimulationCondition(requirement.condition, state)) {
        return invalid(requirement.failureCode, requirement.messageKey);
      }
    }
    const cost = totalMoveCost(def);
    if (state.player.finances.cashCents < cost) return insufficientFundsError();
    if (availableTimeUnits(state) < MOVE_HOUSING_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: MOVE_HOUSING_TIME_COST, calculatedMoneyCostCents: cost };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const def = campaign.housing.find((h) => h.id === action.targetId)!;
    const cost = totalMoveCost(def);
    const cashBefore = state.player.finances.cashCents;
    const week = state.calendar.currentWeek;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: MOVE_HOUSING_TIME_COST, reason: "action_move_housing", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: cost, previous: cashBefore, reason: "action_move_housing", visible: true },
      { path: "player.housing.definitionId", op: "set", value: def.id, previous: state.player.housing.definitionId, reason: "action_move_housing", visible: true },
      { path: "player.housing.movedInWeek", op: "set", value: week, reason: "action_move_housing", visible: true },
      { path: "player.housing.ownership", op: "set", value: "renting", reason: "action_move_housing", visible: true },
      { path: "player.housing.damage", op: "set", value: 0, reason: "action_move_housing", visible: false },
      { path: "player.housing.weeklyCostCents", op: "set", value: def.weeklyCostCents, reason: "action_move_housing", visible: true },
      { path: "player.housing.depositPaidCents", op: "set", value: def.depositCents ?? 0, reason: "action_move_housing", visible: false },
      { path: "player.housing.rentDueWeek", op: "set", value: week, reason: "action_move_housing", visible: false },
      { path: "player.housing.overdueRentCents", op: "set", value: 0, reason: "action_move_housing", visible: false },
      { path: "player.housing.missedPayments", op: "set", value: 0, reason: "action_move_housing", visible: false },
      { path: "player.housing.evictionStage", op: "set", value: "none", reason: "action_move_housing", visible: false },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const field = (name: string): unknown => outcome.changes.find((c) => c.path === `player.housing.${name}`)?.value;
    const definitionId = field("definitionId");
    if (typeof definitionId !== "string") return state;
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const cost = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    const housing: HousingState = {
      definitionId,
      movedInWeek: field("movedInWeek") as number,
      ownership: field("ownership") as HousingState["ownership"],
      damage: field("damage") as number,
      weeklyCostCents: field("weeklyCostCents") as Cents,
      depositPaidCents: field("depositPaidCents") as Cents,
      rentDueWeek: field("rentDueWeek") as number,
      overdueRentCents: field("overdueRentCents") as Cents,
      missedPayments: field("missedPayments") as number,
      evictionStage: field("evictionStage") as HousingState["evictionStage"],
    };

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - (typeof cost === "number" ? cost : 0) },
        housing,
      },
    };
  },
};

/** Settles `HousingState.overdueRentCents` in full — the only cure for arrears
 *  `endOfWeek.ts`'s `financeReconcile` levies, all-or-nothing the same way `enroll_course`'s
 *  tuition is: no partial payment, since `HousingState` has no field to carry one. Nothing
 *  to pay (`overdueRentCents === 0`) is `requirement_unmet`, not a silent no-op success —
 *  the same "nothing to act on" reading `activeEnrollment`'s callers already give that
 *  code. */
export const payBillsResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "pay_bills")) return wrongLocationError();
    const owed = state.player.housing.overdueRentCents;
    if (owed === 0) return requirementUnmetError();
    if (state.player.finances.cashCents < owed) return insufficientFundsError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: 0, calculatedMoneyCostCents: owed };
  },
  calculate: (state, action): ActionOutcome => {
    const owed = state.player.housing.overdueRentCents;
    const cashBefore = state.player.finances.cashCents;
    const changes: StateChange[] = [
      { path: "player.finances.cashCents", op: "decrement", value: owed, previous: cashBefore, reason: "action_pay_bills", visible: true },
      { path: "player.housing.overdueRentCents", op: "set", value: 0, previous: owed, reason: "action_pay_bills", visible: true },
      { path: "player.housing.missedPayments", op: "set", value: 0, previous: state.player.housing.missedPayments, reason: "action_pay_bills", visible: true },
      { path: "player.housing.evictionStage", op: "set", value: "none", previous: state.player.housing.evictionStage, reason: "action_pay_bills", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const paid = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;
    if (typeof paid !== "number") return state;
    return {
      ...state,
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - paid },
        housing: { ...state.player.housing, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
      },
    };
  },
};

export const borrowMoneyResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "borrow_money")) return wrongLocationError();
    const amount = amountCentsParam(action);
    if (amount === undefined) return requirementUnmetError();
    if (wouldOverflow(state.player.finances.cashCents + amount, state.player.finances.debtCents + amount)) return requirementUnmetError();
    if (availableTimeUnits(state) < FINANCE_ACTION_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: FINANCE_ACTION_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const amount = amountCentsParam(action)!;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: FINANCE_ACTION_TIME_COST, reason: "action_borrow_money", visible: true },
      { path: "player.finances.cashCents", op: "increment", value: amount, previous: state.player.finances.cashCents, reason: "action_borrow_money", visible: true },
      { path: "player.finances.debtCents", op: "increment", value: amount, previous: state.player.finances.debtCents, reason: "action_borrow_money", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const amount = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;
    const next = {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
    };
    if (typeof amount !== "number") return next;
    return {
      ...next,
      player: { ...next.player, finances: { ...next.player.finances, cashCents: next.player.finances.cashCents + amount, debtCents: next.player.finances.debtCents + amount } },
    };
  },
};

export const repayDebtResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "repay_debt")) return wrongLocationError();
    const amount = amountCentsParam(action);
    if (amount === undefined) return requirementUnmetError();
    if (amount > state.player.finances.debtCents) return requirementUnmetError();
    if (state.player.finances.cashCents < amount) return insufficientFundsError();
    if (availableTimeUnits(state) < FINANCE_ACTION_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: FINANCE_ACTION_TIME_COST, calculatedMoneyCostCents: amount };
  },
  calculate: (state, action): ActionOutcome => {
    const amount = amountCentsParam(action)!;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: FINANCE_ACTION_TIME_COST, reason: "action_repay_debt", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: amount, previous: state.player.finances.cashCents, reason: "action_repay_debt", visible: true },
      { path: "player.finances.debtCents", op: "decrement", value: amount, previous: state.player.finances.debtCents, reason: "action_repay_debt", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const amount = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;
    const next = {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
    };
    if (typeof amount !== "number") return next;
    return {
      ...next,
      player: { ...next.player, finances: { ...next.player.finances, cashCents: next.player.finances.cashCents - amount, debtCents: next.player.finances.debtCents - amount } },
    };
  },
};

export const depositSavingsResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "deposit_savings")) return wrongLocationError();
    const amount = amountCentsParam(action);
    if (amount === undefined) return requirementUnmetError();
    if (wouldOverflow(state.player.finances.savingsCents + amount)) return requirementUnmetError();
    if (state.player.finances.cashCents < amount) return insufficientFundsError();
    if (availableTimeUnits(state) < FINANCE_ACTION_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: FINANCE_ACTION_TIME_COST, calculatedMoneyCostCents: amount };
  },
  calculate: (state, action): ActionOutcome => {
    const amount = amountCentsParam(action)!;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: FINANCE_ACTION_TIME_COST, reason: "action_deposit_savings", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: amount, previous: state.player.finances.cashCents, reason: "action_deposit_savings", visible: true },
      { path: "player.finances.savingsCents", op: "increment", value: amount, previous: state.player.finances.savingsCents, reason: "action_deposit_savings", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const amount = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;
    const next = {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
    };
    if (typeof amount !== "number") return next;
    return {
      ...next,
      player: { ...next.player, finances: { ...next.player.finances, cashCents: next.player.finances.cashCents - amount, savingsCents: next.player.finances.savingsCents + amount } },
    };
  },
};

const INVESTMENT_ACCOUNT_ID = "investment-primary";
/** Placeholder — no market-rate content type exists yet for a real return (`TODO.md`'s
 *  *Known Open Items*). */
const INVESTMENT_INTEREST_RATE: BasisPoints = 0;

/** The one money-movement resolver that needs a `FinancialAccount` rather than a scalar
 *  `FinancialState` field — `savingsCents`/`debtCents` are named fields `deposit_savings`/
 *  `repay_debt` (above) write directly; nothing analogous exists for an investment, so this
 *  is what `accounts` (§6.4) exists for. `apply` never needs `ctx`: every field the account
 *  carries is either a fixed constant or already derivable from `state`/`outcome.changes`,
 *  so unlike `move_housing` there is no content lookup to route around. */
export const investResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "invest")) return wrongLocationError();
    const amount = amountCentsParam(action);
    if (amount === undefined) return requirementUnmetError();
    const existingBalance = state.player.finances.accounts.find((a) => a.id === INVESTMENT_ACCOUNT_ID)?.balanceCents ?? 0;
    if (wouldOverflow(existingBalance + amount)) return requirementUnmetError();
    if (state.player.finances.cashCents < amount) return insufficientFundsError();
    if (availableTimeUnits(state) < FINANCE_ACTION_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: FINANCE_ACTION_TIME_COST, calculatedMoneyCostCents: amount };
  },
  calculate: (state, action): ActionOutcome => {
    const amount = amountCentsParam(action)!;
    const existing = state.player.finances.accounts.find((a) => a.id === INVESTMENT_ACCOUNT_ID);
    const balanceBefore = existing?.balanceCents ?? 0;
    const openedWeek = existing?.openedWeek ?? state.calendar.currentWeek;
    const accountPath = (field: string): string => `player.finances.accounts.${INVESTMENT_ACCOUNT_ID}.${field}`;
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: FINANCE_ACTION_TIME_COST, reason: "action_invest", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: amount, previous: state.player.finances.cashCents, reason: "action_invest", visible: true },
      { path: accountPath("kind"), op: "set", value: "investment", reason: "action_invest", visible: false },
      { path: accountPath("label"), op: "set", value: INVESTMENT_ACCOUNT_LABEL_KEY, reason: "action_invest", visible: false },
      { path: accountPath("interestRate"), op: "set", value: INVESTMENT_INTEREST_RATE, reason: "action_invest", visible: false },
      { path: accountPath("openedWeek"), op: "set", value: openedWeek, reason: "action_invest", visible: false },
      { path: accountPath("balanceCents"), op: "set", value: balanceBefore + amount, previous: balanceBefore, reason: "action_invest", visible: true },
    ];
    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const accountField = (field: string): unknown =>
      outcome.changes.find((c) => c.path === `player.finances.accounts.${INVESTMENT_ACCOUNT_ID}.${field}`)?.value;
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const amount = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;
    const next = {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
    };
    if (typeof amount !== "number") return next;

    const account: FinancialAccount = {
      id: INVESTMENT_ACCOUNT_ID,
      kind: accountField("kind") as FinancialAccount["kind"],
      label: accountField("label") as LocKey,
      balanceCents: accountField("balanceCents") as Cents,
      interestRate: accountField("interestRate") as BasisPoints,
      openedWeek: accountField("openedWeek") as number,
    };
    const accounts = next.player.finances.accounts.some((a) => a.id === INVESTMENT_ACCOUNT_ID)
      ? next.player.finances.accounts.map((a) => (a.id === INVESTMENT_ACCOUNT_ID ? account : a))
      : [...next.player.finances.accounts, account];

    return {
      ...next,
      player: { ...next.player, finances: { ...next.player.finances, cashCents: next.player.finances.cashCents - amount, accounts } },
    };
  },
};

/**
 * A real object literal, not `Object.fromEntries` over an array — a `Record<K, V>`
 * literal is what actually gives `ResolverTable`'s own exhaustiveness claim teeth.
 * Building this from an array and casting the result would silently accept a missing
 * key, exactly the "runtime surprise" §5.1 says this table exists to prevent at compile
 * time instead.
 */
export const RESOLVER_TABLE: ResolverTable = {
  work: workResolver,
  work_overtime: workOvertimeResolver,
  search_for_work: searchForWorkResolver,
  apply_for_job: applyForJobResolver,
  negotiate_job_terms: negotiateJobTermsResolver,
  attend_class: attendClassResolver,
  study: studyResolver,
  enroll_course: enrollCourseResolver,
  withdraw_course: withdrawCourseResolver,
  shop: stubResolver,
  eat: eatResolver,
  rest: restResolver,
  exercise: stubResolver,
  socialize: stubResolver,
  travel: stubResolver,
  maintain_item: stubResolver,
  repair_item: stubResolver,
  sell_item: stubResolver,
  pay_bills: payBillsResolver,
  borrow_money: borrowMoneyResolver,
  repay_debt: repayDebtResolver,
  deposit_savings: depositSavingsResolver,
  invest: investResolver,
  move_housing: moveHousingResolver,
  start_project: stubResolver,
  work_on_project: stubResolver,
  start_business: stubResolver,
  operate_business: stubResolver,
  accept_opportunity: stubResolver,
  decline_opportunity: stubResolver,
  respond_to_event: stubResolver,
};
