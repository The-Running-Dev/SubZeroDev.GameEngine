/**
 * The real `story-graph` `Kind` assembly — the single definition every consumer imports.
 *
 * Contract: `04-core.md` §3, `03-story-graph-kind.md`.
 *
 * Extracted during W22 (`07-replay.md`): six call sites (`mcp/server.test.ts`,
 * `clients/text/client.test.ts`, three `campaigns/bulgaria-bureaucracy.*.test.ts`, and the
 * replay corpus test this unit adds) each defined a byte-identical `makeStoryGraphKind()`.
 * Copying it a sixth time crossed from tolerable test duplication into "this is actually the
 * production kind, just never named as such" — see `plans/27-replay-oracle-programme.md`,
 * Decision 5.
 */

import type {
  AdvanceResult,
  AvailableAction,
  InitialStateResult,
  Kind,
  SceneBody,
} from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import { advance } from "./advance.js";
import type { StoryGraphCampaign } from "./campaign.js";
import { STORY_GRAPH_EVENT_NAMES } from "./events.js";
import { STORY_GRAPH_REASON_CODES, STORY_GRAPH_REASON_MESSAGES } from "./reasons.js";
import { availableActions, scene } from "./scene.js";
import { initialState } from "./settle.js";
import type { StoryGraphKindState } from "./state.js";
import { validateCampaign } from "./validate.js";
import { project } from "./view.js";

/** Distinct `endingId`s across the campaign's `EndingNode`s (03 §8.5) — two nodes may
 *  publish the same ending, so this counts ids, never nodes. */
function terminalCount(campaign: Campaign): number {
  const content = campaign.content as StoryGraphCampaign;
  const endingIds = new Set<string>();
  for (const node of Object.values(content.nodes)) {
    if (node.kind === "ending") endingIds.add(node.endingId);
  }
  return endingIds.size;
}

export const storyGraphKind: Kind<StoryGraphKindState> = {
  id: "story-graph",
  version: "1.0.0",
  reasonCodes: STORY_GRAPH_REASON_CODES,
  reasonMessages: STORY_GRAPH_REASON_MESSAGES,
  /** Generated from `events.ts`'s name-to-severity table so this list and the call sites
   *  cannot drift (W96). */
  eventNames: STORY_GRAPH_EVENT_NAMES,
  initialState: (c, ctx): InitialStateResult<StoryGraphKindState> => initialState(c, ctx),
  availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
  scene: (state, ctx): SceneBody => scene(state, ctx),
  advance: (state, actionId, params, ctx): AdvanceResult<StoryGraphKindState> => advance(state, actionId, params, ctx),
  project: (state, audience, ctx) => project(state, audience, ctx),
  validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
  outcome: (state) => {
    const endingId = state.endingId ?? null;
    return { terminal: endingId !== null, terminalId: endingId, endingId };
  },
  terminalCount,
};
