import type { KindContext } from "../../core/kernel/types.js";
import type { ProjectionAudience } from "../../core/projection/types.js";
import { buildBlockers } from "./actions/build.js";
import { worldGraphContent } from "./content.js";
import type { WorldGraphKindState, WorldGraphView } from "./state.js";

export function project(state: WorldGraphKindState, _audience: ProjectionAudience, ctx: KindContext): WorldGraphView {
  const content = worldGraphContent(ctx.campaign.content);
  const scenario = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!scenario) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
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
      zones: state.map.zones.map((entry) => entry.id),
      buildingCount: state.buildings.length,
      guestCount: state.guests.length,
      staffCount: state.staff.length,
    },
    buildOptions: content.buildings.map((definition) => {
      const blockedBy = buildBlockers(state, definition, scenario);
      return { definitionId: definition.id, canBuild: blockedBy.length === 0, blockedBy };
    }),
    buildings: state.buildings.map((building) => ({
      id: building.id,
      definitionId: building.definitionId,
      status: building.status,
      queueLength: building.queue.guestIds.length,
      cleanliness: building.cleanliness,
      wear: building.wear,
    })),
    staff: state.staff.map((member) => ({
      id: member.id,
      roleId: member.roleId,
      status: member.status,
      zoneId: member.assignedZoneId,
      buildingId: member.assignedBuildingId,
    })),
    objectives: state.objectives.map(({ id, state: objectiveState, value, target }) => ({ id, state: objectiveState, value, target })),
    alerts: state.alerts
      .filter((alert) => alert.dismissedAtTick === null && alert.clearedAtTick === null)
      .map(({ id, type, severity, titleKey, messageKey, issuedAtTick }) => ({ id, type, severity, titleKey, messageKey, issuedAtTick })),
    queuedGuests: state.buildings.reduce((sum, building) => sum + building.queue.guestIds.length, 0),
  };
}
