/**
 * World-graph kind — projection (`project`) (12-world-graph-kind.md §10).
 */

import type { ProjectionAudience } from "../../core/projection/types.js";
import type { KindContext } from "../../core/kernel/types.js";
import type {
  WorldGraphKindState,
  WorldGraphView,
  Alert,
  Building,
  ObjectiveProgress,
} from "./state.js";
import type { WorldGraphCampaign as CampaignShape } from "./campaign.js";

function mapZones(map: WorldGraphKindState["map"]): readonly string[] {
  return map.zones.map((zone) => zone.id);
}

function buildOptions(state: WorldGraphKindState, campaign: CampaignShape): WorldGraphView["buildOptions"] {
  const options = campaign.buildingDefinitions.map((definition) => {
    const blockedBy: string[] = [];
    const locked = definition.unlockAfterTick !== undefined && definition.unlockAfterTick > state.tick;
    if (locked) {
      blockedBy.push("world-graph.reason.building_locked");
    }

    if (definition.costCents > state.finances.cashCents) {
      blockedBy.push("world-graph.reason.insufficient_funds");
    }

    return {
      definitionId: definition.id,
      canBuild: blockedBy.length === 0,
      blockedBy,
    };
  });

  return options;
}

function mapBuildings(buildings: readonly Building[]): WorldGraphView["buildings"] {
  return buildings.map((building) => ({
    id: building.id,
    definitionId: building.definitionId,
    isOpen: building.isOpen,
    status: building.status,
    queueLength: building.queue.guestIds.length,
    cleanliness: building.cleanliness,
    wear: building.wear,
  }));
}

function mapStaff(state: WorldGraphKindState): WorldGraphView["staff"] {
  return state.staff.map((member) => ({
    id: member.id,
    roleId: member.roleId,
    status: member.status,
    zoneId: member.zoneId,
    buildingId: member.assignedBuildingId,
  }));
}

function mapObjectives(objectives: readonly ObjectiveProgress[]): WorldGraphView["objectives"] {
  return objectives.map((objective) => ({
    id: objective.id,
    state: objective.state,
    value: objective.value,
    target: objective.target,
  }));
}

function mapAlerts(alerts: readonly Alert[]): WorldGraphView["alerts"] {
  return alerts
    .filter((alert) => alert.dismissedAtTick === null)
    .map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      titleKey: alert.titleKey,
      messageKey: alert.messageKey,
      issuedAtTick: alert.issuedAtTick,
    }));
}

function queuedGuests(state: WorldGraphKindState): number {
  return state.buildings.reduce((total, building) => total + building.queue.guestIds.length, 0);
}

export function project(
  state: WorldGraphKindState,
  _audience: ProjectionAudience,
  ctx: KindContext,
): WorldGraphView {
  const campaign = ctx.campaign.content as CampaignShape;

  return {
    tick: state.tick,
    finances: {
      cashCents: state.finances.cashCents,
      revenueTodayCents: state.finances.revenueTodayCents,
      expensesTodayCents: state.finances.expensesTodayCents,
    },
    map: {
      width: state.map.width,
      height: state.map.height,
      revision: state.map.revision,
      spawnPoints: state.map.spawnPoints,
      exits: state.map.exits,
      zones: mapZones(state.map),
      buildingCount: state.buildings.length,
      guestCount: state.guests.length,
      staffCount: state.staff.length,
    },
    buildOptions: buildOptions(state, campaign),
    buildings: mapBuildings(state.buildings),
    staff: mapStaff(state),
    objectives: mapObjectives(state.objectives),
    alerts: mapAlerts(state.alerts),
    queuedGuests: queuedGuests(state),
  };
}
