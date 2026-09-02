/**
 * Content — "Stable Life: Events" (10-simulation-kind.md §2.3, §7.6, §7.9, §12; W57).
 *
 * **A fifth standalone fixture campaign, for the same reasons the third and fourth are.**
 * W57 needs two arcs the shared `stable-life` campaign cannot host without changing its
 * committed fixtures: an event firing and moving the headline, and a scenario actually
 * running out of weeks. The second is the sharper constraint — `week_limit_reached` is
 * reported only for a week that resolved neither a goal nor a failure (§12), so proving it
 * needs a scenario whose goals do *not* decide inside the cap. `goalIds: []` gives exactly
 * that: nothing for `goals`/`failure` to say, week after week, until `week_limit` speaks.
 *
 * `weekLimit: 4` keeps the fixture short while leaving room for the whole arc: week one is
 * quiet, week two fires an automatic event, week three fires one with choices, week four is
 * where the player answers it — and the cap lands on that same week four. There is nothing
 * special about four beyond being the smallest number that fits all of it.
 *
 * **`event-power-cut` is automatic, `event-odd-letter` has choices, and the difference is
 * the point.** An automatic event resolves inside the same end-of-week pass (§7.6); one with
 * choices defers to a `PendingEventResponse` presented the *following* week (§2.3), which is
 * the deferral W57.2 exists to pin down. Both are `unique`, so each fires once and the
 * eligible pool drains predictably rather than rerolling the same event every week.
 *
 * **Two headlines bracketed by strangeness, and nothing else separating them.** `headline`
 * runs after `events` (§3), and `endOfWeek.ts` moves `world.strangenessBase` when an event
 * fires. `headline-quiet` covers `0–4` and `headline-strange` covers `5` up, so the headline
 * that shows is decided entirely by whether an event fired that week — which is what makes a
 * headline change *evidence* of the ordering rather than a coincidence beside it (W57.4).
 *
 * `achievement-first-week` reads `player.counters.need_drift`, a counter `advance.ts`'s
 * automatic §6.2 fold writes for every emitted `StateChange` — so it is satisfiable by
 * design, not by chance, and `validate.ts`'s own `unsatisfiable_achievement` check agrees
 * (every `SIMULATION_REASON_CODES` value counts as granted there).
 *
 * `opportunity-market-stall` is uncontested and short-lived: `durationWeeks: 1` means it
 * stands for exactly the week after it is offered, so a fixture can accept or decline it
 * before it expires.
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const STABLE_LIFE_EVENTS_CAMPAIGN_ID = "stable-life-events";

const stableLifeEventsSource: SimulationCampaignSource = {
  description: {
    key: "stable-life-events.campaign.description",
    text: "Three weeks, and the world has opinions about all of them.",
  },

  jobs: [],
  courses: [],
  housing: [
    {
      id: "housing-events",
      name: { key: "stable-life-events.housing.name", text: "A Quiet Flat" },
      description: { key: "stable-life-events.housing.description", text: "Quiet, until it isn't." },
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
      maintenanceRisk: 0,
      requirements: [],
      tags: [],
    },
  ],
  items: [],
  events: [
    {
      id: "event-power-cut",
      category: "household",
      title: { key: "stable-life-events.event.power-cut.title", text: "The Power Goes Out" },
      description: { key: "stable-life-events.event.power-cut.description", text: "No warning, no explanation, no lights." },
      weight: 1,
      // Week two, not week one, deliberately: it leaves the first week eventless, so the
      // headline starts at `headline-quiet` and the switch to `headline-strange` in week two
      // has exactly one cause (W57.4).
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 2 },
      unique: true,
      automaticOutcome: {
        effects: [{ target: "player.needs.happiness", operation: "subtract", value: 5, durationWeeks: 1, sourceId: "event-power-cut" }],
        messages: [{ key: "stable-life-events.event.power-cut.message", visible: true }],
      },
      tags: [],
    },
    {
      id: "event-odd-letter",
      category: "household",
      title: { key: "stable-life-events.event.odd-letter.title", text: "An Odd Letter Arrives" },
      description: { key: "stable-life-events.event.odd-letter.description", text: "Addressed to you, but not by name." },
      weight: 1,
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 3 },
      unique: true,
      choices: [
        {
          id: "choice-open-it",
          labelKey: "stable-life-events.event.odd-letter.choice.open",
          timeCost: 1,
          outcomes: [{
            outcome: {
              effects: [{ target: "player.needs.stress", operation: "add", value: 5, durationWeeks: 1, sourceId: "event-odd-letter" }],
              messages: [{ key: "stable-life-events.event.odd-letter.message.opened", visible: true }],
            },
          }],
        },
        {
          id: "choice-bin-it",
          labelKey: "stable-life-events.event.odd-letter.choice.bin",
          outcomes: [{
            outcome: {
              effects: [],
              messages: [{ key: "stable-life-events.event.odd-letter.message.binned", visible: true }],
            },
          }],
        },
      ],
      tags: [],
    },
  ],
  npcs: [],
  goals: [],
  scenarios: [
    {
      id: "scenario-stable-life-events",
      name: { key: "stable-life-events.scenario.name", text: "Stable Life: Events" },
      description: {
        key: "stable-life-events.scenario.description",
        text: "Three weeks with no objective but the calendar.",
      },
      startingBackgroundIds: ["background-events"],
      startingCashCents: 20000,
      startingHousingId: "housing-events",
      startingLocationId: "home",
      startingInventory: [],
      goalIds: [],
      weekLimit: 4,
      mode: "classic",
      goalFailurePrecedence: "goals_win",
    },
  ],
  difficulties: [],
  projects: [],
  // Referenced by `opportunity-market-stall` (§7.9, W101) — a minimal `BusinessDefinition`
  // so the opportunity's own `targetId` resolves; this fixture's own scenarios never start
  // or operate it, so its cashflow numbers are placeholders, not balanced content.
  businesses: [
    {
      id: "market-stall",
      name: { key: "stable-life-events.business.market-stall.name", text: "The Market Stall" },
      description: { key: "stable-life-events.business.market-stall.description", text: "A modest stall, taken over from someone giving up." },
      requirements: [],
      startupCostCents: 20000,
      weeklyRevenueCents: 3000,
      weeklyExpensesCents: 1000,
      minimumCashCents: -50000,
      tags: [],
    },
  ],
  opportunities: [
    {
      id: "opportunity-market-stall",
      kind: "business",
      targetId: "market-stall",
      name: { key: "stable-life-events.opportunity.market-stall.name", text: "A Market Stall Going Spare" },
      description: { key: "stable-life-events.opportunity.market-stall.description", text: "Someone is giving up. You could take it on." },
      durationWeeks: 1,
      weight: 1,
      requirements: [],
      contested: false,
      tags: [],
    },
  ],
  achievements: [
    {
      id: "achievement-first-week",
      name: { key: "stable-life-events.achievement.first-week.name", text: "One Week Down" },
      description: { key: "stable-life-events.achievement.first-week.description", text: "Survived a week. The bar is where you left it." },
      condition: { field: "player.counters.need_drift", operator: "greater_or_equal", value: 1 },
      hidden: false,
      scope: "profile",
    },
  ],
  headlines: [
    {
      id: "headline-quiet",
      text: { key: "stable-life-events.headline.quiet", text: "Nothing Much Happened Anywhere" },
      maxStrangeness: 4,
      tags: [],
    },
    {
      id: "headline-strange",
      text: { key: "stable-life-events.headline.strange", text: "Residents Report Everything Feeling Slightly Off" },
      minStrangeness: 5,
      tags: [],
    },
  ],
  employers: [],
  locations: [
    {
      id: "home",
      name: { key: "stable-life-events.location.home.name", text: "Home" },
      description: { key: "stable-life-events.location.home.description", text: "Where the letters arrive." },
      connections: [],
      travelTimeUnits: 0,
      actionTypes: ["eat", "rest", "respond_to_event", "accept_opportunity", "decline_opportunity"],
    },
  ],
  backgrounds: [
    {
      id: "background-events",
      name: { key: "stable-life-events.background.name", text: "Unremarkable" },
      description: { key: "stable-life-events.background.description", text: "Nothing on your record either way." },
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

  scenarioId: "scenario-stable-life-events",
  goalFailurePrecedence: "goals_win",

  sceneTemplate: {
    key: "stable-life-events.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "stable-life-events.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "stable-life-events.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "stable-life-events.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "stable-life-events.action.end-week.label", text: "End week" },
  },
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildStableLifeEventsCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(stableLifeEventsSource);
  const campaign: Campaign = {
    id: STABLE_LIFE_EVENTS_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life-events.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "stable-life-events.campaign.title", text: "Stable Life: Events" },
    ...authoredText,
  ]);
}
