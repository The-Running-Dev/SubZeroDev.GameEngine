/**
 * W119 — every fixed action price is the campaign's (§7.14): `actionTimeCosts`, the three
 * need-delta records, `socializeAffinityGain`, `socializeTrustGain`, `applicationResolveWeeks`,
 * `negotiateRaiseBasisPoints`, `studyUnitsPerSession` and `projectProgressPerSession`.
 * Declared, built only when supplied, resolved per key at the point of use, and validated by
 * Tier 1.
 *
 * Contract: `10-simulation-kind.md` §7.14, §14; `20-contract.md` §7.14, §10.
 */

import { describe, it, expect } from "vitest";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../../authoring.js";
import { stableLifeSource } from "../../campaigns/stable-life.js";
import { initialState } from "./initial.js";
import { RESOLVER_TABLE, type ActionOutcome, type ActionValidation } from "./resolvers.js";
import { validateCampaign } from "./validate.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign, SimulationFixedTimeAction } from "./campaign.js";
import type {
  BusinessDefinition, CourseDefinition, EventDefinition, HousingDefinition, ItemDefinition, JobDefinition,
  LocationDefinition, NPCDefinition, OpportunityDefinition, ProjectDefinition,
} from "./content.js";
import type { BusinessRecord, CourseEnrollment, Employment, InventoryItem, ProjectRuntimeState } from "./actor.js";
import type { ActionType, GameAction } from "./plan.js";
import type { Opportunity, PendingEventResponse, SimulationKindState } from "./state.js";

// ---------------------------------------------------------------------------
// Fixtures — one state on which every one of the 31 action types under test is valid
// ---------------------------------------------------------------------------

const JOB: JobDefinition = {
  id: "job-cashier", titleKey: "k", descriptionKey: "k", employerId: "employer-1", careerPathId: "path-1", tier: "entry",
  schedule: { weeklyTimeCost: 6, flexibility: 50 },
  compensation: { baseWeeklyPayCents: 30000, overtimeRate: 5000 },
  requirements: [],
  performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
  promotionPaths: [], terminationRules: [], contested: false, tags: [],
};

const COURSE: CourseDefinition = {
  id: "course-bookkeeping", nameKey: "k", descriptionKey: "k", providerId: "provider-1",
  tuitionCents: 1000, durationWeeks: 2, weeklyTimeCost: 4, difficulty: 0,
  requirements: [], rewards: [],
  failureRules: { minimumAttendanceRatio: 50, minimumStudyUnitsPerWeek: 1, maximumMissedSessions: 1, tuitionGraceWeeks: 0, progressRetainedOnFailure: 25 },
  tags: [],
};

/** Not enrolled in — `enroll_course`'s target, since the first course already has an active
 *  enrollment for `attend_class`/`study`/`withdraw_course`. */
const OTHER_COURSE: CourseDefinition = { ...COURSE, id: "course-other" };

const HOUSING_CURRENT: HousingDefinition = {
  id: "housing-1", nameKey: "k", descriptionKey: "k",
  upfrontCostCents: 500, weeklyCostCents: 2000, depositCents: 500,
  capacity: 1, comfort: 50, safety: 50, prestige: 10, storage: 20,
  commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0,
  maintenanceRisk: 10, requirements: [], tags: [],
};

const HOUSING_NEXT: HousingDefinition = { ...HOUSING_CURRENT, id: "housing-2" };

const BICYCLE: ItemDefinition = {
  id: "item-bicycle", nameKey: "k", descriptionKey: "k", category: "transport",
  purchasePriceCents: 4000, baseResaleValueCents: 2000,
  effects: [], stacking: "refresh", durability: 100,
  maintenanceRules: [{ intervalWeeks: 2, costCents: 500, timeCost: 1, conditionLossIfSkipped: 30, breakageChanceAtZeroCondition: 0 }],
  requirements: [], tags: [],
};

const TRINKET: ItemDefinition = {
  id: "item-trinket", nameKey: "k", descriptionKey: "k", category: "misc",
  purchasePriceCents: 200, baseResaleValueCents: 100,
  effects: [], stacking: "refresh", requirements: [], tags: [],
};

const NEIGHBOUR: NPCDefinition = {
  id: "npc-neighbour", nameKey: "k", descriptionKey: "k", defaultRole: "neighbour",
  initialRelationship: { affinity: 10, trust: 10, respect: 10, resentment: 0 },
  availability: [{ locationId: "loc-all" }], tags: [],
};

/** `requiredUnits` well above any session's progress, so `work_on_project` never completes
 *  and the only path a progress change can move is `progressUnits` itself. */
const PROJECT: ProjectDefinition = {
  id: "project-novel", nameKey: "k", descriptionKey: "k",
  requirements: [], requiredUnits: 50, weeklyTimeCost: 3, startCostCents: 1000, rewards: [], tags: [],
};

const BUSINESS: BusinessDefinition = {
  id: "business-stall", nameKey: "k", descriptionKey: "k",
  requirements: [], startupCostCents: 2000,
  weeklyRevenueCents: 3000, weeklyExpensesCents: 1000, minimumCashCents: 0, tags: [],
};

const OPPORTUNITY: OpportunityDefinition = {
  id: "def-stall", kind: "business", targetId: "business-stall", nameKey: "k", descriptionKey: "k",
  durationWeeks: 2, weight: 1, requirements: [], contested: false, tags: [],
};

