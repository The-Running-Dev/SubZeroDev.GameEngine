/**
 * Lucifer Chronicles: The Bulgarian Incident.
 *
 * A public, intentionally adult story-graph campaign adapted from the SubZeroDev Blog.
 * The original Bulgaria fixtures stay independent: this is a new campaign with stable ids
 * so saved games can migrate deliberately when future content moves them.
 */
import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildStoryGraphCampaign, type NodeSource, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";

export const LUCIFER_CHRONICLES_CAMPAIGN_ID = "lucifer-chronicles";

type Step = readonly [text: string, literal: string, literalReply: string, absurd: string, absurdReply: string];
type Act = { id: string; title: string; steps: readonly Step[] };

const benActs: readonly Act[] = [
  { id: "ben_return", title: "The Return", steps: [
    ["You return to Bulgaria intending to fix one house. Your estimate is two weeks. Reality has opened a fresh ticket.", "Make a sensible list", "The list immediately develops relatives.", "Say ‘well, why not?’", "Somewhere, Lucifer opens a notebook."],
    ["At the gate, a neighbour asks why you came back and recommends a cheaper mechanic before you answer.", "Explain carefully", "He explains your own life back to you, incorrectly.", "Laugh", "The recommendation gains confidence."],
    ["The house is quiet, beautiful, and apparently co-owned by everyone who has ever touched a tomato.", "Look for documents", "A drawer produces documents and a spider with opinions.", "Ask the tomatoes", "The tomatoes refuse to testify."],
    ["An email arrives granting you permission to live exactly where you have been living.", "Thank them professionally", "The universe remains unchanged.", "Forward it to gravity", "Gravity has not requested permission either."],
    ["You consider whether this is a property dispute or simply a very long joke with deeds.", "Call a lawyer", "The lawyer says ‘it depends’ with doctoral confidence.", "Call Lucifer", "He says the help desk is aware."],
  ] },
  { id: "ben_permission", title: "Permission to Continue Existing", steps: [
    ["Your aunt explains she owns everything because she maintained the tomatoes since 1998.", "Request cadastral records", "The records exist in three offices and agree in none.", "Accept tomato jurisprudence", "The tomatoes look smug."],
    ["A family meeting begins peacefully and reaches 1994 in under twelve minutes.", "Stay silent", "Silence is interpreted as a hostile legal position.", "Change the subject", "Someone remembers the fence."],
    ["The disputed fence is measured by three people using three incompatible metres.", "Use a tape measure", "The tape measure is accused of bias.", "Use vibes", "Vibes produce the same argument faster."],
    ["A locked gate presents a choice between procedure and immediate regret.", "Find the key", "The key is in a drawer nobody owns.", "Ask who authorized the lock", "A new committee is proposed."],
    ["You finally obtain paperwork proving a fact everyone already knew yesterday.", "Present it gently", "Nobody is thrilled by evidence.", "Frame it dramatically", "Lucifer applauds from a cloud."],
  ] },
  { id: "ben_road", title: "The Road Is a Philosophical Concept", steps: [
    ["A black BMW blocks your lane. A van then parks behind it, improving nothing.", "Wait patiently", "Patience becomes visible to the entire street.", "Throw your hands up", "A stranger discovers this is apparently aggression."],
    ["The driver asks whether you find the situation funny.", "Say no", "He hears contempt anyway.", "Start laughing", "This turns out to be less diplomatic and more honest."],
    ["Your own dashboard lights up five minutes after inspection.", "Ask the mechanic", "He says it was already like that.", "Turn up the music", "The warning light becomes part of the sound system."],
    ["A mountain road remembers the old Evo and every bad decision that felt aerodynamic.", "Slow down", "Your brain files a complaint.", "Trust instinct", "Your brain starts pricing nearby land."],
    ["The mechanic fixes a mysterious noise with a hammer and several words not found in dictionaries.", "Pay immediately", "Trust has become a maintenance schedule.", "Ask what he fixed", "He explains until language gives up."],
  ] },
  { id: "ben_municipality", title: "The Municipality", steps: [
    ["At 08:03, a note says the office is closed for a meeting until 11:30.", "Wait", "Time passes with administrative enthusiasm.", "Try another entrance", "The other entrance has a more authoritative note."],
    ["The clerk reviews every document, smiles, and notices one is now too old.", "Accept fate", "Fate stamps a duplicate.", "Ask for another office", "Room 14 is delighted to meet you."],
    ["Room 14 sends you to Room 6. Room 6 sends you to Room 14.", "Continue the cycle", "The cycle continues professionally.", "Ask for a supervisor", "The supervisor is temporarily in Room 14."],
    ["The guard suggests coffee, the mayor’s cousin, and not asking questions in that order.", "Get coffee", "The coffee knows more than the registry.", "Ask questions", "The guard admires your optimism."],
    ["Your paperwork now has enough stamps to qualify as a small religion.", "File the final form", "The final form requests the previous final form.", "Invoke cosmic escalation", "Lucifer receives a ticket with thirteen attachments."],
  ] },
  { id: "ben_question", title: "One Quick Question", steps: [
    ["To solve the form problem, you ask an AI one innocent question about Jones in the Fast Lane.", "Read the answer", "The answer contains architecture.", "Ask one more question", "A game engine appears in the room."],
    ["The engine needs documentation. The documentation needs a site. The site needs a publishing system.", "Set a boundary", "The boundary is converted into a roadmap.", "Build the MCP server", "Lucifer writes ‘of course’ in the margin."],
    ["Someone asks whether you have a plan. You look at the arrows, containers, agents, and blogs.", "Make a plan", "The plan acquires work units.", "Say it seemed obvious", "This is not reassuring anyone."],
    ["Forty-four work units later, the original question is still sitting there looking innocent.", "Close the laptop", "The laptop opens a new issue.", "Publish the story", "The story becomes another input."],
    ["Future You has been notified. Future You has not replied.", "Wait for approval", "Approval enters a meeting.", "Keep going", "The coffee has not cooled yet."],
    ["The system asks you to categorize the project. The available categories are all visibly inadequate.", "Choose one anyway", "The category files a complaint.", "Refuse categorization", "Somewhere, an Agent starts sweating."],
  ] },
  { id: "ben_hell", title: "The Night Shift in Hell", steps: [
    ["At 3 AM, insomnia upgrades into a full philosophical debate in Hell.", "Ask for Lucifer", "He has been waiting for the Bulgarian.", "Ask for customer support", "The receptionist stamps something aggressively."],
    ["Lucifer asks why you keep calling yourself Lucifer online.", "Explain honestly", "He regrets asking with admirable speed.", "Blame humanity", "God appears, entertained."],
    ["Alan Watts pours tea. Neo refuses a mission. An Agent opens a ticket that cannot be categorized.", "Discuss symbolism", "Lucifer says no one invited symbolism.", "Leave early", "The Agent cannot process departure."],
    ["God explains that humanity may have been designed primarily for comedic value.", "Object philosophically", "God upgrades the joke.", "Accept the premise", "The universe remains unbothered."],
    ["The final question is whether you fixed the house, escaped the office, or merely made the story better.", "Choose a resolution", "Resolution considers the request.", "Choose absurdity", "Absurdity approves immediately."],
  ] },
];

