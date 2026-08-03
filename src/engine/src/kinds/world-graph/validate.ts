/**
 * World-graph kind — campaign validation (12-world-graph-kind.md §15).
 *
 * Tier 1 is a hard fail, Tier 2 loads but flags. Pure and total: no simulation, no search,
 * no I/O.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationResult, ValidationWarning } from "../../core/validation/types.js";
import type { WorldGraphBuildingDefinition, WorldGraphCampaign } from "./campaign.js";

type Issue = { code: string; messageKey: string; path: string };

function missingStringKey(path: string): Issue {
  return {
    code: "missing_string_key",
    messageKey: "core.reason.missing_string_key",
    path,
  };
}

function invalidState(path: string): Issue {
  return {
    code: "invalid_state",
    messageKey: "core.reason.invalid_state",
    path,
  };
}

function duplicateId(path: string): Issue {
  return {
    code: "duplicate_campaign_id",
    messageKey: "core.reason.duplicate_campaign_id",
    path,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * An authored id must be non-empty and carry no `.`, because §13's `StateChange` paths are
 * dot-separated: a `productId` of `water.sparkling` makes
 * `buildings.b:3.pricesCents.water.sparkling` parse two ways. Entity ids need no check —
 * §9 constructs them as `<prefix>:<ordinal>` — so this binds content only, which is exactly
 * what a contract cannot assume about.
 */
function isPathSafeId(value: string): boolean {
  return value.length > 0 && !value.includes(".");
}

function validateIdShapes(content: WorldGraphCampaign): Issue[] {
  const errors: Issue[] = [];

  const check = (id: string, path: string) => {
    if (!isPathSafeId(id)) {
      errors.push({ code: "invalid_identifier", messageKey: "core.reason.invalid_identifier", path });
    }
  };

  for (const building of content.buildingDefinitions) {
    check(building.id, `buildingDefinitions.${building.id}`);
    for (const product of building.products) {
      // Also the keys of `Building.pricesCents`, which are these ids.
      check(product.id, `buildingDefinitions.${building.id}.products.${product.id}`);
    }
  }
  for (const role of content.staffRoleDefinitions) {
    check(role.id, `staffRoleDefinitions.${role.id}`);
  }
  for (const objective of content.objectiveDefinitions) {
    check(objective.id, `objectiveDefinitions.${objective.id}`);
  }
  for (const zone of content.map.zones) {
    check(zone.id, `map.zones.${zone.id}`);
  }

  return errors;
}

function validateFinances(content: WorldGraphCampaign, keys: ReadonlyMap<LocKey, string>): Issue[] {
  const errors: Issue[] = [];

  if (!isNonNegativeInteger(content.startingFinances.cashCents)) {
    errors.push(invalidState("startingFinances.cashCents"));
  }

  for (const pair of [
    ["startingFinances.revenueTodayCents", content.startingFinances.revenueTodayCents],
    ["startingFinances.expensesTodayCents", content.startingFinances.expensesTodayCents],
    ["startingFinances.revenueTotalCents", content.startingFinances.revenueTotalCents],
    ["startingFinances.expensesTotalCents", content.startingFinances.expensesTotalCents],
  ] as const) {
    if (pair[1] !== undefined && !isNonNegativeInteger(pair[1])) {
      errors.push(invalidState(pair[0]));
    }
  }

  if (content.startingFinances.loan && content.startingFinances.loan.principalCents < 0) {
    errors.push(invalidState("startingFinances.loan.principalCents"));
  }

  if (!keys.has(content.descriptionKey)) {
    errors.push(missingStringKey("descriptionKey"));
  }

  return errors;
}

function validateTerrain(content: WorldGraphCampaign): Issue[] {
  const errors: Issue[] = [];

  if (!isPositiveInteger(content.map.width)) {
    errors.push(invalidState("map.width"));
  }
  if (!isPositiveInteger(content.map.height)) {
    errors.push(invalidState("map.height"));
  }
  if (content.map.spawnPoints.length === 0) {
    errors.push(invalidState("map.spawnPoints"));
  }
  if (content.map.exits.length === 0) {
    errors.push(invalidState("map.exits"));
  }

  const zoneIds = new Set<string>();
  for (const zone of content.map.zones) {
    if (zoneIds.has(zone.id)) {
      errors.push(duplicateId(`map.zones.${zone.id}`));
    }
    zoneIds.add(zone.id);
  }

  return errors;
}

