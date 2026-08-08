import { describe, it, expect } from "vitest";
import type { KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { CourseDefinition, HousingDefinition, ItemDefinition, JobDefinition, LocationDefinition, NPCDefinition } from "./content.js";
import type { CourseEnrollment, Employment, InventoryItem, RelationshipState } from "./actor.js";
import type { JobOpening, SimulationKindState } from "./state.js";
import type { GameAction } from "./plan.js";
import { runEndOfWeek } from "./endOfWeek.js";
import {
  applyForJobResolver,
  attendClassResolver,
  borrowMoneyResolver,
  depositSavingsResolver,
  enrollCourseResolver,
  exerciseResolver,
  investResolver,
  maintainItemResolver,
  moveHousingResolver,
  negotiateJobTermsResolver,
  payBillsResolver,
  repairItemResolver,
  repayDebtResolver,
  searchForWorkResolver,
  sellItemResolver,
  shopResolver,
  socializeResolver,
  studyResolver,
  travelResolver,
  withdrawCourseResolver,
  workOvertimeResolver,
  workResolver,
  RESOLVER_TABLE,
  stubResolver,
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

const course: CourseDefinition = {
  id: "course-bookkeeping",
  nameKey: "course.name", descriptionKey: "course.description",
  providerId: "provider-1",
  tuitionCents: 5000, durationWeeks: 2, weeklyTimeCost: 4, difficulty: 0,
  requirements: [], rewards: [{ type: "skill", target: "bookkeeping", value: 50 }],
  failureRules: { minimumAttendanceRatio: 50, minimumStudyUnitsPerWeek: 1, maximumMissedSessions: 1, tuitionGraceWeeks: 0, progressRetainedOnFailure: 25 },
  tags: [],
};

const accountantJob: JobDefinition = {
  ...job,
  id: "job-accountant",
  requirements: [{ type: "skill", condition: { field: "player.skills.bookkeeping", operator: "greater_or_equal", value: 50 }, failureCode: "requirement_unmet", messageKey: "core.reason.requirement_unmet" }],
};

const gatedCourse: CourseDefinition = {
  ...course,
  id: "course-gated",
  requirements: [{ type: "attribute", condition: { field: "player.attributes.intelligence", operator: "greater_or_equal", value: 200 }, failureCode: "requirement_unmet", messageKey: "core.reason.requirement_unmet" }],
};

const workLocation: LocationDefinition = {
  id: "loc-work", nameKey: "loc.name", descriptionKey: "loc.description",
  connections: ["loc-bare"], travelTimeUnits: 0,
  actionTypes: [
    "search_for_work", "apply_for_job", "negotiate_job_terms", "work", "work_overtime",
    "enroll_course", "attend_class", "study", "withdraw_course",
    "move_housing", "pay_bills", "borrow_money", "repay_debt", "deposit_savings", "invest",
    "shop", "maintain_item", "repair_item", "sell_item", "travel", "socialize", "exercise",
  ],
};

/** Reachable from `loc-work` only via `loc-bare` — the two-hop target that proves `travel`
 *  is single-hop adjacency, not pathfinding (§7.9). */
const farLocation: LocationDefinition = {
  id: "loc-far", nameKey: "loc.name", descriptionKey: "loc.description",
  connections: ["loc-bare"], travelTimeUnits: 3, actionTypes: ["travel"],
};

const bicycle: ItemDefinition = {
  id: "item-bicycle", nameKey: "item.name", descriptionKey: "item.description", category: "transport",
  purchasePriceCents: 4000, baseResaleValueCents: 2000,
  effects: [{ target: "player.needs.energy", operation: "add", value: 5, sourceId: "item-bicycle" }],
  stacking: "refresh", durability: 100,
  maintenanceRules: [{ intervalWeeks: 2, costCents: 500, timeCost: 1, conditionLossIfSkipped: 30, breakageChanceAtZeroCondition: 0 }],
  requirements: [], tags: [],
};

/** No effects and no `maintenanceRules` — the item `maintain_item` has nothing to service
 *  and `inventory` (`endOfWeek.ts`) never decays. */
const trinket: ItemDefinition = {
  id: "item-trinket", nameKey: "item.name", descriptionKey: "item.description", category: "misc",
  purchasePriceCents: 200, baseResaleValueCents: 100,
  effects: [], stacking: "refresh", requirements: [], tags: [],
};

const expensiveItem: ItemDefinition = { ...trinket, id: "item-expensive", purchasePriceCents: 999999 };

const neighbour: NPCDefinition = {
  id: "npc-neighbour", nameKey: "npc.name", descriptionKey: "npc.description",
  defaultRole: "neighbour",
  initialRelationship: { affinity: 10, trust: 10, respect: 10, resentment: 0 },
  availability: [{ locationId: "loc-work" }], tags: [],
};

const absentNpc: NPCDefinition = { ...neighbour, id: "npc-absent", availability: [{ locationId: "loc-far" }] };

function inventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    instanceId: "inv-1", definitionId: "item-bicycle", quantity: 1, acquiredWeek: 1,
    purchasePriceCents: 4000, condition: 100, weeksSinceMaintenance: 0, broken: false,
    ...overrides,
  };
}

