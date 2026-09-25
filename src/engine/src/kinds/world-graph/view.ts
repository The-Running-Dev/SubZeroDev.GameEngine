import type { ReasonCode } from "../../core/kernel/reasons.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { ProjectionAudience } from "../../core/projection/types.js";
import { buildBlockers } from "./actions/build.js";
import { worldGraphContent, type BuildingDefinition, type ScenarioDefinition, type StaffRoleDefinition, type WorldGraphCampaign } from "./content.js";
import type {
  Position,
  WorldGraphKindState,
  WorldGraphView,
  WorldGraphViewMeterDefinition,
  WorldGraphViewValue,
} from "./state.js";

const comparePosition = (a: Position, b: Position): number => a.y - b.y || a.x - b.x;
const byId = <T extends { id: string }>(a: T, b: T): number => a.id.localeCompare(b.id);
const byDefinitionId = <T extends { definitionId: string }>(a: T, b: T): number => a.definitionId.localeCompare(b.definitionId);
const numericAscending = (a: number, b: number): number => a - b;

// Mirrors `hireStaff`'s rejection checks in `actions/staff.ts` (not in this slice's `Touches`).
function staffBlockers(state: WorldGraphKindState, definition: StaffRoleDefinition, currentScenario: ScenarioDefinition): ReasonCode[] {
  const blockers: ReasonCode[] = [];
  const limit = currentScenario.staffLimits.find((entry) => entry.definitionId === definition.id)?.maximum;
  if (limit !== undefined && state.staff.filter((entry) => entry.roleId === definition.id).length >= limit) blockers.push("staff_limit_reached");
  if (definition.hireCostCents > state.finances.cashCents) blockers.push("insufficient_funds");
  return blockers;
}

function buildOperationView(definition: BuildingDefinition): WorldGraphView["buildOptions"][number]["operation"] {
  const operation = definition.operation;
  if (operation.kind === "service") {
    return {
      kind: "service",
      products: [...operation.products]
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map(({ productId, serviceTicks, initialUnits, capacity }) => ({ productId, serviceTicks, initialUnits, capacity })),
      queueMaxLength: operation.queueMaxLength,
      baseServiceTicks: operation.baseServiceTicks,
      staffRequirements: [...operation.staffRequirements].sort((a, b) => a.roleId.localeCompare(b.roleId)),
    };
  }
  if (operation.kind === "waste") return { kind: "waste", capacity: operation.capacity };
  if (operation.kind === "decorative") return { kind: "decorative" };
  return { kind: "support", generatedTaskKinds: operation.generatedTaskKinds };
}

function recordToValues(record: Readonly<Record<string, number>>): WorldGraphViewValue[] {
  return Object.entries(record)
    .map(([definitionId, value]) => ({ definitionId, value }))
    .sort(byDefinitionId);
}

