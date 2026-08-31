/**
 * W101.1/W101.2/W101.3 — `start_project`, `work_on_project`, `start_business`,
 * `operate_business`: the four resolvers that replace their `stubResolver` entries.
 *
 * Contract: `10-simulation-kind.md` §4.2, §5.1, §6.12, §7.12.
 */

import { describe, it, expect } from "vitest";
import {
  RESOLVER_TABLE,
  stubResolver,
  startProjectResolver,
  workOnProjectResolver,
  startBusinessResolver,
  operateBusinessResolver,
} from "./resolvers.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { BusinessDefinition, ProjectDefinition } from "./content.js";
import type { GameAction } from "./plan.js";
import type { SimulationKindState } from "./state.js";
import type { BusinessRecord, ProjectRuntimeState } from "./actor.js";

const PROJECT: ProjectDefinition = {
  id: "project-novel", nameKey: "k.n", descriptionKey: "k.d",
  requirements: [], requiredUnits: 2, weeklyTimeCost: 3, startCostCents: 1000,
  rewards: [{ type: "skill", target: "writing", value: 40 }], tags: [],
};

const BUSINESS: BusinessDefinition = {
  id: "business-stall", nameKey: "k.n", descriptionKey: "k.d",
  requirements: [], startupCostCents: 5000,
  weeklyRevenueCents: 3000, weeklyExpensesCents: 1000, minimumCashCents: 0, tags: [],
};

const HOME_LOCATION = { id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: ["start_project", "work_on_project", "start_business"] };

function ctx(overrides: Partial<SimulationCampaign> = {}): KindContext {
  const content = {
    projects: [PROJECT], businesses: [BUSINESS], locations: [HOME_LOCATION], ...overrides,
  } as unknown as SimulationCampaign;
  return {
    campaign: { content },
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items: readonly unknown[]) => items[0], weightedPick: (items: readonly { item: unknown }[]) => items[0]!.item },
  } as unknown as KindContext;
}

function state(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 3, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      currentLocationId: "home",
      finances: { cashCents: 10000 },
      projects: [] as ProjectRuntimeState[],
      businesses: [] as BusinessRecord[],
      skills: {},
      flags: {}, counters: {}, inventory: [], relationships: [],
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { weeklyCostCents: 0 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: { agents: [] } as unknown as SimulationKindState["world"],
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    resolution: null,
    plan: null,
    ...overrides,
  };
}

function action(type: GameAction["type"], targetId?: string): GameAction {
  return { id: "action-1", type, actorId: "player", ...(targetId ? { targetId } : {}), parameters: {} };
}

describe("W101 — the four project/business resolvers are real, not stubs", () => {
  it.each(["start_project", "work_on_project", "start_business", "operate_business"] as const)(
    "%s is wired to a resolver of its own",
    (type) => {
      expect(RESOLVER_TABLE[type]).not.toBe(stubResolver);
    },
  );

  it("leaves no stub behind for an action type this unit owns", () => {
    expect(RESOLVER_TABLE.start_project).toBe(startProjectResolver);
    expect(RESOLVER_TABLE.work_on_project).toBe(workOnProjectResolver);
    expect(RESOLVER_TABLE.start_business).toBe(startBusinessResolver);
    expect(RESOLVER_TABLE.operate_business).toBe(operateBusinessResolver);
  });
});

