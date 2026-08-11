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
  description: "Return to Bulgaria through the city, the village, or a very extended hotel stay.",
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
  description: "A homecoming in three acts: arrival, reality, and the difficult art of actually staying.",
  startNodeId: "expat_returns",
  intro: "After years abroad, you land at Sofia Airport with two suitcases and a theory that coming home will be simpler than leaving was. Customs, family, and the taxi rank outside have all prepared counterarguments.",
  statLabels: { preparation: "Local Knowledge", connections: "Old Connections", pressure: "Homesickness" },
  routes: [
    {
      id: "city_return", choiceId: "smile", label: "Smile and try the city again", memoryLabel: "the city welcome",
      scenes: [
        "The customs officer studies the espresso machine in your luggage as though it has personally applied for citizenship.",
        "Your first landlord quotes the rent in euros and the nostalgia in leva. The apartment has a view of three separate parking disputes.",
        "An old colleague offers introductions, quiet warnings, and a desk that becomes available the moment its current owner finally moves the printer.",
        "A month later the city no longer feels foreign, which is not remotely the same thing as feeling easy. You decide what returning is actually going to mean.",
      ],
      actionLabels: ["Answer every question without performing expat expertise", "Explain how customs works 'where you were'", "Keep the stamped luggage slip", "Accept the officer's improvised declaration", "Call the landlord before viewing", "Trust the photographs", "Meet the old colleague for coffee", "Follow a cheaper-flat lead"],
      eventLabels: ["The luggage slip gets you through a second inspection in twelve flat seconds.", "A shift change restarts the entire conversation, now with chairs and considerably less patience.", "Your colleague remembers the one clerk in the whole building who still answers email.", "The cheaper flat is real; the bathroom is best described as an interpretive proposal."],
      endings: [
        { id: "optimistic_return", title: "The Returner", text: "You build a life from old streets and new boundaries. Home becomes a verb again, slowly, on its own schedule.", outcome: "win" },
        { id: "city_with_open_eyes", title: "The Sceptical Returner", text: "You stay without pretending the city is perfect, or that abroad ever quite was either.", outcome: "neutral", gate: "memory" },
        { id: "reverse_culture_shock_wins", title: "You Book the Return Flight", text: "Six months in, you realize you miss the queue discipline, the weather complaints, and, inexplicably, the customer service. You book a one-way ticket back and tell everyone it's temporary.", outcome: "loss" },
        { id: "becomes_the_local_expert", title: "The One Who Actually Knows How Things Work", text: "Word spreads that you can navigate both worlds. Friends start forwarding you their parents' paperwork, their cousins' visa questions, their own confused feelings about leaving. You become, unofficially, the neighbourhood's foreign office.", outcome: "win", gate: "prepared" },
        { id: "opens_a_business_out_of_spite", title: "Out of Sheer Stubbornness", text: "Tired of explaining why 'it's just different abroad,' you open a small business built entirely on doing one thing properly. It survives, mostly on the reputation of being the one place in the neighbourhood that answers the phone.", outcome: "neutral" },
      ],
    },
    {
      id: "village_return", choiceId: "explain", label: "Explain nothing; take the village road", memoryLabel: "the neighbour's map",
      scenes: [
        "The village house is beautiful from the road and urgently educational from inside. A neighbour arrives before the electricity does, carrying opinions and a flashlight.",
        "The well works, the roof mostly works, and four relatives disagree, at volume, about which wall technically belongs to whom.",
        "You trade a full day of clearing weeds for a hand-drawn map of pipes, boundaries, and several decades of grudges.",
        "Winter makes the village honest. The quiet is generous; the distance to literally everything is not.",
      ],
      actionLabels: ["Listen to the neighbour's full history", "Start repairs before anyone can advise you", "Photograph the map", "Follow the pipe that sounds least theoretical", "Check the deeds before the roof", "Buy tiles and hope", "Ask who has the tractor", "Wait for the mobile shop"],
      eventLabels: ["The map reveals a stopcock hidden beneath a plum tree under two decades of leaves.", "The first pipe you touch introduces itself by flooding the pantry with real enthusiasm.", "The tractor owner arrives with rope, coffee, and absolutely no interest in payment.", "The mobile shop skips Tuesday, because locally, Tuesday has quietly become Wednesday."],
      endings: [
        { id: "settled_in_the_village", title: "A Light in the Village", text: "You stay. The roof holds, the neighbours knock, and the silence finally includes you.", outcome: "win", gate: "memory" },
        { id: "rakia_diplomacy", title: "Settled Over Rakia", text: "A boundary dispute that has run for three generations ends over a bottle of the neighbour's homemade rakia and a hand-drawn map, redrawn this time by consensus.", outcome: "win" },
        { id: "village_adopts_you_as_project", title: "The Whole Village Renovates Your Roof", text: "Word gets around that you're 'the one who came back.' Within a week, half the village has an opinion about your roof and a third of them show up to fix it, unasked, for lunch and gossip.", outcome: "win", gate: "prepared" },
        { id: "winter_defeats_you", title: "One Winter Was Enough", text: "The wood runs out in February, the road ices over, and the nearest working shop is forty minutes away with chains on the tyres. You leave before spring, quietly, and don't quite explain why.", outcome: "loss" },
        { id: "becomes_the_new_elder", title: "The Person Who Actually Answers Questions Now", text: "Somewhere between fixing the well and mediating the fence dispute, you become the person the village calls first. Nobody voted on this. It happened anyway.", outcome: "win" },
      ],
    },
    {
      id: "temporary_return", choiceId: "laugh", label: "Laugh and book a room for one more week", memoryLabel: "the hotel ledger",
      scenes: [
        "The hotel receptionist recognizes your accent, silently upgrades her opinion of you, and asks — not unkindly — when exactly you're leaving again.",
        "Family lunches expand to occupy every decision you had quietly postponed while abroad.",
        "A return ticket sits open in your inbox while an aunt calmly leaves a spare apartment key beside your coffee, saying nothing.",
        "The final morning arrives without resolving whether departure is failure, wisdom, or simply one more route home.",
      ],
      actionLabels: ["Ask the receptionist what changed", "Keep the booking strictly temporary", "Write down the family promises", "Let lunch decide the afternoon", "Inspect the apartment key", "Open the airline app instead", "Walk the neighbourhood at dawn", "Take one last airport taxi"],
      eventLabels: ["The old hotel ledger still carries your family's name, from a wedding in 1986.", "A conference fills the hotel and quietly relocates you to a room above the kitchen.", "The apartment is small, sunny, and legally entangled only in the ordinary, survivable ways.", "The taxi driver delivers a complete economic forecast before you even reach the ring road."],
      endings: [
        { id: "exhausted_departure", title: "The Open Return Ticket", text: "You leave exhausted, keeping the key anyway. Some decisions need distance before they become answers.", outcome: "neutral" },
        { id: "home_again", title: "Home Again", text: "The questions become routine, the advice ambient, and even the mechanic's recommendation useful. You stay.", outcome: "win", gate: "memory" },
        { id: "married_into_staying", title: "An Aunt's Plan, Executed Flawlessly", text: "The 'coffee with a family friend' your aunt arranged turns out to be exactly what it looked like. You are still slightly annoyed about the manipulation. You are also, undeniably, staying.", outcome: "win" },
        { id: "the_key_gets_lost", title: "The Apartment You Never Quite Took", text: "You misplace the key somewhere between two airports and three time zones. Nobody mentions it again, which somehow feels worse than if they had.", outcome: "loss" },
        { id: "commutes_between_two_lives", title: "A Life With Two Departure Boards", text: "You never fully choose. Flights get booked, the hotel keeps a room ready, and eventually the receptionist stops asking when you're leaving — she just asks which terminal.", outcome: "neutral", gate: "prepared" },
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
