import { describe, it, expect } from "vitest";
import { financeIncome, financeReconcile, housing, runEndOfWeek } from "./endOfWeek.js";
import { canonicalStringify } from "../../core/persistence/canonical.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { CourseEnrollment, Employment, InventoryItem, JobApplication, NeedState } from "./actor.js";
import type { CourseDefinition, GoalDefinition, ItemDefinition, JobDefinition } from "./content.js";
import type { GoalState, JobOpening, Opportunity, SimulationKindState, StatusEffect } from "./state.js";

function recordingEmitter(): {
  emit: ResolutionEmitter;
  systems: string[];
  events: { name: string; severity: string; data: unknown }[];
} {
  const systems: string[] = [];
  const events: { name: string; severity: string; data: unknown }[] = [];
  return {
    emit: {
      emit: (name, severity, detail) => {
        if (name === "kind.simulation.system.ran") systems.push(String(detail?.data?.["system"]));
        events.push({ name, severity, data: detail?.data });
      },
    },
    systems,
    events,
  };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    definitionId: "def-1",
    kind: "job_offer",
    targetId: "job-1",
    offeredWeek: 1,
    expiresAtWeek: 5,
    ...overrides,
  };
}

function baseState(needs: NeedState, overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      needs,
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { weeklyCostCents: 0 },
      finances: { cashCents: 0 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      skills: {},
      flags: {},
      // Required by `PlayerState`, and read for real since W56's `inventory` system — the
      // partial cast below is a fixture shortcut, not a state a live game can be in.
      inventory: [],
      relationships: [],
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {} as SimulationKindState["world"],
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    plan: null,
    ...overrides,
  };
}

const NO_GOALS: readonly GoalDefinition[] = [];

describe("runEndOfWeek — needs drift", () => {
  it("drifts every need toward its provisional weekly rate", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.state.player.needs).toEqual({ health: 49, energy: 47, happiness: 48, stress: 52, satiety: 46 });
  });

  it("clamps at 0 rather than going negative", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 0, energy: 1, happiness: 0, stress: 0, satiety: 2 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.state.player.needs.energy).toBe(0);
    expect(result.state.player.needs.satiety).toBe(0);
  });

  it("clamps at 100 rather than exceeding it", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 100, energy: 100, happiness: 100, stress: 99, satiety: 100 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.state.player.needs.stress).toBe(100);
  });

  it("emits one StateChange per touched need, sorted by need name", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.changes.map((c) => c.path)).toEqual([
      "player.needs.energy",
      "player.needs.happiness",
      "player.needs.health",
      "player.needs.satiety",
      "player.needs.stress",
    ]);
  });

  it("does not emit a StateChange for a need already clamped with no room left to drift", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 0, happiness: 50, stress: 100, satiety: 50 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    const paths = result.changes.map((c) => c.path);
    expect(paths).not.toContain("player.needs.energy");
    expect(paths).not.toContain("player.needs.stress");
  });
});

describe("runEndOfWeek — opportunity expiry", () => {
  it("removes an opportunity whose expiresAtWeek is at or before the current week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 }, {
      activeOpportunities: [makeOpportunity({ id: "expired", expiresAtWeek: 5 })],
    });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.state.activeOpportunities).toEqual([]);
  });

  it("keeps an opportunity whose expiresAtWeek is still in the future", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 }, {
      activeOpportunities: [makeOpportunity({ id: "open", expiresAtWeek: 10 })],
    });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(result.state.activeOpportunities.map((o) => o.id)).toEqual(["open"]);
  });
});

describe("runEndOfWeek — system ordering", () => {
  it("runs all fourteen systems in the documented order", () => {
    const { emit, systems } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    runEndOfWeek(state, emit, NO_GOALS, "goals_win");
    expect(systems).toEqual([
      "employment", "education", "finance_income", "inventory", "housing",
      "finance_reconcile", "needs", "relationships", "opportunities", "events",
      "headline", "goals", "failure", "achievements",
    ]);
  });
});

