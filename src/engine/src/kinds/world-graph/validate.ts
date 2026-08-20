import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult, ValidationWarning } from "../../core/validation/types.js";
import type { WorldCondition, WorldEffect, WorldGraphCampaign } from "./content.js";
import { WORLD_GRAPH_REASON_CODES, type WorldGraphReasonCode } from "./reasons.js";
import { checkBuildingPlacement, materializeMap } from "./spatial.js";
import type { Building, Position } from "./state.js";

type RecordValue = Record<string, unknown>;
const requiredCatalogs = [
  "maps", "terrain", "scenery", "needs", "guestConditions", "opinions", "preferences",
  "products", "buildings", "guestArchetypes", "staffRoles", "incidents", "objectives",
  "failures", "policies", "achievements", "scenarios",
] as const;

const object = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const safeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const pathSafeId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && !value.includes(".");

const KNOWN_REASON_CODES = new Set<string>(WORLD_GRAPH_REASON_CODES);
function messageKeyFor(code: string): LocKey {
  return (KNOWN_REASON_CODES.has(code) ? `world-graph.reason.${code as WorldGraphReasonCode}` : "core.reason.invalid_state") as LocKey;
}
function error(code: string, path: string): ValidationError {
  return { code, messageKey: messageKeyFor(code), path };
}
function warning(code: string, path: string): ValidationWarning {
  return { code, messageKey: messageKeyFor(code), path };
}

function shapeErrors(value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!object(value)) return [error("invalid_world_graph_content", "content")];
  if (!pathSafeId(value.startScenarioId)) errors.push(error("invalid_id", "content.startScenarioId"));
  if (!safeInteger(value.ticksPerDay) || value.ticksPerDay <= 0) errors.push(error("invalid_integer", "content.ticksPerDay"));
  if (!safeInteger(value.maxTicksPerAction) || value.maxTicksPerAction <= 0) errors.push(error("invalid_integer", "content.maxTicksPerAction"));
  for (const catalog of requiredCatalogs) {
    const entries = value[catalog];
    if (!Array.isArray(entries)) {
      errors.push(error("invalid_array", `content.${catalog}`));
      continue;
    }
    entries.forEach((entry, index) => {
      if (!object(entry)) errors.push(error("invalid_definition", `content.${catalog}[${index}]`));
      else {
        if (!pathSafeId(entry.id)) errors.push(error("invalid_id", `content.${catalog}[${index}].id`));
        if (!object(entry.text) || typeof entry.text.nameKey !== "string" || typeof entry.text.descriptionKey !== "string") {
          errors.push(error("invalid_definition_text", `content.${catalog}[${index}].text`));
        }
      }
    });
  }
  return errors;
}

function walkIntegers(value: unknown, path: string, errors: ValidationError[], seen = new Set<object>()): void {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    errors.push(error("unsafe_integer", path));
    return;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) value.forEach((entry, index) => walkIntegers(entry, `${path}[${index}]`, errors, seen));
  else Object.entries(value).forEach(([key, entry]) => walkIntegers(entry, `${path}.${key}`, errors, seen));
}

function catalogIds(content: WorldGraphCampaign, catalog: keyof WorldGraphCampaign, errors: ValidationError[]): Set<string> {
  const entries = content[catalog];
  const ids = new Set<string>();
  if (!Array.isArray(entries)) return ids;
  entries.forEach((entry, index) => {
    if (!object(entry) || typeof entry.id !== "string") return;
    if (ids.has(entry.id)) errors.push(error("duplicate_id", `content.${catalog}[${index}].id`));
    ids.add(entry.id);
  });
  return ids;
}

function textErrors(content: WorldGraphCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const catalog of requiredCatalogs) {
    content[catalog].forEach((entry, index) => {
      for (const field of ["nameKey", "descriptionKey"] as const) {
        if (!strings.has(entry.text[field])) errors.push(error("missing_string_key", `content.${catalog}[${index}].text.${field}`));
      }
    });
  }
  for (const [mapIndex, map] of content.maps.entries()) {
    map.zones.forEach((zone, zoneIndex) => {
      for (const field of ["nameKey", "descriptionKey"] as const) if (!strings.has(zone.text[field])) errors.push(error("missing_string_key", `content.maps[${mapIndex}].zones[${zoneIndex}].text.${field}`));
    });
  }
  return errors;
}

