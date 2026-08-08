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
 *
 * **W56 adds the last seven**: `shop`, `maintain_item`, `repair_item`, `sell_item`, `travel`,
 * `socialize` and `exercise`. Four follow `enroll_course`'s addressing convention against a
 * natural key this contract already fixes (§6, *Addressing collection members*):
 * `player.inventory.<instanceId>.*` and `player.relationships.<npcId>.*`. `travel` and
 * `exercise` need no indirection — a location's `travelTimeUnits` and a fixed need delta are
 * the only inputs, and both recompute in `apply` from `state` plus the carried numbers.
 *
 * **An item's `ItemDefinition.effects` are attached by `endOfWeek.ts`'s `inventory` system,
 * not by `shop`.** `apply(state, outcome)` has no `ctx` (above), and a `StatusEffect`'s
 * `modifiers` is an *array of objects* — the scalar natural-key convention that carries
 * `JobOpening`/`CourseEnrollment`/`HousingState` through `outcome.changes` cannot address it.
 * The `inventory` system is the one place in the week pipeline holding both the item content
 * and the whole inventory, and §3 already gives it the slot; it therefore owns attachment and
 * detachment alike, so an effect appears the first end-of-week after purchase and lapses the
 * first end-of-week after `condition` reaches zero — one rule in both directions rather than
 * attach-immediately/detach-late.
 *
 * **`maintain_item` and `repair_item` are not the same action.** Maintenance is preventive:
 * it resets `weeksSinceMaintenance`, which is what stops `inventory`'s decay, and restores no
 * lost condition. Repair is corrective: it restores `condition` to full and clears `broken`,
 * and leaves the maintenance clock exactly where it was — a player who repairs without
 * maintaining decays again the very next week. Both read `MaintenanceRule`, and §7.5 declares
 * `maintenanceRules` as a *list* with no selection rule, so the **first listed** rule governs,
 * the same "listed order, first match" convention `advanceEmployment` already applies to
 * `promotionPaths`.
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange, OutcomeMessage } from "../../core/kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type {
  CourseEnrollment,
  FinancialAccount,
  HousingState,
  InventoryItem,
  JobApplication,
  NeedKey,
  RelationshipState,
} from "./actor.js";
import type { ItemDefinition, MaintenanceRule, NPCDefinition } from "./content.js";
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

// ---------------------------------------------------------------------------
// W56 — Possessions, Places, and People
// ---------------------------------------------------------------------------

const SHOP_TIME_COST = 1;
const REPAIR_TIME_COST = 2;
const SELL_TIME_COST = 1;
const SOCIALIZE_TIME_COST = 2;
const EXERCISE_TIME_COST = 2;

/** A bought item arrives undamaged and unmaintained; `shop` buys exactly one unit per
 *  action, since nothing in §4's action model carries a quantity for it to buy more. */
const NEW_ITEM_CONDITION = 100;
const NEW_ITEM_QUANTITY = 1;

/** Deterministic and unique without an `IdSource`: `GameAction.id` is already
 *  `action-<ctx.seq>` (`advance.ts`), so one purchase yields one instance id. Prefixed
 *  rather than reused verbatim so an inventory key is never mistaken for an action id, and
 *  never all-digits — §6's natural-key rule forbids a numeric path segment. */
function inventoryInstanceId(action: GameAction): string {
  return `inv-${action.id}`;
}

function findItemDefinition(campaign: SimulationCampaign, definitionId: string | undefined): ItemDefinition | undefined {
  return definitionId === undefined ? undefined : campaign.items.find((i) => i.id === definitionId);
}

function findInventoryItem(state: SimulationKindState, instanceId: string | undefined): InventoryItem | undefined {
  return instanceId === undefined ? undefined : state.player.inventory.find((i) => i.instanceId === instanceId);
}

