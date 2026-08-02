/**
 * World-graph kind — `Kind.advance` (12-world-graph-kind.md §4, §6).
 *
 * Conservative world-graph reducer for non-temporal actions. The tick pipeline itself is W44.
 */

import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import { resolveStatus } from "./outcome.js";
import type {
  WorldGraphCampaign,
  WorldGraphBuildingDefinition,
  WorldGraphProductDefinition,
  WorldGraphStaffRoleDefinition,
} from "./campaign.js";
import type {
  Alert,
  Building,
  ConstructionSite,
  Queue,
  WorldGraphKindState,
} from "./state.js";

function rejected(
  state: WorldGraphKindState,
  code: string,
  messageKey: string,
  visible = true,
): AdvanceResult<WorldGraphKindState> {
  return {
    state,
    status: resolveStatus(state),
    changes: [],
    messages: visible ? [{ key: messageKey, visible: true }] : [],
    error: { code, messageKey },
  };
}

function asRecord(value: ActionParams | undefined): Record<string, string | number | boolean> | undefined {
  return typeof value === "object" && value !== null ? value : undefined;
}

function integerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function parseNumber(params: Record<string, string | number | boolean>, key: string): number | undefined {
  return integerValue(params[key]);
}

function parseString(params: Record<string, string | number | boolean>, key: string): string | undefined {
  return typeof params[key] === "string" ? params[key] : undefined;
}

function parseRotation(params: Record<string, string | number | boolean>): 0 | 90 | 180 | 270 | undefined {
  const rotation = parseNumber(params, "rotation");
  if (rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation;
  }
  return undefined;
}

function isWalkable(terrain: string): boolean {
  return terrain === "empty" || terrain === "path";
}

function inBounds(mapWidth: number, mapHeight: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < mapWidth && y < mapHeight;
}

function rotatedDimensions(
  definition: WorldGraphBuildingDefinition,
  rotation: 0 | 90 | 180 | 270,
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: definition.height, height: definition.width };
  }
  return { width: definition.width, height: definition.height };
}

function terrainAt(map: WorldGraphKindState["map"], x: number, y: number): { terrain: string } | undefined {
  return map.terrain.find((cell) => cell.x === x && cell.y === y);
}

function buildPlacementTerrainOk(
  map: WorldGraphKindState["map"],
  definition: WorldGraphBuildingDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  for (let cx = x; cx < x + width; cx += 1) {
    for (let cy = y; cy < y + height; cy += 1) {
      if (!inBounds(map.width, map.height, cx, cy)) {
        return false;
      }
      const cell = terrainAt(map, cx, cy);
      if (!cell || !definition.allowedTerrain.includes(cell.terrain as never) || !isWalkable(cell.terrain)) {
        return false;
      }
    }
  }
  return true;
}

function overlapsExisting(
  buildings: readonly Building[],
  sites: readonly ConstructionSite[],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  for (const building of buildings) {
    if (x < building.x + building.width && x + width > building.x && y < building.y + building.height && y + height > building.y) {
      return true;
    }
  }
  for (const site of sites) {
    if (x < site.x + site.width && x + width > site.x && y < site.y + site.height && y + height > site.y) {
      return true;
    }
  }
  return false;
}

function reachableFromSpawn(
  map: WorldGraphKindState["map"],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const walkable = new Set<string>();
  for (const cell of map.terrain) {
    if (isWalkable(cell.terrain)) {
      walkable.add(`${cell.x},${cell.y}`);
    }
  }

  if (map.spawnPoints.length === 0) {
    return false;
  }

  const targetCells = new Set<string>();
  for (let cx = x; cx < x + width; cx += 1) {
    for (let cy = y; cy < y + height; cy += 1) {
      targetCells.add(`${cx},${cy}`);
    }
  }

  const queue: Array<{ x: number; y: number }> = [...map.spawnPoints];
  const visited = new Set<string>(queue.map((cell) => `${cell.x},${cell.y}`));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (targetCells.has(`${current.x},${current.y}`)) {
      return true;
    }

    const next = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const nextCell of next) {
      const key = `${nextCell.x},${nextCell.y}`;
      if (!walkable.has(key) || visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(nextCell);
    }
  }

  return false;
}

