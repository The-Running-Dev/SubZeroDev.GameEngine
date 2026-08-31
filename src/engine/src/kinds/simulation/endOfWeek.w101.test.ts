/**
 * W101.3/W101.4/W101.5/W101.6/W101.7 — the `business` end-of-week system, rival wiring
 * into `end_week`, shared-resolver parity, RNG-stream/registry-order independence, and
 * contested job-opening resolution.
 *
 * Contract: `10-simulation-kind.md` §2.2 (`resolveContest`), §3 (`business`'s ordering),
 * §7.8 (`RivalConfig`), §7.10 (`AgentStrategy`/`AgentState`), §7.12.
 */

import { describe, it, expect } from "vitest";
import { business, runEndOfWeek } from "./endOfWeek.js";
import { advance } from "./advance.js";
import { initialState } from "./initial.js";
import { aggressiveStrategy } from "./agentStrategies.js";
import { applyForJobResolver } from "./resolvers.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { AgentState, SimulationKindState } from "./state.js";
import type { ActorState, BusinessRecord } from "./actor.js";
import type { BusinessDefinition, JobDefinition, RivalConfig, ScenarioDefinition } from "./content.js";
import type { GameAction } from "./plan.js";
import type { Campaign } from "../../core/registry/types.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { PublicWorldState } from "./view.js";

function recordingEmitter(): { emit: ResolutionEmitter; events: string[] } {
  const events: string[] = [];
  return { emit: { emit: (name) => { events.push(name); } }, events };
}

