/**
 * World-graph kind — `Kind.advance` (12-world-graph-kind.md §4, §6).
 *
 * The nine no-time-passes reducers. The tick pipeline itself is W46: `advance_ticks`
 * currently advances the counter and nothing else.
 */

import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
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

/** Every accepted action returns through here, so `status` always reflects the state
 *  being returned rather than the one the reducer started from. */
function accepted(
  state: WorldGraphKindState,
  changes: StateChange[],
): AdvanceResult<WorldGraphKindState> {
  return {
    state,
    status: resolveStatus(state),
    changes,
    messages: [],
  };
}

/**
 * `op` is always `"set"` and `value` is always the state *after* (12 §13). 04 §12 offers
 * `increment`/`decrement` but defines no `value` semantics for them — delta or result? — so
 * a `decrement` row is read two ways by two consumers. 04's own examples and 03 §5 both use
 * `set` with `value` + `previous`; a consumer wanting the delta subtracts.
 */
function change(
  path: string,
  op: StateChange["op"],
  value: string | number | boolean,
  reason: string,
  visible: boolean,
  previous?: string | number | boolean,
): StateChange {
  return previous === undefined
    ? { path, op, value, reason, visible }
    : { path, op, value, previous, reason, visible };
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

function footprintInBounds(
  map: WorldGraphKindState["map"],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return inBounds(map.width, map.height, x, y) && inBounds(map.width, map.height, x + width - 1, y + height - 1);
}

/**
 * Bounds are checked separately by the caller, so this reports terrain alone — the two have
 * distinct reason codes (§11) and folding them loses the one the player needs.
 *
 * `allowedTerrain` is the whole rule. An additional hard-coded walkable check would make a
 * definition that declares `water` or `restricted` unplaceable on the terrain it declares,
 * which reads as the definition being ignored rather than enforced — a pier over water is
 * the ordinary case, not an edge one. Whether *guests* can get there is a separate
 * question, answered by `reachableFromSpawn` with its own reason code.
 */
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
      const cell = terrainAt(map, cx, cy);
      if (!cell || !definition.allowedTerrain.includes(cell.terrain as never)) {
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

/**
 * A guest reaches a building's **edge**, not its interior — so this walks the walkable graph
 * from every spawn point and asks whether it ever lands orthogonally adjacent to the
 * footprint. The footprint's own cells are excluded from the walk: once placed, the building
 * occupies them, and a route *through* the building it is trying to reach is not a route.
 *
 * That distinction only became load-bearing when `allowedTerrain` stopped being intersected
 * with walkability — a pier on water has no walkable cell of its own, and reachability must
 * still be answerable for it.
 */
function reachableFromSpawn(
  map: WorldGraphKindState["map"],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (map.spawnPoints.length === 0) {
    return false;
  }

  const footprint = new Set<string>();
  for (let cx = x; cx < x + width; cx += 1) {
    for (let cy = y; cy < y + height; cy += 1) {
      footprint.add(`${cx},${cy}`);
    }
  }

  const walkable = new Set<string>();
  for (const cell of map.terrain) {
    if (isWalkable(cell.terrain) && !footprint.has(`${cell.x},${cell.y}`)) {
      walkable.add(`${cell.x},${cell.y}`);
    }
  }

  const neighbours = (cell: { x: number; y: number }) => [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];

  const queue: Array<{ x: number; y: number }> = [...map.spawnPoints];
  const visited = new Set<string>(queue.map((cell) => `${cell.x},${cell.y}`));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (neighbours(current).some((cell) => footprint.has(`${cell.x},${cell.y}`))) {
      return true;
    }

    for (const nextCell of neighbours(current)) {
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

function nextStaffId(nextEntityOrdinal: number): string {
  return `staff:${nextEntityOrdinal}`;
}

function advanceTicksInRange(campaign: WorldGraphCampaign, ticks: number): boolean {
  return ticks > 0 && ticks <= campaign.maxAdvanceTicksPerAction;
}

/**
 * Cash out is an expense. Subtracting `cashCents` without recording it leaves the
 * accumulators disagreeing with the cash movement that produced them — and unlike cash,
 * today's spend cannot be recovered afterwards, which is why §3.3 keeps the accumulators
 * at all.
 */
function spend(finances: WorldGraphKindState["finances"], amountCents: number): WorldGraphKindState["finances"] {
  return {
    ...finances,
    cashCents: finances.cashCents - amountCents,
    expensesTodayCents: finances.expensesTodayCents + amountCents,
    expensesTotalCents: finances.expensesTotalCents + amountCents,
  };
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
        return rejected(state, "building_limit_reached", "world-graph.reason.building_limit_reached");
      }
    }

    const { width, height } = rotatedDimensions(definition, rotation);

    if (!footprintInBounds(state.map, x, y, width, height)) {
      return rejected(state, "placement_out_of_bounds", "world-graph.reason.placement_out_of_bounds");
    }

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
      nextEntityOrdinal: state.nextEntityOrdinal + 3,
      finances: spend(state.finances, definition.costCents),
      alerts: [
        ...state.alerts,
        {
          id: `alert:${state.nextEntityOrdinal + 2}`,
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

    return accepted(nextState, [
      change(
        "finances.cashCents",
        "set",
        nextState.finances.cashCents,
        "building_placed",
        true,
        state.finances.cashCents,
      ),
      change(`buildings.${buildingId}.exists`, "set", true, "building_placed", false),
    ]);
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

    const target = state.buildings.find((building) => building.id === buildingId);
    if (!target) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const queueId = target.queue.id;

    const nextState: WorldGraphKindState = {
      ...state,
      buildings: state.buildings.filter((building) => building.id !== buildingId),
      staff: state.staff.map((member) =>
        member.assignedBuildingId === buildingId
          ? { ...member, assignedBuildingId: null, status: "off_duty", task: null }
          : member,
      ),
      // Guests navigating to the building, or standing in its queue, would otherwise hold
      // references to an entity that no longer exists.
      guests: state.guests.map((guest) =>
        guest.targetBuildingId === buildingId || guest.targetQueueId === queueId
          ? {
              ...guest,
              lifecycle: guest.lifecycle === "queued" ? "seeking" : guest.lifecycle,
              targetBuildingId: null,
              targetQueueId: null,
              targetProductId: null,
              path: [],
              pathIndex: 0,
            }
          : guest,
      ),
      // Alerts are dismissed, never deleted: an alert persists until the player dismisses
      // it (§3), and silently dropping an undismissed one destroys a record the player
      // never saw.
      alerts: state.alerts.map((alert) =>
        alert.entityId === buildingId && alert.dismissedAtTick === null
          ? { ...alert, dismissedAtTick: state.tick }
          : alert,
      ),
    };

    emitEvent(ctx, "kind.world-graph.building.demolished", "debug", { buildingId });

    return accepted(nextState, [
      change(`buildings.${buildingId}.exists`, "set", false, "building_demolished", false, true),
    ]);
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
          drawCount: 0,
          task: null,
          tasksCompleted: 0,
        },
      ],
      finances: spend(state.finances, role.hireCostCents),
    };

    emitEvent(ctx, "kind.world-graph.staff.hired", "info", { staffId, roleId });

    return accepted(nextState, [
      change(
        "finances.cashCents",
        "set",
        nextState.finances.cashCents,
        "staff_hired",
        true,
        state.finances.cashCents,
      ),
      change(`staff.${staffId}.exists`, "set", true, "staff_hired", false),
    ]);
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

    return accepted(nextState, [
      change(`staff.${staffId}.exists`, "set", false, "staff_fired", false, true),
    ]);
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
    // `unknown_entity` names zones in its own message, so an unchecked zone id would store
    // a dangling reference the reason code claims to prevent.
    if (zoneId !== undefined && !state.map.zones.some((zone) => zone.id === zoneId)) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const staff = state.staff.find((entry) => entry.id === staffId);
    if (!staff) {
      return rejected(state, "unknown_entity", "world-graph.reason.unknown_entity");
    }

    const nextBuildingAssignment = buildingId ?? null;
    const nextZoneAssignment = zoneId ?? null;

    const nextState: WorldGraphKindState = {
      ...state,
      staff: state.staff.map((entry) =>
        entry.id === staff.id
          ? {
              ...entry,
              assignedBuildingId: nextBuildingAssignment,
              assignedZoneId: nextZoneAssignment,
            }
          : entry,
      ),
    };

    emitEvent(ctx, "kind.world-graph.staff.assigned", "trace", {
      staffId,
      buildingId: buildingId ?? "",
      zoneId: zoneId ?? "",
    });

    return accepted(nextState, [
      change(
        `staff.${staffId}.assignedBuildingId`,
        "set",
        nextBuildingAssignment ?? "",
        "staff_assigned",
        true,
        staff.assignedBuildingId ?? "",
      ),
      change(
        `staff.${staffId}.assignedZoneId`,
        "set",
        nextZoneAssignment ?? "",
        "staff_assigned",
        true,
        staff.assignedZoneId ?? "",
      ),
    ]);
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

    const previousPrice = building.pricesCents[productId];
    if (previousPrice === priceCents) {
      return accepted(state, []);
    }

    const nextState: WorldGraphKindState = {
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
    };

    return accepted(nextState, [
      change(
        `buildings.${buildingId}.pricesCents.${productId}`,
        "set",
        priceCents,
        "price_set",
        true,
        previousPrice,
      ),
    ]);
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
      return accepted(state, []);
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

    return accepted(nextState, [
      change(
        `buildings.${buildingId}.isOpen`,
        "set",
        open,
        open ? "building_opened" : "building_closed",
        true,
        building.isOpen,
      ),
    ]);
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
    if (alert.dismissedAtTick !== null) {
      return accepted(state, []);
    }

    alerts[index] = {
      ...alert,
      dismissedAtTick: state.tick,
    };

    emitEvent(ctx, "kind.world-graph.alert.dismissed", "trace", { alertId });

    return accepted({ ...state, alerts }, [
      change(`alerts.${alertId}.dismissedAtTick`, "set", state.tick, "alert_dismissed", true),
    ]);
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

    emitEvent(ctx, "kind.world-graph.batch.started", "debug", { ticks, tick: state.tick });

    // W46 runs the 20-system pipeline here. Until it does, the batch is the counter alone —
    // which satisfies batch invariance (§5) vacuously rather than demonstrating it.
    const nextState: WorldGraphKindState = {
      ...state,
      tick: state.tick + ticks,
    };

    emitEvent(ctx, "kind.world-graph.batch.ended", "debug", { ticks, tick: nextState.tick });

    return accepted(nextState, [
      change("tick", "set", nextState.tick, "ticks_advanced", true, state.tick),
    ]);
  }

  return rejected(state, "unknown_action", "core.reason.unknown_action");
}
