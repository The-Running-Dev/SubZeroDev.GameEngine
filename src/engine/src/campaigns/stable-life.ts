/**
 * Content — the "Stable Life" fixture (10-simulation-kind.md §7, §12; `plans/36`'s W40).
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
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import type { GoalDefinition } from "../kinds/simulation/content.js";
import type { SimulationCampaign } from "../kinds/simulation/campaign.js";
import type { CalendarState, EconomyState, WorldState } from "../kinds/simulation/state.js";
import type { PlayerState } from "../kinds/simulation/actor.js";

export const STABLE_LIFE_CAMPAIGN_ID = "stable-life";

const TITLE: AuthoredText = { key: "stable-life.campaign.title", text: "Stable Life" };
const DESCRIPTION: AuthoredText = {
  key: "stable-life.campaign.description",
  text: "Twelve months to establish something resembling a stable life.",
};
const GOAL_LABEL: AuthoredText = { key: "stable-life.goal.well-rested.label", text: "Well Rested" };
const GOAL_DESCRIPTION: AuthoredText = {
  key: "stable-life.goal.well-rested.description",
  text: "Keep your energy at 70 or above for two weeks running.",
};

const wellRestedGoal: GoalDefinition = {
  id: "goal-well-rested",
  labelKey: GOAL_LABEL.key,
  descriptionKey: GOAL_DESCRIPTION.key,
  category: "wellbeing",
  conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 70 },
  requiredDurationWeeks: 2,
  failureConditions: { field: "player.needs.energy", operator: "less_than", value: 40 },
};

const startingCalendar: CalendarState = {
  currentWeek: 1,
  currentYear: 1,
  totalTimeUnits: 14,
  committedTimeUnits: 0,
  spentTimeUnits: 0,
};

const startingPlayer: PlayerState = {
  identity: { actorId: "player", name: "Alex", age: 28, backgroundId: "background-default" },
  currentLocationId: "home",
  finances: {
    cashCents: 20000,
    savingsCents: 0,
    debtCents: 0,
    weeklyIncomeCents: 0,
    weeklyExpensesCents: 0,
    overdueBalanceCents: 0,
    accounts: [],
  },
  needs: { health: 80, energy: 50, happiness: 60, stress: 20, satiety: 80 },
  attributes: {
    intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
    resilience: 50, wisdom: 50, luck: 50,
  },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
  housing: {
    definitionId: "housing-default",
    movedInWeek: 1,
    ownership: "renting",
    damage: 0,
    weeklyCostCents: 5000,
    depositPaidCents: 0,
    rentDueWeek: 1,
    overdueRentCents: 0,
    missedPayments: 0,
    evictionStage: "none",
  },
  inventory: [],
  relationships: [],
  skills: {},
  traits: [],
  reputation: {},
  flags: {},
  counters: {},
};

const startingEconomy: EconomyState = {
  inflation: 200,
  unemploymentRate: 500,
  interestRate: 300,
  sectorDemand: {},
  marketPrices: {},
  publishedIndicators: [],
  flags: {},
};

const startingWorld: WorldState = {
  npcs: [],
  locations: [],
  jobMarket: { openings: [] },
  eventCooldowns: {},
  firedUniqueEvents: [],
  chainStates: [],
  strangenessBase: 0,
  headlinePool: { remainingIds: [], cyclesCompleted: 0 },
  agents: [],
  flags: {},
};

const stableLifeContent: SimulationCampaign = {
  descriptionKey: DESCRIPTION.key,
  startingCalendar,
  startingPlayer,
  startingEconomy,
  startingWorld,
  goals: [wellRestedGoal],
  goalFailurePrecedence: "goals_win",
};

/**
 * Assembles the envelope around `stableLifeContent`, then hands both to `buildCampaign`
 * (`registry/build.ts`, kind-agnostic) for the `BuiltCampaign` a registry is assembled
 * from — no simulation-specific source-schema builder exists yet (unlike
 * `buildStoryGraphCampaign`), and this fixture's content is small enough not to need one.
 */
export function buildStableLifeCampaign(): CommandResult<BuiltCampaign> {
  const campaign: Campaign = {
    id: STABLE_LIFE_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: TITLE.key,
    content: stableLifeContent,
  };
  return buildCampaign(campaign, [TITLE, DESCRIPTION, GOAL_LABEL, GOAL_DESCRIPTION]);
}
