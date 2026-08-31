/**
 * The full §11 event table, exercised (10-simulation-kind.md §11; W50.8).
 *
 * `system.ran`/`effect.expired` were already real before this unit (W37/W39,
 * `startOfWeek.test.ts`/`endOfWeek.test.ts` cover `effect.expired` directly); this file
 * covers the six this unit adds: `plan.changed`, `week.started`, `action.resolved`,
 * `goal.achieved`, `goal.failed`, `week.ended`.
 */

import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import type { GoalDefinition } from "./content.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import type { EventData, ResolutionEmitter } from "../../core/observability/types.js";
import type { EventName, Severity } from "../../core/observability/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { KindContext } from "../../core/kernel/types.js";

interface RecordedEvent {
  name: EventName;
  severity: Severity;
  data?: EventData;
}

function recordingEmitter(): { emitter: ResolutionEmitter; events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  return {
    events,
    emitter: {
      emit: (name, severity, detail) => {
        events.push({ name, severity, ...(detail?.data ? { data: detail.data } : {}) });
      },
    },
  };
}

const calendar = { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 };
const player = {
  identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
  currentLocationId: "loc-1",
  finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
  needs: { health: 80, energy: 80, happiness: 90, stress: 20, satiety: 80 },
  attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" as const },
  housing: { definitionId: "h", movedInWeek: 1, ownership: "renting" as const, damage: 0, weeklyCostCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" as const },
  inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
};
const economy = { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} };
const world = { npcs: [], locations: [], jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0, headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {} };

const happinessGoal: GoalDefinition = {
  id: "goal-happy",
  labelKey: "goal.happy",
  descriptionKey: "goal.happy.description",
  category: "happiness",
  conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
};

/** Built directly, not through `initial.ts`'s `initialState` — this file exercises
 *  `advance()`'s own event emission, not `ScenarioDefinition` assembly, so the exact starting
 *  `needs` these tests depend on (`happiness: 90`, in particular) stay authored here rather
 *  than routed through `initial.ts`'s own fixed defaults. `goals` mirrors what
 *  `initial.ts`'s own `startingGoals` would seed from the same `GoalDefinition` list, so a
 *  test's `makeCampaign(goals)` and `makeState(goals)` calls stay in sync. */
function makeState(goals: GoalDefinition[] = []): SimulationKindState {
  return {
    calendar: { ...calendar },
    player: structuredClone(player),
    economy: { ...economy },
    world: structuredClone(world),
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: goals.map((goal) => ({
      definitionId: goal.id, status: "active", satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0, progressNotes: [],
    })),
    resolution: null,
    plan: { week: 1, actions: [] },
  };
}

function makeCampaign(goals: GoalDefinition[]): Campaign {
  const content: SimulationCampaign = {
    descriptionKey: "sim.description",
    jobs: [], courses: [], housing: [], items: [], events: [], npcs: [],
    goals,
    scenarios: [],
    difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [], locations: [],
    backgrounds: [], traits: [], skills: [], projects: [], businesses: [],
    scenarioId: "",
    goalFailurePrecedence: "goals_win",
    sceneTemplateKey: "sim.scene.status",
    actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
  };
  return { id: "test-sim", kindId: "simulation", version: "1.0.0", titleKey: "sim.title", content };
}

function ctxWith(campaign: Campaign, emitter: ResolutionEmitter): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 0,
    emit: emitter,
  };
}

describe("events (10-simulation-kind.md §11; W50.8)", () => {
  it("plan.add/plan.remove/plan.clear each emit plan.changed (debug)", () => {
    const campaign = makeCampaign([]);
    const { emitter, events } = recordingEmitter();
    const ctx = ctxWith(campaign, emitter);
    let state = makeState();

    state = advance(state, "plan.add", { actionType: "rest" }, ctx).state;
    state = advance(state, "plan.remove", { index: 0 }, ctx).state;
    advance(state, "plan.clear", undefined, ctx);

    const planChanged = events.filter((e) => e.name === "kind.simulation.plan.changed");
    expect(planChanged).toHaveLength(3);
    expect(planChanged.every((e) => e.severity === "debug")).toBe(true);
  });

  it("a full end_week emits action.resolved per planned action, week.started, and week.ended, in order", () => {
    const campaign = makeCampaign([]);
    const { emitter, events } = recordingEmitter();
    const ctx = ctxWith(campaign, emitter);
    const withPlan = advance(makeState(), "plan.add", { actionType: "rest" }, ctx).state;

    events.length = 0; // isolate the end_week call
    advance(withPlan, "end_week", undefined, ctx);

    const names = events.map((e) => e.name);
    expect(names).toContain("kind.simulation.action.resolved");
    expect(names).toContain("kind.simulation.week.ended");
    expect(names).toContain("kind.simulation.week.started");
    expect(names).toContain("kind.simulation.system.ran");

    // §3's own order: end-of-week resolution (including this week's own "week.ended")
    // happens entirely before the next week's start-of-week pipeline ("week.started").
    expect(names.indexOf("kind.simulation.action.resolved")).toBeLessThan(names.indexOf("kind.simulation.week.ended"));
    expect(names.indexOf("kind.simulation.week.ended")).toBeLessThan(names.indexOf("kind.simulation.week.started"));
  });

  it("a goal completing this week emits goal.achieved (info)", () => {
    const campaign = makeCampaign([happinessGoal]);
    const { emitter, events } = recordingEmitter();
    const ctx = ctxWith(campaign, emitter);
    advance(makeState([happinessGoal]), "end_week", undefined, ctx);

    expect(events).toContainEqual({ name: "kind.simulation.goal.achieved", severity: "info", data: { goalId: "goal-happy" } });
  });

  it("a goal's failureConditions tripping this week emits goal.failed (info)", () => {
    const failingGoal: GoalDefinition = {
      id: "goal-doomed",
      labelKey: "goal.doomed",
      descriptionKey: "goal.doomed.description",
      category: "test",
      conditions: { field: "player.needs.stress", operator: "less_than", value: 0 }, // never met
      failureConditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 0 }, // always true
    };
    const campaign = makeCampaign([failingGoal]);
    const { emitter, events } = recordingEmitter();
    const ctx = ctxWith(campaign, emitter);
    advance(makeState([failingGoal]), "end_week", undefined, ctx);

    expect(events).toContainEqual({ name: "kind.simulation.goal.failed", severity: "info", data: { goalId: "goal-doomed" } });
  });

  it("no event name outside kind.simulation.* is ever emitted by this kind's own code", () => {
    const campaign = makeCampaign([happinessGoal]);
    const { emitter, events } = recordingEmitter();
    const ctx = ctxWith(campaign, emitter);
    let state = makeState();
    state = advance(state, "plan.add", { actionType: "rest" }, ctx).state;
    advance(state, "end_week", undefined, ctx);

    expect(events.every((e) => e.name.startsWith("kind.simulation."))).toBe(true);
  });
});