const EVENT: EventDefinition = {
  id: "event-letter", category: "test", titleKey: "k", descriptionKey: "k", weight: 1,
  conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
  choices: [{ id: "c-open", labelKey: "k", timeCost: 2, moneyCostCents: 500, outcomes: [{ outcome: { effects: [], messages: [] } }] }],
  tags: [],
};

/** Every action type under test, so no case fails on location. */
const ALL_LOCATION: LocationDefinition = {
  id: "loc-all", nameKey: "k", descriptionKey: "k", connections: ["loc-next"], travelTimeUnits: 0,
  actionTypes: [
    "search_for_work", "apply_for_job", "negotiate_job_terms", "work", "work_overtime",
    "enroll_course", "attend_class", "study", "withdraw_course",
    "move_housing", "pay_bills", "borrow_money", "repay_debt", "deposit_savings", "invest",
    "shop", "maintain_item", "repair_item", "sell_item", "travel", "socialize", "exercise",
    "start_project", "work_on_project", "start_business",
  ],
};

const NEXT_LOCATION: LocationDefinition = {
  id: "loc-next", nameKey: "k", descriptionKey: "k", connections: ["loc-all"], travelTimeUnits: 3, actionTypes: [],
};

const CONTENT: SimulationCampaign = {
  descriptionKey: "k",
  jobs: [JOB], courses: [COURSE, OTHER_COURSE], housing: [HOUSING_CURRENT, HOUSING_NEXT],
  items: [BICYCLE, TRINKET], events: [EVENT], npcs: [NEIGHBOUR], goals: [],
  scenarios: [], difficulties: [], opportunities: [OPPORTUNITY], achievements: [], headlines: [], employers: [],
  locations: [ALL_LOCATION, NEXT_LOCATION], backgrounds: [], traits: [], skills: [],
  projects: [PROJECT], businesses: [BUSINESS],
  scenarioId: "scenario-1", goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "k", actionLabelKeys: { planAdd: "k", planRemove: "k", planClear: "k", endWeek: "k" },
};

function campaignOf(extra: Partial<SimulationCampaign>): Campaign {
  return { id: "test-w119", kindId: "simulation", version: "1.0.0", titleKey: "k", content: { ...CONTENT, ...extra } };
}

function ctx(extra: Partial<SimulationCampaign> = {}): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign: campaignOf(extra),
    // nextPercent 0 is below charisma 50, so `negotiate_job_terms` always succeeds.
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() { return this.rng; },
    seq: 1,
    emit: { emit: () => undefined },
  };
}

const EMPLOYMENT: Employment = {
  jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
  performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
};

const ENROLLMENT: CourseEnrollment = {
  courseId: "course-bookkeeping", startedWeek: 1, weeksCompleted: 0, attendedUnits: 0, studyUnits: 0,
  missedSessions: 0, tuitionPaidCents: 1000, tuitionOutstandingCents: 0, retainedProgress: 0, status: "active",
};

const BICYCLE_OWNED: InventoryItem = {
  instanceId: "inv-1", definitionId: "item-bicycle", quantity: 1, acquiredWeek: 1,
  purchasePriceCents: 4000, condition: 50, weeksSinceMaintenance: 2, broken: false,
};

const PROJECT_RUNNING: ProjectRuntimeState = { instanceId: "proj-1", definitionId: "project-novel", startedWeek: 1, progressUnits: 4, status: "in_progress" };
const BUSINESS_OPEN: BusinessRecord = { instanceId: "biz-1", definitionId: "business-stall", startedWeek: 1, cashOnHandCents: 0, weeksOperated: 1, status: "operating" };
const STANDING: Opportunity = { id: "open-1", definitionId: "def-stall", kind: "business", targetId: "business-stall", offeredWeek: 2, expiresAtWeek: 8 };
const PENDING: PendingEventResponse = { id: "pending-1", eventId: "event-letter", rolledWeek: 2, presentWeek: 3, availableChoiceIds: ["c-open"] };

function baseState(): SimulationKindState {
  return {
    calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
      currentLocationId: "loc-all",
      finances: { cashCents: 20000, savingsCents: 0, debtCents: 5000, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
      needs: { health: 60, energy: 60, happiness: 60, stress: 20, satiety: 60 },
      attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      education: { enrollments: [ENROLLMENT], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: EMPLOYMENT },
      housing: {
        definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
        weeklyCostCents: 0, utilitiesCents: 0, transportCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
        missedPayments: 0, evictionStage: "none",
      },
      inventory: [BICYCLE_OWNED], relationships: [], projects: [PROJECT_RUNNING], businesses: [BUSINESS_OPEN],
      skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
    },
    economy: { inflation: 200, unemploymentRate: 500, interestRate: 300, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      npcs: [], locations: [], jobMarket: { openings: [{ jobId: "job-cashier", contested: false, postedWeek: 1 }] },
      eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {},
    },
    activeEffects: [], activeOpportunities: [STANDING], scheduledEvents: [], pendingEventResponses: [PENDING],
    goals: [], resolution: null, plan: null,
  };
}

/** `pay_bills` needs rent owing; `move_housing` refuses while any is. Only the former gets it. */
function owingRent(state: SimulationKindState): SimulationKindState {
  return { ...state, player: { ...state.player, housing: { ...state.player.housing, overdueRentCents: 500 } } };
}

