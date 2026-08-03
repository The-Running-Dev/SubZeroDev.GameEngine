/**
 * World-graph kind assembly (`Kind` seam object).
 *
 * This is the production kind object every host imports.
 */

import type {
  AdvanceResult,
  AvailableAction,
  Kind,
  SceneBody,
} from "../../core/kernel/types.js";
import { advance } from "./advance.js";
import type { WorldGraphKindState } from "./state.js";
import { WORLD_GRAPH_REASON_CODES } from "./reasons.js";
import { availableActions, scene } from "./available.js";
import { initialState } from "./initial.js";
import { outcome } from "./outcome.js";
import { project } from "./view.js";
import { validateCampaign } from "./validate.js";

export const worldGraphKind: Kind<WorldGraphKindState> = {
  id: "world-graph",
  version: "1.0.0",
  reasonCodes: WORLD_GRAPH_REASON_CODES,
  /** W45 declares only immediate-action events it can actually emit. */
  eventNames: [
    "kind.world-graph.building.placed",
    "kind.world-graph.building.demolished",
    "kind.world-graph.building.status.changed",
    "kind.world-graph.staff.hired",
    "kind.world-graph.staff.fired",
    "kind.world-graph.staff.assigned",
    "kind.world-graph.alert.dismissed",
  ],
  initialState: (campaign, ctx) => initialState(campaign, ctx),
  availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
  scene: (state): SceneBody => scene(state),
  advance: (state, actionId, params, ctx): AdvanceResult<WorldGraphKindState> => advance(state, actionId, params, ctx),
  project: (state, audience, ctx) => project(state, audience, ctx),
  validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
  outcome,
};
