/**
 * Saki: Quest for Redemption.
 *
 * A private, personal Lucifer Chronicles story-graph campaign. Registered in
 * `site/src/play/composition.ts` so it is playable through the shared `/play/` page, but
 * marked `hidden` there — the browser demo's catalog is the publication decision, and this
 * campaign is deliberately omitted from the public dossier grid. It is reachable only by a
 * direct `?campaign=saki-quest-for-redemption` link, meant to be handed to one person, not
 * listed. It is exported from the package surface like every other campaign so a host can
 * also compose it into a private surface when one exists; nothing here invents access
 * control that the engine does not already have.
 *
 * Authored directly against `StoryGraphCampaignSource` rather than through
 * `adventure-builder.ts`: that builder produces W64's fixed three-route shape, and this
 * arc is a five-act graph with a hub, once-only side visits, and eight endings.
 * `lucifer-chronicles.ts` sets the precedent for a hand-authored graph.
 */
import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { Condition } from "../core/condition/types.js";
import { buildCampaign } from "../core/registry/build.js";
import {
  buildStoryGraphCampaign,
  type AchievementDefinitionSource,
  type ChoiceSource,
  type NodeSource,
  type StoryGraphCampaignSource,
} from "../kinds/story-graph/source.js";
import type { Consequence, VarValue } from "../kinds/story-graph/variables.js";
import type { RandomTransition } from "../kinds/story-graph/nodes.js";

export const SAKI_QUEST_CAMPAIGN_ID = "saki-quest-for-redemption";

// SPIKE: catalog card travels with the campaign instead of a positional entry in
// site/src/play/composition.ts. See plans/spike-notes.md.
export const sakiQuestCatalog: import("../portable/format.js").PortableCatalog = {
  title: "Saki: Quest for Redemption",
  description: "A private five-act arc through consultations, tribunals, and unsolicited grand gestures.",
  duration: "25–40 min",
  contentNotice:
    "Absurdist bureaucratic romance-comedy framing, self-deprecating humor, and unsolicited gestures made without the other party's consent.",
  featured: false,
  hidden: true,
};

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

const text = (id: string, field: string, value: string): AuthoredText => ({ key: `saki.${id}.${field}`, text: value });

const inc = (name: string, by = 1): Consequence => ({ op: "increment", var: name, by });
const dec = (name: string, by = 1): Consequence => ({ op: "decrement", var: name, by });
const put = (name: string, value: VarValue): Consequence => ({ op: "set", var: name, value });

const atLeast = (name: string, value: number): Condition => ({ field: `var.${name}`, operator: "greater_or_equal", value });
const unvisited = (nodeId: string): Condition => ({ field: `visited.${nodeId}`, operator: "equals", value: 0 });
const visited = (nodeId: string): Condition => ({ field: `visited.${nodeId}`, operator: "greater_or_equal", value: 1 });
const flag = (name: string, value: boolean): Condition => ({ field: `var.${name}`, operator: "equals", value });

interface OptionExtras {
  readonly effects?: Consequence[];
  readonly showWhen?: Condition;
  readonly requirements?: Condition;
  readonly requirementFail?: string;
}

/** One choice on `nodeId`; its label key is derived from the node and choice ids together. */
function opt(nodeId: string, id: string, label: string, goto: string, extras: OptionExtras = {}): ChoiceSource {
  const { effects, showWhen, requirements, requirementFail } = extras;
  return {
    id,
    label: text(nodeId, id, label),
    ...(showWhen !== undefined ? { showWhen } : {}),
    ...(requirements !== undefined ? { requirements } : {}),
    ...(requirementFail !== undefined ? { requirementFail: text(nodeId, `${id}_fail`, requirementFail) } : {}),
    ...(effects !== undefined ? { effects } : {}),
    goto,
  };
}

const nodes: Record<string, NodeSource> = Object.create(null) as Record<string, NodeSource>;

function pick(id: string, body: string, choices: ChoiceSource[]): void {
  nodes[id] = { kind: "choice", text: text(id, "text", body), choices };
}

/** A page with one way forward — a beat, not a decision. */
function page(id: string, body: string, label: string, goto: string, effects?: Consequence[]): void {
  pick(id, body, [opt(id, `${id}_next`, label, goto, effects === undefined ? {} : { effects })]);
}

function say(id: string, body: string, goto: string): void {
  nodes[id] = { kind: "auto", text: text(id, "text", body), goto };
}

function fork(id: string, body: string, transitions: RandomTransition[]): void {
  nodes[id] = { kind: "random", text: text(id, "text", body), transitions };
}

function finish(id: string, endingId: string, title: string, body: string, outcome: "win" | "loss" | "neutral"): void {
  nodes[`ending_${id}`] = {
    kind: "ending",
    text: text(`ending_${id}`, "text", `${title}\n\n${body}`),
    endingId,
    outcome,
  };
}

// ---------------------------------------------------------------------------
// Prologue
// ---------------------------------------------------------------------------

pick(
  "prologue",
  "It began, as most catastrophes do, with a perfectly ordinary conversation.\n\n" +
    "Lucifer asked Saki for a story — something he liked, something that might become game content. Saki, being a person with a life and no obligation to supply entertainment on demand, did not immediately produce one.\n\n" +
    "This was Saki's first mistake. Not because Saki had done anything wrong. Because Lucifer now had infrastructure.",
  [
    opt("prologue", "ask_again", "Ask again, patiently, like a normal person", "incident_1"),
    opt("prologue", "invent_one", "Announce that you will simply invent one yourself", "incident_1", {
      effects: [inc("scope_creep"), inc("infrastructure")],
    }),
    opt("prologue", "send_a_message", "Close the laptop and send Saki four sentences", "speedrun_warning", {
      effects: [put("talked_to_saki", true)],
    }),
    opt("prologue", "read_changelog", "Read the changelog first, for no reason anyone can defend", "changelog", {
      effects: [inc("overthinking")],
    }),
  ],
);

