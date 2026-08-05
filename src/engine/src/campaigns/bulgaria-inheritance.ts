import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";

export const BULGARIA_INHERITANCE_CAMPAIGN_ID = "bulgaria-inheritance";

const config: AdventureConfig = {
  id: BULGARIA_INHERITANCE_CAMPAIGN_ID,
  namespace: "inheritance",
  title: "Inheritance",
  description: "A village property dispute across evidence, neighbours, police, lawyers, court, settlement, and aftermath.",
  startNodeId: "property_inheritance",
  intro: "Your aunt says she owns the entire property because she has maintained the tomatoes since 1998. The news arrives with one missing deed and five confident relatives.",
  statLabels: { preparation: "Evidence", connections: "Family Support", pressure: "Family Tension" },
  routes: [
    {
      id: "records_route", choiceId: "request_records", label: "Find the old documents", memoryLabel: "the archivist's note",
      scenes: [
        "The cadastral archive holds three plans: old, older, and the one everyone cites but nobody can unfold.",
        "A lost deed surfaces in a municipal index under your grandfather's second spelling.",
        "The lawyer compares signatures while the family compares memories, neither exercise producing silence.",
        "In court, evidence and folklore finally occupy separate tables. You decide how hard a legal victory should land.",
      ],
      actionLabels: ["Let the archivist explain the annotations", "Photograph everything before lunch", "Keep the index reference", "Commission a new survey immediately", "Build a dated evidence folder", "Lead with the oldest deed", "Ask the lawyer for settlement terms", "Prepare every witness for court"],
      eventLabels: ["The archivist recognizes a notation that links the missing deed to the correct parcel.", "Your photographs include the wrong village's map, beautifully and uselessly.", "The surveyor finds the old boundary stone beneath a raspberry bush.", "A witness cancels, then sends a voice message longer than the hearing."],
      endings: [
        { id: "court_victory", title: "The Court Record", text: "The judgment settles ownership in twelve pages. Nobody reads the same emotional result.", outcome: "win" },
        { id: "family_peace", title: "The Table After Court", text: "You use the archivist's note to offer dignity with the facts. Lunch becomes possible again.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "neighbour_route", choiceId: "call_mother", label: "Ask family and neighbours what happened", memoryLabel: "the neighbour's testimony",
      scenes: [
        "Your mother supplies names, dates, and a detailed account of who failed to bring salad in 1994.",
        "The oldest neighbour remembers the boundary before the fence and the agreement before the argument.",
        "A village meeting turns testimony into negotiation while coffee keeps everyone technically seated.",
        "The family can now settle, trade shares, or preserve the dispute as its most durable tradition.",
      ],
      actionLabels: ["Write down the useful dates", "Let the 1994 story run its course", "Record the neighbour's boundary account", "Measure the fence before listening", "Invite every co-owner to mediation", "Negotiate with the calmest branch first", "Draft a shared-use agreement", "Offer to buy the smallest shares"],
      eventLabels: ["A forgotten photograph dates the old fence and includes everyone smiling beside it.", "The story expands to include a christening and loses the parcel entirely.", "Two co-owners arrive ready to settle because the bus home leaves at four.", "A cousin arrives late with a secret agreement written on hotel stationery."],
      endings: [
        { id: "settlement", title: "The Village Settlement", text: "The signatures do not create affection, but they create a boundary everyone can live beside.", outcome: "win", gate: "memory" },
        { id: "buyout", title: "One Owner, Five Receipts", text: "You buy the remaining shares and inherit the roof, the tomatoes, and all future advice.", outcome: "neutral" },
      ],
    },
    {
      id: "police_route", choiceId: "cut_padlock", label: "Cut the padlock and force the issue", memoryLabel: "the police report",
      scenes: [
        "The new padlock yields immediately. The family WhatsApp group achieves operational readiness seconds later.",
        "Police record the fence, the lock, the missing deeds, and six mutually exclusive versions of a Tuesday.",
        "Property condition becomes evidence: broken windows, repaired roof, cultivated tomatoes, and one room nobody claims.",
        "The report prevents invention but not anger. You must choose whether the house is worth the war it now documents.",
      ],
      actionLabels: ["Call police before entering", "Enter and explain later", "Keep the report number", "Argue that family matters need no report", "Document every repair and defect", "Start fixing the roof immediately", "Offer the property to the other branch", "Prepare for a final confrontation"],
      eventLabels: ["The responding officer recognizes the parcel from an older boundary complaint and finds its diagram.", "A cousin removes the cut lock and replaces it with a larger one before sunset.", "The damp wall reveals an older doorway matching the deed plan.", "A storm damages the roof and makes every negotiating position more expensive."],
      endings: [
        { id: "abandonment", title: "The House Without an Heir", text: "You walk away. Grass crosses the disputed line before any relative does.", outcome: "loss" },
        { id: "family_war", title: "The Inheritance War", text: "The police report keeps the facts straight while the family perfects every other kind of damage.", outcome: "loss", gate: "memory" },
      ],
    },
  ],
  startAliases: [
    { id: "consult_lawyer", label: "Take the papers directly to a lawyer", routeId: "records_route" },
    { id: "accept_tomato_logic", label: "Hear the neighbours before challenging tomato law", routeId: "neighbour_route" },
  ],
};

export const bulgariaInheritanceSource = createAdventureSource(config);

export function buildBulgariaInheritanceCampaign(source: StoryGraphCampaignSource = bulgariaInheritanceSource): CommandResult<BuiltCampaign> {
  const result = buildAdventureCampaign(config, source);
  if (result.ok && result.value) {
    result.value.campaign.migrateState = (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {
      village_life: "neighbour_route_1",
      family_meeting: "neighbour_route_4",
      ending_avoided: "ending_abandonment",
      ending_unresolved: "ending_family_war",
      ending_resolved: "ending_settlement",
    }, {
      avoided_the_inheritance: "abandonment",
      the_argument_continues: "family_war",
      the_documents_settle_it: "settlement",
    });
  }
  return result;
}
