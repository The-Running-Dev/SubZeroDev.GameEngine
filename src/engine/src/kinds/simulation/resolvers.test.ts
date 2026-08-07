import { describe, it, expect } from "vitest";
import type { KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { JobDefinition, LocationDefinition } from "./content.js";
import type { Employment } from "./actor.js";
import type { JobOpening, SimulationKindState } from "./state.js";
import type { GameAction } from "./plan.js";
import {
  applyForJobResolver,
  negotiateJobTermsResolver,
  searchForWorkResolver,
  workOvertimeResolver,
  workResolver,
} from "./resolvers.js";

const calendar = { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 };

const job: JobDefinition = {
  id: "job-cashier",
  titleKey: "job.title", descriptionKey: "job.description",
  employerId: "employer-1", careerPathId: "career-retail", tier: "entry",
  schedule: { weeklyTimeCost: 6, flexibility: 50 },
  compensation: { baseWeeklyPayCents: 30000, overtimeRate: 5000 },
  requirements: [],
  performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
  promotionPaths: [], terminationRules: [],
  contested: false, tags: [],
};

const gatedJob: JobDefinition = {
  ...job,
  id: "job-gated",
  requirements: [{ type: "attribute", condition: { field: "player.attributes.charisma", operator: "greater_or_equal", value: 200 }, failureCode: "requirement_unmet", messageKey: "core.reason.requirement_unmet" }],
};

const workLocation: LocationDefinition = {
  id: "loc-work", nameKey: "loc.name", descriptionKey: "loc.description",
  connections: [], travelTimeUnits: 0,
  actionTypes: ["search_for_work", "apply_for_job", "negotiate_job_terms", "work", "work_overtime"],
};

const bareLocation: LocationDefinition = {
  id: "loc-bare", nameKey: "loc.name", descriptionKey: "loc.description",
  connections: [], travelTimeUnits: 0, actionTypes: [],
};

function player(overrides: Partial<SimulationKindState["player"]> = {}): SimulationKindState["player"] {
  return {
    identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
    currentLocationId: "loc-work",
    finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
    needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
    attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: {
      definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
      weeklyCostCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
      missedPayments: 0, evictionStage: "none",
    },
    inventory: [], relationships: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
    ...overrides,
  };
}

function state(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { ...calendar },
    player: player(),
    economy: { inflation: 200, unemploymentRate: 500, interestRate: 300, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: { npcs: [], locations: [], jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0, headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {} },
    activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
    goals: [], plan: null,
    ...overrides,
  };
}

const simulationCampaign: SimulationCampaign = {
  descriptionKey: "sim.description",
  jobs: [job, gatedJob], courses: [], housing: [], items: [], events: [], npcs: [], goals: [],
  scenarios: [], difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
  locations: [workLocation, bareLocation], backgrounds: [], traits: [], skills: [],
  scenarioId: "scenario-1", goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "sim.scene.status",
  actionLabelKeys: { planAdd: "a", planRemove: "b", planClear: "c", endWeek: "d" },
};

const campaign: Campaign = { id: "test-sim", kindId: "simulation", version: "1.0.0", titleKey: "sim.title", content: simulationCampaign };

function ctx(overrides: Partial<KindContext> = {}): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() { return this.rng; },
    seq: 1,
    emit: { emit: () => undefined },
    ...overrides,
  };
}

function action(type: GameAction["type"], targetId?: string): GameAction {
  return { id: "action-1", type, actorId: "player", ...(targetId ? { targetId } : {}), parameters: {} };
}

