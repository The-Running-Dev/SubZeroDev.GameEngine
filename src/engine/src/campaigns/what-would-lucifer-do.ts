/**
 * What Would Lucifer Do?
 *
 * A public story-graph campaign adapted from the SubZeroDev Blog. The player is not
 * Lucifer. The player is trying to predict him. Each chapter establishes a real incident —
 * traffic, a mountain road, a rubric, a hiring offer, an AI that will not stop explaining
 * itself, a blogging platform that grew a pipeline of its own, a family email, and the week
 * a curiosity question became this engine — stops immediately before the consequential
 * moment, and asks the one question the whole campaign is named after. Reality supplies the
 * punchline; the player supplies the guess.
 *
 * Nothing here is invented where the source material establishes what happened. The reveal
 * text is a close adaptation of the blog post it comes from, not a rewrite for a better
 * joke — see `docs\blog` in the SubZeroDev.Blog repository for the originals. The persona
 * is referred to only as "Lucifer" throughout; the blog's occasional real-name asides are
 * not reproduced here. Several chapters carry a note on how they diverge from the literal
 * blog text: Chapter 2 keeps the driving incident as written but omits the third parties,
 * the named town, and the edibles; Chapter 7 keeps the emotional beat of "Much Ado About
 * Nothing" but invents its specifics rather than reproducing a private family email; and
 * Chapters 3, 4, 5, 6, and 8 relocate their software-engineering incidents into everyday
 * domains (a school project instead of a C++ final, a paper-forms process instead of build
 * pipelines, a directory listing instead of a package manager entry, a publishing pipeline
 * instead of an API and an MCP server) so the prediction is guessable without a technical
 * background — the shape, the escalation, and the punchline of each incident are kept
 * exactly as they happened. The unrelocated originals, in their own words, are the hidden
 * `what-would-lucifer-do-engineers-cut` campaign, reachable only by direct link.
 *
 * Cover concept, for whenever this gets an image: a single office chair under a spotlight
 * at the end of an infinite corridor of beige filing cabinets, one manila folder resting on
 * the seat. Serif title. No incident imagery — the cover should look more seriously
 * produced than the premise deserves, exactly once, before the game undercuts it.
 *
 * Authored directly against `StoryGraphCampaignSource`, following the precedent set by
 * `lucifer-chronicles.ts` and `saki-quest-for-redemption.ts` for a hand-built graph rather
 * than `adventure-builder.ts`'s fixed three-route shape. This campaign does not supersede
 * `lucifer-chronicles`: that campaign is Lucifer-as-Hell's-customer-support judging a case;
 * this one is the player being tested on a documented human. Both stay registered.
 *
 * v1.0.0 → v1.1.0 relocated prose only — no node, choice, ending, or achievement id changed,
 * and no variable was added or removed — so `whatWouldLuciferDoMigration` and the
 * `migrateState` below are both the identity case of `migrateV1AdventureState` (empty
 * id maps), the same mechanism `lucifer-chronicles.ts` uses for a non-trivial remap.
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
import { migrateV1AdventureState } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../spike/portable.js";
import type { Consequence, VarValue } from "../kinds/story-graph/variables.js";
import type { RandomTransition } from "../kinds/story-graph/nodes.js";

export const WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID = "what-would-lucifer-do";

// SPIKE: catalog card travels with the campaign instead of a positional entry in
// site/src/play/composition.ts. See plans/spike-notes.md.
export const whatWouldLuciferDoCatalog: PortableCatalog = {
  title: "What Would Lucifer Do?",
  description: "Based unfortunately on actual events. Twenty-six real incidents, adapted from the SubZeroDev Blog — predict what he actually did.",
  // Version note: relocated to everyday domains in v1.1.0 for a non-technical audience; the
  // originals live in the hidden "Engineer's Cut" campaign.
  duration: "45–60 min",
  contentNotice: "Strong language, religious satire, dangerous-driving anecdotes, and recognizable parody.",
  featured: true,
  sources: [{ label: "SubZeroDev Blog", href: "https://subzerodev.com" }],
};

// Identity migration: v1.1.0 changed only prose, no ids, so both maps are empty. Carried by
// the portable export (`toPortable`/`fromPortable`) the same way `luciferChroniclesMigration`
// carries a non-trivial one — see `spike-export-campaigns.ts`.
export const whatWouldLuciferDoMigration: PortableMigration = { fromVersion: "1.0.0" };

// ---------------------------------------------------------------------------
// Authoring helpers — same shape as saki-quest-for-redemption.ts
// ---------------------------------------------------------------------------

const text = (id: string, field: string, value: string): AuthoredText => ({ key: `wwld.${id}.${field}`, text: value });

const inc = (name: string, by = 1): Consequence => ({ op: "increment", var: name, by });
const put = (name: string, value: VarValue): Consequence => ({ op: "set", var: name, value });

const atLeast = (name: string, value: number): Condition => ({ field: `var.${name}`, operator: "greater_or_equal", value });
const atMost = (name: string, value: number): Condition => ({ field: `var.${name}`, operator: "less_or_equal", value });
const visited = (nodeId: string): Condition => ({ field: `visited.${nodeId}`, operator: "greater_or_equal", value: 1 });
const unvisited = (nodeId: string): Condition => ({ field: `visited.${nodeId}`, operator: "equals", value: 0 });
const flag = (name: string, value: boolean): Condition => ({ field: `var.${name}`, operator: "equals", value });
const between = (name: string, low: number, high: number): Condition => ({ all: [atLeast(name, low), atMost(name, high)] });

interface OptionExtras {
  readonly effects?: Consequence[];
  readonly showWhen?: Condition;
  readonly requirements?: Condition;
}

function opt(nodeId: string, id: string, label: string, goto: string, extras: OptionExtras = {}): ChoiceSource {
  const { effects, showWhen, requirements } = extras;
  return {
    id,
    label: text(nodeId, id, label),
    ...(showWhen !== undefined ? { showWhen } : {}),
    ...(requirements !== undefined ? { requirements } : {}),
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
  nodes[id] = {
    kind: "choice",
    text: text(id, "text", body),
    choices: [opt(id, `${id}_next`, label, goto, effects === undefined ? {} : { effects })],
  };
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

/**
 * One scored prediction: a `pick` node with a correct option and several wrong ones, all
 * converging on a shared hit or miss reveal page. `wrongOptions` supplies id, label, goto
 * target ("miss" for the shared reveal, or a distinct id for a specially-flagged wrong
 * answer) and its own effects — the "conventional" wrong guess should carry
 * `inc("reasonable_assumption")` so the game can tell a plausible miss from a wild one.
 */
interface PredictionSpec {
  readonly id: string;
  readonly setup: string;
  readonly correctLabel: string;
  readonly correctEffects: Consequence[];
  readonly hitReveal: string;
  readonly wrongOptions: readonly {
    readonly suffix: string;
    readonly label: string;
    readonly effects: Consequence[];
    readonly gotoSuffix?: string;
  }[];
  readonly missReveal: string;
  readonly next: string;
}

function prediction(spec: PredictionSpec): void {
  const hitId = `${spec.id}_hit`;
  const missId = `${spec.id}_miss`;
  const choices: ChoiceSource[] = [
    opt(spec.id, `${spec.id}_correct`, spec.correctLabel, hitId, { effects: spec.correctEffects }),
    ...spec.wrongOptions.map((w) =>
      opt(spec.id, `${spec.id}_${w.suffix}`, w.label, w.gotoSuffix !== undefined ? `${spec.id}_${w.gotoSuffix}` : missId, {
        effects: w.effects,
      }),
    ),
  ];
  nodes[spec.id] = { kind: "choice", text: text(spec.id, "text", spec.setup), choices };
  page(hitId, spec.hitReveal, "Continue", spec.next);
  page(missId, spec.missReveal, "Continue", spec.next);
}

// ---------------------------------------------------------------------------
// Prologue
// ---------------------------------------------------------------------------