page(
  "changelog",
  "The changelog reads: 'Saki: Quest for Redemption — initial commit.' It is timestamped roughly one day after the conversation that caused it.\n\n" +
    "You have not written any of this yet. The tooling is simply confident.",
  "Return to the conversation and pretend you saw nothing",
  "prologue",
);

pick(
  "speedrun_warning",
  "You type four sentences. Development time: approximately ninety seconds.\n\n" +
    "The narrator, who had prepared five acts, a tribunal, eight endings and a deterministic state machine, says nothing. The silence is enormous.",
  [
    opt("speedrun_warning", "speedrun_send", "Send it. Be a normal adult.", "ending_speedrun", {
      effects: [inc("saki_approval", 3), inc("redemption_progress", 3)],
    }),
    opt("speedrun_warning", "speedrun_reconsider", "Delete it. Surely this deserves a proper quest.", "incident_1", {
      effects: [inc("common_sense_ignored"), inc("scope_creep"), dec("lucifer_dignity")],
    }),
  ],
);

// ---------------------------------------------------------------------------
// Act I — The Incident
// ---------------------------------------------------------------------------

pick(
  "incident_1",
  "ACT I — THE INCIDENT\n\n" +
    "Something, at some point in that conversation, went sufficiently wrong that redemption is now required.\n\n" +
    "Nobody has confirmed this. Saki has not been consulted. Lucifer is confident.",
  [
    opt("incident_1", "incident_review", "Review the conversation forensically", "incident_review_event", {
      effects: [inc("overthinking")],
    }),
    opt("incident_1", "incident_assume", "Assume the worst and proceed with dignity", "incident_review_event", {
      effects: [dec("lucifer_dignity")],
    }),
    opt("incident_1", "incident_ask", "Ask Saki whether anything is actually wrong", "common_sense_1"),
  ],
);

fork("incident_review_event", "The record is consulted. It is unhelpful in two distinct ways.", [
  { weight: 1, effects: [inc("overthinking")], goto: "incident_evidence_a" },
  { weight: 1, effects: [inc("philosophy")], goto: "incident_evidence_b" },
]);

page(
  "incident_evidence_a",
  "The transcript shows Lucifer asking for a story and Saki replying at a completely reasonable speed for a human being. No offense is visible anywhere in the record.\n\n" +
    "This is the most alarming outcome available.",
  "Classify it anyway",
  "incident_3",
);

page(
  "incident_evidence_b",
  "The transcript shows two friends talking. Lucifer reads it four times looking for a wound.\n\n" +
    "The absence of one does not slow him down in the slightest.",
  "Classify it anyway",
  "incident_3",
);

pick(
  "incident_3",
  "The Incident requires a classification before a quest can be opened.\n\n" +
    "This is not true. The quest log insists. The quest log is a spreadsheet Lucifer wrote himself last Tuesday.",
  [
    opt("incident_3", "class_minor", "Minor Friendship Incident", "incident_classified", { effects: [put("severity", "minor")] }),
    opt("incident_3", "class_two", "Class-II Conversational Miscalculation", "incident_classified", {
      effects: [put("severity", "class_two"), inc("overthinking")],
    }),
    opt("incident_3", "class_opinion", "Unauthorized Deployment of Opinion", "incident_classified", {
      effects: [put("severity", "unauthorized_opinion"), dec("lucifer_dignity")],
    }),
    opt("incident_3", "class_observability", "Failure of Interpersonal Observability", "incident_classified", {
      effects: [put("severity", "observability"), inc("infrastructure")],
    }),
    opt("incident_3", "class_integrity", "Friendship Integrity Check Failure", "incident_classified", {
      effects: [put("severity", "integrity_check"), inc("scope_creep")],
    }),
  ],
);

say(
  "incident_classified",
  "A quest has been generated.\n\nNobody generated it. It is simply there now, with a title, an icon, a progress bar, and an entirely unreasonable amount of confidence.",
  "incident_4",
);

pick(
  "incident_4",
  "The quest log offers a difficulty setting. Every option is the same difficulty. Only the framing changes.",
  [
    opt("incident_4", "take_seriously", "Take it seriously", "act2_open", { effects: [inc("redemption_progress")] }),
    opt("incident_4", "take_theatrically", "Take it far too seriously", "act2_open", {
      effects: [inc("scope_creep"), inc("redemption_progress"), dec("lucifer_dignity")],
    }),
    opt("incident_4", "take_lightly", "Take it lightly, which will not last", "act2_open", { effects: [inc("philosophy")] }),
    opt("incident_4", "build_infrastructure", "Build infrastructure", "infra_1", {
      effects: [inc("infrastructure", 2), inc("scope_creep")],
    }),
  ],
);

