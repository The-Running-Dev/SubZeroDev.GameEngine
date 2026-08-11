import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../portable/format.js";

export const BULGARIA_RETURN_CAMPAIGN_ID = "bulgaria-return";

// The catalog card travels with the campaign, not a positional entry in
// site/src/play/composition.ts.
export const bulgariaReturnCatalog: PortableCatalog = {
  title: "The Return",
  description: "Return to Bulgaria through city, village, or temporary-home routes.",
  duration: "8–12 min per route",
  contentNotice: "Themes of migration, family pressure, housing, and homesickness.",
  featured: false,
};

export const bulgariaReturnMigration: PortableMigration = {
  fromVersion: "1.0.0",
  nodeMap: { home_again: "ending_home_again" },
};

const config: AdventureConfig = {
  id: BULGARIA_RETURN_CAMPAIGN_ID,
  namespace: "return",
  title: "Return",
  description: "A homecoming in three acts: arrival, reality, and the difficult art of settling.",
  startNodeId: "expat_returns",
  intro: "After years abroad, you land in Sofia with two suitcases and a theory that coming home will be simpler than leaving. Customs, family, and the airport taxi rank have prepared counterarguments.",
  statLabels: { preparation: "Local Knowledge", connections: "Old Connections", pressure: "Homesickness" },
  routes: [
    {
      id: "city_return", choiceId: "smile", label: "Smile and try the city again", memoryLabel: "the city welcome",
      scenes: [
        "The customs officer studies the espresso machine in your luggage as if it has requested citizenship.",
        "Your first landlord quotes rent in euros and nostalgia in leva. The apartment has a view of three parking disputes.",
        "An old colleague offers introductions, warnings, and a desk that becomes available whenever its owner moves the printer.",
        "A month later the city no longer feels foreign, which is not the same thing as feeling easy. You decide what returning will mean.",
      ],
      actionLabels: ["Answer every question without performing expatriate expertise", "Explain how customs works elsewhere", "Keep the stamped luggage slip", "Accept the officer's improvised declaration", "Call the landlord before viewing", "Trust the photographs", "Meet the old colleague for coffee", "Follow a cheaper-flat lead"],
      eventLabels: ["The luggage slip gets you through a second inspection in twelve seconds.", "A shift change starts the entire conversation again, now with chairs.", "Your colleague remembers the one clerk who still answers email.", "The cheaper flat is real; the bathroom is an interpretive proposal."],
      endings: [
        { id: "optimistic_return", title: "The Returner", text: "You build a life from old streets and new boundaries. Home becomes a verb again.", outcome: "win" },
        { id: "city_with_open_eyes", title: "The Sceptical Returner", text: "You stay without pretending the city is perfect or that abroad ever was.", outcome: "neutral", gate: "memory" },
      ],
    },
    {
      id: "village_return", choiceId: "explain", label: "Explain nothing; take the village road", memoryLabel: "the neighbour's map",
      scenes: [
        "The village house is beautiful from the road and urgently educational from inside. A neighbour arrives before the electricity does.",
        "The well works, the roof mostly works, and four relatives disagree about which wall technically belongs to whom.",
        "You trade a day of clearing weeds for a hand-drawn map of pipes, boundaries, and grudges.",
        "Winter makes the village honest. The quiet is generous; the distance to everything is not.",
      ],
      actionLabels: ["Listen to the neighbour's full history", "Start repairs before anyone can advise you", "Photograph the map", "Follow the pipe that sounds least theoretical", "Check the deeds before the roof", "Buy tiles and hope", "Ask who has the tractor", "Wait for the mobile shop"],
      eventLabels: ["The map reveals a stopcock hidden beneath a plum tree and two decades of leaves.", "The first pipe you touch introduces itself by flooding the pantry.", "The tractor owner arrives with rope, coffee, and no interest in payment.", "The mobile shop skips Tuesday because Tuesday has become Wednesday locally."],
      endings: [
        { id: "settled_in_the_village", title: "A Light in the Village", text: "You stay. The roof holds, the neighbours knock, and the silence finally includes you.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "temporary_return", choiceId: "laugh", label: "Laugh and book a room for one more week", memoryLabel: "the hotel ledger",
      scenes: [
        "The hotel receptionist recognizes your accent, upgrades your opinion, and asks when you are leaving again.",
        "Family lunches expand to occupy every decision you postponed while abroad.",
        "A return ticket sits in your inbox while an aunt quietly leaves an apartment key beside your coffee.",
        "The final morning arrives without resolving whether departure is failure, wisdom, or simply another route home.",
      ],
      actionLabels: ["Ask the receptionist what changed", "Keep the booking strictly temporary", "Write down the family promises", "Let lunch decide the afternoon", "Inspect the apartment key", "Open the airline app instead", "Walk the neighbourhood at dawn", "Take one last airport taxi"],
      eventLabels: ["The old hotel ledger still carries your family's name from a wedding in 1986.", "A conference fills the hotel and relocates you to a room above the kitchen.", "The apartment is small, sunny, and legally entangled only in ordinary ways.", "The taxi driver gives a complete economic forecast before the ring road."],
      endings: [
        { id: "exhausted_departure", title: "The Open Return Ticket", text: "You leave exhausted, keeping the key. Some decisions need distance before they become answers.", outcome: "neutral" },
        { id: "home_again", title: "Home Again", text: "The questions become routine, the advice ambient, and the mechanic recommendation useful. You stay.", outcome: "win", gate: "memory" },
      ],
    },
  ],
  startAliases: [{ id: "accept_destiny", label: "Accept your destiny and stay in the city", routeId: "city_return" }],
};

export const bulgariaReturnSource = createAdventureSource(config);

export function buildBulgariaReturnCampaign(source: StoryGraphCampaignSource = bulgariaReturnSource): CommandResult<BuiltCampaign> {
  const result = buildAdventureCampaign(config, source);
  if (result.ok && result.value) {
    result.value.campaign.migrateState = (state, fromVersion) => migrateV1AdventureState(
      state,
      fromVersion,
      source,
      { home_again: "ending_home_again" },
    );
  }
  return result;
}
