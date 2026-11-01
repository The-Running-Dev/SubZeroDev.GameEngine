import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { initialState } from "./initial.js";
import { SIMULATION_REASON_CODES, SIMULATION_REASON_MESSAGES } from "./reasons.js";
import { ACTION_TYPES, type ActionType } from "./plan.js";
import type { SimulationCampaign } from "./campaign.js";
import type { GoalDefinition } from "./content.js";
import type { SimulationKindState } from "./state.js";
import type {
  ActionParams,
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
    weeklyCostCents: 5000, utilitiesCents: 0, transportCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
    missedPayments: 0, evictionStage: "none" as const,
  },
  inventory: [], relationships: [], projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
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
  traits: [], skills: [], projects: [], businesses: [],
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
    const result = advance(state, "plan.add", { actionType: "travel", targetId: "loc-1" }, fakeCtx());
    expect(result.error).toBeUndefined();
    expect(result.state.plan?.actions).toHaveLength(1);
    expect(result.state.plan?.actions[0]).toMatchObject({ type: "travel", targetId: "loc-1", actorId: "player" });
  });

  // S138.5 — `rest` targets nothing, so §4 does not declare `targetId` for it. Before S138
  // this test asserted the action stored the id; its resolver never read it.
  it("refuses a targetId on rest, which targets nothing, with unexpected_params (S138.5)", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "rest", targetId: "loc-1" }, fakeCtx());
    expect(result.error?.code).toBe("unexpected_params");
    expect(result.state).toBe(state);
  });

  it("ids the constructed action from ctx.seq", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "rest" }, fakeCtx());
    expect(result.state.plan?.actions[0]?.id).toBe("action-7");
  });

  it("puts the declared params beyond actionType/targetId into the action's own parameters", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "borrow_money", amountCents: 5000 }, fakeCtx());
    expect(result.state.plan?.actions[0]?.parameters).toEqual({ amountCents: 5000 });
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

  // A `respond_to_event` only addresses a pending response when it names a choice that
  // response actually offers. Matching on `targetId` alone let a malformed `plan.add` open
  // the gate, and the caller met `respondToEventResolver`'s `action_not_available` at
  // `end_week` instead — a whole-week rejection in place of the gate's own reason.
  it("does not count a respond_to_event carrying no choiceId as addressing the response", () => {
    const withMalformed = advance(
      stateWithPending(), "plan.add", { actionType: "respond_to_event", targetId: "pending-1" }, fakeCtx(),
    ).state;
    expect(advance(withMalformed, "end_week", undefined, fakeCtx()).error?.code).toBe("event_response_pending");
    expect(advance(withMalformed, "plan.add", { actionType: "rest" }, fakeCtx()).error?.code).toBe("event_response_pending");
  });

  it("does not count a respond_to_event naming a choice the response does not offer", () => {
    const withUnofferedChoice = advance(
      stateWithPending(), "plan.add",
      { actionType: "respond_to_event", targetId: "pending-1", choiceId: "choice-not-on-offer" },
      fakeCtx(),
    ).state;
    expect(advance(withUnofferedChoice, "end_week", undefined, fakeCtx()).error?.code).toBe("event_response_pending");
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

  it("rejects unknown_action for a start_project action that names no definition", () => {
    // W101 wires `start_project` for real (`resolvers.ts`) — the last `ActionType` this test
    // used to exercise via `stubResolver` (previously "start_project", before that "shop"
    // until W56). A `targetId` naming no real content is now refused at `plan.add` (S138);
    // a missing one still reaches `end_week`, which rejects it as before (S138.7).
    const withAction = advance(baseState(), "plan.add", { actionType: "start_project" }, fakeCtx()).state;
    const result = advance(withAction, "end_week", undefined, fakeCtx());
    expect(result.error?.code).toBe("unknown_action");
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

describe("advance — end_week's plan_empty gate (W100.2)", () => {
  function ctxWithCampaign(content: SimulationCampaign): KindContext {
    return { ...fakeCtx(), campaign: { ...campaign, content } };
  }

  it("permits end_week with an empty plan when emptyPlanPolicy is absent (0.10 behaviour)", () => {
    const result = advance(baseState(), "end_week", undefined, fakeCtx());
    expect(result.error).toBeUndefined();
  });

  it("permits end_week with an empty plan when emptyPlanPolicy is \"permit\"", () => {
    const ctx = ctxWithCampaign({ ...simulationCampaign, emptyPlanPolicy: "permit" });
    const result = advance(baseState(), "end_week", undefined, ctx);
    expect(result.error).toBeUndefined();
  });

  it("rejects end_week with plan_empty when emptyPlanPolicy is \"forbid\" and nothing is planned, state unchanged", () => {
    const ctx = ctxWithCampaign({ ...simulationCampaign, emptyPlanPolicy: "forbid" });
    const state = baseState();
    const result = advance(state, "end_week", undefined, ctx);
    expect(result.error?.code).toBe("plan_empty");
    expect(result.state).toBe(state);
  });

  it("advances normally when emptyPlanPolicy is \"forbid\" but a plan action exists", () => {
    const ctx = ctxWithCampaign({ ...simulationCampaign, emptyPlanPolicy: "forbid" });
    const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, ctx).state;
    const result = advance(withAction, "end_week", undefined, ctx);
    expect(result.error).toBeUndefined();
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

describe("advance — acceptance is declaration (S136, §4, 04 §3)", () => {
  const extraKey: Partial<Record<ActionType, readonly [string, unknown]>> = {
    borrow_money: ["amountCents", 5000],
    repay_debt: ["amountCents", 5000],
    deposit_savings: ["amountCents", 5000],
    invest: ["amountCents", 5000],
    respond_to_event: ["choiceId", "choice-a"],
    operate_business: ["close", true],
  };

  it("rejects an undeclared plan.add key with the full rejection shape, state untouched (S136.1)", () => {
    const state = baseState();
    const result = advance(state, "plan.add", { actionType: "borrow_money", amountCents: 5000, choiceId: "x" }, fakeCtx());
    expect(result).toEqual({
      state,
      status: "active",
      changes: [],
      messages: [{ key: "simulation.reason.unexpected_params", visible: true }],
      error: { code: "unexpected_params", messageKey: "simulation.reason.unexpected_params" },
    });
    expect(result.state).toBe(state);
  });

  it("refuses the stray key before reading any value — a malformed declared value still loses to it", () => {
    const result = advance(baseState(), "plan.add", { actionType: "borrow_money", amountCents: "not-a-number", extra: 1 }, fakeCtx());
    expect(result.error?.code).toBe("unexpected_params");
  });

  it("still answers an unrecognised actionType with unknown_action, whatever else is present", () => {
    const result = advance(baseState(), "plan.add", { actionType: "definitely_not_real", extra: 1 }, fakeCtx());
    expect(result.error?.code).toBe("unknown_action");
  });

  for (const actionType of ACTION_TYPES) {
    const extra = extraKey[actionType];
    // `targetId` is left out: its value is domain-checked since S138, which the S138 block
    // below covers per type. The pending response is there only so `choiceId` names one.
    it(`accepts plan.add ${actionType} with exactly its declared keys, and stores only those (S136.3)`, () => {
      const params = {
        actionType,
        ...(actionType === "respond_to_event" ? { targetId: "pending-1" } : {}),
        ...(extra ? { [extra[0]]: extra[1] } : {}),
      };
      const state = actionType === "respond_to_event"
        ? makeState({ pendingEventResponses: [{ id: "pending-1", eventId: "event-1", rolledWeek: 1, presentWeek: 1, availableChoiceIds: ["choice-a"] }] })
        : baseState();
      const result = advance(state, "plan.add", params, fakeCtx());
      expect(result.error).toBeUndefined();
      expect(result.state.plan?.actions[0]?.parameters).toEqual(extra ? { [extra[0]]: extra[1] } : {});
    });
    it(`rejects plan.add ${actionType} carrying one key it does not declare (S136.2)`, () => {
      const stray = extra?.[0] === "amountCents" ? "choiceId" : "amountCents";
      const result = advance(baseState(), "plan.add", { actionType, [stray]: 1 }, fakeCtx());
      expect(result.error?.code).toBe("unexpected_params");
    });
  }

  it("rejects plan.remove carrying a key beside index, before the index is looked at", () => {
    const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, fakeCtx()).state;
    const result = advance(withAction, "plan.remove", { index: 0, extra: 1 }, fakeCtx());
    expect(result.error?.code).toBe("unexpected_params");
    expect(result.state).toBe(withAction);
  });

  for (const actionId of ["plan.clear", "end_week"]) {
    it(`rejects ${actionId} carrying any key, and accepts it with none or an empty object`, () => {
      const withAction = advance(baseState(), "plan.add", { actionType: "rest" }, fakeCtx()).state;
      expect(advance(withAction, actionId, { x: 1 }, fakeCtx()).error?.code).toBe("unexpected_params");
      expect(advance(withAction, actionId, {}, fakeCtx()).error).toBeUndefined();
      expect(advance(withAction, actionId, undefined, fakeCtx()).error).toBeUndefined();
    });
  }
});

describe("advance — plan.add refuses ids the game never issued (S138, §4)", () => {
  // One id per §4 domain. The shapes are minimal: `plan.add` reads only `id`, and the one
  // test that reaches a resolver (S138.7's `housing-2`) gives its entry the full shape.
  const domainCampaign = {
    ...simulationCampaign,
    jobs: [{ id: "job-1" }],
    courses: [{ id: "course-1" }],
    housing: [
      ...simulationCampaign.housing,
      { ...simulationCampaign.housing[0]!, id: "housing-2", upfrontCostCents: 1_000_000 },
    ],
    items: [{ id: "item-1" }],
    npcs: [{ id: "npc-1" }],
    locations: [{ ...simulationCampaign.locations[0]!, actionTypes: ["move_housing"] }],
    projects: [{ id: "project-1" }],
    businesses: [{ id: "business-1" }],
  } as unknown as SimulationCampaign;

  function ctxWith(seq = 7): KindContext {
    return { ...fakeCtx(), campaign: { ...campaign, content: domainCampaign }, seq };
  }

  const pending = { id: "pending-1", eventId: "event-1", rolledWeek: 1, presentWeek: 1, availableChoiceIds: ["choice-a"] };

  function domainState(): SimulationKindState {
    const state = makeState({ activeOpportunities: [{ id: "opp-1" }] as unknown as SimulationKindState["activeOpportunities"] });
    state.player.inventory = [{ instanceId: "inv-held" }] as unknown as SimulationKindState["player"]["inventory"];
    state.player.projects = [{ instanceId: "project-held" }] as unknown as SimulationKindState["player"]["projects"];
    state.player.businesses = [{ instanceId: "business-held" }] as unknown as SimulationKindState["player"]["businesses"];
    return state;
  }

  function add(state: SimulationKindState, params: ActionParams, seq = 7) {
    return advance(state, "plan.add", params, ctxWith(seq));
  }

  const unknownTarget = {
    status: "active",
    changes: [],
    messages: [{ key: "simulation.reason.unknown_target", visible: true }],
    error: { code: "unknown_target", messageKey: "simulation.reason.unknown_target" },
  };

  it("refuses apply_for_job naming a job never issued with the full rejection shape, state untouched (S138.1)", () => {
    const state = domainState();
    const result = add(state, { actionType: "apply_for_job", targetId: "job-never-issued" });
    expect(result).toEqual({ state, ...unknownTarget });
    expect(result.state).toBe(state);
  });

  // S138.2 — one id inside and one outside each §4 domain.
  const domains: readonly (readonly [ActionType, string])[] = [
    ["apply_for_job", "job-1"],
    ["enroll_course", "course-1"],
    ["attend_class", "course-1"],
    ["study", "course-1"],
    ["withdraw_course", "course-1"],
    ["move_housing", "housing-2"],
    ["shop", "item-1"],
    ["maintain_item", "inv-held"],
    ["repair_item", "inv-held"],
    ["sell_item", "inv-held"],
    ["travel", "loc-1"],
    ["socialize", "npc-1"],
    ["accept_opportunity", "opp-1"],
    ["decline_opportunity", "opp-1"],
    ["start_project", "project-1"],
    ["work_on_project", "project-held"],
    ["start_business", "business-1"],
    ["operate_business", "business-held"],
  ];
  for (const [actionType, issued] of domains) {
    it(`accepts ${actionType} naming an issued id and refuses one never issued (S138.2)`, () => {
      const accepted = add(domainState(), { actionType, targetId: issued });
      expect(accepted.error).toBeUndefined();
      expect(accepted.state.plan?.actions[0]).toMatchObject({ type: actionType, targetId: issued });

      const state = domainState();
      const refused = add(state, { actionType, targetId: "never-issued" });
      expect(refused.error?.code).toBe("unknown_target");
      expect(refused.state).toBe(state);
    });
  }

  it("checks each type against its own domain, not any domain — a course id is not a job (S138.2)", () => {
    expect(add(domainState(), { actionType: "apply_for_job", targetId: "course-1" }).error?.code).toBe("unknown_target");
    expect(add(domainState(), { actionType: "sell_item", targetId: "item-1" }).error?.code).toBe("unknown_target");
  });

  it("refuses a targetId that is not a string, rather than silently dropping it", () => {
    expect(add(domainState(), { actionType: "apply_for_job", targetId: 5 }).error?.code).toBe("unknown_target");
  });

  describe("respond_to_event (S138.3)", () => {
    function withPending(): SimulationKindState {
      return { ...domainState(), pendingEventResponses: [pending] };
    }

    it("refuses a targetId naming no pending response", () => {
      const state = withPending();
      const result = add(state, { actionType: "respond_to_event", targetId: "pending-never", choiceId: "choice-a" });
      expect(result.error?.code).toBe("unknown_target");
      expect(result.state).toBe(state);
    });

    it("refuses a choiceId the named response does not offer", () => {
      const result = add(withPending(), { actionType: "respond_to_event", targetId: "pending-1", choiceId: "choice-not-on-offer" });
      expect(result.error?.code).toBe("unknown_target");
    });

    it("refuses a choiceId with no response named to offer it", () => {
      expect(add(withPending(), { actionType: "respond_to_event", choiceId: "choice-a" }).error?.code).toBe("unknown_target");
    });

    it("accepts a choiceId the named response offers", () => {
      const result = add(withPending(), { actionType: "respond_to_event", targetId: "pending-1", choiceId: "choice-a" });
      expect(result.error).toBeUndefined();
      expect(result.state.plan?.actions[0]).toMatchObject({ targetId: "pending-1", parameters: { choiceId: "choice-a" } });
    });
  });

  // S138.4 — an id minted by a pending entry is issued while that entry is in the plan.
  const minters: readonly (readonly [ActionType, string, ActionType, string])[] = [
    ["shop", "item-1", "sell_item", "inv-action-7"],
    ["start_project", "project-1", "work_on_project", "project-action-7"],
    ["start_business", "business-1", "operate_business", "business-action-7"],
  ];
  for (const [minter, definition, user, minted] of minters) {
    it(`accepts ${user} naming ${minted} while ${minter} is planned, and refuses it once removed or cleared (S138.4)`, () => {
      const withMinter = add(domainState(), { actionType: minter, targetId: definition }, 7).state;
      expect(withMinter.plan?.actions[0]?.id).toBe("action-7");
      expect(add(withMinter, { actionType: user, targetId: minted }, 8).error).toBeUndefined();

      const removed = advance(withMinter, "plan.remove", { index: 0 }, ctxWith(8)).state;
      expect(add(removed, { actionType: user, targetId: minted }, 9).error?.code).toBe("unknown_target");

      const cleared = advance(withMinter, "plan.clear", undefined, ctxWith(8)).state;
      expect(add(cleared, { actionType: user, targetId: minted }, 9).error?.code).toBe("unknown_target");
    });
  }

  it("does not let one minter's id stand in for another's — inv- is not a project instance (S138.4)", () => {
    const withShop = add(domainState(), { actionType: "shop", targetId: "item-1" }, 7).state;
    expect(add(withShop, { actionType: "work_on_project", targetId: "project-action-7" }, 8).error?.code).toBe("unknown_target");
    expect(add(withShop, { actionType: "work_on_project", targetId: "inv-action-7" }, 8).error?.code).toBe("unknown_target");
  });

  const untargeted: readonly ActionType[] = [
    "work", "work_overtime", "search_for_work", "negotiate_job_terms", "eat", "rest", "exercise",
    "pay_bills", "borrow_money", "repay_debt", "deposit_savings", "invest", "custom",
  ];
  for (const actionType of untargeted) {
    it(`refuses any targetId on ${actionType}, which targets nothing, with unexpected_params (S138.5)`, () => {
      expect(add(domainState(), { actionType, targetId: "loc-1" }).error?.code).toBe("unexpected_params");
    });
  }

  it("runs last: unknown_action, unexpected_params and event_response_pending each win over it (S138.6)", () => {
    expect(add(domainState(), { actionType: "teleport" }).error?.code).toBe("unknown_action");
    expect(add(domainState(), { actionType: "apply_for_job", targetId: "job-never-issued", amountCents: 1 }).error?.code)
      .toBe("unexpected_params");
    const withPending = { ...domainState(), pendingEventResponses: [pending] };
    expect(add(withPending, { actionType: "apply_for_job", targetId: "job-never-issued" }).error?.code)
      .toBe("event_response_pending");
  });

  it("leaves a missing targetId and affordability to end_week, with their pre-change codes (S138.7)", () => {
    const noTarget = add(domainState(), { actionType: "apply_for_job" });
    expect(noTarget.error).toBeUndefined();
    expect(noTarget.state.plan?.actions[0]?.targetId).toBeUndefined();

    const unaffordable = add(domainState(), { actionType: "move_housing", targetId: "housing-2" });
    expect(unaffordable.error).toBeUndefined();
    expect(advance(unaffordable.state, "end_week", undefined, ctxWith(8)).error?.code).toBe("insufficient_funds");
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
    {
      label: "plan.add with an undeclared key",
      run: () => advance(baseState(), "plan.add", { actionType: "rest", extra: 1 }, fakeCtx()),
    },
    {
      label: "plan.add naming an id the game never issued",
      run: () => advance(baseState(), "plan.add", { actionType: "apply_for_job", targetId: "job-never-issued" }, fakeCtx()),
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
      validateState: () => true,
      outcome: () => ({ terminal: false, terminalId: null }),
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

  it("submitAction refuses an undeclared key and logs nothing — the held state serializes byte-identically (S136.1)", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-sim" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const before = engine.serialize(created.value);

    const result = engine.submitAction(created.value, "plan.add", { actionType: "borrow_money", amountCents: 5000, choiceId: "x" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unexpected_params");
    expect(result.value).toBeUndefined();
    expect(created.value.actionLog).toHaveLength(0);
    expect(engine.serialize(created.value)).toBe(before);
  });

  it("submitAction refuses an id the game never issued and logs nothing — serialize is byte-identical (S138.1)", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-sim" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const before = engine.serialize(created.value);

    const result = engine.submitAction(created.value, "plan.add", { actionType: "apply_for_job", targetId: "job-never-issued" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_target");
    expect(result.value).toBeUndefined();
    expect(created.value.actionLog).toHaveLength(0);
    expect(engine.serialize(created.value)).toBe(before);
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
