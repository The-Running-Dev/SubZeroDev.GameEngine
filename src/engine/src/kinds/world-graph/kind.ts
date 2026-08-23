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
import { WORLD_GRAPH_REASON_CODES, WORLD_GRAPH_REASON_MESSAGES } from "./reasons.js";
import { availableActions, scene } from "./available.js";
import { initialState } from "./initial.js";
import { outcome } from "./outcome.js";
import { project } from "./view.js";
import { validateCampaign } from "./validate.js";

export const worldGraphKind: Kind<WorldGraphKindState> = {
  id: "world-graph",
  version: "1.0.0",
  reasonCodes: WORLD_GRAPH_REASON_CODES,
  reasonMessages: WORLD_GRAPH_REASON_MESSAGES,
  /** Every event the tick pipeline emits (12 §12; complete as of W87). */
  eventNames: [
    "kind.world-graph.building.placed",
    "kind.world-graph.building.demolished",
    "kind.world-graph.building.status.changed",
    "kind.world-graph.building.meter.changed",
    "kind.world-graph.construction.progressed",
    "kind.world-graph.construction.completed",
    "kind.world-graph.staff.hired",
    "kind.world-graph.staff.fired",
    "kind.world-graph.staff.assigned",
    "kind.world-graph.alert.dismissed",
    "kind.world-graph.alert.raised",
    "kind.world-graph.alert.cleared",
    "kind.world-graph.achievement.unlocked",
    "kind.world-graph.batch.started",
    "kind.world-graph.batch.ended",
    "kind.world-graph.scenario.effect.applied",
    "kind.world-graph.guest.spawned",
    "kind.world-graph.guest.served",
    "kind.world-graph.incident.resolved",
    "kind.world-graph.incident.raised",
    "kind.world-graph.tick.finalized",
    "kind.world-graph.guest.meter.changed",
    "kind.world-graph.service.started",
    "kind.world-graph.queue.joined",
    "kind.world-graph.queue.abandoned",
    "kind.world-graph.guest.intent.selected",
    "kind.world-graph.guest.path.committed",
    "kind.world-graph.guest.path.failed",
    "kind.world-graph.guest.moved",
    "kind.world-graph.guest.departed",
    "kind.world-graph.task.candidate.generated",
    "kind.world-graph.staff.task.assigned",
    "kind.world-graph.staff.task.completed",
    "kind.world-graph.staff.task.cancelled",
    "kind.world-graph.staff.moved",
    "kind.world-graph.finance.charged",
    "kind.world-graph.objective.progressed",
    "kind.world-graph.objective.met",
    "kind.world-graph.failure.progressed",
    "kind.world-graph.failure.triggered",
    "kind.world-graph.scenario.resolved",
  ],
  initialState: (campaign, ctx) => initialState(campaign, ctx),
  availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
  scene: (state): SceneBody => scene(state),
  advance: (state, actionId, params, ctx): AdvanceResult<WorldGraphKindState> => advance(state, actionId, params, ctx),
  project: (state, audience, ctx) => project(state, audience, ctx),
  validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
  outcome,
};
