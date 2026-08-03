import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import { dismissAlert } from "./actions/alerts.js";
import { setBuildingOpen, setPrice } from "./actions/building.js";
import { build, demolish } from "./actions/build.js";
import { rejected } from "./actions/common.js";
import { assignStaff, fireStaff, hireStaff } from "./actions/staff.js";
import type { WorldGraphKindState } from "./state.js";

/** W45 owns only immediate reducers. W46 replaces the deliberate `advance_ticks` guard. */
export function advance(
  state: WorldGraphKindState,
  actionId: string,
  params: ActionParams | undefined,
  ctx: KindContext,
): AdvanceResult<WorldGraphKindState> {
  if (state.resolution !== null) return rejected(state, "core.reason.session_ended");
  switch (actionId) {
    case "build": return build(state, params, ctx);
    case "demolish": return demolish(state, params, ctx);
    case "hire_staff": return hireStaff(state, params, ctx);
    case "fire_staff": return fireStaff(state, params, ctx);
    case "assign_staff": return assignStaff(state, params, ctx);
    case "set_price": return setPrice(state, params, ctx);
    case "open_building": return setBuildingOpen(state, params, ctx, true);
    case "close_building": return setBuildingOpen(state, params, ctx, false);
    case "dismiss_alert": return dismissAlert(state, params, ctx);
    case "advance_ticks": return rejected(state, "core.reason.action_not_available");
    default: return rejected(state, "core.reason.unknown_action");
  }
}