const luciferActs: readonly Act[] = [
  { id: "lucifer_hell", title: "Hell Is Customer Support", steps: [
    ["Hell is quiet: coffee, paperwork, and an exhausted receptionist who has processed humanity for ten thousand years.", "Take the next ticket", "The next ticket is marked Bulgarian.", "Ask for a fly", "A fly immediately violates the agreement."],
    ["The fly lands on your arm, circles your head, and attempts air superiority on your nose.", "Restate the treaty", "The fly declines diplomacy.", "Enforce consequences", "The invoice is fatal."],
    ["God asks whether you are bored. This is never a harmless question.", "Say no", "He assigns you a human anyway.", "Ask for a promotion", "He laughs for a geological period."],
    ["The case file reads: BEN. Status: impossible to categorize. Attachments: bureaucracy, philosophy, several cars.", "Read the attachments", "The attachments develop attachments.", "Close the file", "The file reopens itself."],
    ["You are told to observe, not interfere. This instruction has historically produced terrible outcomes.", "Observe professionally", "Professionalism starts smoking.", "Interfere quietly", "The universe notices."],
  ] },
  { id: "lucifer_ticket", title: "The Bulgarian Ticket", steps: [
    ["From above, you watch a man receive permission to continue occupying his own chair.", "Record the fact", "Reality fails to react.", "Ask God to explain", "God calls it a feature."],
    ["An aunt claims property through tomato maintenance. The claim has confidence but no jurisdiction.", "Consult infernal precedent", "Infernal precedent wants the tomatoes too.", "Ask the tomatoes", "They invoke the Fifth Amendment."],
    ["A family meeting invokes 1994 with ritual precision.", "Offer mediation", "Everyone interprets it as an attack.", "Offer whiskey", "For seven minutes, civilization returns."],
    ["The locked gate has produced three explanations and no key.", "Summon a demon locksmith", "He asks for authorization.", "Submit a request", "The request becomes a family heirloom."],
    ["God asks whether this proves humanity is unfinished. You consider the evidence.", "Say yes", "He looks delighted.", "Say it is entertainment", "He looks even more delighted."],
  ] },
  { id: "lucifer_boundary", title: "The Boundary Negotiation", steps: [
    ["A narrow street becomes a philosophical demonstration of parking, entitlement, and hand gestures.", "Defend the boundary", "The van driver discovers theatre.", "Observe the absurdity", "Ben starts laughing. This worsens everything."],
    ["The dashboard lights up like a Christmas tree just after inspection.", "Possess the mechanic", "He acquires a hammer.", "Recommend reason", "Reason is not taking calls."],
    ["An old mountain road offers speed, fear, and approximately one acceptable decision.", "Whisper caution", "The accelerator mishears you.", "Whisper commitment", "The brain begins estimating real estate."],
    ["The BMW noise is fixed with one hammer strike and a story nobody can verify.", "Bless the repair", "The noise returns Tuesday.", "Audit the repair", "The mechanic invents another word."],
    ["You discover that humans do not cross boundaries because they want war. They cross them because they can.", "Write this down", "The fly adds a dissenting opinion.", "Forget it", "The universe saves it anyway."],
  ] },
  { id: "lucifer_audit", title: "Audit of Room 14", steps: [
    ["The municipality is closed for a meeting. The meeting is apparently eternal.", "Announce infernal authority", "The clerk asks for Form 666-B.", "Take a number", "Your number is already expired."],
    ["Room 14 sends you to Room 6. Room 6 sends you to Room 14. Even Hell respects this design.", "Break the loop", "The loop files an appeal.", "Study the loop", "It is beautifully pointless."],
    ["A clerk rejects a document because it has become old while being examined.", "Freeze time", "The stamp requests a counter-signature.", "Accept the premise", "You briefly understand despair."],
    ["The guard offers coffee and access to the mayor’s cousin.", "Accept coffee", "The coffee is the only honest official here.", "Ask about procedure", "The guard laughs with genuine pity."],
    ["An Agent arrives to categorize the process. The process categorizes the Agent first.", "Help the Agent", "The forms multiply.", "Watch quietly", "Neo leaves before the receipt prints."],
  ] },
  { id: "lucifer_outbreak", title: "The Project Outbreak", steps: [
    ["Ben asks an AI one quick question. You recognize the opening move of a containment failure.", "Close the conversation", "The conversation becomes documentation.", "Observe the escalation", "A deterministic engine emerges."],
    ["The engine needs a site. The site needs Git. Git needs automation. Automation needs MCP.", "Cut one dependency", "Two more appear in its place.", "Draw the diagram", "The diagram becomes a product."],
    ["Marcus Aurelius says it is outside your control. Alan Watts laughs. An Agent demands a category.", "Listen to Marcus", "The Agent opens a stoicism ticket.", "Listen to Watts", "The ticket dissolves but remains open."],
    ["Neo declines to save the world because he has a meeting to leave early.", "Assign him a mission", "He exits through a door you did not authorize.", "Ask him for help", "He pays for coffee with obsolete currency."],
    ["The system can handle enemies. It cannot handle someone who follows rules literally until they collapse.", "Escalate to Heaven", "Heaven requests reproduction steps.", "Join the project", "Your title becomes Principal Chaos Architect."],
  ] },
  { id: "lucifer_postmortem", title: "The Divine Postmortem", steps: [
    ["God reviews the case while Earth continues inventing categories, committees, and customer support bots.", "Request closure", "God asks what closure means.", "Request an escape hatch", "There is not one."],
    ["You accuse God of making humanity for entertainment. He does not deny it quickly enough.", "Demand an explanation", "He offers a shrug.", "Pour another drink", "This is treated as policy."],
    ["The fly incident is entered into evidence.", "Call it self-defense", "The fly’s counsel objects posthumously.", "Call it a lesson", "The lesson is expensive."],
    ["Ben has either resolved something, built another product, or become a permanent resident of Room 14.", "Close the ticket", "The ticket gains a sequel.", "Invite Ben for a drink", "God approves this outcome."],
    ["You must now decide whether Hell is punishment, governance, or customer support.", "Choose governance", "The alive ones are assigned to you.", "Choose customer support", "The queue is infinite but oddly familiar."],
  ] },
];