describe("runEndOfWeek — goals and failure", () => {
  const happinessGoal: GoalDefinition = {
    id: "goal-happy",
    labelKey: "goal.happy",
    descriptionKey: "goal.happy.description",
    category: "happiness",
    conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
  };

  function goalState(overrides: Partial<GoalState> = {}): GoalState {
    return {
      definitionId: "goal-happy",
      status: "active",
      satisfiedThisWeek: false,
      consecutiveWeeksSatisfied: 0,
      progressNotes: [],
      ...overrides,
    };
  }

  it("completes a goal with no requiredDurationWeeks the first week its condition is met", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 70, stress: 50, satiety: 50 }, {
      goals: [goalState()],
    });
    const result = runEndOfWeek(state, emit, [happinessGoal], "goals_win");
    expect(result.state.goals[0]).toMatchObject({
      status: "completed",
      satisfiedThisWeek: true,
      consecutiveWeeksSatisfied: 1,
      completedWeek: 5,
    });
  });

  it("leaves an unmet goal active with the streak reset", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 40, stress: 50, satiety: 50 }, {
      goals: [goalState({ consecutiveWeeksSatisfied: 3 })],
    });
    const result = runEndOfWeek(state, emit, [happinessGoal], "goals_win");
    expect(result.state.goals[0]).toMatchObject({ status: "active", satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0 });
  });

  it("requires requiredDurationWeeks consecutive satisfied weeks before completing", () => {
    const { emit } = recordingEmitter();
    const persistentGoal: GoalDefinition = { ...happinessGoal, requiredDurationWeeks: 3 };
    const state = baseState({ health: 50, energy: 50, happiness: 70, stress: 50, satiety: 50 }, {
      goals: [goalState({ consecutiveWeeksSatisfied: 1, firstSatisfiedWeek: 4 })],
    });
    const result = runEndOfWeek(state, emit, [persistentGoal], "goals_win");
    expect(result.state.goals[0]).toMatchObject({
      status: "active",
      satisfiedThisWeek: true,
      consecutiveWeeksSatisfied: 2,
      firstSatisfiedWeek: 4,
    });
  });

  it("fails a goal whose failureConditions trip while its own condition stays unmet", () => {
    const { emit } = recordingEmitter();
    const goalWithFailure: GoalDefinition = {
      ...happinessGoal,
      failureConditions: { field: "player.needs.happiness", operator: "less_than", value: 10 },
    };
    const state = baseState({ health: 50, energy: 50, happiness: 5, stress: 50, satiety: 50 }, {
      goals: [goalState()],
    });
    const result = runEndOfWeek(state, emit, [goalWithFailure], "goals_win");
    expect(result.state.goals[0]).toMatchObject({ status: "failed", failedWeek: 5 });
  });

  it("goals_win (default): a goal completes even when its failureConditions also trip the same week", () => {
    const { emit } = recordingEmitter();
    const goalWithFailure: GoalDefinition = {
      id: "goal-cash",
      labelKey: "goal.cash",
      descriptionKey: "goal.cash.description",
      category: "wealth",
      conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
      failureConditions: { field: "player.needs.stress", operator: "greater_or_equal", value: 50 },
    };
    const state = baseState({ health: 50, energy: 50, happiness: 70, stress: 90, satiety: 50 }, {
      goals: [goalState({ definitionId: "goal-cash" })],
    });
    const result = runEndOfWeek(state, emit, [goalWithFailure], "goals_win");
    expect(result.state.goals[0]?.status).toBe("completed");
  });

  it("failure_wins: a goal fails instead when both conditions trip the same week", () => {
    const { emit } = recordingEmitter();
    const goalWithFailure: GoalDefinition = {
      id: "goal-cash",
      labelKey: "goal.cash",
      descriptionKey: "goal.cash.description",
      category: "wealth",
      conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
      failureConditions: { field: "player.needs.stress", operator: "greater_or_equal", value: 50 },
    };
    const state = baseState({ health: 50, energy: 50, happiness: 70, stress: 90, satiety: 50 }, {
      goals: [goalState({ definitionId: "goal-cash" })],
    });
    const result = runEndOfWeek(state, emit, [goalWithFailure], "failure_wins");
    expect(result.state.goals[0]?.status).toBe("failed");
  });

  it("leaves a completed goal unchanged in later weeks", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 40, stress: 50, satiety: 50 }, {
      goals: [goalState({ status: "completed", completedWeek: 3 })],
    });
    const result = runEndOfWeek(state, emit, [happinessGoal], "goals_win");
    expect(result.state.goals[0]).toMatchObject({ status: "completed", completedWeek: 3 });
  });
});