function validateDefinitions(content: WorldGraphCampaign): Issue[] {
  const errors: Issue[] = [];

  if (!isPositiveInteger(content.maxAdvanceTicksPerAction)) {
    errors.push(invalidState("maxAdvanceTicksPerAction"));
  }
  // The "today" accumulators reset on `floor(tick / ticksPerDay)` (§3.3), so a zero or
  // fractional value is a division the reset rule cannot survive.
  if (!isPositiveInteger(content.ticksPerDay)) {
    errors.push(invalidState("ticksPerDay"));
  }

  const buildingIds = new Set<string>();
  for (const building of content.buildingDefinitions) {
    if (!isPositiveInteger(building.width) || !isPositiveInteger(building.height)) {
      errors.push(invalidState(`buildingDefinitions.${building.id}.dimensions`));
    }
    if (!isNonNegativeInteger(building.costCents)) {
      errors.push(invalidState(`buildingDefinitions.${building.id}.costCents`));
    }
    if (building.products.length === 0) {
      errors.push(invalidState(`buildingDefinitions.${building.id}.products`));
    }
    if (building.maxCount !== null && !isPositiveInteger(building.maxCount)) {
      errors.push(invalidState(`buildingDefinitions.${building.id}.maxCount`));
    }
    if (buildingIds.has(building.id)) {
      errors.push(duplicateId(building.id));
    }
    buildingIds.add(building.id);

    const productIds = new Set<string>();
    for (const product of building.products) {
      const path = `buildingDefinitions.${building.id}.products.${product.id}`;
      if (productIds.has(product.id)) {
        errors.push(duplicateId(path));
      }
      productIds.add(product.id);

      if (!isNonNegativeInteger(product.defaultPriceCents)) {
        errors.push(invalidState(`${path}.defaultPriceCents`));
      }
      if (!isNonNegativeInteger(product.priceRange.minCents) || !isNonNegativeInteger(product.priceRange.maxCents)) {
        errors.push(invalidState(`${path}.priceRange`));
      }
      if (product.priceRange.minCents > product.priceRange.maxCents) {
        errors.push(invalidState(`${path}.priceRange`));
      }
      // A default outside its own band is unsettable by `set_price` and unreachable by the
      // player — a price the game starts at and can never return to.
      if (
        product.defaultPriceCents < product.priceRange.minCents ||
        product.defaultPriceCents > product.priceRange.maxCents
      ) {
        errors.push(invalidState(`${path}.defaultPriceCents`));
      }
    }
  }

  const roleIds = new Set<string>();
  for (const role of content.staffRoleDefinitions) {
    if (!isNonNegativeInteger(role.hireCostCents)) {
      errors.push(invalidState(`staffRoleDefinitions.${role.id}.hireCostCents`));
    }
    if (role.maxCount !== null && !isPositiveInteger(role.maxCount)) {
      errors.push(invalidState(`staffRoleDefinitions.${role.id}.maxCount`));
    }
    if (roleIds.has(role.id)) {
      errors.push(duplicateId(role.id));
    }
    roleIds.add(role.id);
  }

  const objectiveIds = new Set<string>();
  for (const objective of content.objectiveDefinitions) {
    if (!Number.isInteger(objective.target)) {
      errors.push(invalidState(`objectiveDefinitions.${objective.id}.target`));
    }
    if (objectiveIds.has(objective.id)) {
      errors.push(duplicateId(`objectiveDefinitions.${objective.id}`));
    }
    objectiveIds.add(objective.id);
  }

  return errors;
}

function rotatedFootprint(
  definition: WorldGraphBuildingDefinition,
  rotation: 0 | 90 | 180 | 270,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: definition.height, height: definition.width }
    : { width: definition.width, height: definition.height };
}