pick(
  "infra_1",
  "You build infrastructure.\n\n" +
    "It is not clear what the infrastructure is for. It has a schema. It validates. It has ninety-eight percent test coverage. It has never met Saki and would not recognise him in a queue.",
  [
    opt("infra_1", "infra_back", "Return to the quest, now with tooling", "act2_open", { effects: [inc("redemption_progress")] }),
    opt("infra_1", "infra_more", "Add a second service, because the first one looked lonely", "act2_open", {
      effects: [inc("infrastructure", 2), inc("scope_creep", 2), dec("lucifer_dignity")],
    }),
  ],
);

// ---------------------------------------------------------------------------
// Act II — The Tribunal
// ---------------------------------------------------------------------------

say(
  "act2_open",
  "ACT II — THE TRIBUNAL\n\nRedemption, it turns out, has requirements. Lucifer does not know what they are.\n\nHe therefore convenes a tribunal, which is what a person does instead of asking.",
  "tribunal_hub",
);

pick(
  "tribunal_hub",
  "Seven authorities are available for consultation.\n\nNone of them are Saki. Saki is asleep and has no idea any of this is happening.",
  [
    opt("tribunal_hub", "consult_conscience", "Consult your conscience", "tribunal_conscience", { showWhen: unvisited("tribunal_conscience") }),
    opt("tribunal_hub", "consult_common_sense", "Consult common sense", "common_sense_1"),
    opt("tribunal_hub", "consult_bureaucrat", "Consult an imaginary bureaucrat", "tribunal_bureaucrat", { showWhen: unvisited("tribunal_bureaucrat") }),
    opt("tribunal_hub", "consult_god", "Consult God, who is awake and mildly interested", "tribunal_god", { showWhen: unvisited("tribunal_god") }),
    opt("tribunal_hub", "consult_agent", "Consult an AI agent", "tribunal_agent", { showWhen: unvisited("tribunal_agent") }),
    opt("tribunal_hub", "consult_self", "Consult Lucifer", "tribunal_self", { showWhen: unvisited("tribunal_self") }),
    opt("tribunal_hub", "consult_questlog", "Consult a completely inappropriate RPG quest log", "tribunal_questlog", { showWhen: unvisited("tribunal_questlog") }),
    opt("tribunal_hub", "full_bench", "Convene the full bench, which has never been done and should not be", "tribunal_full_bench", {
      showWhen: {
        all: [
          visited("tribunal_conscience"),
          visited("common_sense_1"),
          visited("tribunal_bureaucrat"),
          visited("tribunal_god"),
          visited("tribunal_agent"),
          visited("tribunal_self"),
          visited("tribunal_questlog"),
        ],
      },
      effects: [inc("philosophy")],
    }),
    opt("tribunal_hub", "conclude", "Declare the tribunal concluded", "tribunal_verdict", { effects: [put("tribunal_completed", true)] }),
  ],
);

pick(
  "tribunal_conscience",
  "Conscience arrives, reviews the file, and observes that the offense may not exist.\n\nConscience is thanked for its time and asked to leave for being unhelpful.",
  [
    opt("tribunal_conscience", "conscience_accept", "Accept that there may be no offense", "tribunal_hub", {
      effects: [inc("redemption_progress"), inc("lucifer_dignity")],
    }),
    opt("tribunal_conscience", "conscience_reject", "Reject the finding on procedural grounds", "tribunal_hub", {
      effects: [inc("overthinking"), dec("lucifer_dignity")],
    }),
  ],
);

pick(
  "common_sense_1",
  "Common Sense has one recommendation. It has had the same recommendation since the beginning and will not be developing a second one.\n\n" +
    "'Just talk to Saki.'",
  [
    opt("common_sense_1", "obey", "Just talk to Saki", "saki_direct", {
      effects: [put("talked_to_saki", true), inc("saki_approval", 2), inc("redemption_progress", 2)],
    }),
    opt("common_sense_1", "decline_scaffolded", "Decline: the quest is already scaffolded", "tribunal_hub", {
      effects: [inc("common_sense_ignored"), inc("scope_creep")],
    }),
    opt("common_sense_1", "decline_philosophy", "Decline: the nature of apology must first be established", "tribunal_hub", {
      effects: [inc("common_sense_ignored"), inc("philosophy")],
    }),
    opt("common_sense_1", "decline_infrastructure", "Decline: build infrastructure", "tribunal_hub", {
      effects: [inc("common_sense_ignored"), inc("infrastructure", 2)],
    }),
  ],
);

pick(
  "tribunal_bureaucrat",
  "The Imaginary Bureaucrat requires Form R-1, Request to Be Forgiven, countersigned by the offended party.\n\n" +
    "The offended party has not yet been informed that he is the offended party.",
  [
    opt("tribunal_bureaucrat", "file_form", "File the form", "tribunal_hub", {
      effects: [inc("redemption_progress"), inc("overthinking")],
    }),
    opt("tribunal_bureaucrat", "ask_consent", "Ask where the consent field is", "consent_field", {
      effects: [put("consent_field_checked", true), inc("philosophy")],
    }),
  ],
);

page(
  "consent_field",
  "Saki had not agreed to become an NPC. Unfortunately, the data contract contains no consent field.\n\n" +
    "The Bureaucrat suggests adding one in a future version. Lucifer writes this down. Lucifer will not do it.",
  "Return to the tribunal, mildly haunted",
  "tribunal_hub",
  [dec("lucifer_dignity")],
);

pick(
  "tribunal_god",
  "God is consulted. God points out that the entire apparatus was assembled in roughly a day, and asks — genuinely curious, no judgement in it — what Lucifer would have produced with a week.",
  [
    opt("tribunal_god", "answer_honestly", "Answer honestly: more of this", "tribunal_hub", {
      effects: [inc("scope_creep", 2), dec("lucifer_dignity")],
    }),
    opt("tribunal_god", "deflect", "Deflect into cosmology", "tribunal_hub", { effects: [inc("philosophy", 2)] }),
  ],
);

