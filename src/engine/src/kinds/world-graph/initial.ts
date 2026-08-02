/**
 * World-graph kind — `Kind.initialState` (12-world-graph-kind.md §3, §4).
 *
 * This reducer builds deterministic runtime state from authored campaign content.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { InitialStateResult } from "../../core/kernel/types.js";
import type { WorldGraphCampaign } from "./campaign.js";
import type { Building, ConstructionSite, Queue, WorldGraphKindState } from "./state.js";
import { resolveStatus } from "./outcome.js";

type StartingBuilding = NonNullable<WorldGraphCampaign["startingBuildings"]>[number];

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function defaultFinances(content: WorldGraphCampaign["startingFinances"]): WorldGraphKindState["finances"] {
  return {
    cashCents: content.cashCents,
    revenueTodayCents: content.revenueTodayCents ?? 0,
    expensesTodayCents: content.expensesTodayCents ?? 0,
    revenueTotalCents: content.revenueTotalCents ?? 0,
    expensesTotalCents: content.expensesTotalCents ?? 0,
    loan: content.loan ?? null,
  };
}

function rotateDimension(
  definition: WorldGraphCampaign["buildingDefinitions"][number],
  rotation: StartingBuilding["rotation"],
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: definition.height, height: definition.width };
  }

  return { width: definition.width, height: definition.height };
}

function makeQueue(productId: string, nextOrdinal: number, startedAtTick: number): Queue {
  return {
    id: `queue:${nextOrdinal}`,
    productId,
    guestIds: [],
    maxLength: null,
    patienceTicks: 30,
    startedAtTick,
  };
}

function buildStartingBuilding(
  placement: StartingBuilding,
  definition: WorldGraphCampaign["buildingDefinitions"][number],
  nextOrdinal: number,
): { building: Building; queue: Queue } {
  const { width, height } = rotateDimension(definition, placement.rotation);
  const firstProduct = definition.products[0]?.id ?? "product";
  const queue = makeQueue(firstProduct, nextOrdinal + 1, placement.buildStartTick ?? 0);
  const products = definition.products.map((product) => product.id);
  const pricesCents = Object.fromEntries(
    products.map((productId) => {
      const product = definition.products.find((candidate) => candidate.id === productId);
      return [productId, product?.defaultPriceCents ?? 0];
    }),
  ) as Readonly<Record<string, number>>;

  return {
    building: {
      id: `building:${nextOrdinal}`,
      definitionId: definition.id,
      x: placement.x,
      y: placement.y,
      width,
      height,
      rotation: placement.rotation,
      status: "open",
      isOpen: true,
      buildStartTick: placement.buildStartTick ?? 0,
      wear: 100,
      cleanliness: 100,
      queue,
      products,
      pricesCents,
      serviceTickSeq: 0,
    },
    queue,
  };
}

function initialObjectives(objectives: readonly WorldGraphCampaign["objectiveDefinitions"][number][]): WorldGraphKindState["objectives"] {
  return objectives.map((objective) => ({
    id: objective.id,
    state: objective.target <= 0 ? "met" : "active",
    value: objective.target <= 0 ? objective.target : 0,
    target: objective.target,
    updatedAtTick: 0,
  }));
}

export function initialState(campaign: Campaign): InitialStateResult<WorldGraphKindState> {
  const content = campaign.content as WorldGraphCampaign;

  let nextEntityOrdinal = 0;

  const startingBuildings = content.startingBuildings ?? [];
  const startingStaff = content.startingStaff ?? [];

  const buildings: Building[] = [];
  for (const placement of startingBuildings) {
    const definition = content.buildingDefinitions.find((entry) => entry.id === placement.definitionId);
    if (!definition) {
      continue;
    }

    if (!isPositiveInteger(definition.width) || !isPositiveInteger(definition.height)) {
      continue;
    }
    if (!isPositiveInteger(definition.costCents)) {
      continue;
    }

    const { building } = buildStartingBuilding(placement, definition, nextEntityOrdinal);
    buildings.push(building);
    nextEntityOrdinal += 2;
  }

  const staff = startingStaff
    .filter((entry) => content.staffRoleDefinitions.some((role) => role.id === entry.roleId))
    .map((entry) => {
      const staffId = `staff:${nextEntityOrdinal}`;
      nextEntityOrdinal += 1;
      return {
        id: staffId,
        roleId: entry.roleId,
        x: isPositiveInteger(entry.x) ? entry.x : 0,
        y: isPositiveInteger(entry.y) ? entry.y : 0,
        status: "off_duty" as const,
        assignedBuildingId: entry.assignedBuildingId ?? null,
        assignedZoneId: entry.assignedZoneId ?? null,
        zoneId: null,
        drawCount: 0,
        task: null,
        tasksCompleted: 0,
      } as const;
    });

  const initial: WorldGraphKindState = {
    tick: 0,
    map: content.map,
    finances: defaultFinances(content.startingFinances),

    buildings,
    constructionSites: [] as ConstructionSite[],
    guests: [],
    staff,

    incidents: [],
    objectives: initialObjectives(content.objectiveDefinitions),
    alerts: [],

    nextEntityOrdinal,
  };

  return {
    state: initial,
    status: resolveStatus(initial),
    changes: [],
    messages: [],
  };
}