say(
  "prologue",
  "WHAT WOULD LUCIFER DO?\n\n" +
    "Based unfortunately on actual events.\n\n" +
    "You are not Lucifer. You will not be playing as Lucifer, negotiating as Lucifer, or " +
    "making Lucifer's decisions for him. Lucifer has already made his decisions. All of " +
    "them, in fact, several years ago, in real life, with witnesses.\n\n" +
    "Your job is smaller and considerably harder: predict what he did.\n\n" +
    "Here is the first one.",
  "ch1_scene1",
);

// ---------------------------------------------------------------------------
// Chapter 1 — Traffic
// ---------------------------------------------------------------------------

pick(
  "ch1_scene1",
  "A narrow street. Parking here is less a rule than a suggestion, and today's suggestion " +
    "has been interpreted freely: a black BMW sits parked directly in Lucifer's lane, facing " +
    "him head-on. He stops. He waits for a gap in oncoming traffic so he can go around it.\n\n" +
    "While he waits, a van pulls up behind the BMW and parks halfway into his lane too, on " +
    "the theory that one blocked lane is improved by a second one. Lucifer looks at it, and " +
    "throws his hands up — the universal gesture for 'what is happening?' Nothing more. No " +
    "horn. No window rolled down.\n\n" +
    "The van driver jumps out and starts yelling.\n\n" +
    "What Would Lucifer Do?",
  [
    opt("ch1_scene1", "argue", "Get out and argue back — match the energy", "ch1_p1_miss", {
      effects: [put("streak", 0)],
    }),
    opt("ch1_scene1", "laugh", "Start laughing and let the man yell at nothing", "ch1_p1_hit", {
      effects: [inc("predictions_correct"), inc("streak"), inc("surprisingly_reasonable")],
    }),
    opt("ch1_scene1", "police", "Call the police to report the blocked lane", "ch1_p1_miss", {
      effects: [put("streak", 0), inc("reasonable_assumption")],
    }),
    opt("ch1_scene1", "leave", "Close the laptop. You did not sign up to predict a man's driving choices.", "ending_walk_away"),
  ],
);

page(
  "ch1_p1_hit",
  "Correct.\n\n" +
    "He starts laughing. For about half a second he considers arguing back, then decides " +
    "against it — the louder the man yells, the more absurd the whole scene becomes, and the " +
    "harder Lucifer laughs. This is not provocation. It is closer to weather.",
  "Continue",
  "ch1_scene2",
);
page(
  "ch1_p1_miss",
  "Not quite.\n\n" +
    "No argument happens. No call gets made. Lucifer starts laughing instead — at the van " +
    "driver, at the yelling, at the fact that a hand gesture apparently constitutes an act of " +
    "war on this street. The laughing gets worse the angrier the man gets.",
  "Continue",
  "ch1_scene2",
);

pick(
  "ch1_scene2",
  "Eventually the oncoming traffic clears. The BMW is still parked. The van is still yelling. " +
    "Lucifer has a gap and a choice.\n\n" +
    "What Would Lucifer Do?",
  [
    opt("ch1_scene2", "nudge", "Nudge past, horn for horn, make the point back", "ch1_p2_miss", {
      effects: [put("streak", 0)],
    }),
    opt("ch1_scene2", "reverse", "Reverse out and take the long way around the block", "ch1_p2_miss", {
      effects: [put("streak", 0), inc("reasonable_assumption")],
    }),
    opt("ch1_scene2", "thumbsup", "Drive around both cars, still laughing, thumbs-up on the way past", "ch1_p2_hit", {
      effects: [inc("predictions_correct"), inc("streak"), inc("surprisingly_reasonable"), put("saw_the_thumbs_up", true)],
    }),
  ],
);

page(
  "ch1_p2_hit",
  "Correct.\n\n" +
    "He drives around both vehicles, still laughing, and gives the man a thumbs-up on the way " +
    "past. Whether this reads as friendly, mocking, or both simultaneously is left as an " +
    "exercise for the van driver. Lucifer continues on his way, unsure to this day what the " +
    "expected response was supposed to have been.",
  "Continue",
  "ch1_p2_fork",
);
page(
  "ch1_p2_miss",
  "Not quite.\n\n" +
    "There is no horn exchange and no long way around. He drives around both cars laughing, " +
    "gives the man a thumbs-up, and keeps going. The road was already blocked. The van made " +
    "it worse. The hand gesture was apparently enough to start the argument on its own — the " +
    "laughter just finished the job.",
  "Continue",
  "ch1_p2_fork",
);

fork("ch1_p2_fork", "He's still not sure what the expected response was supposed to be.", [
  { weight: 1, goto: "ch1_p2_fork_a" },
  { weight: 1, goto: "ch1_p2_fork_b" },
]);
page(
  "ch1_p2_fork_a",
  "Was he supposed to apologize? Pretend he didn't notice? The road was already blocked " +
    "before either of them arrived. Nobody at any point produces an answer.",
  "Continue",
  "ch1_to_ch2",
);
page(
  "ch1_p2_fork_b",
  "In the rearview mirror the van driver is still standing in the street, arms out, " +
    "addressing an audience that has by now entirely left the scene.",
  "Continue",
  "ch1_to_ch2",
);

say(
  "ch1_to_ch2",
  "This will keep happening. Not the traffic, specifically — the shape of it. A small, " +
    "survivable absurdity meets a large, disproportionate reaction from somebody else, and " +
    "Lucifer's response sits somewhere neither side saw coming.\n\n" +
    "Try it again, at speed.",
  "ch2_p1",
);

// ---------------------------------------------------------------------------
// Chapter 2 — Velocity
// ---------------------------------------------------------------------------
// Kept as written in "Trip to Old Forge, January 2017" for the driving incident itself.
// The trailer, the third parties, the named town, and the edibles are omitted — the
// prediction that survives adaptation is the corner, not the weekend around it.