function definitionForProduct(
  definition: WorldGraphBuildingDefinition,
  productId: string,
): WorldGraphProductDefinition | undefined {
  return definition.products.find((product) => product.id === productId);
}

function roleLimitExceeded(state: WorldGraphKindState, role: WorldGraphStaffRoleDefinition): boolean {
  if (role.maxCount === null) {
    return false;
  }
  const existing = state.staff.filter((member) => member.roleId === role.id).length;
  return existing >= role.maxCount;
}

function buildQueue(nextQueueId: number, definition: WorldGraphBuildingDefinition, startedAtTick: number): Queue {
  const initialProduct = definition.products[0]?.id ?? "product";
  return {
    id: `queue:${nextQueueId}`,
    productId: initialProduct,
    guestIds: [],
    maxLength: null,
    patienceTicks: 30,
    startedAtTick,
  };
}

function buildingDefaults(definition: WorldGraphBuildingDefinition): Readonly<Record<string, number>> {
  return Object.fromEntries(
    definition.products.map((product) => [product.id, product.defaultPriceCents]),
  ) as Readonly<Record<string, number>>;
}

function emitEvent(ctx: KindContext, name: string, severity: "trace" | "debug" | "info" | "warn" | "error", data?: Record<string, string | number | boolean>) {
  if (data === undefined) {
    ctx.emit.emit(name, severity, {});
  } else {
    ctx.emit.emit(name, severity, { data });
  }
}

function nextBuildingId(nextEntityOrdinal: number): string {
  return `building:${nextEntityOrdinal}`;
}

function nextQueueId(nextEntityOrdinal: number): string {
  return `queue:${nextEntityOrdinal}`;
}

function nextStaffId(nextEntityOrdinal: number): string {
  return `staff:${nextEntityOrdinal}`;
}

function advanceTicksInRange(campaign: WorldGraphCampaign, ticks: number): boolean {
  return ticks > 0 && ticks <= campaign.maxAdvanceTicksPerAction;
}