function key(id: string, field: string): string { return `lucifer.${id}.${field}`; }

function addAct(nodes: Record<string, NodeSource>, act: Act, next: string, effectVar: "patience" | "absurdity" | "paperwork" | "scope_creep" | "cosmic_attention") {
  act.steps.forEach(([text, literal, literalReply, absurd, absurdReply], index) => {
    const nodeId = `${act.id}_${index + 1}`;
    const literalId = `${nodeId}_literal`;
    const absurdId = `${nodeId}_absurd`;
    const destination = index === act.steps.length - 1 ? next : `${act.id}_${index + 2}`;
    nodes[nodeId] = {
      kind: "choice", text: { key: key(nodeId, "text"), text }, choices: [
        { id: `${nodeId}_literal`, label: { key: key(nodeId, "literal"), text: literal }, effects: [{ op: "increment", var: "patience", by: 1 }], goto: literalId },
        { id: `${nodeId}_absurd`, label: { key: key(nodeId, "absurd"), text: absurd }, effects: [{ op: "increment", var: "absurdity", by: 1 }, { op: "increment", var: effectVar, by: 1 }], goto: absurdId },
      ],
    };
    nodes[literalId] = { kind: "auto", text: { key: key(literalId, "text"), text: literalReply }, goto: destination };
    nodes[absurdId] = { kind: "auto", text: { key: key(absurdId, "text"), text: absurdReply }, goto: destination };
  });
}