describe("W53 — search_for_work", () => {
  it("rejects wrong_location off the job market", () => {
    const s = state({ player: player({ currentLocationId: "loc-bare" }) });
    const result = searchForWorkResolver.canExecute(s, action("search_for_work"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("rejects insufficient_time when the plan already spent the week's budget", () => {
    const s = state({ calendar: { ...calendar, spentTimeUnits: 14 } });
    const result = searchForWorkResolver.canExecute(s, action("search_for_work"), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_time");
  });

  it("posts every campaign job not already listed, and spends time", () => {
    const s = state();
    const outcome = searchForWorkResolver.calculate(s, action("search_for_work"), ctx());
    const next = searchForWorkResolver.apply(s, outcome);
    expect(next.world.jobMarket.openings.map((o) => o.jobId).sort()).toEqual(["job-cashier", "job-gated"]);
    expect(next.calendar.spentTimeUnits).toBe(2);
  });

  it("does not re-list a job already posted", () => {
    const opening: JobOpening = { jobId: "job-cashier", contested: false, postedWeek: 1 };
    const s = state({ world: { ...state().world, jobMarket: { openings: [opening] } } });
    const outcome = searchForWorkResolver.calculate(s, action("search_for_work"), ctx());
    const next = searchForWorkResolver.apply(s, outcome);
    expect(next.world.jobMarket.openings.map((o) => o.jobId).sort()).toEqual(["job-cashier", "job-gated"]);
  });
});

describe("W53 — apply_for_job", () => {
  const posted = (jobId: string): SimulationKindState =>
    state({ world: { ...state().world, jobMarket: { openings: [{ jobId, contested: false, postedWeek: 1 }] } } });

  it("rejects requirement_unmet when the job isn't listed on the market yet", () => {
    const result = applyForJobResolver.canExecute(state(), action("apply_for_job", "job-cashier"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("rejects a job's own failureCode/messageKey when its Requirement isn't met", () => {
    const s = posted("job-gated");
    const result = applyForJobResolver.canExecute(s, action("apply_for_job", "job-gated"), ctx());
    expect(result.errors[0]).toEqual({ code: "requirement_unmet", messageKey: "core.reason.requirement_unmet" });
  });

  it("rejects wrong_location off the job market", () => {
    const s = { ...posted("job-cashier"), player: player({ currentLocationId: "loc-bare" }) };
    const result = applyForJobResolver.canExecute(s, action("apply_for_job", "job-cashier"), ctx());
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("files a JobApplication resolving one week later, and spends time", () => {
    const s = posted("job-cashier");
    const outcome = applyForJobResolver.calculate(s, action("apply_for_job", "job-cashier"), ctx());
    const next = applyForJobResolver.apply(s, outcome);
    expect(next.player.career.pendingApplications).toEqual([
      { jobId: "job-cashier", submittedWeek: 3, resolvesWeek: 4, contested: false, outcome: "pending" },
    ]);
    expect(next.calendar.spentTimeUnits).toBe(1);
  });
});

describe("W53 — work / work_overtime", () => {
  const employment: Employment = {
    jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
    performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
  };
  const employed = (): SimulationKindState => state({ player: player({ career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment } }) });

  it("work rejects requirement_unmet with no currentEmployment", () => {
    const result = workResolver.canExecute(state(), action("work"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("work sets workedThisWeek and spends the job's own weeklyTimeCost", () => {
    const s = employed();
    const outcome = workResolver.calculate(s, action("work"), ctx());
    const next = workResolver.apply(s, outcome);
    expect(next.player.flags["workedThisWeek"]).toBe(true);
    expect(next.calendar.spentTimeUnits).toBe(6);
  });

  it("work_overtime sets workedOvertimeThisWeek and spends its own fixed cost", () => {
    const s = employed();
    const outcome = workOvertimeResolver.calculate(s, action("work_overtime"), ctx());
    const next = workOvertimeResolver.apply(s, outcome);
    expect(next.player.flags["workedOvertimeThisWeek"]).toBe(true);
    expect(next.calendar.spentTimeUnits).toBe(4);
  });
});

describe("W53 — negotiate_job_terms (§13 determinism)", () => {
  const employment: Employment = {
    jobId: "job-cashier", employerId: "employer-1", startedWeek: 1,
    performance: 50, attendanceRatio: 100, warnings: 0, weeklyPayCents: 30000, weeksAtCurrentPay: 1,
  };
  const employed = (): SimulationKindState => state({ player: player({ career: { history: [], totalWeeksEmployed: 1, pendingApplications: [], highestTierAchieved: "entry", currentEmployment: employment }, attributes: { intelligence: 50, discipline: 50, charisma: 60, creativity: 50, resilience: 50, wisdom: 50, luck: 50 } }) });

  it("draws from ctx.derive, not ctx.rng directly — a roll below charisma succeeds and raises pay", () => {
    const s = employed();
    const rollingCtx = ctx({ derive: () => ({ nextInt: () => 0, nextPercent: () => 10, pick: (i) => i[0]!, weightedPick: (i) => i[0]!.item }) });
    const outcome = negotiateJobTermsResolver.calculate(s, action("negotiate_job_terms"), rollingCtx);
    expect(outcome.success).toBe(true);
    const next = negotiateJobTermsResolver.apply(s, outcome);
    expect(next.player.career.currentEmployment?.weeklyPayCents).toBe(31500); // 30000 + 5%
  });

  it("a roll at or above charisma fails and leaves pay unchanged", () => {
    const s = employed();
    const rollingCtx = ctx({ derive: () => ({ nextInt: () => 0, nextPercent: () => 99, pick: (i) => i[0]!, weightedPick: (i) => i[0]!.item }) });
    const outcome = negotiateJobTermsResolver.calculate(s, action("negotiate_job_terms"), rollingCtx);
    expect(outcome.success).toBe(false);
    const next = negotiateJobTermsResolver.apply(s, outcome);
    expect(next.player.career.currentEmployment?.weeklyPayCents).toBe(30000);
  });

  it("adding a draw to one resolver's own stream never shifts another's — each keyed by its own action id", () => {
    const s = employed();
    const seen: string[] = [];
    const recordingCtx = ctx({
      derive: (streamId) => {
        seen.push(JSON.stringify(streamId));
        return { nextInt: () => 0, nextPercent: () => 10, pick: (i) => i[0]!, weightedPick: (i) => i[0]!.item };
      },
    });
    negotiateJobTermsResolver.calculate(s, action("negotiate_job_terms"), recordingCtx);
    negotiateJobTermsResolver.calculate(s, { ...action("negotiate_job_terms"), id: "action-2" }, recordingCtx);
    expect(seen[0]).not.toEqual(seen[1]);
  });
});