const housingAffordable: HousingDefinition = {
  id: "housing-affordable", nameKey: "h.name", descriptionKey: "h.description",
  upfrontCostCents: 500, weeklyCostCents: 2000, depositCents: 500,
  capacity: 1, comfort: 50, safety: 50, prestige: 10, storage: 20,
  commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0,
  maintenanceRisk: 10, requirements: [], tags: [],
};

const housingExpensive: HousingDefinition = {
  ...housingAffordable, id: "housing-expensive", upfrontCostCents: 50000, depositCents: 0,
};

const housingGated: HousingDefinition = {
  ...housingAffordable, id: "housing-gated",
  requirements: [{ type: "attribute", condition: { field: "player.attributes.charisma", operator: "greater_or_equal", value: 200 }, failureCode: "requirement_unmet", messageKey: "core.reason.requirement_unmet" }],
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
  jobs: [job, gatedJob, accountantJob], courses: [course, gatedCourse],
  housing: [housingAffordable, housingExpensive, housingGated],
  items: [bicycle, trinket, expensiveItem], events: [], npcs: [neighbour, absentNpc], goals: [],
  scenarios: [], difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
  locations: [workLocation, bareLocation, farLocation], backgrounds: [], traits: [], skills: [],
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

function actionWithAmount(type: GameAction["type"], amountCents: number): GameAction {
  return { id: "action-1", type, actorId: "player", parameters: { amountCents } };
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
    expect(next.world.jobMarket.openings.map((o) => o.jobId).sort()).toEqual(["job-accountant", "job-cashier", "job-gated"]);
    expect(next.calendar.spentTimeUnits).toBe(2);
  });

  it("does not re-list a job already posted", () => {
    const opening: JobOpening = { jobId: "job-cashier", contested: false, postedWeek: 1 };
    const s = state({ world: { ...state().world, jobMarket: { openings: [opening] } } });
    const outcome = searchForWorkResolver.calculate(s, action("search_for_work"), ctx());
    const next = searchForWorkResolver.apply(s, outcome);
    expect(next.world.jobMarket.openings.map((o) => o.jobId).sort()).toEqual(["job-accountant", "job-cashier", "job-gated"]);
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

  it("rejects requirement_unmet for a second application to a job already pending", () => {
    const s = {
      ...posted("job-cashier"),
      player: player({ career: { history: [], totalWeeksEmployed: 0, highestTierAchieved: "entry", pendingApplications: [
        { jobId: "job-cashier", submittedWeek: 2, resolvesWeek: 3, contested: false, outcome: "pending" },
      ] } }),
    };
    const result = applyForJobResolver.canExecute(s, action("apply_for_job", "job-cashier"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("requirement_unmet");
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

describe("W54 — enroll_course", () => {
  it("rejects unknown_action for a courseId with no matching CourseDefinition", () => {
    const result = enrollCourseResolver.canExecute(state(), action("enroll_course", "course-nonexistent"), ctx());
    expect(result.errors[0]?.code).toBe("unknown_action");
  });

  it("rejects wrong_location off campus", () => {
    const s = state({ player: player({ currentLocationId: "loc-bare" }) });
    const result = enrollCourseResolver.canExecute(s, action("enroll_course", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("rejects the course's own failureCode/messageKey when its Requirement isn't met", () => {
    const result = enrollCourseResolver.canExecute(state(), action("enroll_course", "course-gated"), ctx());
    expect(result.errors[0]).toEqual({ code: "requirement_unmet", messageKey: "core.reason.requirement_unmet" });
  });

  it("rejects insufficient_funds when cash is short of tuitionCents", () => {
    const s = state({ player: player({ finances: { ...player().finances, cashCents: 100 } }) });
    const result = enrollCourseResolver.canExecute(s, action("enroll_course", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("rejects requirement_unmet for a second enrollment while the first is still active", () => {
    const enrollment: CourseEnrollment = {
      courseId: "course-bookkeeping", startedWeek: 1, weeksCompleted: 0,
      attendedUnits: 0, studyUnits: 0, missedSessions: 0,
      tuitionPaidCents: 5000, tuitionOutstandingCents: 0, retainedProgress: 0, status: "active",
    };
    const s = state({ player: player({ education: { enrollments: [enrollment], credentials: [], completedCourseIds: [], failedCourseIds: [] } }) });
    const result = enrollCourseResolver.canExecute(s, action("enroll_course", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
    expect(s.player.education.enrollments).toEqual([enrollment]);
  });

  it("charges tuition and adds an active CourseEnrollment", () => {
    const s = state();
    const outcome = enrollCourseResolver.calculate(s, action("enroll_course", "course-bookkeeping"), ctx());
    const next = enrollCourseResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(5000);
    expect(next.player.education.enrollments).toEqual([{
      courseId: "course-bookkeeping", startedWeek: 3, weeksCompleted: 0,
      attendedUnits: 0, studyUnits: 0, missedSessions: 0,
      tuitionPaidCents: 5000, tuitionOutstandingCents: 0, retainedProgress: 0, status: "active",
    }]);
  });
});

describe("W54 — attend_class / study / withdraw_course", () => {
  const enrollment: CourseEnrollment = {
    courseId: "course-bookkeeping", startedWeek: 1, weeksCompleted: 0,
    attendedUnits: 0, studyUnits: 0, missedSessions: 0,
    tuitionPaidCents: 5000, tuitionOutstandingCents: 0, retainedProgress: 0, status: "active",
  };
  const enrolled = (): SimulationKindState =>
    state({ player: player({ education: { enrollments: [enrollment], credentials: [], completedCourseIds: [], failedCourseIds: [] } }) });

  it("attend_class rejects requirement_unmet with no active enrollment in that course", () => {
    const result = attendClassResolver.canExecute(state(), action("attend_class", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("attend_class sets the per-course attendance flag and spends no time", () => {
    const s = enrolled();
    const outcome = attendClassResolver.calculate(s, action("attend_class", "course-bookkeeping"), ctx());
    const next = attendClassResolver.apply(s, outcome);
    expect(next.player.flags["attendedClass:course-bookkeeping"]).toBe(true);
    expect(next.calendar.spentTimeUnits).toBe(0);
  });

  it("study rejects requirement_unmet with no active enrollment in that course", () => {
    const result = studyResolver.canExecute(state(), action("study", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("study rejects insufficient_time when the plan already spent the week's budget", () => {
    const s = { ...enrolled(), calendar: { ...calendar, spentTimeUnits: 14 } };
    const result = studyResolver.canExecute(s, action("study", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_time");
  });

  it("study spends time and increments the enrollment's own studyUnits", () => {
    const s = enrolled();
    const outcome = studyResolver.calculate(s, action("study", "course-bookkeeping"), ctx());
    const next = studyResolver.apply(s, outcome);
    expect(next.calendar.spentTimeUnits).toBe(2);
    expect(next.player.education.enrollments[0]?.studyUnits).toBe(1);
  });

  it("withdraw_course rejects requirement_unmet with no active enrollment in that course", () => {
    const result = withdrawCourseResolver.canExecute(state(), action("withdraw_course", "course-bookkeeping"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("withdraw_course removes the enrollment outright — no refund, nothing retained", () => {
    const s = enrolled();
    const outcome = withdrawCourseResolver.calculate(s, action("withdraw_course", "course-bookkeeping"), ctx());
    const next = withdrawCourseResolver.apply(s, outcome);
    expect(next.player.education.enrollments).toEqual([]);
    expect(next.player.finances.cashCents).toBe(s.player.finances.cashCents);
  });
});

describe("W54.4 — a skill awarded by course completion satisfies a JobDefinition requirement", () => {
  it("apply_for_job is rejected before the course, accepted after it completes", () => {
    const enrollment: CourseEnrollment = {
      // One week from completing course-bookkeeping (durationWeeks 2), with a study record
      // that will pass its own failureRules once this week's attendance is counted.
      courseId: "course-bookkeeping", startedWeek: 2, weeksCompleted: 1,
      attendedUnits: 1, studyUnits: 2, missedSessions: 0,
      tuitionPaidCents: 5000, tuitionOutstandingCents: 0, retainedProgress: 0, status: "active",
    };
    const opening: JobOpening = { jobId: "job-accountant", contested: false, postedWeek: 1 };
    const before = state({
      player: player({
        education: { enrollments: [enrollment], credentials: [], completedCourseIds: [], failedCourseIds: [] },
        flags: { "attendedClass:course-bookkeeping": true },
        // A campaign-declared skill starts at 0, not absent — undefined would make the
        // job's own `greater_or_equal` condition throw rather than evaluate to false.
        skills: { bookkeeping: 0 },
      }),
      world: { ...state().world, jobMarket: { openings: [opening] } },
    });

    const beforeResult = applyForJobResolver.canExecute(before, action("apply_for_job", "job-accountant"), ctx());
    expect(beforeResult.errors[0]).toEqual({ code: "requirement_unmet", messageKey: "core.reason.requirement_unmet" });

    const { state: afterEndOfWeek } = runEndOfWeek(before, ctx().emit, [], "goals_win", [job, gatedJob, accountantJob], [course, gatedCourse]);
    expect(afterEndOfWeek.player.skills["bookkeeping"]).toBe(50);

    const afterResult = applyForJobResolver.canExecute(afterEndOfWeek, action("apply_for_job", "job-accountant"), ctx());
    expect(afterResult.valid).toBe(true);
  });
});

describe("W55 — move_housing", () => {
  it("rejects unknown_action for a housingId with no matching HousingDefinition", () => {
    const result = moveHousingResolver.canExecute(state(), action("move_housing", "housing-nonexistent"), ctx());
    expect(result.errors[0]?.code).toBe("unknown_action");
  });

  it("rejects wrong_location where move_housing isn't in the location's own actionTypes", () => {
    const s = state({ player: player({ currentLocationId: "loc-bare" }) });
    const result = moveHousingResolver.canExecute(s, action("move_housing", "housing-affordable"), ctx());
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("rejects the housing's own failureCode/messageKey when its Requirement isn't met", () => {
    const result = moveHousingResolver.canExecute(state(), action("move_housing", "housing-gated"), ctx());
    expect(result.errors[0]).toEqual({ code: "requirement_unmet", messageKey: "core.reason.requirement_unmet" });
  });

  // W55.5 — rejected insufficient_funds, current housing left untouched.
  it("rejects insufficient_funds for a home the player can't afford, leaving current housing untouched", () => {
    const s = state();
    const result = moveHousingResolver.canExecute(s, action("move_housing", "housing-expensive"), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
    expect(s.player.housing.definitionId).toBe("housing-1");
  });

  it("charges upfront cost plus deposit and replaces player.housing wholesale", () => {
    const s = state();
    const outcome = moveHousingResolver.calculate(s, action("move_housing", "housing-affordable"), ctx());
    const next = moveHousingResolver.apply(s, outcome);
    // upfrontCostCents (500) + depositCents (500) = 1000.
    expect(next.player.finances.cashCents).toBe(9000);
    expect(next.player.housing).toEqual({
      definitionId: "housing-affordable", movedInWeek: 3, ownership: "renting", damage: 0,
      weeklyCostCents: 2000, depositPaidCents: 500, rentDueWeek: 3, overdueRentCents: 0,
      missedPayments: 0, evictionStage: "none",
    });
    expect(next.calendar.spentTimeUnits).toBe(4);
  });

  // pay_bills (below) is this kind's only cure for arrears — a move must not become a
  // second one, silently discarding the debt and the eviction ladder's progress with it.
  it("rejects requirement_unmet while the current home has unpaid arrears, leaving housing untouched", () => {
    const inArrears = state({
      player: player({
        housing: {
          definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
          weeklyCostCents: 3000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 5000,
          missedPayments: 2, evictionStage: "penalty",
        },
      }),
    });
    const result = moveHousingResolver.canExecute(inArrears, action("move_housing", "housing-affordable"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
    expect(inArrears.player.housing.evictionStage).toBe("penalty");
  });
});

describe("W55 — pay_bills", () => {
  const inArrears = (): SimulationKindState => state({
    player: player({
      housing: {
        definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
        weeklyCostCents: 2000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 3300,
        missedPayments: 1, evictionStage: "warning",
      },
    }),
  });

  it("rejects requirement_unmet when nothing is owed", () => {
    const result = payBillsResolver.canExecute(state(), action("pay_bills"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("rejects wrong_location off the location that allows it", () => {
    const s = { ...inArrears(), player: player({ ...inArrears().player, currentLocationId: "loc-bare" }) };
    const result = payBillsResolver.canExecute(s, action("pay_bills"), ctx());
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("rejects insufficient_funds when cash is short of the full amount owed", () => {
    const s = { ...inArrears(), player: player({ ...inArrears().player, finances: { ...player().finances, cashCents: 100 } }) };
    const result = payBillsResolver.canExecute(s, action("pay_bills"), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("settles overdueRentCents in full and resets missedPayments/evictionStage", () => {
    const s = inArrears();
    const outcome = payBillsResolver.calculate(s, action("pay_bills"), ctx());
    const next = payBillsResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(s.player.finances.cashCents - 3300);
    expect(next.player.housing.overdueRentCents).toBe(0);
    expect(next.player.housing.missedPayments).toBe(0);
    expect(next.player.housing.evictionStage).toBe("none");
  });
});

describe("W55 — borrow_money / repay_debt / deposit_savings / invest", () => {
  it("borrow_money rejects requirement_unmet with no amountCents param", () => {
    const result = borrowMoneyResolver.canExecute(state(), action("borrow_money"), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("borrow_money rejects requirement_unmet when the resulting balance would overflow a safe integer", () => {
    const s = state({ player: player({ finances: { ...player().finances, cashCents: Number.MAX_SAFE_INTEGER } }) });
    const result = borrowMoneyResolver.canExecute(s, actionWithAmount("borrow_money", Number.MAX_SAFE_INTEGER), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("borrow_money increases cashCents and debtCents by the same amount, and spends time", () => {
    const s = state();
    const outcome = borrowMoneyResolver.calculate(s, actionWithAmount("borrow_money", 5000), ctx());
    const next = borrowMoneyResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(15000);
    expect(next.player.finances.debtCents).toBe(5000);
    expect(next.calendar.spentTimeUnits).toBe(1);
  });

  it("repay_debt rejects requirement_unmet for an amount exceeding debtCents", () => {
    const s = state({ player: player({ finances: { ...player().finances, debtCents: 1000 } }) });
    const result = repayDebtResolver.canExecute(s, actionWithAmount("repay_debt", 5000), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("repay_debt rejects insufficient_funds when cash is short", () => {
    const s = state({ player: player({ finances: { ...player().finances, cashCents: 100, debtCents: 5000 } }) });
    const result = repayDebtResolver.canExecute(s, actionWithAmount("repay_debt", 5000), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("repay_debt decreases cashCents and debtCents by the same amount", () => {
    const s = state({ player: player({ finances: { ...player().finances, debtCents: 5000 } }) });
    const outcome = repayDebtResolver.calculate(s, actionWithAmount("repay_debt", 3000), ctx());
    const next = repayDebtResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(7000);
    expect(next.player.finances.debtCents).toBe(2000);
  });

  it("deposit_savings rejects insufficient_funds when cash is short", () => {
    const result = depositSavingsResolver.canExecute(state(), actionWithAmount("deposit_savings", 20000), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("deposit_savings rejects requirement_unmet when the resulting balance would overflow a safe integer", () => {
    const s = state({ player: player({ finances: { ...player().finances, cashCents: Number.MAX_SAFE_INTEGER, savingsCents: Number.MAX_SAFE_INTEGER } }) });
    const result = depositSavingsResolver.canExecute(s, actionWithAmount("deposit_savings", Number.MAX_SAFE_INTEGER), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("deposit_savings moves cash into savingsCents", () => {
    const s = state();
    const outcome = depositSavingsResolver.calculate(s, actionWithAmount("deposit_savings", 4000), ctx());
    const next = depositSavingsResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(6000);
    expect(next.player.finances.savingsCents).toBe(4000);
  });

  it("invest rejects insufficient_funds when cash is short", () => {
    const result = investResolver.canExecute(state(), actionWithAmount("invest", 20000), ctx());
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("invest rejects requirement_unmet when the resulting account balance would overflow a safe integer", () => {
    const existing = { id: "investment-primary", kind: "investment" as const, label: "simulation.finance.investment.label", balanceCents: Number.MAX_SAFE_INTEGER, interestRate: 0, openedWeek: 3 };
    const s = state({ player: player({ finances: { ...player().finances, cashCents: Number.MAX_SAFE_INTEGER, accounts: [existing] } }) });
    const result = investResolver.canExecute(s, actionWithAmount("invest", Number.MAX_SAFE_INTEGER), ctx());
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("invest opens a new investment FinancialAccount from cash", () => {
    const s = state();
    const outcome = investResolver.calculate(s, actionWithAmount("invest", 4000), ctx());
    const next = investResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(6000);
    expect(next.player.finances.accounts).toEqual([
      { id: "investment-primary", kind: "investment", label: "simulation.finance.investment.label", balanceCents: 4000, interestRate: 0, openedWeek: 3 },
    ]);
  });

  // W55 review fix — `apply` mutates `player.finances.accounts`, but consumers of
  // `outcome.changes` alone (the reducer audit contract every other resolver here follows)
  // could not previously observe that an account was opened or credited.
  it("invest's outcome.changes carries the account's balance, addressed by natural key", () => {
    const s = state();
    const outcome = investResolver.calculate(s, actionWithAmount("invest", 4000), ctx());
    const balanceChange = outcome.changes.find((c) => c.path === "player.finances.accounts.investment-primary.balanceCents");
    expect(balanceChange).toMatchObject({ op: "set", value: 4000, previous: 0, visible: true });
  });

  it("invest tops up the existing investment account rather than opening a second one", () => {
    const existing = { id: "investment-primary", kind: "investment" as const, label: "simulation.finance.investment.label", balanceCents: 4000, interestRate: 0, openedWeek: 3 };
    const s = state({ player: player({ finances: { ...player().finances, accounts: [existing] } }) });
    const outcome = investResolver.calculate(s, actionWithAmount("invest", 1000), ctx());
    const next = investResolver.apply(s, outcome);
    expect(next.player.finances.accounts).toEqual([{ ...existing, balanceCents: 5000 }]);
  });
});

// ---------------------------------------------------------------------------
// W56 — Possessions, Places, and People
// ---------------------------------------------------------------------------

describe("W56.1 — every remaining ActionType has a real resolver", () => {
  it.each(["shop", "maintain_item", "repair_item", "sell_item", "travel", "socialize", "exercise"] as const)(
    "%s is not stubResolver",
    (type) => {
      expect(RESOLVER_TABLE[type]).not.toBe(stubResolver);
    },
  );
});

describe("W56.2 — both halves of wrong_location", () => {
  it("rejects a travel target the current location does not connect to", () => {
    const result = travelResolver.canExecute(state(), action("travel", "loc-far"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("accepts a travel target the current location does connect to", () => {
    const result = travelResolver.canExecute(state(), action("travel", "loc-bare"), ctx());
    expect(result.valid).toBe(true);
  });

  it("rejects an unknown travel target as unknown_action, not wrong_location", () => {
    const result = travelResolver.canExecute(state(), action("travel", "loc-nowhere"), ctx());
    expect(result.errors[0]?.code).toBe("unknown_action");
  });

  it.each([
    ["shop", shopResolver, "item-trinket"],
    ["maintain_item", maintainItemResolver, "inv-1"],
    ["repair_item", repairItemResolver, "inv-1"],
    ["sell_item", sellItemResolver, "inv-1"],
    ["travel", travelResolver, "loc-far"],
    ["socialize", socializeResolver, "npc-neighbour"],
  ] as const)("rejects %s whose type is absent from the location's actionTypes", (type, resolver, targetId) => {
    const s = state({
      player: player({ currentLocationId: "loc-bare", inventory: [inventoryItem({ condition: 10 })] }),
    });
    const result = resolver.canExecute(s, action(type, targetId), ctx());
    expect(result.errors[0]?.code).toBe("wrong_location");
  });

  it("rejects exercise whose type is absent from the location's actionTypes", () => {
    const s = state({ player: player({ currentLocationId: "loc-bare" }) });
    expect(exerciseResolver.canExecute(s, action("exercise"), ctx()).errors[0]?.code).toBe("wrong_location");
  });
});

describe("W56 — travel", () => {
  it("moves one hop and spends the target's own travelTimeUnits", () => {
    const near: LocationDefinition = { ...bareLocation, travelTimeUnits: 3, actionTypes: ["travel"] };
    const campaignWithCost: Campaign = {
      ...campaign,
      content: { ...simulationCampaign, locations: [workLocation, near, farLocation] },
    };
    const s = state();
    const outcome = travelResolver.calculate(s, action("travel", "loc-bare"), ctx({ campaign: campaignWithCost }));
    const next = travelResolver.apply(s, outcome);
    expect(next.player.currentLocationId).toBe("loc-bare");
    expect(next.calendar.spentTimeUnits).toBe(3);
  });

  it("rejects insufficient_time when the trip costs more than the week has left", () => {
    const campaignWithCost: Campaign = {
      ...campaign,
      content: { ...simulationCampaign, locations: [workLocation, { ...bareLocation, travelTimeUnits: 9 }, farLocation] },
    };
    const s = state({ calendar: { ...calendar, spentTimeUnits: 8 } });
    const result = travelResolver.canExecute(s, action("travel", "loc-bare"), ctx({ campaign: campaignWithCost }));
    expect(result.errors[0]?.code).toBe("insufficient_time");
  });
});

describe("W56 — shop", () => {
  it("rejects an unknown item", () => {
    expect(shopResolver.canExecute(state(), action("shop", "item-nope"), ctx()).errors[0]?.code).toBe("unknown_action");
  });

  it("rejects insufficient_funds when the price exceeds cash", () => {
    expect(shopResolver.canExecute(state(), action("shop", "item-expensive"), ctx()).errors[0]?.code).toBe("insufficient_funds");
  });

  it("adds one undamaged instance and debits the price", () => {
    const s = state();
    const outcome = shopResolver.calculate(s, action("shop", "item-bicycle"), ctx());
    const next = shopResolver.apply(s, outcome);
    expect(next.player.finances.cashCents).toBe(6000);
    expect(next.player.inventory).toEqual([{
      instanceId: "inv-action-1", definitionId: "item-bicycle", quantity: 1, acquiredWeek: 3,
      purchasePriceCents: 4000, condition: 100, weeksSinceMaintenance: 0, broken: false,
    }]);
    expect(next.calendar.spentTimeUnits).toBe(1);
  });

  it("addresses the new instance by natural key in outcome.changes", () => {
    const outcome = shopResolver.calculate(state(), action("shop", "item-bicycle"), ctx());
    expect(outcome.changes.find((c) => c.path === "player.inventory.inv-action-1.condition"))
      .toMatchObject({ op: "set", value: 100, visible: true });
  });

  it("attaches no StatusEffect itself — that is the inventory system's job", () => {
    const s = state();
    const next = shopResolver.apply(s, shopResolver.calculate(s, action("shop", "item-bicycle"), ctx()));
    expect(next.activeEffects).toEqual([]);
  });
});

describe("W56 — maintain_item and repair_item", () => {
  const owning = (overrides: Partial<InventoryItem> = {}): SimulationKindState =>
    state({ player: player({ inventory: [inventoryItem(overrides)] }) });

  it("maintain_item rejects requirement_unmet for an instance not owned", () => {
    expect(maintainItemResolver.canExecute(state(), action("maintain_item", "inv-1"), ctx()).errors[0]?.code)
      .toBe("requirement_unmet");
  });

  it("maintain_item rejects requirement_unmet for an item with no maintenance rules", () => {
    const s = owning({ definitionId: "item-trinket" });
    expect(maintainItemResolver.canExecute(s, action("maintain_item", "inv-1"), ctx()).errors[0]?.code)
      .toBe("requirement_unmet");
  });

  it("maintain_item resets the maintenance clock without restoring condition", () => {
    const s = owning({ condition: 40, weeksSinceMaintenance: 5 });
    const next = maintainItemResolver.apply(s, maintainItemResolver.calculate(s, action("maintain_item", "inv-1"), ctx()));
    expect(next.player.inventory[0]).toMatchObject({ condition: 40, weeksSinceMaintenance: 0 });
    expect(next.player.finances.cashCents).toBe(9500);
    expect(next.calendar.spentTimeUnits).toBe(1);
  });

  it("repair_item rejects requirement_unmet for an undamaged, unbroken item", () => {
    expect(repairItemResolver.canExecute(owning(), action("repair_item", "inv-1"), ctx()).errors[0]?.code)
      .toBe("requirement_unmet");
  });

  it("repair_item restores condition and clears broken, priced off what was lost", () => {
    const s = owning({ condition: 25, broken: true, weeksSinceMaintenance: 4 });
    const next = repairItemResolver.apply(s, repairItemResolver.calculate(s, action("repair_item", "inv-1"), ctx()));
    expect(next.player.inventory[0]).toMatchObject({ condition: 100, broken: false, weeksSinceMaintenance: 4 });
    expect(next.player.finances.cashCents).toBe(7000);
  });

  it("repair_item rejects insufficient_funds when the repair costs more than cash", () => {
    const s = state({
      player: player({
        finances: { ...player().finances, cashCents: 100 },
        inventory: [inventoryItem({ condition: 0 })],
      }),
    });
    expect(repairItemResolver.canExecute(s, action("repair_item", "inv-1"), ctx()).errors[0]?.code)
      .toBe("insufficient_funds");
  });
});

describe("W56 — sell_item", () => {
  it("rejects requirement_unmet for an instance not owned", () => {
    expect(sellItemResolver.canExecute(state(), action("sell_item", "inv-1"), ctx()).errors[0]?.code)
      .toBe("requirement_unmet");
  });

  it("removes the instance and credits resale scaled by condition", () => {
    const s = state({ player: player({ inventory: [inventoryItem({ condition: 50 })] }) });
    const next = sellItemResolver.apply(s, sellItemResolver.calculate(s, action("sell_item", "inv-1"), ctx()));
    expect(next.player.inventory).toEqual([]);
    expect(next.player.finances.cashCents).toBe(11000);
  });
});

describe("W56.4 — socialize", () => {
  it("rejects requirement_unmet when the NPC is not present at the current location", () => {
    const result = socializeResolver.canExecute(state(), action("socialize", "npc-absent"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("rejects an unknown NPC", () => {
    expect(socializeResolver.canExecute(state(), action("socialize", "npc-nope"), ctx()).errors[0]?.code)
      .toBe("unknown_action");
  });

  it("opens a relationship from the NPC's initialRelationship on the first interaction", () => {
    const s = state();
    const next = socializeResolver.apply(s, socializeResolver.calculate(s, action("socialize", "npc-neighbour"), ctx()));
    expect(next.player.relationships).toEqual([{
      npcId: "npc-neighbour", category: "personal",
      affinity: 15, trust: 12, respect: 10, resentment: 0,
      knownSinceWeek: 3, lastInteractionWeek: 3, interactionCount: 1,
    }]);
  });

  it("moves an existing relationship rather than opening a second one", () => {
    const existing: RelationshipState = {
      npcId: "npc-neighbour", category: "professional",
      affinity: 40, trust: 30, respect: 20, resentment: 5,
      knownSinceWeek: 1, lastInteractionWeek: 2, interactionCount: 4,
    };
    const s = state({ player: player({ relationships: [existing] }) });
    const next = socializeResolver.apply(s, socializeResolver.calculate(s, action("socialize", "npc-neighbour"), ctx()));
    expect(next.player.relationships).toEqual([{
      ...existing, affinity: 45, trust: 32, lastInteractionWeek: 3, interactionCount: 5,
    }]);
  });

  it("keeps the hidden resentment dimension off any visible change", () => {
    const outcome = socializeResolver.calculate(state(), action("socialize", "npc-neighbour"), ctx());
    expect(outcome.changes.find((c) => c.path.endsWith(".resentment"))).toMatchObject({ visible: false });
  });
});

describe("W56.5 — exercise", () => {
  it("moves the needs §6.5 names, one StateChange each", () => {
    const s = state();
    const outcome = exerciseResolver.calculate(s, action("exercise"), ctx());
    const next = exerciseResolver.apply(s, outcome);
    expect(next.player.needs).toEqual({ health: 85, energy: 70, happiness: 63, stress: 15, satiety: 75 });
    expect(outcome.changes.filter((c) => c.path.startsWith("player.needs.")).map((c) => c.path)).toEqual([
      "player.needs.energy", "player.needs.happiness", "player.needs.health",
      "player.needs.satiety", "player.needs.stress",
    ]);
  });

  it("clamps to 0-100 and emits nothing for a need already at its bound", () => {
    const s = state({
      player: player({ needs: { health: 100, energy: 5, happiness: 100, stress: 0, satiety: 2 } }),
    });
    const outcome = exerciseResolver.calculate(s, action("exercise"), ctx());
    const next = exerciseResolver.apply(s, outcome);
    expect(next.player.needs).toEqual({ health: 100, energy: 0, happiness: 100, stress: 0, satiety: 0 });
    expect(outcome.changes.filter((c) => c.path.startsWith("player.needs.")).map((c) => c.path)).toEqual([
      "player.needs.energy", "player.needs.satiety",
    ]);
  });
});