function withSpent(state: SimulationKindState, spentTimeUnits: number): SimulationKindState {
  return { ...state, calendar: { ...state.calendar, spentTimeUnits } };
}

interface Case {
  readonly targetId?: string;
  readonly parameters?: Record<string, unknown>;
  readonly state?: (state: SimulationKindState) => SimulationKindState;
}

/** Exhaustive over `SimulationFixedTimeAction` — a member added to the union fails typecheck
 *  here until it has a case. */
const FIXED_CASES: Readonly<Record<SimulationFixedTimeAction, Case>> = {
  search_for_work: {},
  apply_for_job: { targetId: "job-cashier" },
  negotiate_job_terms: {},
  work_overtime: {},
  study: { targetId: "course-bookkeeping" },
  move_housing: { targetId: "housing-2" },
  borrow_money: { parameters: { amountCents: 1000 } },
  repay_debt: { parameters: { amountCents: 1000 } },
  deposit_savings: { parameters: { amountCents: 1000 } },
  invest: { parameters: { amountCents: 1000 } },
  shop: { targetId: "item-trinket" },
  repair_item: { targetId: "inv-1" },
  sell_item: { targetId: "inv-1" },
  socialize: { targetId: "npc-neighbour" },
  exercise: {},
  start_project: { targetId: "project-novel" },
  start_business: { targetId: "business-stall" },
  eat: {},
  rest: {},
  enroll_course: { targetId: "course-other" },
  attend_class: { targetId: "course-bookkeeping" },
  withdraw_course: { targetId: "course-bookkeeping" },
  pay_bills: { state: owingRent },
  accept_opportunity: { targetId: "open-1" },
  decline_opportunity: { targetId: "open-1" },
  operate_business: { targetId: "biz-1" },
};

/** The five actions whose time cost content owns, and the cost content gives each here. */
const CONTENT_CASES: Readonly<Record<"work" | "travel" | "maintain_item" | "work_on_project" | "respond_to_event", Case & { readonly cost: number }>> = {
  work: { cost: 6 },
  travel: { targetId: "loc-next", cost: 3 },
  maintain_item: { targetId: "inv-1", cost: 1 },
  work_on_project: { targetId: "proj-1", cost: 3 },
  respond_to_event: { targetId: "pending-1", parameters: { choiceId: "c-open" }, cost: 2 },
};

const ALL_CASES: Readonly<Record<string, Case>> = { ...FIXED_CASES, ...CONTENT_CASES };

/** Today's numbers, written out independently of the resolver's own default table: what
 *  `canExecute` reported as `calculatedTimeCost` before W119. `undefined` is "not reported at
 *  all" — `eat` and `rest` never carried the field. */
const TODAY_TIME_COST: Readonly<Record<SimulationFixedTimeAction, number | undefined>> = {
  search_for_work: 2, apply_for_job: 1, negotiate_job_terms: 1, work_overtime: 4, study: 2,
  move_housing: 4, borrow_money: 1, repay_debt: 1, deposit_savings: 1, invest: 1, shop: 1,
  repair_item: 2, sell_item: 1, socialize: 2, exercise: 2, start_project: 1, start_business: 1,
  eat: undefined, rest: undefined,
  enroll_course: 0, attend_class: 0, withdraw_course: 0, pay_bills: 0,
  accept_opportunity: 0, decline_opportunity: 0, operate_business: 0,
};

const FIXED_ACTIONS = Object.keys(FIXED_CASES) as SimulationFixedTimeAction[];
const ZERO_DEFAULT_ACTIONS = FIXED_ACTIONS.filter((type) => !(TODAY_TIME_COST[type]! > 0));

interface Run {
  readonly validation: ActionValidation;
  readonly outcome: ActionOutcome;
  readonly next: SimulationKindState;
}

function run(type: string, extra: Partial<SimulationCampaign> = {}, adjust?: (state: SimulationKindState) => SimulationKindState): Run {
  const c = ALL_CASES[type]!;
  const resolver = RESOLVER_TABLE[type as Exclude<ActionType, "custom">];
  const action: GameAction = {
    id: "action-1", type: type as ActionType, actorId: "player",
    ...(c.targetId !== undefined ? { targetId: c.targetId } : {}),
    parameters: c.parameters ?? {},
  };
  let state = c.state ? c.state(baseState()) : baseState();
  if (adjust) state = adjust(state);
  const context = ctx(extra);
  const validation = resolver.canExecute(state, action, context);
  const outcome = resolver.calculate(state, action, context);
  return { validation, outcome, next: resolver.apply(state, outcome) };
}

function spentChange(outcome: ActionOutcome) {
  return outcome.changes.filter((c) => c.path === "calendar.spentTimeUnits");
}

/** The paths whose changes differ between two outcomes, sorted. */
function divergentPaths(a: ActionOutcome, b: ActionOutcome): string[] {
  const paths = new Set([...a.changes, ...b.changes].map((c) => c.path));
  const at = (o: ActionOutcome, path: string) => JSON.stringify(o.changes.filter((c) => c.path === path));
  return [...paths].filter((path) => at(a, path) !== at(b, path)).sort();
}

// ---------------------------------------------------------------------------
// W119.1 — declared, and copied by the builder only when supplied
// ---------------------------------------------------------------------------