function isWalkable(terrain: string): boolean {
  return terrain === "empty" || terrain === "path";
}

/**
 * Pre-placed buildings get the same footprint rules the `build` reducer enforces (§15). A
 * scenario that loads with a building silently dropped, out of bounds or overlapping is
 * worse than one that refuses to load — `initialState` cannot report an error, so this is
 * the only place it can be caught.
 */
function validateReferences(content: WorldGraphCampaign): Issue[] {
  const errors: Issue[] = [];
  const definitions = new Map(content.buildingDefinitions.map((building) => [building.id, building]));
  const roleIds = new Set(content.staffRoleDefinitions.map((role) => role.id));
  const zoneIds = new Set(content.map.zones.map((zone) => zone.id));
  const terrain = new Map(content.map.terrain.map((cell) => [`${cell.x},${cell.y}`, cell.terrain]));

  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

  content.startingBuildings?.forEach((start, index) => {
    const path = `startingBuildings.${index}`;
    const definition = definitions.get(start.definitionId);
    if (!definition) {
      errors.push(invalidState(`${path}.definitionId`));
      return;
    }

    const { width, height } = rotatedFootprint(definition, start.rotation);

    if (
      !isNonNegativeInteger(start.x) ||
      !isNonNegativeInteger(start.y) ||
      start.x + width > content.map.width ||
      start.y + height > content.map.height
    ) {
      errors.push(invalidState(`${path}.position`));
      return;
    }

    for (let cx = start.x; cx < start.x + width; cx += 1) {
      for (let cy = start.y; cy < start.y + height; cy += 1) {
        const cell = terrain.get(`${cx},${cy}`);
        if (cell === undefined || !definition.allowedTerrain.includes(cell) || !isWalkable(cell)) {
          errors.push(invalidState(`${path}.terrain`));
          return;
        }
      }
    }

    const overlaps = placed.some(
      (other) =>
        start.x < other.x + other.width &&
        start.x + width > other.x &&
        start.y < other.y + other.height &&
        start.y + height > other.y,
    );
    if (overlaps) {
      errors.push(invalidState(`${path}.overlap`));
      return;
    }

    placed.push({ x: start.x, y: start.y, width, height });
  });

  content.startingStaff?.forEach((staff, index) => {
    const path = `startingStaff.${index}`;
    if (!roleIds.has(staff.roleId)) {
      errors.push(invalidState(`${path}.roleId`));
    }
    if (
      !isNonNegativeInteger(staff.x) ||
      !isNonNegativeInteger(staff.y) ||
      staff.x >= content.map.width ||
      staff.y >= content.map.height
    ) {
      errors.push(invalidState(`${path}.position`));
    }
    if (staff.assignedZoneId != null && !zoneIds.has(staff.assignedZoneId)) {
      errors.push(invalidState(`${path}.assignedZoneId`));
    }
  });

  return errors;
}

/**
 * Tier 2 — legal campaigns that are almost always authoring errors (§15). A scenario
 * already resolved at tick 0, and its mirror image, one that can never resolve at all.
 */
function validateResolvability(content: WorldGraphCampaign): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (content.objectiveDefinitions.length === 0) {
    warnings.push({
      code: "requirement_unmet",
      messageKey: "core.reason.requirement_unmet",
      path: "objectiveDefinitions",
    });
    return warnings;
  }

  if (content.objectiveDefinitions.every((objective) => objective.target <= 0)) {
    warnings.push({
      code: "requirement_unmet",
      messageKey: "core.reason.requirement_unmet",
      path: "objectiveDefinitions",
    });
  }

  return warnings;
}

export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as WorldGraphCampaign;

  const errors = [
    ...validateFinances(content, strings),
    ...validateTerrain(content),
    ...validateIdShapes(content),
    ...validateDefinitions(content),
    ...validateReferences(content),
  ];

  return {
    ok: errors.length === 0,
    errors: errors.map((error) => ({
      code: error.code,
      messageKey: error.messageKey,
      path: error.path,
    })),
    warnings: validateResolvability(content),
  };
}
