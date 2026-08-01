/**
 * Content — the Inheritance arc (`games/bulgaria-adventure.md`'s "Inheritance" row).
 *
 * Adapted from `games/bulgaria.md`'s three scenes ("Property Inheritance", "Village Life",
 * "Family Meeting") — the fourth real arc of the Bulgaria Adventure, following
 * `bulgaria-bureaucracy.ts`'s established pattern.
 *
 * `games/bulgaria-adventure.md` names this arc's exercise as "branching on prior choices,
 * relationship variables, an ending." Two variables carry that: `family_tension` (int,
 * visible) accumulates across choices the way Bureaucracy's own counters do, without gating
 * anything itself; `has_documentation` (bool) is set only by `request_records` or
 * `consult_lawyer` in the first scene, and gates the one choice at the climax that actually
 * resolves the plot (`bring_out_documents`, via `showWhen`) — the clearest possible instance
 * of "branching on prior choices": that option is not merely disabled for a player who never
 * sought documentation, it does not exist for them.
 *
 * Node graph: `property_inheritance` (start, choice, 5 options) --> `village_life` (choice,
 * 4 options) --> either `ending_avoided` directly (`pretend_never_inherited`, a second,
 * different kind of branch — an immediate skip rather than a gate) or `family_meeting`
 * (choice, 4 options) --> `ending_unresolved` (three ungated options) or `ending_resolved`
 * (the one gated option, `outcome: "win"`).
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const bulgariaInheritanceSource: StoryGraphCampaignSource = {
  description: {
    key: "inheritance.campaign.description",
    text: "A property dispute across three generations, inspired by every Bulgarian family's unresolved argument.",
  },

  variables: {
    family_tension: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: { key: "inheritance.var.family_tension.label", text: "Family Tension" },
    },
    has_documentation: {
      type: "bool",
      initial: false,
      visible: true,
      label: { key: "inheritance.var.has_documentation.label", text: "Has Documentation" },
    },
  },

  startNodeId: "property_inheritance",

  nodes: {
    property_inheritance: {
      kind: "choice",
      text: {
        key: "inheritance.property_inheritance.text",
        text:
          "Your aunt informs you she owns the entire property because she has maintained the " +
          "tomatoes since 1998.",
      },
      choices: [
        {
          id: "request_records",
          label: { key: "inheritance.choice.request_records.label", text: "Request the cadastral records" },
          effects: [{ op: "set", var: "has_documentation", value: true }],
          goto: "village_life",
        },
        {
          id: "call_mother",
          label: { key: "inheritance.choice.call_mother.label", text: "Call your mother" },
          effects: [{ op: "increment", var: "family_tension", by: 1 }],
          goto: "village_life",
        },
        {
          id: "consult_lawyer",
          label: { key: "inheritance.choice.consult_lawyer.label", text: "Consult a lawyer" },
          effects: [
            { op: "set", var: "has_documentation", value: true },
            { op: "increment", var: "family_tension", by: 1 },
          ],
          goto: "village_life",
        },
        {
          id: "cut_padlock",
          label: { key: "inheritance.choice.cut_padlock.label", text: "Cut the padlock" },
          effects: [{ op: "increment", var: "family_tension", by: 3 }],
          goto: "village_life",
        },
        {
          id: "accept_tomato_logic",
          label: {
            key: "inheritance.choice.accept_tomato_logic.label",
            text: "Accept that tomato maintenance apparently establishes ownership",
          },
          goto: "village_life",
        },
      ],
    },

    village_life: {
      kind: "choice",
      text: {
        key: "inheritance.village_life.text",
        text:
          "You inherit a beautiful village house. Unfortunately it comes with: five co-owners, " +
          "two missing deeds, one disputed fence, and three generations of unresolved arguments.",
      },
      choices: [
        {
          id: "attempt_mediation",
          label: { key: "inheritance.choice.attempt_mediation.label", text: "Attempt mediation" },
          effects: [{ op: "decrement", var: "family_tension", by: 1 }],
          goto: "family_meeting",
        },
        {
          id: "measure_land_yourself",
          label: { key: "inheritance.choice.measure_land_yourself.label", text: "Measure the land yourself" },
          effects: [{ op: "increment", var: "family_tension", by: 1 }],
          goto: "family_meeting",
        },
        {
          id: "ask_oldest_neighbour",
          label: { key: "inheritance.choice.ask_oldest_neighbour.label", text: "Ask the oldest neighbour" },
          goto: "family_meeting",
        },
        {
          id: "pretend_never_inherited",
          label: { key: "inheritance.choice.pretend_never_inherited.label", text: "Pretend you never inherited it" },
          goto: "ending_avoided",
        },
      ],
    },

    family_meeting: {
      kind: "choice",
      text: {
        key: "inheritance.family_meeting.text",
        text:
          "The family gathers to peacefully discuss inheritance. Within twelve minutes someone " +
          "references an argument from 1994. Nobody remembers why. Everyone remembers who " +
          "started it.",
      },
      choices: [
        {
          id: "stay_silent",
          label: { key: "inheritance.choice.stay_silent.label", text: "Stay silent" },
          effects: [{ op: "increment", var: "family_tension", by: 1 }],
          goto: "ending_unresolved",
        },
        {
          id: "change_subject",
          label: { key: "inheritance.choice.change_subject.label", text: "Change the subject" },
          effects: [{ op: "increment", var: "family_tension", by: 1 }],
          goto: "ending_unresolved",
        },
        {
          id: "bring_out_documents",
          label: { key: "inheritance.choice.bring_out_documents.label", text: "Bring out the documents" },
          showWhen: { field: "var.has_documentation", operator: "equals", value: true },
          effects: [{ op: "decrement", var: "family_tension", by: 2 }],
          goto: "ending_resolved",
        },
        {
          id: "leave_before_lunch",
          label: { key: "inheritance.choice.leave_before_lunch.label", text: "Leave before lunch" },
          effects: [{ op: "increment", var: "family_tension", by: 1 }],
          goto: "ending_unresolved",
        },
      ],
    },

    ending_avoided: {
      kind: "ending",
      text: {
        key: "inheritance.ending_avoided.text",
        text:
          "You continue not to think about it. The property, still legally yours, continues " +
          "not to care.",
      },
      endingId: "avoided_the_inheritance",
      outcome: "neutral",
    },

    ending_unresolved: {
      kind: "ending",
      text: {
        key: "inheritance.ending_unresolved.text",
        text:
          "The 1994 argument is never resolved. Neither is the fence. The tomatoes, for their " +
          "part, are thriving.",
      },
      endingId: "the_argument_continues",
      outcome: "neutral",
    },

    ending_resolved: {
      kind: "ending",
      text: {
        key: "inheritance.ending_resolved.text",
        text:
          "The documents, it turns out, say exactly what they always said. Nobody is thrilled " +
          "about this, but the argument, for the first time in years, actually ends.",
      },
      endingId: "the_documents_settle_it",
      outcome: "win",
    },
  },

  achievements: [],
};

export const BULGARIA_INHERITANCE_CAMPAIGN_ID = "bulgaria-inheritance";

const TITLE: AuthoredText = { key: "inheritance.campaign.title", text: "Inheritance" };

/**
 * Assembles the envelope (`id`/`kindId`/`version`/`titleKey` — core-owned, not part of
 * `StoryGraphCampaignSource`, per the envelope-duplication rule `CLAUDE.md` tracks) around
 * `buildStoryGraphCampaign`'s lifted content, then hands both to `buildCampaign`
 * (`registry/build.ts`, W4) to produce the `BuiltCampaign` a registry is assembled from.
 */
export function buildBulgariaInheritanceCampaign(
  source: StoryGraphCampaignSource = bulgariaInheritanceSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: BULGARIA_INHERITANCE_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
