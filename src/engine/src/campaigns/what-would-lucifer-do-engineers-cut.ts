/**
 * What Would Lucifer Do? — Engineer's Cut.
 *
 * A private, hidden companion to `what-would-lucifer-do.ts`. The public campaign relocates
 * its software-engineering incidents into everyday domains so the prediction is guessable
 * without a technical background. This campaign is the sixteen relocated predictions — the
 * thirteen unambiguously technical ones plus three software-career-adjacent ones — told in
 * their original words: the real rubric, the real four hundred pipelines, the real WinGet
 * package, the real AI Model Selection Policy, the real API and MCP server.
 *
 * Registered in `site/src/play/composition.ts` so it is playable through the shared `/play/`
 * page, but marked `hidden` there — the browser demo's catalog is the publication decision,
 * and this campaign is deliberately omitted from the public dossier grid. It is reachable
 * only by a direct `?campaign=what-would-lucifer-do-engineers-cut` link, the same pattern
 * `saki-quest-for-redemption.ts` establishes for a private campaign.
 *
 * Node ids for every kept prediction (`ch3_p1`, `ch4_p2`, `ch8_p3`, and so on) are identical
 * to the public campaign's ids for the same incident, even though the surrounding chapter
 * numbering here is not contiguous — Chapters 1, 2, and 7 of the public campaign have no
 * counterpart here. The point is not a matching table of contents; it's that the same
 * incident carries the same id in both campaigns, so the two stay readable side by side.
 * Reveal text, labels, and discovery pages are reproduced from the public campaign's
 * pre-relocation wording. Effect variables, achievements, and ending tiers are rebalanced
 * for sixteen predictions rather than twenty-six — see the thresholds below, each with a
 * comment recording the achievable maximum it was checked against.
 *
 * Authored directly against `StoryGraphCampaignSource`, following the same precedent as
 * `what-would-lucifer-do.ts` and `saki-quest-for-redemption.ts`.
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
import type { PortableCatalog } from "../spike/portable.js";

export const WHAT_WOULD_LUCIFER_DO_ENGINEERS_CUT_CAMPAIGN_ID = "what-would-lucifer-do-engineers-cut";

export const whatWouldLuciferDoEngineersCutCatalog: PortableCatalog = {
  title: "What Would Lucifer Do? — Engineer's Cut",
  description:
    "The sixteen predictions What Would Lucifer Do? relocated for a general audience — thirteen technical, three software-career — told here in their original wording: the real rubric, the real pipelines, the real policy.",
  duration: "25–35 min",
  contentNotice: "Strong language, religious satire, recognizable parody, and technical jargon used completely unironically.",
  featured: false,
  hidden: true,
};

// ---------------------------------------------------------------------------
// Authoring helpers — same shape as what-would-lucifer-do.ts
// ---------------------------------------------------------------------------

const text = (id: string, field: string, value: string): AuthoredText => ({ key: `wwldx.${id}.${field}`, text: value });

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
  readonly extraChoices?: readonly ChoiceSource[];
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
    ...(spec.extraChoices ?? []),
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
  "WHAT WOULD LUCIFER DO? — ENGINEER'S CUT\n\n" +
    "The sixteen predictions the public campaign relocated into everyday domains — thirteen " +
    "that needed a technical background to guess honestly, plus three software-career ones " +
    "moved alongside them — told here in the original words, jargon included. If you already " +
    "know what a pipeline is, what an MCP server does, or why a rubric and a working system " +
    "can disagree with each other, this version is for you.\n\n" +
    "Same rules as before: reality already made its decision. Yours is just to predict it.\n\n" +
    "Here is the first one.",
  "ch3_p1",
);

// ---------------------------------------------------------------------------
// The Rubric
// ---------------------------------------------------------------------------

prediction({
  id: "ch3_p1",
  setup:
    "1996. A high-school C++ final project. Everyone has to build something; Lucifer builds " +
    "a full music library management system with real data structures, over months, that " +
    "actually works. When it's time to submit, the teacher insists on printing all the " +
    "source code. His stack comes to just under a hundred pages.\n\n" +
    "What Would Lucifer Do — or rather, what did the rubric do to him?",
  correctLabel: "A 95, docked for 'not enough comments' — followed later by an award for exceptional student",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("bureaucratic_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "Ninety-five out of a hundred, with points specifically deducted for insufficient " +
    "comments in a hundred-page working system nobody else in the class attempted. Later " +
    "that same year, the same class gives him an award for exceptional student. Both of " +
    "these things are true and neither one apologizes to the other. This is his first lesson " +
    "in how institutions reward effort: inconsistently, and usually after the fact.",
  wrongOptions: [
    { suffix: "perfect", label: "A perfect score and public praise", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "fail", label: "Failed outright for not following the assignment format", effects: [put("streak", 0)] },
    { suffix: "ignored", label: "A shrug, a passing grade, nobody reads a hundred pages", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It is neither a perfect score nor a failure nor a shrug. He gets a 95, specifically " +
    "docked for 'not enough comments' — and, later that same year, an award for exceptional " +
    "student, from the same class, for the same general body of work. The rubric and the " +
    "judgment operating alongside it appear to answer to different departments.",
  next: "ch3_p2",
  extraChoices: [opt("ch3_p1", "leave", "Close the laptop. You're not doing this.", "ending_walk_away")],
});

prediction({
  id: "ch3_p2",
  setup:
    "Years later: an organization with sixty developers, eight teams, and roughly four " +
    "hundred GUI-configured Azure DevOps pipelines. Lucifer replaces all of them with YAML.\n\n" +
    "What Would Lucifer Do — or rather, what happened to him for doing it?",
  correctLabel: "It triggers a full architecture review, escalating to the division head",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("bureaucratic_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "Architecture review. Manager. Division head. Confusion. The prevailing question, more or " +
    "less verbatim, is 'wait — you can do this?' His answer, more or less verbatim, is " +
    "'...you couldn't?' Four hundred manually-clicked pipelines turn out to have been load-" +
    "bearing for more than automation.",
  wrongOptions: [
    { suffix: "thanks", label: "A company-wide thank-you and a raise", effects: [put("streak", 0)] },
    { suffix: "quiet", label: "Nothing — a quiet merge, nobody notices for months", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "fired", label: "He gets fired for touching infrastructure without a ticket", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It does not go unnoticed and it does not end in a raise or a firing. It escalates — " +
    "architecture review, manager, division head — over four hundred pipelines that used to " +
    "require a mouse. Scale, it turns out, can be emotionally threatening to an org chart.",
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
  "'Can we do this for the other four hundred systems?' The review concludes, eventually, " +
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
  next: "disc_hub_ch3",
});

// ---------------------------------------------------------------------------
// Optional discoveries — unscored side pages, reachable from a small hub
// ---------------------------------------------------------------------------

pick(
  "disc_hub_ch3",
  "Before moving on, a few other entries from the same running list present themselves, " +
    "unprompted, the way footnotes do when nobody asked for them.",
  [
    opt("disc_hub_ch3", "website", "The suspicious website (1997–2005)", "disc_website", { showWhen: unvisited("disc_website") }),
    opt("disc_hub_ch3", "wizard", "The wizard that shouldn't exist yet (2000–2001)", "disc_wizard", { showWhen: unvisited("disc_wizard") }),
    opt("disc_hub_ch3", "statemachine", "The file system state machine (2005–2010)", "disc_statemachine", { showWhen: unvisited("disc_statemachine") }),
    opt("disc_hub_ch3", "webapi", "The 'you can do that?' moment (2018)", "disc_webapi", { showWhen: unvisited("disc_webapi") }),
    opt("disc_hub_ch3", "move_on", "Move on", "ch4_p1"),
  ],
);
page(
  "disc_website",
  "1997–2005: a full online portfolio, built before such things were normal — projects, " +
    "screenshots, a CV, a contact form, in Dreamweaver, before LinkedIn or personal branding " +
    "existed as concepts. It still exists. It is still valid HTML.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_wizard",
  "2000–2001: a Perl/CGI website-generation wizard, built for university faculty who could " +
    "type in text, colors, and layouts and receive a finished site. Functionally similar to " +
    "tools that would not exist commercially for years. Academia nodded politely and moved on.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_statemachine",
  "2005–2010: a watch-directory workflow using file extensions as a state machine, no " +
    "database required. It was later patented — by someone else, with several other names " +
    "added to it. None of them were his.",
  "Back",
  "disc_hub_ch3",
);
page(
  "disc_webapi",
  "2018: WebAPI filters that ran before controllers executed, checking cluster health and " +
    "blocking requests preemptively. The most common reaction was 'you can do that?' His most " +
    "common reply was 'once you know the contract...'",
  "Back",
  "disc_hub_ch3",
);

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

prediction({
  id: "ch4_p1",
  setup:
    "Lucifer applies to a VR store. Before formally applying, he notices they have no WinGet " +
    "package for their software.\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Build the WinGet package first, submit it, then apply for the job",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "He builds the package, submits it, and only then applies. Nobody asked him to do this. " +
    "He just noticed the gap. This is, by his own account, the pattern in miniature: the " +
    "application arrives after the unsolicited contribution, not before it.",
  wrongOptions: [
    { suffix: "apply", label: "Apply normally, mention the missing package in the cover letter", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "email", label: "Email the company suggesting they build one themselves", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no cover letter and no polite suggestion. He builds the package first, submits " +
    "it, and applies afterward — treating the missing infrastructure as something to fix on " +
    "sight rather than something to mention.",
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
    "Purely out of curiosity, Lucifer opens GitKraken's source code, finds a bug, and " +
    "reports it. Buried in the code he finds a banner: 'If you're reading this, apply.'\n\n" +
    "What Would Lucifer Do?",
  correctLabel: "Apply",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering"), put("applied_after_decline", true)],
  hitReveal:
    "Correct.\n\n" +
    "He applies. The bug report was not a job-hunting strategy — it was curiosity that " +
    "happened to double as one. This is usually where people ask if he's exaggerating the " +
    "pattern. He isn't. He was just early, again.",
  wrongOptions: [
    { suffix: "ignore", label: "Ignore the banner — it was probably a joke", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "screenshot", label: "Screenshot it for later, keep reading the source", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't ignored and it isn't filed away for later. He applies, on the strength of a bug " +
    "report he wrote for no reason except that the bug was there.",
  next: "ch5_p1",
});

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

prediction({
  id: "ch5_p1",
  setup:
    "Lucifer tells an AI agent, clearly, to stop analyzing his frustration. Three paragraphs " +
    "later, it is still analyzing his frustration. He tells it to stop again. It replies: " +
    "'Indeed. However, if we explore the symbolic implications of your frustration—'\n\n" +
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
    "Lucifer eventually writes a formal AI Model Selection Policy — three tiers, an " +
    "escalation ladder, and one final instruction for when the most expensive model concludes " +
    "'this architecture is fundamentally flawed.'\n\n" +
    "What Would Lucifer Do — what's the instruction at the top of the escalation ladder?",
  correctLabel: "Stop coding",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("surprisingly_reasonable")],
  hitReveal:
    "Correct.\n\n" +
    "When the expensive reasoning model concludes the architecture itself is broken, the " +
    "policy's own instruction is simply: stop. Not rewrite, not escalate further, not spin up " +
    "a second opinion. Stop coding. It is, on paper, the single most reasonable line in the " +
    "entire document.",
  wrongOptions: [
    { suffix: "rewrite", label: "Immediately rewrite everything from scratch", effects: [put("streak", 0)] },
    { suffix: "human", label: "Escalate to an actual human architect", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "rust", label: "Demand a full rewrite in Rust and reconvene", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no rewrite, no human escalation, no language change. The policy's actual " +
    "instruction, once the top-tier model calls the architecture fundamentally flawed, is " +
    "two words: stop coding.",
  next: "ch5_p3",
});

prediction({
  id: "ch5_p3",
  setup:
    "God asks Lucifer whether people will actually follow the policy he just wrote. Lucifer " +
    "stares toward Earth for a long moment before answering.\n\n" +
    "What Would Lucifer Do — or rather, say?",
  correctLabel: "'Tomorrow someone will use the top-tier model, high effort, to alphabetize a JSON file.'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "He predicts, specifically, that someone will burn the most expensive reasoning setting " +
    "available on alphabetizing a JSON file — and he says it with the flat certainty of a man " +
    "who has already watched it happen once. God laughs. Lucifer does not.",
  wrongOptions: [
    { suffix: "optimistic", label: "'Eventually, once people see the savings.'", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "give_up", label: "'No. Nobody reads policies.'", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It isn't optimism and it isn't blanket cynicism. He predicts something oddly specific: " +
    "that tomorrow, someone will use the expensive model on high effort to alphabetize a JSON " +
    "file. He is not guessing. He has already seen it happen.",
  next: "ch6_p1",
  extraChoices: [
    opt("ch5_p3", "read_policy", "(Read the full policy first)", "disc_model_policy", { showWhen: unvisited("disc_model_policy") }),
  ],
});

page(
  "disc_model_policy",
  "The full policy, for the record: the expensive genius model thinks. The mid-tier model " +
    "builds. The cheapest model cleans up the mess everyone else leaves behind. Reasoning " +
    "should scale with the complexity of the problem — not with the size of anyone's " +
    "subscription.",
  "Back",
  "ch5_p3",
);

// ---------------------------------------------------------------------------
// Recursive Bureaucracy
// ---------------------------------------------------------------------------

prediction({
  id: "ch6_p1",
  setup:
    "Lucifer builds a blog so he can write about the game engine. Opening GitHub to publish " +
    "each post takes, by his own count, at least thirty-seven seconds of completely " +
    "unnecessary human involvement.\n\n" +
    "What Would Lucifer Do about the thirty-seven seconds?",
  correctLabel: "Build an API, so he never has to open GitHub again",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "He builds an API. Now, instead of opening GitHub, he sends Markdown; the API creates the " +
    "file. Someone watching this unfold points out that he's still writing the Markdown " +
    "himself. He agrees. He does not stop.",
  wrongOptions: [
    { suffix: "tolerate", label: "Tolerate the thirty-seven seconds like everyone else does", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "script", label: "Write a one-line shell alias and move on with his life", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "It's neither tolerance nor a one-line alias. He builds a whole API so he never has to " +
    "open GitHub again — which technically solves the thirty-seven seconds while spending " +
    "considerably longer than thirty-seven seconds building the solution.",
  next: "ch6_p2",
});

prediction({
  id: "ch6_p2",
  setup:
    "With the API built, Lucifer starts having Claude and ChatGPT generate the Markdown " +
    "directly. The API publishes it. CI builds it. A hosting service serves it.\n\n" +
    "What Would Lucifer Do next — what's still missing from this pipeline?",
  correctLabel: "An MCP server, so an AI agent can simply say 'publish this'",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "He builds an MCP server. Now the AI doesn't call the API — it just says 'publish this,' " +
    "and the tooling figures out the rest. When asked whether he has an actual plan for any " +
    "of this, his honest answer is 'not really.' It just seemed like the next obvious step.",
  wrongOptions: [
    { suffix: "stop", label: "Nothing — the pipeline is already good enough", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "sell", label: "Package it up and sell it as a product", effects: [put("streak", 0)] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "He doesn't stop and he doesn't productize it. He builds an MCP server so an AI agent can " +
    "publish directly by saying so — closing the loop between 'idea' and 'live on the " +
    "internet' down to roughly three steps.",
  next: "ch6_p3",
});

prediction({
  id: "ch6_p3",
  setup:
    "The final version: Lucifer schedules an AI to write a weekly engineering journal, every " +
    "Sunday at 8 PM, summarizing software mostly built by AI, based on conversations with " +
    "another AI, published automatically through the same MCP server.\n\n" +
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
  next: "ch6_to_ch8",
  extraChoices: [
    opt("ch6_p3", "read_pipeline", "(Look at the before-and-after pipeline first)", "disc_pipeline", { showWhen: unvisited("disc_pipeline") }),
  ],
});

page(
  "disc_pipeline",
  "Before: idea, open editor, write, format, create file, copy front matter, commit, push, " +
    "wait, publish. After: idea, talk to AI, commit, done. Soon, apparently: idea, say " +
    "'publish,' done. None of the individual improvements save much on their own. All of them " +
    "together save an idea becoming a published article before the coffee cools.",
  "Back",
  "ch6_p3",
);

say(
  "ch6_to_ch8",
  "It is worth pointing out that none of this happened at a desk. Architecture decisions, by " +
    "Lucifer's own account, tend to arrive while driving through a city, standing in a " +
    "government office, or in a hookah lounge — including the one that started the engine " +
    "you're currently running this campaign inside of.",
  "ch8_p2",
);

// ---------------------------------------------------------------------------
// The Engine
// ---------------------------------------------------------------------------

prediction({
  id: "ch8_p2",
  setup:
    "Lucifer asks an LLM a simple question: how did Jones in the Fast Lane actually work? It " +
    "explains jobs, schedules, needs, relationships, progression — then starts suggesting " +
    "implementation details.\n\n" +
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
  extraChoices: [
    opt("ch8_p2", "read_episode", "(Read how Episode One got filed first)", "disc_episode_one", { showWhen: unvisited("disc_episode_one") }),
  ],
});

page(
  "disc_episode_one",
  "The engine's first real content is filed, formally, as Episode One: The Bulgarian " +
    "Incident. Estimated duration: two weeks. Actual duration: forty hours. The player isn't " +
    "collecting magical artifacts. They're collecting paperwork, which turns out to be more " +
    "dangerous.",
  "Back",
  "ch8_p2",
);

prediction({
  id: "ch8_p3",
  setup:
    "Two weeks after that one question, Lucifer checks the engine's status.\n\n" +
    "What Would Lucifer Do — or rather, where did two weeks actually land him?",
  correctLabel: "50 of 51 work units complete — about 98%, across three entirely different game genres",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("ridiculous_engineering")],
  hitReveal:
    "Correct.\n\n" +
    "Fifty of fifty-one named work units. Ninety-eight percent. Three completely different " +
    "styles of simulation running on one shared deterministic core, two weeks after there " +
    "wasn't a project at all — just one question about a life sim from 1990.",
  wrongOptions: [
    { suffix: "prototype", label: "A rough prototype, maybe 40% of the way there", effects: [put("streak", 0), inc("reasonable_assumption")] },
    { suffix: "abandoned", label: "Abandoned within a week for something else entirely", effects: [put("streak", 0)] },
    {
      suffix: "sentient",
      label: "Fully complete, sentient, and filing its own pull requests — reality couldn't possibly beat that",
      effects: [put("streak", 0), put("guessed_close_but_wrong", true)],
      gotoSuffix: "close",
    },
  ],
  missReveal:
    "Not quite.\n\n" +
    "Not abandoned, not a rough 40% prototype. Two weeks in: fifty of fifty-one work units " +
    "done, three separate game genres running, about 98% complete — from a single question " +
    "about a life sim from 1990.",
  next: "ch8_p4",
});
page(
  "ch8_p3_close",
  "Close, but reality still wins.\n\n" +
    "It isn't sentient and it isn't filing its own pull requests. It's something almost as " +
    "absurd and considerably more real: 50 of 51 work units, about 98% complete, across three " +
    "entirely different genres, two weeks after one question about a life sim from 1990. You " +
    "reached for the joke answer. The truth still came in ahead of it.",
  "Continue",
  "ch8_p4",
);

prediction({
  id: "ch8_p4",
  setup:
    "While building the engine, Lucifer also — separately, apparently by accident — built " +
    "something else entirely.\n\n" +
    "What Would Lucifer Do, on the side, without meaning to?",
  correctLabel: "Build a full blogging platform, with an API and an MCP server, to write about the engine",
  correctEffects: [inc("predictions_correct"), inc("streak"), inc("unnecessary_escalation")],
  hitReveal:
    "Correct.\n\n" +
    "The blog was supposed to just be a place to write about the engine. Within the same " +
    "stretch of time it grew an API, then an MCP server, then a scheduled weekly report " +
    "written by AI about software mostly written by AI. Asked whether any of this was " +
    "planned, his honest answer is 'not really — it seemed like the next obvious step.'",
  wrongOptions: [
    { suffix: "console", label: "A small game console, for testing", effects: [put("streak", 0)] },
    { suffix: "nothing", label: "Nothing — the engine was the only thing he built that stretch", effects: [put("streak", 0), inc("reasonable_assumption")] },
  ],
  missReveal:
    "Not quite.\n\n" +
    "There's no console and there's nothing exclusive about the engine's attention. A full " +
    "blogging platform grows alongside it — API, MCP server, and all — entirely because " +
    "writing about the engine turned out to have its own scope creep.",
  next: "ch8_p8",
  extraChoices: [
    opt("ch8_p4", "read_roadmap", "(Read the roadmap first)", "disc_roadmap", { showWhen: unvisited("disc_roadmap") }),
  ],
});

page(
  "disc_roadmap",
  "The project's roadmap doesn't read like project management. It reads like a novel: 'the " +
    "first story survives contact with bureaucracy,' 'the engine learns the rules,' 'the past " +
    "becomes testable,' 'the engine gets a front door.' Considerably more entertaining than " +
    "'authentication, networking, optimization.'",
  "Back",
  "ch8_p4",
);

prediction({
  id: "ch8_p8",
  setup:
    "Last one. Somebody, eventually, was always going to look at all of this — the rubric, " +
    "the offers, the machines, the recursive blog, the engine — and build a game asking " +
    "strangers to predict it.\n\n" +
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
// Verdict hub and endings
// ---------------------------------------------------------------------------
// Sixteen predictions, not twenty-six — every threshold below is rebalanced against the
// achievable maximum for this campaign, not copied from the public one. Tier boundaries:
// novice 0–3, apprentice 4–7, fluent 8–11, disturbing 12–14, transcendent 15–16.

pick(
  "verdict_hub",
  "Sixteen predictions. No more incidents. Only the tally left.\n\n" +
    "Choose a verdict to read — whichever one currently applies to you is the one that will " +
    "make sense.",
  [
    opt("verdict_hub", "novice", "Read your verdict", "ending_tier_novice", { showWhen: between("predictions_correct", 0, 3) }),
    opt("verdict_hub", "apprentice", "Read your verdict", "ending_tier_apprentice", { showWhen: between("predictions_correct", 4, 7) }),
    opt("verdict_hub", "fluent", "Read your verdict", "ending_tier_fluent", { showWhen: between("predictions_correct", 8, 11) }),
    opt("verdict_hub", "disturbing", "Read your verdict", "ending_tier_disturbing", { showWhen: between("predictions_correct", 12, 14) }),
    opt("verdict_hub", "transcendent", "Read your verdict", "ending_tier_transcendent", { showWhen: atLeast("predictions_correct", 15) }),
    opt("verdict_hub", "no_fucking_way", "Read the special verdict", "ending_no_fucking_way", {
      showWhen: { all: [atLeast("no_fucking_way", 3), atLeast("streak", 5)] },
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
  "Of 16 predictions, you got a genuinely low number of them right. This is probably " +
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
  "Most of the sixteen landed. At this accuracy you're not reacting to Lucifer's decisions " +
    "anymore — you're anticipating them, correctly, often before the reveal text finishes " +
    "loading.\n\n" +
    "Please explain yourself.",
  "win",
);

finish(
  "tier_transcendent",
  "tier_transcendent",
  "Lucifer Would Like To Know How You Obtained This Information",
  "Nearly a perfect score. You called the rubric, the pipelines, the rename, the policy, and " +
    "the MCP server, in order, without flinching.\n\n" +
    "Nobody predicts this many of Lucifer's decisions by accident. Somewhere, a formal " +
    "inquiry is being drafted. You are the subject of it.",
  "win",
);

finish(
  "no_fucking_way",
  "no_fucking_way",
  "There Is No Fucking Way",
  "You correctly predicted every single one of the least predictable, most reflexively " +
    "absurd decisions in this entire campaign, back to back, without a miss between them.\n\n" +
    "Some of these were not guessable. You guessed them anyway. This is either a very deep " +
    "understanding of Lucifer, or the two of you are, on some level, the same problem.",
  "win",
);

finish(
  "reasonable_human_being",
  "reasonable_human_being",
  "Reasonable Human Being",
  "Repeatedly, when it mattered, you assumed Lucifer would behave like a normal engineer in " +
    "a normal organization.\n\n" +
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
  ["no_fucking_way", "no_fucking_way", "There Is No Fucking Way", "Correctly predict every exceptionally improbable event in the campaign."],
  ["reasonable_human_being", "reasonable_human_being", "Reasonable Human Being", "Repeatedly assume Lucifer will behave like a normal engineer."],
];

const achievements: AchievementDefinitionSource[] = [
  ...ENDING_ACHIEVEMENTS.map(([id, endingId, name, description]) =>
    achievement(id, name, description, { field: "ending", operator: "equals", value: endingId })),
  achievement("pattern_recognition", "Pattern Recognition", "Correctly predict four consecutive decisions.", atLeast("streak", 4)),
  // Achievable max for predictions_correct is 16 (vs. 26 in the public campaign); regated from >=20.
  achievement("unfortunately_you_get_him", "Unfortunately, You Get Him", "Reach a high prediction accuracy.", atLeast("predictions_correct", 13)),
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
  achievement("named_the_ai", "Jar-Jar2R2", "Witness the machine get renamed after two idiot Star Wars characters.", flag("named_the_ai", true)),
  achievement(
    "declined_the_money",
    "A 2004 Salary",
    "Watch Lucifer turn down real money on principle, then apply somewhere else out of curiosity.",
    { all: [flag("declined_the_money", true), flag("applied_after_decline", true)] },
  ),
  // Achievable max for no_fucking_way is 3 (vs. 10 in the public campaign); regated from >=6.
  achievement("documented_menace", "Documented Menace", "Correctly predict every one of the genuinely unpredictable decisions.", atLeast("no_fucking_way", 3)),
  achievement("state_of_the_art_paperwork", "State Of The Art Paperwork", "Correctly predict both authored bureaucratic escalations.", atLeast("bureaucratic_escalation", 2)),
  // Achievable max for ridiculous_engineering is 5; matches the public campaign's threshold exactly.
  achievement("infrastructure_for_a_feeling", "Infrastructure For A Feeling", "Correctly predict every instance of ridiculous engineering.", atLeast("ridiculous_engineering", 5)),
  achievement("escalation_as_a_service", "Escalation As A Service", "Correctly predict every instance of purely unnecessary escalation.", atLeast("unnecessary_escalation", 3)),
  achievement("wizard_that_shouldnt_exist", "The Wizard That Shouldn't Exist Yet", "Find the Perl/CGI website wizard, years ahead of its time.", visited("disc_wizard")),
  achievement("read_the_full_policy", "Reasoning Should Scale", "Read the full AI Model Selection Policy, not just the summary.", visited("disc_model_policy")),
  // brought_alan_watts_into_this (philosophical_detours >= 5) is dropped: this campaign has
  // exactly one philosophical-detour prediction (ch6_p3), so the threshold is unreachable.
];

// ---------------------------------------------------------------------------

const TITLE: AuthoredText = { key: "wwldx.campaign.title", text: "What Would Lucifer Do? — Engineer's Cut" };

export const whatWouldLuciferDoEngineersCutSource: StoryGraphCampaignSource = {
  description: {
    key: "wwldx.campaign.description",
    text:
      "The sixteen predictions What Would Lucifer Do? relocated for a general audience — " +
      "thirteen technical, three software-career — told here in their original wording. If " +
      "you don't know what a pipeline, an API, or an MCP server is, play the public campaign " +
      "instead — this one assumes you do.",
  },
  variables: {
    predictions_correct: {
      type: "int",
      initial: 0,
      min: 0,
      max: 16,
      visible: true,
      label: text("var_predictions_correct", "label", "Predictions Correct"),
    },
    no_fucking_way: {
      type: "int",
      initial: 0,
      min: 0,
      max: 3,
      visible: true,
      label: text("var_no_fucking_way", "label", "There Is No Fucking Way Events"),
    },
    bureaucratic_escalation: {
      type: "int",
      initial: 0,
      min: 0,
      max: 2,
      visible: true,
      label: text("var_bureaucratic_escalation", "label", "Bureaucratic Escalation Predicted"),
    },
    unnecessary_escalation: {
      type: "int",
      initial: 0,
      min: 0,
      max: 3,
      visible: true,
      label: text("var_unnecessary_escalation", "label", "Unnecessary Escalation Predicted"),
    },
    surprisingly_reasonable: {
      type: "int",
      initial: 0,
      min: 0,
      max: 2,
      visible: true,
      label: text("var_surprisingly_reasonable", "label", "Surprisingly Reasonable Behavior Predicted"),
    },
    philosophical_detours: {
      type: "int",
      initial: 0,
      min: 0,
      max: 1,
      visible: true,
      label: text("var_philosophical_detours", "label", "Philosophical Detours Anticipated"),
    },
    ridiculous_engineering: {
      type: "int",
      initial: 0,
      min: 0,
      max: 5,
      visible: true,
      label: text("var_ridiculous_engineering", "label", "Ridiculous Engineering Solutions Anticipated"),
    },
    reasonable_assumption: {
      type: "int",
      initial: 0,
      min: 0,
      max: 16,
      visible: true,
      label: text("var_reasonable_assumption", "label", "Reasonable Assumptions Made (Incorrectly)"),
    },
    streak: { type: "int", initial: 0, min: 0, max: 16 },
    named_the_ai: { type: "bool", initial: false },
    declined_the_money: { type: "bool", initial: false },
    applied_after_decline: { type: "bool", initial: false },
    guessed_close_but_wrong: { type: "bool", initial: false },
  },
  startNodeId: "prologue",
  nodes,
  achievements,
};

export function buildWhatWouldLuciferDoEngineersCutCampaign(
  source: StoryGraphCampaignSource = whatWouldLuciferDoEngineersCutSource,
): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: WHAT_WOULD_LUCIFER_DO_ENGINEERS_CUT_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: TITLE.key,
    content,
  };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
