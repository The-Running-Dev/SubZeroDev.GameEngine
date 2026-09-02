/**
 * Content — "Stable Life: Possessions" (10-simulation-kind.md §7.5, §7.7, §7.9; W56).
 *
 * **A fourth standalone fixture campaign, for the same reason `stable-life-housing.ts` is a
 * third.** W56.6's arc — buy, wear out, repair, sell — takes five weeks, and the shared
 * `stable-life` campaign's "Well Rested" goal (`failureConditions: energy < 40`) ends a
 * session inside four (`outcome.ts`). `goals: []` and `scenario.goalIds: []` keep `resolution`
 * `null` and the session `"active"` for as long as the fixture needs. Authoring it here rather
 * than into `stable-life.ts` also leaves that campaign's committed replay fixtures and
 * client-parity golden byte-identical.
 *
 * **Two locations, not one.** Every earlier simulation fixture campaign has a single `home`,
 * because `travel` was `stubResolver` and a second location would have been unreachable. This
 * is the first campaign with a real map: `home ⇄ market`, two time units each way, and the
 * action types split across them — you socialize and exercise at home, you shop and sell at
 * the market. That split is what makes both halves of `wrong_location` (§10) reachable from
 * authored content rather than only from a hand-built test state: `shop` at home fails on
 * `actionTypes`, and a `travel` target absent from `connections` fails on the map.
 *
 * `item-bicycle` is deliberately high-maintenance — `intervalWeeks: 1`, losing half its
 * condition for every week it goes unserviced — so `endOfWeek.ts`'s `inventory` decay reaches
 * zero within the fixture's own span and its `player.needs.energy` modifier visibly lapses
 * while the bicycle stays in inventory, which is the distinction W56.3 exists to prove.
 *
 * Housing costs nothing here (`weeklyCostCents: 0`): rent and eviction are `stable-life-
 * housing.ts`'s subject, and a rent line would only add noise to a cash trail that has to
 * show a purchase, a repair and a resale cleanly.
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const STABLE_LIFE_POSSESSIONS_CAMPAIGN_ID = "stable-life-possessions";

const stableLifePossessionsSource: SimulationCampaignSource = {
  description: {
    key: "stable-life-possessions.campaign.description",
    text: "A bicycle, a neighbour, and a market two time units away.",
  },

  jobs: [],
  courses: [],
  housing: [
    {
      id: "housing-default",
      name: { key: "stable-life-possessions.housing.default.name", text: "A Small Rental" },
      description: { key: "stable-life-possessions.housing.default.description", text: "Paid up front, for once." },
      upfrontCostCents: 0,
      weeklyCostCents: 0,
      capacity: 1,
      comfort: 50,
      safety: 50,
      prestige: 10,
      storage: 20,
      commuteModifier: 0,
      energyRecoveryModifier: 0,
      happinessModifier: 0,
      healthModifier: 0,
      maintenanceRisk: 10,
      requirements: [],
      tags: [],
    },
  ],
  items: [
    {
      id: "item-bicycle",
      name: { key: "stable-life-possessions.item.bicycle.name", text: "A Second-Hand Bicycle" },
      description: {
        key: "stable-life-possessions.item.bicycle.description",
        text: "Faster than walking, right up until the chain goes.",
      },
      category: "transport",
      purchasePriceCents: 8000,
      baseResaleValueCents: 4000,
      effects: [
        { target: "player.needs.energy", operation: "add", value: 5, sourceId: "item-bicycle" },
      ],
      stacking: "refresh",
      durability: 100,
      maintenanceRules: [
        {
          intervalWeeks: 1,
          costCents: 500,
          timeCost: 1,
          conditionLossIfSkipped: 50,
          breakageChanceAtZeroCondition: 0,
        },
      ],
      requirements: [],
      tags: [],
    },
  ],
  events: [],
  npcs: [
    {
      id: "npc-neighbour",
      name: { key: "stable-life-possessions.npc.neighbour.name", text: "The Neighbour" },
      description: {
        key: "stable-life-possessions.npc.neighbour.description",
        text: "Always on the landing, always mid-anecdote.",
      },
      defaultRole: "neighbour",
      initialRelationship: { affinity: 10, trust: 10, respect: 10, resentment: 0 },
      // Home only — the market half of the map is where `socialize` fails for a reason that
      // is not `wrong_location` (`resolvers.ts`'s own callout on which code applies).
      availability: [{ locationId: "home" }],
      tags: [],
    },
  ],
  goals: [],
  scenarios: [
    {
      id: "scenario-stable-life-possessions",
      name: { key: "stable-life-possessions.scenario.name", text: "Stable Life: Possessions" },
      description: {
        key: "stable-life-possessions.scenario.description",
        text: "A bicycle, a neighbour, and a market two time units away.",
      },
      startingBackgroundIds: ["background-default"],
      startingCashCents: 30000,
      startingHousingId: "housing-default",
      startingLocationId: "home",
      startingInventory: [],
      goalIds: [],
      mode: "classic",
      goalFailurePrecedence: "goals_win",
    },
  ],
  difficulties: [],
  projects: [],
  businesses: [],
  opportunities: [],
  achievements: [],
  headlines: [],
  employers: [],
  locations: [
    {
      id: "home",
      name: { key: "stable-life-possessions.location.home.name", text: "Home" },
      description: { key: "stable-life-possessions.location.home.description", text: "Where the week starts and ends." },
      connections: ["market"],
      travelTimeUnits: 2,
      actionTypes: ["eat", "rest", "exercise", "socialize", "travel", "maintain_item", "repair_item"],
    },
    {
      id: "market",
      name: { key: "stable-life-possessions.location.market.name", text: "The Market" },
      description: { key: "stable-life-possessions.location.market.description", text: "Everything second-hand, nothing guaranteed." },
      connections: ["home"],
      travelTimeUnits: 2,
      actionTypes: ["shop", "sell_item", "repair_item", "travel"],
    },
  ],
  backgrounds: [
    {
      id: "background-default",
      name: { key: "stable-life-possessions.background.default.name", text: "A Fresh Start" },
      description: { key: "stable-life-possessions.background.default.description", text: "No particular head start, no particular deficit." },
      startingAttributes: {
        intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
        resilience: 50, wisdom: 50, luck: 50,
      },
      startingSkills: {},
      startingCredentials: [],
      startingTraits: [],
      startingCashModifierCents: 0,
    },
  ],
  traits: [],
  skills: [],

  scenarioId: "scenario-stable-life-possessions",
  goalFailurePrecedence: "goals_win",

  sceneTemplate: {
    key: "stable-life-possessions.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "stable-life-possessions.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "stable-life-possessions.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "stable-life-possessions.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "stable-life-possessions.action.end-week.label", text: "End week" },
  },
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildStableLifePossessionsCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(stableLifePossessionsSource);
  const campaign: Campaign = {
    id: STABLE_LIFE_POSSESSIONS_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life-possessions.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "stable-life-possessions.campaign.title", text: "Stable Life: Possessions" },
    ...authoredText,
  ]);
}