pick(
  "tribunal_agent",
  "An AI agent is consulted. It returns a plan with five acts, eight endings, a state schema and a validation gate.\n\nIt is a very good plan. That is the problem.",
  [
    opt("tribunal_agent", "accept_plan", "Accept the plan", "tribunal_hub", {
      effects: [inc("infrastructure"), inc("scope_creep"), inc("redemption_progress")],
    }),
    opt("tribunal_agent", "ask_short", "Ask for the shortest possible version", "agent_short", { effects: [inc("lucifer_dignity")] }),
  ],
);

page(
  "agent_short",
  "The shortest possible version is: 'Sorry, that got a bit much. Drink sometime?'\n\n" +
    "Lucifer thanks the agent, saves the suggestion somewhere safe, and opens the campaign file.",
  "Continue building",
  "tribunal_hub",
  [inc("common_sense_ignored"), inc("scope_creep")],
);

pick(
  "tribunal_self",
  "Lucifer consults Lucifer.\n\nThis produces immediate unanimous agreement and no new information whatsoever.",
  [
    opt("tribunal_self", "ratify", "Ratify your own opinion unanimously", "tribunal_hub", {
      effects: [inc("overthinking"), dec("lucifer_dignity")],
    }),
    opt("tribunal_self", "dissent", "Dissent from yourself, for balance", "tribunal_hub", { effects: [inc("philosophy")] }),
  ],
);

pick(
  "tribunal_questlog",
  "The quest log is consulted, which is like asking a spreadsheet for closure. It reports: 'REDEMPTION 0/1. Objective unclear. Marker placed.'\n\n" +
    "The marker has been placed on Saki's house. Saki's house has never been part of this.",
  [
    opt("tribunal_questlog", "remove_marker", "Remove the marker immediately", "tribunal_hub", { effects: [inc("lucifer_dignity")] }),
    opt("tribunal_questlog", "keep_marker", "Leave it. It looks official.", "tribunal_hub", {
      effects: [dec("lucifer_dignity", 2), inc("scope_creep")],
    }),
  ],
);

pick(
  "tribunal_full_bench",
  "All seven authorities sit at once. They disagree on everything except a single point, which they state in unison and which Lucifer has now heard four times.\n\nCommon Sense looks tired.",
  [
    opt("tribunal_full_bench", "minute_it", "Minute the unanimous finding and ignore it", "tribunal_verdict", {
      effects: [inc("common_sense_ignored", 2), inc("philosophy")],
    }),
    opt("tribunal_full_bench", "adjourn", "Adjourn the bench and go talk to Saki", "saki_direct", {
      effects: [put("talked_to_saki", true), inc("saki_approval", 2), inc("redemption_progress", 2)],
    }),
  ],
);

say(
  "tribunal_verdict",
  "VERDICT: redemption requires trials.\n\nThe tribunal cannot say why. The tribunal is, at this point, four abstractions and a spreadsheet.",
  "trials_hub",
);

// ---------------------------------------------------------------------------
// Act III — The Trials of Redemption
// ---------------------------------------------------------------------------

pick(
  "trials_hub",
  "ACT III — THE TRIALS OF REDEMPTION\n\nThree trials now stand between Lucifer and forgiveness for a thing that may not have happened.",
  [
    opt("trials_hub", "trial_reflection", "The Trial of Reflection", "trial_reflection_1", { showWhen: unvisited("trial_reflection_1") }),
    opt("trials_hub", "trial_apology", "The Trial of the Apology", "trial_apology_1", { showWhen: unvisited("trial_apology_1") }),
    opt("trials_hub", "trial_gift", "The Trial of the Gift", "trial_gift_1", { showWhen: unvisited("trial_gift_1") }),
    opt("trials_hub", "trial_restraint", "The Trial of Restraint, which is already going badly", "trial_restraint_1", {
      showWhen: { all: [atLeast("overthinking", 3), unvisited("trial_restraint_1")] },
    }),
    opt("trials_hub", "trials_done", "Declare the trials complete", "act4_open", {
      requirements: atLeast("redemption_progress", 2),
      requirementFail: "The quest log declines. You have not yet suffered procedurally.",
    }),
    opt("trials_hub", "trials_abandon", "Abandon the trials; they were self-imposed anyway", "act4_open", {
      effects: [inc("lucifer_dignity")],
    }),
  ],
);

pick(
  "trial_reflection_1",
  "TRIAL OF REFLECTION\n\nLucifer must reflect upon his actions. A quiet room is provided. The quiet lasts eleven seconds.",
  [
    opt("trial_reflection_1", "reflect_honestly", "Reflect honestly", "reflection_event", {
      effects: [inc("redemption_progress", 2), inc("lucifer_dignity")],
    }),
    opt("trial_reflection_1", "reflect_overthink", "Overthink everything", "reflection_event", {
      effects: [inc("overthinking", 3), dec("lucifer_dignity")],
    }),
    opt("trial_reflection_1", "reflect_ask_ai", "Ask an AI to reflect on your behalf", "reflection_event", {
      effects: [inc("overthinking"), inc("infrastructure")],
    }),
    opt("trial_reflection_1", "reflect_build", "Build infrastructure", "reflection_event", {
      effects: [inc("infrastructure", 3), inc("scope_creep", 2), dec("lucifer_dignity")],
    }),
  ],
);