function conditionErrors(condition: WorldCondition, path: string, errors: ValidationError[], depth = 0): void {
  if (depth > 32) {
    errors.push(error("condition_depth_exceeded", path));
    return;
  }
  if (!object(condition) || typeof condition.kind !== "string") {
    errors.push(error("invalid_condition", path));
    return;
  }
  if (condition.kind === "all" || condition.kind === "any") {
    if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) errors.push(error("invalid_condition", `${path}.conditions`));
    else condition.conditions.forEach((child, index) => conditionErrors(child, `${path}.conditions[${index}]`, errors, depth + 1));
  } else if (condition.kind === "not") conditionErrors(condition.condition, `${path}.condition`, errors, depth + 1);
}

function effectErrors(effect: WorldEffect, path: string, errors: ValidationError[]): void {
  if (!object(effect) || typeof effect.kind !== "string") {
    errors.push(error("invalid_effect", path));
    return;
  }
  const kinds = new Set([
    "finance_delta", "counter_increment", "unlock", "lock", "objective_progress",
    "guest_meter_delta", "building_meter_delta", "start_incident", "resolve_incident",
    "set_policy_active",
  ]);
  if (!kinds.has(effect.kind)) {
    errors.push(error("invalid_effect", `${path}.kind`));
    return;
  }
  if (effect.kind === "counter_increment" && (!safeInteger(effect.amount) || effect.amount < 0)) {
    errors.push(error("invalid_counter_increment", `${path}.amount`));
  }
}

/**
 * Systems 16 (`incidents`, expiry-driven resolution), 17 (`objectives`), and 18 (`failure`)
 * run after system 14 (`cleanliness-wear`) and never defer to it — unlike systems 1, 4, and 11
 * (20-contract.md §9.2, §4.16). A `wear` delta reachable through one of those three would apply
 * immediately with its own independent clamp and could never trigger the wear-hits-zero broken
 * transition, since system 14 already ran this tick. Forbidding it keeps that gap from being
 * reachable by content rather than leaving it a latent trap.
 *
 * Only `wear` is forbidden. `cleanliness` has no status transition hanging off it, so a late
 * cleanliness delta is simply clamped locally — exactly what §9.2's "systems after 14 apply
 * their own group locally" already licenses, and what an objective reward legitimately wants.
 */
function forbidUndeferrableWearDelta(effects: readonly WorldEffect[], path: string, errors: ValidationError[]): void {
  if (!Array.isArray(effects)) return;
  effects.forEach((effect, index) => {
    if (object(effect) && effect.kind === "building_meter_delta" && effect.meter === "wear") {
      errors.push(error("undeferrable_building_meter_effect", `${path}[${index}]`));
    }
  });
}

function catalogEffectErrors(content: WorldGraphCampaign, errors: ValidationError[]): void {
  const check = (effects: readonly WorldEffect[], path: string): void => {
    if (!Array.isArray(effects)) {
      errors.push(error("invalid_effect", path));
      return;
    }
    effects.forEach((effect, index) => effectErrors(effect, `${path}[${index}]`, errors));
  };
  content.products.forEach((entry, index) => check(entry.effects, `content.products[${index}].effects`));
  content.buildings.forEach((entry, index) => {
    if (entry.operation.kind === "service") check(entry.operation.effects, `content.buildings[${index}].operation.effects`);
  });
  content.objectives.forEach((entry, index) => {
    check(entry.onCompleted, `content.objectives[${index}].onCompleted`);
    forbidUndeferrableWearDelta(entry.onCompleted, `content.objectives[${index}].onCompleted`, errors);
  });
  content.failures.forEach((entry, index) => {
    check(entry.onTriggered, `content.failures[${index}].onTriggered`);
    forbidUndeferrableWearDelta(entry.onTriggered, `content.failures[${index}].onTriggered`, errors);
  });
  content.incidents.forEach((entry, index) => {
    check(entry.onStart, `content.incidents[${index}].onStart`);
    check(entry.onResolve, `content.incidents[${index}].onResolve`);
    // A duration-bearing incident can resolve via system 16's expiry, which never defers;
    // only a staff-resolved-only incident (durationTicks: null) can carry a wear delta.
    if (entry.durationTicks !== null) forbidUndeferrableWearDelta(entry.onResolve, `content.incidents[${index}].onResolve`, errors);
  });
  content.policies.forEach((entry, index) => check(entry.whileActive, `content.policies[${index}].whileActive`));
  content.scenarios.forEach((entry, scenarioIndex) => entry.scheduledChanges.forEach((change, changeIndex) => (
    check(change.effects, `content.scenarios[${scenarioIndex}].scheduledChanges[${changeIndex}].effects`)
  )));
}

