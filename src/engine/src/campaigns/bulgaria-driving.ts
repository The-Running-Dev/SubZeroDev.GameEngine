/**
 * Content — the Driving arc (`plans/37-w27-bulgaria-driving-arc.md`).
 *
 * Adapted from `games/bulgaria.md` in the companion SubZeroDev.GameOfLife repo (the
 * "Driving" and "BMW Ownership" scenes) — the second real arc of the Bulgaria Adventure,
 * following `bulgaria-bureaucracy.ts`'s established pattern exactly.
 *
 * Node graph: `driving` (start, choice) sets `trust_mechanic` from which of its four
 * options the player picks, then --> `bmw_ownership` (choice), whose own four options are
 * gated by `trust_mechanic` via `showWhen` rather than staged through an extra node: three
 * (`pay_immediately`, `buy_him_lunch`, `never_ask_questions`) are visible only when trusting
 * and lead to `ending_trusting`; one (`ask_what_he_fixed`) is visible only when skeptical and
 * leads to `ending_skeptical`. Neither branch's hidden options are ever shown to the other
 * player — `showWhen` omits entirely, it does not grey out (03 §4).
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const bulgariaDrivingSource: StoryGraphCampaignSource = {
  description: {
    key: "driving.campaign.description",
    text: "A short trip through Bulgarian car ownership, inspired by real mechanics who have seen everything.",
  },

  variables: {
    trust_mechanic: {
      type: "bool",
      initial: false,
      visible: true,
      label: { key: "driving.var.trust_mechanic.label", text: "Trust the Mechanic" },
    },
  },

  startNodeId: "driving",

  nodes: {
    driving: {
      kind: "choice",
      text: {
        key: "driving.driving.text",
        text:
          "You pass the annual inspection. Five minutes later the dashboard lights up like a " +
          'Christmas tree. The mechanic confidently says: "It was already like that."',
      },
      choices: [
        {
          id: "believe_him",
          label: { key: "driving.choice.believe_him.label", text: "Believe him" },
          effects: [{ op: "set", var: "trust_mechanic", value: true }],
          goto: "bmw_ownership",
        },
        {
          id: "ask_another_opinion",
          label: { key: "driving.choice.ask_another_opinion.label", text: "Ask for another opinion" },
          effects: [{ op: "set", var: "trust_mechanic", value: false }],
          goto: "bmw_ownership",
        },
        {
          id: "ignore_warning",
          label: { key: "driving.choice.ignore_warning.label", text: "Ignore the warning" },
          effects: [{ op: "set", var: "trust_mechanic", value: true }],
          goto: "bmw_ownership",
        },
        {
          id: "turn_up_music",
          label: { key: "driving.choice.turn_up_music.label", text: "Turn up the music" },
          effects: [{ op: "set", var: "trust_mechanic", value: true }],
          goto: "bmw_ownership",
        },
      ],
    },

    bmw_ownership: {
      kind: "choice",
      text: {
        key: "driving.bmw_ownership.text",
        text:
          "Your BMW develops a mysterious noise. Three mechanics diagnose: suspension, " +
          'transmission, "they all do that." A fourth mechanic fixes it with a hammer.',
      },
      choices: [
        {
          id: "pay_immediately",
          label: { key: "driving.choice.pay_immediately.label", text: "Pay immediately" },
          showWhen: { field: "var.trust_mechanic", operator: "equals", value: true },
          goto: "ending_trusting",
        },
        {
          id: "buy_him_lunch",
          label: { key: "driving.choice.buy_him_lunch.label", text: "Buy him lunch" },
          showWhen: { field: "var.trust_mechanic", operator: "equals", value: true },
          goto: "ending_trusting",
        },
        {
          id: "never_ask_questions",
          label: { key: "driving.choice.never_ask_questions.label", text: "Never ask questions" },
          showWhen: { field: "var.trust_mechanic", operator: "equals", value: true },
          goto: "ending_trusting",
        },
        {
          id: "ask_what_he_fixed",
          label: { key: "driving.choice.ask_what_he_fixed.label", text: "Ask what he actually fixed" },
          showWhen: { field: "var.trust_mechanic", operator: "equals", value: false },
          goto: "ending_skeptical",
        },
      ],
    },

    ending_trusting: {
      kind: "ending",
      text: {
        key: "driving.ending_trusting.text",
        text:
          "The noise returns in six months, at a red light, on a Tuesday. By then you have " +
          "made your peace with it. The dashboard, for its part, has stopped commenting.",
      },
      endingId: "trusting_the_mechanic",
      outcome: "neutral",
    },

    ending_skeptical: {
      kind: "ending",
      text: {
        key: "driving.ending_skeptical.text",
        text:
          "He explains the repair using several words that do not exist in any dictionary. " +
          "You nod. You still do not know what he fixed. Neither, as far as anyone can tell, does he.",
      },
      endingId: "asked_for_a_second_opinion",
      outcome: "neutral",
    },
  },

  achievements: [],
};

export const BULGARIA_DRIVING_CAMPAIGN_ID = "bulgaria-driving";

const TITLE: AuthoredText = { key: "driving.campaign.title", text: "Driving" };

/**
 * Assembles the envelope (`id`/`kindId`/`version`/`titleKey` — core-owned, not part of
 * `StoryGraphCampaignSource`, per the envelope-duplication rule `CLAUDE.md` tracks) around
 * `buildStoryGraphCampaign`'s lifted content, then hands both to `buildCampaign`
 * (`registry/build.ts`, W4) to produce the `BuiltCampaign` a registry is assembled from.
 */
export function buildBulgariaDrivingCampaign(
  source: StoryGraphCampaignSource = bulgariaDrivingSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: BULGARIA_DRIVING_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
