/**
 * Content — "Long Horizon" (10-simulation-kind.md §7; W89, "A Game-Length Life").
 *
 * **A pair of engine-owned regression fixtures, not a second game.** `20-contract.md` §19
 * permits exactly this: `SubZeroDev.Adventures.Content` owns canonical narrative source and
 * publication, and "GameEngine may retain a frozen campaign solely as a regression fixture;
 * such a fixture is not published and not listed in a manifest." Neither `buildLongHorizonWinCampaign` nor
 * `buildLongHorizonLossCampaign` is exported from `index.ts`/`authoring.ts` — the same
 * unpublished status `stable-life-housing.ts` and its siblings already have.
 *
 * **Two campaigns, not one campaign with two scenarios.** `SimulationCampaign` binds
 * exactly one `scenarioId` (`campaign.ts`'s own header: "a single campaign here only ever
 * plays one scenario"), so a win and a loss run need two separate `buildCampaign` calls —
 * mirroring `stable-life.ts`/`stable-life-housing.ts`'s own split, not a new pattern. Every
 * definition below except `goals` and `scenarios` is shared by reference between the two
 * sources, so the two runs share one job market, one course, one item, one event pair, one
 * opportunity, one achievement and one headline — the "same fifteen systems run two hundred
 * times over accumulating state" W89 itself asks for, exercised twice against the same
 * content rather than authored twice.
 *
 * **The win condition is `player.career.totalWeeksEmployed`, not a savings target.**
 * `endOfWeek.ts`'s `advanceEmployment` increments it by exactly one every week the player is
 * employed, regardless of which `plan.add` actions that week happened to carry — a strictly
 * monotonic counter with no tuning surface. `goal-established` requires it to reach 150 and
 * hold for two consecutive weeks, which — starting from a week-2 hire — lands the "goals_met"
 * resolution at roughly week 153–156, comfortably past W89.1's "at least one hundred and
 * fifty weeks." A savings or cash target would have needed hand-tuned weekly deposits against
 * wage/rent arithmetic to land in the same window; this needs none.
 *
 * **The loss condition is a goal's `failureConditions` tied to the eviction ladder, not an
 * unrelated need.** `goal-stay-housed`'s own `conditions` is trivially true every week (so it
 * never completes on its own — `requiredDurationWeeks` is set absurdly high specifically so it
 * can't), and `failureConditions` fires only once `player.housing.evictionStage` reaches
 * `"evicted"`. `goalFailurePrecedence: "failure_wins"` on the loss campaign is what lets the
 * failure actually land instead of being pre-empted by the trivially-true `conditions` — the
 * default `"goals_win"` would complete the goal instead of failing it the moment both trip
 * the same week. `scenario-long-horizon-loss` starts with exactly enough cash to cover
 * `housing-modest`'s rent for about 155 weeks and no income at all (the win run's job market
 * already proves `search_for_work`/`apply_for_job`/employment end to end, so the loss run
 * doesn't need to repeat it) — once cash runs out, the ladder climbs `none → warning →
 * penalty → formal_notice → hearing_scheduled → evicted` over five more weeks and the goal
 * fails right there. **This is the terminal path no short fixture has ever walked**:
 * `stable-life-housing-eviction` (W55.6) reaches `"evicted"` too, but its own campaign
 * carries `goals: []` specifically so nothing ever ends the session — the eviction there is
 * a `kindState` fact a test reads back, never a resolution. Here it is one.
 *
 * **Every one of the 27 dispatched `ActionType`s is exercised by the win run alone** — see
 * `long-horizon.replay.test.ts`'s own coverage assertion. The loss run's own weekly policy is
 * deliberately inactive (free `eat`/`rest` plus occasional free `exercise`/`socialize`/
 * `travel`) so the cash-depletion arithmetic above stays exact; any action type it happens to
 * also resolve is redundant coverage, not required coverage.
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";
import type { GoalDefinitionSource, ScenarioDefinitionSource } from "../kinds/simulation/source.js";

export const LONG_HORIZON_WIN_CAMPAIGN_ID = "long-horizon-win";
export const LONG_HORIZON_LOSS_CAMPAIGN_ID = "long-horizon-loss";

/** Every `ActionType` an `ActionType.actionTypes` list in this campaign must carry so no
 *  resolver is ever rejected `wrong_location` — the full 27-entry `RESOLVER_TABLE`
 *  non-stub set (`resolvers.ts`), the same list `long-horizon.replay.test.ts` asserts
 *  coverage against. Shared by both locations so travelling between them never narrows
 *  what the weekly policy can do. */
