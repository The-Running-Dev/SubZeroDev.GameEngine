import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { initialState } from "./initial.js";
import { SIMULATION_REASON_CODES, SIMULATION_REASON_MESSAGES } from "./reasons.js";
import type { SimulationCampaign } from "./campaign.js";
import type { GoalDefinition } from "./content.js";
import type { SimulationKindState } from "./state.js";
import type {
  AvailableAction,
  InitialStateResult,
  Kind,
  KindContext,
  KindRegistry,
  SceneBody,
} from "../../core/kernel/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import { createEngine } from "../../core/kernel/engine.js";
import type { EngineHost } from "../../core/composition/types.js";

const calendar = { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 };
const player = {
  identity: { actorId: "player", name: "Test Subject", age: 25, backgroundId: "bg-1" },
  currentLocationId: "loc-1",
  finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
  needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
  attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" as const },
  housing: {
    definitionId: "housing-1", movedInWeek: 1, ownership: "renting" as const, damage: 0,
    weeklyCostCents: 5000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
    missedPayments: 0, evictionStage: "none" as const,
  },
  inventory: [], relationships: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
};
const economy = { inflation: 200, unemploymentRate: 500, interestRate: 300, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} };
const world = {
  npcs: [], locations: [], jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [],
  chainStates: [], strangenessBase: 0, headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {},
};

/**
 * `advance()` itself has no opinion on how its input `SimulationKindState` was built — these
 * are unit tests of its own resolution logic, not of `initial.ts`'s `ScenarioDefinition`
 * assembly (that's `initial.test.ts`'s job). Every state below is a plain object literal, not
 * a round trip through `initialState`, so the specific starting numbers each test exercises
 * (`needs.energy: 80`, `needs.happiness: 40/90/5`, …) stay exactly as authored regardless of
 * what `initial.ts`'s own fixed defaults happen to be.
 */
function makeState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { ...calendar },
    player: structuredClone(player),
    economy: { ...economy },
    world: structuredClone(world),
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    resolution: null,
    plan: { week: 1, actions: [] },
    ...overrides,
  };
}

const simulationCampaign: SimulationCampaign = {
  descriptionKey: "sim.description",
  jobs: [], courses: [], housing: [{
    id: "housing-1", nameKey: "housing.name", descriptionKey: "housing.description",
    upfrontCostCents: 0, weeklyCostCents: 5000, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
    requirements: [], tags: [],
  }],
  items: [],
  // `conditions` is never true, so the random end-of-week draw never picks this event —
  // it exists only so `advance — the mandatory-event gate`'s `respond_to_event` resolver
  // has a real `EventDefinition`/`EventChoice` to resolve `pending-1`/`choice-a` against.
  events: [{
    id: "event-1", category: "test", titleKey: "event.title", descriptionKey: "event.description",
    weight: 1, conditions: { field: "player.needs.health", operator: "less_than", value: -1 }, tags: [],
    choices: [{
      id: "choice-a", labelKey: "event.choice-a.label", requirements: [],
      outcomes: [{ outcome: { effects: [], messages: [] } }],
    }],
  }],
  npcs: [],
  goals: [],
  scenarios: [{
    id: "scenario-1", nameKey: "scenario.name", descriptionKey: "scenario.description",
    startingBackgroundIds: ["bg-1"], startingCashCents: 10000, startingHousingId: "housing-1",
    startingLocationId: "loc-1", startingInventory: [], goalIds: [], mode: "classic", goalFailurePrecedence: "goals_win",
  }],
  difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
  locations: [{ id: "loc-1", nameKey: "loc.name", descriptionKey: "loc.description", connections: [], travelTimeUnits: 0, actionTypes: [] }],
  backgrounds: [{
    id: "bg-1", nameKey: "bg.name", descriptionKey: "bg.description",
    startingAttributes: player.attributes, startingSkills: {}, startingCredentials: [], startingTraits: [],
    startingCashModifierCents: 0,
  }],
  traits: [], skills: [],
  scenarioId: "scenario-1",
  goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "sim.scene.status",
  actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
};

const campaign: Campaign = { id: "test-sim", kindId: "simulation", version: "1.0.0", titleKey: "sim.title", content: simulationCampaign };

function fakeCtx(): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 7,
    emit: { emit: () => undefined },
  };
}