/** §7.5 declares `maintenanceRules` as a list and names no selection rule — first listed
 *  governs, the same convention `advanceEmployment` applies to `promotionPaths`. Exported
 *  because `endOfWeek.ts`'s `inventory` decay must select the *same* rule this file's
 *  `maintain_item` services: a decay that summed every elapsed rule would charge condition
 *  for rules whose cost and interval no action can ever satisfy, and let one service clear
 *  all of them. One selection rule, one owner. */
export function governingMaintenanceRule(def: ItemDefinition | undefined): MaintenanceRule | undefined {
  return def?.maintenanceRules?.[0];
}

function instanceIdFromPath(path: string): string {
  return path.split(".")[2]!;
}

export const shopResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const def = findItemDefinition(campaign, action.targetId);
    if (!def) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "shop")) return wrongLocationError();
    for (const requirement of def.requirements) {
      if (!evaluateSimulationCondition(requirement.condition, state)) {
        return invalid(requirement.failureCode, requirement.messageKey);
      }
    }
    if (state.player.finances.cashCents < def.purchasePriceCents) return insufficientFundsError();
    if (availableTimeUnits(state) < SHOP_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: SHOP_TIME_COST, calculatedMoneyCostCents: def.purchasePriceCents };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const def = findItemDefinition(campaign, action.targetId)!;
    const base = `player.inventory.${inventoryInstanceId(action)}`;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: SHOP_TIME_COST, reason: "action_shop", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: def.purchasePriceCents, previous: state.player.finances.cashCents, reason: "action_shop", visible: true },
      { path: `${base}.definitionId`, op: "set", value: def.id, reason: "action_shop", visible: true },
      { path: `${base}.quantity`, op: "set", value: NEW_ITEM_QUANTITY, reason: "action_shop", visible: true },
      { path: `${base}.acquiredWeek`, op: "set", value: state.calendar.currentWeek, reason: "action_shop", visible: false },
      { path: `${base}.purchasePriceCents`, op: "set", value: def.purchasePriceCents, reason: "action_shop", visible: false },
      { path: `${base}.condition`, op: "set", value: NEW_ITEM_CONDITION, reason: "action_shop", visible: true },
      { path: `${base}.weeksSinceMaintenance`, op: "set", value: 0, reason: "action_shop", visible: false },
      { path: `${base}.broken`, op: "set", value: false, reason: "action_shop", visible: false },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const definitionChange = outcome.changes.find((c) => c.path.startsWith("player.inventory.") && c.path.endsWith(".definitionId"));
    if (!definitionChange) return state;
    const instanceId = instanceIdFromPath(definitionChange.path);
    const field = (name: string): unknown => outcome.changes.find((c) => c.path === `player.inventory.${instanceId}.${name}`)?.value;
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const price = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    const item: InventoryItem = {
      instanceId,
      definitionId: definitionChange.value as string,
      quantity: field("quantity") as number,
      acquiredWeek: field("acquiredWeek") as number,
      purchasePriceCents: field("purchasePriceCents") as Cents,
      condition: field("condition") as number,
      weeksSinceMaintenance: field("weeksSinceMaintenance") as number,
      broken: field("broken") === true,
    };

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - (typeof price === "number" ? price : 0) },
        inventory: [...state.player.inventory, item],
      },
    };
  },
};

export const maintainItemResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const item = findInventoryItem(state, action.targetId);
    if (!item) return requirementUnmetError();
    if (!locationAllows(state, campaign, "maintain_item")) return wrongLocationError();
    const rule = governingMaintenanceRule(findItemDefinition(campaign, item.definitionId));
    if (!rule) return requirementUnmetError();
    if (state.player.finances.cashCents < rule.costCents) return insufficientFundsError();
    if (availableTimeUnits(state) < rule.timeCost) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: rule.timeCost, calculatedMoneyCostCents: rule.costCents };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const item = findInventoryItem(state, action.targetId)!;
    const rule = governingMaintenanceRule(findItemDefinition(campaign, item.definitionId))!;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: rule.timeCost, reason: "action_maintain_item", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: rule.costCents, previous: state.player.finances.cashCents, reason: "action_maintain_item", visible: true },
      {
        path: `player.inventory.${item.instanceId}.weeksSinceMaintenance`, op: "set", value: 0,
        previous: item.weeksSinceMaintenance, reason: "action_maintain_item", visible: true,
      },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const change = outcome.changes.find((c) => c.path.startsWith("player.inventory.") && c.path.endsWith(".weeksSinceMaintenance"));
    if (!change) return state;
    const instanceId = instanceIdFromPath(change.path);
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const cost = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - (typeof cost === "number" ? cost : 0) },
        inventory: state.player.inventory.map((i) => (i.instanceId === instanceId ? { ...i, weeksSinceMaintenance: 0 } : i)),
      },
    };
  },
};

