import type { AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import type { ReasonCode } from "../../../core/kernel/reasons.js";
import { worldGraphContent, type BuildingDefinition, type ScenarioDefinition } from "../content.js";
import { canonicalPathWithCost, checkBuildingPlacement } from "../spatial.js";
import type { Building, ConstructionSite, Guest, WorldGraphKindState } from "../state.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import { accepted, change, emit, integerParam, params, rejected, spend, stringParam } from "./common.js";

function scenario(ctx: KindContext): ScenarioDefinition {
  const content = worldGraphContent(ctx.campaign.content);
  const value = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!value) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
  return value;
}

function definitionState(content: ReturnType<typeof worldGraphContent>, definition: BuildingDefinition) {
  if (definition.operation.kind !== "service") return { pricesCents: {}, inventory: {} };
  return {
    pricesCents: Object.fromEntries(definition.operation.products.map((service) => {
      const product = content.products.find((entry) => entry.id === service.productId);
      if (!product) throw new Error(`Validated world-graph product missing: ${service.productId}`);
      return [service.productId, product.price.defaultCents];
    })),
    inventory: Object.fromEntries(definition.operation.products.map((service) => [service.productId, service.initialUnits])),
  };
}

export function buildBlockers(state: WorldGraphKindState, definition: BuildingDefinition, currentScenario: ScenarioDefinition): ReasonCode[] {
  const blockers: ReasonCode[] = [];
  const unlocked = state.unlockedContent.some((entry) => entry.kind === "building" && entry.id === definition.id);
  if (!unlocked) blockers.push("building_locked");
  if (definition.constructionCostCents > state.finances.cashCents) blockers.push("insufficient_funds");
  const limit = currentScenario.buildingLimits.find((entry) => entry.definitionId === definition.id)?.maximum;
  const count = state.buildings.filter((entry) => entry.definitionId === definition.id).length
    + state.constructionSites.filter((entry) => entry.definitionId === definition.id).length;
  if (limit !== undefined && count >= limit) blockers.push("building_limit_reached");
  return blockers;
}

export function build(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  if (!values) return rejected(state, "core.reason.unknown_action");
  const definitionId = stringParam(values, "definitionId");
  const x = integerParam(values, "x");
  const y = integerParam(values, "y");
  const rotation = integerParam(values, "rotation");
  if (definitionId === null || x === null || y === null || ![0, 90, 180, 270].includes(rotation ?? -1)) return rejected(state, "core.reason.unknown_action");
  const content = worldGraphContent(ctx.campaign.content);
  const definition = content.buildings.find((entry) => entry.id === definitionId);
  if (!definition) return rejected(state, "unknown_entity");
  const currentScenario = scenario(ctx);
  const blocker = buildBlockers(state, definition, currentScenario)[0];
  if (blocker) return rejected(state, blocker);
  if (!definition.allowedRotations.includes(rotation as 0 | 90 | 180 | 270)) return rejected(state, "placement_terrain_unsuitable");
  const placement = checkBuildingPlacement(state.map, content.terrain, definition, x, y, rotation as 0 | 90 | 180 | 270, state.buildings, state.constructionSites);
  if (!placement.ok) return rejected(state, placement.reason);

  const ordinal = state.nextEntityOrdinal;
  const nextMap = { ...state.map, revision: state.map.revision + 1 };
  const finances = spend(state, definition.constructionCostCents);
  if (definition.constructionWork === 0) {
    const buildingId = `building:${ordinal}`;
    const queueId = `queue:${ordinal + 1}`;
    const runtime: Building = {
      id: buildingId, definitionId, x, y, width: placement.width, height: placement.height,
      rotation: rotation as 0 | 90 | 180 | 270, status: "open", buildStartTick: state.tick,
      wear: definition.initialWear, cleanliness: definition.initialCleanliness,
      queue: { id: queueId, guestIds: [], serviceStartedAtTick: null },
      ...definitionState(content, definition),
    };
    const next = { ...state, map: nextMap, finances, buildings: [...state.buildings, runtime], nextEntityOrdinal: ordinal + 2 };
    emit(ctx, WORLD_GRAPH_EVENTS.buildingPlaced, { buildingId });
    return accepted(next, [
      change("finances.cashCents", finances.cashCents, "building_placed", true, state.finances.cashCents),
      change("map.revision", nextMap.revision, "building_placed", false, state.map.revision),
      change(`buildings.${buildingId}.exists`, true, "building_placed", false),
    ]);
  }

  const siteId = `construction-site:${ordinal}`;
  const site: ConstructionSite = {
    id: siteId, definitionId, x, y, width: placement.width, height: placement.height,
    rotation: rotation as 0 | 90 | 180 | 270, startedAtTick: state.tick,
    workRemaining: definition.constructionWork,
    completedBuildingId: `building:${ordinal + 1}`,
    completedQueueId: `queue:${ordinal + 2}`,
  };
  const next = { ...state, map: nextMap, finances, constructionSites: [...state.constructionSites, site], nextEntityOrdinal: ordinal + 3 };
  return accepted(next, [
    change("finances.cashCents", finances.cashCents, "construction_started", true, state.finances.cashCents),
    change("map.revision", nextMap.revision, "construction_started", false, state.map.revision),
    change(`constructionSites.${siteId}.exists`, true, "construction_started", false),
  ]);
}

