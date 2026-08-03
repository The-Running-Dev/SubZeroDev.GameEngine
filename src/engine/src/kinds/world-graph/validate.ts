import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult, ValidationWarning } from "../../core/validation/types.js";
import type { WorldCondition, WorldGraphCampaign } from "./content.js";
import { checkBuildingPlacement, materializeMap } from "./spatial.js";
import type { Building } from "./state.js";

type RecordValue = Record<string, unknown>;
const requiredCatalogs = [
  "maps", "terrain", "scenery", "needs", "guestConditions", "opinions", "preferences",
  "products", "buildings", "guestArchetypes", "staffRoles", "incidents", "objectives",
  "failures", "policies", "achievements", "scenarios",
] as const;

const object = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const safeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const pathSafeId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && !value.includes(".");

function error(code: string, path: string): ValidationError {
  return { code, messageKey: "core.reason.invalid_state", path };
}
function warning(code: string, path: string): ValidationWarning {
  return { code, messageKey: "core.reason.invalid_state", path };
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
  content.maps.forEach((map, mapIndex) => {
    requireId(ids.terrain, map.defaultTerrainId, `content.maps[${mapIndex}].defaultTerrainId`);
    map.terrainOverrides.forEach((entry, index) => {
      requireId(ids.terrain, entry.terrainId, `content.maps[${mapIndex}].terrainOverrides[${index}].terrainId`);
      if (entry.position.x < 0 || entry.position.y < 0 || entry.position.x >= map.width || entry.position.y >= map.height) errors.push(error("position_out_of_bounds", `content.maps[${mapIndex}].terrainOverrides[${index}].position`));
    });
    if (map.spawnPoints.length === 0) errors.push(error("missing_spawn", `content.maps[${mapIndex}].spawnPoints`));
    if (map.exits.length === 0) errors.push(error("missing_exit", `content.maps[${mapIndex}].exits`));
    const terrainById = new Map(content.terrain.map((entry) => [entry.id, entry]));
    for (const [kind, points] of [["spawnPoints", map.spawnPoints], ["exits", map.exits]] as const) {
      points.forEach((point, index) => {
        if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) errors.push(error("position_out_of_bounds", `content.maps[${mapIndex}].${kind}[${index}]`));
        else if (!terrainById.get(map.terrainOverrides.find((entry) => entry.position.x === point.x && entry.position.y === point.y)?.terrainId ?? map.defaultTerrainId)?.walkable) errors.push(error("position_not_walkable", `content.maps[${mapIndex}].${kind}[${index}]`));
      });
    }
    if (map.topology.kind === "explicit") map.topology.edges.forEach((edge, index) => { if (edge.allowed && edge.edgeCost <= 0) errors.push(error("invalid_traversal_cost", `content.maps[${mapIndex}].topology.edges[${index}].edgeCost`)); });
  });
  content.buildings.forEach((definition, index) => {
    if (definition.constructionCostCents < 0) errors.push(error("invalid_cost", `content.buildings[${index}].constructionCostCents`));
    if (definition.footprint.width <= 0 || definition.footprint.height <= 0) errors.push(error("invalid_footprint", `content.buildings[${index}].footprint`));
    if (definition.entrances.length === 0 || definition.allowedRotations.length === 0) errors.push(error("invalid_building_geometry", `content.buildings[${index}]`));
    if (definition.operation.kind === "service") {
      definition.operation.products.forEach((entry, productIndex) => requireId(ids.products, entry.productId, `content.buildings[${index}].operation.products[${productIndex}].productId`));
      definition.operation.staffRequirements.forEach((entry, roleIndex) => requireId(ids.staffRoles, entry.roleId, `content.buildings[${index}].operation.staffRequirements[${roleIndex}].roleId`));
    }
  });
  content.staffRoles.forEach((entry, index) => { if (entry.hireCostCents < 0) errors.push(error("invalid_cost", `content.staffRoles[${index}].hireCostCents`)); });
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
    const warnings = graphWarnings(content);
    return { ok: errors.length === 0, errors, warnings };
  } catch {
    errors.push(error("invalid_world_graph_content", "content"));
    return { ok: false, errors, warnings: [] };
  }
}