/** No §7.5 field prices a repair, so it is priced off what was actually lost: the share of
 *  the instance's own `purchasePriceCents` matching its missing condition. A placeholder
 *  formula, the same status every other unbalanced numeric rule in this file carries — but
 *  one derived entirely from stored state, so `apply` recomputes it without a lookup. */
function repairCostCents(item: InventoryItem): Cents {
  return Math.round((item.purchasePriceCents * (NEW_ITEM_CONDITION - item.condition)) / 100);
}

export const repairItemResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const item = findInventoryItem(state, action.targetId);
    if (!item) return requirementUnmetError();
    if (!locationAllows(state, campaign, "repair_item")) return wrongLocationError();
    if (item.condition >= NEW_ITEM_CONDITION && !item.broken) return requirementUnmetError();
    const cost = repairCostCents(item);
    if (state.player.finances.cashCents < cost) return insufficientFundsError();
    if (availableTimeUnits(state) < REPAIR_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: REPAIR_TIME_COST, calculatedMoneyCostCents: cost };
  },
  calculate: (state, action): ActionOutcome => {
    const item = findInventoryItem(state, action.targetId)!;
    const base = `player.inventory.${item.instanceId}`;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: REPAIR_TIME_COST, reason: "action_repair_item", visible: true },
      { path: "player.finances.cashCents", op: "decrement", value: repairCostCents(item), previous: state.player.finances.cashCents, reason: "action_repair_item", visible: true },
      { path: `${base}.condition`, op: "set", value: NEW_ITEM_CONDITION, previous: item.condition, reason: "action_repair_item", visible: true },
      { path: `${base}.broken`, op: "set", value: false, previous: item.broken, reason: "action_repair_item", visible: true },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const change = outcome.changes.find((c) => c.path.startsWith("player.inventory.") && c.path.endsWith(".condition"));
    if (!change) return state;
    const instanceId = instanceIdFromPath(change.path);
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const cost = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents - (typeof cost === "number" ? cost : 0) },
        inventory: state.player.inventory.map((i) =>
          (i.instanceId === instanceId ? { ...i, condition: change.value as number, broken: false } : i)),
      },
    };
  },
};

/** Resale is `baseResaleValueCents` scaled by the instance's own condition — a worn item is
 *  worth proportionally less — and then by `quantity`, because `sell_item` disposes of the
 *  whole instance. `InventoryItem.quantity` is genuinely `> 1` for a stacked starting
 *  possession (`ScenarioDefinition.startingInventory` carries a quantity per entry), so
 *  paying for one unit while removing all of them would silently discard the rest. Rounded
 *  per unit before multiplying, so the total stays integer `Cents` (§2) regardless of stack
 *  size. Placeholder balance, same caveat as `repairCostCents`. */
function resaleValueCents(def: ItemDefinition, item: InventoryItem): Cents {
  return Math.round((def.baseResaleValueCents * item.condition) / 100) * item.quantity;
}

/** Removing the instance is signalled by setting its `quantity` to zero rather than by a
 *  bespoke "removed" path: `quantity` is a real, addressable field of the record §6.10
 *  declares, and `apply` needs only the natural key it carries. The instance leaves
 *  `player.inventory` entirely — unlike a failed `CourseEnrollment`, nothing in §6.10 gives a
 *  sold possession a history record to stay in. `endOfWeek.ts`'s `inventory` system drops the
 *  matching `StatusEffect` on its next pass, the same way it drops one for a worn-out item. */