const TEN_FIELDS = {
  actionTimeCosts: { eat: 2 },
  eatNeedDeltas: { satiety: 30 },
  restNeedDeltas: { stress: -8 },
  exerciseNeedDeltas: { health: 7 },
  socializeAffinityGain: 9,
  socializeTrustGain: -1,
  applicationResolveWeeks: 3,
  negotiateRaiseBasisPoints: 1000,
  studyUnitsPerSession: 2,
  projectProgressPerSession: 2,
} as const satisfies Partial<SimulationCampaignSource>;

describe("W119.1 — the builder copies each of the ten fields only when supplied", () => {
  it("an omitted field stays absent from the built campaign, all ten", () => {
    const { content } = buildSimulationCampaign(stableLifeSource);
    for (const field of Object.keys(TEN_FIELDS)) expect(field in content).toBe(false);
  });

  it.each(Object.entries(TEN_FIELDS))("%s: supplying it copies it, and only it", (field, value) => {
    const source = { ...stableLifeSource, [field]: value } as SimulationCampaignSource;
    const { content } = buildSimulationCampaign(source);
    expect((content as unknown as Record<string, unknown>)[field]).toEqual(value);
    for (const other of Object.keys(TEN_FIELDS).filter((f) => f !== field)) expect(other in content).toBe(false);
  });

  it("a partial record stays partial — no default key is materialized", () => {
    const { content } = buildSimulationCampaign({
      ...stableLifeSource, actionTimeCosts: { eat: 2 }, exerciseNeedDeltas: { stress: -1 }, restNeedDeltas: {},
    });
    expect(content.actionTimeCosts).toEqual({ eat: 2 });
    expect(Object.keys(content.actionTimeCosts!)).toEqual(["eat"]);
    expect(content.exerciseNeedDeltas).toEqual({ stress: -1 });
    expect(content.restNeedDeltas).toEqual({});
  });

  it("explicit zero is a supplied value, not absence", () => {
    const { content } = buildSimulationCampaign({ ...stableLifeSource, socializeTrustGain: 0, negotiateRaiseBasisPoints: 0, actionTimeCosts: { shop: 0 } });
    expect(content.socializeTrustGain).toBe(0);
    expect(content.negotiateRaiseBasisPoints).toBe(0);
    expect(content.actionTimeCosts).toEqual({ shop: 0 });
  });
});

// ---------------------------------------------------------------------------
// W119.2 — an omitted key is today's cost and audit shape, all 26 keys
// ---------------------------------------------------------------------------

describe("W119.2 — every actionTimeCosts key, omitted, reproduces today's time cost and shape", () => {
  it("the table covers all 26 keys", () => {
    expect(FIXED_ACTIONS).toHaveLength(26);
    expect(ZERO_DEFAULT_ACTIONS).toHaveLength(9);
  });

  it.each(FIXED_ACTIONS)("%s", (type) => {
    const omitted = run(type);
    expect(omitted.validation.valid).toBe(true);
    expect(omitted.validation.calculatedTimeCost).toBe(TODAY_TIME_COST[type]);
    if (TODAY_TIME_COST[type] === undefined) expect("calculatedTimeCost" in omitted.validation).toBe(false);

    const today = TODAY_TIME_COST[type] ?? 0;
    if (today > 0) {
      expect(spentChange(omitted.outcome)).toEqual([
        { path: "calendar.spentTimeUnits", op: "increment", value: today, reason: `action_${type}`, visible: true },
      ]);
    } else {
      expect(spentChange(omitted.outcome)).toEqual([]);
    }
    expect(omitted.next.calendar.spentTimeUnits - (ALL_CASES[type]!.state?.(baseState()) ?? baseState()).calendar.spentTimeUnits).toBe(today);

    // The same key supplied at today's value, and every *other* key supplied at 9: both are
    // indistinguishable from omission, so the key resolves alone and the record never replaces.
    const explicit = run(type, { actionTimeCosts: { [type]: today } });
    expect(explicit).toEqual(omitted);
    const others = Object.fromEntries(FIXED_ACTIONS.filter((t) => t !== type).map((t) => [t, 9]));
    expect(run(type, { actionTimeCosts: others })).toEqual(omitted);
  });

  it.each(FIXED_ACTIONS)("%s priced at 9 diverges from today only on its own action", (type) => {
    for (const other of Object.keys(ALL_CASES)) {
      if (other === type) continue;
      expect(run(other, { actionTimeCosts: { [type]: 9 } })).toEqual(run(other));
    }
    const priced = run(type, { actionTimeCosts: { [type]: 9 } });
    expect(priced.validation.calculatedTimeCost).toBe(9);
    expect(spentChange(priced.outcome).map((c) => c.value)).toEqual([9]);
  });
});

// ---------------------------------------------------------------------------
// W119.3 — a zero-default action priced positive checks, reports and spends time
// ---------------------------------------------------------------------------

