/**
 * W118 — the week's own rules (§7.14): `weeklyTimeUnits`, `lateFeeBasisPoints`,
 * `evictionStages`, `performanceDriftRate`, `performanceWorkBonus` and `strangenessPerEvent`.
 * Declared, built only when supplied, resolved at the point of use, and validated by Tier 1.
 *
 * Contract: `10-simulation-kind.md` §7.14, §14; `20-contract.md` §7.14, §10.
 */

import { describe, it, expect } from "vitest";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../../authoring.js";
import { stableLifeSource } from "../../campaigns/stable-life.js";
import { advance } from "./advance.js";
import { initialState } from "./initial.js";
import { payBillsResolver } from "./resolvers.js";
import { validateCampaign } from "./validate.js";
import { SIMULATION_REASON_CODES, SIMULATION_REASON_MESSAGES } from "./reasons.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { Campaign } from "../../core/registry/types.js";
import type { EvictionStage } from "./actor.js";
import type { SimulationCampaign } from "./campaign.js";
import type { EventDefinition, JobDefinition } from "./content.js";
import type { SimulationKindState } from "./state.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JOB: JobDefinition = {
  id: "job-1", titleKey: "k", descriptionKey: "k", employerId: "employer-1", careerPathId: "path-1", tier: "entry",
  schedule: { weeklyTimeCost: 6, flexibility: 50 },
  compensation: { baseWeeklyPayCents: 0 },
  requirements: [],
  performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
  promotionPaths: [], terminationRules: [], contested: false, tags: [],
};

const EVENT: EventDefinition = {
  id: "event-1", category: "test", titleKey: "k", descriptionKey: "k", weight: 1,
  conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
  unique: true, automaticOutcome: { effects: [], messages: [] }, tags: [],
};

const BASE_CONTENT: SimulationCampaign = {
  descriptionKey: "k",
  jobs: [JOB], courses: [],
  housing: [{
    id: "housing-1", nameKey: "k", descriptionKey: "k",
    upfrontCostCents: 0, weeklyCostCents: 0, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
    requirements: [], tags: [],
  }],
  items: [], events: [EVENT], npcs: [], goals: [],
  scenarios: [{
    id: "scenario-1", nameKey: "k", descriptionKey: "k",
    startingBackgroundIds: [], startingCashCents: 0, startingHousingId: "housing-1", startingLocationId: "home",
    startingInventory: [], goalIds: [], mode: "classic", goalFailurePrecedence: "goals_win",
  }],
  difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
  locations: [{ id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: [] }],
  backgrounds: [], traits: [], skills: [], projects: [], businesses: [],
  scenarioId: "scenario-1", goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "k", actionLabelKeys: { planAdd: "k", planRemove: "k", planClear: "k", endWeek: "k" },
};

function campaignOf(extra: Partial<SimulationCampaign>): Campaign {
  return { id: "test-w118", kindId: "simulation", version: "1.0.0", titleKey: "k", content: { ...BASE_CONTENT, ...extra } };
}

const STRINGS = new Map([["k", "text"]]);

interface StateOptions {
  readonly rentCents?: number;
  readonly stage?: EvictionStage;
  readonly performance?: number;
  readonly worked?: boolean;
  readonly eventDue?: boolean;
}

/** Cash is 0 and rent is `rentCents`, so a positive rent is wholly missed. Employment, when
 *  `performance` is given, pays 0, so no wage touches the cash a late fee is measured against. */
function buildState(options: StateOptions = {}): SimulationKindState {
  const employment = options.performance === undefined ? {} : {
    currentEmployment: {
      jobId: "job-1", employerId: "employer-1", startedWeek: 1, performance: options.performance,
      attendanceRatio: 100, warnings: 0, weeklyPayCents: 0, weeksAtCurrentPay: 1,
    },
  };
  return {
    calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
      currentLocationId: "home",
      finances: { cashCents: 0, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
      needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
      attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry", ...employment },
      housing: {
        definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: options.rentCents ?? 0,
        utilitiesCents: 0, transportCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0,
        evictionStage: options.stage ?? "none",
      },
      inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {},
      flags: options.worked === true ? { workedThisWeek: true } : {}, counters: {},
    } as unknown as SimulationKindState["player"],
    economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      npcs: [], locations: [{ definitionId: "home", discovered: true, accessible: true }],
      jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 10,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {},
    },
    activeEffects: [], activeOpportunities: [],
    scheduledEvents: options.eventDue === true ? [{ id: "s-1", eventId: "event-1", scheduledWeek: 3, createdWeek: 1 }] : [],
    pendingEventResponses: [], goals: [], resolution: null, plan: { week: 3, actions: [] },
  };
}

