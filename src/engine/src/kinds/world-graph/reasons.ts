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
 *
 * The **audit** block at the end is a third category, registered by reconciliation
 * (2026-08-08): `BatchChanges.record` (`tick/changes.ts`) takes `reason` as a plain
 * `string`, and ten distinct values reached a client on `visible: true` `StateChange`s
 * without ever being registered here. 04 §12 gives audit reasons no exemption — a visible
 * change owes a resolvable message the same way a rejection does — and the 2026-08-06 pass
 * that fixed the identical defect in `story-graph` covered this kind's *validation* codes
 * only, so these fell between the two.
 *
 * **Five of the ten arrive indirectly, and that is what hid them.** The action codes are
 * literals at their own `change()` call site, but `scenario_effect`, `guest_served`,
 * `objective_met`, `failure_triggered` and `incident_resolved` are threaded in as
 * `WorldEffectContext.reason` (`tick/effects.ts`) and only become a reason where that module
 * records `finances.cashCents` with `visible: true`. A reader scanning for `reason:` literals
 * beside a `visible` flag sees neither half — which is exactly how the first pass at this
 * registration both missed these five and added two codes (`tick`, `effect`) that no
 * production path emits at all. Recorded in `90-decisions.md`.
 *
 * Reasons recorded only with `visible: false` — `alert_dismissed`, `building_demolished`,
 * `staff_fired`, `staff_assigned`, `guest_spawned` — are deliberately not registered here;
 * see `90-decisions.md` for why that line is where it is. Note `incident_resolved` is *not*
 * one of them despite appearing at two `visible: false` sites: its effect-context use above
 * reaches visible records.
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
  // Audit reasons — `visible: true` `StateChange`s from the actions and the tick pipeline.
  // Direct: a literal at the `change()`/`record()` call site.
  "building_placed",
  "construction_started",
  "staff_hired",
  "price_set",
  "ticks_advanced",
  // Indirect: `WorldEffectContext.reason`, visible via `effects.ts`'s `finances.cashCents`.
  "scenario_effect",
  "guest_served",
  "objective_met",
  "failure_triggered",
  "incident_resolved",
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
  building_placed: "A building was placed.",
  construction_started: "Construction started.",
  staff_hired: "A staff member was hired.",
  price_set: "A price was changed.",
  ticks_advanced: "Time moved forward.",
  scenario_effect: "The scenario changed something.",
  guest_served: "A guest was served.",
  objective_met: "An objective was met.",
  failure_triggered: "A failure condition was triggered.",
  incident_resolved: "An incident was resolved.",
};

/** `world-graph.reason.<code>` → its shipped default-English message, for every code. */
export const WORLD_GRAPH_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  WORLD_GRAPH_REASON_CODES.map((code) => [`world-graph.reason.${code}`, WORLD_GRAPH_REASON_TEXT[code]] as const),
);
