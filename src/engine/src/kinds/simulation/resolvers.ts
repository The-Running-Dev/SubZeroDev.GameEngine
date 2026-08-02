/**
 * Simulation kind — resolver dispatch (10-simulation-kind.md §5.1, §5.3).
 *
 * Contract: `10-simulation-kind.md` §5.1, §5.3.
 *
 * `ResolverTable` is `Record<Exclude<ActionType, "custom">, ActionResolver>` — a missing
 * resolver is a compile error, not a runtime surprise (§5.1). Every entry here is
 * `stubResolver`, the same one, reused: no `ActionType` has real per-action game logic
 * yet, since almost every one needs a content type (`JobDefinition`, `CourseDefinition`,
 * `ItemDefinition`, …) that doesn't exist until the content-definition-types build unit.
 * This proves the dispatch table's exhaustiveness now — every `ActionType` really does
 * have an entry, and TypeScript enforces it stays that way as the union grows — without
 * inventing 29 distinct implementations that would all do the same nothing.
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
  eat: stubResolver,
  rest: stubResolver,
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
