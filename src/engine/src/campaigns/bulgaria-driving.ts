import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";

export const BULGARIA_DRIVING_CAMPAIGN_ID = "bulgaria-driving";

const config: AdventureConfig = {
  id: BULGARIA_DRIVING_CAMPAIGN_ID,
  namespace: "driving",
  title: "Driving",
  description: "Inspection stickers, mechanic trust, police, parking, weather, parts, towing, and one very opinionated car.",
  startNodeId: "driving",
  intro: "You pass the annual inspection. Five minutes later the dashboard lights up like a Christmas tree. The mechanic says it was already like that, which is technically a diagnosis.",
  statLabels: { preparation: "Car Reliability", connections: "Mechanic Trust", pressure: "Repair Pressure" },
  routes: [
    {
      id: "repair_route", choiceId: "believe_him", label: "Believe him and build a repair plan", memoryLabel: "the mechanic's trust",
      scenes: [
        "The mechanic offers a handwritten repair order: brakes first, mystery noise second, dignity when parts arrive.",
        "Insurance and vehicle tax occupy neighbouring windows whose lunch breaks overlap with mathematical precision.",
        "A parts seller finds the exact component in a warehouse described only as 'after the roundabout'.",
        "The car returns to the lift for the final decision: restore it properly, keep negotiating with entropy, or admit the project owns you.",
      ],
      actionLabels: ["Ask the mechanic to prioritize safety", "Approve every repair at once", "Keep the inspection sheet", "Trust the dashboard's temporary silence", "Pay insurance before ordering parts", "Order parts before checking the policy", "Follow the warehouse directions", "Buy the almost-identical component"],
      eventLabels: ["The inspection sheet proves the warning light appeared after the test, earning an unusually respectful shrug.", "The light turns off by itself and creates six hours of false peace.", "The warehouse owner recognizes the mechanic and finds an original part under three alternators.", "The almost-identical part fits perfectly except for the part where it connects."],
      endings: [
        { id: "reliable_car", title: "The Reliable Car", text: "It starts in winter, stops on purpose, and asks nothing more dramatic than fuel.", outcome: "win", gate: "memory" },
        { id: "endless_repairs", title: "The Perpetual Repair", text: "Every repaired sound reveals a quieter one beneath it. You learn to budget by frequency.", outcome: "neutral" },
      ],
    },
    {
      id: "road_route", choiceId: "ask_another_opinion", label: "Ask another opinion and test it on the road", memoryLabel: "the police warning",
      scenes: [
        "A second mechanic diagnoses the weather, the fuel, and your relationship with the accelerator.",
        "Rain turns the mountain road into a practical examination no licensing office could legally administer.",
        "Police stop you beside a fuel station where LPG, petrol, and coffee share one queue.",
        "With the storm behind you, the car feels either proven or forgiven. The distinction matters at the marketplace.",
      ],
      actionLabels: ["Listen to the road-test instructions", "Prove the first mechanic wrong", "Check the forecast and tyres", "Trust the summer tyres' confidence", "Keep the officer's written warning", "Debate the meaning of the road sign", "Refuel before the pass", "Follow the cheaper LPG sign"],
      eventLabels: ["The road test reveals a loose heat shield, a cheap and almost emotionally disappointing answer.", "A pothole silences the original noise and introduces two apprentices.", "The officer notices the inspection receipt and recommends a safer descent.", "The cheap LPG station is open, but its card terminal is participating remotely."],
      endings: [
        { id: "sold_car", title: "Sold Before Sunset", text: "You describe every fault honestly. The buyer calls them character and transfers the money.", outcome: "neutral" },
        { id: "collector_item", title: "The Accidental Collector", text: "The police warning proves the model's rare specification. What was old becomes collectable overnight.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "escape_route", choiceId: "ignore_warning", label: "Ignore the warning and plan an exit", memoryLabel: "the tow driver's card",
      scenes: [
        "A parking space narrows around the car while neighbours direct from five incompatible angles.",
        "The warning light becomes a warning noise halfway to the marketplace and a warning smell near the ring road.",
        "A tow driver arrives with the calm of someone who has met this car before.",
        "At the yard, insurer, marketplace buyer, and scrap dealer offer three definitions of value.",
      ],
      actionLabels: ["Accept the neighbour's careful signals", "Mount the kerb decisively", "Save the parking receipt", "Leave before anyone writes a note", "Take the tow driver's card", "Call the insurer first", "Ask for one last repair estimate", "List the car as a project"],
      eventLabels: ["The receipt proves the bay was legal yesterday, which is the strongest available form of legality.", "A mirror acquires a neat scar and the neighbour acquires a complete theory.", "The tow driver knows an insurer assessor who answers on the first ring.", "The online listing receives nineteen offers, all beginning with 'final price?'"],
      endings: [
        { id: "abandoned_project", title: "The Abandoned Project", text: "You hand over the keys and walk home lighter than you have in months.", outcome: "loss" },
        { id: "trusting_the_mechanic", title: "Trust the Hammer", text: "Your original mechanic buys the project, fixes it with one strike, and refuses to explain.", outcome: "neutral", gate: "memory" },
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