fork("reflection_event", "Reflection produces a result. Reflection was never asked what kind of result.", [
  { weight: 1, effects: [inc("philosophy")], goto: "reflection_result_a" },
  { weight: 1, effects: [inc("redemption_progress")], goto: "reflection_result_b" },
]);

page(
  "reflection_result_a",
  "The finding is that Lucifer talks a great deal and occasionally forgets to leave a gap.\n\n" +
    "This is true, unremarkable, and would have taken one sentence to say out loud.",
  "Log it as a finding",
  "trials_hub",
);

page(
  "reflection_result_b",
  "The finding is that Saki is a good friend, and that this is an extremely elaborate way of noticing it.",
  "Log it as a finding",
  "trials_hub",
  [inc("saki_approval")],
);

pick(
  "trial_apology_1",
  "TRIAL OF THE APOLOGY\n\nAn apology must be constructed.\n\n'Constructed' is the word being used, and nobody has objected to it yet.",
  [
    opt("trial_apology_1", "apology_sincere", "Sincere", "apology_result", {
      effects: [put("apology_form", "sincere"), inc("redemption_progress", 2), inc("saki_approval", 2)],
    }),
    opt("trial_apology_1", "apology_formal", "Overly formal, with a reference number", "apology_result", {
      effects: [put("apology_form", "formal"), inc("overthinking"), inc("redemption_progress")],
    }),
    opt("trial_apology_1", "apology_legal", "Legally defensive, admitting nothing", "apology_result", {
      effects: [put("apology_form", "legal"), dec("lucifer_dignity", 2), dec("saki_approval")],
    }),
    opt("trial_apology_1", "apology_rpg", "As RPG dialogue, with three response options for Saki", "apology_result", {
      effects: [put("apology_form", "rpg"), inc("scope_creep"), inc("philosophy")],
    }),
    opt("trial_apology_1", "apology_campaign", "Skip the apology and build an entire interactive campaign instead", "apology_campaign_node", {
      effects: [put("apology_form", "campaign"), inc("scope_creep", 3), inc("infrastructure", 3), dec("lucifer_dignity", 2)],
    }),
  ],
);

say("apology_result", "The apology is filed.\n\nFiled. A word that should never appear anywhere near an apology, and which has now appeared twice.", "trials_hub");

page(
  "apology_campaign_node",
  "ACHIEVEMENT UNLOCKED — We Have Lost Control of the Scope\n\n" +
    "The apology is now a playable adventure with branching paths, achievements and a deterministic state machine. It is, objectively, quite good.\n\nThat is not a defense. That is an aggravating factor.",
  "Continue, because stopping now would waste the work",
  "trials_hub",
  [inc("scope_creep")],
);

pick(
  "trial_gift_1",
  "TRIAL OF THE GIFT\n\nCustom requires an offering. Lucifer considers what Saki would actually want.\n\nThis is the first time today that question has been asked.",
  [
    opt("trial_gift_1", "gift_drink", "A drink, in person, with no agenda", "gift_result", {
      effects: [inc("saki_approval", 3), inc("redemption_progress", 2)],
    }),
    opt("trial_gift_1", "gift_story", "The story he asked for, finally written", "gift_result", {
      effects: [inc("saki_approval", 2), inc("redemption_progress", 2), inc("lucifer_dignity")],
    }),
    opt("trial_gift_1", "gift_repo", "A private repository, with a README and a licence", "gift_result", {
      effects: [inc("infrastructure", 2), inc("scope_creep", 2), dec("lucifer_dignity")],
    }),
    opt("trial_gift_1", "gift_statue", "A statue. Marble. Load-bearing.", "gift_statue", {
      effects: [dec("lucifer_dignity", 3), inc("scope_creep")],
    }),
  ],
);

page(
  "gift_statue",
  "The statue is commissioned before anyone can intervene. It is three metres tall and depicts Saki looking mildly inconvenienced, which is at least accurate.\n\nIt will not fit through the door. Neither will the apology.",
  "Cancel the statue and never mention it again",
  "trials_hub",
);

say("gift_result", "The gift is prepared. It waits by the door with the calm of an object that does not know what it is part of.", "trials_hub");

pick(
  "trial_restraint_1",
  "TRIAL OF RESTRAINT\n\nThis trial only appears to players who have overthought enough to require it. Passing it means doing nothing at all for one full minute.",
  [
    opt("trial_restraint_1", "restraint_pass", "Do nothing. Genuinely nothing.", "restraint_result", {
      effects: [inc("lucifer_dignity", 3), inc("redemption_progress")],
    }),
    opt("trial_restraint_1", "restraint_fail", "Open the campaign file to check one small thing", "restraint_result", {
      effects: [inc("scope_creep", 2), inc("infrastructure"), dec("lucifer_dignity")],
    }),
    opt("trial_restraint_1", "restraint_philosophy", "Consider whether doing nothing is itself an action", "restraint_result", {
      effects: [inc("philosophy", 3)],
    }),
  ],
);

say("restraint_result", "The minute passes. Somewhere, quietly, it is recorded.", "trials_hub");

// ---------------------------------------------------------------------------
// Act IV — The Arithmetic
// ---------------------------------------------------------------------------

say("act4_open", "ACT IV — THE ARITHMETIC\n\nThe narrator would like to raise something.", "meta_1");

