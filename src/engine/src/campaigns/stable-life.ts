/**
 * Content — the "Stable Life" fixture (10-simulation-kind.md §7, §12; `plans/36`'s W40,
 * re-authored onto the real §7 content surface by W52).
 *
 * **A synthetic engine-repo fixture, not the real flagship game's own "Stable Life"
 * scenario.** The real one (`games/03-game-design.md` §16.3, companion
 * `SubZeroDev.GameOfLife` repo) runs 52 weeks against six completion criteria spanning
 * employment, education, housing and finance — content this kind's own build units
 * deliberately haven't wired (`endOfWeek.ts`'s own header lists what's still stubbed).
 * This fixture exists to prove the mechanism W39 wired — persistent-goal tracking,
 * failure, and `Kind.outcome` — the same role `campaigns/bulgaria-bureaucracy.ts` plays
 * for `story-graph`: an authored, committed proof, not the eventual flagship content.
 *
 * One goal, "Well Rested": maintain `player.needs.energy` at or above 70 for two
 * consecutive weeks, failing outright if it ever drops below 40. Starting energy is 50 —
 * below the goal's own threshold, so winning requires actually resting; doing nothing
 * drifts energy down by 3 each week (`endOfWeek.ts`'s `DRIFT_PER_WEEK`) until the
 * `failureConditions` trips. `eat`/`rest` (`resolvers.ts`) are the only two real
 * resolvers this kind has — `rest` is what makes the goal winnable at all.
 *
 * **W52 replaces the four literal state blobs this file used to author directly** with one
 * `ScenarioDefinition` plus the `BackgroundDefinition`/`HousingDefinition`/`LocationDefinition`
 * it references — `initial.ts` assembles `calendar`/`player`/`economy`/`world` from them the
 * same way any other campaign's now would. Every value below is chosen to reproduce the
 * previous literal `startingPlayer`/`startingCalendar` exactly (`initial.ts`'s own
 * `DEFAULT_PLAYER_NAME`/`DEFAULT_PLAYER_AGE`/`STARTING_ECONOMY` cover the fields no §7
 * content type sources), so the committed win/loss replay fixtures and the client-parity
 * golden stay byte-identical — no fixture regeneration needed for this campaign.
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const STABLE_LIFE_CAMPAIGN_ID = "stable-life";

export const stableLifeSource: SimulationCampaignSource = {
  description: {
    key: "stable-life.campaign.description",
    text: "Twelve months to establish something resembling a stable life.",
  },

  jobs: [],
  courses: [],
  housing: [
    {
      id: "housing-default",
      name: { key: "stable-life.housing.default.name", text: "A Small Rental" },
      description: { key: "stable-life.housing.default.description", text: "Modest, but the rent is due every week regardless." },
      upfrontCostCents: 0,
      weeklyCostCents: 5000,
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
  items: [],
  events: [],
  npcs: [],
  goals: [
    {
      id: "goal-well-rested",
      label: { key: "stable-life.goal.well-rested.label", text: "Well Rested" },
      description: {
        key: "stable-life.goal.well-rested.description",
        text: "Keep your energy at 70 or above for two weeks running.",
      },
      category: "wellbeing",
      conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 70 },
      requiredDurationWeeks: 2,
      failureConditions: { field: "player.needs.energy", operator: "less_than", value: 40 },
    },
  ],
  scenarios: [
    {
      id: "scenario-stable-life",
      name: { key: "stable-life.scenario.name", text: "Stable Life" },
      description: {
        key: "stable-life.scenario.description",
        text: "Twelve months to establish something resembling a stable life.",
      },
      startingBackgroundIds: ["background-default"],
      startingCashCents: 20000,
      startingHousingId: "housing-default",
      startingLocationId: "home",
      startingInventory: [],
      goalIds: ["goal-well-rested"],
      mode: "classic",
      goalFailurePrecedence: "goals_win",
    },
  ],
  difficulties: [],
  opportunities: [],
  achievements: [],
  headlines: [],
  employers: [],
  locations: [
    {
      id: "home",
      name: { key: "stable-life.location.home.name", text: "Home" },
      description: { key: "stable-life.location.home.description", text: "Where the week starts and ends." },
      connections: [],
      travelTimeUnits: 0,
      actionTypes: ["eat", "rest", "exercise", "socialize"],
    },
  ],
  backgrounds: [
    {
      id: "background-default",
      name: { key: "stable-life.background.default.name", text: "A Fresh Start" },
      description: { key: "stable-life.background.default.description", text: "No particular head start, no particular deficit." },
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

  scenarioId: "scenario-stable-life",
  goalFailurePrecedence: "goals_win",

  sceneTemplate: {
    key: "stable-life.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "stable-life.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "stable-life.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "stable-life.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "stable-life.action.end-week.label", text: "End week" },
  },
};

/**
 * Assembles the envelope around `buildSimulationCampaign(stableLifeSource)`'s output, then
 * hands both to `buildCampaign` (`registry/build.ts`, kind-agnostic) for the `BuiltCampaign`
 * a registry is assembled from.
 */
export function buildStableLifeCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(stableLifeSource);
  const campaign: Campaign = {
    id: STABLE_LIFE_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "stable-life.campaign.title", text: "Stable Life" },
    ...authoredText,
  ]);
}
