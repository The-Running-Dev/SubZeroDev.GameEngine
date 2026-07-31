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
 */

import type { LocKey } from "../../core/localization/types.js";

export const STORY_GRAPH_REASON_CODES = [
  "not_a_choice_node",
  "unexpected_params",
  "settle_guard_tripped",
  "unknown_condition_field",
] as const;

export type StoryGraphReasonCode = (typeof STORY_GRAPH_REASON_CODES)[number];

const STORY_GRAPH_REASON_TEXT: Readonly<Record<StoryGraphReasonCode, string>> = {
  not_a_choice_node: "That action can't be taken right now.",
  unexpected_params: "This action doesn't take any extra parameters.",
  settle_guard_tripped: "The story couldn't settle to a stopping point.",
  unknown_condition_field: "This campaign references a field that doesn't exist.",
};

/** `story-graph.reason.<code>` → its shipped default-English message, for every code. */
export const STORY_GRAPH_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  STORY_GRAPH_REASON_CODES.map((code) => [`story-graph.reason.${code}`, STORY_GRAPH_REASON_TEXT[code]] as const),
);