const nodes: Record<string, NodeSource> = {};
nodes.prologue = {
  kind: "choice",
  text: { key: "lucifer.prologue.text", text: "Objective: fix one house in Bulgaria. Estimated duration: two weeks. Actual campaign: forty hours, several forms, and a cosmic support ticket." },
  choices: [
    { id: "play_ben", label: { key: "lucifer.prologue.ben", text: "Play as Ben" }, effects: [{ op: "set", var: "role", value: "ben" }], goto: "ben_return_1" },
    { id: "play_lucifer", label: { key: "lucifer.prologue.lucifer", text: "Play as Lucifer" }, effects: [{ op: "set", var: "role", value: "lucifer" }], goto: "lucifer_hell_1" },
  ],
};

const benEndingIds = ["incident_resolved", "it_builds_character", "room_14_resident", "tomato_jurisprudence", "bought_some_land", "permission_to_exist", "future_me_unanswered", "another_product", "uncategorizable_ben", "well_why_not"] as const;
const luciferEndingIds = ["ticket_closed", "customer_support", "governor_of_alive", "escape_hatch_missing", "fly_treaty", "fly_statistic", "agents_failed", "platform_outbreak", "invites_ben", "that_one_is_ours"] as const;

function addFinale(prefix: "ben" | "lucifer", endings: readonly string[]) {
  const finalNode = `${prefix}_final_choice`;
  nodes[finalNode] = {
    kind: "choice",
    text: { key: key(finalNode, "text"), text: prefix === "ben" ? "The story asks what you actually accomplished. This is an aggressive question." : "The postmortem asks what Hell has learned. This is somehow worse." },
    choices: endings.map((ending, index) => ({ id: `${prefix}_${ending}`, label: { key: key(`${prefix}_${ending}`, "label"), text: `Follow the ${index + 1}th available conclusion` }, goto: `${prefix}_ending_${ending}` })),
  };
  endings.forEach((ending, index) => {
    nodes[`${prefix}_ending_${ending}`] = {
      kind: "ending",
      text: { key: key(`${prefix}_ending_${ending}`, "text"), text: prefix === "ben" ? `Ending: ${ending.replaceAll("_", " ")}. The house, the paperwork, and the universe each continue with deeply selective interest.` : `Ending: ${ending.replaceAll("_", " ")}. Lucifer updates the ticket, pours another drink, and watches humanity continue unsupervised.` },
      endingId: `${prefix}_${ending}`,
      outcome: index % 3 === 0 ? "win" : index % 3 === 1 ? "neutral" : "loss",
    };
  });
}

