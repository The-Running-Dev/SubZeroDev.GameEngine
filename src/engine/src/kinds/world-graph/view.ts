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

/**
 * Every reason the `build` reducer would reject this definition **regardless of where it is
 * placed** (12 §10). Placement-dependent rejections — bounds, terrain, overlap,
 * reachability — are not knowable without `(x, y, rotation)` and are what `previewAction`
 * (§7) exists for.
 *
 * Exported because `availableActions` answers the same question about the verb, and two
 * copies of this predicate would be free to disagree with each other and with the reducer.
 */
export function buildBlockers(
  state: WorldGraphKindState,
  definition: CampaignShape["buildingDefinitions"][number],
): string[] {
  const blockedBy: string[] = [];

  if (definition.unlockAfterTick !== undefined && definition.unlockAfterTick > state.tick) {
    blockedBy.push("building_locked");
  }

  if (definition.costCents > state.finances.cashCents) {
    blockedBy.push("insufficient_funds");
  }

  if (definition.maxCount !== null) {
    const existing = state.buildings.filter((building) => building.definitionId === definition.id).length;
    if (existing >= definition.maxCount) {
      blockedBy.push("building_limit_reached");
    }
  }

  return blockedBy;
}

function buildOptions(state: WorldGraphKindState, campaign: CampaignShape): WorldGraphView["buildOptions"] {
  return campaign.buildingDefinitions.map((definition) => {
    const blockedBy = buildBlockers(state, definition);
    return {
      definitionId: definition.id,
      canBuild: blockedBy.length === 0,
      blockedBy,
    };
  });
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
    // From `assignedZoneId`; there is no second, derived membership field (12 §3.3).
    zoneId: member.assignedZoneId,
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