export function project(state: WorldGraphKindState, _audience: ProjectionAudience, ctx: KindContext): WorldGraphView {
  const content: WorldGraphCampaign = worldGraphContent(ctx.campaign.content);
  const scenario = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!scenario) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
  const map = content.maps.find((entry) => entry.id === scenario.mapId);
  if (!map) throw new Error(`Validated world-graph map missing: ${scenario.mapId}`);

  const usedTerrainIds = new Set(state.map.terrain.map((cell) => cell.terrainId));
  const usedSceneryIds = new Set(state.map.scenery.map((entry) => entry.definitionId));
  const referencedProductIds = new Set(
    content.buildings.flatMap((entry) => (entry.operation.kind === "service" ? entry.operation.products.map((product) => product.productId) : [])),
  );
  const poolArchetypeIds = new Set(scenario.guestSpawning.pool.map((entry) => entry.archetypeId));
  const reachableArchetypes = content.guestArchetypes.filter((entry) => poolArchetypeIds.has(entry.id));
  const referencedNeedIds = new Set(reachableArchetypes.flatMap((entry) => entry.needs.map((need) => need.needId)));
  const referencedConditionIds = new Set(reachableArchetypes.flatMap((entry) => entry.conditions.map((condition) => condition.definitionId)));
  const referencedOpinionIds = new Set(reachableArchetypes.flatMap((entry) => entry.opinions.map((opinion) => opinion.definitionId)));
  const unresolvedIncidentDefinitionIds = new Set(
    state.incidents.filter((entry) => entry.resolvedAtTick === null).map((entry) => entry.definitionId),
  );

  const meters: WorldGraphViewMeterDefinition[] = [
    ...content.needs.filter((entry) => referencedNeedIds.has(entry.id)).map((entry) => ({
      id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
      kind: "need" as const, minimum: entry.minimum, maximum: entry.maximum,
      criticalBelow: entry.criticalBelow, satisfiedAtOrAbove: entry.satisfiedAtOrAbove,
    })),
    ...content.guestConditions.filter((entry) => referencedConditionIds.has(entry.id)).map((entry) => ({
      id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
      kind: "condition" as const, minimum: entry.minimum, maximum: entry.maximum,
    })),
    ...content.opinions.filter((entry) => referencedOpinionIds.has(entry.id)).map((entry) => ({
      id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
      kind: "opinion" as const, minimum: entry.minimum, maximum: entry.maximum, neutral: entry.neutral,
    })),
  ].sort(byId);

  return {
    tick: state.tick,
    finances: {
      cashCents: state.finances.cashCents,
      revenueTodayCents: state.finances.revenueTodayCents,
      expensesTodayCents: state.finances.expensesTodayCents,
      revenueTotalCents: state.finances.revenueTotalCents,
      expensesTotalCents: state.finances.expensesTotalCents,
    },

    scenario: {
      id: scenario.id, nameKey: scenario.text.nameKey, descriptionKey: scenario.text.descriptionKey,
      mapId: scenario.mapId, ticksPerDay: content.ticksPerDay, maxTicksPerAction: content.maxTicksPerAction,
      timeLimitTicks: scenario.timeLimitTicks,
    },

    definitions: {
      terrain: content.terrain.filter((entry) => usedTerrainIds.has(entry.id)).map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
        walkable: entry.walkable, buildable: entry.buildable, moveCost: entry.moveCost,
      })).sort(byId),
      scenery: content.scenery.filter((entry) => usedSceneryIds.has(entry.id)).map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
        footprint: entry.footprint, allowedRotations: [...entry.allowedRotations].sort(numericAscending),
      })).sort(byId),
      products: content.products.filter((entry) => referencedProductIds.has(entry.id)).map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
        unitCostCents: entry.unitCostCents, price: entry.price,
      })).sort(byId),
      guestArchetypes: reachableArchetypes.map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
      })).sort(byId),
      meters,
      objectives: content.objectives.filter((entry) => scenario.objectiveIds.includes(entry.id)).map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
      })).sort(byId),
      incidents: content.incidents.filter((entry) => unresolvedIncidentDefinitionIds.has(entry.id)).map((entry) => ({
        id: entry.id, nameKey: entry.text.nameKey, descriptionKey: entry.text.descriptionKey,
        kind: entry.kind, severity: entry.severity,
      })).sort(byId),
    },

    map: {
      id: map.id, nameKey: map.text.nameKey, descriptionKey: map.text.descriptionKey,
      width: state.map.width, height: state.map.height, revision: state.map.revision,
      terrain: [...state.map.terrain].sort(comparePosition),
      paths: [...state.map.paths].sort((a, b) => comparePosition(a.from, b.from) || comparePosition(a.to, b.to)),
      zones: [...state.map.zones].map((zone) => ({ ...zone, cells: [...zone.cells].sort(comparePosition) })).sort(byId),
      spawnPoints: [...state.map.spawnPoints].sort(comparePosition),
      exits: [...state.map.exits].sort(comparePosition),
      scenery: [...state.map.scenery].sort(byId),
      buildingCount: state.buildings.length,
      guestCount: state.guests.length,
      staffCount: state.staff.length,
    },

    buildOptions: [...content.buildings].sort(byId).map((definition) => {
      const blockedBy = buildBlockers(state, definition, scenario);
      return {
        id: definition.id, nameKey: definition.text.nameKey, descriptionKey: definition.text.descriptionKey,
        footprint: definition.footprint, allowedRotations: [...definition.allowedRotations].sort(numericAscending),
        constructionCostCents: definition.constructionCostCents, operatingCostCentsPerDay: definition.operatingCostCentsPerDay,
        operation: buildOperationView(definition),
        canBuild: blockedBy.length === 0, blockedBy,
      };
    }),
    staffOptions: [...content.staffRoles].sort(byId).map((definition) => {
      const blockedBy = staffBlockers(state, definition, scenario);
      return {
        id: definition.id, nameKey: definition.text.nameKey, descriptionKey: definition.text.descriptionKey,
        hireCostCents: definition.hireCostCents, wageCentsPerDay: definition.wageCentsPerDay,
        supportedTaskKinds: definition.supportedTaskKinds,
        canHire: blockedBy.length === 0, blockedBy,
      };
    }),

    buildings: [...state.buildings].sort(byId).map((building) => ({
      id: building.id, definitionId: building.definitionId,
      x: building.x, y: building.y, width: building.width, height: building.height, rotation: building.rotation,
      status: building.status, queue: building.queue,
      prices: Object.entries(building.pricesCents).map(([productId, priceCents]) => ({ productId, priceCents })).sort((a, b) => a.productId.localeCompare(b.productId)),
      inventory: Object.entries(building.inventory).map(([productId, units]) => ({ productId, units })).sort((a, b) => a.productId.localeCompare(b.productId)),
      cleanliness: building.cleanliness, wear: building.wear,
    })),

    constructionSites: [...state.constructionSites].sort(byId),

    guests: [...state.guests].sort(byId).map((guest) => ({
      id: guest.id, archetypeId: guest.archetypeId, lifecycle: guest.lifecycle,
      x: guest.x, y: guest.y, cashCents: guest.cashCents, intent: guest.intent,
      needs: recordToValues(guest.needs), conditions: recordToValues(guest.conditions), opinions: recordToValues(guest.opinions),
      satisfaction: guest.satisfaction, patienceCapacityTicks: guest.patienceCapacityTicks, patienceRemainingTicks: guest.patienceRemainingTicks,
    })),

    staff: [...state.staff].sort(byId).map((member) => ({
      id: member.id, roleId: member.roleId, status: member.status, x: member.x, y: member.y,
      assignedZoneId: member.assignedZoneId, assignedBuildingId: member.assignedBuildingId,
      task: member.task, tasksCompleted: member.tasksCompleted,
    })),

    incidents: state.incidents.filter((entry) => entry.resolvedAtTick === null).sort(byId),
    objectives: [...state.objectives].sort(byId).map(({ id, state: objectiveState, value, target }) => ({ id, state: objectiveState, value, target })),
    alerts: state.alerts
      .filter((alert) => alert.dismissedAtTick === null && alert.clearedAtTick === null)
      .sort(byId)
      .map(({ id, type, severity, titleKey, messageKey, entityId, issuedAtTick }) => ({ id, type, severity, titleKey, messageKey, entityId, issuedAtTick })),
    queuedGuests: state.buildings.reduce((sum, building) => sum + building.queue.guestIds.length, 0),
  };
}