describe("W119.3 — a zero-default action priced positive", () => {
  it("eat at 3: reports it, fails insufficient_time when short, leads with the spent change, and apply consumes exactly it", () => {
    const priced = run("eat", { actionTimeCosts: { eat: 3 } });
    expect(priced.validation).toEqual({ valid: true, errors: [], warnings: [], calculatedTimeCost: 3 });
    expect(priced.outcome.changes[0]).toEqual({ path: "calendar.spentTimeUnits", op: "increment", value: 3, reason: "action_eat", visible: true });
    expect(priced.next.calendar.spentTimeUnits).toBe(3);
    // Satiety still moves exactly as it did unpriced.
    expect(priced.next.player.needs).toEqual(run("eat").next.player.needs);

    const short = run("eat", { actionTimeCosts: { eat: 3 } }, (s) => withSpent(s, 12));
    expect(short.validation).toEqual({ valid: false, errors: [{ code: "insufficient_time", messageKey: "simulation.reason.insufficient_time" }], warnings: [] });
    const exact = run("eat", { actionTimeCosts: { eat: 3 } }, (s) => withSpent(s, 11));
    expect(exact.validation.valid).toBe(true);
  });

  it("apply consumes the outcome's value, not a recomputed one", () => {
    const priced = run("eat", { actionTimeCosts: { eat: 3 } });
    const tampered: ActionOutcome = {
      ...priced.outcome,
      changes: priced.outcome.changes.map((c) => (c.path === "calendar.spentTimeUnits" ? { ...c, value: 5 } : c)),
    };
    expect(RESOLVER_TABLE.eat.apply(baseState(), tampered).calendar.spentTimeUnits).toBe(5);
  });

  it("eat at an explicit 0 keeps today's shape exactly", () => {
    const zero = run("eat", { actionTimeCosts: { eat: 0 } });
    expect(zero).toEqual(run("eat"));
    expect("calculatedTimeCost" in zero.validation).toBe(false);
    expect(spentChange(zero.outcome)).toEqual([]);
  });

  it.each(ZERO_DEFAULT_ACTIONS)("%s priced at 3 checks, reports and spends time", (type) => {
    const priced = run(type, { actionTimeCosts: { [type]: 3 } });
    expect(priced.validation.valid).toBe(true);
    expect(priced.validation.calculatedTimeCost).toBe(3);
    expect(priced.outcome.changes[0]).toEqual({ path: "calendar.spentTimeUnits", op: "increment", value: 3, reason: `action_${type}`, visible: true });
    expect(priced.next.calendar.spentTimeUnits).toBe(3);

    const short = run(type, { actionTimeCosts: { [type]: 3 } }, (s) => withSpent(s, 12));
    expect(short.validation.errors.map((e) => e.code)).toEqual(["insufficient_time"]);
  });

  it("an action's own failure still wins over a priced time check", () => {
    // No rent owing: `pay_bills` is `requirement_unmet` whatever its price.
    const result = RESOLVER_TABLE.pay_bills.canExecute(
      withSpent(baseState(), 14), { id: "action-1", type: "pay_bills", actorId: "player", parameters: {} }, ctx({ actionTimeCosts: { pay_bills: 3 } }),
    );
    expect(result.errors.map((e) => e.code)).toEqual(["requirement_unmet"]);
  });
});

// ---------------------------------------------------------------------------
// W119.4 — need deltas resolve per key
// ---------------------------------------------------------------------------

