/**
 * World-graph kind — `availableActions` and `scene` (12-world-graph-kind.md §7).
 */

import type { AvailableAction, KindContext, SceneBody } from "../../core/kernel/types.js";
import type { WorldGraphCampaign } from "./campaign.js";
import type { WorldGraphKindState } from "./state.js";

const WORLD_GRAPH_SCENE_KEY = "world-graph.scene.summary";

function anyAffordable(state: WorldGraphKindState, campaign: WorldGraphCampaign): boolean {
  if (campaign.buildingDefinitions.length === 0) {
    return false;
  }

  const minCost = Math.min(...campaign.buildingDefinitions.map((definition) => definition.costCents));
  return Number.isFinite(minCost) && minCost <= state.finances.cashCents;
}

function unlockedDefinitions(
  state: WorldGraphKindState,
  campaign: WorldGraphCampaign,
): Array<WorldGraphCampaign["buildingDefinitions"][number]> {
  return campaign.buildingDefinitions.filter(
    (definition) => definition.unlockAfterTick === undefined || definition.unlockAfterTick <= state.tick,
  );
}

function hasRoleCapacity(state: WorldGraphKindState, campaign: WorldGraphCampaign): boolean {
  return campaign.staffRoleDefinitions.some((role) => {
    if (role.maxCount === null) {
      return true;
    }

    const existing = state.staff.filter((member) => member.roleId === role.id).length;
    return existing < role.maxCount;
  });
}

function hasActiveAlerts(alerts: WorldGraphKindState["alerts"]): boolean {
  return alerts.some((alert) => alert.dismissedAtTick === null);
}

function action(
  id: string,
  available: boolean,
  reasonKey?: string,
): AvailableAction {
  return {
    id,
    labelKey: WORLD_GRAPH_SCENE_KEY,
    available,
    ...(reasonKey === undefined ? {} : { reasonKey }),
  };
}

export function availableActions(state: WorldGraphKindState, ctx: KindContext): AvailableAction[] {
  const campaign = ctx.campaign.content as WorldGraphCampaign;
  const unlocked = unlockedDefinitions(state, campaign);
  const buildAffordable = unlocked.length > 0 && anyAffordable(state, campaign);
  const buildAvailableReason = unlocked.length === 0
    ? "world-graph.reason.building_locked"
    : buildAffordable
      ? undefined
      : "world-graph.reason.insufficient_funds";

  return [
    action("build", buildAffordable || unlocked.length === 0 ? false : true, buildAvailableReason),
    action("demolish", state.buildings.length > 0, state.buildings.length > 0 ? undefined : "world-graph.reason.unknown_entity"),
    action("hire_staff", hasRoleCapacity(state, campaign), hasRoleCapacity(state, campaign) ? undefined : "world-graph.reason.staff_limit_reached"),
    action("fire_staff", state.staff.length > 0, state.staff.length > 0 ? undefined : "world-graph.reason.unknown_entity"),
    action(
      "assign_staff",
      state.staff.length > 0 && (state.buildings.length > 0 || state.staff.some((member) => member.assignedBuildingId !== null || member.assignedZoneId !== null)),
      state.staff.length > 0 ? undefined : "world-graph.reason.unknown_entity",
    ),
    action(
      "set_price",
      state.buildings.some((building) => building.products.length > 0),
      state.buildings.some((building) => building.products.length > 0) ? undefined : "world-graph.reason.unknown_entity",
    ),
    action("open_building", state.buildings.some((building) => !building.isOpen), state.buildings.some((building) => !building.isOpen) ? undefined : "world-graph.reason.unknown_entity"),
    action("close_building", state.buildings.some((building) => building.isOpen), state.buildings.some((building) => building.isOpen) ? undefined : "world-graph.reason.unknown_entity"),
    action("dismiss_alert", hasActiveAlerts(state.alerts), hasActiveAlerts(state.alerts) ? undefined : "world-graph.reason.unknown_entity"),
    action("advance_ticks", campaign.maxAdvanceTicksPerAction > 0, campaign.maxAdvanceTicksPerAction > 0 ? undefined : "world-graph.reason.tick_limit_reached"),
  ];
}

export function scene(state: WorldGraphKindState): SceneBody {
  const objectives = state.objectives
    .map((objective) => `${objective.id}:${objective.state}`)
    .join(", ");

  return {
    textKey: WORLD_GRAPH_SCENE_KEY,
    text: `Tick ${state.tick} • cash ${(state.finances.cashCents / 100).toFixed(2)} • buildings ${state.buildings.length} • staff ${state.staff.length} • objectives ${objectives}`,
  };
}