const ALL_ACTION_TYPES: SimulationCampaignSource["locations"][number]["actionTypes"] = [
  "work", "work_overtime",
  "search_for_work", "apply_for_job", "negotiate_job_terms",
  "attend_class", "study", "enroll_course", "withdraw_course",
  "shop", "eat", "rest", "exercise", "socialize", "travel",
  "maintain_item", "repair_item", "sell_item",
  "pay_bills", "borrow_money", "repay_debt", "deposit_savings", "invest",
  "move_housing",
  "accept_opportunity", "decline_opportunity",
  "respond_to_event",
];

const locations: SimulationCampaignSource["locations"] = [
  {
    id: "home",
    name: { key: "long-horizon.location.home.name", text: "Home" },
    description: { key: "long-horizon.location.home.description", text: "Where the week starts and ends." },
    connections: ["town"],
    travelTimeUnits: 0,
    actionTypes: ALL_ACTION_TYPES,
  },
  {
    id: "town",
    name: { key: "long-horizon.location.town.name", text: "Town" },
    description: { key: "long-horizon.location.town.description", text: "Everywhere else, folded into one stop." },
    connections: ["home"],
    travelTimeUnits: 1,
    actionTypes: ALL_ACTION_TYPES,
  },
];

const jobs: SimulationCampaignSource["jobs"] = [
  {
    id: "job-cashier",
    title: { key: "long-horizon.job.cashier.title", text: "Cashier" },
    description: { key: "long-horizon.job.cashier.description", text: "Ring up groceries, make small talk." },
    employerId: "employer-mainco",
    careerPathId: "career-retail",
    tier: "entry",
    schedule: { weeklyTimeCost: 4, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 6000, overtimeRate: 5000 },
    requirements: [],
    performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    promotionPaths: [{
      toJobId: "job-manager", minimumWeeksInRole: 5, minimumPerformance: 20,
      requirements: [], contested: false, baseChance: 100,
    }],
    terminationRules: [],
    contested: false,
    tags: [],
  },
  {
    id: "job-manager",
    title: { key: "long-horizon.job.manager.title", text: "Store Manager" },
    description: { key: "long-horizon.job.manager.description", text: "Runs the schedule, orders the stock." },
    employerId: "employer-mainco",
    careerPathId: "career-retail",
    tier: "skilled",
    schedule: { weeklyTimeCost: 6, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 12000, overtimeRate: 5000 },
    requirements: [],
    performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    promotionPaths: [],
    terminationRules: [],
    contested: false,
    tags: [],
  },
  {
    id: "job-accountant",
    title: { key: "long-horizon.job.accountant.title", text: "Accountant" },
    description: { key: "long-horizon.job.accountant.description", text: "Keeps someone else's books straight." },
    employerId: "employer-mainco",
    careerPathId: "career-finance",
    tier: "skilled",
    schedule: { weeklyTimeCost: 5, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 9000 },
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
];

const courses: SimulationCampaignSource["courses"] = [
  {
    id: "course-bookkeeping",
    name: { key: "long-horizon.course.bookkeeping.name", text: "Bookkeeping Basics" },
    description: { key: "long-horizon.course.bookkeeping.description", text: "Ledgers, receipts, and where the money actually went." },
    providerId: "provider-community-college",
    tuitionCents: 5000,
    durationWeeks: 3,
    weeklyTimeCost: 2,
    difficulty: 20,
    requirements: [],
    rewards: [{ type: "skill", target: "bookkeeping", value: 50 }],
    awardsCredential: "certificate",
    failureRules: {
      minimumAttendanceRatio: 0, minimumStudyUnitsPerWeek: 0, maximumMissedSessions: 99,
      tuitionGraceWeeks: 0, progressRetainedOnFailure: 25,
    },
    tags: [],
  },
  {
    // Enrolled and withdrawn before completion, solely to exercise `withdraw_course` — a
    // long enough `durationWeeks` that the weekly policy's one-week withdrawal never races
    // an accidental completion.
    id: "course-evening-class",
    name: { key: "long-horizon.course.evening-class.name", text: "Evening Class" },
    description: { key: "long-horizon.course.evening-class.description", text: "Turned out to be the wrong evening." },
    providerId: "provider-community-college",
    tuitionCents: 1000,
    durationWeeks: 8,
    weeklyTimeCost: 1,
    difficulty: 10,
    requirements: [],
    rewards: [],
    awardsCredential: "none",
    failureRules: {
      minimumAttendanceRatio: 0, minimumStudyUnitsPerWeek: 0, maximumMissedSessions: 99,
      tuitionGraceWeeks: 0, progressRetainedOnFailure: 0,
    },
    tags: [],
  },
];

const housing: SimulationCampaignSource["housing"] = [
  {
    id: "housing-modest",
    name: { key: "long-horizon.housing.modest.name", text: "A Small Rental" },
    description: { key: "long-horizon.housing.modest.description", text: "Modest, but the rent is due every week regardless." },
    upfrontCostCents: 0, weeklyCostCents: 4000,
    capacity: 1, comfort: 50, safety: 50, prestige: 10, storage: 20,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0,
    maintenanceRisk: 10, requirements: [], tags: [],
  },
  {
    // `move_housing`'s only destination — reachable only from the win run, whose income
    // covers both the move-in cost and the higher rent that follows.
    id: "housing-upgraded",
    name: { key: "long-horizon.housing.upgraded.name", text: "A Nicer Place" },
    description: { key: "long-horizon.housing.upgraded.description", text: "A short walk further from work, but worth it." },
    upfrontCostCents: 2000, depositCents: 1000, weeklyCostCents: 4500,
    capacity: 1, comfort: 70, safety: 60, prestige: 20, storage: 30,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0,
    maintenanceRisk: 5, requirements: [], tags: [],
  },
];

const items: SimulationCampaignSource["items"] = [
  {
    id: "item-bike",
    name: { key: "long-horizon.item.bike.name", text: "Bicycle" },
    description: { key: "long-horizon.item.bike.description", text: "Squeaky, but it gets you there." },
    category: "transport",
    purchasePriceCents: 8000,
    baseResaleValueCents: 8000,
    effects: [{ target: "player.needs.happiness", operation: "add", value: 5, sourceId: "item-bike" }],
    stacking: "refresh",
    maintenanceRules: [{ intervalWeeks: 2, costCents: 500, timeCost: 1, conditionLossIfSkipped: 50, breakageChanceAtZeroCondition: 0 }],
    requirements: [], tags: [],
  },
];

/** Trivially true every week (`calendar.currentWeek` only ever increases) — used both as
 *  an always-eligible `EventDefinition.conditions` and as `goal-stay-housed`'s own
 *  `conditions`, where "always satisfied, never completing" is the point (see this file's
 *  own header). */
const ALWAYS_TRUE = { field: "calendar.currentWeek", operator: "greater_or_equal" as const, value: 1 };

const events: SimulationCampaignSource["events"] = [
  {
    id: "event-minor",
    category: "random",
    title: { key: "long-horizon.event.minor.title", text: "A Quiet Week, Almost" },
    description: { key: "long-horizon.event.minor.description", text: "Something small happens; the world takes note." },
    weight: 10,
    conditions: ALWAYS_TRUE,
    cooldownWeeks: 3,
    automaticOutcome: { effects: [], messages: [{ key: "long-horizon.event.minor.message", visible: true }] },
    tags: [],
  },
  {
    id: "event-choice",
    category: "random",
    title: { key: "long-horizon.event.choice.title", text: "A Small Decision" },
    description: { key: "long-horizon.event.choice.description", text: "Nothing that matters, but it still wants an answer." },
    weight: 8,
    conditions: ALWAYS_TRUE,
    cooldownWeeks: 4,
    choices: [
      {
        id: "choice-a",
        labelKey: "long-horizon.event.choice.a.label",
        outcomes: [{ outcome: { effects: [], messages: [{ key: "long-horizon.event.choice.a.outcome", visible: true }] } }],
      },
      {
        id: "choice-b",
        labelKey: "long-horizon.event.choice.b.label",
        outcomes: [{ outcome: { effects: [], messages: [{ key: "long-horizon.event.choice.b.outcome", visible: true }] } }],
      },
    ],
    tags: [],
  },
];

const npcs: SimulationCampaignSource["npcs"] = [
  {
    id: "npc-friend",
    name: { key: "long-horizon.npc.friend.name", text: "Sam" },
    description: { key: "long-horizon.npc.friend.description", text: "Always up for a chat." },
    defaultRole: "friend",
    initialRelationship: { affinity: 10, trust: 10, respect: 10, resentment: 0 },
    availability: [],
    tags: [],
  },
];

const opportunities: SimulationCampaignSource["opportunities"] = [
  {
    id: "opp-side-gig",
    kind: "job_offer",
    targetId: "job-accountant",
    name: { key: "long-horizon.opportunity.side-gig.name", text: "An Unsolicited Offer" },
    description: { key: "long-horizon.opportunity.side-gig.description", text: "A stranger thinks you'd be good with numbers." },
    durationWeeks: 4,
    weight: 10,
    requirements: [],
    contested: false,
    tags: [],
  },
];

const achievements: SimulationCampaignSource["achievements"] = [
  {
    id: "achievement-hard-worker",
    name: { key: "long-horizon.achievement.hard-worker.name", text: "Hard Worker" },
    description: { key: "long-horizon.achievement.hard-worker.description", text: "Showed up, week after week." },
    condition: { field: "player.counters.action_work", operator: "greater_or_equal", value: 5 },
    hidden: false,
    scope: "profile",
  },
];

const headlines: SimulationCampaignSource["headlines"] = [
  {
    id: "headline-generic",
    text: { key: "long-horizon.headline.generic.text", text: "Local Resident Continues To Exist" },
    tags: [],
  },
];

const employers: SimulationCampaignSource["employers"] = [
  {
    id: "employer-mainco",
    name: { key: "long-horizon.employer.mainco.name", text: "Mainco" },
    sector: "retail",
    reputation: 50,
    jobIds: ["job-cashier", "job-manager", "job-accountant"],
    npcIds: [],
  },
];

const backgrounds: SimulationCampaignSource["backgrounds"] = [
  {
    id: "background-default",
    name: { key: "long-horizon.background.default.name", text: "A Fresh Start" },
    description: { key: "long-horizon.background.default.description", text: "No particular head start, no particular deficit." },
    startingAttributes: {
      intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
      resilience: 50, wisdom: 50, luck: 50,
    },
    startingSkills: { bookkeeping: 0 },
    startingCredentials: [],
    startingTraits: [],
    startingCashModifierCents: 0,
  },
];

const winGoals: readonly GoalDefinitionSource[] = [
  {
    id: "goal-established",
    label: { key: "long-horizon.goal.established.label", text: "Established" },
    description: {
      key: "long-horizon.goal.established.description",
      text: "Hold a job for one hundred and fifty weeks running.",
    },
    category: "career",
    // `totalWeeksEmployed` (`CareerState`) is a strictly monotonic weekly counter
    // (`endOfWeek.ts`'s `advanceEmployment`) — no failureConditions needed or wanted; see
    // this file's own header for why this, and not a savings target, is the win condition.
    conditions: { field: "player.career.totalWeeksEmployed", operator: "greater_or_equal", value: 150 },
    requiredDurationWeeks: 2,
  },
];

const winScenarios: readonly ScenarioDefinitionSource[] = [
  {
    id: "scenario-long-horizon-win",
    name: { key: "long-horizon.win.scenario.name", text: "Long Horizon (Win)" },
    description: { key: "long-horizon.win.scenario.description", text: "One hundred and fifty weeks, played to hold a job." },
    startingBackgroundIds: ["background-default"],
    startingCashCents: 20000,
    startingHousingId: "housing-modest",
    startingLocationId: "home",
    startingInventory: [],
    goalIds: ["goal-established"],
    mode: "classic",
    goalFailurePrecedence: "goals_win",
  },
];

const lossGoals: readonly GoalDefinitionSource[] = [
  {
    id: "goal-stay-housed",
    label: { key: "long-horizon.goal.stay-housed.label", text: "Stay Housed" },
    description: { key: "long-horizon.goal.stay-housed.description", text: "Keep a roof, week after week." },
    category: "housing",
    // Trivially true every week and never completes (`requiredDurationWeeks` is set far
    // past this run's own length) — its only job is to carry `failureConditions`. See this
    // file's own header for why `goalFailurePrecedence: "failure_wins"` (below) is what
    // lets that failure actually land.
    conditions: ALWAYS_TRUE,
    requiredDurationWeeks: 999_999,
    failureConditions: { field: "player.housing.evictionStage", operator: "equals", value: "evicted" },
  },
];

const lossScenarios: readonly ScenarioDefinitionSource[] = [
  {
    id: "scenario-long-horizon-loss",
    name: { key: "long-horizon.loss.scenario.name", text: "Long Horizon (Loss)" },
    description: { key: "long-horizon.loss.scenario.description", text: "One hundred and fifty weeks, played to the end of the eviction ladder." },
    startingBackgroundIds: ["background-default"],
    // Exactly enough to cover `housing-modest`'s 4000-cent rent for ~155 weeks with no
    // income at all — the win run already proves employment end to end (this file's own
    // header). Once it runs out, the eviction ladder climbs to `"evicted"` over five more
    // weeks and `goal-stay-housed` fails right there.
    startingCashCents: 620_000,
    startingHousingId: "housing-modest",
    startingLocationId: "home",
    startingInventory: [],
    goalIds: ["goal-stay-housed"],
    mode: "classic",
    goalFailurePrecedence: "failure_wins",
  },
];

const sharedFields = {
  jobs, courses, housing, items, events, npcs, opportunities, achievements, headlines,
  employers, locations, backgrounds,
  traits: [] as SimulationCampaignSource["traits"],
  skills: [] as SimulationCampaignSource["skills"],
  projects: [] as SimulationCampaignSource["projects"],
  businesses: [] as SimulationCampaignSource["businesses"],
};

const winSource: SimulationCampaignSource = {
  description: { key: "long-horizon.win.campaign.description", text: "One hundred and fifty weeks, played to hold a job." },
  ...sharedFields,
  goals: winGoals,
  scenarios: winScenarios,
  difficulties: [],
  scenarioId: "scenario-long-horizon-win",
  goalFailurePrecedence: "goals_win",
  sceneTemplate: {
    key: "long-horizon.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "long-horizon.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "long-horizon.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "long-horizon.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "long-horizon.action.end-week.label", text: "End week" },
  },
};

const lossSource: SimulationCampaignSource = {
  description: { key: "long-horizon.loss.campaign.description", text: "One hundred and fifty weeks, played to the end of the eviction ladder." },
  ...sharedFields,
  goals: lossGoals,
  scenarios: lossScenarios,
  difficulties: [],
  scenarioId: "scenario-long-horizon-loss",
  goalFailurePrecedence: "failure_wins",
  sceneTemplate: {
    key: "long-horizon.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "long-horizon.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "long-horizon.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "long-horizon.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "long-horizon.action.end-week.label", text: "End week" },
  },
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see that file's doc comment. */
export function buildLongHorizonWinCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(winSource);
  const campaign: Campaign = {
    id: LONG_HORIZON_WIN_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "long-horizon-win.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "long-horizon-win.campaign.title", text: "Long Horizon (Win)" },
    ...authoredText,
  ]);
}

export function buildLongHorizonLossCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(lossSource);
  const campaign: Campaign = {
    id: LONG_HORIZON_LOSS_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "long-horizon-loss.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "long-horizon-loss.campaign.title", text: "Long Horizon (Loss)" },
    ...authoredText,
  ]);
}
