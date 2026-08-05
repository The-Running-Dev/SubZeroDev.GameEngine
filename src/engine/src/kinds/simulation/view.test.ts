import { describe, it, expect } from "vitest";
import { project, projectPublicWorldState, type SimulationView } from "./view.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import type { KindContext } from "../../core/kernel/types.js";
import { canonicalStringify } from "../../core/persistence/canonical.js";

const state: SimulationKindState = {
  calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 2, spentTimeUnits: 5 },
  player: {
    identity: { actorId: "player", name: "Alex", age: 28, backgroundId: "bg-1" },
    currentLocationId: "home",
    finances: { cashCents: 12345, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
    needs: { health: 80, energy: 50, happiness: 60, stress: 20, satiety: 80 },
    attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 999 },
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: {
      definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
      weeklyCostCents: 5000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
      missedPayments: 0, evictionStage: "none",
    },
    inventory: [],
    relationships: [
      { npcId: "npc-1", category: "personal", affinity: 10, trust: 20, respect: 30, resentment: 888, knownSinceWeek: 1, interactionCount: 2 },
    ],
    skills: { cooking: 5 },
    traits: ["stoic"],
    reputation: { landlord: 1 },
    flags: { metLandlord: true },
    counters: { evicted: 777 },
  },
  economy: {
    inflation: 200, unemploymentRate: 500, interestRate: 300,
    sectorDemand: { tech: 80, retail: 10 },
    marketPrices: { bread: 250 },
    publishedIndicators: ["inflation"],
    flags: { crashed: true },
  },
  world: {
    npcs: [],
    locations: [{ definitionId: "home", discovered: true, accessible: true }],
    jobMarket: { openings: [{ jobId: "job-1", contested: true, positionsAvailable: 2, postedWeek: 1, expiresAtWeek: 10 }] },
    eventCooldowns: {},
    firedUniqueEvents: [],
    chainStates: [],
    strangenessBase: 42,
    headlinePool: { remainingIds: [], cyclesCompleted: 0 },
    agents: [],
    flags: { worldFlag: true },
  },
  activeEffects: [
    { id: "e1", sourceId: "s1", sourceKind: "item", modifiers: [{ target: "player.needs.energy", operation: "add", value: 5, sourceId: "s1" }], appliedWeek: 1, expiresAtWeek: 5, stacking: "refresh", descriptionKey: "effect.e1", visible: true },
    { id: "e2", sourceId: "s2", sourceKind: "system", modifiers: [], appliedWeek: 1, stacking: "stack", descriptionKey: "effect.e2", visible: false },
  ],
  activeOpportunities: [
    { id: "o1", definitionId: "def-1", kind: "job_offer", targetId: "job-1", offeredWeek: 1, expiresAtWeek: 4, terms: { secretRate: 999 } },
  ],
  scheduledEvents: [],
  pendingEventResponses: [{ id: "p1", eventId: "ev-1", rolledWeek: 2, presentWeek: 3, availableChoiceIds: ["a", "b"] }],
  goals: [
    { definitionId: "goal-1", status: "active", satisfiedThisWeek: true, consecutiveWeeksSatisfied: 1, requiredDurationWeeks: 2, firstSatisfiedWeek: 3, progressNotes: [{ conditionIndex: 0, satisfied: true, currentValue: 70, targetValue: 70 }] },
  ],
  plan: { week: 3, actions: [{ id: "a1", type: "rest", actorId: "player", parameters: {} }] },
};

const campaignContent: SimulationCampaign = {
  descriptionKey: "sim.description",
  startingCalendar: state.calendar,
  startingPlayer: state.player,
  startingEconomy: state.economy,
  startingWorld: state.world,
  goals: [],
  goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "sim.scene.status",
  actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
};

function fakeCtx(): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign: { id: "c", kindId: "simulation", version: "1", titleKey: "t", content: campaignContent },
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 0,
    emit: { emit: () => undefined },
  };
}

