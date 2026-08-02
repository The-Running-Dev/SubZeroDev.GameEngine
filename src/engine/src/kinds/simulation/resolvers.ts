/**
 * Simulation kind — resolver dispatch (10-simulation-kind.md §5.1, §5.3).
 *
 * Contract: `10-simulation-kind.md` §5.1, §5.3.
 *
 * `ResolverTable` is `Record<Exclude<ActionType, "custom">, ActionResolver>` — a missing
 * resolver is a compile error, not a runtime surprise (§5.1). Most entries are still
 * `stubResolver`, since most `ActionType`s need a content type (`JobDefinition`,
 * `CourseDefinition`, `ItemDefinition`, …) this unit deliberately doesn't wire (`plans/36`'s
 * W39 vertical slice: only enough real logic to prove a goal can be won and lost). `eat`
 * and `rest` are real — the two actions that give the player any way to counter `needs`
 * drift (`endOfWeek.ts`), without which no goal expressed over needs could ever be won.
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange, OutcomeMessage } from "../../core/kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { SimulationKindState, Cents } from "./state.js";
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

/**
 * A real object literal, not `Object.fromEntries` over an array — a `Record<K, V>`
 * literal is what actually gives `ResolverTable`'s own exhaustiveness claim teeth.
 * Building this from an array and casting the result would silently accept a missing
 * key, exactly the "runtime surprise" §5.1 says this table exists to prevent at compile
 * time instead.
 */
export const RESOLVER_TABLE: ResolverTable = {
  work: stubResolver,
  work_overtime: stubResolver,
  search_for_work: stubResolver,
  apply_for_job: stubResolver,
  negotiate_job_terms: stubResolver,
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
