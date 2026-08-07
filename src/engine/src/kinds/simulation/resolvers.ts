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
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange, OutcomeMessage } from "../../core/kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { JobApplication } from "./actor.js";
import type { SimulationCampaign } from "./campaign.js";
import { evaluateSimulationCondition } from "./conditions.js";
import type { JobOpening, SimulationKindState } from "./state.js";
import type { Cents } from "./state.js";
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
  attend_class: stubResolver,
  study: stubResolver,
  enroll_course: stubResolver,
  withdraw_course: stubResolver,
  shop: stubResolver,
  eat: eatResolver,
  rest: restResolver,
  exercise: stubResolver,
  socialize: stubResolver,
  travel: stubResolver,
  maintain_item: stubResolver,
  repair_item: stubResolver,
  sell_item: stubResolver,
  pay_bills: stubResolver,
  borrow_money: stubResolver,
  repay_debt: stubResolver,
  deposit_savings: stubResolver,
  invest: stubResolver,
  move_housing: stubResolver,
  start_project: stubResolver,
  work_on_project: stubResolver,
  start_business: stubResolver,
  operate_business: stubResolver,
  accept_opportunity: stubResolver,
  decline_opportunity: stubResolver,
  respond_to_event: stubResolver,
};
