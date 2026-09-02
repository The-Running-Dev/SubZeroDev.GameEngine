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
 * `failureConditions` trips. `eat`/`rest` (`resolvers.ts`) were the only two real
 * resolvers this kind had before W53.
 *
 * **W53 adds one job and one employer** — `job-cashier` at `employer-cornerstore` — solely
 * so `stable-life-employment.fixture.json` (a fourth committed replay fixture, alongside
 * win/loss/effect-expiry) can exercise `search_for_work` → `apply_for_job` → the
 * `employment` end-of-week hire → `finance_income`'s first paycheque, the arc W53.6 names.
 * `home`'s own `actionTypes` grows to cover all five new `ActionType`s rather than adding a
 * second location and a `travel` action — `travel` stays `stubResolver` (`resolvers.ts`),
 * so a second location would be unreachable and this fixture couldn't use it anyway.
 *
 * **W54 adds one course and one skill-gated job** — `course-bookkeeping` and
 * `job-accountant` (also at `employer-cornerstore`) — solely so
 * `stable-life-education.fixture.json` (a fifth committed replay fixture) can exercise
 * `enroll_course` → `attend_class`/`study` → the `education` end-of-week completion → the
 * skill it awards satisfying `job-accountant`'s own `Requirement`, the enrol → attend →
 * complete → qualify arc W54.6 names. `home`'s `actionTypes` grows again for the same
 * single-location reason W53's own callout gives.
 *
 * **W52 replaces the four literal state blobs this file used to author directly** with one
 * `ScenarioDefinition` plus the `BackgroundDefinition`/`HousingDefinition`/`LocationDefinition`
 * it references — `initial.ts` assembles `calendar`/`player`/`economy`/`world` from them the
 * same way any other campaign's now would. Every value below is chosen to reproduce the
 * previous literal `startingPlayer`/`startingCalendar` exactly (`initial.ts`'s own
 * `DEFAULT_PLAYER_NAME`/`DEFAULT_PLAYER_AGE`/`STARTING_ECONOMY` cover the fields no §7
 * content type sources), so the committed win/loss replay fixtures and the client-parity
 * golden stay byte-identical — no fixture regeneration needed for this campaign.
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
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

  jobs: [
    {
      id: "job-cashier",
      title: { key: "stable-life.job.cashier.title", text: "Cashier" },
      description: { key: "stable-life.job.cashier.description", text: "Ring up groceries, make small talk." },
      employerId: "employer-cornerstore",
      careerPathId: "career-retail",
      tier: "entry",
      schedule: { weeklyTimeCost: 6, flexibility: 50 },
      compensation: { baseWeeklyPayCents: 30000, overtimeRate: 5000 },
      requirements: [],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    },
    {
      id: "job-accountant",
      title: { key: "stable-life.job.accountant.title", text: "Accountant" },
      description: { key: "stable-life.job.accountant.description", text: "Keep the books straight." },
      employerId: "employer-cornerstore",
      careerPathId: "career-finance",
      tier: "skilled",
      schedule: { weeklyTimeCost: 6, flexibility: 50 },
      compensation: { baseWeeklyPayCents: 45000 },
      requirements: [{
        type: "skill",
        condition: { field: "player.skills.bookkeeping", operator: "greater_or_equal", value: 50 },
        failureCode: "requirement_unmet",
        messageKey: "core.reason.requirement_unmet",
      }],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    },
  ],
  courses: [
    {
      id: "course-bookkeeping",
      name: { key: "stable-life.course.bookkeeping.name", text: "Bookkeeping Basics" },
      description: { key: "stable-life.course.bookkeeping.description", text: "Ledgers, receipts, and where the money actually went." },
      providerId: "provider-community-college",
      tuitionCents: 10000,
      durationWeeks: 2,
      weeklyTimeCost: 2,
      difficulty: 20,
      requirements: [],
      rewards: [{ type: "skill", target: "bookkeeping", value: 50 }],
      awardsCredential: "certificate",
      failureRules: {
        minimumAttendanceRatio: 50,
        minimumStudyUnitsPerWeek: 1,
        maximumMissedSessions: 1,
        tuitionGraceWeeks: 0,
        progressRetainedOnFailure: 25,
      },
      tags: [],
    },
  ],
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
  projects: [],
  businesses: [],
  opportunities: [],
  achievements: [],
  headlines: [],
  employers: [
    {
      id: "employer-cornerstore",
      name: { key: "stable-life.employer.cornerstore.name", text: "The Corner Store" },
      sector: "retail",
      reputation: 50,
      jobIds: ["job-cashier", "job-accountant"],
      npcIds: [],
    },
  ],
  locations: [
    {
      id: "home",
      name: { key: "stable-life.location.home.name", text: "Home" },
      description: { key: "stable-life.location.home.description", text: "Where the week starts and ends." },
      connections: [],
      travelTimeUnits: 0,
      actionTypes: [
        "eat", "rest", "exercise", "socialize",
        "search_for_work", "apply_for_job", "negotiate_job_terms", "work", "work_overtime",
        "enroll_course", "attend_class", "study", "withdraw_course",
      ],
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
      startingSkills: { bookkeeping: 0 },
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