function actor(overrides: Partial<ActorState> = {}): ActorState {
  return {
    identity: { actorId: "player", name: "X", age: 25, backgroundId: "bg" },
    currentLocationId: "home",
    finances: { cashCents: 0, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
    needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
    attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: { definitionId: "h", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
    inventory: [], relationships: [], projects: [], businesses: [],
    skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// W101.3 — the business end-of-week system
// ---------------------------------------------------------------------------

const STALL: BusinessDefinition = {
  id: "stall", nameKey: "k.n", descriptionKey: "k.d",
  requirements: [], startupCostCents: 5000,
  weeklyRevenueCents: 3000, weeklyExpensesCents: 1000, minimumCashCents: -500, tags: [],
};

function stateWithBusinesses(playerBusinesses: BusinessRecord[], agents: AgentState[] = []): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: actor({ businesses: playerBusinesses }),
    economy: {} as SimulationKindState["economy"],
    world: { agents, jobMarket: { openings: [] } } as unknown as SimulationKindState["world"],
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    resolution: null,
    plan: null,
  };
}

describe("W101.3 — business", () => {
  it("posts revenue and expenses once, net into cashOnHandCents", () => {
    const record: BusinessRecord = { instanceId: "b1", definitionId: "stall", startedWeek: 1, cashOnHandCents: 0, weeksOperated: 0, status: "operating" };
    const result = business(stateWithBusinesses([record]), [STALL]);
    expect(result.state.player.businesses).toEqual([
      { instanceId: "b1", definitionId: "stall", startedWeek: 1, cashOnHandCents: 2000, weeksOperated: 1, status: "operating" },
    ]);
    expect(result.changes.map((c) => c.reason)).toEqual(["business_revenue", "business_expense"]);
  });

  it("closes immediately, business_insolvent, when cashOnHandCents drops below minimumCashCents — no grace period", () => {
    const record: BusinessRecord = { instanceId: "b1", definitionId: "stall", startedWeek: 1, cashOnHandCents: -3000, weeksOperated: 3, status: "operating" };
    const result = business(stateWithBusinesses([record]), [STALL]);
    const updated = result.state.player.businesses[0]!;
    expect(updated.status).toBe("closed");
    expect(updated.closedReason).toBe("business_insolvent");
    expect(updated.cashOnHandCents).toBe(-3000 + 2000); // still nets this week's cashflow before closing
  });

  it("a closed record is left untouched — cashflow posts only for status: operating", () => {
    const record: BusinessRecord = { instanceId: "b1", definitionId: "stall", startedWeek: 1, cashOnHandCents: 999, weeksOperated: 2, status: "closed", closedWeek: 4 };
    const result = business(stateWithBusinesses([record]), [STALL]);
    expect(result.state.player.businesses).toEqual([record]);
    expect(result.changes).toEqual([]);
  });

  it("runs over every world.agents[].actor too, forward-compatible with rivals", () => {
    const record: BusinessRecord = { instanceId: "b1", definitionId: "stall", startedWeek: 1, cashOnHandCents: 0, weeksOperated: 0, status: "operating" };
    const agent: AgentState = {
      id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: actor({ businesses: [record] }),
      goals: [], planningDepth: 0, strategy: {}, rngSeq: 0,
    };
    const result = business(stateWithBusinesses([], [agent]), [STALL]);
    expect(result.state.world.agents[0]!.actor.businesses[0]!.cashOnHandCents).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// W101.4 — initialState builds one AgentState per RivalConfig
// ---------------------------------------------------------------------------

const BACKGROUND = {
  id: "bg-rival", nameKey: "k", descriptionKey: "k",
  startingAttributes: { intelligence: 50, discipline: 70, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  startingSkills: {}, startingCredentials: [], startingTraits: [], startingCashModifierCents: 200,
};

const HOUSING = {
  id: "housing-1", nameKey: "k", descriptionKey: "k",
  upfrontCostCents: 0, weeklyCostCents: 1000, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
  commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
  requirements: [], tags: [],
};

const RIVAL_CONFIG: RivalConfig = {
  agentId: "agent-1", strategyId: "aggressive", displayNameKey: "k.rival",
  startingBackgroundId: "bg-rival",
  initialConditions: [{ target: "player.attributes.charisma", operation: "add", value: 10, sourceId: "rival-seed" }],
};

function scenarioWithRival(rivals: readonly RivalConfig[]): ScenarioDefinition {
  return {
    id: "scenario-1", nameKey: "k", descriptionKey: "k",
    startingBackgroundIds: ["bg-rival"], startingCashCents: 5000, startingHousingId: "housing-1",
    startingLocationId: "home", startingInventory: [], goalIds: [], mode: "classic",
    goalFailurePrecedence: "goals_win", rivals,
  };
}

function campaignWithRivals(rivals: readonly RivalConfig[]): Campaign {
  const content: SimulationCampaign = {
    descriptionKey: "k",
    jobs: [], courses: [], housing: [HOUSING], items: [], events: [], npcs: [], goals: [],
    scenarios: [scenarioWithRival(rivals)], difficulties: [], opportunities: [], achievements: [],
    headlines: [], employers: [], locations: [], backgrounds: [BACKGROUND], traits: [], skills: [],
    projects: [], businesses: [],
    scenarioId: "scenario-1", goalFailurePrecedence: "goals_win",
    sceneTemplateKey: "k", actionLabelKeys: { planAdd: "k", planRemove: "k", planClear: "k", endWeek: "k" },
  };
  return { id: "test", kindId: "simulation", version: "1.0.0", titleKey: "k", content };
}

describe("W101.4 — scenario-declared rivals", () => {
  it("absent/empty rivals builds WorldState.agents: [] — today's behaviour, unchanged", () => {
    const result = initialState(campaignWithRivals([]));
    expect(result.state.world.agents).toEqual([]);
  });

  it("one AgentState per RivalConfig, seeded from its own background with initialConditions applied on top", () => {
    const result = initialState(campaignWithRivals([RIVAL_CONFIG]));
    expect(result.state.world.agents).toHaveLength(1);
    const agent = result.state.world.agents[0]!;
    expect(agent.id).toBe("agent-1");
    expect(agent.strategyId).toBe("aggressive");
    expect(agent.rngSeq).toBe(0);
    expect(agent.actor.attributes.discipline).toBe(70); // from the background
    expect(agent.actor.attributes.charisma).toBe(60); // 50 base + 10 initialConditions
    expect(agent.actor.projects).toEqual([]);
    expect(agent.actor.businesses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// W101.5 — the player and rivals use the same ActorState mechanics and resolvers
// ---------------------------------------------------------------------------

const CASHIER_JOB: JobDefinition = {
  id: "job-cashier", titleKey: "k", descriptionKey: "k",
  employerId: "employer-1", careerPathId: "career", tier: "entry",
  schedule: { weeklyTimeCost: 6, flexibility: 50 }, compensation: { baseWeeklyPayCents: 10000 },
  requirements: [], performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
  promotionPaths: [], terminationRules: [], contested: true, tags: [],
};

function ctxFor(jobs: readonly JobDefinition[]): KindContext {
  return {
    campaign: { content: { jobs, locations: [{ id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: ["apply_for_job"] }] } as unknown as SimulationCampaign },
  } as unknown as KindContext;
}

function stateWithOpening(agents: AgentState[] = []): SimulationKindState {
  return {
    calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: actor(),
    economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      agents, locations: [], jobMarket: { openings: [{ jobId: "job-cashier", contested: true, positionsAvailable: 2, postedWeek: 1 }] },
    } as unknown as SimulationKindState["world"],
    activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
    goals: [], resolution: null, plan: { week: 3, actions: [] },
  };
}

describe("W101.5 — identical state and the same chosen action produce identical actor-local results", () => {
  it("apply_for_job resolves the player and a rival through the same calculate/apply, differing only by actorId's own address", () => {
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: actor({ identity: { ...actor().identity, actorId: "agent-1" } }), goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };
    const s = stateWithOpening([agent]);
    const ctx = ctxFor([CASHIER_JOB]);

    const playerAction: GameAction = { id: "a1", type: "apply_for_job", actorId: "player", targetId: "job-cashier", parameters: {} };
    const rivalAction: GameAction = { id: "a1", type: "apply_for_job", actorId: "agent-1", targetId: "job-cashier", parameters: {} };

    const playerNext = applyForJobResolver.apply(s, applyForJobResolver.calculate(s, playerAction, ctx));
    const rivalNext = applyForJobResolver.apply(s, applyForJobResolver.calculate(s, rivalAction, ctx));

    const playerApp = playerNext.player.career.pendingApplications[0]!;
    const rivalApp = rivalNext.world.agents[0]!.actor.career.pendingApplications[0]!;
    expect(rivalApp).toEqual(playerApp);
  });
});

// ---------------------------------------------------------------------------
// W101.6 — a rival's choices depend only on its own view/state, never on registry
// construction order or whether a recording emitter is enabled
// ---------------------------------------------------------------------------

describe("W101.6 — order and emitter independence", () => {
  it("aggressiveStrategy applies to the lowest-jobId opening, sorted, never construction order", () => {
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: actor(), goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };
    const view: PublicWorldState = {
      calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, availableTimeUnits: 14 },
      locations: [],
      jobMarket: { openings: [{ jobId: "job-z", contested: false }, { jobId: "job-a", contested: false }] },
      economy: { sectorDemand: {}, marketPrices: {}, indicators: {} },
    };
    const actions = aggressiveStrategy.selectActions(view, agent);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.targetId).toBe("job-a");
  });

  it("does nothing once already employed", () => {
    const employed = actor({ career: { history: [], totalWeeksEmployed: 3, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: { jobId: "job-a", employerId: "e", startedWeek: 1, performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 100, weeksAtCurrentPay: 1 } } });
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: employed, goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };
    const view: PublicWorldState = {
      calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, availableTimeUnits: 14 },
      locations: [], jobMarket: { openings: [{ jobId: "job-a", contested: false }] }, economy: { sectorDemand: {}, marketPrices: {}, indicators: {} },
    };
    expect(aggressiveStrategy.selectActions(view, agent)).toEqual([]);
  });

  it("end_week resolves a rival's own action to the identical result whether or not the emitter records", () => {
    const jobs = [CASHIER_JOB];
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: actor({ identity: { ...actor().identity, actorId: "agent-1" } }), goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };
    const buildState = (): SimulationKindState => ({ ...stateWithOpening([agent]), plan: { week: 3, actions: [] } });
    const campaign: Campaign = { id: "t", kindId: "simulation", version: "1", titleKey: "k", content: { jobs, locations: [{ id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: [] }], scenarios: [{ id: "s", scenarioId: "s" }] } as unknown as SimulationCampaign };
    const ctxFn = (emit: ResolutionEmitter): KindContext => ({
      campaign, seq: 1, emit, derive: () => ({ nextInt: () => 0, nextPercent: () => 0, pick: (i: readonly unknown[]) => i[0], weightedPick: (i: readonly { item: unknown }[]) => i[0]!.item }),
    } as unknown as KindContext);

    const quiet = advance(buildState(), "end_week", undefined, ctxFn({ emit: () => undefined }));
    const recorded = advance(buildState(), "end_week", undefined, ctxFn(recordingEmitter().emit));
    expect(recorded.state.world.agents[0]!.actor.career.pendingApplications).toEqual(quiet.state.world.agents[0]!.actor.career.pendingApplications);
  });
});

// ---------------------------------------------------------------------------
// W101.7 — contested resolution
// ---------------------------------------------------------------------------

describe("W101.7 — a contested job opening resolves by resolveContest, never claim order", () => {
  it("the higher-discipline claimant wins a single-position contest; the loser gets no Employment and no duplicate hire", () => {
    const application = { jobId: "job-cashier", submittedWeek: 3, resolvesWeek: 5, contested: true, outcome: "pending" as const };
    const strongPlayer = actor({ attributes: { ...actor().attributes, discipline: 90 }, career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const weakerAgent = actor({ identity: { ...actor().identity, actorId: "agent-1" }, attributes: { ...actor().attributes, discipline: 10 }, career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: weakerAgent, goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };

    const state: SimulationKindState = {
      calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
      player: strongPlayer,
      economy: {} as SimulationKindState["economy"],
      world: { agents: [agent], jobMarket: { openings: [{ jobId: "job-cashier", contested: true, positionsAvailable: 1, postedWeek: 3 }] } } as unknown as SimulationKindState["world"],
      activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
      goals: [], resolution: null, plan: null,
    };

    const { emit } = recordingEmitter();
    const result = runEndOfWeek(state, emit, [], "goals_win", [CASHIER_JOB]);

    expect(result.state.player.career.currentEmployment).toMatchObject({ jobId: "job-cashier" });
    expect(result.state.world.agents[0]!.actor.career.currentEmployment).toBeUndefined();
    expect(result.state.world.agents[0]!.actor.career.pendingApplications).toEqual([]);
    expect((result.state.world as unknown as { jobMarket: { openings: unknown[] } }).jobMarket.openings).toEqual([]);
  });

  it("a tie breaks on actorId ascending — never claim/construction order", () => {
    const application = { jobId: "job-cashier", submittedWeek: 3, resolvesWeek: 5, contested: true, outcome: "pending" as const };
    const playerActor = actor({ career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const agentActor = actor({ identity: { ...actor().identity, actorId: "agent-1" }, career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: agentActor, goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };

    const state: SimulationKindState = {
      calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
      player: playerActor,
      economy: {} as SimulationKindState["economy"],
      world: { agents: [agent], jobMarket: { openings: [{ jobId: "job-cashier", contested: true, positionsAvailable: 1, postedWeek: 3 }] } } as unknown as SimulationKindState["world"],
      activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
      goals: [], resolution: null, plan: null,
    };

    const { emit } = recordingEmitter();
    const result = runEndOfWeek(state, emit, [], "goals_win", [CASHIER_JOB]);

    // "agent-1" < "player" under en-US-POSIX collation — the agent wins the tie.
    expect(result.state.world.agents[0]!.actor.career.currentEmployment).toMatchObject({ jobId: "job-cashier" });
    expect(result.state.player.career.currentEmployment).toBeUndefined();
  });

  it("an uncontested (unbounded) opening keeps every prior week's behaviour: every due applicant hired, no contest", () => {
    const application = { jobId: "job-cashier", submittedWeek: 3, resolvesWeek: 5, contested: false, outcome: "pending" as const };
    const playerActor = actor({ career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const agentActor = actor({ identity: { ...actor().identity, actorId: "agent-1" }, career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" } });
    const agent: AgentState = { id: "agent-1", strategyId: "aggressive", displayNameKey: "k", actor: agentActor, goals: [], planningDepth: 0, strategy: {}, rngSeq: 0 };

    const state: SimulationKindState = {
      calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
      player: playerActor,
      economy: {} as SimulationKindState["economy"],
      world: { agents: [agent], jobMarket: { openings: [{ jobId: "job-cashier", contested: false, postedWeek: 3 }] } } as unknown as SimulationKindState["world"],
      activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
      goals: [], resolution: null, plan: null,
    };

    const { emit } = recordingEmitter();
    const result = runEndOfWeek(state, emit, [], "goals_win", [CASHIER_JOB]);

    expect(result.state.player.career.currentEmployment).toMatchObject({ jobId: "job-cashier" });
    expect(result.state.world.agents[0]!.actor.career.currentEmployment).toMatchObject({ jobId: "job-cashier" });
  });
});