pick(
  "meta_1",
  "At this point Lucifer could have sent Saki a four-sentence message. Development time: approximately ninety seconds.\n\n" +
    "Instead, you are here. So is a validation gate, a determinism guard, and a test that plays this to completion in under a second.",
  [
    opt("meta_1", "meta_accept", "Acknowledge the arithmetic and keep going", "meta_event", { effects: [inc("scope_creep")] }),
    opt("meta_1", "meta_defend", "Argue that the four sentences would have been worse", "meta_event", {
      effects: [inc("philosophy"), dec("lucifer_dignity")],
    }),
    opt("meta_1", "meta_stop", "Stop. Send the four sentences.", "saki_direct", {
      effects: [put("talked_to_saki", true), inc("saki_approval", 2), inc("redemption_progress", 2)],
    }),
  ],
);

fork("meta_event", "The fourth wall is load-bearing here, and has begun making a noise.", [
  { weight: 1, effects: [inc("philosophy")], goto: "meta_note_a" },
  { weight: 1, effects: [inc("scope_creep")], goto: "meta_note_b" },
]);

page(
  "meta_note_a",
  "Twenty-four hours earlier, this was a conversation.\n\nIt now has schema validation.",
  "Continue",
  "meta_2",
);

page(
  "meta_note_b",
  "Most friendships accumulate memories.\n\nThis one apparently accumulates deployable content.",
  "Continue",
  "meta_2",
);

pick(
  "meta_2",
  "The build is green. Every gate passes. Type checking, linting, the determinism harness, all of it.\n\nNothing in the pipeline is capable of asking whether this should exist.",
  [
    opt("meta_2", "ship", "Ship it and go find Saki", "act5_open", { effects: [inc("redemption_progress", 2)] }),
    opt("meta_2", "more_infrastructure", "Build more infrastructure first", "infra_2", {
      effects: [inc("infrastructure", 3), inc("scope_creep", 3), dec("lucifer_dignity", 2)],
    }),
    opt("meta_2", "delete", "Delete the whole thing", "meta_delete_node", { effects: [inc("lucifer_dignity", 2)] }),
    opt("meta_2", "philosophy", "Determine whether redemption is a social construct", "philosophy_node", {
      showWhen: atLeast("philosophy", 3),
      effects: [inc("philosophy", 2)],
    }),
  ],
);

pick(
  "infra_2",
  "Three new repositories now exist. One holds the campaign. One holds the tooling that builds the campaign. One documents the tooling.\n\nNone of them contain an apology.",
  [
    opt("infra_2", "carry_on", "Go to Saki anyway, carrying repositories", "act5_open", { effects: [inc("scope_creep")] }),
    opt("infra_2", "commit_fully", "Commit to the infrastructure. Fully. Permanently.", "ending_scope_creep", {
      effects: [inc("infrastructure", 4), inc("scope_creep", 4), dec("lucifer_dignity", 3)],
    }),
  ],
);

page(
  "meta_delete_node",
  "You select the folder. Your hand hovers. The folder contains sixty-one nodes, eight endings, and a joke about a marble statue that you are quite proud of.\n\nYou do not delete it. You were never going to delete it.",
  "Admit that and continue",
  "act5_open",
  [dec("lucifer_dignity"), inc("redemption_progress")],
);

pick(
  "philosophy_node",
  "Alan Watts is invoked. The conclusion is that the self seeking forgiveness and the self requiring it are the same wave in the same ocean, that guilt is a costume, and that redemption was never a thing one person could grant another.\n\n" +
    "Saki has been asleep for the entire argument.",
  [
    opt("philosophy_node", "pursue", "Pursue this to its conclusion", "ending_philosophical", { effects: [inc("philosophy", 3)] }),
    opt("philosophy_node", "abandon", "Abandon cosmology and go find your friend", "act5_open", {
      effects: [inc("redemption_progress"), inc("lucifer_dignity")],
    }),
  ],
);

// ---------------------------------------------------------------------------
// Act V — Saki
// ---------------------------------------------------------------------------

say(
  "act5_open",
  "ACT V — SAKI\n\nSaki wakes up. It is an ordinary morning.\n\nIt will remain an ordinary morning for approximately four more minutes.",
  "saki_1",
);

pick(
  "saki_1",
  "Saki opens the link. The title reads 'Saki: Quest for Redemption.' Beneath it: a play button, a content notice, a version number, and eight achievement slots.\n\n" +
    "Mercifully, this particular historical record was never released to the general public.",
  [
    opt("saki_1", "explain", "Explain yourself immediately, at length", "saki_event", { effects: [inc("overthinking")] }),
    opt("saki_1", "say_nothing", "Say nothing and let it load", "saki_event", { effects: [inc("lucifer_dignity")] }),
    opt("saki_1", "lead_with_apology", "Lead with the apology", "saki_event", {
      requirements: { field: "var.apology_form", operator: "not_equals", value: "none" },
      requirementFail: "You never actually wrote one. Five acts, and no apology.",
      effects: [inc("saki_approval", 2), inc("redemption_progress")],
    }),
  ],
);

fork("saki_event", "Saki reads. The pause is not long, but it is structurally significant.", [
  { weight: 1, effects: [inc("saki_approval")], goto: "saki_reaction_a" },
  { weight: 1, effects: [inc("philosophy")], goto: "saki_reaction_b" },
]);

page(
  "saki_reaction_a",
  "'You actually made a game out of this?'\n\nIt is not an accusation. It is closer to a diagnosis.",
  "Confirm that you did",
  "saki_judgment",
);

