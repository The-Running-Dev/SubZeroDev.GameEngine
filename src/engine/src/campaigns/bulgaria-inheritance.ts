import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../portable/format.js";

export const BULGARIA_INHERITANCE_CAMPAIGN_ID = "bulgaria-inheritance";

// The catalog card travels with the campaign, not a positional entry in
// site/src/play/composition.ts.
export const bulgariaInheritanceCatalog: PortableCatalog = {
  title: "Inheritance",
  description: "Family property, evidence, neighbours, court, and tomato-adjacent law — now with considerably more ways the tomatoes can end up owned.",
  duration: "10–15 min per route",
  contentNotice: "Family conflict, police and court proceedings, property damage, bribery-adjacent humor, and abandonment.",
  featured: false,
};

export const bulgariaInheritanceMigration: PortableMigration = {
  fromVersion: "1.0.0",
  nodeMap: {
    village_life: "neighbour_route_1",
    family_meeting: "neighbour_route_4",
    ending_avoided: "ending_abandonment",
    ending_unresolved: "ending_family_war",
    ending_resolved: "ending_settlement",
  },
  endingMap: {
    avoided_the_inheritance: "abandonment",
    the_argument_continues: "family_war",
    the_documents_settle_it: "settlement",
  },
};

const config: AdventureConfig = {
  id: BULGARIA_INHERITANCE_CAMPAIGN_ID,
  namespace: "inheritance",
  title: "Inheritance",
  description: "A village property dispute across evidence, neighbours, police, lawyers, court, settlement, and the specific afterlife of a disputed tomato patch.",
  startNodeId: "property_inheritance",
  intro: "Your aunt says she owns the entire property because she has personally maintained the tomatoes since 1998. The news arrives with one missing deed, five confident relatives, and a WhatsApp group that has not slept in three days.",
  statLabels: { preparation: "Evidence", connections: "Family Support", pressure: "Family Tension" },
  routes: [
    {
      id: "records_route", choiceId: "request_records", label: "Find the old documents", memoryLabel: "the archivist's note",
      scenes: [
        "The cadastral archive holds three plans: old, older, and the one everyone cites confidently and nobody can actually unfold.",
        "A lost deed surfaces in a municipal index filed under your grandfather's second, more creative spelling of his own name.",
        "The lawyer compares signatures while the family compares memories; neither exercise produces anything resembling silence.",
        "In court, evidence and folklore finally sit at separate tables. You decide exactly how hard a legal victory should be allowed to land.",
      ],
      actionLabels: ["Let the archivist explain the annotations", "Photograph everything before lunch", "Keep the index reference", "Commission a new survey immediately", "Build a dated evidence folder", "Lead with the oldest deed", "Ask the lawyer for settlement terms", "Prepare every witness for court"],
      eventLabels: ["The archivist recognizes a notation linking the missing deed to exactly the right parcel, and looks faintly proud of himself.", "Your photographs include, beautifully and entirely uselessly, the wrong village's map.", "The surveyor finds the old boundary stone under a raspberry bush, exactly where the oldest neighbour swore it would be.", "A witness cancels, then sends a voice message considerably longer than the hearing itself would have taken."],
      endings: [
        { id: "court_victory", title: "The Court Record", text: "The judgment settles ownership across twelve pages. Nobody in the family reads them the same way twice.", outcome: "win" },
        { id: "family_peace", title: "The Table After Court", text: "You use the archivist's note to offer dignity alongside the facts. Lunch, remarkably, becomes possible again.", outcome: "win", gate: "memory" },
        { id: "lawyer_bills_more_than_the_land_is_worth", title: "A Technical Victory", text: "You win outright. The legal fees, once totalled, exceed the land's assessed value by a margin nobody wants to say out loud at the next family lunch.", outcome: "loss" },
        { id: "the_missing_deed_names_someone_else", title: "A Third Cousin You've Never Met", text: "The recovered deed does settle everything — in favour of a third cousin currently living in Chicago who has never once mentioned owning a tomato patch in Bulgaria.", outcome: "loss" },
        { id: "archivist_becomes_family_friend", title: "The Archivist Comes to Christmas", text: "The archivist takes such a personal interest in untangling your family's paperwork that he gets invited to the settlement lunch, then the next name day, then, eventually, every family gathering going forward.", outcome: "win", gate: "prepared" },
      ],
    },
    {
      id: "neighbour_route", choiceId: "call_mother", label: "Ask family and neighbours what happened", memoryLabel: "the neighbour's testimony",
      scenes: [
        "Your mother supplies names, dates, and a forensically detailed account of who failed to bring salad to a gathering in 1994.",
        "The oldest neighbour in the village remembers the boundary before the fence, and the agreement before the argument that replaced it.",
        "A village meeting slowly turns testimony into negotiation, while coffee keeps everyone technically, if reluctantly, still seated.",
        "The family can now settle, trade shares, or preserve the dispute as its most durable and beloved tradition.",
      ],
      actionLabels: ["Write down the useful dates", "Let the 1994 story run its course", "Record the neighbour's boundary account", "Measure the fence before listening", "Invite every co-owner to mediation", "Negotiate with the calmest branch first", "Draft a shared-use agreement", "Offer to buy the smallest shares"],
      eventLabels: ["A forgotten photograph dates the old fence precisely, and includes everyone smiling beside it, apparently on good terms once.", "The story expands to include a christening, a feud, and a wedding, and loses the actual parcel entirely somewhere in the middle.", "Two co-owners arrive ready to settle, purely because the last bus home leaves at four.", "A cousin arrives late with a secret agreement handwritten on hotel stationery from a hotel nobody can place."],
      endings: [
        { id: "settlement", title: "The Village Settlement", text: "The signatures do not create affection, but they do create a boundary everyone can live beside.", outcome: "win", gate: "memory" },
        { id: "buyout", title: "One Owner, Five Receipts", text: "You buy the remaining shares and inherit the roof, the tomatoes, and all future unsolicited advice about both.", outcome: "neutral" },
        { id: "everyone_settles_but_the_tomatoes", title: "Ownership Resolved, Tomatoes Unresolved", text: "The paperwork is signed, witnessed, and filed. Your aunt continues tending the tomatoes as though none of it happened, and honestly, at this point, nobody has the nerve to stop her.", outcome: "win" },
        { id: "mediation_becomes_a_second_dispute", title: "A New Argument, About the Old One", text: "The mediation session resolves the property question and opens an entirely new argument about who mediated it better. This one has no deed to settle it.", outcome: "loss" },
        { id: "the_village_writes_a_song_about_it", title: "Now It's Folklore", text: "The dispute becomes such a fixture of village conversation that someone sets it to a chalga tune at the next wedding. You are, technically, famous now. This does not help with the tomatoes.", outcome: "neutral", gate: "prepared" },
      ],
    },
    {
      id: "police_route", choiceId: "cut_padlock", label: "Cut the padlock and force the issue", memoryLabel: "the police report",
      scenes: [
        "The new padlock yields immediately to a bolt cutter. The family WhatsApp group achieves full operational readiness within the minute.",
        "Police record the fence, the lock, the missing deeds, and six mutually exclusive versions of what happened last Tuesday.",
        "Property condition itself becomes evidence: broken windows, a suspiciously well-repaired roof, cultivated tomatoes, and one room nobody in the family will claim.",
        "The report prevents outright invention, but not anger. You must decide whether the house is worth the war it has now officially documented.",
      ],
      actionLabels: ["Call police before entering", "Enter and explain later", "Keep the report number", "Argue that family matters need no report", "Document every repair and defect", "Start fixing the roof immediately", "Offer the property to the other branch", "Prepare for a final confrontation"],
      eventLabels: ["The responding officer recognizes the parcel from an older boundary complaint and pulls up its diagram from memory.", "A cousin removes the cut lock and quietly replaces it with a considerably larger one before sunset.", "The damp wall reveals an older, bricked-up doorway that matches the original deed plan exactly.", "A storm damages the roof overnight, making every single negotiating position more expensive by morning."],
      endings: [
        { id: "abandonment", title: "The House Without an Heir", text: "You walk away. Grass crosses the disputed line before any relative does.", outcome: "loss" },
        { id: "family_war", title: "The Inheritance War", text: "The police report keeps the facts straight while the family perfects every other available kind of damage.", outcome: "loss", gate: "memory" },
        { id: "informal_settlement_over_rakia", title: "Solved on the Doorstep, Unofficially", text: "Two cousins who haven't spoken in a decade end up on the same doorstep at midnight, share a bottle, and settle the whole thing verbally. Nobody writes it down. Somehow, it holds.", outcome: "win" },
        { id: "the_house_becomes_a_rental", title: "Nobody Wins, Everybody Gets a Cut", text: "Exhausted by the whole affair, the family agrees to rent the house out and split the income evenly. It is, everyone privately admits, the most functional decision the family has made in thirty years.", outcome: "win", gate: "prepared" },
        { id: "police_file_grows_a_life_of_its_own", title: "The Report Outlives the Dispute", text: "New complaints keep getting attached to the same case file — a car, a fence, a goat — until the file is thicker than the deed ever was, and nobody remembers exactly what it was originally about.", outcome: "loss" },
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