describe("runEndOfWeek — W53 employment, finance_income, housing", () => {
  const job: JobDefinition = {
    id: "job-cashier",
    titleKey: "job.title", descriptionKey: "job.description",
    employerId: "employer-1", careerPathId: "career-retail", tier: "entry",
    schedule: { weeklyTimeCost: 6, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 30000 },
    requirements: [],
    performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    promotionPaths: [{
      toJobId: "job-manager", minimumWeeksInRole: 1, minimumPerformance: 55,
      requirements: [], contested: false, baseChance: 100,
    }],
    terminationRules: [], contested: false, tags: [],
  };
  const managerJob: JobDefinition = { ...job, id: "job-manager", compensation: { baseWeeklyPayCents: 50000 } };
  const jobs = [job, managerJob];

  const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  it("resolves a due pendingApplication into a hire, and removes the filled opening", () => {
    const application: JobApplication = { jobId: "job-cashier", submittedWeek: 4, resolvesWeek: 5, contested: false, outcome: "pending" };
    const opening: JobOpening = { jobId: "job-cashier", contested: false, postedWeek: 4 };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" },
      },
      world: { jobMarket: { openings: [opening] } } as unknown as SimulationKindState["world"],
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    expect(result.state.player.career.currentEmployment).toMatchObject({ jobId: "job-cashier", weeklyPayCents: 30000, performance: 50 });
    expect(result.state.player.career.pendingApplications).toEqual([]);
    expect((result.state.world as unknown as SimulationKindState["world"]).jobMarket.openings).toEqual([]);
  });

  it("leaves a pendingApplication whose resolvesWeek is still in the future", () => {
    const application: JobApplication = { jobId: "job-cashier", submittedWeek: 5, resolvesWeek: 6, contested: false, outcome: "pending" };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    expect(result.state.player.career.pendingApplications).toEqual([application]);
    expect(result.state.player.career.currentEmployment).toBeUndefined();
  });

  it("advances performance up when the player worked this week, and clears both work flags", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
        flags: { workedThisWeek: true },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    expect(result.state.player.career.currentEmployment?.performance).toBe(58);
    expect(result.state.player.flags["workedThisWeek"]).toBe(false);
  });

  it("promotes once minimumWeeksInRole/minimumPerformance/requirements are all satisfied", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 60, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 4,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 4, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    expect(result.state.player.career.currentEmployment).toMatchObject({ jobId: "job-manager", weeklyPayCents: 50000, weeksAtCurrentPay: 0 });
  });

  it("pays weekly wages into cashCents before housing charges rent, in the same pass", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
        housing: { weeklyCostCents: 25000 },
        // Rent (25000) exceeds starting cash (10000) — only payable once this week's own
        // wage (30000) has landed, proving finance_income runs before housing (§3).
        finances: { cashCents: 10000 },
      } as unknown as SimulationKindState["player"],
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    // 10000 + 30000 wage - 25000 rent = 15000.
    expect((result.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(15000);
  });

  it("levies no rent when weeklyCostCents is 0 — no phantom StateChange", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(baseState(NEEDS), emit, [], "goals_win", jobs);
    expect(result.changes.some((c) => c.reason === "rent_charged")).toBe(false);
  });
});

