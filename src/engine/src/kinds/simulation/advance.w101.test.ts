/**
 * W101.8 — committed project, business, and rival-scarcity replays are byte-identical on
 * repeat and across a save/restore cut.
 *
 * Contract: `10-simulation-kind.md` §6.12, §7.12, §14 (04 §14's determinism harness).
 */

import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { canonicalStringify } from "../../core/persistence/canonical.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";

const PLAYER = {
  identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
  currentLocationId: "home",
  finances: { cashCents: 20000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
  needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
  attributes: { intelligence: 50, discipline: 80, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" as const },
  housing: { definitionId: "housing-1", movedInWeek: 1, ownership: "renting" as const, damage: 0, weeklyCostCents: 1000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" as const },
  inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
};

function agentActor(discipline: number) {
  return {
    ...PLAYER,
    identity: { ...PLAYER.identity, actorId: "agent-1" },
    attributes: { ...PLAYER.attributes, discipline },
  };
}

function buildState(): SimulationKindState {
  return {
    calendar: { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: structuredClone(PLAYER) as unknown as SimulationKindState["player"],
    economy: { inflation: 200, unemploymentRate: 500, interestRate: 300, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      npcs: [], locations: [{ definitionId: "home", discovered: true, accessible: true }],
      jobMarket: { openings: [{ jobId: "job-cashier", contested: true, positionsAvailable: 1, postedWeek: 1 }] },
      eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 },
      agents: [{
        id: "agent-1", strategyId: "aggressive", displayNameKey: "rival.name",
        actor: agentActor(20) as unknown as SimulationKindState["world"]["agents"][0]["actor"],
        goals: [], planningDepth: 0, strategy: {}, rngSeq: 0,
      }],
      flags: {},
    },
    activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
    goals: [], resolution: null, plan: { week: 1, actions: [] },
  };
}

const simulationCampaign: SimulationCampaign = {
  descriptionKey: "k",
  jobs: [{
    id: "job-cashier", titleKey: "k", descriptionKey: "k",
    employerId: "e", careerPathId: "c", tier: "entry",
    schedule: { weeklyTimeCost: 6, flexibility: 50 }, compensation: { baseWeeklyPayCents: 5000 },
    requirements: [], performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    promotionPaths: [], terminationRules: [], contested: true, tags: [],
  }],
  courses: [], housing: [{
    id: "housing-1", nameKey: "k", descriptionKey: "k",
    upfrontCostCents: 0, weeklyCostCents: 1000, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
    requirements: [], tags: [],
  }],
  items: [], events: [], npcs: [], goals: [], scenarios: [], difficulties: [], opportunities: [],
  achievements: [], headlines: [], employers: [],
  locations: [{ id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: ["start_project", "work_on_project", "start_business", "apply_for_job"] }],
  backgrounds: [], traits: [], skills: [],
  projects: [{
    id: "project-1", nameKey: "k", descriptionKey: "k",
    requirements: [], requiredUnits: 1, weeklyTimeCost: 1, startCostCents: 500, rewards: [], tags: [],
  }],
  businesses: [{
    id: "business-1", nameKey: "k", descriptionKey: "k",
    requirements: [], startupCostCents: 1000, weeklyRevenueCents: 800, weeklyExpensesCents: 300, minimumCashCents: -100000, tags: [],
  }],
  scenarioId: "s", goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "k", actionLabelKeys: { planAdd: "k", planRemove: "k", planClear: "k", endWeek: "k" },
};

const campaign: Campaign = { id: "test-w101", kindId: "simulation", version: "1.0.0", titleKey: "k", content: simulationCampaign };

function ctx(): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() { return this.rng; },
    seq: 1,
    emit: { emit: () => undefined },
  };
}

/** One week: start a project, start a business, apply for the contested job, end the week —
 *  the project/business/rival-scarcity fixture W101.8 asks for, replayed against a fresh
 *  `ctx()`/state each call so nothing but the actions themselves carries between runs. */
function playOneWeek(state: SimulationKindState): SimulationKindState {
  let s = advance(state, "plan.add", { actionType: "start_project", targetId: "project-1" }, ctx()).state;
  s = advance(s, "plan.add", { actionType: "start_business", targetId: "business-1" }, ctx()).state;
  s = advance(s, "plan.add", { actionType: "apply_for_job", targetId: "job-cashier" }, ctx()).state;
  return advance(s, "end_week", undefined, ctx()).state;
}

describe("W101.8 — determinism", () => {
  it("repeat: the same fixture replayed twice reaches byte-identical serialize() output", () => {
    const first = canonicalStringify(playOneWeek(buildState()));
    const second = canonicalStringify(playOneWeek(buildState()));
    expect(first).toBe(second);
  });

  it("save/restore cut: a JSON round trip mid-week reaches the same final state as an uncut run", () => {
    const uncut = playOneWeek(buildState());

    let s = advance(buildState(), "plan.add", { actionType: "start_project", targetId: "project-1" }, ctx()).state;
    // The cut — round-trip through the exact save/load boundary this state already crosses
    // for real persistence, per `canonicalStringify`'s own role as the serializer.
    s = JSON.parse(canonicalStringify(s)) as SimulationKindState;
    s = advance(s, "plan.add", { actionType: "start_business", targetId: "business-1" }, ctx()).state;
    s = JSON.parse(canonicalStringify(s)) as SimulationKindState;
    s = advance(s, "plan.add", { actionType: "apply_for_job", targetId: "job-cashier" }, ctx()).state;
    s = JSON.parse(canonicalStringify(s)) as SimulationKindState;
    const cut = advance(s, "end_week", undefined, ctx()).state;

    expect(canonicalStringify(cut)).toBe(canonicalStringify(uncut));
  });

  it("the fixture actually exercises what it claims: project started, business operating, rival lost the contest", () => {
    let state = playOneWeek(buildState());
    expect(state.player.projects[0]).toMatchObject({ definitionId: "project-1", status: "in_progress", progressUnits: 0 });
    expect(state.player.businesses[0]).toMatchObject({ definitionId: "business-1", status: "operating" });

    // Applications filed this week resolve the *following* week (§2.3's `resolvesWeek`) —
    // an empty-plan `end_week` lets week 2's `employment` system resolve them.
    state = advance(state, "end_week", undefined, ctx()).state;

    // Player (discipline 80) beat the rival (discipline 20) for the one-position opening.
    expect(state.player.career.currentEmployment).toMatchObject({ jobId: "job-cashier" });
    expect(state.world.agents[0]!.actor.career.currentEmployment).toBeUndefined();
  });
});