describe("W119.4 — need deltas resolve per key, signed", () => {
  it("one exerciseNeedDeltas key changes only that need", () => {
    const today = run("exercise");
    const tuned = run("exercise", { exerciseNeedDeltas: { happiness: 10 } });
    expect(divergentPaths(today.outcome, tuned.outcome)).toEqual(["player.needs.happiness"]);
    expect(tuned.next.player.needs).toEqual({ ...today.next.player.needs, happiness: 70 });
    expect(today.next.player.needs).toEqual({ health: 65, energy: 50, happiness: 63, stress: 15, satiety: 55 });
  });

  it("rest's stress is a signed delta: the default −5 lowers it, a supplied +5 raises it", () => {
    expect(run("rest").next.player.needs.stress).toBe(15);
    const raised = run("rest", { restNeedDeltas: { stress: 5 } });
    expect(raised.next.player.needs.stress).toBe(25);
    expect(raised.next.player.needs.energy).toBe(80);
  });

  it("a key supplied at 0 records no change for that need and leaves the others at default", () => {
    const tuned = run("rest", { restNeedDeltas: { energy: 0 } });
    expect(tuned.outcome.changes.map((c) => c.path)).toEqual(["player.needs.stress"]);
    expect(tuned.next.player.needs).toEqual({ ...baseState().player.needs, stress: 15 });
  });

  it("an eat key outside the default adds that need and keeps satiety +25", () => {
    const tuned = run("eat", { eatNeedDeltas: { health: -4 } });
    expect(tuned.outcome.changes.map((c) => c.path)).toEqual(["player.needs.health", "player.needs.satiety"]);
    expect(tuned.next.player.needs).toEqual({ ...baseState().player.needs, health: 56, satiety: 85 });
  });

  it("a delta is clamped once, to the need's bounds", () => {
    expect(run("eat", { eatNeedDeltas: { satiety: 500 } }).next.player.needs.satiety).toBe(100);
    expect(run("exercise", { exerciseNeedDeltas: { stress: -500 } }).next.player.needs.stress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W119.5 — each scalar field diverges only on the path it governs
// ---------------------------------------------------------------------------

/** Each non-time-cost field, a value off its default, the one action it governs, and the one
 *  path that action's outcome may move. */
const GOVERNED: readonly (readonly [keyof SimulationCampaign, unknown, string, string | undefined])[] = [
  ["socializeAffinityGain", 9, "socialize", "player.relationships.npc-neighbour.affinity"],
  ["socializeTrustGain", 7, "socialize", "player.relationships.npc-neighbour.trust"],
  ["applicationResolveWeeks", 3, "apply_for_job", "player.career.pendingApplications.job-cashier.resolvesWeek"],
  ["negotiateRaiseBasisPoints", 1000, "negotiate_job_terms", "player.career.currentEmployment.weeklyPayCents"],
  ["studyUnitsPerSession", 3, "study", "player.education.enrollments.course-bookkeeping.studyUnits"],
  ["projectProgressPerSession", 2, "work_on_project", "player.projects.proj-1.progressUnits"],
  ["eatNeedDeltas", { satiety: 10 }, "eat", "player.needs.satiety"],
  ["restNeedDeltas", { energy: 5 }, "rest", "player.needs.energy"],
  ["exerciseNeedDeltas", { health: 1 }, "exercise", "player.needs.health"],
];

describe("W119.5 — a fixture pair differing in one field diverges only on that field's path", () => {
  it.each(GOVERNED)("%s", (field, value, governed, path) => {
    for (const type of Object.keys(ALL_CASES)) {
      const today = run(type);
      const tuned = run(type, { [field]: value } as Partial<SimulationCampaign>);
      if (type !== governed) {
        expect(tuned).toEqual(today);
        continue;
      }
      expect(tuned.validation).toEqual(today.validation);
      expect(divergentPaths(today.outcome, tuned.outcome)).toEqual([path]);
    }
  });

  it("the six scalars land the value they name", () => {
    const rel = (r: Run) => r.next.player.relationships.find((x) => x.npcId === "npc-neighbour")!;
    expect(rel(run("socialize")).affinity).toBe(15);
    expect(rel(run("socialize", { socializeAffinityGain: 9 })).affinity).toBe(19);
    expect(rel(run("socialize")).trust).toBe(12);
    expect(rel(run("socialize", { socializeTrustGain: -3 })).trust).toBe(7);

    const application = (r: Run) => r.next.player.career.pendingApplications.find((a) => a.jobId === "job-cashier")!;
    expect(application(run("apply_for_job")).resolvesWeek).toBe(4);
    expect(application(run("apply_for_job", { applicationResolveWeeks: 3 })).resolvesWeek).toBe(6);

    const pay = (r: Run) => r.next.player.career.currentEmployment!.weeklyPayCents;
    expect(pay(run("negotiate_job_terms"))).toBe(31500);
    expect(pay(run("negotiate_job_terms", { negotiateRaiseBasisPoints: 1000 }))).toBe(33000);
    expect(pay(run("negotiate_job_terms", { negotiateRaiseBasisPoints: 0 }))).toBe(30000);

    const studied = (r: Run) => r.next.player.education.enrollments.find((e) => e.courseId === "course-bookkeeping")!.studyUnits;
    expect(studied(run("study"))).toBe(1);
    expect(studied(run("study", { studyUnitsPerSession: 3 }))).toBe(3);

    const progress = (r: Run) => r.next.player.projects.find((p) => p.instanceId === "proj-1")!.progressUnits;
    expect(progress(run("work_on_project"))).toBe(5);
    expect(progress(run("work_on_project", { projectProgressPerSession: 2 }))).toBe(6);
  });

  it("work, travel, maintain_item, work_on_project and respond_to_event keep their content cost under every new field", () => {
    const everything: Partial<SimulationCampaign> = {
      actionTimeCosts: Object.fromEntries(FIXED_ACTIONS.map((t) => [t, 7])),
      eatNeedDeltas: { satiety: 1 }, restNeedDeltas: { energy: 1 }, exerciseNeedDeltas: { energy: 1 },
      socializeAffinityGain: 1, socializeTrustGain: 1, applicationResolveWeeks: 2,
      negotiateRaiseBasisPoints: 1, studyUnitsPerSession: 2, projectProgressPerSession: 2,
    };
    for (const [type, { cost }] of Object.entries(CONTENT_CASES)) {
      const today = run(type);
      const tuned = run(type, everything);
      expect(today.validation.calculatedTimeCost).toBe(cost);
      expect(tuned.validation).toEqual(today.validation);
      expect(spentChange(tuned.outcome)).toEqual(spentChange(today.outcome));
      expect(spentChange(today.outcome).map((c) => c.value)).toEqual([cost]);
      expect(tuned.next.calendar).toEqual(today.next.calendar);
    }
  });
});

// ---------------------------------------------------------------------------
// W119.6 — Tier 1
// ---------------------------------------------------------------------------

describe("W119.6 — Tier 1 validation of the action physics", () => {
  const STRINGS = new Map([["k", "text"]]);
  const validate = (extra: Record<string, unknown>) => validateCampaign(campaignOf(extra as Partial<SimulationCampaign>), STRINGS);
  const codesAt = (extra: Record<string, unknown>) => validate(extra).errors.map((e) => `${e.code}@${e.path}`);

  const PASSING: readonly [string, Record<string, unknown>][] = [
    ["an omitted set", {}],
    ["an empty actionTimeCosts", { actionTimeCosts: {} }],
    ["all 26 actionTimeCosts at today's values", { actionTimeCosts: { ...TODAY_TIME_COST, eat: 0, rest: 0 } }],
    ["actionTimeCosts eat 0", { actionTimeCosts: { eat: 0 } }],
    ["actionTimeCosts eat 3, rest 2", { actionTimeCosts: { eat: 3, rest: 2 } }],
    ["a null-prototype record", { actionTimeCosts: Object.assign(Object.create(null) as object, { shop: 1 }) }],
    ["eatNeedDeltas satiety 25", { eatNeedDeltas: { satiety: 25 } }],
    ["restNeedDeltas signed and zero", { restNeedDeltas: { stress: -5, energy: 0 } }],
    ["exerciseNeedDeltas all five keys", { exerciseNeedDeltas: { energy: -10, happiness: 3, health: 5, satiety: -5, stress: -5 } }],
    ["socializeAffinityGain negative", { socializeAffinityGain: -3 }],
    ["socializeTrustGain 0", { socializeTrustGain: 0 }],
    ["applicationResolveWeeks 1", { applicationResolveWeeks: 1 }],
    ["applicationResolveWeeks 4", { applicationResolveWeeks: 4 }],
    ["negotiateRaiseBasisPoints 0", { negotiateRaiseBasisPoints: 0 }],
    ["negotiateRaiseBasisPoints 10000", { negotiateRaiseBasisPoints: 10000 }],
    ["studyUnitsPerSession 1", { studyUnitsPerSession: 1 }],
    ["projectProgressPerSession 3", { projectProgressPerSession: 3 }],
  ];

  const REJECTING: readonly [string, Record<string, unknown>, string][] = [
    ["an action cost negative", { actionTimeCosts: { search_for_work: -1 } }, "invalid_tuning_value@actionTimeCosts.search_for_work"],
    ["an action cost a fraction", { actionTimeCosts: { apply_for_job: 1.5 } }, "invalid_tuning_value@actionTimeCosts.apply_for_job"],
    ["an action cost NaN", { actionTimeCosts: { eat: Number.NaN } }, "invalid_tuning_value@actionTimeCosts.eat"],
    ["an action cost Infinity", { actionTimeCosts: { rest: Number.POSITIVE_INFINITY } }, "invalid_tuning_value@actionTimeCosts.rest"],
    ["an action cost a string", { actionTimeCosts: { shop: "1" } }, "invalid_tuning_value@actionTimeCosts.shop"],
    ["an action cost null", { actionTimeCosts: { invest: null } }, "invalid_tuning_value@actionTimeCosts.invest"],
    ["a content-costed action key", { actionTimeCosts: { work: 3 } }, "unknown_tuning_key@actionTimeCosts.work"],
    ["an unknown action key", { actionTimeCosts: { custom: 1 } }, "unknown_tuning_key@actionTimeCosts.custom"],
    ["an inherited name as an action key", { actionTimeCosts: { constructor: 1 } }, "unknown_tuning_key@actionTimeCosts.constructor"],
    ["actionTimeCosts a number", { actionTimeCosts: 3 }, "invalid_tuning_value@actionTimeCosts"],
    ["actionTimeCosts an array", { actionTimeCosts: [1, 2] }, "invalid_tuning_value@actionTimeCosts"],
    ["actionTimeCosts null", { actionTimeCosts: null }, "invalid_tuning_value@actionTimeCosts"],
    ["an eat delta a fraction", { eatNeedDeltas: { satiety: 2.5 } }, "invalid_tuning_value@eatNeedDeltas.satiety"],
    ["an eat delta for an unknown need", { eatNeedDeltas: { hunger: 5 } }, "unknown_tuning_key@eatNeedDeltas.hunger"],
    ["eatNeedDeltas a string", { eatNeedDeltas: "25" }, "invalid_tuning_value@eatNeedDeltas"],
    ["a rest delta NaN", { restNeedDeltas: { stress: Number.NaN } }, "invalid_tuning_value@restNeedDeltas.stress"],
    ["a rest delta for an unknown need", { restNeedDeltas: { sleep: 1 } }, "unknown_tuning_key@restNeedDeltas.sleep"],
    ["an exercise delta Infinity", { exerciseNeedDeltas: { health: Number.NEGATIVE_INFINITY } }, "invalid_tuning_value@exerciseNeedDeltas.health"],
    ["exerciseNeedDeltas an array", { exerciseNeedDeltas: [5] }, "invalid_tuning_value@exerciseNeedDeltas"],
    ["socializeAffinityGain a fraction", { socializeAffinityGain: 1.5 }, "invalid_tuning_value@socializeAffinityGain"],
    ["socializeAffinityGain NaN", { socializeAffinityGain: Number.NaN }, "invalid_tuning_value@socializeAffinityGain"],
    ["socializeTrustGain a string", { socializeTrustGain: "2" }, "invalid_tuning_value@socializeTrustGain"],
    ["socializeTrustGain Infinity", { socializeTrustGain: Number.POSITIVE_INFINITY }, "invalid_tuning_value@socializeTrustGain"],
    ["applicationResolveWeeks 0", { applicationResolveWeeks: 0 }, "invalid_tuning_value@applicationResolveWeeks"],
    ["applicationResolveWeeks negative", { applicationResolveWeeks: -1 }, "invalid_tuning_value@applicationResolveWeeks"],
    ["applicationResolveWeeks a fraction", { applicationResolveWeeks: 1.5 }, "invalid_tuning_value@applicationResolveWeeks"],
    ["negotiateRaiseBasisPoints negative", { negotiateRaiseBasisPoints: -1 }, "invalid_tuning_value@negotiateRaiseBasisPoints"],
    ["negotiateRaiseBasisPoints a fraction", { negotiateRaiseBasisPoints: 2.5 }, "invalid_tuning_value@negotiateRaiseBasisPoints"],
    ["negotiateRaiseBasisPoints NaN", { negotiateRaiseBasisPoints: Number.NaN }, "invalid_tuning_value@negotiateRaiseBasisPoints"],
    ["studyUnitsPerSession 0", { studyUnitsPerSession: 0 }, "invalid_tuning_value@studyUnitsPerSession"],
    ["studyUnitsPerSession negative", { studyUnitsPerSession: -2 }, "invalid_tuning_value@studyUnitsPerSession"],
    ["projectProgressPerSession 0", { projectProgressPerSession: 0 }, "invalid_tuning_value@projectProgressPerSession"],
    ["projectProgressPerSession a fraction", { projectProgressPerSession: 0.5 }, "invalid_tuning_value@projectProgressPerSession"],
  ];

  it.each(PASSING)("passes %s with no error and no warning of its own", (_name, extra) => {
    const result = validate(extra);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(validate({}).warnings);
  });

  it.each(REJECTING)("rejects %s", (_name, extra, expected) => {
    const result = validate(extra);
    expect(result.ok).toBe(false);
    expect(codesAt(extra)).toEqual([expected]);
  });

  it("carries the registered message key for each code", () => {
    expect(validate({ studyUnitsPerSession: 0 }).errors[0]?.messageKey).toBe("simulation.reason.invalid_tuning_value");
    expect(validate({ actionTimeCosts: { work: 1 } }).errors[0]?.messageKey).toBe("simulation.reason.unknown_tuning_key");
  });

  it("an unknown key's value is not also checked", () => {
    expect(codesAt({ actionTimeCosts: { work: -1.5 } })).toEqual(["unknown_tuning_key@actionTimeCosts.work"]);
  });

  it("reports one error per offending key and per offending field", () => {
    expect(codesAt({
      actionTimeCosts: { eat: -1, rest: 0.5, shop: 1, work: 2 },
      eatNeedDeltas: { satiety: 1.5 }, restNeedDeltas: 4,
      socializeAffinityGain: 0.5, applicationResolveWeeks: 0, negotiateRaiseBasisPoints: -5,
      studyUnitsPerSession: 0, projectProgressPerSession: -1, socializeTrustGain: Number.NaN,
    }).sort()).toEqual([
      "invalid_tuning_value@actionTimeCosts.eat",
      "invalid_tuning_value@actionTimeCosts.rest",
      "invalid_tuning_value@applicationResolveWeeks",
      "invalid_tuning_value@eatNeedDeltas.satiety",
      "invalid_tuning_value@negotiateRaiseBasisPoints",
      "invalid_tuning_value@projectProgressPerSession",
      "invalid_tuning_value@restNeedDeltas",
      "invalid_tuning_value@socializeAffinityGain",
      "invalid_tuning_value@socializeTrustGain",
      "invalid_tuning_value@studyUnitsPerSession",
      "unknown_tuning_key@actionTimeCosts.work",
    ]);
  });

  it("a path never carries an array index", () => {
    for (const error of validate({ actionTimeCosts: [1, 2], exerciseNeedDeltas: [3] }).errors) {
      expect(error.path).not.toMatch(/\[\d+\]|\.\d+(\.|$)/);
    }
  });

  it("the counts this slice claims: 17 passing, 33 rejecting table rows", () => {
    expect(PASSING).toHaveLength(17);
    expect(REJECTING).toHaveLength(33);
  });
});

// ---------------------------------------------------------------------------
// W119.7 — a campaign that omits every field is today's campaign
// ---------------------------------------------------------------------------

describe("W119.7 — omitting every field is today's behaviour", () => {
  it("every default supplied explicitly is indistinguishable from omission, for all 31 actions", () => {
    const defaults: Partial<SimulationCampaign> = {
      actionTimeCosts: Object.fromEntries(FIXED_ACTIONS.map((t) => [t, TODAY_TIME_COST[t] ?? 0])),
      eatNeedDeltas: { satiety: 25 },
      restNeedDeltas: { energy: 20, stress: -5 },
      exerciseNeedDeltas: { energy: -10, happiness: 3, health: 5, satiety: -5, stress: -5 },
      socializeAffinityGain: 5, socializeTrustGain: 2, applicationResolveWeeks: 1,
      negotiateRaiseBasisPoints: 500, studyUnitsPerSession: 1, projectProgressPerSession: 1,
    };
    for (const type of Object.keys(ALL_CASES)) expect(run(type, defaults)).toEqual(run(type));
  });

  it("Stable Life's built campaign and initial state name none of the ten fields", () => {
    const { content } = buildSimulationCampaign(stableLifeSource);
    const state = initialState({ id: "stable", kindId: "simulation", version: "1.0.0", titleKey: "k", content }).state;
    const serialized = canonicalStringify(content) + canonicalStringify(state);
    for (const field of Object.keys(TEN_FIELDS)) expect(serialized).not.toContain(field);
  });
});
