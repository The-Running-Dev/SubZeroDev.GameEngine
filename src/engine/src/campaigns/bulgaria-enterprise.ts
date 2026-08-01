/**
 * Content — the Enterprise arc (`games/bulgaria-adventure.md`'s "Enterprise" row).
 *
 * Adapted from `games/bulgaria.md`'s "Starting a Business" and "Entrepreneur" scenes — the
 * fifth and final real arc of the Bulgaria Adventure, following `bulgaria-bureaucracy.ts`'s
 * established pattern.
 *
 * `games/bulgaria-adventure.md` lists this arc's third scene as "Ultimate Reward" and its
 * exercise as "accumulating debt/patience, the 'It Builds Character' achievement." Neither is
 * available: `bulgaria-bureaucracy.ts` already consumed `bulgaria.md`'s "Ultimate Bulgarian
 * Reward" scene verbatim as its own ending, achievement and all (`OPEN-QUESTIONS.md` §2, found
 * during W27). What remains of this arc's exercise is "accumulating debt" — carried by
 * `debt_cents` (int, visible), a running stat in the same idiom as Bureaucracy's own counters,
 * not a gate. No achievement: the game's own Definition of Done requires only "at least one"
 * across the whole game, already satisfied by Bureaucracy's `it_builds_character`.
 *
 * With the achievement gone, nothing in this arc's remaining material calls for a branching
 * ending the way Driving's named flag or Inheritance's named "branching on prior choices" did
 * — `games/bulgaria-adventure.md` names "an ending" for this arc, singular, same as the others.
 * The climax ("This, it turns out, is what having a business means") is new prose, not adapted
 * from any `bulgaria.md` scene, since the one this arc was assigned is already spent.
 *
 * Node graph: `starting_a_business` (start, choice, four options, converge) --> `entrepreneur`
 * (choice, four options, each with its own `debt_cents` effect, converge) --> `ending`.
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const bulgariaEnterpriseSource: StoryGraphCampaignSource = {
  description: {
    key: "enterprise.campaign.description",
    text: "A small business, inspired by every Bulgarian entrepreneur who has ever waited on an invoice.",
  },

  variables: {
    debt_cents: {
      type: "int",
      initial: 0,
      min: 0,
      max: 100000,
      visible: true,
      label: { key: "enterprise.var.debt_cents.label", text: "Debt (Cents)" },
    },
  },

  startNodeId: "starting_a_business",

  nodes: {
    starting_a_business: {
      kind: "choice",
      text: {
        key: "enterprise.starting_a_business.text",
        text:
          "Congratulations. Your company is officially registered. Your first visitors arrive: " +
          "the Tax Agency, the Labour Inspectorate, the Health Inspectorate. None of them are " +
          "customers.",
      },
      choices: [
        {
          id: "offer_coffee",
          label: { key: "enterprise.choice.offer_coffee.label", text: "Offer them coffee" },
          goto: "entrepreneur",
        },
        {
          id: "hide",
          label: { key: "enterprise.choice.hide.label", text: "Hide" },
          goto: "entrepreneur",
        },
        {
          id: "ask_who_invited_them",
          label: { key: "enterprise.choice.ask_who_invited_them.label", text: "Ask who invited them" },
          goto: "entrepreneur",
        },
        {
          id: "pretend_business_never_opened",
          label: {
            key: "enterprise.choice.pretend_business_never_opened.label",
            text: "Pretend the business never opened",
          },
          goto: "entrepreneur",
        },
      ],
    },

    entrepreneur: {
      kind: "choice",
      text: {
        key: "enterprise.entrepreneur.text",
        text:
          "You successfully open your first business. Your first invoice is paid… in " +
          "approximately 60 days. Your supplier expects payment tomorrow.",
      },
      choices: [
        {
          id: "call_the_client",
          label: { key: "enterprise.choice.call_the_client.label", text: "Call the client" },
          goto: "ending",
        },
        {
          id: "negotiate",
          label: { key: "enterprise.choice.negotiate.label", text: "Negotiate" },
          effects: [{ op: "increment", var: "debt_cents", by: 5000 }],
          goto: "ending",
        },
        {
          id: "borrow_money",
          label: { key: "enterprise.choice.borrow_money.label", text: "Borrow money" },
          effects: [{ op: "increment", var: "debt_cents", by: 20000 }],
          goto: "ending",
        },
        {
          id: "discover_entrepreneurship",
          label: { key: "enterprise.choice.discover_entrepreneurship.label", text: "Discover entrepreneurship" },
          goto: "ending",
        },
      ],
    },

    ending: {
      kind: "ending",
      text: {
        key: "enterprise.ending.text",
        text:
          "The debt does not resolve itself, but neither does it become a crisis — it simply " +
          "becomes a permanent line item, filed alongside the tax registration and the health " +
          "inspection report. This, it turns out, is what having a business means.",
      },
      endingId: "a_permanent_line_item",
      outcome: "neutral",
    },
  },

  achievements: [],
};

export const BULGARIA_ENTERPRISE_CAMPAIGN_ID = "bulgaria-enterprise";

const TITLE: AuthoredText = { key: "enterprise.campaign.title", text: "Enterprise" };

/**
 * Assembles the envelope (`id`/`kindId`/`version`/`titleKey` — core-owned, not part of
 * `StoryGraphCampaignSource`, per the envelope-duplication rule `CLAUDE.md` tracks) around
 * `buildStoryGraphCampaign`'s lifted content, then hands both to `buildCampaign`
 * (`registry/build.ts`, W4) to produce the `BuiltCampaign` a registry is assembled from.
 */
export function buildBulgariaEnterpriseCampaign(
  source: StoryGraphCampaignSource = bulgariaEnterpriseSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: BULGARIA_ENTERPRISE_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