function referenceErrors(content: WorldGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = {
    maps: catalogIds(content, "maps", errors), terrain: catalogIds(content, "terrain", errors), scenery: catalogIds(content, "scenery", errors),
    needs: catalogIds(content, "needs", errors), guestConditions: catalogIds(content, "guestConditions", errors), opinions: catalogIds(content, "opinions", errors),
    preferences: catalogIds(content, "preferences", errors), products: catalogIds(content, "products", errors), buildings: catalogIds(content, "buildings", errors),
    guestArchetypes: catalogIds(content, "guestArchetypes", errors), staffRoles: catalogIds(content, "staffRoles", errors), incidents: catalogIds(content, "incidents", errors),
    objectives: catalogIds(content, "objectives", errors), failures: catalogIds(content, "failures", errors), policies: catalogIds(content, "policies", errors),
    achievements: catalogIds(content, "achievements", errors), scenarios: catalogIds(content, "scenarios", errors),
  };
  const requireId = (set: ReadonlySet<string>, id: string, path: string): void => { if (!set.has(id)) errors.push(error("unknown_reference", path)); };
  requireId(ids.scenarios, content.startScenarioId, "content.startScenarioId");
  const terrainById = new Map(content.terrain.map((entry) => [entry.id, entry]));
  content.maps.forEach((map, mapIndex) => {
    requireId(ids.terrain, map.defaultTerrainId, `content.maps[${mapIndex}].defaultTerrainId`);
    map.terrainOverrides.forEach((entry, index) => {
      requireId(ids.terrain, entry.terrainId, `content.maps[${mapIndex}].terrainOverrides[${index}].terrainId`);
      if (entry.position.x < 0 || entry.position.y < 0 || entry.position.x >= map.width || entry.position.y >= map.height) errors.push(error("position_out_of_bounds", `content.maps[${mapIndex}].terrainOverrides[${index}].position`));
    });
    if (map.spawnPoints.length === 0) errors.push(error("missing_spawn", `content.maps[${mapIndex}].spawnPoints`));
    if (map.exits.length === 0) errors.push(error("missing_exit", `content.maps[${mapIndex}].exits`));
    const overrides = new Map(map.terrainOverrides.map((entry) => [`${entry.position.x},${entry.position.y}`, entry.terrainId]));
    const terrainIdAt = (position: Position): string => overrides.get(`${position.x},${position.y}`) ?? map.defaultTerrainId;
    const checkEndpoints = (positions: readonly Position[], label: string, code: string): void => {
      positions.forEach((position, index) => {
        if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
          errors.push(error("position_out_of_bounds", `content.maps[${mapIndex}].${label}[${index}]`));
          return;
        }
        const walkable = terrainById.get(terrainIdAt(position))?.walkable === true;
        if (!walkable) errors.push(error(code, `content.maps[${mapIndex}].${label}[${index}]`));
      });
    };
    checkEndpoints(map.spawnPoints, "spawnPoints", "spawn_not_traversable");
    checkEndpoints(map.exits, "exits", "exit_not_traversable");
    if (map.topology.kind === "explicit") {
      map.topology.edges.forEach((edge, edgeIndex) => {
        if (edge.edgeCost <= 0) errors.push(error("invalid_edge_cost", `content.maps[${mapIndex}].topology.edges[${edgeIndex}].edgeCost`));
      });
    }
  });
  content.buildings.forEach((definition, index) => {
    if (definition.footprint.width <= 0 || definition.footprint.height <= 0) errors.push(error("invalid_footprint", `content.buildings[${index}].footprint`));
    if (definition.entrances.length === 0 || definition.allowedRotations.length === 0) errors.push(error("invalid_building_geometry", `content.buildings[${index}]`));
    if (definition.constructionCostCents < 0) errors.push(error("invalid_cost", `content.buildings[${index}].constructionCostCents`));
    if (definition.operatingCostCentsPerDay < 0) errors.push(error("invalid_cost", `content.buildings[${index}].operatingCostCentsPerDay`));
    // Wear reaching zero is the only broken trigger (20-contract.md §4.16); a building created
    // already at zero can never re-trigger it, since cleanliness-wear only breaks on a change.
    if (definition.initialWear <= 0) errors.push(error("invalid_initial_wear", `content.buildings[${index}].initialWear`));
    if (definition.operation.kind === "service") {
      definition.operation.products.forEach((entry, productIndex) => {
        requireId(ids.products, entry.productId, `content.buildings[${index}].operation.products[${productIndex}].productId`);
        if (entry.initialUnits !== null && entry.initialUnits < 0) errors.push(error("invalid_inventory", `content.buildings[${index}].operation.products[${productIndex}].initialUnits`));
        if (entry.capacity !== null && entry.capacity < 0) errors.push(error("invalid_inventory", `content.buildings[${index}].operation.products[${productIndex}].capacity`));
        if (entry.initialUnits !== null && entry.capacity !== null && entry.initialUnits > entry.capacity) errors.push(error("invalid_inventory", `content.buildings[${index}].operation.products[${productIndex}].initialUnits`));
      });
      definition.operation.staffRequirements.forEach((entry, roleIndex) => requireId(ids.staffRoles, entry.roleId, `content.buildings[${index}].operation.staffRequirements[${roleIndex}].roleId`));
    }
  });
  content.products.forEach((definition, index) => {
    if (definition.unitCostCents < 0) errors.push(error("invalid_cost", `content.products[${index}].unitCostCents`));
  });
  content.staffRoles.forEach((definition, index) => {
    if (definition.hireCostCents < 0) errors.push(error("invalid_cost", `content.staffRoles[${index}].hireCostCents`));
    if (definition.wageCentsPerDay < 0) errors.push(error("invalid_cost", `content.staffRoles[${index}].wageCentsPerDay`));
    definition.workRates.forEach((rate, rateIndex) => {
      if (rate.effortPerTick <= 0) errors.push(error("invalid_work_rate", `content.staffRoles[${index}].workRates[${rateIndex}].effortPerTick`));
    });
  });
  content.guestArchetypes.forEach((entry, index) => {
    entry.needs.forEach((profile, profileIndex) => requireId(ids.needs, profile.needId, `content.guestArchetypes[${index}].needs[${profileIndex}].needId`));
    entry.conditions.forEach((profile, profileIndex) => requireId(ids.guestConditions, profile.definitionId, `content.guestArchetypes[${index}].conditions[${profileIndex}].definitionId`));
    entry.opinions.forEach((profile, profileIndex) => requireId(ids.opinions, profile.definitionId, `content.guestArchetypes[${index}].opinions[${profileIndex}].definitionId`));
    entry.preferences.forEach((profile, profileIndex) => requireId(ids.preferences, profile.definitionId, `content.guestArchetypes[${index}].preferences[${profileIndex}].definitionId`));
  });
  content.objectives.forEach((entry, index) => conditionErrors(entry.completion, `content.objectives[${index}].completion`, errors));
  content.failures.forEach((entry, index) => conditionErrors(entry.condition, `content.failures[${index}].condition`, errors));
  content.scenarios.forEach((scenario, scenarioIndex) => {
    requireId(ids.maps, scenario.mapId, `content.scenarios[${scenarioIndex}].mapId`);
    scenario.objectiveIds.forEach((id, index) => requireId(ids.objectives, id, `content.scenarios[${scenarioIndex}].objectiveIds[${index}]`));
    scenario.failureIds.forEach((id, index) => requireId(ids.failures, id, `content.scenarios[${scenarioIndex}].failureIds[${index}]`));
    scenario.activePolicyIds.forEach((id, index) => requireId(ids.policies, id, `content.scenarios[${scenarioIndex}].activePolicyIds[${index}]`));
    scenario.buildingPlacements.forEach((entry, index) => requireId(ids.buildings, entry.definitionId, `content.scenarios[${scenarioIndex}].buildingPlacements[${index}].definitionId`));
    scenario.sceneryPlacements.forEach((entry, index) => requireId(ids.scenery, entry.definitionId, `content.scenarios[${scenarioIndex}].sceneryPlacements[${index}].definitionId`));
    scenario.guestSpawning.pool.forEach((entry, index) => requireId(ids.guestArchetypes, entry.archetypeId, `content.scenarios[${scenarioIndex}].guestSpawning.pool[${index}].archetypeId`));
    scenario.buildingLimits.forEach((entry, index) => requireId(ids.buildings, entry.definitionId, `content.scenarios[${scenarioIndex}].buildingLimits[${index}].definitionId`));
    scenario.staffLimits.forEach((entry, index) => requireId(ids.staffRoles, entry.definitionId, `content.scenarios[${scenarioIndex}].staffLimits[${index}].definitionId`));
    if ((scenario.timeLimitTicks === null) !== (scenario.timeLimitFailureId === null)) errors.push(error("invalid_time_limit_pair", `content.scenarios[${scenarioIndex}]`));
    if (scenario.timeLimitFailureId !== null) requireId(ids.failures, scenario.timeLimitFailureId, `content.scenarios[${scenarioIndex}].timeLimitFailureId`);
  });
  return errors;
}