page(
  "saki_reaction_b",
  "'Why does it have achievements?'\n\nThere is no good answer to this. There is a technically correct one, which is considerably worse.",
  "Give the technically correct answer",
  "saki_judgment",
  [dec("lucifer_dignity")],
);

pick(
  "saki_direct",
  "You talk to Saki. It takes four minutes. Nothing is on fire. Nothing ever was.\n\n" +
    "Somewhere in it he mentions, without weight, that he would have read a story if you had just written him one.",
  [
    opt("saki_direct", "write_the_story", "Write him the story. No engine. No schema. Just the story.", "ending_normal_adult", {
      effects: [inc("saki_approval", 3), inc("redemption_progress", 3), inc("lucifer_dignity", 2)],
    }),
    opt("saki_direct", "end_here", "End it here, with the friendship intact and no deliverable", "ending_speedrun", {
      showWhen: { field: "var.infrastructure", operator: "equals", value: 0 },
    }),
    opt("saki_direct", "relapse", "Agree warmly, then quietly open the campaign file", "saki_judgment", {
      effects: [inc("common_sense_ignored", 2), inc("scope_creep", 2), dec("lucifer_dignity", 2)],
    }),
  ],
);

pick(
  "saki_judgment",
  "Saki considers the trials. The branching narrative. The deterministic state machine. The automated deployment pipeline. The philosophical implications. The marble statue line, which he has not reached yet.\n\nJudgment is rendered.",
  [
    opt("saki_judgment", "judge_redeemed", "Redemption", "ending_redeemed", {
      requirements: { all: [atLeast("redemption_progress", 5), atLeast("saki_approval", 3)] },
      requirementFail: "Redemption is a state, not a button. The state is not met.",
    }),
    opt("saki_judgment", "judge_idiot", "The smallest possible reaction", "ending_idiot", {
      showWhen: atLeast("common_sense_ignored", 3),
    }),
    opt("saki_judgment", "judge_recursive", "Note his one objection, and open a new file", "ending_content_pipeline", {
      showWhen: { all: [flag("consent_field_checked", true), atLeast("scope_creep", 4)] },
    }),
    opt("saki_judgment", "judge_philosophy", "Deliver the cosmology", "ending_philosophical", { showWhen: atLeast("philosophy", 4) }),
    opt("saki_judgment", "judge_scope", "Explain that this could easily be a series", "ending_scope_creep", { effects: [inc("scope_creep", 2)] }),
    opt("saki_judgment", "judge_unresolved", "Say nothing and close the laptop", "ending_unresolved"),
  ],
);

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

finish(
  "redeemed",
  "redeemed",
  "Redemption",
  "Saki accepts the ridiculous gesture in the spirit it was ridiculously offered.\n\n" +
    "He does not pretend it was proportionate. He does not pretend it was necessary. He reads the whole thing, finds two typos and one joke he genuinely likes, and says so.\n\n" +
    "The offense, which never existed, is formally closed.",
  "win",
);

finish(
  "speedrun",
  "speedrun",
  "Normal Human Being",
  "You talked to your friend. It took four minutes and resolved everything.\n\n" +
    "The narrator, who had prepared five acts, would like it noted that this was technically the correct decision and that he is nevertheless deeply disappointed.\n\nNo repositories were created. Nobody is happy about this except the two people involved.",
  "neutral",
);

finish(
  "scope_creep",
  "scope_creep",
  "Infrastructure",
  "Rather than resolve anything emotionally, Lucifer resolves it architecturally.\n\n" +
    "Three new repositories now exist. There is a roadmap. There is a versioning policy. There is a plan to open-source the tooling that generates apologies.\n\n" +
    "Saki remains unresolved. Saki was never the blocker.",
  "loss",
);

finish(
  "philosophical",
  "philosophical",
  "Philosophical Victory",
  "Lucifer establishes, to his own complete satisfaction, that redemption is a social construct, that the self is a rumour, and that forgiveness cannot be transferred between two things that were never separate.\n\n" +
    "Saki, who has been awake for eleven minutes and has not had coffee, is unimpressed.\n\nAlan Watts cannot help you here.",
  "loss",
);

finish(
  "content_pipeline",
  "content_pipeline",
  "The Content Pipeline",
  "Saki raises exactly one objection.\n\nIt is a good objection. It is also, Lucifer notices, a premise.\n\n" +
    "The new file is open before the sentence finishes. Somewhere a consent field is still not being added.",
  "win",
);

finish(
  "idiot",
  "idiot",
  "The Smallest Possible Reaction",
  "Saki looks at the completed Quest for Redemption. The trials. The branching narrative. The deterministic state machine. The automated deployment pipeline. The philosophical implications.\n\n" +
    "He considers all of it for a moment, and delivers a verdict of two words that deflates the entire cosmic apparatus.\n\nREDEMPTION ACHIEVED.",
  "win",
);

finish(
  "unresolved",
  "unresolved",
  "Unresolved",
  "You close the laptop without sending anything.\n\n" +
    "The campaign is complete, validated, tested, and seen by nobody. It will sit in a private repository being technically excellent.\n\nSaki has a perfectly nice day and never learns any of this happened.",
  "neutral",
);

