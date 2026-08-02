/**
 * World-graph reason codes and shipped English messages (12-world-graph-kind.md §11).
 *
 * Mirrors `core/kernel/reasons.ts` and other kind-specific reason modules exactly:
 * `WORLD_GRAPH_REASON_CODES`, one message table with every code, and
 * `WORLD_GRAPH_REASON_MESSAGES` under the `world-graph.reason.*` namespace.
 */

import type { LocKey } from "../../core/localization/types.js";

export const WORLD_GRAPH_REASON_CODES = [
  "insufficient_funds",
  "placement_overlaps",
  "placement_terrain_unsuitable",
  "placement_out_of_bounds",
  "placement_unreachable",
  "building_locked",
  "unknown_entity",
  "building_not_open",
  "price_out_of_range",
  "staff_limit_reached",
  "ticks_not_positive",
  "tick_limit_reached",
] as const;

export type WorldGraphReasonCode = (typeof WORLD_GRAPH_REASON_CODES)[number];

const WORLD_GRAPH_REASON_TEXT: Readonly<Record<WorldGraphReasonCode, string>> = {
  insufficient_funds: "You don't have enough cash to perform that action.",
  placement_overlaps: "That placement intersects an existing structure.",
  placement_terrain_unsuitable: "This building cannot be placed on that terrain.",
  placement_out_of_bounds: "That building would not fit inside the map.",
  placement_unreachable: "The placed building could not be reached from a guest spawn point.",
  building_locked: "That building definition is not unlocked yet.",
  unknown_entity: "That building, staff member, zone, or alert doesn't exist.",
  building_not_open: "That building must be open to perform this action.",
  price_out_of_range: "That price is outside the allowed range for this product.",
  staff_limit_reached: "This role has reached its campaign limit.",
  ticks_not_positive: "AdvanceTicks requires a positive integer.",
  tick_limit_reached: "AdvanceTicks exceeds the campaign's per-action batch cap.",
};

/** `world-graph.reason.<code>` → its shipped default-English message, for every code. */
export const WORLD_GRAPH_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  WORLD_GRAPH_REASON_CODES.map((code) => [`world-graph.reason.${code}`, WORLD_GRAPH_REASON_TEXT[code]] as const),
);
