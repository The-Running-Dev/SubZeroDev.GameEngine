import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../portable/format.js";

export const BULGARIA_DRIVING_CAMPAIGN_ID = "bulgaria-driving";

// The catalog card travels with the campaign, not a positional entry in
// site/src/play/composition.ts.
export const bulgariaDrivingCatalog: PortableCatalog = {
  title: "Driving",
  description: "ГТП inspections, mechanics who diagnose by ear, KAT patrols, mountain passes, LPG queues, and one deeply opinionated used car.",
  duration: "10–15 min per route",
  contentNotice: "Dangerous-driving anecdotes, police encounters, breakdowns, mild bribery-adjacent humor, and financial loss.",
  featured: false,
};

export const bulgariaDrivingMigration: PortableMigration = {
  fromVersion: "1.0.0",
  nodeMap: {
    bmw_ownership: "repair_route_4",
    ending_trusting: "ending_trusting_the_mechanic",
    ending_skeptical: "ending_sold_car",
  },
  endingMap: { asked_for_a_second_opinion: "sold_car" },
};

const config: AdventureConfig = {
  id: BULGARIA_DRIVING_CAMPAIGN_ID,
  namespace: "driving",
  title: "Driving",
  description: "Inspection stickers, mechanic trust, police, parking, weather, parts, towing, and one very opinionated car — Bulgaria's national relationship, dramatized.",
  startNodeId: "driving",
  intro: "You pass the ГТП inspection by four minutes and one understanding technician. Five minutes later the dashboard lights up like a name-day table. The mechanic says it was 'already like that,' which is, legally speaking, a diagnosis.",
  statLabels: { preparation: "Car Reliability", connections: "Mechanic Trust", pressure: "Repair Pressure" },
  routes: [
    {
      id: "repair_route", choiceId: "believe_him", label: "Believe him and build a repair plan", memoryLabel: "the mechanic's trust",
      scenes: [
        "The mechanic hands you a handwritten repair order in three parts: brakes first, the mystery noise second, your dignity whenever the parts arrive from Plovdiv.",
        "Insurance and vehicle tax occupy neighbouring windows whose lunch breaks overlap with suspicious, possibly deliberate precision.",
        "A parts dealer locates the exact component in a warehouse described only as 'past the roundabout, ask for Rado'.",
        "The car returns to the lift for the final verdict: restore it properly, keep negotiating with entropy, or admit the project now owns you.",
      ],
      actionLabels: ["Ask the mechanic to prioritize safety", "Approve every repair at once", "Keep the inspection sheet", "Trust the dashboard's temporary silence", "Pay insurance before ordering parts", "Order parts before checking the policy", "Follow the directions to Rado's warehouse", "Buy the almost-identical component instead"],
      eventLabels: ["The inspection sheet proves the warning light appeared after the test — earning an unusually respectful shrug from the inspector.", "The light turns off by itself and buys you six hours of false, blissful peace.", "Rado recognizes the mechanic by voice alone and finds an original part hiding under three dead alternators.", "The almost-identical part fits perfectly, except for the one connector that defines the entire car."],
      endings: [
        { id: "reliable_car", title: "The Reliable Car", text: "It starts in winter, stops on purpose, and asks nothing more dramatic of you than fuel.", outcome: "win", gate: "memory" },
        { id: "endless_repairs", title: "The Perpetual Repair", text: "Every repaired sound reveals a quieter one beneath it. You learn to budget by frequency, like a very small orchestra.", outcome: "neutral" },
        { id: "mechanic_becomes_family", title: "You Are Now Basically Related", text: "The mechanic starts calling you at rakia hour to report on the car unprompted. You are invited to his daughter's wedding. The car, somehow, runs better after.", outcome: "win" },
        { id: "the_part_never_arrives", title: "Still Waiting on the Part From Rado", text: "Rado swears it left the warehouse Tuesday. It is now several Tuesdays later. The car sits under a tarp, technically a project, spiritually a monument.", outcome: "loss" },
        { id: "sold_to_a_tourist", title: "A German Bought It, Somehow", text: "A tourist admires the car's 'character' outside a café in Veliko Tarnovo and pays cash on the spot, no questions, no test drive. You do not correct his optimism.", outcome: "win", gate: "prepared" },
      ],
    },
    {
      id: "road_route", choiceId: "ask_another_opinion", label: "Ask another opinion and test it on the road", memoryLabel: "the police warning",
      scenes: [
        "A second mechanic diagnoses the weather, the fuel quality, and your entire relationship with the accelerator pedal.",
        "Rain turns the mountain pass into a practical exam no licensing office could legally administer, somewhere between Shipka and regret.",
        "Police stop you beside a fuel station where LPG, petrol, and coffee somehow share one single queue.",
        "With the storm behind you, the car feels either proven or forgiven. The distinction matters considerably at the marketplace.",
      ],
      actionLabels: ["Listen to the road-test instructions", "Prove the first mechanic wrong", "Check the forecast and tyres", "Trust the summer tyres' confidence", "Keep the officer's written warning", "Debate the meaning of the road sign", "Refuel before the pass", "Follow the cheaper LPG sign"],
      eventLabels: ["The road test reveals a loose heat shield — a cheap, almost emotionally disappointing answer to six months of dread.", "A pothole silences the original noise and, generously, introduces two new ones.", "The officer notices the inspection receipt, softens considerably, and recommends a safer route down.", "The cheaper LPG station is open, but its card terminal is 'participating remotely' today — cash only, which means the ATM two villages back."],
      endings: [
        { id: "sold_car", title: "Sold Before Sunset", text: "You describe every fault honestly. The buyer calls them character and transfers the money anyway.", outcome: "neutral" },
        { id: "collector_item", title: "The Accidental Collector", text: "The police warning turns out to confirm the model's rare specification. What was merely old becomes collectible overnight.", outcome: "win", gate: "memory" },
        { id: "car_becomes_local_legend", title: "The Pass Remembers You", text: "Word of the storm crossing spreads through every roadside kafene between here and Kazanlak. Strangers now recognize the car before they recognize you.", outcome: "win" },
        { id: "impounded_at_the_border", title: "Detained at Kapitan Andreevo", text: "A customs officer takes one long look at the paperwork, one longer look at the car, and directs you to a special lane reserved for cars with 'interesting histories.' You miss the ferry, the meeting, and most of your optimism.", outcome: "loss" },
        { id: "became_a_taxi", title: "A Second Career, Unlicensed", text: "A neighbour offers good money for occasional airport runs. Within a month the car has a fixed rate, a regular clientele, and opinions about which terminal is faster.", outcome: "neutral", gate: "prepared" },
      ],
    },
    {
      id: "escape_route", choiceId: "ignore_warning", label: "Ignore the warning and plan an exit", memoryLabel: "the tow driver's card",
      scenes: [
        "A parking space narrows around the car while five neighbours direct you from five entirely incompatible angles.",
        "The warning light becomes a warning noise halfway to the market, and a warning smell somewhere near the ring road.",
        "A tow truck arrives with the unhurried calm of a driver who has met this exact car before.",
        "At the yard, the insurer, a marketplace buyer, and a scrap dealer offer three sincerely different definitions of value.",
      ],
      actionLabels: ["Accept the neighbour's careful signals", "Mount the kerb decisively", "Save the parking receipt", "Leave before anyone writes a note", "Take the tow driver's card", "Call the insurer first", "Ask for one last repair estimate", "List the car as a project"],
      eventLabels: ["The receipt proves the bay was legal yesterday, which turns out to be the strongest form of legality this street recognizes.", "A mirror acquires a neat scar, and the neighbour acquires a complete, unshakeable theory about how.", "The tow driver knows an insurance assessor who answers on the very first ring — a small miracle nobody mentions twice.", "The online listing receives nineteen offers, all of them opening with 'final price?'"],
      endings: [
        { id: "abandoned_project", title: "The Abandoned Project", text: "You hand over the keys and walk home lighter than you have felt in months.", outcome: "loss" },
        { id: "trusting_the_mechanic", title: "Trust the Hammer", text: "Your original mechanic buys the project, fixes it with one decisive strike of something, and refuses to explain what.", outcome: "neutral", gate: "memory" },
        { id: "insurance_fraud_temptation", title: "The Offer You Didn't Take, Mostly", text: "A man at the yard suggests, quietly, that the car could 'have an accident' somewhere more profitable. You decline. The car, offended on principle, breaks down anyway, for free, out of spite.", outcome: "loss" },
        { id: "scrapped_for_parts", title: "Distributed Among the Living", text: "The scrap dealer takes it apart with visible respect. Within a year you spot its wing mirror on a taxi, its seats in a garage sofa, and its horn, unmistakably, on a tractor.", outcome: "neutral" },
        { id: "one_more_repair_actually_works", title: "The Hammer, Reconsidered", text: "Against every piece of advice you gave yourself, you approve one final repair. It works. It simply, quietly works, and you drive home wondering what exactly you learned from any of this.", outcome: "win", gate: "prepared" },
      ],
    },
  ],
  startAliases: [{ id: "turn_up_music", label: "Turn up the music and head for the road", routeId: "road_route" }],
};

export const bulgariaDrivingSource = createAdventureSource(config);

export function buildBulgariaDrivingCampaign(source: StoryGraphCampaignSource = bulgariaDrivingSource): CommandResult<BuiltCampaign> {
  const result = buildAdventureCampaign(config, source);
  if (result.ok && result.value) {
    result.value.campaign.migrateState = (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {
      bmw_ownership: "repair_route_4",
      ending_trusting: "ending_trusting_the_mechanic",
      ending_skeptical: "ending_sold_car",
    }, { asked_for_a_second_opinion: "sold_car" });
  }
  return result;
}
