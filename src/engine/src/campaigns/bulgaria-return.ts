/**
 * Content — the Return arc (`games/bulgaria-adventure.md`'s "Return" row).
 *
 * Adapted from `games/bulgaria.md`'s single "Expat Returns" scene — the third real arc of
 * the Bulgaria Adventure, following `bulgaria-bureaucracy.ts`/`bulgaria-driving.ts`'s
 * established pattern.
 *
 * Deliberately the simplest arc built so far: a single `choice` node whose four options all
 * converge on one `ending`. Unlike Driving, where "a 'trust the mechanic' flag" was an
 * explicitly named exercise justifying a branching-ending design, `bulgaria-adventure.md`
 * names no mechanic for Return beyond "seeds variables the other arcs read" — already found
 * (`OPEN-QUESTIONS.md` §2, during W27) to not be mechanically achievable, since every arc is
 * its own standalone `Campaign` with no seam between them. Inventing a flag or a branch here
 * anyway would be content this source material never asked for; the four choices differ only
 * in flavor, matching the source scene's own list of four equally-plausible reactions.
 *
 * Node graph: `expat_returns` (start, choice, four choices, one flavor each) --> `home_again`
 * (ending). No variables, no achievement — nothing in this arc's stated design calls for
 * either, and the game's own Definition of Done only requires "at least one" achievement
 * across the whole game, already satisfied by Bureaucracy's `it_builds_character`.
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const bulgariaReturnSource: StoryGraphCampaignSource = {
  description: {
    key: "return.campaign.description",
    text: "A short homecoming, inspired by every expat's first week back in Bulgaria.",
  },

  variables: {},

  startNodeId: "expat_returns",

  nodes: {
    expat_returns: {
      kind: "choice",
      text: {
        key: "return.expat_returns.text",
        text:
          "After years abroad, you return to Bulgaria. Within the first week: someone asks " +
          "why you came back; someone offers unsolicited advice; someone tells you they could " +
          "have done what you did abroad; someone knows a cheaper mechanic.",
      },
      choices: [
        {
          id: "smile",
          label: { key: "return.choice.smile.label", text: "Smile" },
          goto: "home_again",
        },
        {
          id: "explain",
          label: { key: "return.choice.explain.label", text: "Explain" },
          goto: "home_again",
        },
        {
          id: "laugh",
          label: { key: "return.choice.laugh.label", text: "Laugh" },
          goto: "home_again",
        },
        {
          id: "accept_destiny",
          label: { key: "return.choice.accept_destiny.label", text: "Accept your destiny" },
          goto: "home_again",
        },
      ],
    },

    home_again: {
      kind: "ending",
      text: {
        key: "return.home_again.text",
        text:
          "By the second week, the questions have become routine, the advice ambient, and " +
          "the mechanic recommendation forgotten and then remembered again. You are, by every " +
          "available measure, home.",
      },
      endingId: "home_again",
      outcome: "neutral",
    },
  },

  achievements: [],
};

export const BULGARIA_RETURN_CAMPAIGN_ID = "bulgaria-return";

const TITLE: AuthoredText = { key: "return.campaign.title", text: "Return" };

/**
 * Assembles the envelope (`id`/`kindId`/`version`/`titleKey` — core-owned, not part of
 * `StoryGraphCampaignSource`, per the envelope-duplication rule `CLAUDE.md` tracks) around
 * `buildStoryGraphCampaign`'s lifted content, then hands both to `buildCampaign`
 * (`registry/build.ts`, W4) to produce the `BuiltCampaign` a registry is assembled from.
 */
export function buildBulgariaReturnCampaign(
  source: StoryGraphCampaignSource = bulgariaReturnSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: BULGARIA_RETURN_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
