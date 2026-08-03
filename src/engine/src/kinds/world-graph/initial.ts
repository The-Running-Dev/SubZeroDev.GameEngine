import type { InitialStateResult, KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import { evaluateCondition, evaluateMetric } from "./conditions.js";
import { worldGraphContent, type BuildingDefinition, type ScenarioDefinition } from "./content.js";
import { checkBuildingPlacement, materializeMap, scenerySize } from "./spatial.js";
import type { Building, Queue, Scenery, WorldGraphKindState } from "./state.js";
import { resolveStatus } from "./outcome.js";

function invariant<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(`Validated world-graph invariant failed: ${message}`);
  return value;
}

function queue(id: string): Queue {
  return { id, guestIds: [], serviceStartedAtTick: null };
}

function productState(content: ReturnType<typeof worldGraphContent>, definition: BuildingDefinition): {
  readonly pricesCents: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number | null>>;
} {
  if (definition.operation.kind !== "service") return { pricesCents: {}, inventory: {} };
  return {
    pricesCents: Object.fromEntries(definition.operation.products.map((service) => [service.productId, serviceProduct(content, definition, service.productId).price.defaultCents])),
    inventory: Object.fromEntries(definition.operation.products.map((service) => [service.productId, service.initialUnits])),
  };
}

function serviceProduct(content: ReturnType<typeof worldGraphContent>, definition: BuildingDefinition, productId: string) {
  return invariant(content.products.find((product) => product.id === productId), `product ${productId} for ${definition.id}`);
}

function buildPlacement(
  scenario: ScenarioDefinition,
  content: ReturnType<typeof worldGraphContent>,
  map: WorldGraphKindState["map"],
): { readonly buildings: readonly Building[]; readonly nextOrdinal: number } {
  const buildings: Building[] = [];
  let nextOrdinal = 0;
  for (const placement of scenario.buildingPlacements) {
    const definition = invariant(content.buildings.find((entry) => entry.id === placement.definitionId), `building ${placement.definitionId}`);
    const result = checkBuildingPlacement(map, content.terrain, definition, placement.x, placement.y, placement.rotation, buildings, []);
    if (!result.ok) throw new Error(`Validated world-graph placement failed: ${definition.id}:${result.reason}`);
    const products = productState(content, definition);
    buildings.push({
      id: `building:${nextOrdinal}`,
      definitionId: definition.id,
      x: placement.x,
      y: placement.y,
      width: result.width,
      height: result.height,
      rotation: placement.rotation,
      status: placement.open ? "open" : "closed",
      buildStartTick: 0,
      wear: definition.initialWear,
      cleanliness: definition.initialCleanliness,
      queue: queue(`queue:${nextOrdinal + 1}`),
      ...products,
    });
    nextOrdinal += 2;
  }
  return { buildings, nextOrdinal };
}

export function initialState(campaign: Campaign, ctx: KindContext): InitialStateResult<WorldGraphKindState> {
  void ctx;
  const content = worldGraphContent(campaign.content);
  const scenario = invariant(content.scenarios.find((entry) => entry.id === content.startScenarioId), `scenario ${content.startScenarioId}`);
  const mapDefinition = invariant(content.maps.find((entry) => entry.id === scenario.mapId), `map ${scenario.mapId}`);
  let map = materializeMap(mapDefinition);
  const placed = buildPlacement(scenario, content, map);
  let nextOrdinal = placed.nextOrdinal;
  const scenery: Scenery[] = [];
  for (const placement of scenario.sceneryPlacements) {
    const definition = invariant(content.scenery.find((entry) => entry.id === placement.definitionId), `scenery ${placement.definitionId}`);
    const size = scenerySize(definition, placement.rotation);
    scenery.push({ id: `scenery:${nextOrdinal}`, definitionId: definition.id, x: placement.x, y: placement.y, width: size.width, height: size.height, rotation: placement.rotation });
    nextOrdinal += 1;
  }
  map = { ...map, scenery };

  const zeroCounters = {
    guestsEntered: 0, guestsDeparted: 0, guestsDissatisfied: 0, servicesCompleted: 0,
    buildingsCompleted: 0, incidentsRaised: 0, litterCreated: 0, litterCleaned: 0,
  } as const;
  let state: WorldGraphKindState = {
    tick: 0,
    map,
    finances: { cashCents: scenario.startingCashCents, revenueTodayCents: 0, expensesTodayCents: 0, revenueTotalCents: 0, expensesTotalCents: 0, loan: null },
    buildings: placed.buildings,
    constructionSites: [], guests: [], staff: [], incidents: [], alerts: [],
    objectives: scenario.objectiveIds.map((id) => ({ id, state: "active", value: 0, target: invariant(content.objectives.find((entry) => entry.id === id), `objective ${id}`).target, satisfiedSinceTick: null, updatedAtTick: 0 })),
    failures: scenario.failureIds.map((id) => ({ id, state: "active", satisfiedSinceTick: null, updatedAtTick: 0 })),
    resolution: null,
    counters: zeroCounters,
    unlockedContent: scenario.unlockedContent,
    activePolicyIds: scenario.activePolicyIds,
    unlockedAchievementIds: [],
    nextEntityOrdinal: nextOrdinal,
  };

  const objectives = state.objectives.map((progress) => {
    const definition = invariant(content.objectives.find((entry) => entry.id === progress.id), `objective ${progress.id}`);
    const satisfied = evaluateCondition(definition.completion, state, content);
    const value = definition.progressMetric === null ? progress.value : evaluateMetric(definition.progressMetric, state, content) ?? 0;
    return { ...progress, value, satisfiedSinceTick: satisfied ? 0 : null, state: satisfied && definition.requiredDurationTicks === 1 ? "met" as const : "active" as const };
  });
  state = { ...state, objectives };
  const failures = state.failures.map((progress) => {
    const definition = invariant(content.failures.find((entry) => entry.id === progress.id), `failure ${progress.id}`);
    const satisfied = evaluateCondition(definition.condition, state, content);
    return { ...progress, satisfiedSinceTick: satisfied ? 0 : null, state: satisfied && definition.requiredDurationTicks === 1 ? "triggered" as const : "active" as const };
  });
  state = { ...state, failures };

  const objectiveIds = state.objectives.filter((entry) => entry.state === "met").map((entry) => entry.id).sort();
  const objectivesWon = state.objectives.length > 0 && objectiveIds.length === state.objectives.length;
  const failureId = state.failures.find((entry) => entry.state === "triggered")?.id ?? null;
  if (objectivesWon && (failureId === null || scenario.resolutionPrecedence === "objectives_win")) {
    state = { ...state, resolution: { resolution: "objectives_met", objectiveIds, failureId: null, resolvedAtTick: 0 } };
  } else if (failureId !== null) {
    state = { ...state, resolution: { resolution: "failed", objectiveIds, failureId, resolvedAtTick: 0 } };
  }

  return { state, status: resolveStatus(state), changes: [], messages: [] };
}