function ctx(campaign: Campaign): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() { return this.rng; },
    seq: 1,
    emit: { emit: () => undefined },
  };
}

function endWeek(campaign: Campaign, state: SimulationKindState) {
  return advance(state, "end_week", undefined, ctx(campaign));
}

function change(changes: readonly StateChange[], path: string): StateChange | undefined {
  return changes.find((c) => c.path === path);
}

function without(changes: readonly StateChange[], path: string): StateChange[] {
  return changes.filter((c) => c.path !== path);
}

function housingOf(state: SimulationKindState) {
  return state.player.housing as unknown as { evictionStage: EvictionStage; overdueRentCents: number; missedPayments: number };
}

// ---------------------------------------------------------------------------
// W118.1 — declared, and built only when supplied
// ---------------------------------------------------------------------------

const SIX_FIELDS = {
  weeklyTimeUnits: 10,
  lateFeeBasisPoints: 0,
  evictionStages: ["none", "penalty", "evicted"],
  performanceDriftRate: 0,
  performanceWorkBonus: -3,
  strangenessPerEvent: 0,
} as const satisfies Partial<SimulationCampaignSource>;

describe("W118.1 — the builder copies each of the six fields only when supplied", () => {
  it("an omitted field stays absent from the built campaign, all six", () => {
    const { content } = buildSimulationCampaign(stableLifeSource);
    for (const field of Object.keys(SIX_FIELDS)) expect(field in content).toBe(false);
  });

  it.each(Object.entries(SIX_FIELDS))("%s: supplying it copies it, and only it", (field, value) => {
    const source = { ...stableLifeSource, [field]: value } as SimulationCampaignSource;
    const { content } = buildSimulationCampaign(source);
    expect((content as unknown as Record<string, unknown>)[field]).toEqual(value);
    const others = Object.keys(SIX_FIELDS).filter((other) => other !== field);
    for (const other of others) expect(other in content).toBe(false);
  });

  it("explicit zero is a supplied value, not absence", () => {
    const { content } = buildSimulationCampaign({ ...stableLifeSource, lateFeeBasisPoints: 0, performanceDriftRate: 0 });
    expect(content.lateFeeBasisPoints).toBe(0);
    expect(content.performanceDriftRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W118.2 — one fixture pair per field, each diverging only on the path it governs
// ---------------------------------------------------------------------------

describe("W118.2 — a fixture pair differing in one field diverges only on that field's path", () => {
  it("weeklyTimeUnits: the week-one budget and the next week's", () => {
    const base = buildSimulationCampaign(stableLifeSource);
    const tuned = buildSimulationCampaign({ ...stableLifeSource, weeklyTimeUnits: 10 });
    const campaign = (built: typeof base): Campaign => ({ id: "stable", kindId: "simulation", version: "1.0.0", titleKey: "k", content: built.content });

    const a = initialState(campaign(base)).state;
    const b = initialState(campaign(tuned)).state;
    expect(a.calendar.totalTimeUnits).toBe(14);
    expect(b.calendar.totalTimeUnits).toBe(10);
    const strip = (state: SimulationKindState) => ({ ...state, calendar: { ...state.calendar, totalTimeUnits: 0 } });
    expect(canonicalStringify(strip(b))).toBe(canonicalStringify(strip(a)));

    const weekA = endWeek(campaignOf({}), buildState());
    const weekB = endWeek(campaignOf({ weeklyTimeUnits: 10 }), buildState());
    expect(weekA.state.calendar.totalTimeUnits).toBe(14);
    expect(weekB.state.calendar.totalTimeUnits).toBe(10);
    expect(weekB.changes).toEqual(weekA.changes);
    expect(canonicalStringify(strip(weekB.state))).toBe(canonicalStringify(strip(weekA.state)));
  });

  it("lateFeeBasisPoints: the late fee in cents", () => {
    const a = endWeek(campaignOf({}), buildState({ rentCents: 10000 }));
    const b = endWeek(campaignOf({ lateFeeBasisPoints: 2500 }), buildState({ rentCents: 10000 }));
    // 10000 missed. Default fee 10% is 1000; 25% is 2500.
    expect(housingOf(a.state).overdueRentCents).toBe(11000);
    expect(housingOf(b.state).overdueRentCents).toBe(12500);
    expect(change(a.changes, "player.housing.overdueRentCents")).toMatchObject({ op: "increment", value: 11000, reason: "rent_overdue" });
    expect(change(b.changes, "player.housing.overdueRentCents")).toMatchObject({ op: "increment", value: 12500, reason: "rent_overdue" });
    expect(without(b.changes, "player.housing.overdueRentCents")).toEqual(without(a.changes, "player.housing.overdueRentCents"));
    const strip = (state: SimulationKindState) => canonicalStringify({ ...state, player: { ...state.player, housing: { ...state.player.housing, overdueRentCents: 0 } } });
    expect(strip(b.state)).toBe(strip(a.state));
  });

  it("evictionStages: the eviction stage", () => {
    const a = endWeek(campaignOf({}), buildState({ rentCents: 10000 }));
    const b = endWeek(campaignOf({ evictionStages: ["none", "penalty", "evicted"] }), buildState({ rentCents: 10000 }));
    expect(housingOf(a.state).evictionStage).toBe("warning");
    expect(housingOf(b.state).evictionStage).toBe("penalty");
    expect(change(b.changes, "player.housing.evictionStage")).toMatchObject({ value: "penalty", previous: "none", reason: "eviction_advanced" });
    expect(without(b.changes, "player.housing.evictionStage")).toEqual(without(a.changes, "player.housing.evictionStage"));
    const strip = (state: SimulationKindState) => canonicalStringify({ ...state, player: { ...state.player, housing: { ...state.player.housing, evictionStage: "none" } } });
    expect(strip(b.state)).toBe(strip(a.state));
  });

  it("performanceDriftRate and performanceWorkBonus: employment performance", () => {
    const idle = buildState({ performance: 20 });
    const a = endWeek(campaignOf({}), idle);
    const b = endWeek(campaignOf({ performanceDriftRate: 1 }), idle);
    // The gap to weeklyDriftToward (50) is 30. 0.2 of it is 6; all of it is 30.
    expect(a.state.player.career.currentEmployment?.performance).toBe(26);
    expect(b.state.player.career.currentEmployment?.performance).toBe(50);

    const worked = buildState({ performance: 20, worked: true });
    const c = endWeek(campaignOf({}), worked);
    const d = endWeek(campaignOf({ performanceWorkBonus: 15 }), worked);
    expect(c.state.player.career.currentEmployment?.performance).toBe(28);
    expect(d.state.player.career.currentEmployment?.performance).toBe(35);

    const strip = (state: SimulationKindState) => canonicalStringify({
      ...state, player: { ...state.player, career: { ...state.player.career, currentEmployment: { ...state.player.career.currentEmployment, performance: 0 } } },
    });
    expect(strip(b.state)).toBe(strip(a.state));
    expect(strip(d.state)).toBe(strip(c.state));
    expect(b.changes).toEqual(a.changes);
    expect(d.changes).toEqual(c.changes);
  });

  it("strangenessPerEvent: strangenessBase", () => {
    const a = endWeek(campaignOf({}), buildState({ eventDue: true }));
    const b = endWeek(campaignOf({ strangenessPerEvent: 12 }), buildState({ eventDue: true }));
    expect(a.state.world.strangenessBase).toBe(15);
    expect(b.state.world.strangenessBase).toBe(22);
    expect(change(a.changes, "world.strangenessBase")).toMatchObject({ value: 15, previous: 10, reason: "event_fired" });
    expect(change(b.changes, "world.strangenessBase")).toMatchObject({ value: 22, previous: 10, reason: "event_fired" });
    const strip = (state: SimulationKindState) => canonicalStringify({ ...state, world: { ...state.world, strangenessBase: 0 } });
    expect(strip(b.state)).toBe(strip(a.state));
    // The derived `world.strangeness` change follows its base, so those two paths are the
    // whole of the divergence.
    const governed = (changes: readonly StateChange[]) => changes.filter((c) => c.path !== "world.strangenessBase" && c.path !== "world.strangeness");
    expect(governed(b.changes)).toEqual(governed(a.changes));
  });

  it("strangenessPerEvent clamps to 0–100, negative included", () => {
    expect(endWeek(campaignOf({ strangenessPerEvent: 500 }), buildState({ eventDue: true })).state.world.strangenessBase).toBe(100);
    expect(endWeek(campaignOf({ strangenessPerEvent: -500 }), buildState({ eventDue: true })).state.world.strangenessBase).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W118.3 — a shortened ladder
// ---------------------------------------------------------------------------

describe("W118.3 — under a shortened ladder none, penalty, evicted", () => {
  const short = campaignOf({ evictionStages: ["none", "penalty", "evicted"] });
  const missed = (stage: EvictionStage) => endWeek(short, buildState({ rentCents: 10000, stage })).state;

  it("a missed week advances one listed stage", () => {
    expect(housingOf(missed("none")).evictionStage).toBe("penalty");
    expect(housingOf(missed("penalty")).evictionStage).toBe("evicted");
  });

  it("a loaded state at the omitted warning stage advances to penalty", () => {
    expect(housingOf(missed("warning")).evictionStage).toBe("penalty");
  });

  it("a loaded state at the omitted formal_notice and hearing_scheduled stages advances to evicted", () => {
    expect(housingOf(missed("formal_notice")).evictionStage).toBe("evicted");
    expect(housingOf(missed("hearing_scheduled")).evictionStage).toBe("evicted");
  });

  it("evicted stays terminal, and emits no stage change", () => {
    const result = endWeek(short, buildState({ rentCents: 10000, stage: "evicted" }));
    expect(housingOf(result.state).evictionStage).toBe("evicted");
    expect(change(result.changes, "player.housing.evictionStage")).toBeUndefined();
  });

  it("a week with no missed balance does not advance the stage", () => {
    const result = endWeek(short, buildState({ rentCents: 0, stage: "none" }));
    expect(housingOf(result.state).evictionStage).toBe("none");
  });

  it("pay_bills still resets the stage to none", () => {
    const owing = missed("none");
    const funded = { ...owing, player: { ...owing.player, finances: { ...owing.player.finances, cashCents: 100000 } } } as SimulationKindState;
    const action = { id: "a-1", type: "pay_bills" as const, params: {} };
    const outcome = payBillsResolver.calculate(funded, action as never, ctx(short));
    const paid = payBillsResolver.apply(funded, outcome);
    expect(housingOf(paid).evictionStage).toBe("none");
    expect(housingOf(paid).overdueRentCents).toBe(0);
  });

  it("the default six stages reproduce the old index-plus-one ladder, stage by stage", () => {
    const canonical: EvictionStage[] = ["none", "warning", "penalty", "formal_notice", "hearing_scheduled", "evicted"];
    for (const [index, stage] of canonical.entries()) {
      const omitted = endWeek(campaignOf({}), buildState({ rentCents: 10000, stage }));
      const explicit = endWeek(campaignOf({ evictionStages: canonical }), buildState({ rentCents: 10000, stage }));
      expect(housingOf(omitted.state).evictionStage).toBe(canonical[Math.min(index + 1, 5)]);
      expect(canonicalStringify(explicit)).toBe(canonicalStringify(omitted));
    }
  });

  it("a save/load cut between two missed weeks matches the uncut run", () => {
    const twoWeeks = (cut: boolean): SimulationKindState => {
      let state = endWeek(short, buildState({ rentCents: 10000 })).state;
      if (cut) state = JSON.parse(canonicalStringify(state)) as SimulationKindState;
      return endWeek(short, state).state;
    };
    expect(canonicalStringify(twoWeeks(true))).toBe(canonicalStringify(twoWeeks(false)));
    expect(housingOf(twoWeeks(false)).evictionStage).toBe("evicted");
  });
});

// ---------------------------------------------------------------------------
// W118.4 — performance drift
// ---------------------------------------------------------------------------

describe("W118.4 — performanceDriftRate", () => {
  const performanceAfter = (rate: number, from: number, toward = 50): number | undefined => {
    const job: JobDefinition = { ...JOB, performance: { ...JOB.performance, weeklyDriftToward: toward } };
    const campaign = campaignOf({ jobs: [job], performanceDriftRate: rate });
    return endWeek(campaign, buildState({ performance: from })).state.player.career.currentEmployment?.performance;
  };

  it("0: a week without work leaves performance unchanged", () => {
    expect(performanceAfter(0, 20)).toBe(20);
    expect(performanceAfter(0, 90)).toBe(90);
  });

  it("1: such a week moves it to the job's weeklyDriftToward, from either side", () => {
    expect(performanceAfter(1, 20)).toBe(50);
    expect(performanceAfter(1, 90)).toBe(50);
  });

  it("rounds once, on the whole sum: 0.5 of a gap of 5 is 2.5, rounded after the add", () => {
    // 20 + 0.5 × 5 = 22.5, which Math.round takes to 23. Rounding the step first would give 22 or 23
    // by a different route; the sum is the contract (§7.14).
    expect(performanceAfter(0.5, 20, 25)).toBe(23);
    // 0.2 × 30 = 6 exactly: the default path is the old arithmetic.
    expect(performanceAfter(0.2, 20)).toBe(26);
  });
});

// ---------------------------------------------------------------------------
// W118.5 — Tier 1
// ---------------------------------------------------------------------------

describe("W118.5 — Tier 1 validation of the week's own rules", () => {
  const validate = (extra: Record<string, unknown>) => validateCampaign(campaignOf(extra as Partial<SimulationCampaign>), STRINGS);
  const codesAt = (extra: Record<string, unknown>) => validate(extra).errors.map((e) => `${e.code}@${e.path}`);

  const PASSING: readonly [string, Record<string, unknown>][] = [
    ["an omitted set", {}],
    ["weeklyTimeUnits 1", { weeklyTimeUnits: 1 }],
    ["weeklyTimeUnits 40", { weeklyTimeUnits: 40 }],
    ["lateFeeBasisPoints 0", { lateFeeBasisPoints: 0 }],
    ["lateFeeBasisPoints 25000", { lateFeeBasisPoints: 25000 }],
    ["performanceDriftRate 0", { performanceDriftRate: 0 }],
    ["performanceDriftRate 1", { performanceDriftRate: 1 }],
    ["performanceDriftRate 0.35", { performanceDriftRate: 0.35 }],
    ["performanceWorkBonus negative", { performanceWorkBonus: -4 }],
    ["performanceWorkBonus 0", { performanceWorkBonus: 0 }],
    ["strangenessPerEvent negative", { strangenessPerEvent: -2 }],
    ["strangenessPerEvent 0", { strangenessPerEvent: 0 }],
    ["the default six stages", { evictionStages: ["none", "warning", "penalty", "formal_notice", "hearing_scheduled", "evicted"] }],
    ["the shortest ladder", { evictionStages: ["none", "evicted"] }],
    ["a ladder with gaps", { evictionStages: ["none", "penalty", "hearing_scheduled", "evicted"] }],
  ];

  const REJECTING: readonly [string, Record<string, unknown>, string][] = [
    ["weeklyTimeUnits 0", { weeklyTimeUnits: 0 }, "invalid_tuning_value@weeklyTimeUnits"],
    ["weeklyTimeUnits negative", { weeklyTimeUnits: -14 }, "invalid_tuning_value@weeklyTimeUnits"],
    ["weeklyTimeUnits a fraction", { weeklyTimeUnits: 14.5 }, "invalid_tuning_value@weeklyTimeUnits"],
    ["weeklyTimeUnits NaN", { weeklyTimeUnits: Number.NaN }, "invalid_tuning_value@weeklyTimeUnits"],
    ["weeklyTimeUnits Infinity", { weeklyTimeUnits: Number.POSITIVE_INFINITY }, "invalid_tuning_value@weeklyTimeUnits"],
    ["weeklyTimeUnits a string", { weeklyTimeUnits: "14" }, "invalid_tuning_value@weeklyTimeUnits"],
    ["lateFeeBasisPoints negative", { lateFeeBasisPoints: -1 }, "invalid_tuning_value@lateFeeBasisPoints"],
    ["lateFeeBasisPoints a fraction", { lateFeeBasisPoints: 10.5 }, "invalid_tuning_value@lateFeeBasisPoints"],
    ["lateFeeBasisPoints NaN", { lateFeeBasisPoints: Number.NaN }, "invalid_tuning_value@lateFeeBasisPoints"],
    ["lateFeeBasisPoints null", { lateFeeBasisPoints: null }, "invalid_tuning_value@lateFeeBasisPoints"],
    ["performanceDriftRate NaN", { performanceDriftRate: Number.NaN }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceDriftRate Infinity", { performanceDriftRate: Number.POSITIVE_INFINITY }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceDriftRate -Infinity", { performanceDriftRate: Number.NEGATIVE_INFINITY }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceDriftRate below 0", { performanceDriftRate: -0.1 }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceDriftRate above 1", { performanceDriftRate: 1.1 }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceDriftRate a string", { performanceDriftRate: "0.2" }, "invalid_tuning_value@performanceDriftRate"],
    ["performanceWorkBonus a fraction", { performanceWorkBonus: 7.5 }, "invalid_tuning_value@performanceWorkBonus"],
    ["performanceWorkBonus NaN", { performanceWorkBonus: Number.NaN }, "invalid_tuning_value@performanceWorkBonus"],
    ["strangenessPerEvent a fraction", { strangenessPerEvent: 0.5 }, "invalid_tuning_value@strangenessPerEvent"],
    ["strangenessPerEvent Infinity", { strangenessPerEvent: Number.POSITIVE_INFINITY }, "invalid_tuning_value@strangenessPerEvent"],
    ["evictionStages not an array", { evictionStages: "none" }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages null", { evictionStages: null }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages empty", { evictionStages: [] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages not starting at none", { evictionStages: ["warning", "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages not ending at evicted", { evictionStages: ["none", "warning"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages a repeat", { evictionStages: ["none", "warning", "warning", "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages out of canonical order", { evictionStages: ["none", "penalty", "warning", "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages an unknown stage", { evictionStages: ["none", "foreclosed", "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages a non-string member", { evictionStages: ["none", 2, "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages an inherited name", { evictionStages: ["none", "constructor", "evicted"] }, "invalid_eviction_stages@evictionStages"],
    ["evictionStages only evicted", { evictionStages: ["evicted"] }, "invalid_eviction_stages@evictionStages"],
  ];

  it.each(PASSING)("passes %s with no error and no warning of its own", (_name, extra) => {
    const result = validate(extra);
    expect(result.errors).toEqual([]);
    // The base fixture's job is unreachable by design; a supplied field adds nothing to that.
    expect(result.warnings).toEqual(validate({}).warnings);
  });

  it.each(REJECTING)("rejects %s", (_name, extra, expected) => {
    const result = validate(extra);
    expect(result.ok).toBe(false);
    expect(codesAt(extra)).toEqual([expected]);
  });

  it("carries the registered message key for each code", () => {
    expect(validate({ weeklyTimeUnits: 0 }).errors[0]?.messageKey).toBe("simulation.reason.invalid_tuning_value");
    expect(validate({ evictionStages: [] }).errors[0]?.messageKey).toBe("simulation.reason.invalid_eviction_stages");
  });

  it("an invalid ladder yields one error whatever the number of defects in it", () => {
    expect(codesAt({ evictionStages: ["warning", "warning", "foreclosed", "penalty"] })).toEqual(["invalid_eviction_stages@evictionStages"]);
  });

  it("reports one error per offending scalar field", () => {
    expect(codesAt({ weeklyTimeUnits: 0, lateFeeBasisPoints: -1, performanceDriftRate: 2, performanceWorkBonus: 1.5, strangenessPerEvent: 0.5 }).sort()).toEqual([
      "invalid_tuning_value@lateFeeBasisPoints",
      "invalid_tuning_value@performanceDriftRate",
      "invalid_tuning_value@performanceWorkBonus",
      "invalid_tuning_value@strangenessPerEvent",
      "invalid_tuning_value@weeklyTimeUnits",
    ]);
  });

  it("a path never carries an array index", () => {
    for (const error of validate({ evictionStages: ["none", "none"] }).errors) expect(error.path).not.toMatch(/\[\d+\]|\.\d+(\.|$)/);
  });

  it("registers invalid_eviction_stages with a message", () => {
    expect(SIMULATION_REASON_CODES).toContain("invalid_eviction_stages");
    expect(SIMULATION_REASON_MESSAGES.get("simulation.reason.invalid_eviction_stages")).toBeTruthy();
  });

  it("the counts this slice claims: 15 passing, 31 rejecting table rows", () => {
    expect(PASSING).toHaveLength(15);
    expect(REJECTING).toHaveLength(31);
  });
});

// ---------------------------------------------------------------------------
// W118.6 — omission is the default
// ---------------------------------------------------------------------------

describe("W118.6 — omitting all six fields is byte-identical to the campaign before they existed", () => {
  const DEFAULTS = {
    weeklyTimeUnits: 14,
    lateFeeBasisPoints: 1000,
    evictionStages: ["none", "warning", "penalty", "formal_notice", "hearing_scheduled", "evicted"],
    performanceDriftRate: 0.2,
    performanceWorkBonus: 8,
    strangenessPerEvent: 5,
  } as const satisfies Partial<SimulationCampaign>;

  it("an explicit record of the six defaults reaches the same state and changes as omission", () => {
    const state = (): SimulationKindState => buildState({ rentCents: 10000, performance: 20, eventDue: true });
    const omitted = endWeek(campaignOf({}), state());
    const explicit = endWeek(campaignOf({ ...DEFAULTS }), state());
    expect(canonicalStringify(explicit)).toBe(canonicalStringify(omitted));
    // The week exercised every one of the six paths, so the equality above is not vacuous.
    expect(change(omitted.changes, "player.housing.evictionStage")).toBeDefined();
    expect(change(omitted.changes, "world.strangenessBase")).toBeDefined();
    expect(housingOf(omitted.state).overdueRentCents).toBe(11000);
    expect(omitted.state.player.career.currentEmployment?.performance).toBe(26);
  });

  it("a worked week reaches the same state under the default bonus", () => {
    const state = (): SimulationKindState => buildState({ performance: 20, worked: true });
    expect(canonicalStringify(endWeek(campaignOf({ ...DEFAULTS }), state()))).toBe(canonicalStringify(endWeek(campaignOf({}), state())));
  });

  it("an omitted weeklyTimeUnits leaves a stored budget alone", () => {
    const state = buildState();
    const odd = { ...state, calendar: { ...state.calendar, totalTimeUnits: 9 } };
    expect(endWeek(campaignOf({}), odd).state.calendar.totalTimeUnits).toBe(9);
  });

  it("a loaded state gains no field: nothing in the state names a lever", () => {
    const result = endWeek(campaignOf({ ...SIX_FIELDS, evictionStages: [...SIX_FIELDS.evictionStages] }), buildState({ rentCents: 10000, eventDue: true }));
    const serialized = canonicalStringify(result.state);
    for (const field of Object.keys(SIX_FIELDS)) expect(serialized).not.toContain(field);
  });
});
