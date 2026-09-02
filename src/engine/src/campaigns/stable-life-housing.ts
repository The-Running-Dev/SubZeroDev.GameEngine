/**
 * Content — "Stable Life: Housing" (10-simulation-kind.md §7.4, §6.9; W55).
 *
 * **A third, standalone fixture campaign, not a variant of `stable-life.ts`.** W55.6 needs
 * two replay fixtures that run well past the four-to-nine weeks it takes rent to go unpaid
 * and eviction to escalate — the shared `stable-life` campaign's own "Well Rested" goal
 * (`failureConditions: energy < 40`, unattended, trips inside four weeks) would end the
 * session (`outcome.ts`: no goal left `"active"` sets `status: "ended"`) long before either
 * fixture's own point is proven. This campaign carries **no goals at all** — `goals: []`,
 * `scenario.goalIds: []` — so `Kind.outcome`'s `resolution` stays `null` and the session
 * stays `"active"` for as many weeks as a fixture needs, the same reason
 * `stable-life-effects.ts` is its own campaign rather than a `stable-life.ts` variant.
 *
 * One housing (`housing-default`, `weeklyCostCents: 5000`) and one job (`job-cashier`,
 * `baseWeeklyPayCents: 5000` — exactly the rent, no more) at `startingCashCents: 5000` —
 * exactly one week's rent. `stable-life-housing-eviction` never applies for the job: rent
 * consumes the starting cash in week one, and every week after that is missed outright,
 * walking `evictionStage` one rung per week (`endOfWeek.ts`'s `financeReconcile`) until
 * `"evicted"`. `stable-life-housing-avoiding-eviction` applies for the job in week one
 * instead: the starting cash covers week one's rent while the application is still
 * pending, and the job's own wage — landing the same week `employment` resolves the hire,
 * `financeIncome` running before `housing` in the same pass (§3) — covers every week's rent
 * after that. "Avoiding it by a single week's wages" is literal: `startingCashCents`
 * carries exactly one week, and the job's own pay is exactly the rent, not a cushion.
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const STABLE_LIFE_HOUSING_CAMPAIGN_ID = "stable-life-housing";

const stableLifeHousingSource: SimulationCampaignSource = {
  description: {
    key: "stable-life-housing.campaign.description",
    text: "One rental, one job, and rent due every week regardless.",
  },

  jobs: [
    {
      id: "job-cashier",
      title: { key: "stable-life-housing.job.cashier.title", text: "Cashier" },
      description: { key: "stable-life-housing.job.cashier.description", text: "Ring up groceries, make small talk." },
      employerId: "employer-cornerstore",
      careerPathId: "career-retail",
      tier: "entry",
      schedule: { weeklyTimeCost: 6, flexibility: 50 },
      compensation: { baseWeeklyPayCents: 5000 },
      requirements: [],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    },
  ],
  courses: [],
  housing: [
    {
      id: "housing-default",
      name: { key: "stable-life-housing.housing.default.name", text: "A Small Rental" },
      description: { key: "stable-life-housing.housing.default.description", text: "Modest, but the rent is due every week regardless." },
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
  goals: [],
  scenarios: [
    {
      id: "scenario-stable-life-housing",
      name: { key: "stable-life-housing.scenario.name", text: "Stable Life: Housing" },
      description: {
        key: "stable-life-housing.scenario.description",
        text: "One rental, one job, and rent due every week regardless.",
      },
      startingBackgroundIds: ["background-default"],
      startingCashCents: 5000,
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
  employers: [
    {
      id: "employer-cornerstore",
      name: { key: "stable-life-housing.employer.cornerstore.name", text: "The Corner Store" },
      sector: "retail",
      reputation: 50,
      jobIds: ["job-cashier"],
      npcIds: [],
    },
  ],
  locations: [
    {
      id: "home",
      name: { key: "stable-life-housing.location.home.name", text: "Home" },
      description: { key: "stable-life-housing.location.home.description", text: "Where the week starts and ends." },
      connections: [],
      travelTimeUnits: 0,
      actionTypes: ["search_for_work", "apply_for_job", "work", "pay_bills"],
    },
  ],
  backgrounds: [
    {
      id: "background-default",
      name: { key: "stable-life-housing.background.default.name", text: "A Fresh Start" },
      description: { key: "stable-life-housing.background.default.description", text: "No particular head start, no particular deficit." },
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

  scenarioId: "scenario-stable-life-housing",
  goalFailurePrecedence: "goals_win",

  sceneTemplate: {
    key: "stable-life-housing.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "stable-life-housing.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "stable-life-housing.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "stable-life-housing.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "stable-life-housing.action.end-week.label", text: "End week" },
  },
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildStableLifeHousingCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(stableLifeHousingSource);
  const campaign: Campaign = {
    id: STABLE_LIFE_HOUSING_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life-housing.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "stable-life-housing.campaign.title", text: "Stable Life: Housing" },
    ...authoredText,
  ]);
}