function nearestReachableExit(
  state: WorldGraphKindState,
  terrain: ReturnType<typeof worldGraphContent>["terrain"],
  guest: Guest,
  remainingBuildings: readonly Building[],
): WorldGraphKindState["map"]["exits"][number] {
  const candidates = state.map.exits.flatMap((exit) => {
    const route = canonicalPathWithCost(state.map, terrain, guest, [exit], remainingBuildings, state.constructionSites);
    return route === null ? [] : [{ exit, cost: route.cost }];
  }).sort((a, b) => a.cost - b.cost || a.exit.y - b.exit.y || a.exit.x - b.exit.x);
  // A validated map has exits; a guest on a now-invalid/disconnected cell still
  // leaves deterministically rather than making demolition fail after it mutated.
  return candidates[0]?.exit ?? state.map.exits[0]!;
}

function fallbackGuest(guest: Guest, buildingId: string, exit: WorldGraphKindState["map"]["exits"][number], tick: number): Guest {
  if (guest.intent.kind !== "seek_service" || guest.intent.buildingId !== buildingId) return guest;
  return { ...guest, lifecycle: "seeking", intent: { kind: "leave", exit, reason: "scenario", selectedAtTick: tick }, path: [], pathIndex: 0 };
}

export function demolish(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  const buildingId = values ? stringParam(values, "buildingId") : null;
  if (buildingId === null) return rejected(state, "core.reason.unknown_action");
  const target = state.buildings.find((entry) => entry.id === buildingId);
  if (!target) return rejected(state, "unknown_entity");
  const content = worldGraphContent(ctx.campaign.content);
  if (state.map.exits.length === 0) throw new Error("Validated world-graph map has no exit");
  const remainingBuildings = state.buildings.filter((entry) => entry.id !== buildingId);
  const nextMap = { ...state.map, revision: state.map.revision + 1 };
  const next: WorldGraphKindState = {
    ...state,
    map: nextMap,
    buildings: remainingBuildings,
    guests: state.guests.map((guest) => fallbackGuest(
      guest,
      buildingId,
      nearestReachableExit(state, content.terrain, guest, remainingBuildings),
      state.tick,
    )),
    staff: state.staff.map((member) => member.assignedBuildingId === buildingId || member.task?.buildingId === buildingId || member.task?.queueId === target.queue.id
      ? { ...member, assignedBuildingId: member.assignedBuildingId === buildingId ? null : member.assignedBuildingId, status: "idle", task: null, path: [], pathIndex: 0, moveProgressTicks: 0 }
      : member),
    incidents: state.incidents.map((incident) => incident.buildingId === buildingId ? { ...incident, buildingId: null, position: incident.position ?? { x: target.x, y: target.y } } : incident),
    alerts: state.alerts.map((alert) => alert.entityId === buildingId ? { ...alert, entityId: null, clearedAtTick: alert.clearedAtTick ?? state.tick } : alert),
  };
  emit(ctx, WORLD_GRAPH_EVENTS.buildingDemolished, { buildingId });
  return accepted(next, [
    change("map.revision", nextMap.revision, "building_demolished", false, state.map.revision),
    change(`buildings.${buildingId}.exists`, false, "building_demolished", false, true),
  ]);
}