export const sellItemResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const item = findInventoryItem(state, action.targetId);
    if (!item) return requirementUnmetError();
    if (!locationAllows(state, campaign, "sell_item")) return wrongLocationError();
    const def = findItemDefinition(campaign, item.definitionId);
    if (!def) return requirementUnmetError();
    if (availableTimeUnits(state) < SELL_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: SELL_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const item = findInventoryItem(state, action.targetId)!;
    const def = findItemDefinition(campaign, item.definitionId)!;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: SELL_TIME_COST, reason: "action_sell_item", visible: true },
      { path: "player.finances.cashCents", op: "increment", value: resaleValueCents(def, item), previous: state.player.finances.cashCents, reason: "action_sell_item", visible: true },
      { path: `player.inventory.${item.instanceId}.quantity`, op: "set", value: 0, previous: item.quantity, reason: "action_sell_item", visible: true },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const change = outcome.changes.find((c) => c.path.startsWith("player.inventory.") && c.path.endsWith(".quantity"));
    if (!change) return state;
    const instanceId = instanceIdFromPath(change.path);
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    const proceeds = outcome.changes.find((c) => c.path === "player.finances.cashCents")?.value;

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: {
        ...state.player,
        finances: { ...state.player.finances, cashCents: state.player.finances.cashCents + (typeof proceeds === "number" ? proceeds : 0) },
        inventory: state.player.inventory.filter((i) => i.instanceId !== instanceId),
      },
    };
  },
};

/** §7.9's adjacency graph, literally: one hop, into a location the current one lists in
 *  `connections`, at that target's own `travelTimeUnits`. A target that exists but is not
 *  adjacent is `wrong_location`, the half of §10's own definition no earlier unit could
 *  reach — the other half (an action type absent from `actionTypes`) is `locationAllows`,
 *  which every resolver in this file already runs, `travel` included. */
export const travelResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const target = action.targetId === undefined ? undefined : campaign.locations.find((l) => l.id === action.targetId);
    if (!target) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "travel")) return wrongLocationError();
    const current = campaign.locations.find((l) => l.id === state.player.currentLocationId);
    if (!current?.connections.includes(target.id)) return wrongLocationError();
    if (availableTimeUnits(state) < target.travelTimeUnits) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: target.travelTimeUnits, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const target = campaign.locations.find((l) => l.id === action.targetId)!;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: target.travelTimeUnits, reason: "action_travel", visible: true },
      { path: "player.currentLocationId", op: "set", value: target.id, previous: state.player.currentLocationId, reason: "action_travel", visible: true },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const move = outcome.changes.find((c) => c.path === "player.currentLocationId");
    if (typeof move?.value !== "string") return state;
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;
    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, currentLocationId: move.value },
    };
  },
};

const SOCIALIZE_AFFINITY_GAIN = 5;
const SOCIALIZE_TRUST_GAIN = 2;

/** §7.7's `NPCDefinition` declares `initialRelationship` (the affective dimensions) but no
 *  `RelationshipState.category`, and no other §7 type supplies one. Every relationship this
 *  action opens is `"personal"` — a fixed engine default of exactly the kind `initial.ts`
 *  already records for `NeedState`'s starting values, not a guess dressed as content. */
const DEFAULT_RELATIONSHIP_CATEGORY: RelationshipState["category"] = "personal";

/** §7.7's `AvailabilityRule` is a list of *permissions*: an NPC is here when some rule
 *  admits this location, this week, and its own condition. An empty list constrains nothing,
 *  so such an NPC is available everywhere — the reading that makes `availability: []` mean
 *  "no restrictions" rather than "exists nowhere", which would make the field mandatory in
 *  all but name. */