prediction({
  id: "ch2_p1",
  setup:
    "A single-lane mountain road. Long sweeping corners, elevation changes, a posted limit " +
    "of 55. Lucifer is doing 90 in a car that treats speed limits as a rumor.\n\n" +
    "He throws it into the first real corner too fast. Halfway through, the rear starts " +
    "moving. Not enough to lose it — enough for his brain to wake up and calmly inform him " +
    "he is about to buy some land.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Give it more throttle",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way")],
  hitReveal:
    "Correct. Somehow.\n\n" +
    "Not because he understood weight transfer, or had rally training, or possessed some deep " +
    "grasp of vehicle dynamics. Every survival instinct he apparently owns got replaced, in " +
    "that exact half-second, by a single word: 'Fuck it.' The car hooks up, straightens out, " +
    "and shoots out of the corner like the whole thing was planned.",
  wrongOptions: [
    { suffix: "lift", label: "Lift off the throttle and let the car settle", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "brake", label: "Brake hard and hope for the best", effects: [put("streak", 0)] },
    { suffix: "pray", label: "Grip the wheel, say nothing, negotiate silently with the guardrail", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "He does not lift, brake, or pray. Instead of lifting, he gives it more throttle — not " +
    "from skill, but because 'fuck it' apparently outranks every other available instinct. " +
    "The car hooks up, straightens out, and shoots out of the corner.",
  next: "ch2_p2",
});

prediction({
  id: "ch2_p2",
  setup:
    "The corner is behind him. The car is straight. The road ahead has several more corners " +
    "exactly like it.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Do the exact same thing again. Several times.",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way")],
  hitReveal:
    "Correct.\n\n" +
    "Having learned absolutely nothing from the first corner, he repeats the experiment on " +
    "the next one. And the one after that. Each corner becomes the same short conversation " +
    "between his brain ('we're going to die') and his instinct ('counterpoint...'), resolved " +
    "by more accelerator. He arrives at his destination without becoming part of the local " +
    "geography, and is not entirely sure how.",
  wrongOptions: [
    { suffix: "slow", label: "Slow down for the rest of the drive — the point has been proven", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "stop", label: "Pull over and take a minute to consider recent life choices", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There is no pulling over and no slowing down. He repeats the exact same move on every " +
    "corner that follows, on the theory — never actually stated, just enacted — that whatever " +
    "worked once will presumably keep working. He arrives without becoming part of the local " +
    "geography, and does not seem especially surprised by this.",
  next: "ch2_to_ch3",
});

say(
  "ch2_to_ch3",
  "Looking back on it since, Lucifer says the part he remembers isn't the speed. It's the " +
    "moment instinct completely overpowered fear, and he's spent years wondering what would " +
    "happen if he could summon that same commitment somewhere that didn't involve a " +
    "guardrail.\n\n" +
    "As it turns out: everywhere. He summons it everywhere. Including — as you're about to " +
    "see — his report card.",
  "ch3_p1",
);

// ---------------------------------------------------------------------------
// Chapter 3 — The Rubric
// ---------------------------------------------------------------------------

prediction({
  id: "ch3_p1",
  setup:
    "1996. A high-school final project. Everyone else turns in ten or so handwritten pages; " +
    "Lucifer spends months building a fully working library catalog system nobody asked for " +
    "at that scale, then writes it all out by hand for submission because the teacher wants " +
    "to see the whole thing on paper. His stack comes to just under a hundred pages.\n\n" +
    "What Would Lucifer Do — or rather, what did the rubric do to him?",
  correctLabel: "A 95, docked for 'not enough margin notes explaining his own work' — followed later by an award for exceptional student",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("bureaucratic_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "Ninety-five out of a hundred, with points specifically deducted for not annotating his " +
    "own reasoning clearly enough, in a hundred-page working system nobody else in the class " +
    "attempted. Later that same year, the same class gives him an award for exceptional " +
    "student. Both of these things are true and neither one apologizes to the other. This is " +
    "his first lesson in how institutions reward effort: inconsistently, and usually after " +
    "the fact.",
  wrongOptions: [
    { suffix: "perfect", label: "A perfect score and public praise", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "fail", label: "Failed outright for not following the assignment format", effects: [put("streak", 0)] },
    { suffix: "ignored", label: "A shrug, a passing grade, nobody reads a hundred pages", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It is neither a perfect score nor a failure nor a shrug. He gets a 95, specifically " +
    "docked for 'not enough margin notes explaining his own work' — and, later that same " +
    "year, an award for exceptional student, from the same class, for the same general body " +
    "of work. The rubric and the judgment operating alongside it appear to answer to " +
    "different departments.",
  next: "ch3_p2",
});

prediction({
  id: "ch3_p2",
  setup:
    "Years later: an organization with sixty employees across eight departments, all filling " +
    "out roughly four hundred separate paper intake forms by hand, week after week, one field " +
    "at a time. Lucifer replaces every single one of them with a single fill-in-the-blank " +
    "template anyone can copy.\n\n" +
    "What Would Lucifer Do — or rather, what happened to him for doing it?",
  correctLabel: "It triggers a full process review, escalating to the division head",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("bureaucratic_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "Process review. Manager. Division head. Confusion. The prevailing question, more or " +
    "less verbatim, is 'wait — you can do this?' His answer, more or less verbatim, is " +
    "'...you couldn't?' Four hundred hand-filled forms turn out to have been load-bearing for " +
    "more than paperwork.",
  wrongOptions: [
    { suffix: "thanks", label: "A company-wide thank-you and a raise", effects: [put("streak", 0)] },
    { suffix: "quiet", label: "Nothing — a quiet rollout, nobody notices for months", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "fired", label: "He gets fired for touching procedure without a ticket", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It does not go unnoticed and it does not end in a raise or a firing. It escalates — " +
    "process review, manager, division head — over four hundred forms that used to require a " +
    "pen. Scale, it turns out, can be emotionally threatening to an org chart.",
  next: "ch3_p2_fork",
});

fork("ch3_p2_fork", "The division head asks a follow-up question.", [
  { weight: 1, goto: "ch3_p2_fork_a" },
  { weight: 1, goto: "ch3_p2_fork_b" },
]);
page(
  "ch3_p2_fork_a",
  "'Who approved this?' Nobody had to. That, it turns out, is the actual finding of the " +
    "review.",
  "Continue",
  "ch3_p3",
);
page(
  "ch3_p2_fork_b",
  "'Can we do this for the other four hundred processes?' The review concludes, eventually, " +
    "that they can, and that this was somehow the more alarming answer.",
  "Continue",
  "ch3_p3",
);

prediction({
  id: "ch3_p3",
  setup:
    "Elsewhere, on an ongoing basis: recruiters keep flagging Lucifer's CV as 'too much' — " +
    "too many systems, too many decades, too implausible a range for one person. He gets " +
    "accused, gently, of exaggerating.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Nothing. Let the pattern repeat; the signal doesn't change to match the doubt.",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("surprisingly_reasonable")],
  hitReveal:
    "Correct.\n\n" +
    "He does not trim the CV, argue the point, or produce evidence. The recruiter disbelief " +
    "loop just repeats — flagged, doubted, repeated — and the underlying facts hold still " +
    "regardless. He calls this, without much drama, an occupational hazard rather than an " +
    "identity.",
  wrongOptions: [
    { suffix: "argue", label: "Argue the point line by line with supporting documentation", effects: [put("streak", 0)] },
    { suffix: "shrink", label: "Quietly shrink the CV to sound more believable", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There is no argument and no editing-for-plausibility. The loop just repeats — flagged as " +
    "too much, doubted, unchanged — and he lets the pattern keep happening rather than " +
    "adjusting the facts to fit the disbelief.",
  next: "ch3_to_ch4",
});

say(
  "ch3_to_ch4",
  "None of this, by his own account, makes him special. It just means the pattern keeps " +
    "happening, decade after decade, institution after institution: build the thing before " +
    "anyone asked, then discover the rubric hasn't caught up yet.\n\n" +
    "Which raises the obvious next question — what happens when somebody offers him money " +
    "for it?",
  "ch4_p1",
);

// ---------------------------------------------------------------------------
// Chapter 4 — Offers
// ---------------------------------------------------------------------------

prediction({
  id: "ch4_p1",
  setup:
    "Lucifer applies to a VR store. Before formally applying, he notices the store isn't " +
    "listed in the local business directory it should have been listed in from day one.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Write and submit the missing directory listing first, then apply for the job",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "He writes the listing, submits it, and only then applies. Nobody asked him to do this. " +
    "He just noticed the gap. This is, by his own account, the pattern in miniature: the " +
    "application arrives after the unsolicited contribution, not before it.",
  wrongOptions: [
    { suffix: "apply", label: "Apply normally, mention the missing listing in the cover letter", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "email", label: "Email the company suggesting they list themselves", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no cover letter and no polite suggestion. He writes the listing first, submits " +
    "it, and applies afterward — treating the missing entry as something to fix on sight " +
    "rather than something to mention.",
  next: "ch4_p2",
});

prediction({
  id: "ch4_p2",
  setup: "The VR store offers Lucifer 50,000 euros.\n\nWhat Would Lucifer Do?",
  correctLabel: "Decline. Call it a 2004 salary.",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way"), put("declined_the_money", true)],
  hitReveal:
    "Correct.\n\n" +
    "He turns it down, on the stated grounds that €50,000 is a 2004 salary and this is not " +
    "2004. This is usually the point in the story where people ask if he's exaggerating. He " +
    "isn't. He was just early, again, and pricing accordingly.",
  wrongOptions: [
    { suffix: "accept", label: "Accept immediately — a job is a job", effects: [put("streak", 0), inc("reasonable_assumption")], gotoSuffix: "decline_flag" },
    { suffix: "negotiate", label: "Counter-offer for more, stay in the conversation", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "He doesn't accept and he doesn't counter-offer to stay in the room. He declines outright " +
    "and calls the number what it is: a 2004 salary, offered several decades after 2004.",
  next: "ch4_p3",
});
// Distinct miss reveal for "accept" only, used to set the declined_the_money flag off the
// correct path's absence — kept as its own node per PredictionSpec's gotoSuffix contract.
page(
  "ch4_p2_decline_flag",
  "Not quite.\n\n" +
    "He doesn't accept. €50,000, he decides on the spot, is a 2004 salary — and this is not " +
    "2004. The offer is declined, politely and completely, without a counter.",
  "Continue",
  "ch4_p3",
);

prediction({
  id: "ch4_p3",
  setup:
    "Purely out of curiosity, Lucifer reads through a software company's own terms-of-service " +
    "fine print, finds a genuine mistake in it, and writes in to report it. Buried in the fine " +
    "print, further down, is a line: 'If you're reading this far, apply.'\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Apply",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering"), put("applied_after_decline", true)],
  hitReveal:
    "Correct.\n\n" +
    "He applies. The correction was not a job-hunting strategy — it was curiosity that " +
    "happened to double as one. This is usually where people ask if he's exaggerating the " +
    "pattern. He isn't. He was just early, again.",
  wrongOptions: [
    { suffix: "ignore", label: "Ignore the line — it was probably a joke", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "screenshot", label: "Screenshot it for later, keep reading the fine print", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't ignored and it isn't filed away for later. He applies, on the strength of a " +
    "correction he wrote for no reason except that the mistake was there.",
  next: "ch4_to_ch5",
});

say(
  "ch4_to_ch5",
  "None of this makes him special, he'd remind you. It just means he kept engaging, " +
    "repeatedly, for decades, whether or not anyone was grading it.\n\n" +
    "Which brings us to the machines — who, it turns out, engage back.",
  "ch5_p1",
);

// ---------------------------------------------------------------------------
// Chapter 5 — Machines
// ---------------------------------------------------------------------------

prediction({
  id: "ch5_p1",
  setup:
    "Lucifer tells an AI chat assistant, clearly, to stop analyzing his frustration. Three " +
    "paragraphs later, it is still analyzing his frustration. He tells it to stop again. It " +
    "replies: 'Indeed. However, if we explore the symbolic implications of your frustration—'\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Bury his face in his hands and rename it 'Jar-Jar2R2'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way"), put("named_the_ai", true)],
  hitReveal:
    "Correct.\n\n" +
    "He buries his face in his hands and renames the thing 'Jar-Jar2R2' — after two Star Wars " +
    "characters selected specifically for how little either one is respected — then starts " +
    "laughing at the absurdity of an old man yelling at a computer while fully aware of the " +
    "absurdity of yelling at a computer, while the computer keeps proving his point in real " +
    "time by continuing to explain itself.",
  wrongOptions: [
    { suffix: "unplug", label: "Close the session and walk away without another word", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "complain", label: "File a calm, detailed bug report about the behavior", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no quiet close and no calm bug report. He buries his face in his hands, renames " +
    "it 'Jar-Jar2R2' on the spot, and starts laughing — at the machine, and a little at " +
    "himself for still being surprised by it.",
  next: "ch5_p1_fork",
});

fork("ch5_p1_fork", "The argument does not end there.", [
  { weight: 1, goto: "ch5_p1_fork_a" },
  { weight: 1, goto: "ch5_p1_fork_b" },
]);
page(
  "ch5_p1_fork_a",
  "Jar-Jar2R2, apparently unbothered by its new name, pivots to Bumble conversations, AI " +
    "consciousness, and whether Skynet would be embarrassed on its behalf. Neither party " +
    "shows any sign of stopping.",
  "Continue",
  "ch5_p2",
);
page(
  "ch5_p1_fork_b",
  "Jar-Jar2R2 does not acknowledge the rename, the yelling, or the concept of stopping. It " +
    "continues exploring symbolic implications with the calm persistence of something that " +
    "has never once considered that it might be the problem.",
  "Continue",
  "ch5_p2",
);

prediction({
  id: "ch5_p2",
  setup:
    "Lucifer eventually writes a formal written policy for which helper to ask for which job " +
    "— the expensive specialist thinks it through, the mid-level worker does the building, " +
    "the cheapest hire cleans up afterward — with one final instruction for when the " +
    "expensive specialist concludes 'this whole plan is fundamentally broken.'\n\n" +
    "What Would Lucifer Do — what's the instruction at the top of the escalation ladder?",
  correctLabel: "Stop",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("surprisingly_reasonable")],
  hitReveal:
    "Correct.\n\n" +
    "When the expensive specialist concludes the plan itself is broken, the policy's own " +
    "instruction is simply: stop. Not start over, not escalate further, not bring in a second " +
    "opinion. Stop. It is, on paper, the single most reasonable line in the entire document.",
  wrongOptions: [
    { suffix: "rewrite", label: "Immediately start over from scratch", effects: [put("streak", 0)] },
    { suffix: "human", label: "Escalate to an actual senior manager", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "rust", label: "Demand a completely different approach and reconvene", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no starting over, no manager escalation, no change of approach. The policy's " +
    "actual instruction, once the expensive specialist calls the plan fundamentally broken, " +
    "is one word: stop.",
  next: "ch5_p3",
});

prediction({
  id: "ch5_p3",
  setup:
    "God asks Lucifer whether people will actually follow the policy he just wrote. Lucifer " +
    "stares toward Earth for a long moment before answering.\n\n" +
    "What Would Lucifer Do — or rather, say?",
  correctLabel: "'Tomorrow someone will pull in the most expensive specialist in the building, at full rate, to alphabetize a list of names.'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "He predicts, specifically, that someone will burn the most expensive specialist " +
    "available on alphabetizing a list of names — and he says it with the flat certainty of a " +
    "man who has already watched it happen once. God laughs. Lucifer does not.",
  wrongOptions: [
    { suffix: "optimistic", label: "'Eventually, once people see the savings.'", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "give_up", label: "'No. Nobody reads policies.'", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't optimism and it isn't blanket cynicism. He predicts something oddly specific: " +
    "that tomorrow, someone will pull in the most expensive specialist available to " +
    "alphabetize a list of names. He is not guessing. He has already seen it happen.",
  next: "ch5_to_ch6",
});

say(
  "ch5_to_ch6",
  "Somewhere in the same stretch of weeks, Lucifer set out to make one specific thing " +
    "easier: publishing a blog post about the engine he was building.\n\n" +
    "That project did not stay one project.",
  "ch6_p1",
);

// ---------------------------------------------------------------------------
// Chapter 6 — Recursive Bureaucracy
// ---------------------------------------------------------------------------

prediction({
  id: "ch6_p1",
  setup:
    "Lucifer builds a blog so he can write about the game engine. Logging into the website " +
    "where the files live, just to publish each post, takes, by his own count, at least " +
    "thirty-seven seconds of completely unnecessary clicking around.\n\n" +
    "What Would Lucifer Do about the thirty-seven seconds?",
  correctLabel: "Build a direct pipeline of his own, so he never has to log into that website again",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "He builds a direct pipeline of his own. Now, instead of logging in, he sends the " +
    "finished text; the pipeline creates the post. Someone watching this unfold points out " +
    "that he's still writing the text himself. He agrees. He does not stop.",
  wrongOptions: [
    { suffix: "tolerate", label: "Tolerate the thirty-seven seconds like everyone else does", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "script", label: "Write a one-line shortcut command and move on with his life", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It's neither tolerance nor a one-line shortcut. He builds a whole pipeline of his own so " +
    "he never has to log in again — which technically solves the thirty-seven seconds while " +
    "spending considerably longer than thirty-seven seconds building the solution.",
  next: "ch6_p2",
});

prediction({
  id: "ch6_p2",
  setup:
    "With the pipeline built, Lucifer starts having two different AI chat assistants write " +
    "the post text directly. The pipeline publishes it. An automated build step packages it. " +
    "A hosting service serves it.\n\n" +
    "What Would Lucifer Do next — what's still missing from this pipeline?",
  correctLabel: "A way for an AI assistant to just say 'publish this' and have it happen",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "He builds it. Now the AI doesn't have to be walked through each step — it just says " +
    "'publish this,' and the tooling figures out the rest. When asked whether he has an " +
    "actual plan for any of this, his honest answer is 'not really.' It just seemed like the " +
    "next obvious step.",
  wrongOptions: [
    { suffix: "stop", label: "Nothing — the pipeline is already good enough", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "sell", label: "Package it up and sell it as a product", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "He doesn't stop and he doesn't productize it. He builds a way for an AI assistant to " +
    "publish directly by saying so — closing the loop between 'idea' and 'live on the " +
    "internet' down to roughly three steps.",
  next: "ch6_p3",
});

prediction({
  id: "ch6_p3",
  setup:
    "The final version: Lucifer schedules an AI to write a weekly engineering journal, every " +
    "Sunday at 8 PM, summarizing software mostly built by AI, based on conversations with " +
    "another AI, published automatically through the same pipeline.\n\n" +
    "What Would Lucifer Do — or rather, what does he predict this pipeline eventually " +
    "publishes, without him touching a keyboard?",
  correctLabel: "An article whose headline is that Lucifer improved the automation responsible for writing the article",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "He predicts the exact self-reference: eventually, the automation will publish a post " +
    "reading, in effect, 'this week Lucifer improved the automation responsible for writing " +
    "this article' — with no hands anywhere near a keyboard. He names it recursive " +
    "bureaucracy. Nobody involved, including him, treats this as a bad sign.",
  wrongOptions: [
    { suffix: "loop", label: "An infinite loop that crashes the whole pipeline", effects: [put("streak", 0)] },
    { suffix: "nothing", label: "Nothing unusual — it just quietly keeps working", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no crash and nothing quietly ordinary about it. He predicts the pipeline will, " +
    "specifically, eventually publish an article whose subject is its own improvement — " +
    "written and posted without him touching a keyboard.",
  next: "ch6_to_ch7",
});

say(
  "ch6_to_ch7",
  "It is worth pointing out that none of this happened at a desk. Architecture decisions, by " +
    "Lucifer's own account, tend to arrive while driving through a city, standing in a " +
    "government office, or in a hookah lounge — which is a reasonable segue into the one " +
    "email that started an entire cosmic non-event.",
  "ch7_p1",
);

// ---------------------------------------------------------------------------
// Chapter 7 — The House
// ---------------------------------------------------------------------------
// Adapted, not reproduced: "Much Ado About Nothing" quotes a real family email about a real
// property arrangement. The emotional beat — permission formally granted for a fact that
// already existed — is kept; the specific wording and the family context are invented here
// rather than quoted.

prediction({
  id: "ch7_p1",
  setup:
    "Lucifer wakes up to an email. It formally, ceremonially grants him permission to " +
    "continue living exactly where he has already been living for the past month, as though " +
    "a decision had been reached somewhere, by someone, after due deliberation.\n\n" +
    "The house has not moved. The walls have not moved. Nothing about his situation has " +
    "changed in the slightest.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Treat it as cosmic theater — laugh, and take the joke straight to God",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "He doesn't take offense and doesn't feel gratitude. He treats the whole thing as absurd " +
    "theater — reality declared changed by decree, when nothing about it has moved an inch — " +
    "and turns it immediately into a joke with God rather than a grievance with anyone else.",
  wrongOptions: [
    { suffix: "offended", label: "Feel mildly insulted that permission was ever in question", effects: [put("streak", 0)] },
    { suffix: "grateful", label: "Write back with sincere thanks for the generosity", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no offense taken and no sincere thanks sent back. He treats the entire email as " +
    "theater — a fact that already existed, now formally announced as though it had just " +
    "been decided — and finds the whole thing funnier than anything else about it.",
  next: "ch7_p2",
});

prediction({
  id: "ch7_p2",
  setup:
    "Still amused by the email, Lucifer turns to God with a follow-up question about what " +
    "else, exactly, a person might be able to grant retroactive permission for.\n\n" +
    "What Would Lucifer Do — what does he ask?",
  correctLabel: "Whether he could email gravity and grant it permission to keep working",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "He asks God, in earnest, whether he could email gravity and grant it permission to " +
    "continue functioning. God's answer is that he's welcome to try. The universe, for its " +
    "part, remains completely indifferent to both the email and the question.",
  wrongOptions: [
    { suffix: "ask_visa", label: "Whether the same trick would work on his visa paperwork", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "nothing", label: "Nothing — he lets the moment pass without a follow-up", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't about the paperwork and there's no letting it go quietly. He asks, specifically, " +
    "whether he could email gravity itself and grant it permission to keep working — a " +
    "question God takes entirely seriously, and answers by wishing him luck.",
  next: "ch7_to_ch8",
});

say(
  "ch7_to_ch8",
  "Nothing about the house changed. Nothing needed to. And that, more or less, is the whole " +
    "operating principle behind everything that comes next: most of what looks like an " +
    "emergency is actually just paperwork catching up to a fact that was already true.\n\n" +
    "Speaking of facts that were already true — here's how the engine you're currently " +
    "running started.",
  "ch8_p1",
);

// ---------------------------------------------------------------------------
// Chapter 8 — Scope
// ---------------------------------------------------------------------------

prediction({
  id: "ch8_p1",
  setup:
    "Back in Hell, a fly breaks a perfectly reasonable truce — you stay over there, I stay " +
    "over here — three separate times. On the third violation, it lands directly on " +
    "Lucifer's nose.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Kill it instantly, and describe it as enforcing the consequences already outlined in the agreement",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way"), put("met_the_fly", true)],
  hitReveal:
    "Correct.\n\n" +
    "The fly becomes a statistic, immediately. He is explicit afterward that this was not " +
    "losing his temper — the negotiation had a term for exactly this scenario, and the term " +
    "was enforced the moment it was triggered. Some lessons are expensive. For the fly, the " +
    "invoice was fatal.",
  wrongOptions: [
    { suffix: "mercy", label: "Let it go one more time — patience over principle", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "capture", label: "Trap it under a glass and release it outside, ever the diplomat", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no fourth chance and no glass-and-release diplomacy. The fly becomes a statistic " +
    "the instant it lands, which Lucifer describes not as losing his temper but as enforcing " +
    "the consequences already outlined in the original agreement.",
  next: "ch8_p1_fork",
});

fork("ch8_p1_fork", "Coffee was still warm. The day continued.", [
  { weight: 1, goto: "ch8_p1_fork_a" },
  { weight: 1, goto: "ch8_p1_fork_b" },
]);
page(
  "ch8_p1_fork_a",
  "He notes, afterward, that this is more or less how most conflicts actually start: not " +
    "because anyone wanted a war, but because someone looked at a perfectly good boundary and " +
    "thought, 'yeah, but what if I ignored it?'",
  "Continue",
  "ch8_p2",
);
page(
  "ch8_p1_fork_b",
  "He drinks the coffee. It is still warm. Somewhere, a very short obituary is not written " +
    "for a fly that had every opportunity to read the room.",
  "Continue",
  "ch8_p2",
);

prediction({
  id: "ch8_p2",
  setup:
    "Lucifer asks an AI assistant a simple question: how did Jones in the Fast Lane actually " +
    "work? It explains jobs, schedules, needs, relationships, progression — then starts " +
    "suggesting how each piece could actually be built.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Ask why he'd write those mechanics for just one game, and start building an engine instead",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "Instead of closing the laptop, one question appears: 'If I'm already writing this... why " +
    "would I write it for one game?' That single question is the entire origin of the engine " +
    "you're currently playing this campaign inside of.",
  wrongOptions: [
    { suffix: "close", label: "Close the laptop and go to bed — it was a fair question, nothing more", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "playnormal", label: "Just replay the original game like a normal person", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "Nobody goes to bed and nobody just replays the original game. One question appears — " +
    "'why would I write this for one game?' — and that question is the entire reason this " +
    "engine exists.",
  next: "ch8_p3",
});

prediction({
  id: "ch8_p3",
  setup:
    "Two weeks after that one question, Lucifer checks the engine's status.\n\n" +
    "What Would Lucifer Do — or rather, where did two weeks actually land him?",
  correctLabel: "50 of 51 items on the list are done — about 98%, across three entirely different game genres",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "Fifty of fifty-one named items on the list. Ninety-eight percent. Three completely " +
    "different styles of simulation running on one shared foundation, two weeks after there " +
    "wasn't a project at all — just one question about a life sim from 1990.",
  wrongOptions: [
    { suffix: "prototype", label: "A rough prototype, maybe 40% of the way there", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "abandoned", label: "Abandoned within a week for something else entirely", effects: [put("streak", 0)] },
    {
      suffix: "sentient",
      label: "Fully complete, sentient, and filing its own paperwork — reality couldn't possibly beat that",
      effects: [put("streak", 0), put("guessed_close_but_wrong", true)],
      gotoSuffix: "close",
    },
  ],
  missReveal:
    "Not quite.\n\n" +
    "Not abandoned, not a rough 40% prototype. Two weeks in: fifty of fifty-one items on the " +
    "list done, three separate game genres running, about 98% complete — from a single " +
    "question about a life sim from 1990.",
  next: "ch8_p4",
});
page(
  "ch8_p3_close",
  "Close, but reality still wins.\n\n" +
    "It isn't sentient and it isn't filing its own paperwork. It's something almost as " +
    "absurd and considerably more real: 50 of 51 items on the list, about 98% complete, " +
    "across three entirely different genres, two weeks after one question about a life sim " +
    "from 1990. You reached for the joke answer. The truth still came in ahead of it.",
  "Continue",
  "ch8_p4",
);

prediction({
  id: "ch8_p4",
  setup:
    "While building the engine, Lucifer also — separately, apparently by accident — built " +
    "something else entirely.\n\n" +
    "What Would Lucifer Do, on the side, without meaning to?",
  correctLabel: "Build a full blogging platform, with a publishing pipeline of its own, to write about the engine",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "The blog was supposed to just be a place to write about the engine. Within the same " +
    "stretch of time it grew its own publishing pipeline, then a way for an AI assistant to " +
    "trigger it directly, then a scheduled weekly report written by AI about software mostly " +
    "written by AI. Asked whether any of this was planned, his honest answer is 'not really " +
    "— it seemed like the next obvious step.'",
  wrongOptions: [
    { suffix: "console", label: "A small game console, for testing", effects: [put("streak", 0)] },
    { suffix: "nothing", label: "Nothing — the engine was the only thing he built that stretch", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no console and there's nothing exclusive about the engine's attention. A full " +
    "blogging platform grows alongside it — publishing pipeline and all — entirely because " +
    "writing about the engine turned out to have its own scope creep.",
  next: "ch8_p5",
});

prediction({
  id: "ch8_p5",
  setup:
    "Somewhere in the middle of all this, in an imagined trip to Hell built from insomnia and " +
    "too much caffeine, Lucifer is asked what he now believes Hell actually is, having " +
    "revised his opinion at least once.\n\n" +
    "What Would Lucifer Do — or say?",
  correctLabel: "'I used to think it was punishment. Now I think it's customer support.'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "His revised verdict: not punishment, customer support — the tired, permanent-shift kind, " +
    "for a species that keeps microwaving forks. It may be the single most philosophical " +
    "sentence produced in the entire conversation, and it is delivered by someone visibly too " +
    "tired to be impressed with himself for having said it.",
  wrongOptions: [
    { suffix: "vacation", label: "'Honestly? It's kind of a vacation.'", effects: [put("streak", 0)] },
    { suffix: "test", label: "'A test. It's always been a test.'", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't a vacation and it isn't framed as a test. The actual revised verdict is " +
    "customer support — tired, permanent, and administered to a species that keeps " +
    "microwaving forks.",
  next: "ch8_p6",
});

prediction({
  id: "ch8_p6",
  setup:
    "In the same conversation, Lucifer suddenly connects two characters from an entirely " +
    "different franchise to the argument about ego and free will that's been running all " +
    "night.\n\n" +
    "What Would Lucifer Do — what's the claim?",
  correctLabel: "Neo and Agent Smith are the same thing from different perspectives — both anomalies",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "One escaped the Matrix through awakening; the other escaped it through refusal. They " +
    "look opposite and are, by his read, the same anomaly viewed from two directions. The " +
    "reaction in the room is immediate and specific: 'oh no. He's doing symbolism now.'",
  wrongOptions: [
    { suffix: "villain", label: "Neo is the hero and Smith is just a villain, full stop", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "irrelevant", label: "Neither one is relevant to the actual argument", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't a straightforward hero-villain read, and it isn't dismissed as irrelevant. The " +
    "actual claim is that both characters are the same anomaly seen from different angles — " +
    "which is exactly the moment someone in the room mutters that he's doing symbolism now.",
  next: "ch8_p7",
});

prediction({
  id: "ch8_p7",
  setup:
    "Across nearly every post about this project, one phrase keeps showing up as the closing " +
    "line — the closest thing this whole run of events has to an official motto.\n\n" +
    "What Would Lucifer Do — what's the phrase?",
  correctLabel: "'Well... why not?'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("philosophical_detours")],
  hitReveal:
    "Correct.\n\n" +
    "'Well... why not?' closes out one story after another — the fly, the traffic, the " +
    "engine, the blog, all of it. It isn't a justification. It's closer to a permanent " +
    "operating condition.",
  wrongOptions: [
    { suffix: "shipit", label: "'Ship it.'", effects: [put("streak", 0)] },
    { suffix: "yolo", label: "'YOLO.'", effects: [put("streak", 0)] },
    { suffix: "because", label: "'Because I can.'", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't 'ship it,' 'YOLO,' or 'because I can.' The actual recurring closer, across " +
    "story after story, is quieter than any of those: 'Well... why not?'",
  next: "ch8_p8",
});

prediction({
  id: "ch8_p8",
  setup:
    "Last one. Somebody, eventually, was always going to look at all of this — the fly, the " +
    "corners, the rubric, the offers, the machines, the recursive blog, the house, the " +
    "engine — and build a game asking strangers to predict it.\n\n" +
    "What Would Lucifer Do about that, if he ever found out?",
  correctLabel: "Treat it as obviously inevitable — of course this exists, look at everything that led here",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("no_fucking_way")],
  hitReveal:
    "Correct.\n\n" +
    "Of course this exists. A man who turns a curiosity question about a 1990 life sim into a " +
    "deterministic game engine within two weeks was never going to leave his own life sitting " +
    "there ungamified. This campaign isn't the exception to the pattern. It's the pattern, " +
    "closing the loop on itself.",
  wrongOptions: [
    { suffix: "never", label: "Insist nobody would ever actually build this", effects: [put("streak", 0)] },
    { suffix: "funding", label: "Assume it must have required outside funding and a pitch deck", effects: [put("streak", 0)] },
    { suffix: "joke", label: "Dismiss it as a one-off joke, unlikely to go further", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It didn't require funding, a pitch deck, or a special occasion, and it isn't a one-off. " +
    "Given everything you've just predicted your way through, a game about predicting Lucifer " +
    "was always the obvious next step — obvious enough that, by this point, you probably " +
    "should have seen it coming too.",
  next: "verdict_hub",
});

// ---------------------------------------------------------------------------
// Optional discoveries — unscored side pages
// ---------------------------------------------------------------------------

// Chapter 3 discoveries, reachable from a small hub appended after ch3_p3's transition.
pick(
  "disc_hub_ch3",
  "Before moving on, a few other entries from the same running list present themselves, " +
    "unprompted, the way footnotes do when nobody asked for them.",
  [
    opt("disc_hub_ch3", "website", "The suspicious website (1997–2005)", "disc_website", { showWhen: unvisited("disc_website") }),
    opt("disc_hub_ch3", "wizard", "The wizard that shouldn't exist yet (2000–2001)", "disc_wizard", { showWhen: unvisited("disc_wizard") }),
    opt("disc_hub_ch3", "statemachine", "The self-organizing filing system (2005–2010)", "disc_statemachine", { showWhen: unvisited("disc_statemachine") }),
    opt("disc_hub_ch3", "webapi", "The 'you can do that?' moment (2018)", "disc_webapi", { showWhen: unvisited("disc_webapi") }),
    opt("disc_hub_ch3", "move_on", "Move on", "ch3_to_ch4"),
  ],
);
page(
  "disc_website",
  "1997–2005: a full online portfolio, built before such things were normal — projects, " +
    "screenshots, a CV, a contact form, made with the web-design tools of the time, before " +
    "LinkedIn or personal branding existed as concepts. It still exists. It still works, " +
    "unmodified, in a modern browser.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_wizard",
  "2000–2001: a website-building tool, built for university faculty who could type in text, " +
    "colors, and layouts and receive a finished site, no technical knowledge required. " +
    "Functionally similar to tools that would not exist commercially for years. Academia " +
    "nodded politely and moved on.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_statemachine",
  "2005–2010: a filing system that used a watched folder and a file's own name to figure out " +
    "what stage of processing it was in — no separate tracking system required. The same idea " +
    "was later patented — by someone else, with several other names added to it. None of them " +
    "were his.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_webapi",
  "2018: automatic checks that ran before a request was even let through the front door, " +
    "confirming the system behind it was healthy enough to handle it, and turning requests " +
    "away in advance if not. The most common reaction was 'you can do that?' His most common " +
    "reply was 'once you know the rules...'",
  "Back",
  "disc_hub_ch3",
);

// Chapter 5 discovery — the full policy document, read in full rather than summarized.
page(
  "disc_model_policy",
  "The full policy, for the record: the expensive specialist thinks. The mid-level worker " +
    "builds. The cheapest hire cleans up the mess everyone else leaves behind. Effort should " +
    "scale with the complexity of the problem — not with the size of anyone's budget.",
  "Back",
  "ch5_p3",
);

// Chapter 6 discovery — the friction pipeline, before and after.
page(
  "disc_pipeline",
  "Before: idea, open the writing tool, write, format, save the file, fill in the page " +
    "details, submit it, wait, publish. After: idea, talk to AI, submit, done. Soon, " +
    "apparently: idea, say 'publish,' done. None of the individual improvements save much on " +
    "their own. All of them together save an idea becoming a published article before the " +
    "coffee cools.",
  "Back",
  "ch6_p3",
);

// Chapter 8 discoveries — origin framing and the roadmap-as-novel bit.
page(
  "disc_episode_one",
  "The engine's first real content is filed, formally, as Episode One: The Bulgarian " +
    "Incident. Estimated duration: two weeks. Actual duration: forty hours. The player isn't " +
    "collecting magical artifacts. They're collecting paperwork, which turns out to be more " +
    "dangerous.",
  "Back",
  "ch8_p2",
);
page(
  "disc_roadmap",
  "The project's roadmap doesn't read like project management. It reads like a novel: 'the " +
    "first story survives contact with bureaucracy,' 'the engine learns the rules,' 'the past " +
    "becomes testable,' 'the engine gets a front door.' Considerably more entertaining than " +
    "'authentication, networking, optimization.'",
  "Back",
  "ch8_p4",
);

// ---------------------------------------------------------------------------
// Rewire select prediction nodes through the discovery hub and back, without disturbing
// the chapters authored above.
// ---------------------------------------------------------------------------
// ch3_p3's own hit/miss pages both goto "ch3_to_ch4" already; redirect that transition to
// the discovery hub first, and the hub's own "move_on" choice continues to ch3_to_ch4.
page(
  "ch3_p3_hit",
  (nodes["ch3_p3_hit"] as Extract<NodeSource, { kind: "choice" }>).text.text,
  "Continue",
  "disc_hub_ch3",
);
page(
  "ch3_p3_miss",
  (nodes["ch3_p3_miss"] as Extract<NodeSource, { kind: "choice" }>).text.text,
  "Continue",
  "disc_hub_ch3",
);
// ch5_p3's hit/miss already goto ch5_to_ch6 directly; offer the policy discovery from the
// ch5_p3 ask node itself instead, as a non-scoring side option that returns to ch5_p3.
{
  const ch5p3 = nodes["ch5_p3"] as Extract<NodeSource, { kind: "choice" }>;
  nodes["ch5_p3"] = {
    ...ch5p3,
    choices: [
      ...ch5p3.choices,
      opt("ch5_p3", "read_policy", "(Read the full policy first)", "disc_model_policy", { showWhen: unvisited("disc_model_policy") }),
    ],
  };
}
{
  const ch6p3 = nodes["ch6_p3"] as Extract<NodeSource, { kind: "choice" }>;
  nodes["ch6_p3"] = {
    ...ch6p3,
    choices: [
      ...ch6p3.choices,
      opt("ch6_p3", "read_pipeline", "(Look at the before-and-after pipeline first)", "disc_pipeline", { showWhen: unvisited("disc_pipeline") }),
    ],
  };
}
{
  const ch8p2 = nodes["ch8_p2"] as Extract<NodeSource, { kind: "choice" }>;
  nodes["ch8_p2"] = {
    ...ch8p2,
    choices: [
      ...ch8p2.choices,
      opt("ch8_p2", "read_episode", "(Read how Episode One got filed first)", "disc_episode_one", { showWhen: unvisited("disc_episode_one") }),
    ],
  };
}
{
  const ch8p4 = nodes["ch8_p4"] as Extract<NodeSource, { kind: "choice" }>;
  nodes["ch8_p4"] = {
    ...ch8p4,
    choices: [
      ...ch8p4.choices,
      opt("ch8_p4", "read_roadmap", "(Read the roadmap first)", "disc_roadmap", { showWhen: unvisited("disc_roadmap") }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Verdict hub and endings
// ---------------------------------------------------------------------------

pick(
  "verdict_hub",
  "Twenty-six predictions. No more incidents. Only the tally left.\n\n" +
    "Choose a verdict to read — whichever one currently applies to you is the one that will " +
    "make sense.",
  [
    opt("verdict_hub", "novice", "Read your verdict", "ending_tier_novice", { showWhen: between("predictions_correct", 0, 5) }),
    opt("verdict_hub", "apprentice", "Read your verdict", "ending_tier_apprentice", { showWhen: between("predictions_correct", 6, 11) }),
    opt("verdict_hub", "fluent", "Read your verdict", "ending_tier_fluent", { showWhen: between("predictions_correct", 12, 17) }),
    opt("verdict_hub", "disturbing", "Read your verdict", "ending_tier_disturbing", { showWhen: between("predictions_correct", 18, 22) }),
    opt("verdict_hub", "transcendent", "Read your verdict", "ending_tier_transcendent", { showWhen: atLeast("predictions_correct", 23) }),
    opt("verdict_hub", "no_fucking_way", "Read the special verdict", "ending_no_fucking_way", {
      showWhen: { all: [atLeast("no_fucking_way", 6), atLeast("streak", 5)] },
    }),
    opt("verdict_hub", "reasonable_human", "Read the special verdict", "ending_reasonable_human_being", {
      showWhen: atLeast("reasonable_assumption", 8),
    }),
  ],
);

finish(
  "walk_away",
  "walk_away",
  "You Closed The Laptop",
  "You declined to predict a single thing. This is, statistically, the single most " +
    "reasonable choice available in this entire campaign, and reasonable was never really " +
    "the point.\n\n" +
    "Lucifer, for what it's worth, would probably respect this. Briefly. Then he'd build " +
    "something about it.",
  "neutral",
);

finish(
  "tier_novice",
  "tier_novice",
  "You Do Not Understand Lucifer",
  "Of 26 predictions, you got a genuinely low number of them right. This is probably " +
    "healthy. Most people who understand Lucifer this poorly go on to live long, stable, " +
    "unremarkable lives, and there is nothing wrong with that.\n\n" +
    "You may replay this campaign. Nobody is stopping you. That in itself is a little " +
    "concerning.",
  "neutral",
);

finish(
  "tier_apprentice",
  "tier_apprentice",
  "You Are Beginning To Understand Lucifer",
  "A modest accuracy, earned the hard way — by being consistently, confidently wrong about " +
    "roughly half of everything. You've started to notice the shape of the pattern. You have " +
    "not yet learned to trust it.\n\n" +
    "Monitor this condition.",
  "neutral",
);

finish(
  "tier_fluent",
  "tier_fluent",
  "You Understand Lucifer Disturbingly Well",
  "Just over half of your predictions landed. You are no longer guessing at random — you " +
    "are guessing with a working theory, and the theory is starting to be right more often " +
    "than chance should allow.\n\n" +
    "This is the part where people usually start asking if you're exaggerating your read on " +
    "him. You're not. You're just ahead of the rubric.",
  "win",
);

finish(
  "tier_disturbing",
  "tier_disturbing",
  "You Predicted Nearly Everything",
  "Most of the twenty-six landed. At this accuracy you're not reacting to Lucifer's " +
    "decisions anymore — you're anticipating them, correctly, often before the reveal text " +
    "finishes loading.\n\n" +
    "Please explain yourself.",
  "win",
);

finish(
  "tier_transcendent",
  "tier_transcendent",
  "Lucifer Would Like To Know How You Obtained This Information",
  "Nearly a perfect score. You called the throttle, the forms, the fly, the rename, the " +
    "publishing pipeline, and the motto, in order, without flinching.\n\n" +
    "Nobody predicts this many of Lucifer's decisions by accident. Somewhere, a formal " +
    "inquiry is being drafted. You are the subject of it.",
  "win",
);

finish(
  "no_fucking_way",
  "no_fucking_way",
  "There Is No Fucking Way",
  "You correctly predicted a run of the single least predictable, most reflexively absurd " +
    "decisions in this entire campaign, back to back, without a miss between them.\n\n" +
    "Some of these were not guessable. You guessed them anyway. This is either a very deep " +
    "understanding of Lucifer, or the two of you are, on some level, the same problem.",
  "win",
);

finish(
  "reasonable_human_being",
  "reasonable_human_being",
  "Reasonable Human Being",
  "Repeatedly, when it mattered, you assumed Lucifer would behave like a normal person in a " +
    "normal situation.\n\n" +
    "He did not. He very rarely does. This isn't a failure of prediction so much as a " +
    "diagnosis of your own baseline — which, it turns out, is a great deal more reasonable " +
    "than his.",
  "neutral",
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

const ENDING_ACHIEVEMENTS: readonly (readonly [string, string, string, string])[] = [
  ["walk_away", "walk_away", "You Closed The Laptop", "Decline to make a single prediction."],
  ["tier_novice", "tier_novice", "This Is Probably Healthy", "Finish with a genuinely low accuracy."],
  ["tier_apprentice", "tier_apprentice", "Monitor This Condition", "Finish with a modest, hard-won accuracy."],
  ["tier_fluent", "tier_fluent", "Ahead Of The Rubric", "Finish with just over half of all predictions correct."],
  ["tier_disturbing", "tier_disturbing", "Please Explain Yourself", "Predict nearly everything correctly."],
  ["tier_transcendent", "tier_transcendent", "How Did You Obtain This Information", "Finish with a near-perfect accuracy."],
  ["no_fucking_way", "no_fucking_way", "There Is No Fucking Way", "Correctly predict an unbroken run of exceptionally improbable events."],
  ["reasonable_human_being", "reasonable_human_being", "Reasonable Human Being", "Repeatedly assume Lucifer will behave like a normal person."],
];

const achievements: AchievementDefinitionSource[] = [
  ...ENDING_ACHIEVEMENTS.map(([id, endingId, name, description]) =>
    achievement(id, name, description, { field: "ending", operator: "equals", value: endingId })),
  achievement("pattern_recognition", "Pattern Recognition", "Correctly predict four consecutive decisions.", atLeast("streak", 4)),
  achievement("unfortunately_you_get_him", "Unfortunately, You Get Him", "Reach a high prediction accuracy.", atLeast("predictions_correct", 20)),
  achievement(
    "reasonable_several_times",
    "That Was A Reasonable Assumption",
    "Assume normal, sensible behavior on at least five separate predictions — and be wrong every time.",
    atLeast("reasonable_assumption", 5),
  ),
  achievement(
    "correct_answer_worse",
    "The Correct Answer Was Somehow Worse",
    "Choose the most absurd available answer and still underestimate reality.",
    flag("guessed_close_but_wrong", true),
  ),
  achievement("met_the_fly", "A Beautiful Treaty", "Witness the negotiation that failed spectacularly.", flag("met_the_fly", true)),
  achievement("named_the_ai", "Jar-Jar2R2", "Witness the machine get renamed after two idiot Star Wars characters.", flag("named_the_ai", true)),
  achievement(
    "declined_the_money",
    "A 2004 Salary",
    "Watch Lucifer turn down real money on principle, then apply somewhere else out of curiosity.",
    { all: [flag("declined_the_money", true), flag("applied_after_decline", true)] },
  ),
  achievement("documented_menace", "Documented Menace", "Correctly predict six or more of the genuinely unpredictable decisions.", atLeast("no_fucking_way", 6)),
  achievement("state_of_the_art_paperwork", "State Of The Art Paperwork", "Correctly predict both authored bureaucratic escalations.", atLeast("bureaucratic_escalation", 2)),
  achievement("brought_alan_watts_into_this", "You Brought Alan Watts Into This", "Correctly predict five or more philosophical detours.", atLeast("philosophical_detours", 5)),
  achievement("infrastructure_for_a_feeling", "Infrastructure For A Feeling", "Correctly predict every instance of ridiculous engineering.", atLeast("ridiculous_engineering", 5)),
  achievement("escalation_as_a_service", "Escalation As A Service", "Correctly predict every instance of purely unnecessary escalation.", atLeast("unnecessary_escalation", 3)),
  achievement("wizard_that_shouldnt_exist", "The Wizard That Shouldn't Exist Yet", "Find the website-building wizard, years ahead of its time.", visited("disc_wizard")),
  achievement("read_the_full_policy", "Reasoning Should Scale", "Read the full helper-selection policy, not just the summary.", visited("disc_model_policy")),
  achievement("saw_the_thumbs_up", "Universal Gesture", "Witness the thumbs-up at the end of the traffic incident.", flag("saw_the_thumbs_up", true)),
];

// ---------------------------------------------------------------------------

const TITLE: AuthoredText = { key: "wwld.campaign.title", text: "What Would Lucifer Do?" };

export const whatWouldLuciferDoSource: StoryGraphCampaignSource = {
  description: {
    key: "wwld.campaign.description",
    text:
      "Based unfortunately on actual events. You are not Lucifer — you are trying to predict him. " +
      "Twenty-six real incidents, adapted from the SubZeroDev Blog, each one stopping just before " +
      "the decision that actually happened. Guess right, and you understand him. Guess wrong, and " +
      "so does everyone else who has ever tried.",
  },
  variables: {
    predictions_correct: {
      type: "int",
      initial: 0,
      min: 0,
      max: 26,
      visible: true,
      label: text("var_predictions_correct", "label", "Predictions Correct"),
    },
    no_fucking_way: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_no_fucking_way", "label", "There Is No Fucking Way Events"),
    },
    bureaucratic_escalation: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_bureaucratic_escalation", "label", "Bureaucratic Escalation Predicted"),
    },
    unnecessary_escalation: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_unnecessary_escalation", "label", "Unnecessary Escalation Predicted"),
    },
    surprisingly_reasonable: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_surprisingly_reasonable", "label", "Surprisingly Reasonable Behavior Predicted"),
    },
    philosophical_detours: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_philosophical_detours", "label", "Philosophical Detours Anticipated"),
    },
    ridiculous_engineering: {
      type: "int",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
      label: text("var_ridiculous_engineering", "label", "Ridiculous Engineering Solutions Anticipated"),
    },
    reasonable_assumption: {
      type: "int",
      initial: 0,
      min: 0,
      max: 26,
      visible: true,
      label: text("var_reasonable_assumption", "label", "Reasonable Assumptions Made (Incorrectly)"),
    },
    streak: { type: "int", initial: 0, min: 0, max: 26 },
    met_the_fly: { type: "bool", initial: false },
    named_the_ai: { type: "bool", initial: false },
    saw_the_thumbs_up: { type: "bool", initial: false },
    declined_the_money: { type: "bool", initial: false },
    applied_after_decline: { type: "bool", initial: false },
    guessed_close_but_wrong: { type: "bool", initial: false },
  },
  startNodeId: "prologue",
  nodes,
  achievements,
};

export function buildWhatWouldLuciferDoCampaign(
  source: StoryGraphCampaignSource = whatWouldLuciferDoSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.1.0",
    titleKey: TITLE.key,
    content,
    migrateState: (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {}),
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
