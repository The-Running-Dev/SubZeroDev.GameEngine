/**
 * Story-graph kind — the runtime state (03 §8.1).
 *
 * Contract: `03-story-graph-kind.md` §8.1, §8.2.
 *
 * `enter` stays pure and event-free on purpose — `node.entered` (03 §8.4) fires for
 * every entry, including the initial start node, which happens *before* the settle loop
 * even begins. A shared `enterAndEmit` (`settle.ts`) wraps this for both callers instead
 * of duplicating the event here. See `plans/18-w11-nodes-turn-and-settle.md`, Decision 2.
 */

import type { VarValue } from "./variables.js";

export interface StoryGraphKindState {
  currentNodeId: string;
  variables: Record<string, VarValue>;
  turn: number;
  visitedCounts: Record<string, number>;
  unlockedAchievements: string[];
  endingId?: string;
}

/** Sets `currentNodeId` and increments `visitedCounts[nodeId]` — every entry counts. */
export function enter(state: StoryGraphKindState, nodeId: string): StoryGraphKindState {
  return {
    ...state,
    currentNodeId: nodeId,
    visitedCounts: { ...state.visitedCounts, [nodeId]: (state.visitedCounts[nodeId] ?? 0) + 1 },
  };
}
