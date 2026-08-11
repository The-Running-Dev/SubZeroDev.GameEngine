import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../portable/format.js";

export const BULGARIA_BUREAUCRACY_CAMPAIGN_ID = "bulgaria-bureaucracy";

// The catalog card travels with the campaign, not a positional entry in
// site/src/play/composition.ts.
export const bulgariaBureaucracyCatalog: PortableCatalog = {
  title: "The Bureaucracy",
  description: "Municipal, cadastral, archive, notary, and translation routes through one determined folder — now with more offices, more stamps, and considerably more ways to lose an afternoon.",
  duration: "10–15 min per route",
  contentNotice: "Satirical depictions of public offices, administrative failure, bribery-adjacent humor, and financial frustration.",
  featured: false,
};

const bulgariaBureaucracyMigration: PortableMigration = {
  fromVersion: "1.0.0",
  nodeMap: {
    clerk_review: "registry_route_event_1",
    expired: "registry_route_1",
    room_14: "registry_route_event_2",
    room_6: "registry_route_3",
    reward: "ending_ultimate_reward",
  },
};
export { bulgariaBureaucracyMigration };

const retainedAchievement: StoryGraphCampaignSource["achievements"][number] = {
  id: "it_builds_character",
  name: { key: "bureaucracy.ach.it_builds_character.name", text: "It Builds Character" },
  description: { key: "bureaucracy.ach.it_builds_character.description", text: "Reach any resolution after the offices have tested every available kind of patience — and a few kinds you didn't know you had." },
  condition: { field: "ending", operator: "not_equals", value: undefined },
  hidden: false,
};

