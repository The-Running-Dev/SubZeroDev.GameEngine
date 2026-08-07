/**
 * Story-graph kind — the reason codes this kind adds to the base set (03 §8.3).
 *
 * Contract: `03-story-graph-kind.md` §8.3.
 *
 * Mirrors `kernel/reasons.ts`'s own pattern exactly — a const array, a
 * `Record<Code,string>` message table the compiler forces complete, and a
 * `ReadonlyMap<LocKey,string>` built from both — so the two can't drift apart. Messages
 * live under `story-graph.reason.*` (W10's provisional convention, `plans/17-w10-…`
 * Decision 3), not `core.reason.*`, which is reserved for the base set alone.
 * `unknown_condition_field` (W10) joins this array too — this is the "real caller" its
 * own `TODO.md` Known Open Item was waiting on. `unknown_action`/`requirement_unmet` are
 * **not** here — 03 §8.3 reuses them from the base set verbatim.
 *
 * W14 adds its own Tier 1/2 content-validation codes (03 §11) — a `LocKey` failing to
 * resolve reuses the base `missing_string_key` (W5) instead of a new one, since that's
 * the exact same failure the core's own `titleKey` check already names.
 *
 * `consequence_applied` was registered by reconciliation. 04 §12 specifies it as the `reason`
 * on the coalesced variable-write `StateChange`, and `variables.ts` has emitted it since W9
 * without it ever entering a vocabulary — so a change whose `visible` mirrors a variable's own
 * declaration could reach a client with a code the string table had no entry for. It is
 * kind-owned rather than base because only this kind has a `consequence`; the achievement
 * sibling `achievement_unlocked` is in `BASE_REASON_CODES` instead, because the session store
 * switches on that one without knowing which kind produced it.
 */

import type { LocKey } from "../../core/localization/types.js";

export const STORY_GRAPH_REASON_CODES = [
  "not_a_choice_node",
  "unexpected_params",
  "settle_guard_tripped",
  "unknown_condition_field",
  "dangling_reference",
  "undeclared_variable",
  "invalid_consequence_value",
  "duplicate_id",
  "missing_label_key",
  "non_visible_variable_in_text",
  "invalid_transition_weight",
  "unreachable_node",
  "unreachable_cycle",
  "no_reachable_choice",
  "no_reachable_ending",
  "consequence_applied",
] as const;

export type StoryGraphReasonCode = (typeof STORY_GRAPH_REASON_CODES)[number];

const STORY_GRAPH_REASON_TEXT: Readonly<Record<StoryGraphReasonCode, string>> = {
  not_a_choice_node: "That action can't be taken right now.",
  unexpected_params: "This action doesn't take any extra parameters.",
  settle_guard_tripped: "The story couldn't settle to a stopping point.",
  unknown_condition_field: "This campaign references a field that doesn't exist.",
  dangling_reference: "This campaign points to a node that doesn't exist.",
  undeclared_variable: "This campaign writes to a variable that isn't declared.",
  invalid_consequence_value: "This campaign writes a value that doesn't match the variable's type.",
  duplicate_id: "This campaign uses the same id twice where ids must be unique.",
  missing_label_key: "This campaign shows a stat with no label text.",
  non_visible_variable_in_text: "This campaign's text refers to a hidden or undeclared variable.",
  invalid_transition_weight: "This campaign's random event has an invalid or missing weight.",
  unreachable_node: "This campaign has content the player can never reach.",
  unreachable_cycle: "This campaign has a loop with no way out.",
  no_reachable_choice: "This campaign never lets the player make a choice.",
  no_reachable_ending: "This campaign has no reachable ending.",
  consequence_applied: "A choice changed something.",
};

/** `story-graph.reason.<code>` → its shipped default-English message, for every code. */
export const STORY_GRAPH_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  STORY_GRAPH_REASON_CODES.map((code) => [`story-graph.reason.${code}`, STORY_GRAPH_REASON_TEXT[code]] as const),
);