function placementErrors(content: WorldGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  content.scenarios.forEach((scenario, scenarioIndex) => {
    const mapDefinition = content.maps.find((entry) => entry.id === scenario.mapId);
    if (!mapDefinition) return;
    const map = materializeMap(mapDefinition);
    const buildings: Building[] = [];
    scenario.buildingPlacements.forEach((placement, index) => {
      const definition = content.buildings.find((entry) => entry.id === placement.definitionId);
      if (!definition) return;
      const result = checkBuildingPlacement(map, content.terrain, definition, placement.x, placement.y, placement.rotation, buildings, []);
      if (!result.ok) errors.push(error(result.reason, `content.scenarios[${scenarioIndex}].buildingPlacements[${index}]`));
      else buildings.push({
        id: `validation:${index}`, definitionId: definition.id, x: placement.x, y: placement.y,
        width: result.width, height: result.height, rotation: placement.rotation,
        status: placement.open ? "open" : "closed", buildStartTick: 0,
        wear: definition.initialWear, cleanliness: definition.initialCleanliness,
        queue: { id: `validation-queue:${index}`, guestIds: [], serviceStartedAtTick: null }, pricesCents: {}, inventory: {},
      });
    });
  });
  return errors;
}

function graphWarnings(content: WorldGraphCampaign): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  content.maps.forEach((map, index) => {
    if (map.topology.kind === "explicit" && map.topology.edges.filter((edge) => edge.allowed).length === 0) warnings.push(warning("disconnected_map", `content.maps[${index}].topology`));
  });
  content.scenarios.forEach((scenario, index) => {
    if (scenario.objectiveIds.length === 0 && scenario.failureIds.length === 0) warnings.push(warning("inert_scenario", `content.scenarios[${index}]`));
  });
  return warnings;
}

/** Pure and total over the core's opaque `Campaign.content` boundary. */
export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  if (campaign.kindId !== "world-graph") return { ok: false, errors: [error("invalid_kind", "kindId")], warnings: [] };
  const errors = shapeErrors(campaign.content);
  walkIntegers(campaign.content, "content", errors);
  if (errors.some((entry) => ["invalid_world_graph_content", "invalid_array", "invalid_definition", "invalid_definition_text"].includes(entry.code))) {
    return { ok: false, errors, warnings: [] };
  }
  try {
    const content = campaign.content as WorldGraphCampaign;
    errors.push(...textErrors(content, strings), ...referenceErrors(content), ...placementErrors(content));
    catalogEffectErrors(content, errors);
    const warnings = graphWarnings(content);
    return { ok: errors.length === 0, errors, warnings };
  } catch {
    errors.push(error("invalid_world_graph_content", "content"));
    return { ok: false, errors, warnings: [] };
  }
}