function npcAvailableHere(npc: NPCDefinition, state: SimulationKindState): boolean {
  if (npc.availability.length === 0) return true;
  return npc.availability.some((rule) =>
    (rule.locationId === undefined || rule.locationId === state.player.currentLocationId)
    && (rule.fromWeek === undefined || state.calendar.currentWeek >= rule.fromWeek)
    && (rule.toWeek === undefined || state.calendar.currentWeek <= rule.toWeek)
    && (rule.condition === undefined || evaluateSimulationCondition(rule.condition, state)));
}

/** An NPC who isn't here is `requirement_unmet`, **not** `wrong_location`: §10 defines that
 *  code as exactly two things — an action type absent from `actionTypes`, or a `travel`
 *  target absent from `connections` — and an absent NPC is neither. `requirement_unmet` is
 *  the same "nothing to act on" reading `activeEnrollment`'s callers already give it.
 *
 *  **The affective dimensions are moved unclamped.** §6.2's `0–100` rule is stated over needs,
 *  skills, attributes and reputation; §6.11 declares `affinity`/`trust`/`respect`/`resentment`
 *  with no range at all, and an `"adversarial"` relationship is exactly the case a negative
 *  affinity exists to express. Clamping here would silently rewrite a campaign's authored
 *  `NPCDefinition.initialRelationship` on first contact — narrowing upstream never made, the
 *  same call `content.ts`'s `Reward` declines. That leaves repeated `socialize` unbounded
 *  upward, which is a balance question (there is no weekly relationship rule to pull it back
 *  yet either — `endOfWeek.ts`'s `relationships` stub) rather than a range this contract
 *  states and this resolver ignores. */
export const socializeResolver: ActionResolver = {
  canExecute: (state, action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    const npc = action.targetId === undefined ? undefined : campaign.npcs.find((n) => n.id === action.targetId);
    if (!npc) return invalid("unknown_action", "core.reason.unknown_action");
    if (!locationAllows(state, campaign, "socialize")) return wrongLocationError();
    if (!npcAvailableHere(npc, state)) return requirementUnmetError();
    if (availableTimeUnits(state) < SOCIALIZE_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: SOCIALIZE_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action, ctx): ActionOutcome => {
    const campaign = simulationCampaign(ctx);
    const npc = campaign.npcs.find((n) => n.id === action.targetId)!;
    const week = state.calendar.currentWeek;
    const existing = state.player.relationships.find((r) => r.npcId === npc.id);
    const before: RelationshipState = existing ?? {
      npcId: npc.id,
      category: DEFAULT_RELATIONSHIP_CATEGORY,
      ...npc.initialRelationship,
      knownSinceWeek: week,
      interactionCount: 0,
    };
    const base = `player.relationships.${npc.id}`;

    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: SOCIALIZE_TIME_COST, reason: "action_socialize", visible: true },
      { path: `${base}.category`, op: "set", value: before.category, reason: "action_socialize", visible: false },
      { path: `${base}.affinity`, op: "set", value: before.affinity + SOCIALIZE_AFFINITY_GAIN, previous: before.affinity, reason: "action_socialize", visible: true },
      { path: `${base}.trust`, op: "set", value: before.trust + SOCIALIZE_TRUST_GAIN, previous: before.trust, reason: "action_socialize", visible: true },
      { path: `${base}.respect`, op: "set", value: before.respect, reason: "action_socialize", visible: true },
      // Hidden dimension (§6.11) — carried so `apply` can rebuild the record, never shown.
      { path: `${base}.resentment`, op: "set", value: before.resentment, reason: "action_socialize", visible: false },
      { path: `${base}.knownSinceWeek`, op: "set", value: before.knownSinceWeek, reason: "action_socialize", visible: false },
      { path: `${base}.lastInteractionWeek`, op: "set", value: week, reason: "action_socialize", visible: true },
      { path: `${base}.interactionCount`, op: "set", value: before.interactionCount + 1, previous: before.interactionCount, reason: "action_socialize", visible: false },
    ];

    return {
      actionId: action.id, success: true, degree: "success", reason: "check_succeeded",
      changes, generatedEvents: [], generatedOpportunities: [], messages: [],
    };
  },
  apply: (state, outcome): SimulationKindState => {
    const affinityChange = outcome.changes.find((c) => c.path.startsWith("player.relationships.") && c.path.endsWith(".affinity"));
    if (!affinityChange) return state;
    const npcId = instanceIdFromPath(affinityChange.path);
    const field = (name: string): unknown => outcome.changes.find((c) => c.path === `player.relationships.${npcId}.${name}`)?.value;
    const spentDelta = outcome.changes.find((c) => c.path === "calendar.spentTimeUnits")?.value;

    const relationship: RelationshipState = {
      npcId,
      category: field("category") as RelationshipState["category"],
      affinity: affinityChange.value as number,
      trust: field("trust") as number,
      respect: field("respect") as number,
      resentment: field("resentment") as number,
      knownSinceWeek: field("knownSinceWeek") as number,
      lastInteractionWeek: field("lastInteractionWeek") as number,
      interactionCount: field("interactionCount") as number,
    };
    const relationships = state.player.relationships.some((r) => r.npcId === npcId)
      ? state.player.relationships.map((r) => (r.npcId === npcId ? relationship : r))
      : [...state.player.relationships, relationship];

    return {
      ...state,
      calendar: { ...state.calendar, spentTimeUnits: state.calendar.spentTimeUnits + (typeof spentDelta === "number" ? spentDelta : 0) },
      player: { ...state.player, relationships },
    };
  },
};