for (let index = 0; index < benActs.length; index += 1) addAct(nodes, benActs[index]!, index === benActs.length - 1 ? "ben_final_choice" : `${benActs[index + 1]!.id}_1`, index % 2 === 0 ? "scope_creep" : "paperwork");
for (let index = 0; index < luciferActs.length; index += 1) addAct(nodes, luciferActs[index]!, index === luciferActs.length - 1 ? "lucifer_final_choice" : `${luciferActs[index + 1]!.id}_1`, index % 2 === 0 ? "cosmic_attention" : "scope_creep");
addFinale("ben", benEndingIds);
addFinale("lucifer", luciferEndingIds);

const endingAchievements = [...benEndingIds.map((id) => `ben_${id}`), ...luciferEndingIds.map((id) => `lucifer_${id}`)];
const incidentAchievements = ["ahead_of_rubric", "hands_were_problem", "tomato_title_deed", "coffee_still_warm", "forty_four_work_units", "fatal_invoice", "room_fourteen", "cosmic_customer_support"];

export const luciferChroniclesSource: StoryGraphCampaignSource = {
  description: { key: "lucifer.campaign.description", text: "A sprawling, profane, philosophical trip through Bulgaria, bureaucracy, AI escalation, and Hell’s customer-support queue." },
  variables: {
    patience: { type: "int", initial: 0, min: 0, max: 10, visible: true, label: { key: "lucifer.var.patience", text: "Patience" } },
    absurdity: { type: "int", initial: 0, min: 0, max: 10, visible: true, label: { key: "lucifer.var.absurdity", text: "Absurdity" } },
    paperwork: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: { key: "lucifer.var.paperwork", text: "Paperwork" } },
    scope_creep: { type: "int", initial: 0, min: 0, max: 10, visible: true, label: { key: "lucifer.var.scope_creep", text: "Scope Creep" } },
    cosmic_attention: { type: "int", initial: 0, min: 0, max: 10, visible: true, label: { key: "lucifer.var.cosmic_attention", text: "Cosmic Attention" } },
    role: { type: "enum", initial: "ben", values: ["ben", "lucifer"] },
    approach: { type: "enum", initial: "literal", values: ["literal", "absurd"] },
    has_deeds: { type: "bool", initial: false }, trusted_mechanic: { type: "bool", initial: false }, house_resolved: { type: "bool", initial: false }, bureaucracy_escaped: { type: "bool", initial: false }, fly_alive: { type: "bool", initial: true }, ai_contained: { type: "bool", initial: false },
  },
  startNodeId: "prologue",
  nodes,
  achievements: [
    ...endingAchievements.map((id) => ({ id, name: { key: key(`achievement_${id}`, "name"), text: id.replaceAll("_", " ") }, description: { key: key(`achievement_${id}`, "description"), text: "Reach this ending." }, hidden: true, condition: { field: "ending", operator: "equals", value: id } })),
    ...incidentAchievements.map((id, index) => ({ id, name: { key: key(`achievement_${id}`, "name"), text: id.replaceAll("_", " ") }, description: { key: key(`achievement_${id}`, "description"), text: "Survive a particularly unnecessary incident." }, hidden: true, condition: { field: "turn", operator: "greater_or_equal", value: index + 3 } })),
  ] as StoryGraphCampaignSource["achievements"],
};

const TITLE: AuthoredText = { key: "lucifer.campaign.title", text: "Lucifer Chronicles: The Bulgarian Incident" };

export function buildLuciferChroniclesCampaign(source: StoryGraphCampaignSource = luciferChroniclesSource): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = { id: LUCIFER_CHRONICLES_CAMPAIGN_ID, kindId: "story-graph", version: "1.0.0", titleKey: TITLE.key, content };
  return buildCampaign(campaign, [TITLE, ...authoredText]);
}
