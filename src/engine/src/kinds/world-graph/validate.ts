/**
 * World-graph kind — campaign validation (12-world-graph-kind.md §15).
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationResult } from "../../core/validation/types.js";
import type { WorldGraphCampaign } from "./campaign.js";

function missingStringKey(path: string): { code: string; messageKey: string; path: string } {
  return {
    code: "missing_string_key",
    messageKey: "core.reason.missing_string_key",
    path,
  };
}

function invalidState(path: string): { code: string; messageKey: string; path: string } {
  return {
    code: "invalid_state",
    messageKey: "core.reason.invalid_state",
    path,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateFinances(content: WorldGraphCampaign, keys: ReadonlyMap<LocKey, string>): { path: string; code: string; messageKey: string }[] {
  const errors: { path: string; code: string; messageKey: string }[] = [];

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

function validateTerrain(content: WorldGraphCampaign): { path: string; code: string; messageKey: string }[] {
  const errors: { path: string; code: string; messageKey: string }[] = [];

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

  return errors;
}

function validateDefinitions(content: WorldGraphCampaign): { path: string; code: string; messageKey: string }[] {
  const errors: { path: string; code: string; messageKey: string }[] = [];

  if (!isPositiveInteger(content.maxAdvanceTicksPerAction)) {
    errors.push(invalidState("maxAdvanceTicksPerAction"));
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
      errors.push({ code: "duplicate_campaign_id", messageKey: "core.reason.duplicate_campaign_id", path: building.id });
    }
    buildingIds.add(building.id);

    for (const product of building.products) {
      if (!isNonNegativeInteger(product.defaultPriceCents)) {
        errors.push(invalidState(`buildingDefinitions.${building.id}.products.${product.id}.defaultPriceCents`));
      }
      if (!isNonNegativeInteger(product.priceRange.minCents) || !isNonNegativeInteger(product.priceRange.maxCents)) {
        errors.push(invalidState(`buildingDefinitions.${building.id}.products.${product.id}.priceRange`));
      }
      if (product.priceRange.minCents > product.priceRange.maxCents) {
        errors.push(invalidState(`buildingDefinitions.${building.id}.products.${product.id}.priceRange`));
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
      errors.push({ code: "duplicate_campaign_id", messageKey: "core.reason.duplicate_campaign_id", path: role.id });
    }
    roleIds.add(role.id);
  }

  for (const objective of content.objectiveDefinitions) {
    if (!Number.isInteger(objective.target)) {
      errors.push(invalidState(`objectiveDefinitions.${objective.id}.target`));
    }
  }

  return errors;
}

function validateReferences(content: WorldGraphCampaign): { path: string; code: string; messageKey: string }[] {
  const errors: { path: string; code: string; messageKey: string }[] = [];
  const buildingIds = new Set(content.buildingDefinitions.map((building) => building.id));
  const roleIds = new Set(content.staffRoleDefinitions.map((role) => role.id));

  for (const start of content.startingBuildings ?? []) {
    if (!buildingIds.has(start.definitionId)) {
      errors.push(invalidState(`startingBuildings.${start.definitionId}`));
    }
  }

  for (const staff of content.startingStaff ?? []) {
    if (!roleIds.has(staff.roleId)) {
      errors.push(invalidState(`startingStaff.${staff.roleId}`));
    }
  }

  return errors;
}

export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as WorldGraphCampaign;

  const errors = [
    ...validateFinances(content, strings),
    ...validateTerrain(content),
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
    warnings: [],
  };
}
