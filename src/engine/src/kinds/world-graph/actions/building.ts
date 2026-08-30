import type { AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import { worldGraphContent } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import { accepted, change, emit, integerParam, params, rejected, stringParam } from "./common.js";

export function setPrice(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  if (!values) return rejected(state, "core.reason.unknown_action");
  const buildingId = stringParam(values, "buildingId");
  const productId = stringParam(values, "productId");
  const priceCents = integerParam(values, "priceCents");
  if (buildingId === null || productId === null || priceCents === null) return rejected(state, "core.reason.unknown_action");
  const building = state.buildings.find((entry) => entry.id === buildingId);
  if (!building) return rejected(state, "unknown_entity");
  if (building.status !== "open") return rejected(state, "building_not_open");
  const content = worldGraphContent(ctx.campaign.content);
  const definition = content.buildings.find((entry) => entry.id === building.definitionId);
  if (!definition || definition.operation.kind !== "service" || !definition.operation.products.some((entry) => entry.productId === productId)) return rejected(state, "unknown_entity");
  const product = content.products.find((entry) => entry.id === productId);
  if (!product) throw new Error(`Validated world-graph product missing: ${productId}`);
  if (priceCents < product.price.minimumCents || priceCents > product.price.maximumCents) return rejected(state, "price_out_of_range");
  const previous = building.pricesCents[productId];
  if (previous === priceCents) return accepted(state, []);
  const next = {
    ...state,
    buildings: state.buildings.map((entry) => entry.id === buildingId
      ? { ...entry, pricesCents: { ...entry.pricesCents, [productId]: priceCents } }
      : entry),
  };
  return accepted(next, [change(`buildings.${buildingId}.pricesCents.${productId}`, priceCents, "price_set", true, previous)]);
}

export function setBuildingOpen(
  state: WorldGraphKindState,
  raw: Parameters<typeof params>[0],
  ctx: KindContext,
  open: boolean,
): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  const buildingId = values ? stringParam(values, "buildingId") : null;
  if (buildingId === null) return rejected(state, "core.reason.unknown_action");
  const building = state.buildings.find((entry) => entry.id === buildingId);
  if (!building) return rejected(state, "unknown_entity");
  if (open && building.status === "broken") return rejected(state, "core.reason.requirement_unmet");
  const desired = open ? "open" as const : "closed" as const;
  if (building.status === desired) return accepted(state, []);
  if ((!open && building.status !== "open") || (open && building.status !== "closed")) return rejected(state, "core.reason.requirement_unmet");
  const next = {
    ...state,
    buildings: state.buildings.map((entry) => entry.id === buildingId
      ? { ...entry, status: desired, queue: open ? entry.queue : { ...entry.queue, serviceStartedAtTick: null } }
      : entry),
  };
  emit(ctx, WORLD_GRAPH_EVENTS.buildingStatusChanged, { buildingId, status: desired });
  return accepted(next, [change(`buildings.${buildingId}.status`, desired, open ? "building_opened" : "building_closed", true, building.status)]);
}