/** Costs energy and satiety, buys health, happiness and calm — the same fixed-delta,
 *  clamp-once shape `eat`/`rest` (W39) already use, and the same placeholder-numbers caveat.
 *  Iterated in sorted key order so the emitted `StateChange` sequence cannot depend on
 *  declaration order (§2's sorted-iteration rule), exactly as `endOfWeek.ts`'s `needs` drift
 *  does. */
const EXERCISE_NEED_DELTAS: Readonly<Record<NeedKey, number>> = {
  energy: -10,
  happiness: 3,
  health: 5,
  satiety: -5,
  stress: -5,
};

function exercisedNeeds(state: SimulationKindState): SimulationKindState["player"]["needs"] {
  const needs = { ...state.player.needs };
  for (const key of Object.keys(EXERCISE_NEED_DELTAS) as NeedKey[]) {
    needs[key] = clampNeed(needs[key] + EXERCISE_NEED_DELTAS[key]);
  }
  return needs;
}

export const exerciseResolver: ActionResolver = {
  canExecute: (state, _action, ctx): ActionValidation => {
    const campaign = simulationCampaign(ctx);
    if (!locationAllows(state, campaign, "exercise")) return wrongLocationError();
    if (availableTimeUnits(state) < EXERCISE_TIME_COST) return insufficientTimeError();
    return { valid: true, errors: [], warnings: [], calculatedTimeCost: EXERCISE_TIME_COST, calculatedMoneyCostCents: NO_MONEY_COST };
  },
  calculate: (state, action): ActionOutcome => {
    const after = exercisedNeeds(state);
    const changes: StateChange[] = [
      { path: "calendar.spentTimeUnits", op: "increment", value: EXERCISE_TIME_COST, reason: "action_exercise", visible: true },
    ];
    for (const key of (Object.keys(EXERCISE_NEED_DELTAS) as NeedKey[]).sort()) {
      const before = state.player.needs[key];
      if (after[key] === before) continue;
      changes.push({
        path: `player.needs.${key}`, op: "set", value: after[key], previous: before,
        reason: "action_exercise", visible: true,
      });
    }

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
      player: { ...state.player, needs: exercisedNeeds(state) },
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
  shop: shopResolver,
  eat: eatResolver,
  rest: restResolver,
  exercise: exerciseResolver,
  socialize: socializeResolver,
  travel: travelResolver,
  maintain_item: maintainItemResolver,
  repair_item: repairItemResolver,
  sell_item: sellItemResolver,
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