finish(
  "normal_adult",
  "normal_adult",
  "The Story He Asked For",
  "You write Saki the story. No engine. No schema. No achievements. No validation gate.\n\n" +
    "It takes an evening. He reads it, likes it, and says so, and that is the entire transaction.\n\nThe infrastructure sits in the dark, unused, waiting for the next perfectly ordinary conversation.",
  "win",
);

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function achievement(id: string, name: string, description: string, condition: Condition): AchievementDefinitionSource {
  return {
    id,
    name: text(`achievement_${id}`, "name", name),
    description: text(`achievement_${id}`, "description", description),
    hidden: true,
    condition,
  };
}

const ENDING_ACHIEVEMENTS: readonly (readonly [string, string, string])[] = [
  ["redeemed", "Redeemed", "Be forgiven for a thing that may not have happened."],
  ["speedrun", "Speedrun", "Resolve the entire campaign by behaving like an adult."],
  ["scope_creep", "Scope Creep", "Answer an emotional problem with three repositories."],
  ["alan_watts", "Alan Watts Cannot Help You Here", "Win the argument and lose the point."],
  ["content_pipeline", "Content Pipeline", "Convert your friend's objection into the next story arc."],
  ["you_are_an_idiot", "You Are An Idiot", "Receive the smallest possible reaction to the largest possible gesture."],
  ["seen_by_nobody", "Seen By Nobody", "Ship a private campaign to an audience of zero."],
  ["normal_human_being", "Normal Human Being", "Write the story he actually asked for."],
];

const ENDING_FOR_ACHIEVEMENT: Readonly<Record<string, string>> = {
  redeemed: "redeemed",
  speedrun: "speedrun",
  scope_creep: "scope_creep",
  alan_watts: "philosophical",
  content_pipeline: "content_pipeline",
  you_are_an_idiot: "idiot",
  seen_by_nobody: "unresolved",
  normal_human_being: "normal_adult",
};

const achievements: AchievementDefinitionSource[] = [
  ...ENDING_ACHIEVEMENTS.map(([id, name, description]) =>
    achievement(id, name, description, { field: "ending", operator: "equals", value: ENDING_FOR_ACHIEVEMENT[id] })),
  achievement(
    "lost_control_of_the_scope",
    "We Have Lost Control of the Scope",
    "Replace an apology with an interactive campaign.",
    { field: "var.apology_form", operator: "equals", value: "campaign" },
  ),
  achievement("architecture_zero", "Architecture: 0", "Build six units of infrastructure for a conversation.", atLeast("infrastructure", 6)),
  achievement("no_consent_field", "The Data Contract Has No Consent Field", "Ask the one question the schema cannot answer.", flag("consent_field_checked", true)),
  achievement("common_sense_was_right", "Common Sense Was Right", "Ignore the correct advice four separate times.", atLeast("common_sense_ignored", 4)),
  achievement("dignity_underflow", "Dignity: Underflow", "Reduce Lucifer's dignity to nothing at all.", { field: "var.lucifer_dignity", operator: "less_or_equal", value: 0 }),
  achievement("read_the_changelog", "Who Reads The Changelog", "Find the commit that predates the decision to write it.", visited("changelog")),
  achievement("full_bench", "The Full Bench", "Consult every authority except the one that matters.", visited("tribunal_full_bench")),
  achievement("load_bearing_marble", "Load-Bearing Marble", "Commission a statue of a man who did not ask for one.", visited("gift_statue")),
  achievement("procedurally_insufficient", "Procedurally Insufficient", "Reach the fifth act without producing an apology.", { all: [visited("saki_1"), { field: "var.apology_form", operator: "equals", value: "none" }] }),
];

// ---------------------------------------------------------------------------

const TITLE: AuthoredText = { key: "saki.campaign.title", text: "Saki: Quest for Redemption" };

export const sakiQuestSource: StoryGraphCampaignSource = {
  description: {
    key: "saki.campaign.description",
    text:
      "Lucifer asked a friend for a story, did not get one fast enough, and built an entire deterministic adventure game about it in roughly a day. " +
      "Saki did not request this. Saki did not request any of this.",
  },
  variables: {
    saki_approval: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: text("var_saki_approval", "label", "Saki Approval") },
    lucifer_dignity: { type: "int", initial: 4, min: -12, max: 10, visible: true, label: text("var_lucifer_dignity", "label", "Lucifer Dignity") },
    redemption_progress: { type: "int", initial: 0, min: 0, max: 16, visible: true, label: text("var_redemption_progress", "label", "Redemption Progress") },
    overthinking: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: text("var_overthinking", "label", "Overthinking") },
    infrastructure: { type: "int", initial: 0, min: 0, max: 16, visible: true, label: text("var_infrastructure", "label", "Infrastructure Built") },
    common_sense_ignored: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: text("var_common_sense_ignored", "label", "Common Sense Ignored") },
    scope_creep: { type: "int", initial: 0, min: 0, max: 16, visible: true, label: text("var_scope_creep", "label", "Scope Creep") },
    philosophy: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: text("var_philosophy", "label", "Philosophical Detours") },
    severity: {
      type: "enum",
      initial: "unclassified",
      values: ["unclassified", "minor", "class_two", "unauthorized_opinion", "observability", "integrity_check"],
    },
    apology_form: { type: "enum", initial: "none", values: ["none", "sincere", "formal", "legal", "rpg", "campaign"] },
    talked_to_saki: { type: "bool", initial: false },
    consent_field_checked: { type: "bool", initial: false },
    tribunal_completed: { type: "bool", initial: false },
  },
  startNodeId: "prologue",
  nodes,
  achievements,
};

export function buildSakiQuestCampaign(source: StoryGraphCampaignSource = sakiQuestSource): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: SAKI_QUEST_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