export function advance(
  state: WorldGraphKindState,
  actionId: string,
  params: ActionParams | undefined,
  ctx: KindContext,
): AdvanceResult<WorldGraphKindState> {
  const campaign = ctx.campaign.content as WorldGraphCampaign;

  if (actionId === "build") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const definitionId = parseString(as, "definitionId");
    const x = parseNumber(as, "x");
    const y = parseNumber(as, "y");
    const rotation = parseRotation(as);

    if (definitionId === undefined || x === undefined || y === undefined || rotation === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const definition = campaign.buildingDefinitions.find((entry) => entry.id === definitionId);
    if (!definition) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    if (definition.unlockAfterTick !== undefined && definition.unlockAfterTick > state.tick) {
      return rejected(state, "building_locked", "world-graph.reason.building_locked");
    }

    if (definition.costCents > state.finances.cashCents) {
      return rejected(state, "insufficient_funds", "world-graph.reason.insufficient_funds");
    }

    if (definition.maxCount !== null) {
      const existing = state.buildings.filter((building) => building.definitionId === definition.id).length;
      if (existing >= definition.maxCount) {
        return rejected(state, "action_not_available", "world-graph.reason.unknown_entity");
      }
    }

    const { width, height } = rotatedDimensions(definition, rotation);

    if (!buildPlacementTerrainOk(state.map, definition, x, y, width, height)) {
      return rejected(state, "placement_terrain_unsuitable", "world-graph.reason.placement_terrain_unsuitable");
    }

    if (overlapsExisting(state.buildings, state.constructionSites, x, y, width, height)) {
      return rejected(state, "placement_overlaps", "world-graph.reason.placement_overlaps");
    }

    if (!reachableFromSpawn(state.map, x, y, width, height)) {
      return rejected(state, "placement_unreachable", "world-graph.reason.placement_unreachable");
    }

    const buildingId = nextBuildingId(state.nextEntityOrdinal);
    const queue = buildQueue(state.nextEntityOrdinal + 1, definition, state.tick);

    const nextState: WorldGraphKindState = {
      ...state,
      buildings: [
        ...state.buildings,
        {
          id: buildingId,
          definitionId: definition.id,
          x,
          y,
          width,
          height,
          rotation,
          status: "open",
          isOpen: true,
          buildStartTick: state.tick,
          wear: 100,
          cleanliness: 100,
          queue,
          products: definition.products.map((product) => product.id),
          pricesCents: buildingDefaults(definition),
          serviceTickSeq: 0,
        },
      ],
      nextEntityOrdinal: state.nextEntityOrdinal + 2,
      finances: {
        ...state.finances,
        cashCents: state.finances.cashCents - definition.costCents,
      },
      alerts: [
        ...state.alerts,
        {
          id: nextQueueId(state.nextEntityOrdinal + 2),
          type: "construction",
          severity: "info",
          titleKey: "world-graph.alert.building.placed.title",
          messageKey: "world-graph.alert.building.placed.message",
          entityId: buildingId,
          issuedAtTick: state.tick,
          dismissedAtTick: null,
        },
      ],
    };

    emitEvent(ctx, "kind.world-graph.building.placed", "info", { buildingId });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "demolish") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const buildingId = parseString(as, "buildingId");
    if (buildingId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const exists = state.buildings.some((building) => building.id === buildingId);
    if (!exists) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const nextState: WorldGraphKindState = {
      ...state,
      buildings: state.buildings.filter((building) => building.id !== buildingId),
      staff: state.staff.map((member) =>
        member.assignedBuildingId === buildingId
          ? { ...member, assignedBuildingId: null, status: "off_duty", task: null }
          : member,
      ),
      alerts: state.alerts.filter((alert) => alert.entityId !== buildingId),
    };

    emitEvent(ctx, "kind.world-graph.building.demolished", "debug", { buildingId });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "hire_staff") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const roleId = parseString(as, "roleId");
    if (roleId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const role = campaign.staffRoleDefinitions.find((entry) => entry.id === roleId);
    if (!role) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }
    if (roleLimitExceeded(state, role)) {
      return rejected(state, "staff_limit_reached", "world-graph.reason.staff_limit_reached");
    }
    if (role.hireCostCents > state.finances.cashCents) {
      return rejected(state, "insufficient_funds", "world-graph.reason.insufficient_funds");
    }

    const staffId = nextStaffId(state.nextEntityOrdinal);
    const nextState: WorldGraphKindState = {
      ...state,
      nextEntityOrdinal: state.nextEntityOrdinal + 1,
      staff: [
        ...state.staff,
        {
          id: staffId,
          roleId,
          x: 0,
          y: 0,
          status: "off_duty",
          assignedBuildingId: null,
          assignedZoneId: null,
          zoneId: null,
          drawCount: 0,
          task: null,
          tasksCompleted: 0,
        },
      ],
      finances: {
        ...state.finances,
        cashCents: state.finances.cashCents - role.hireCostCents,
      },
    };

    emitEvent(ctx, "kind.world-graph.staff.hired", "info", { staffId, roleId });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "fire_staff") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }
    const staffId = parseString(as, "staffId");
    if (staffId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }
    if (!state.staff.some((staff) => staff.id === staffId)) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const nextState: WorldGraphKindState = {
      ...state,
      staff: state.staff.filter((staff) => staff.id !== staffId),
    };

    emitEvent(ctx, "kind.world-graph.staff.fired", "debug", { staffId });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "assign_staff") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const staffId = parseString(as, "staffId");
    const buildingId = parseString(as, "buildingId");
    const zoneId = parseString(as, "zoneId");

    if (staffId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }
    if (buildingId === undefined && zoneId === undefined) {
      return rejected(state, "requirement_unmet", "core.reason.requirement_unmet");
    }
    if (buildingId !== undefined && !state.buildings.some((building) => building.id === buildingId)) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const staff = state.staff.find((entry) => entry.id === staffId);
    if (!staff) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const nextState: WorldGraphKindState = {
      ...state,
      staff: state.staff.map((entry) =>
        entry.id === staff.id
          ? {
              ...entry,
              assignedBuildingId: buildingId ?? null,
              assignedZoneId: zoneId ?? null,
              zoneId: zoneId ?? entry.zoneId,
            }
          : entry,
      ),
    };

    emitEvent(ctx, "kind.world-graph.staff.assigned", "trace", {
      staffId,
      buildingId: buildingId ?? "",
      zoneId: zoneId ?? "",
    });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "set_price") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const buildingId = parseString(as, "buildingId");
    const productId = parseString(as, "productId");
    const priceCents = parseNumber(as, "priceCents");

    if (buildingId === undefined || productId === undefined || priceCents === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const building = state.buildings.find((entry) => entry.id === buildingId);
    if (!building) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }
    if (!building.isOpen || !building.products.includes(productId)) {
      return rejected(state, "building_not_open", "world-graph.reason.building_not_open");
    }

    const definition = campaign.buildingDefinitions.find((entry) => entry.id === building.definitionId);
    if (!definition) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const product = definitionForProduct(definition, productId);
    if (!product) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }
    if (priceCents < product.priceRange.minCents || priceCents > product.priceRange.maxCents) {
      return rejected(state, "price_out_of_range", "world-graph.reason.price_out_of_range");
    }
    if (building.pricesCents[productId] === priceCents) {
      return { state, status: resolveStatus(state), changes: [], messages: [] };
    }

    return {
      state: {
        ...state,
        buildings: state.buildings.map((entry) =>
          entry.id === building.id
            ? {
                ...entry,
                pricesCents: {
                  ...entry.pricesCents,
                  [productId]: priceCents,
                },
              }
            : entry,
        ),
      },
      status: resolveStatus(state),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "open_building" || actionId === "close_building") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const buildingId = parseString(as, "buildingId");
    if (buildingId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const open = actionId === "open_building";
    const building = state.buildings.find((entry) => entry.id === buildingId);
    if (!building) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }
    if (building.isOpen === open) {
      return { state, status: resolveStatus(state), changes: [], messages: [] };
    }

    const nextState: WorldGraphKindState = {
      ...state,
      buildings: state.buildings.map((entry) =>
        entry.id === building.id
          ? {
              ...entry,
              isOpen: open,
              status: open ? "open" : "closed",
            }
          : entry,
      ),
    };

    emitEvent(ctx, "kind.world-graph.building.status.changed", "debug", {
      buildingId,
      open,
    });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "dismiss_alert") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const alertId = parseString(as, "alertId");
    if (alertId === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const alerts: Alert[] = [...state.alerts];
    const index = alerts.findIndex((entry) => entry.id === alertId);
    if (index < 0) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }
    const alert = alerts[index];
    if (alert === undefined) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    alerts[index] = {
      ...alert,
      dismissedAtTick: state.tick,
    };

    emitEvent(ctx, "kind.world-graph.alert.dismissed", "trace", { alertId });

    return {
      state: {
        ...state,
        alerts,
      },
      status: resolveStatus(state),
      changes: [],
      messages: [],
    };
  }

  if (actionId === "advance_ticks") {
    const as = asRecord(params);
    if (!as) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }

    const ticks = parseNumber(as, "ticks");
    if (ticks === undefined) {
      return rejected(state, "unknown_action", "core.reason.unknown_action");
    }
    if (!advanceTicksInRange(campaign, ticks)) {
      return ticks > 0
        ? rejected(state, "tick_limit_reached", "world-graph.reason.tick_limit_reached")
        : rejected(state, "ticks_not_positive", "world-graph.reason.ticks_not_positive");
    }

    const nextState: WorldGraphKindState = {
      ...state,
      tick: state.tick + ticks,
    };

    emitEvent(ctx, "kind.world-graph.scenario.resolved", "debug", {
      ticks,
    });

    return {
      state: nextState,
      status: resolveStatus(nextState),
      changes: [],
      messages: [],
    };
  }

  return rejected(state, "unknown_action", "core.reason.unknown_action");
}
