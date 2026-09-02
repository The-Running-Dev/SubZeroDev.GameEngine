/**
 * A committed story-graph fixture with exactly one unreachable ending.
 *
 * `overpower`'s `requirements` need `strength` above 10, but `strength`'s declared `max`
 * is 5 and no consequence anywhere in this campaign ever changes it — no reachable state
 * can ever satisfy that requirement, so `victory` can never be reached. `retreat` carries
 * no requirements, so `defeat` is always reachable.
 *
 * Both endings are topologically connected from `startNodeId` — `computeReachable`
 * (`kinds/story-graph/validate.ts`) follows `goto` edges without evaluating conditions, so
 * Tier 1 and Tier 2 both pass this campaign clean. Only `scripts/validate-campaign.ts`'s
 * state-space search (Tier 3, 03 §11) can tell `victory` apart from `defeat` — which is
 * this fixture's whole purpose (W73.2).
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const TIER3_UNREACHABLE_ENDING_FIXTURE_CAMPAIGN_ID = "tier3-unreachable-ending-fixture";

const NAMESPACE = "tier3fixture";

function authored(id: string, field: string, text: string): AuthoredText {
  return { key: `${NAMESPACE}.${id}.${field}`, text };
}

const source: StoryGraphCampaignSource = {
  description: authored("campaign", "description", "A minimal fixture: one ending no reachable state can reach."),
  variables: {
    strength: { type: "int", initial: 1, min: 0, max: 5 },
  },
  startNodeId: "start",
  nodes: {
    start: {
      kind: "choice",
      text: authored("start", "text", "A locked door blocks the way."),
      choices: [
        {
          id: "overpower",
          label: authored("start", "overpower", "Overpower it"),
          requirements: { field: "var.strength", operator: "greater_than", value: 10 },
          requirementFail: authored("start", "overpower_fail", "You are not strong enough."),
          goto: "victory",
        },
        {
          id: "retreat",
          label: authored("start", "retreat", "Turn back"),
          goto: "defeat",
        },
      ],
    },
    victory: { kind: "ending", text: authored("victory", "text", "The door gives way."), endingId: "victory", outcome: "win" },
    defeat: { kind: "ending", text: authored("defeat", "text", "You give up and go home."), endingId: "defeat", outcome: "loss" },
  },
  achievements: [],
};

export function buildTier3UnreachableEndingFixtureCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: TIER3_UNREACHABLE_ENDING_FIXTURE_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: `${NAMESPACE}.campaign.title`,
    content,
  };
  return buildCampaign(campaign, [authored("campaign", "title", "Tier 3 Fixture: Unreachable Ending"), ...authoredText]);
}