function baseState(): SimulationKindState {
  return makeState();
}

describe("advance — plan.add", () => {
  it("appends a GameAction built from actionType/targetId/rest params", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "rest", targetId: "loc-1" }, fakeCtx());
    expect(result.error).toBeUndefined();
    expect(result.state.plan?.actions).toHaveLength(1);
    expect(result.state.plan?.actions[0]).toMatchObject({ type: "rest", targetId: "loc-1", actorId: "player" });
  });

  it("ids the constructed action from ctx.seq", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "rest" }, fakeCtx());
    expect(result.state.plan?.actions[0]?.id).toBe("action-7");
  });

  it("puts params beyond actionType/targetId into the action's own parameters", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "study", courseId: "crs-1" }, fakeCtx());
    expect(result.state.plan?.actions[0]?.parameters).toEqual({ courseId: "crs-1" });
  });

  it("rejects with unknown_action when actionType is missing", () => {
    const state = baseState();
    const result = advance(state, "plan.add", {}, fakeCtx());
    expect(result.error?.code).toBe("unknown_action");
    expect(result.state).toBe(state);
  });

  it("rejects with unknown_action when actionType is not a member of ActionType", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "definitely_not_a_real_action" }, fakeCtx());
    expect(result.error?.code).toBe("unknown_action");
    expect(result.state).toBe(state);
  });
});

describe("advance — plan.remove", () => {
  it("removes the action at the given index", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, fakeCtx()).state;
    const result = advance(withAction, "plan.remove", { index: 0 }, fakeCtx());
    expect(result.error).toBeUndefined();
    expect(result.state.plan?.actions).toEqual([]);
  });

  it("rejects an out-of-range index with action_not_planned, state unchanged", () => {
    const state = baseState();
    const result = advance(state, "plan.remove", { index: 0 }, fakeCtx());
    expect(result.error?.code).toBe("action_not_planned");
    expect(result.state).toBe(state);
  });
});

describe("advance — plan.clear", () => {
  it("empties the plan", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, fakeCtx()).state;
    const result = advance(withAction, "plan.clear", undefined, fakeCtx());
    expect(result.state.plan?.actions).toEqual([]);
  });
});

describe("advance — the mandatory-event gate (W94.1, W94.2)", () => {
  function stateWithPending(): SimulationKindState {
    return makeState({
      pendingEventResponses: [{ id: "pending-1", eventId: "event-1", rolledWeek: 1, presentWeek: 1, availableChoiceIds: ["choice-a"] }],
    });
  }

  it("rejects plan.add for any ActionType other than respond_to_event, state unchanged", () => {
    const state = stateWithPending();
    const result = advance(state, "plan.add", { actionType: "rest" }, fakeCtx());
    expect(result.error?.code).toBe("event_response_pending");
    expect(result.state).toBe(state);
  });

  it("rejects end_week, state unchanged", () => {
    const state = stateWithPending();
    const result = advance(state, "end_week", undefined, fakeCtx());
    expect(result.error?.code).toBe("event_response_pending");
    expect(result.state).toBe(state);
  });

  it("permits plan.add for respond_to_event itself", () => {
    const state = stateWithPending();
    const result = advance(state, "plan.add", { actionType: "respond_to_event", targetId: "pending-1", choiceId: "choice-a" }, fakeCtx());
    expect(result.error).toBeUndefined();
  });

  it("permits end_week once a queued respond_to_event covers every pending response", () => {
    const withResponse = advance(
      stateWithPending(), "plan.add",
      { actionType: "respond_to_event", targetId: "pending-1", choiceId: "choice-a" },
      fakeCtx(),
    ).state;
    const result = advance(withResponse, "end_week", undefined, fakeCtx());
    expect(result.error).toBeUndefined();
  });

  it("permits ordinary planning again once no pending response remains (no pending at all)", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "rest" }, fakeCtx());
    expect(result.error).toBeUndefined();
  });
});