describe("W101.1/W101.2 — start_project and work_on_project", () => {
  it("rejects unknown_action when the target names no ProjectDefinition", () => {
    const result = startProjectResolver.canExecute(state(), action("start_project", "no-such-project"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });

  it("rejects insufficient_funds when cash is short of startCostCents", () => {
    const result = startProjectResolver.canExecute(
      state({ player: { ...state().player, finances: { cashCents: 500 } } as unknown as SimulationKindState["player"] }),
      action("start_project", "project-novel"), ctx(),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("insufficient_funds");
  });

  it("starts a project: mints an instance, charges startCostCents, spends time", () => {
    const s = state();
    const outcome = startProjectResolver.calculate(s, action("start_project", "project-novel"), ctx());
    const next = startProjectResolver.apply(s, outcome);
    expect(next.player.projects).toEqual([
      { instanceId: "project-action-1", definitionId: "project-novel", startedWeek: 3, progressUnits: 0, status: "in_progress" },
    ]);
    expect(next.player.finances.cashCents).toBe(9000);
    expect(next.calendar.spentTimeUnits).toBe(1);
  });

  it("two instances of the same ProjectDefinition are addressed by instanceId, never definitionId", () => {
    let s = state();
    const first = startProjectResolver.apply(s, startProjectResolver.calculate(s, { ...action("start_project", "project-novel"), id: "a1" }, ctx()));
    s = first;
    const second = startProjectResolver.apply(s, startProjectResolver.calculate(s, { ...action("start_project", "project-novel"), id: "a2" }, ctx()));
    expect(second.player.projects.map((p) => p.instanceId)).toEqual(["project-a1", "project-a2"]);
  });

  it("work_on_project rejects requirement_unmet once the instance is already completed", () => {
    const completed: ProjectRuntimeState = { instanceId: "p1", definitionId: "project-novel", startedWeek: 1, progressUnits: 2, status: "completed", completedWeek: 2 };
    const s = state({ player: { ...state().player, projects: [completed] } as unknown as SimulationKindState["player"] });
    const result = workOnProjectResolver.canExecute(s, action("work_on_project", "p1"), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });

  it("work_on_project advances progressUnits, completes once required units are reached, and grants the skill reward exactly once", () => {
    const inProgress: ProjectRuntimeState = { instanceId: "p1", definitionId: "project-novel", startedWeek: 1, progressUnits: 1, status: "in_progress" };
    const s = state({ player: { ...state().player, projects: [inProgress] } as unknown as SimulationKindState["player"] });
    const outcome = workOnProjectResolver.calculate(s, action("work_on_project", "p1"), ctx());
    const next = workOnProjectResolver.apply(s, outcome);
    expect(next.player.projects).toEqual([
      { instanceId: "p1", definitionId: "project-novel", startedWeek: 1, progressUnits: 2, status: "completed", completedWeek: 3 },
    ]);
    expect(next.player.skills["writing"]).toBe(40);

    // A second attempt against the now-completed instance is rejected, not re-credited.
    const rejected = workOnProjectResolver.canExecute(next, action("work_on_project", "p1"), ctx());
    expect(rejected.valid).toBe(false);
    expect(rejected.errors[0]?.code).toBe("requirement_unmet");
  });
});

describe("W101.3 — start_business and operate_business", () => {
  it("starts a business: mints an instance, charges startupCostCents, status operating", () => {
    const s = state();
    const outcome = startBusinessResolver.calculate(s, action("start_business", "business-stall"), ctx());
    const next = startBusinessResolver.apply(s, outcome);
    expect(next.player.businesses).toEqual([
      { instanceId: "business-action-1", definitionId: "business-stall", startedWeek: 3, cashOnHandCents: 0, weeksOperated: 0, status: "operating" },
    ]);
    expect(next.player.finances.cashCents).toBe(5000);
  });

  it("operate_business with parameters.close voluntarily closes the named instance", () => {
    const operating: BusinessRecord = { instanceId: "b1", definitionId: "business-stall", startedWeek: 1, cashOnHandCents: 2000, weeksOperated: 2, status: "operating" };
    const s = state({ player: { ...state().player, businesses: [operating] } as unknown as SimulationKindState["player"] });
    const action1: GameAction = { id: "a1", type: "operate_business", actorId: "player", targetId: "b1", parameters: { close: true } };
    const outcome = operateBusinessResolver.calculate(s, action1, ctx());
    const next = operateBusinessResolver.apply(s, outcome);
    expect(next.player.businesses).toEqual([{ ...operating, status: "closed" }]);
  });

  it("operate_business rejects requirement_unmet against an already-closed instance", () => {
    const closed: BusinessRecord = { instanceId: "b1", definitionId: "business-stall", startedWeek: 1, cashOnHandCents: 2000, weeksOperated: 2, status: "closed", closedWeek: 2 };
    const s = state({ player: { ...state().player, businesses: [closed] } as unknown as SimulationKindState["player"] });
    const result = operateBusinessResolver.canExecute(s, { id: "a1", type: "operate_business", actorId: "player", targetId: "b1", parameters: {} }, ctx());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });
});