describe("project (10-simulation-kind.md §9)", () => {
  it("repeats nothing the generic Scene/PlayerView envelope already carries (W50.2)", () => {
    const view = project(state, "player", fakeCtx());
    const keys = Object.keys(view);
    for (const envelopeField of ["gameId", "status", "seed", "actionLog", "kindId", "campaignId", "turn"]) {
      expect(keys).not.toContain(envelopeField);
    }
  });

  it("never emits seed, actionLog, raw kindState, AgentState.strategy, RelationshipState.resentment, luck, or counters, for either audience (W50.3)", () => {
    for (const audience of ["player", "ai"] as const) {
      const view = project(state, audience, fakeCtx());
      const json = JSON.stringify(view);

      expect(json).not.toContain("999"); // luck
      expect(json).not.toContain("888"); // resentment
      expect(json).not.toContain("777"); // counters.evicted
      expect(view.attributes).not.toHaveProperty("luck");
      expect(view.relationships[0]).not.toHaveProperty("resentment");
      expect(view).not.toHaveProperty("counters");
      expect(view).not.toHaveProperty("seed");
      expect(view).not.toHaveProperty("actionLog");
      expect(view).not.toHaveProperty("kindState");
    }
  });

  it("the ai audience is never wider than the player audience", () => {
    const player = project(state, "player", fakeCtx());
    const ai = project(state, "ai", fakeCtx());
    expect(ai).toEqual(player);
  });

  it("strips terms from an active opportunity and never emits an unrevealed one raw", () => {
    const view = project(state, "player", fakeCtx());
    expect(view.activeOpportunities).toEqual([{ id: "o1", kind: "job_offer", targetId: "job-1", offeredWeek: 1, expiresAtWeek: 4 }]);
  });

  it("filters activeEffects to visible: true only, stripping modifiers", () => {
    const view = project(state, "player", fakeCtx());
    expect(view.activeEffects).toEqual([{ id: "e1", sourceKind: "item", descriptionKey: "effect.e1", expiresAtWeek: 5 }]);
  });

  it("W51.5 — a derived value is visible through SimulationView and never persisted", () => {
    // The fixture's own e1 effect adds +5 to player.needs.energy (base 50).
    const view = project(state, "player", fakeCtx());
    expect(view.needs.energy).toBe(55);

    // The base stored value is untouched by projection — serialize() sees only it.
    expect(state.player.needs.energy).toBe(50);
    expect(canonicalStringify(state)).toContain("\"energy\":50");
    expect(canonicalStringify(state)).not.toContain("\"energy\":55");
  });

  it("bands sector demand and withholds an indicator not in publishedIndicators", () => {
    const view = project(state, "player", fakeCtx());
    expect(view.world.economy.sectorDemand).toEqual({ retail: "cold", tech: "hot" });
    expect(view.world.economy.indicators).toEqual({ inflation: 200 });
  });

  it("computes availableTimeUnits from total - committed - spent", () => {
    const view = project(state, "player", fakeCtx());
    expect(view.calendar.availableTimeUnits).toBe(14 - 2 - 5);
  });

  it("carries the plan's own actions plus the full non-custom ActionType domain", () => {
    const view = project(state, "player", fakeCtx());
    expect(view.plan.actions).toEqual(state.plan?.actions);
    expect(view.plan.availableActionTypes).not.toContain("custom");
    expect(view.plan.availableActionTypes).toContain("rest");
  });

  it("carries goals through with progressNotes, unfiltered but re-shaped", () => {
    const view: SimulationView = project(state, "player", fakeCtx());
    expect(view.goals).toEqual([
      { definitionId: "goal-1", status: "active", satisfiedThisWeek: true, consecutiveWeeksSatisfied: 1, requiredDurationWeeks: 2, progressNotes: state.goals[0]!.progressNotes },
    ]);
  });
});

describe("projectPublicWorldState (10-simulation-kind.md §7.10, §9)", () => {
  it("carries no actor-private state — no finances, needs, or plan", () => {
    const view = projectPublicWorldState(state);
    expect(view).not.toHaveProperty("finances");
    expect(view).not.toHaveProperty("needs");
    expect(view).not.toHaveProperty("plan");
    expect(view).not.toHaveProperty("identity");
  });

  it("carries the same public world sections a client's own SimulationView.world would", () => {
    const clientView = project(state, "player", fakeCtx());
    const worldState = projectPublicWorldState(state);
    expect(worldState.locations).toEqual(clientView.world.locations);
    expect(worldState.jobMarket).toEqual(clientView.world.jobMarket);
    expect(worldState.economy).toEqual(clientView.world.economy);
  });
});
