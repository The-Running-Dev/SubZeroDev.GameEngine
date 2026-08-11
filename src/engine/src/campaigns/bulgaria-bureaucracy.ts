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
  description: "Municipal, cadastral, archive, notary, and translation routes through one determined folder.",
  duration: "10–15 min per route",
  contentNotice: "Satirical depictions of public offices, administrative failure, and financial frustration.",
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
  description: { key: "bureaucracy.ach.it_builds_character.description", text: "Reach a resolution after the offices have tested every available kind of patience." },
  condition: { field: "ending", operator: "not_equals", value: undefined },
  hidden: false,
};

const config: AdventureConfig = {
  id: BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
  namespace: "bureaucracy",
  title: "The Bureaucracy",
  description: "A municipal casebook through cadastral, tax, registry, archive, notary, and translation offices.",
  startNodeId: "municipality",
  intro: "You arrive at the municipality at 08:03. The office opened at 08:00. A handwritten note says the meeting ends at 11:30; three nearby doors disagree about the year.",
  statLabels: { preparation: "Documents", connections: "Clerk Goodwill", pressure: "Administrative Pressure" },
  routes: [
    {
      id: "registry_route", choiceId: "wait", label: "Wait for the municipal registry", memoryLabel: "the helpful clerk",
      scenes: [
        "A clerk checks your folder and quietly circles the one certificate that will expire first.",
        "The cadastral office recognizes the address but not the building, while the building recognizes neither.",
        "The tax desk needs proof that the property exists before it can explain why it owes tax.",
        "Back at the registry, your folder is thick enough to command professional respect. The final stamp is now a matter of method.",
      ],
      actionLabels: ["Thank the clerk and note the expiry date", "Demand the supervisor immediately", "Copy the clerk's pencilled checklist", "Use the official checklist from 2019", "Order the cadastral sketch first", "Bring the tax receipt you already have", "Ask the tax clerk to call upstairs", "Queue again with a fresh number"],
      eventLabels: ["The pencilled checklist names the only copying shop whose stamp faces the correct direction.", "The official checklist omits a certificate now required by the official who printed it.", "The tax clerk reaches the cadastral desk by phone and both discover a shared cousin.", "Your queue number is called during the twelve seconds you spend reading the display."],
      endings: [
        { id: "document_obtained", title: "Document Obtained", text: "The paper arrives with three seals and no apology. It proves the fact everyone knew before breakfast.", outcome: "win" },
        { id: "miracle", title: "The Administrative Miracle", text: "The clerk remembers your courtesy, finds the missing entry, and performs an act future staff will deny was possible.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "archive_route", choiceId: "ask_guard", label: "Ask the guard for the unofficial route", memoryLabel: "the archive favour",
      scenes: [
        "The guard sends you through civil registry, down one floor, and twenty-seven years backward.",
        "The archive catalog lists your file under a spelling used once by a tired typist in 1987.",
        "A translation office can certify the old spelling if a notary certifies that the new spelling is yours.",
        "The recovered folder reaches a lawyer whose calm costs less than another week of queues and more than lunch.",
      ],
      actionLabels: ["Write down the guard's room numbers", "Treat the directions as folklore", "Search the handwritten archive index", "Pay for a computerized search", "Ask the translator to explain the mismatch", "Visit the notary without calling", "Let the lawyer carry the folder", "Return personally to Room 14"],
      eventLabels: ["The handwritten index contains a cross-reference in immaculate blue ink.", "The database returns nine citizens, two streets, and a livestock permit.", "The translator knows the notary and corrects the appointment before it disappears.", "Room 14 sends you to Room 6; Room 6 has redecorated but remembers the arrangement."],
      endings: [
        { id: "lawyer_solved", title: "Counsel for the Living", text: "The lawyer submits one precise letter. The system, confronted by grammar, yields.", outcome: "win", gate: "memory" },
        { id: "gave_up", title: "The Folder in the Cupboard", text: "You put the folder away. The municipality records no defeat; it merely stops hearing from you.", outcome: "neutral" },
      ],
    },
    {
      id: "supervisor_route", choiceId: "coffee", label: "Get coffee and find the supervisor", memoryLabel: "the supervisor's promise",
      scenes: [
        "At the cafe you meet a deputy supervisor who remembers your case and, more dangerously, promises to look at it.",
        "The civil registry accepts the promise as evidence but the translation office requests it in writing.",
        "A notary reviews the growing stack and asks the only useful question anyone has asked all day.",
        "The supervisor convenes three desks around one computer. Either the case will resolve or the system will finally describe its objection.",
      ],
      actionLabels: ["Let the supervisor finish her coffee", "Lead with the seven-year history", "Request the promise by email", "Quote the promise from memory", "Answer the notary's question honestly", "Add another certificate just in case", "Bring everyone to the same counter", "Submit separate copies to each desk"],
      eventLabels: ["The supervisor writes her direct extension on a napkin, the municipality's most durable medium.", "Your complete chronology triggers a second coffee and no measurable progress.", "The email arrives with a subject line that makes three offices suddenly cooperative.", "The extra certificate contradicts a form nobody had noticed until now."],
      endings: [
        { id: "system_failure", title: "System Failure, Human Success", text: "The registry crashes while everyone is watching. The supervisor signs a paper fallback last used before Wi-Fi.", outcome: "neutral", gate: "memory" },
        { id: "ultimate_reward", title: "The Ultimate Bulgarian Reward", text: "After seven years of paperwork, you receive €300 and twenty-eight years of unresolved legal responsibility.", outcome: "win" },
      ],
    },
  ],
  startAliases: [{ id: "try_another_entrance", label: "Try the archive entrance", routeId: "archive_route" }],
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
