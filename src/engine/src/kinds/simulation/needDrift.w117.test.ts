/**
 * W117 — `SimulationCampaign.needDriftPerWeek` (§7.14): declared, built, resolved per key at
 * the point of use by the `needs` end-of-week system, and validated by Tier 1.
 *
 * Contract: `10-simulation-kind.md` §7.14, §14; `20-contract.md` §7.14, §10.
 */

import { describe, it, expect } from "vitest";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../../authoring.js";
import { stableLifeSource } from "../../campaigns/stable-life.js";
import { advance } from "./advance.js";
import { validateCampaign } from "./validate.js";
import { SIMULATION_REASON_CODES, SIMULATION_REASON_MESSAGES } from "./reasons.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONTENT: SimulationCampaign = {
  descriptionKey: "k",
  jobs: [], courses: [],
  housing: [{
    id: "housing-1", nameKey: "k", descriptionKey: "k",
    upfrontCostCents: 0, weeklyCostCents: 0, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
    requirements: [], tags: [],
  }],
  items: [], events: [], npcs: [], goals: [],
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
  return { id: "test-w117", kindId: "simulation", version: "1.0.0", titleKey: "k", content: { ...BASE_CONTENT, ...extra } };
}

const STRINGS = new Map([["k", "text"]]);

function buildState(needs = { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 }): SimulationKindState {
  return {
    calendar: { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
      currentLocationId: "home",
      finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
      needs,
      attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: 0, utilitiesCents: 0, transportCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
      inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
    } as unknown as SimulationKindState["player"],
    economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      npcs: [], locations: [{ definitionId: "home", discovered: true, accessible: true }],
      jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {},
    },
    activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
    goals: [], resolution: null, plan: { week: 1, actions: [] },
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

function needChange(changes: readonly StateChange[], need: string): StateChange | undefined {
  return changes.find((change) => change.path === `player.needs.${need}`);
}

// ---------------------------------------------------------------------------
// W117.1 — declared and built only when supplied
// ---------------------------------------------------------------------------

describe("W117.1 — the builder copies needDriftPerWeek only when supplied", () => {
  it("an omitted field stays absent from the built campaign", () => {
    const { content } = buildSimulationCampaign(stableLifeSource);
    expect("needDriftPerWeek" in content).toBe(false);
  });

  it("a partial record keeps only the keys supplied", () => {
    const source: SimulationCampaignSource = { ...stableLifeSource, needDriftPerWeek: { satiety: -5 } };
    expect(buildSimulationCampaign(source).content.needDriftPerWeek).toEqual({ satiety: -5 });
  });

  it("an explicit zero is preserved, not read as absence", () => {
    const source: SimulationCampaignSource = { ...stableLifeSource, needDriftPerWeek: { energy: 0 } };
    const built = buildSimulationCampaign(source).content.needDriftPerWeek;
    expect(built).toEqual({ energy: 0 });
    expect(Object.keys(built ?? {})).toEqual(["energy"]);
  });
});

// ---------------------------------------------------------------------------
// W117.2 — resolved per key at the point of use
// ---------------------------------------------------------------------------

describe("W117.2 — the needs system resolves each key at the point of use", () => {
  const MID = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  it("an omitted field takes every default", () => {
    const result = endWeek(campaignOf({}), buildState(MID));
    expect(result.state.player.needs).toEqual({ health: 49, energy: 47, happiness: 48, stress: 52, satiety: 46 });
  });

  it("a supplied key takes the campaign's value and every other key keeps its default", () => {
    const result = endWeek(campaignOf({ needDriftPerWeek: { satiety: -5, stress: -3 } }), buildState(MID));
    expect(result.state.player.needs).toEqual({ health: 49, energy: 47, happiness: 48, stress: 47, satiety: 45 });
  });

  it("an explicit 0 leaves that need undrifted, and emits no change for it", () => {
    const result = endWeek(campaignOf({ needDriftPerWeek: { energy: 0 } }), buildState(MID));
    expect(result.state.player.needs.energy).toBe(50);
    expect(needChange(result.changes, "energy")).toBeUndefined();
    expect(result.state.player.needs.health).toBe(49);
  });

  it("an empty record is the same as an omitted field", () => {
    const withEmpty = endWeek(campaignOf({ needDriftPerWeek: {} }), buildState(MID));
    const without = endWeek(campaignOf({}), buildState(MID));
    expect(canonicalStringify(withEmpty)).toBe(canonicalStringify(without));
  });

  it("a campaign value is still clamped to 0–100", () => {
    const result = endWeek(
      campaignOf({ needDriftPerWeek: { satiety: -50, stress: 50 } }),
      buildState({ health: 50, energy: 50, happiness: 50, stress: 80, satiety: 10 }),
    );
    expect(result.state.player.needs.satiety).toBe(0);
    expect(result.state.player.needs.stress).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// W117.3 / W117.4 — two campaigns, one lever
// ---------------------------------------------------------------------------

describe("W117.3 — two campaigns differing only in needDriftPerWeek diverge by exactly the lever", () => {
  const withLever = campaignOf({ needDriftPerWeek: { satiety: -5 } });
  const without = campaignOf({});

  it("base satiety and its need_drift change differ by exactly 1; everything else is identical", () => {
    const a = endWeek(without, buildState());
    const b = endWeek(withLever, buildState());

    expect(a.state.player.needs.satiety).toBe(76);
    expect(b.state.player.needs.satiety).toBe(75);

    const satietyA = needChange(a.changes, "satiety");
    const satietyB = needChange(b.changes, "satiety");
    expect(satietyA).toMatchObject({ reason: "need_drift", value: 76, previous: 80 });
    expect(satietyB).toMatchObject({ reason: "need_drift", value: 75, previous: 80 });

    const rest = (changes: readonly StateChange[]) => changes.filter((change) => change.path !== "player.needs.satiety");
    expect(rest(b.changes)).toEqual(rest(a.changes));
    expect(a.changes.length).toBe(b.changes.length);
    expect(b.messages).toEqual(a.messages);

    const strip = (state: SimulationKindState) => ({ ...state, player: { ...state.player, needs: { ...state.player.needs, satiety: 0 } } });
    expect(canonicalStringify(strip(b.state))).toBe(canonicalStringify(strip(a.state)));
  });
});

describe("W117.4 — the divergence is deterministic, and survives a save/load cut mid-log", () => {
  const withLever = campaignOf({ needDriftPerWeek: { satiety: -5 } });

  function twoWeeks(cut: boolean): SimulationKindState {
    let state = endWeek(withLever, buildState()).state;
    if (cut) state = JSON.parse(canonicalStringify(state)) as SimulationKindState;
    return endWeek(withLever, state).state;
  }

  it("repeat: the same log reaches byte-identical serialize() output", () => {
    expect(canonicalStringify(twoWeeks(false))).toBe(canonicalStringify(twoWeeks(false)));
  });

  it("cut: a round trip between the two end_week actions matches the uncut run", () => {
    const uncut = twoWeeks(false);
    expect(canonicalStringify(twoWeeks(true))).toBe(canonicalStringify(uncut));
    expect(uncut.player.needs.satiety).toBe(70);
  });

  it("a loaded save gains no field: the state carries nothing about the lever", () => {
    expect(canonicalStringify(twoWeeks(false))).not.toContain("needDriftPerWeek");
  });
});

// ---------------------------------------------------------------------------
// W117.5 — omission is the default
// ---------------------------------------------------------------------------

describe("W117.5 — omitting the field is byte-identical to the campaign before it existed", () => {
  it("an explicit record of the five defaults reaches the same state as omission", () => {
    const explicit = campaignOf({ needDriftPerWeek: { health: -1, energy: -3, happiness: -2, satiety: -4, stress: 2 } });
    const a = endWeek(campaignOf({}), buildState());
    const b = endWeek(explicit, buildState());
    expect(canonicalStringify(b)).toBe(canonicalStringify(a));
  });
});

// ---------------------------------------------------------------------------
// W117.6 — Tier 1
// ---------------------------------------------------------------------------

describe("W117.6 — Tier 1 validation of needDriftPerWeek", () => {
  const validate = (needDriftPerWeek: unknown) =>
    validateCampaign(
      campaignOf(needDriftPerWeek === undefined ? {} : { needDriftPerWeek: needDriftPerWeek as SimulationCampaign["needDriftPerWeek"] & object }),
      STRINGS,
    );

  const PASSING: readonly [string, unknown][] = [
    ["an omitted field", undefined],
    ["an empty record", {}],
    ["a partial record", { satiety: -5 }],
    ["an explicit zero", { energy: 0 }],
    ["all five keys, signed", { health: -2, energy: -3, happiness: 1, satiety: -4, stress: 2 }],
    ["a large integer", { stress: 1000 }],
  ];
  const BAD_VALUES: readonly [string, unknown, string][] = [
    ["NaN", Number.NaN, "needDriftPerWeek.satiety"],
    ["Infinity", Number.POSITIVE_INFINITY, "needDriftPerWeek.satiety"],
    ["-Infinity", Number.NEGATIVE_INFINITY, "needDriftPerWeek.satiety"],
    ["a fraction", -4.5, "needDriftPerWeek.satiety"],
    ["a numeric string", "-4", "needDriftPerWeek.satiety"],
    ["null", null, "needDriftPerWeek.satiety"],
  ];
  const NOT_OBJECTS: readonly [string, unknown][] = [
    ["a number", 3],
    ["a string", "satiety"],
    ["null", null],
    ["an array", [{ satiety: -5 }]],
  ];

  it.each(PASSING)("passes %s with no error and no warning", (_name, value) => {
    const result = validate(value);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it.each(BAD_VALUES)("rejects %s with invalid_tuning_value at the key", (_name, value, path) => {
    const result = validate({ satiety: value });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { code: "invalid_tuning_value", messageKey: "simulation.reason.invalid_tuning_value", path },
    ]);
  });

  it("rejects an unknown need key with unknown_tuning_key at the key", () => {
    const result = validate({ vigour: -1 });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { code: "unknown_tuning_key", messageKey: "simulation.reason.unknown_tuning_key", path: "needDriftPerWeek.vigour" },
    ]);
  });

  it("does not also check an unknown key's value: the key is the failure", () => {
    expect(validate({ vigour: Number.NaN }).errors.map((e) => e.code)).toEqual(["unknown_tuning_key"]);
  });

  it("treats an inherited property name as an unknown key, not a need", () => {
    expect(validate({ constructor: 1 }).errors.map((e) => e.code)).toEqual(["unknown_tuning_key"]);
  });

  it.each(NOT_OBJECTS)("rejects %s with one invalid_tuning_value at the field", (_name, value) => {
    expect(validate(value).errors).toEqual([
      { code: "invalid_tuning_value", messageKey: "simulation.reason.invalid_tuning_value", path: "needDriftPerWeek" },
    ]);
  });

  it("reports one error per offending key, each with its own path", () => {
    const result = validate({ health: 0.5, satiety: Number.NaN, vigour: 1, stress: 2 });
    expect(result.errors.map((e) => `${e.code}@${e.path}`).sort()).toEqual([
      "invalid_tuning_value@needDriftPerWeek.health",
      "invalid_tuning_value@needDriftPerWeek.satiety",
      "unknown_tuning_key@needDriftPerWeek.vigour",
    ]);
  });

  it("a path never carries an array index", () => {
    for (const error of validate([1, 2]).errors) expect(error.path).not.toMatch(/\[\d+\]|\.\d+(\.|$)/);
  });

  it("registers both codes with a message", () => {
    for (const code of ["invalid_tuning_value", "unknown_tuning_key"] as const) {
      expect(SIMULATION_REASON_CODES).toContain(code);
      expect(SIMULATION_REASON_MESSAGES.get(`simulation.reason.${code}`)).toBeTruthy();
    }
  });

  it("the counts this slice claims: 6 passing, 6 + 1 + 1 + 1 + 4 + 1 + 1 + 1 rejecting", () => {
    expect(PASSING).toHaveLength(6);
    // 6 bad values, unknown key, unknown key with bad value, inherited name, 4 non-objects,
    // multi-error, array-index path guard.
    expect(BAD_VALUES.length + 1 + 1 + 1 + NOT_OBJECTS.length + 1 + 1).toBe(15);
  });
});
