/**
 * World-graph reason codes and shipped English messages (12-world-graph-kind.md §11).
 *
 * Mirrors `core/kernel/reasons.ts` and other kind-specific reason modules exactly:
 * `WORLD_GRAPH_REASON_CODES`, one message table with every code, and
 * `WORLD_GRAPH_REASON_MESSAGES` under the `world-graph.reason.*` namespace.
 *
 * The codes below `tick_limit_reached` are the campaign-content validation codes emitted
 * by `validate.ts`'s `error()`/`warning()` helpers — one per distinct `code` string that
 * function can produce, following the same pattern `story-graph/reasons.ts` uses for its
 * own Tier 1/2 validation findings.
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
  "building_limit_reached",
  "ticks_not_positive",
  "tick_limit_reached",
  "invalid_world_graph_content",
  "invalid_id",
  "invalid_integer",
  "invalid_array",
  "invalid_definition",
  "invalid_definition_text",
  "unsafe_integer",
  "duplicate_id",
  "missing_string_key",
  "condition_depth_exceeded",
  "invalid_condition",
  "invalid_effect",
  "invalid_counter_increment",
  "unknown_reference",
  "position_out_of_bounds",
  "missing_spawn",
  "missing_exit",
  "spawn_not_traversable",
  "exit_not_traversable",
  "invalid_edge_cost",
  "invalid_footprint",
  "invalid_building_geometry",
  "invalid_cost",
  "invalid_inventory",
  "invalid_work_rate",
  "invalid_time_limit_pair",
  "invalid_kind",
  "disconnected_map",
  "inert_scenario",
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
  building_limit_reached: "You've already built as many of these as this scenario allows.",
  ticks_not_positive: "AdvanceTicks requires a positive integer.",
  tick_limit_reached: "AdvanceTicks exceeds the campaign's per-action batch cap.",
  invalid_world_graph_content: "This campaign's content isn't shaped like world-graph content.",
  invalid_id: "This campaign uses an id that is missing, empty, or contains a period.",
  invalid_integer: "This campaign has a numeric field that isn't a positive integer.",
  invalid_array: "This campaign is missing a required catalog array.",
  invalid_definition: "This campaign has a catalog entry that isn't a valid definition.",
  invalid_definition_text: "This campaign's definition is missing its name or description key.",
  unsafe_integer: "This campaign has a number outside the safe integer range.",
  duplicate_id: "This campaign uses the same id twice within one catalog.",
  missing_string_key: "This campaign references a string key that isn't declared.",
  condition_depth_exceeded: "This campaign nests a condition deeper than the allowed limit.",
  invalid_condition: "This campaign has a condition that isn't shaped correctly.",
  invalid_effect: "This campaign has an effect that isn't shaped correctly.",
  invalid_counter_increment: "This campaign's counter increment isn't a non-negative integer.",
  unknown_reference: "This campaign points to an id that doesn't exist in its catalog.",
  position_out_of_bounds: "This campaign places a position outside the map's bounds.",
  missing_spawn: "This campaign's map has no guest spawn point.",
  missing_exit: "This campaign's map has no exit.",
  spawn_not_traversable: "This campaign's spawn point sits on terrain that isn't walkable.",
  exit_not_traversable: "This campaign's exit sits on terrain that isn't walkable.",
  invalid_edge_cost: "This campaign's explicit map topology has an edge cost that isn't positive.",
  invalid_footprint: "This campaign's building has a footprint that isn't a positive size.",
  invalid_building_geometry: "This campaign's building has no entrances or no allowed rotations.",
  invalid_cost: "This campaign has a cost that is negative.",
  invalid_inventory: "This campaign has inventory units or capacity that don't make sense.",
  invalid_work_rate: "This campaign has a staff work rate that isn't a positive effort per tick.",
  invalid_time_limit_pair: "This campaign's scenario must declare both a time limit and its failure, or neither.",
  invalid_kind: "This campaign's kind doesn't match world-graph.",
  disconnected_map: "This campaign's map has no traversable edges.",
  inert_scenario: "This campaign's scenario has no objectives and no failures.",
};

/** `world-graph.reason.<code>` → its shipped default-English message, for every code. */
export const WORLD_GRAPH_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  WORLD_GRAPH_REASON_CODES.map((code) => [`world-graph.reason.${code}`, WORLD_GRAPH_REASON_TEXT[code]] as const),
);
