/**
 * Content — the Bureaucracy arc (03 §12; MVP.md §3).
 *
 * Adapted from `games/bulgaria.md` in the companion SubZeroDev.GameOfLife repo (the
 * "Municipality," "Government Office," "Bureaucracy," and "Ultimate Bulgarian Reward"
 * scenes) — the real MVP content, not a synthetic placeholder.
 *
 * Node graph: `municipality` (start) --wait--> `clerk_review` (random, 3:1) --expired-->
 * `expired` (choice, every option loops back to `municipality` for a retry) or
 * --room_14--> `room_14` (auto, counts the visit) --> `room_6` (choice: `continue_cycle`
 * loops back to `room_14`; `go_home` is gated on `office_visits >= 3` and leads to the
 * one ending, `reward`).
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const bulgariaBureaucracySource: StoryGraphCampaignSource = {
  description: {
    key: "bureaucracy.campaign.description",
    text: "A satirical trek through municipal paperwork, inspired by real Bulgarian bureaucracy.",
  },

  variables: {
    office_visits: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: { key: "bureaucracy.var.office_visits.label", text: "Office Visits" },
    },
    certificate_age_months: {
      type: "int",
      initial: 0,
      min: 0,
      max: 99,
      visible: true,
      label: { key: "bureaucracy.var.certificate_age_months.label", text: "Certificate Age (Months)" },
    },
  },

  startNodeId: "municipality",

  nodes: {
    municipality: {
      kind: "choice",
      text: {
        key: "bureaucracy.municipality.text",
        text:
          "You arrive at the municipality at 08:03. The office opened at 08:00. A handwritten " +
          'note reads: "Closed for a meeting until 11:30."',
      },
      choices: [
        {
          id: "wait",
          label: { key: "bureaucracy.choice.wait.label", text: "Wait" },
          goto: "clerk_review",
        },
        {
          id: "try_another_entrance",
          label: { key: "bureaucracy.choice.try_another_entrance.label", text: "Try another entrance" },
          goto: "municipality",
        },
        {
          id: "ask_guard",
          label: { key: "bureaucracy.choice.ask_guard.label", text: "Ask the security guard" },
          goto: "municipality",
        },
        {
          id: "coffee",
          label: {
            key: "bureaucracy.choice.coffee.label",
            text: "Go for coffee and accidentally meet the mayor's cousin",
          },
          goto: "municipality",
        },
      ],
    },

    clerk_review: {
      kind: "random",
      text: { key: "bureaucracy.clerk_review.text", text: "The clerk calls your number." },
      transitions: [
        {
          weight: 3,
          effects: [{ op: "increment", var: "certificate_age_months", by: 1 }],
          goto: "expired",
        },
        { weight: 1, goto: "room_14" },
      ],
    },

    expired: {
      kind: "choice",
      text: {
        key: "bureaucracy.expired.text",
        text:
          "You have collected every required document. The clerk carefully reviews your " +
          "paperwork. She smiles. One certificate is now older than three months. You must " +
          "begin again.",
      },
      choices: [
        {
          id: "accept_fate",
          label: { key: "bureaucracy.choice.accept_fate.label", text: "Accept your fate" },
          goto: "municipality",
        },
        {
          id: "ask_someone_else",
          label: { key: "bureaucracy.choice.ask_someone_else.label", text: "Ask to speak to someone else" },
          goto: "municipality",
        },
        {
          id: "search_another_office",
          label: { key: "bureaucracy.choice.search_another_office.label", text: "Search for another office" },
          goto: "municipality",
        },
        {
          id: "question_reality",
          label: { key: "bureaucracy.choice.question_reality.label", text: "Question reality" },
          goto: "municipality",
        },
      ],
    },

    room_14: {
      kind: "auto",
      text: { key: "bureaucracy.room_14.text", text: "Room 14 sends you to Room 6." },
      effects: [{ op: "increment", var: "office_visits", by: 1 }],
      goto: "room_6",
    },

    room_6: {
      kind: "choice",
      text: { key: "bureaucracy.room_6.text", text: "Room 6 informs you that everything happens in Room 14." },
      choices: [
        {
          id: "continue_cycle",
          label: { key: "bureaucracy.choice.continue_cycle.label", text: "Continue the cycle" },
          goto: "room_14",
        },
        {
          id: "ask_supervisor",
          label: { key: "bureaucracy.choice.ask_supervisor.label", text: "Ask for a supervisor" },
          goto: "room_6",
        },
        {
          id: "go_home",
          label: { key: "bureaucracy.choice.go_home.label", text: "Go home" },
          requirements: { field: "var.office_visits", operator: "greater_or_equal", value: 3 },
          requirementFail: {
            key: "bureaucracy.choice.go_home.requirement_fail",
            text: "You can't leave yet — the paperwork isn't old enough to give up on.",
          },
          goto: "reward",
        },
        {
          id: "wonder",
          label: { key: "bureaucracy.choice.wonder.label", text: "Wonder if this is a side quest" },
          goto: "room_6",
        },
      ],
    },

    reward: {
      kind: "ending",
      text: {
        key: "bureaucracy.reward.text",
        text:
          "Congratulations. After seven years of paperwork, you finally receive: €300, " +
          "and 28 years of unresolved legal responsibility.",
      },
      endingId: "ultimate_reward",
      outcome: "win",
    },
  },

  achievements: [
    {
      id: "it_builds_character",
      name: { key: "bureaucracy.ach.it_builds_character.name", text: "It Builds Character" },
      description: {
        key: "bureaucracy.ach.it_builds_character.description",
        text: "Survive the Bulgarian bureaucracy and come out the other side with a story to tell.",
      },
      condition: { field: "ending", operator: "equals", value: "ultimate_reward" },
      hidden: false,
    },
  ],
};

export const BULGARIA_BUREAUCRACY_CAMPAIGN_ID = "bulgaria-bureaucracy";

const TITLE: AuthoredText = { key: "bureaucracy.campaign.title", text: "The Bureaucracy" };

/**
 * Assembles the envelope (`id`/`kindId`/`version`/`titleKey` — core-owned, not part of
 * `StoryGraphCampaignSource`, per the envelope-duplication rule `CLAUDE.md` tracks) around
 * `buildStoryGraphCampaign`'s lifted content, then hands both to `buildCampaign`
 * (`registry/build.ts`, W4) to produce the `BuiltCampaign` a registry is assembled from.
 */
export function buildBulgariaBureaucracyCampaign(
  source: StoryGraphCampaignSource = bulgariaBureaucracySource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
