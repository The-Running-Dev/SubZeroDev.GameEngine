/**
 * Simulation kind — action types and the weekly plan (10-simulation-kind.md §4.1, §4.2).
 *
 * Contract: `10-simulation-kind.md` §4, §4.1, §4.2.
 *
 * `addAction`/`removeAction`/`clearPlan` are standalone pure functions, not `Kind<KState>`
 * methods — no wiring into `Kind.advance`/`kernel/engine.ts` yet, matching W9's own
 * `applyConsequences` precedent (`plans/16-w9-variables-and-consequences.md`). That's the
 * next unit's job, once `end_week`'s resolution pipeline exists to call these from.
 *
 * `removeAction`'s rejection code is cataloged in `reasons.ts`, not hardcoded here —
 * mirroring `kinds/story-graph/reasons.ts`'s own pattern from the first unit that needed
 * a real reason code, not held back until `Kind.reasonCodes` itself is assembled.
 */

import type { CommandResult } from "../../core/kernel/reasons.js";
import type { SimulationReasonCode } from "./reasons.js";

const ACTION_NOT_PLANNED: SimulationReasonCode = "action_not_planned";

/** Single source of truth for `ActionType` — a `plan.add` whose `actionType` param isn't
 *  in this list must be rejected before it can reach `RESOLVER_TABLE`, which has no entry
 *  for anything outside the union (`isActionType` below is what enforces that). */
export const ACTION_TYPES = [
  "work", "work_overtime",
  "search_for_work", "apply_for_job", "negotiate_job_terms",
  "attend_class", "study", "enroll_course", "withdraw_course",
  "shop", "eat", "rest", "exercise", "socialize", "travel",
  "maintain_item", "repair_item", "sell_item",
  "pay_bills", "borrow_money", "repay_debt", "deposit_savings", "invest",
  "move_housing",
  "start_project", "work_on_project",
  "start_business", "operate_business",
  "accept_opportunity", "decline_opportunity",
  "respond_to_event",
  "custom",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

export interface GameAction {
  id: string;
  type: ActionType;
  /** `"player"` or a rival's agent id. */
  actorId: string;

  targetId?: string;
  parameters: Record<string, unknown>;
}

export interface WeeklyActionPlan {
  readonly week: number;
  readonly actions: readonly GameAction[];
}

/** Always succeeds — §4's action table names no rejection case for `plan.add`. Appends
 *  to the end; order is the order actions will resolve in during `end_week`. */
export function addAction(plan: WeeklyActionPlan, action: GameAction): WeeklyActionPlan {
  return { week: plan.week, actions: [...plan.actions, action] };
}

/** Rejects an out-of-range `index` with `action_not_planned` — a genuine runtime
 *  rejection a validated campaign can still produce during ordinary play (a stale client
 *  index after a concurrent edit), not a content bug that throws (§10). */
export function removeAction(plan: WeeklyActionPlan, index: number): CommandResult<WeeklyActionPlan> {
  if (!Number.isInteger(index) || index < 0 || index >= plan.actions.length) {
    return {
      ok: false,
      errors: [{ code: ACTION_NOT_PLANNED, messageKey: `simulation.reason.${ACTION_NOT_PLANNED}` }],
      warnings: [],
    };
  }
  const actions = plan.actions.slice(0, index).concat(plan.actions.slice(index + 1));
  return { ok: true, value: { week: plan.week, actions }, errors: [], warnings: [] };
}

/** Always succeeds — empties the plan, keeps `week` unchanged. */
export function clearPlan(plan: WeeklyActionPlan): WeeklyActionPlan {
  return { week: plan.week, actions: [] };
}