describe("advance — end_week", () => {
  it("advances the calendar to the next week and starts a fresh, empty plan", () => {
    const state = baseState();
    const result = advance(state, "end_week", undefined, fakeCtx());
    expect(result.error).toBeUndefined();
    expect(result.state.calendar.currentWeek).toBe(2);
    expect(result.state.plan).toEqual({ week: 2, actions: [] });
  });

  it("status stays active — nothing in this unit's own logic can end a game yet", () => {
    const result = advance(baseState(), "end_week", undefined, fakeCtx());
    expect(result.status).toBe("active");
  });

  it("accumulates changes from end-of-week systems (needs drift, and W53's rent charge)", () => {
    const result = advance(baseState(), "end_week", undefined, fakeCtx());
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.every((c) => c.path.startsWith("player.needs.") || c.path === "player.finances.cashCents")).toBe(true);
  });

  it("rejects a planned custom action with action_not_available", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "custom" }, fakeCtx()).state;
    const result = advance(withAction, "end_week", undefined, fakeCtx());
    expect(result.error?.code).toBe("action_not_available");
  });

  it("resolves every planned, non-custom action through the stub resolver without error", () => {
    // "start_project" — still `stubResolver`. This test used "shop" until W56 gave it a
    // real resolver (and real preconditions, which `resolvers.test.ts` covers); the projects,
    // business and event/opportunity verbs are what remains unwired.
    const withAction = advance(baseState(), "plan.add", { actionType: "start_project" }, fakeCtx()).state;
    const result = advance(withAction, "end_week", undefined, fakeCtx());
    expect(result.error).toBeUndefined();
  });

  it("resolves a planned eat action through the real eatResolver, restoring satiety", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "eat" }, fakeCtx()).state;
    const result = advance(withAction, "end_week", undefined, fakeCtx());
    // Starting satiety 80, +25 eat (clamped to 100), then -4 needs drift = 96.
    expect(result.state.player.needs.satiety).toBe(96);
  });

  it("resolves a planned rest action through the real restResolver, restoring energy and relieving stress", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, fakeCtx()).state;
    const result = advance(withAction, "end_week", undefined, fakeCtx());
    // Starting energy 80, +20 rest, -3 needs drift = 97.
    expect(result.state.player.needs.energy).toBe(97);
    // Starting stress 20, -5 rest, +2 needs drift = 17.
    expect(result.state.player.needs.stress).toBe(17);
  });
});

describe("advance — end_week ends the game when every goal resolves", () => {
  const happinessGoal: GoalDefinition = {
    id: "goal-happy",
    labelKey: "goal.happy",
    descriptionKey: "goal.happy.description",
    category: "happiness",
    conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
  };

  function campaignWithGoal(goal: GoalDefinition): SimulationCampaign {
    return { ...simulationCampaign, goals: [goal] };
  }

  function ctxWithCampaign(content: SimulationCampaign): KindContext {
    return { ...fakeCtx(), campaign: { ...campaign, content } };
  }

  /** `initialState` normally seeds `state.goals` from `content.goals` (`startingGoals`,
   *  `initial.ts`) — these tests build state directly (this file's own header), so the
   *  matching `GoalState` must be seeded by hand instead. */
  function activeGoalState(goal: GoalDefinition): SimulationKindState["goals"] {
    return [{ definitionId: goal.id, status: "active", satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0, progressNotes: [] }];
  }

  it("status stays active while the goal is still active", () => {
    const ctx = ctxWithCampaign(campaignWithGoal(happinessGoal));
    const state = makeState({
      player: { ...structuredClone(player), needs: { ...player.needs, happiness: 40 } },
      goals: activeGoalState(happinessGoal),
    });
    const result = advance(state, "end_week", undefined, ctx);
    expect(result.status).toBe("active");
  });

  it("status becomes ended and error stays undefined once the goal completes", () => {
    const ctx = ctxWithCampaign(campaignWithGoal(happinessGoal));
    const state = makeState({
      player: { ...structuredClone(player), needs: { ...player.needs, happiness: 90 } },
      goals: activeGoalState(happinessGoal),
    });
    const result = advance(state, "end_week", undefined, ctx);
    expect(result.status).toBe("ended");
    expect(result.error).toBeUndefined();
  });

  it("status becomes ended once the goal's failureConditions trip", () => {
    const goalWithFailure: GoalDefinition = {
      ...happinessGoal,
      failureConditions: { field: "player.needs.happiness", operator: "less_than", value: 10 },
    };
    const ctx = ctxWithCampaign(campaignWithGoal(goalWithFailure));
    const state = makeState({
      player: { ...structuredClone(player), needs: { ...player.needs, happiness: 5 } },
      goals: activeGoalState(goalWithFailure),
    });
    const result = advance(state, "end_week", undefined, ctx);
    expect(result.status).toBe("ended");
  });
});

