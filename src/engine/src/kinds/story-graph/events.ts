/**
 * The story-graph kind's name-to-severity table.
 *
 * Contract: `03-story-graph-kind.md` §8.4 (`20-contract.md` §8.4), which pairs every
 * declared `Kind.eventNames` entry with one fixed severity (`05-observability.md` §7 —
 * severity is fixed per name, not chosen per call site). Every call site reads both the
 * name and the severity off one entry here, the same pattern `core/observability/events.ts`
 * uses for the core set (W96) — so two call sites for the same event can no longer disagree
 * by construction, and `kind.ts`'s `eventNames` is generated from this table rather than
 * kept in step by hand.
 */

import type { EventName, Severity } from "../../core/observability/types.js";

interface StoryGraphEventDef {
  readonly name: EventName;
  readonly severity: Severity;
}

export const STORY_GRAPH_EVENTS = {
  settleStep: { name: "kind.story-graph.settle.step", severity: "trace" },
  nodeEntered: { name: "kind.story-graph.node.entered", severity: "debug" },
  randomPicked: { name: "kind.story-graph.random.picked", severity: "debug" },
  settleGuardTripped: { name: "kind.story-graph.settle.guard_tripped", severity: "error" },
  choiceSubmitted: { name: "kind.story-graph.choice.submitted", severity: "debug" },
  choiceRejected: { name: "kind.story-graph.choice.rejected", severity: "info" },
  requirementEvaluated: { name: "kind.story-graph.requirement.evaluated", severity: "trace" },
  consequenceApplied: { name: "kind.story-graph.consequence.applied", severity: "debug" },
  achievementUnlocked: { name: "kind.story-graph.achievement.unlocked", severity: "info" },
  endingReached: { name: "kind.story-graph.ending.reached", severity: "info" },
} as const satisfies Record<string, StoryGraphEventDef>;

/** `kind.ts`'s `eventNames` — generated from this table so the two cannot drift apart. */
export const STORY_GRAPH_EVENT_NAMES: readonly EventName[] = Object.values(STORY_GRAPH_EVENTS).map((entry) => entry.name);
