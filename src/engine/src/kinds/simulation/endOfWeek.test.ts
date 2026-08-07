import { describe, it, expect } from "vitest";
import { runEndOfWeek } from "./endOfWeek.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { Employment, JobApplication, NeedState } from "./actor.js";
import type { GoalDefinition, JobDefinition } from "./content.js";
import type { GoalState, JobOpening, Opportunity, SimulationKindState } from "./state.js";

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
      flags: {},
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