describe("advance — unknown action", () => {
  it("rejects an unrecognized actionId", () => {
    const state = baseState();
    const result = advance(state, "totally_fake_action", undefined, fakeCtx());
    expect(result.error?.code).toBe("unknown_action");
    expect(result.state).toBe(state);
  });
});

describe("advance — every rejection carries a player-facing message (04 §3)", () => {
  const rejections: readonly { readonly label: string; readonly run: () => ReturnType<typeof advance> }[] = [
    {
      label: "plan.add with no actionType",
      run: () => advance(baseState(), "plan.add", {}, fakeCtx()),
    },
    {
      label: "plan.remove with an out-of-range index",
      run: () => advance(baseState(), "plan.remove", { index: 0 }, fakeCtx()),
    },
    {
      label: "end_week with a planned custom action",
      run: () =>
        advance(
          advance(baseState(), "plan.add", { actionType: "custom" }, fakeCtx()).state,
          "end_week",
          undefined,
          fakeCtx(),
        ),
    },
    {
      label: "an unrecognized actionId",
      run: () => advance(baseState(), "totally_fake_action", undefined, fakeCtx()),
    },
  ];

  for (const { label, run } of rejections) {
    it(`${label} attaches one visible OutcomeMessage built from the error's own messageKey`, () => {
      const result = run();
      expect(result.error).toBeDefined();
      expect(result.messages).toEqual([{ key: result.error!.messageKey, visible: true }]);
    });
  }
});

describe("simulation kind — through the real engine (integration)", () => {
  function makeSimulationKind(): Kind<SimulationKindState> {
    return {
      id: "simulation",
      version: "1.0.0",
      reasonCodes: [...SIMULATION_REASON_CODES],
      reasonMessages: SIMULATION_REASON_MESSAGES,
      eventNames: [
        "kind.simulation.plan.changed",
        "kind.simulation.week.started",
        "kind.simulation.system.ran",
        "kind.simulation.action.resolved",
        "kind.simulation.effect.expired",
        "kind.simulation.goal.achieved",
        "kind.simulation.goal.failed",
        "kind.simulation.week.ended",
      ],
      initialState: (c): InitialStateResult<SimulationKindState> => initialState(c),
      availableActions: (): AvailableAction[] => [],
      scene: (): SceneBody => ({ textKey: "sim.scene", text: "" }),
      advance: (state, actionId, params, ctx) => advance(state, actionId, params, ctx),
      project: () => ({}),
      validateCampaign: () => ({ ok: true, errors: [], warnings: [] }),
      outcome: () => null,
    };
  }

  function makeHost(): EngineHost {
    const registryCampaign: Campaign = { id: "test-sim", kindId: "simulation", version: "1.0.0", titleKey: "sim.title", content: simulationCampaign };
    const registry: ContentRegistry = { campaigns: new Map([["test-sim", registryCampaign]]), strings: new Map() };
    const kinds = { simulation: makeSimulationKind() } as unknown as KindRegistry;
    return { kinds, registry };
  }

  it("submitAction runs plan.add then end_week through the real engine seam", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-sim" });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.value) throw new Error("expected success");

    const afterAdd = engine.submitAction(created.value, "plan.add", { actionType: "rest" });
    expect(afterAdd.ok).toBe(true);
    if (!afterAdd.ok || !afterAdd.value) throw new Error("expected success");
    const kindStateAfterAdd = afterAdd.value.kindState as SimulationKindState;
    expect(kindStateAfterAdd.plan?.actions).toHaveLength(1);

    const afterEndWeek = engine.submitAction(afterAdd.value, "end_week");
    expect(afterEndWeek.ok).toBe(true);
    if (!afterEndWeek.ok || !afterEndWeek.value) throw new Error("expected success");
    const kindStateAfterEndWeek = afterEndWeek.value.kindState as SimulationKindState;
    expect(kindStateAfterEndWeek.calendar.currentWeek).toBe(2);
    expect(kindStateAfterEndWeek.plan).toEqual({ week: 2, actions: [] });
  });

  it("submitAction rejects an unknown action id via the real engine seam", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-sim" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const result = engine.submitAction(created.value, "totally_fake_action");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});