const config: AdventureConfig = {
  id: BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
  namespace: "bureaucracy",
  title: "The Bureaucracy",
  description: "A municipal casebook through cadastral, tax, registry, archive, notary, and translation offices — and, on a bad day, one very confused European Commission auditor.",
  startNodeId: "municipality",
  intro: "You arrive at the municipality at 08:03. The office opened at 08:00. A handwritten note taped to the glass says the working day ends at 11:30 'for technical reasons'; three nearby doors disagree about which year it currently is.",
  statLabels: { preparation: "Documents", connections: "Clerk Goodwill", pressure: "Administrative Pressure" },
  routes: [
    {
      id: "registry_route", choiceId: "wait", label: "Wait for the municipal registry", memoryLabel: "the helpful clerk",
      scenes: [
        "A clerk unfolds your file like a fortune teller and circles, in red, the one certificate that expires the day after tomorrow — the only day it could possibly have mattered.",
        "The cadastral office recognizes the address. The tax office recognizes the building. Neither recognizes the other's right to exist, and both would like this in writing.",
        "The tax desk needs proof the property exists before it can explain why it owes tax on existing. The proof, naturally, is held one floor up, by an office currently at lunch.",
        "Back at the registry, your folder has grown thick enough to command professional respect. The final stamp is now purely a matter of locating whoever still has the stamp.",
      ],
      actionLabels: ["Thank the clerk and note the expiry date", "Demand the supervisor immediately", "Copy the clerk's pencilled checklist", "Use the official checklist from 2019", "Order the cadastral sketch first", "Bring the tax receipt you already have", "Ask the tax clerk to call upstairs", "Queue again with a fresh number"],
      eventLabels: ["The pencilled checklist names the one copying shop across the street whose stamp faces the correct direction — everyone knows it, nobody explains it.", "The official checklist omits a certificate the official who printed it now requires in person.", "The tax clerk reaches the cadastral desk by phone and both discover a shared cousin in Sliven.", "Your number is called during the twelve seconds you spend reading the display board instead of watching it."],
      endings: [
        { id: "document_obtained", title: "Document Obtained", text: "The paper arrives with three seals and no apology. It proves the fact everyone already knew before breakfast.", outcome: "win" },
        { id: "miracle", title: "The Administrative Miracle", text: "The clerk remembers your courtesy, finds the missing entry, and performs an act future staff will swear was never possible.", outcome: "win", gate: "memory" },
        { id: "incoming_number_only", title: "A Number, Not a Document", text: "What you receive is an входящ номер — official proof that you asked. It is not the document. It is, several colleagues assure you, 'basically the same thing,' and after seven months you have started to believe them.", outcome: "neutral" },
        { id: "hired_a_professional_queuer", title: "Bay Ivan Queues For You", text: "A retired railway conductor named bay Ivan offers to hold your place for a small daily fee and a standing invitation to your name day. He is better at this than you ever were, has been since 1987, and retires you from the whole process.", outcome: "win", gate: "prepared" },
        { id: "reorganized_into_nonexistence", title: "Absorbed Into a New Ministry", text: "Midway through your fourth visit, the office is merged into a newly created Agency for Something Adjacent. Your folder is 'in transition' — a phrase that, you slowly learn, means forever.", outcome: "loss" },
      ],
    },
    {
      id: "archive_route", choiceId: "ask_guard", label: "Ask the guard for the unofficial route", memoryLabel: "the archive favour",
      scenes: [
        "The guard sends you through civil registry, down one floor, and twenty-seven years backward, past a door numbered in a system that predates the euro, the lev redenomination, and possibly the guard.",
        "The archive catalog lists your file under a spelling used exactly once, by a tired typist in 1987, who could not have known she was creating a legal identity.",
        "A translation office can certify the old spelling if a notary certifies that the new spelling is yours — a notary who, coincidentally, is the translator's brother-in-law.",
        "The recovered folder reaches a lawyer whose calm costs less than another week of queues and considerably more than lunch.",
      ],
      actionLabels: ["Write down the guard's room numbers", "Treat the directions as folklore", "Search the handwritten archive index", "Pay for a computerized search", "Ask the translator to explain the mismatch", "Visit the notary without calling ahead", "Let the lawyer carry the folder", "Return personally to Room 14"],
      eventLabels: ["The handwritten index contains a cross-reference in immaculate blue ink, written by someone who clearly loved this job in a way nobody has since.", "The database returns nine citizens, two streets, and a livestock permit — none of them relevant, all of them printed anyway.", "The translator turns out to know the notary personally and reschedules the appointment before it can disappear a second time.", "Room 14 sends you to Room 6. Room 6 has been repainted, renumbered, and relocated, but the woman behind the desk still remembers the arrangement."],
      endings: [
        { id: "lawyer_solved", title: "Counsel for the Living", text: "The lawyer submits one precise letter. The system, confronted at last with grammar, yields.", outcome: "win", gate: "memory" },
        { id: "gave_up", title: "The Folder in the Cupboard", text: "You put the folder away. The municipality records no defeat; it simply stops hearing from you, which it appears to consider a form of resolution.", outcome: "neutral" },
        { id: "bribed_with_coffee", title: "A Small Coffee, Understood Correctly", text: "You offer to 'buy the clerk a coffee.' Everyone involved understands this is not about coffee. An envelope changes hands beneath a folder, the folder changes hands above the desk, and the file that took two years to lose takes four minutes to find.", outcome: "win" },
        { id: "archive_reveals_second_family", title: "A Discovery Nobody Requested", text: "The old spelling in your file belongs to a second household your great-grandfather apparently maintained two villages over. The archivist finds this considerably more interesting than your paperwork and insists on discussing it at length.", outcome: "neutral" },
        { id: "became_the_archives_hero", title: "The Index You Fixed", text: "You cross-reference the misfiled spelling so thoroughly that the archivist adopts your correction as the new official entry. Your name enters the municipal record twice: once as a citizen, once as a footnote.", outcome: "win", gate: "prepared" },
      ],
    },
    {
      id: "supervisor_route", choiceId: "coffee", label: "Get coffee and find the supervisor", memoryLabel: "the supervisor's promise",
      scenes: [
        "At the café next door you meet a deputy supervisor who remembers your case and, more dangerously, promises to look at it personally.",
        "The civil registry accepts the promise as evidence; the translation office would prefer it in writing, ideally with a second, unrelated stamp.",
        "A notary reviews the growing stack of paper and asks the only genuinely useful question anyone has asked you all day.",
        "The supervisor convenes three desks around one shared computer. Either the case resolves, or the system finally, publicly describes what it actually objects to.",
      ],
      actionLabels: ["Let the supervisor finish her coffee", "Lead with the seven-year history", "Request the promise by email", "Quote the promise from memory", "Answer the notary's question honestly", "Add another certificate just in case", "Bring everyone to the same counter", "Submit separate copies to each desk"],
      eventLabels: ["The supervisor writes her direct extension on a napkin — the municipality's most durable and least searchable medium.", "Your complete seven-year chronology earns a second coffee, sincere sympathy, and no measurable progress whatsoever.", "The email arrives with a subject line so alarming that three offices become cooperative within the hour.", "The extra certificate, added purely for safety, contradicts a form nobody had actually read until just now."],
      endings: [
        { id: "system_failure", title: "System Failure, Human Success", text: "The registry crashes while everyone is watching. The supervisor signs a paper fallback last used before Wi-Fi existed in this building.", outcome: "neutral", gate: "memory" },
        { id: "ultimate_reward", title: "The Ultimate Bulgarian Reward", text: "After seven years of paperwork, you receive €300 and twenty-eight years of unresolved legal responsibility. Somewhere, this counts as closure.", outcome: "win" },
        { id: "supervisor_adopts_your_case_personally", title: "You Become a Personal Project", text: "The supervisor takes a genuine, slightly alarming interest in your file, phones three colleagues by first name, and resolves in one afternoon what four departments failed to resolve in four years. You never learn why. You do not ask.", outcome: "win" },
        { id: "promoted_to_the_committee", title: "A Seat on the Working Group", text: "Impressed by how thoroughly you understand your own case, the municipality invites you to join an informal working group on 'process improvement.' You accept, mostly to make sure this happens to someone else next time.", outcome: "win", gate: "prepared" },
        { id: "the_case_outlives_the_supervisor", title: "Reassigned, Indefinitely", text: "The supervisor is transferred to a different department before signing anything. Her successor asks you to start again from Room 1 — this time with a folder thick enough to be taken seriously on its own.", outcome: "loss" },
      ],
    },
  ],
  startAliases: [{ id: "try_another_entrance", label: "Try the archive entrance instead", routeId: "archive_route" }],
  retainedAchievements: [retainedAchievement],
};

export const bulgariaBureaucracySource = createAdventureSource(config);

export function buildBulgariaBureaucracyCampaign(source: StoryGraphCampaignSource = bulgariaBureaucracySource): CommandResult<BuiltCampaign> {
  const result = buildAdventureCampaign(config, source);
  if (result.ok && result.value) {
    result.value.campaign.migrateState = (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {
      clerk_review: "registry_route_event_1",
      expired: "registry_route_1",
      room_14: "registry_route_event_2",
      room_6: "registry_route_3",
      reward: "ending_ultimate_reward",
    });
  }
  return result;
}
