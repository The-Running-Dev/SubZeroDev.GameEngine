/**
 * Simulation kind — `availableActions` (10-simulation-kind.md §4, §9; 04 §6).
 *
 * Contract: `10-simulation-kind.md` §4, §9; `04-core.md` §6.
 *
 * `AvailableAction` (04 §6) carries no parameter schema — the four verbs below are always
 * offered, with the domain those verbs' `params` draw from (which `ActionType`s, which plan
 * indices) carried in the projection instead (`view.ts`'s `SimulationView.plan`), the split
 * `world-graph` already uses (12 §7).
 *
 * **`end_week`'s `plan_empty` gate is wired here (W100).** `SimulationCampaign.
 * emptyPlanPolicy` (§7.11) now exists: while it is `"forbid"` and the current plan has no
 * actions, `end_week` reports `available: false`, the same advance notice
 * `event_response_pending` below already gives — `advance.ts` rejects it for real.
 *

 * **`end_week`'s `event_response_pending` gate (W94.1) is wired here.** While
 * `unaddressedPendingResponses` (`state.ts`) is non-empty, `end_week` reports `available:
 * false` — `advance.ts` rejects it for real; this is the projection's own advance notice.
 */

import type { AvailableAction, KindContext } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import { unaddressedPendingResponses } from "./state.js";

export function availableActions(state: SimulationKindState, ctx: KindContext): AvailableAction[] {
  const content = ctx.campaign.content as SimulationCampaign;
  const labels = content.actionLabelKeys;
  const blocked = unaddressedPendingResponses(state).length > 0;
  const emptyPlanForbidden = content.emptyPlanPolicy === "forbid" && (state.plan?.actions.length ?? 0) === 0;

  return [
    { id: "plan.add", labelKey: labels.planAdd, available: true },
    { id: "plan.remove", labelKey: labels.planRemove, available: true },
    { id: "plan.clear", labelKey: labels.planClear, available: true },
    { id: "end_week", labelKey: labels.endWeek, available: !blocked && !emptyPlanForbidden },
  ];
}
