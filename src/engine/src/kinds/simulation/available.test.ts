import { describe, it, expect } from "vitest";
import { availableActions } from "./available.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import type { KindContext } from "../../core/kernel/types.js";

const state: SimulationKindState = {
  calendar: { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
  player: {
    identity: { actorId: "player", name: "Alex", age: 28, backgroundId: "bg-1" },
    currentLocationId: "home",
    finances: { cashCents: 0, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
    needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
    attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: { definitionId: "h", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
    inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
  },
  economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
  world: { npcs: [], locations: [], jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0, headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {} },
  activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
  goals: [],
  resolution: null,
  plan: { week: 1, actions: [] },
};

const content: SimulationCampaign = {
  descriptionKey: "sim.description",
  jobs: [], courses: [], housing: [], items: [], events: [], npcs: [],
  goals: [],
  scenarios: [],
  difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [], locations: [],
  backgrounds: [], traits: [], skills: [], projects: [], businesses: [],
  scenarioId: "",
  goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "sim.scene.status",
  actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
};

function fakeCtx(): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign: { id: "c", kindId: "simulation", version: "1", titleKey: "t", content },
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 0,
    emit: { emit: () => undefined },
  };
}

describe("availableActions (10-simulation-kind.md §4, §9; W50.4)", () => {
  it("returns exactly plan.add, plan.remove, plan.clear and end_week, each with its own campaign-authored labelKey", () => {
    const actions = availableActions(state, fakeCtx());
    expect(actions).toEqual([
      { id: "plan.add", labelKey: "sim.action.plan-add", available: true },
      { id: "plan.remove", labelKey: "sim.action.plan-remove", available: true },
      { id: "plan.clear", labelKey: "sim.action.plan-clear", available: true },
      { id: "end_week", labelKey: "sim.action.end-week", available: true },
    ]);
  });

  it("carries the parameter domain in the projection, not on AvailableAction itself — no action here has a params field", () => {
    const actions = availableActions(state, fakeCtx());
    for (const action of actions) {
      expect(action).not.toHaveProperty("params");
    }
  });
});

describe("availableActions — W100.2 emptyPlanPolicy gate", () => {
  function ctxWithPolicy(emptyPlanPolicy: SimulationCampaign["emptyPlanPolicy"]): KindContext {
    const ctx = fakeCtx();
    return { ...ctx, campaign: { ...ctx.campaign, content: { ...content, emptyPlanPolicy } } };
  }

  it("leaves end_week available when emptyPlanPolicy is absent, even with nothing planned", () => {
    const actions = availableActions(state, fakeCtx());
    expect(actions.find((a) => a.id === "end_week")?.available).toBe(true);
  });

  it("reports end_week unavailable when emptyPlanPolicy forbids it and the plan has no actions", () => {
    const actions = availableActions(state, ctxWithPolicy("forbid"));
    expect(actions.find((a) => a.id === "end_week")?.available).toBe(false);
  });

  it("reports end_week available when emptyPlanPolicy forbids it but the plan has an action", () => {
    const withAction: SimulationKindState = { ...state, plan: { week: 1, actions: [{ id: "a", type: "rest", actorId: "player", parameters: {} }] } };
    const actions = availableActions(withAction, ctxWithPolicy("forbid"));
    expect(actions.find((a) => a.id === "end_week")?.available).toBe(true);
  });
});