describe("runEndOfWeek — W55 housing and finance_reconcile", () => {
  const employment: Employment = {
    jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
    performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
  };
  const jobs: JobDefinition[] = [{
    id: "job-cashier",
    titleKey: "job.title", descriptionKey: "job.description",
    employerId: "employer-1", careerPathId: "career-retail", tier: "entry",
    schedule: { weeklyTimeCost: 6, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 30000 },
    requirements: [],
    performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    promotionPaths: [], terminationRules: [], contested: false, tags: [],
  }];
  const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  function employedState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
    return baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
        housing: { weeklyCostCents: 0, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
      } as unknown as SimulationKindState["player"],
      ...overrides,
    });
  }

  // W55.2 — proven by outcome, not by reading the list: running the two systems in the
  // documented order (finance_income, then housing) against wages that only just cover
  // rent succeeds; running them in the opposite order against the exact same starting
  // state — rent charged before the wage lands — genuinely overdraws.
  it("finance_income before housing pays rent in full; housing before finance_income overdraws", () => {
    const starting = employedState({
      player: {
        ...employedState().player,
        housing: { ...employedState().player.housing, weeklyCostCents: 30000 },
        finances: { ...employedState().player.finances, cashCents: 0 },
      } as unknown as SimulationKindState["player"],
    });

    const documentedOrder = housing(financeIncome(starting, jobs).state);
    expect(documentedOrder.missedCents).toBe(0);
    expect((documentedOrder.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(0);

    // Housing runs first, against the same starting cash (0): the charge goes through in
    // full regardless, and the balance is genuinely negative — an actual overdraw, not
    // merely "unpaid" — the moment rent is charged before the wage has landed.
    const swapped = housing(starting);
    expect(swapped.missedCents).toBe(30000);
    expect((swapped.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(-30000);

    // The wage landing afterward recovers the balance, but the overdraw already happened —
    // that transient negative balance is the swap's own proof, not its final state.
    const swappedThenIncome = financeIncome(swapped.state, jobs);
    expect((swappedThenIncome.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(0);
  });

  it("charges the full rent even past what's payable, reporting the shortfall as missedCents", () => {
    const result = housing(employedState({
      player: {
        ...employedState().player,
        housing: { ...employedState().player.housing, weeklyCostCents: 25000 },
        finances: { ...employedState().player.finances, cashCents: 10000 },
      } as unknown as SimulationKindState["player"],
    }));
    expect(result.missedCents).toBe(15000);
    expect((result.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(-15000);
  });

  it("scopes missedCents to this week's own charge, not a balance already negative from a prior week", () => {
    const result = housing(employedState({
      player: {
        ...employedState().player,
        housing: { ...employedState().player.housing, weeklyCostCents: 5000 },
        finances: { ...employedState().player.finances, cashCents: -20000 },
      } as unknown as SimulationKindState["player"],
    }));
    // Cash was already -20000 before this week's own charge; only this week's rent (5000)
    // counts as missed, not the compounded -25000 balance the charge leaves behind.
    expect(result.missedCents).toBe(5000);
    expect((result.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(-25000);
  });

  it("finance_reconcile is a no-op when missedCents is 0", () => {
    const state = employedState();
    const result = financeReconcile(state, 0);
    expect(result.changes).toEqual([]);
    expect(result.state).toBe(state);
  });

  it("a first missed rent advances evictionStage by exactly one step and levies a late fee", () => {
    const state = employedState();
    const result = financeReconcile(state, 15000);
    // 15000 rent shortfall + a 10% late fee (1500) = 16500.
    expect((result.state.player.housing as unknown as { overdueRentCents: number }).overdueRentCents).toBe(16500);
    expect((result.state.player.housing as unknown as { missedPayments: number }).missedPayments).toBe(1);
    expect((result.state.player.housing as unknown as { evictionStage: string }).evictionStage).toBe("warning");
  });

  it("advances one rung per already-missed week, never skipping ahead", () => {
    const state = employedState({
      player: {
        ...employedState().player,
        housing: {
          ...employedState().player.housing,
          overdueRentCents: 16500, missedPayments: 1, evictionStage: "warning",
        },
      } as unknown as SimulationKindState["player"],
    });
    const result = financeReconcile(state, 25000);
    expect((result.state.player.housing as unknown as { evictionStage: string }).evictionStage).toBe("penalty");
    expect((result.state.player.housing as unknown as { missedPayments: number }).missedPayments).toBe(2);
  });

  it("never advances evictionStage past 'evicted'", () => {
    const state = employedState({
      player: {
        ...employedState().player,
        housing: {
          ...employedState().player.housing,
          overdueRentCents: 100000, missedPayments: 5, evictionStage: "evicted",
        },
      } as unknown as SimulationKindState["player"],
    });
    const result = financeReconcile(state, 25000);
    expect((result.state.player.housing as unknown as { evictionStage: string }).evictionStage).toBe("evicted");
  });

  it("leaves housing arrears untouched on a week rent was fully paid", () => {
    const state = employedState({
      player: {
        ...employedState().player,
        housing: {
          ...employedState().player.housing,
          overdueRentCents: 16500, missedPayments: 1, evictionStage: "warning",
        },
      } as unknown as SimulationKindState["player"],
    });
    const result = financeReconcile(state, 0);
    expect((result.state.player.housing as unknown as { overdueRentCents: number }).overdueRentCents).toBe(16500);
    expect((result.state.player.housing as unknown as { evictionStage: string }).evictionStage).toBe("warning");
  });

  it("threads a missed week's arrears and eviction advance through runEndOfWeek's own changes", () => {
    const { emit } = recordingEmitter();
    const state = employedState({
      player: {
        ...employedState().player,
        housing: { ...employedState().player.housing, weeklyCostCents: 60000 },
        finances: { ...employedState().player.finances, cashCents: 0 },
      } as unknown as SimulationKindState["player"],
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    // Wage (30000) fully consumed by rent (60000): 30000 short, plus a 3000 late fee.
    expect((result.state.player.housing as unknown as { overdueRentCents: number }).overdueRentCents).toBe(33000);
    expect((result.state.player.housing as unknown as { evictionStage: string }).evictionStage).toBe("warning");
    expect(result.changes.some((c) => c.reason === "rent_overdue")).toBe(true);
    expect(result.changes.some((c) => c.reason === "eviction_advanced")).toBe(true);
  });

  // W55.4 — checked over the canonical string, not by inspecting individual fields: a late
  // fee (`Math.round`) is the one W55 computation that could plausibly introduce a
  // fractional cent, so this drives it with an odd, non-round missedCents value.
  it("keeps every money value an integer Cents in serialize() output, even after a late fee", () => {
    const state = employedState({
      player: {
        ...employedState().player,
        housing: { ...employedState().player.housing, weeklyCostCents: 60333 },
        finances: { ...employedState().player.finances, cashCents: 0 },
      } as unknown as SimulationKindState["player"],
    });
    const result = runEndOfWeek(state, recordingEmitter().emit, [], "goals_win", jobs);
    const canonical = canonicalStringify(result.state);
    expect(canonical).not.toMatch(/"(cashCents|overdueRentCents|weeklyCostCents|debtCents|savingsCents)":-?\d+\.\d/);
    expect(Number.isInteger(result.state.player.housing.overdueRentCents)).toBe(true);
  });
});

describe("runEndOfWeek — W53 review fixes", () => {
  const overtimeJob: JobDefinition = {
    id: "job-cashier",
    titleKey: "job.title", descriptionKey: "job.description",
    employerId: "employer-1", careerPathId: "career-retail", tier: "entry",
    schedule: { weeklyTimeCost: 6, flexibility: 50 },
    compensation: { baseWeeklyPayCents: 30000, overtimeRate: 5000 },
    requirements: [],
    performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
    // No promotionPaths — these overtime-pay tests aren't about promotion, and the default
    // baseState's currentWeek (5) against startedWeek (1) would otherwise trivially satisfy
    // any minimumWeeksInRole and promote the employee before finance_income even runs.
    promotionPaths: [], terminationRules: [], contested: false, tags: [],
  };
  const promotableJob: JobDefinition = {
    ...overtimeJob,
    promotionPaths: [{
      toJobId: "job-manager", minimumWeeksInRole: 1, minimumPerformance: 0,
      requirements: [], contested: false, baseChance: 100,
    }],
  };
  const managerJob: JobDefinition = { ...overtimeJob, id: "job-manager", compensation: { baseWeeklyPayCents: 50000 } };
  const jobs = [overtimeJob, managerJob];
  const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  it("pays overtime — work_overtime's flag is not cleared before finance_income reads it", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
        flags: { workedOvertimeThisWeek: true },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    // 30000 base + 30000 * 50% overtime = 45000.
    expect((result.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(45000);
    expect(result.state.player.flags["workedOvertimeThisWeek"]).toBe(false);
  });

  it("bases overtime pay on the employee's current (negotiated) pay, not the job's static base", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 40000, weeksAtCurrentPay: 1,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
        flags: { workedOvertimeThisWeek: true },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    // 40000 negotiated base + 40000 * 50% overtime = 60000, not 30000 + 30000*50%.
    expect((result.state.player.finances as unknown as { cashCents: number }).cashCents).toBe(60000);
  });

  it("a promotion resets startedWeek, so a later PromotionPath measures tenure from the new role", () => {
    const employment: Employment = {
      jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
      performance: 60, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 4,
    };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 4, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", [promotableJob, managerJob]);
    expect(result.state.player.career.currentEmployment).toMatchObject({ jobId: "job-manager", startedWeek: 5 });
  });

  it("does not advance performance or totalWeeksEmployed for a hire that lands this same week", () => {
    // weeklyDriftToward (20) differs from the hire's starting performance (50) — if
    // advanceEmployment ran on the same-week hire, performance would drift toward 20 and
    // totalWeeksEmployed would tick to 1 before the employee has worked a single week.
    const driftingJob: JobDefinition = { ...overtimeJob, performance: { factors: [], weeklyDriftToward: 20, minimumAcceptable: 0 } };
    const application: JobApplication = { jobId: "job-cashier", submittedWeek: 4, resolvesWeek: 5, contested: false, outcome: "pending" };
    const opening: JobOpening = { jobId: "job-cashier", contested: false, postedWeek: 4 };
    const { emit } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" },
      },
      world: { jobMarket: { openings: [opening] } } as unknown as SimulationKindState["world"],
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", [driftingJob, managerJob]);
    expect(result.state.player.career.totalWeeksEmployed).toBe(0);
    expect(result.state.player.career.currentEmployment?.performance).toBe(50);
  });

  it("applyForJob's pending duplicate is not a valid target for a second search-and-apply cycle to silently drop", () => {
    // Coverage for applyForJobResolver's own canExecute guard lives in resolvers.test.ts;
    // this asserts endOfWeek.ts's own side: a pendingApplications entry whose jobId no
    // longer resolves against `jobs` is dropped with an observable trace, not silently.
    const application: JobApplication = { jobId: "job-removed", submittedWeek: 4, resolvesWeek: 5, contested: false, outcome: "pending" };
    const { emit, events } = recordingEmitter();
    const state = baseState(NEEDS, {
      player: {
        ...baseState(NEEDS).player,
        career: { history: [], totalWeeksEmployed: 0, pendingApplications: [application], highestTierAchieved: "entry" },
      },
    });
    const result = runEndOfWeek(state, emit, [], "goals_win", jobs);
    expect(result.state.player.career.pendingApplications).toEqual([]);
    expect(result.state.player.career.currentEmployment).toBeUndefined();
    expect(events).toContainEqual({
      name: "kind.simulation.employment.application_lost",
      severity: "warn",
      data: { jobId: "job-removed" },
    });
  });
});

describe("runEndOfWeek — W54 education", () => {
  const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  const course: CourseDefinition = {
    id: "course-bookkeeping",
    nameKey: "course.name", descriptionKey: "course.description",
    providerId: "provider-1",
    tuitionCents: 5000, durationWeeks: 2, weeklyTimeCost: 4, difficulty: 0,
    requirements: [], rewards: [{ type: "skill", target: "bookkeeping", value: 50 }],
    awardsCredential: "certificate",
    failureRules: { minimumAttendanceRatio: 50, minimumStudyUnitsPerWeek: 1, maximumMissedSessions: 1, tuitionGraceWeeks: 0, progressRetainedOnFailure: 25 },
    tags: [],
  };
  const courses = [course];

  function enrolled(overrides: Partial<CourseEnrollment> = {}): CourseEnrollment {
    return {
      courseId: "course-bookkeeping", startedWeek: 4, weeksCompleted: 0,
      attendedUnits: 0, studyUnits: 0, missedSessions: 0,
      tuitionPaidCents: 5000, tuitionOutstandingCents: 0, retainedProgress: 0,
      status: "active",
      ...overrides,
    };
  }

  function withEnrollment(enrollment: CourseEnrollment, flags: Record<string, boolean> = {}): SimulationKindState {
    const base = baseState(NEEDS);
    return {
      ...base,
      player: {
        ...base.player,
        education: { enrollments: [enrollment], credentials: [], completedCourseIds: [], failedCourseIds: [] },
        flags,
      } as unknown as SimulationKindState["player"],
    };
  }

  it("advances weeksCompleted every week regardless of attendance", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(withEnrollment(enrolled()), emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments[0]).toMatchObject({ weeksCompleted: 1, attendedUnits: 0, missedSessions: 1 });
  });

  it("credits attendedUnits and clears the flag when attend_class set it this week", () => {
    const { emit } = recordingEmitter();
    const state = withEnrollment(enrolled(), { "attendedClass:course-bookkeeping": true });
    const result = runEndOfWeek(state, emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments[0]).toMatchObject({ weeksCompleted: 1, attendedUnits: 1, missedSessions: 0 });
    expect(result.state.player.flags["attendedClass:course-bookkeeping"]).toBe(false);
  });

  it("leaves an enrollment untouched if its course no longer resolves", () => {
    const { emit } = recordingEmitter();
    const missing = enrolled({ courseId: "course-gone" });
    const result = runEndOfWeek(withEnrollment(missing), emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments).toEqual([missing]);
  });

  it("completes on reaching durationWeeks with a good attendance/study record: awards the skill and a credential", () => {
    const { emit } = recordingEmitter();
    const state = withEnrollment(
      enrolled({ weeksCompleted: 1, attendedUnits: 1, studyUnits: 2 }),
      { "attendedClass:course-bookkeeping": true },
    );
    const result = runEndOfWeek(state, emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments[0]).toMatchObject({ status: "completed", weeksCompleted: 2 });
    expect(result.state.player.education.completedCourseIds).toEqual(["course-bookkeeping"]);
    expect(result.state.player.skills["bookkeeping"]).toBe(50);
    expect(result.state.player.education.credentials[0]).toMatchObject({ courseId: "course-bookkeeping", level: "certificate" });
  });

  it("never lowers an already-higher skill on completion", () => {
    const { emit } = recordingEmitter();
    const base = withEnrollment(
      enrolled({ weeksCompleted: 1, attendedUnits: 1, studyUnits: 2 }),
      { "attendedClass:course-bookkeeping": true },
    );
    const state = { ...base, player: { ...base.player, skills: { bookkeeping: 80 } } };
    const result = runEndOfWeek(state, emit, [], "goals_win", [], courses);
    expect(result.state.player.skills["bookkeeping"]).toBe(80);
  });

  it("fails on reaching durationWeeks with too many missed sessions: sets retainedProgress, no skill awarded", () => {
    const { emit } = recordingEmitter();
    const state = withEnrollment(enrolled({ weeksCompleted: 1, attendedUnits: 0, missedSessions: 1, studyUnits: 1 }));
    const result = runEndOfWeek(state, emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments[0]).toMatchObject({ status: "failed", retainedProgress: 25 });
    expect(result.state.player.education.failedCourseIds).toEqual(["course-bookkeeping"]);
    expect(result.state.player.skills["bookkeeping"]).toBeUndefined();
  });

  it("fails on insufficient total studyUnits even with perfect attendance", () => {
    const { emit } = recordingEmitter();
    const state = withEnrollment(
      enrolled({ weeksCompleted: 1, attendedUnits: 1, studyUnits: 0 }),
      { "attendedClass:course-bookkeeping": true },
    );
    const result = runEndOfWeek(state, emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments[0]?.status).toBe("failed");
  });

  it("a completed enrollment stays in the list and is left alone on later weeks", () => {
    const { emit } = recordingEmitter();
    const completed = enrolled({ weeksCompleted: 2, attendedUnits: 2, status: "completed" });
    const result = runEndOfWeek(withEnrollment(completed), emit, [], "goals_win", [], courses);
    expect(result.state.player.education.enrollments).toEqual([completed]);
  });
});

describe("runEndOfWeek — W56.3 inventory", () => {
  const INVENTORY_NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

  const bicycle: ItemDefinition = {
    id: "item-bicycle", nameKey: "item.name", descriptionKey: "item.description", category: "transport",
    purchasePriceCents: 4000, baseResaleValueCents: 2000,
    effects: [{ target: "player.needs.energy", operation: "add", value: 5, sourceId: "item-bicycle" }],
    stacking: "refresh",
    maintenanceRules: [{ intervalWeeks: 1, costCents: 500, timeCost: 1, conditionLossIfSkipped: 40, breakageChanceAtZeroCondition: 0 }],
    requirements: [], tags: [],
  };
  /** No `maintenanceRules` — §7.5 gives condition no other decay source, so this never wears. */
  const heirloom: ItemDefinition = {
    ...bicycle, id: "item-heirloom", effects: [], maintenanceRules: [],
  };
  /** Effects, but nothing to maintain — so its `StatusEffect` persists week over week. */
  const durable: ItemDefinition = { ...bicycle, id: "item-durable", maintenanceRules: [] };
  const items: readonly ItemDefinition[] = [bicycle, heirloom, durable];

  function owning(item: Partial<InventoryItem>, overrides: Partial<SimulationKindState> = {}): SimulationKindState {
    const base = baseState(INVENTORY_NEEDS, overrides);
    const owned: InventoryItem = {
      instanceId: "inv-1", definitionId: "item-bicycle", quantity: 1, acquiredWeek: 1,
      purchasePriceCents: 4000, condition: 100, weeksSinceMaintenance: 0, broken: false,
      ...item,
    };
    return { ...base, player: { ...base.player, inventory: [owned] } };
  }

  it("ages every item and takes conditionLossIfSkipped once the interval has elapsed", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(owning({}), emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.player.inventory[0]).toMatchObject({ condition: 60, weeksSinceMaintenance: 1 });
  });

  it("keeps charging every week the interval stays elapsed, clamped at zero", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(owning({ condition: 20, weeksSinceMaintenance: 3 }), emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.player.inventory[0]).toMatchObject({ condition: 0, weeksSinceMaintenance: 4 });
  });

  // Review fix — decay and `maintain_item` must select the same rule, or a later rule adds
  // condition loss that no service can ever prevent and one service clears all of them.
  it("charges only the governing (first-listed) maintenance rule, matching maintain_item", () => {
    const { emit } = recordingEmitter();
    const twoRules: ItemDefinition = {
      ...bicycle, id: "item-two-rules",
      maintenanceRules: [
        { intervalWeeks: 1, costCents: 500, timeCost: 1, conditionLossIfSkipped: 40, breakageChanceAtZeroCondition: 0 },
        { intervalWeeks: 1, costCents: 900, timeCost: 2, conditionLossIfSkipped: 25, breakageChanceAtZeroCondition: 0 },
      ],
    };
    const state = owning({ definitionId: "item-two-rules" });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win", [], [], [...items, twoRules]);
    expect(result.state.player.inventory[0]).toMatchObject({ condition: 60 });
  });

  it("never decays an item whose definition declares no maintenance rules", () => {
    const { emit } = recordingEmitter();
    const state = owning({ definitionId: "item-heirloom", condition: 70 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.player.inventory[0]).toMatchObject({ condition: 70, weeksSinceMaintenance: 1 });
  });

  it("emits one visible StateChange per item whose condition moved", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(owning({}), emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.changes).toContainEqual({
      path: "player.inventory.inv-1.condition", op: "set", value: 60, previous: 100,
      reason: "item_condition_decayed", visible: true,
    });
  });

  it("attaches the item's ItemDefinition.effects as a sourceKind: item StatusEffect", () => {
    const { emit } = recordingEmitter();
    const result = runEndOfWeek(owning({}), emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.activeEffects).toEqual([{
      id: "item:inv-1", sourceId: "inv-1", sourceKind: "item",
      modifiers: bicycle.effects, appliedWeek: 5, stacking: "refresh",
      descriptionKey: "item.name", visible: true,
    }]);
  });

  it("stops contributing modifiers at zero condition, and keeps the item in inventory", () => {
    const { emit } = recordingEmitter();
    const state = owning({ condition: 30, weeksSinceMaintenance: 2 });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.activeEffects).toEqual([]);
    expect(result.state.player.inventory).toHaveLength(1);
    expect(result.state.player.inventory[0]).toMatchObject({ instanceId: "inv-1", condition: 0 });
  });

  it("resumes contributing once the item is repaired back above zero", () => {
    const { emit } = recordingEmitter();
    const worn = owning({ condition: 0, weeksSinceMaintenance: 2 });
    const lapsed = runEndOfWeek(worn, emit, NO_GOALS, "goals_win", [], [], items);
    expect(lapsed.state.activeEffects).toEqual([]);

    const repaired: SimulationKindState = {
      ...lapsed.state,
      player: {
        ...lapsed.state.player,
        inventory: [{ ...lapsed.state.player.inventory[0]!, condition: 100, weeksSinceMaintenance: 0 }],
      },
    };
    const restored = runEndOfWeek(repaired, emit, NO_GOALS, "goals_win", [], [], items);
    expect(restored.state.activeEffects.map((e) => e.id)).toEqual(["item:inv-1"]);
  });

  it("preserves appliedWeek across weeks rather than re-dating the effect", () => {
    const { emit } = recordingEmitter();
    const first = runEndOfWeek(owning({ definitionId: "item-durable" }), emit, NO_GOALS, "goals_win", [], [], items);
    const second = runEndOfWeek(
      { ...first.state, calendar: { ...first.state.calendar, currentWeek: 9 } },
      emit, NO_GOALS, "goals_win", [], [], items,
    );
    expect(second.state.activeEffects[0]?.appliedWeek).toBe(5);
  });

  it("carries every effect from another source through untouched", () => {
    const { emit } = recordingEmitter();
    const systemEffect: StatusEffect = {
      id: "sys-1", sourceId: "campaign", sourceKind: "system",
      modifiers: [], appliedWeek: 1, stacking: "refresh", descriptionKey: "e.description", visible: true,
    };
    const state = owning({}, { activeEffects: [systemEffect] });
    const result = runEndOfWeek(state, emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.activeEffects.map((e) => e.id)).toEqual(["sys-1", "item:inv-1"]);
  });

  it("drops the effect of an item no longer in inventory", () => {
    const { emit } = recordingEmitter();
    const orphan: StatusEffect = {
      id: "item:inv-gone", sourceId: "inv-gone", sourceKind: "item",
      modifiers: [], appliedWeek: 1, stacking: "refresh", descriptionKey: "item.name", visible: true,
    };
    const base = baseState(INVENTORY_NEEDS, { activeEffects: [orphan] });
    const result = runEndOfWeek(base, emit, NO_GOALS, "goals_win", [], [], items);
    expect(result.state.activeEffects).toEqual([]);
  });
});
