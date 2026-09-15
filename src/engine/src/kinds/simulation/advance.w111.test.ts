/**
 * Engine issue #418 — a condition addresses a specific entry in an actor-owned array by its
 * stable id, not its array index, against a built campaign.
 *
 * W111 (`conditions.ts`, `validate.ts`) is the mechanism; `conditions.test.ts` proves each of
 * §8.2's seven collections resolves, but only reaches `player.relationships` and
 * `player.education.enrollments` through a trivial `where` on a hand-built state. This file
 * is #418's third criterion: both collections, keyed by `npcId`/`courseId` (enrollments also
 * filtered on `status`), authored as goal conditions in a campaign that passes Tier 1, and
 * evaluated by `end_week`'s own `goals` system rather than by calling the resolver directly.
 *
 * Each positive case has a negative twin where *some other* entry satisfies the non-id half
 * of the `where` — so a pass cannot come from "any item matches" — and a reordered twin, so
 * it cannot come from array position.
 *
 * Contract: `10-simulation-kind.md` §8.2, §7.1.
 */

import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { validateCampaign } from "./validate.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { GoalDefinition } from "./content.js";
import type { CourseEnrollment, RelationshipState } from "./actor.js";
import type { SimulationKindState } from "./state.js";

/** The landlord specifically resents the player — `event-landlord-inspection`'s shape in
 *  GameOfLife, the case #418 was raised for. */
const landlordResentsGoal: GoalDefinition = {
  id: "goal-landlord-resents",
  labelKey: "k",
  descriptionKey: "k",
  category: "test",
  conditions: {
    exists: {
      collection: "player.relationships",
      where: {
        all: [
          { field: "npcId", operator: "equals", value: "npc-landlord" },
          { field: "resentment", operator: "greater_than", value: 50 },
        ],
      },
    },
  },
};

/** A specific course is in progress — `event-tutor-offers-extra-session`'s shape. */
const eveningCourseActiveGoal: GoalDefinition = {
  id: "goal-evening-course-active",
  labelKey: "k",
  descriptionKey: "k",
  category: "test",
  conditions: {
    exists: {
      collection: "player.education.enrollments",
      where: {
        all: [
          { field: "courseId", operator: "equals", value: "course-evening" },
          { field: "status", operator: "equals", value: "active" },
        ],
      },
    },
  },
};

/** `count` over the same id-bearing collection: exactly two NPCs resent the player. */
const twoResentfulGoal: GoalDefinition = {
  id: "goal-two-resentful",
  labelKey: "k",
  descriptionKey: "k",
  category: "test",
  conditions: {
    count: { collection: "player.relationships", where: { field: "resentment", operator: "greater_than", value: 50 } },
    operator: "equals",
    value: 2,
  },
};

const GOALS = [landlordResentsGoal, eveningCourseActiveGoal, twoResentfulGoal];

const simulationCampaign: SimulationCampaign = {
  descriptionKey: "k",
  jobs: [], courses: [],
  housing: [{
    id: "housing-1", nameKey: "k", descriptionKey: "k",
    upfrontCostCents: 0, weeklyCostCents: 0, capacity: 1, comfort: 0, safety: 0, prestige: 0, storage: 0,
    commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0, maintenanceRisk: 0,
    requirements: [], tags: [],
  }],
  items: [], events: [], npcs: [],
  goals: GOALS,
  scenarios: [{
    id: "scenario-1", nameKey: "k", descriptionKey: "k",
    startingBackgroundIds: [], startingCashCents: 0, startingHousingId: "housing-1", startingLocationId: "home",
    startingInventory: [], goalIds: GOALS.map((goal) => goal.id), mode: "classic", goalFailurePrecedence: "goals_win",
  }],
  difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
  locations: [{ id: "home", nameKey: "k", descriptionKey: "k", connections: [], travelTimeUnits: 0, actionTypes: [] }],
  backgrounds: [], traits: [], skills: [], projects: [], businesses: [],
  scenarioId: "scenario-1", goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "k", actionLabelKeys: { planAdd: "k", planRemove: "k", planClear: "k", endWeek: "k" },
};

const campaign: Campaign = { id: "test-w111-418", kindId: "simulation", version: "1.0.0", titleKey: "k", content: simulationCampaign };

function relationship(npcId: string, resentment: number): RelationshipState {
  return { npcId, category: "personal", affinity: 50, trust: 50, respect: 50, resentment, knownSinceWeek: 1, interactionCount: 0 };
}

function enrollment(courseId: string, status: CourseEnrollment["status"]): CourseEnrollment {
  return {
    courseId, startedWeek: 1, weeksCompleted: 0, attendedUnits: 0, studyUnits: 0, missedSessions: 0,
    tuitionPaidCents: 0, tuitionOutstandingCents: 0, retainedProgress: 0, status,
  };
}

function buildState(relationships: RelationshipState[], enrollments: CourseEnrollment[]): SimulationKindState {
  return {
    calendar: { currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
      currentLocationId: "home",
      finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
      needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
      attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      education: { enrollments, credentials: [], completedCourseIds: [], failedCourseIds: [] },
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: 0, utilitiesCents: 0, transportCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
      inventory: [], relationships, projects: [], businesses: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
    } as unknown as SimulationKindState["player"],
    economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
    world: {
      npcs: [], locations: [{ definitionId: "home", discovered: true, accessible: true }],
      jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {},
    },
    activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
    goals: GOALS.map((goal) => ({
      definitionId: goal.id, status: "active", satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0, progressNotes: [],
    })),
    resolution: null,
    plan: { week: 1, actions: [] },
  };
}

function ctx(): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign,
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() { return this.rng; },
    seq: 1,
    emit: { emit: () => undefined },
  };
}

/** Runs one `end_week` and returns the status `goals` left on the named goal. */
function goalStatusAfterWeek(goalId: string, relationships: RelationshipState[], enrollments: CourseEnrollment[]): string | undefined {
  const next = advance(buildState(relationships, enrollments), "end_week", undefined, ctx()).state;
  return next.goals.find((goal) => goal.definitionId === goalId)?.status;
}

describe("#418 — id-keyed addressing into actor-owned arrays, against a built campaign (W111)", () => {
  it("the campaign authoring these conditions passes validation", () => {
    const result = validateCampaign(campaign, new Map([["k", "text"]]));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  describe("player.relationships, keyed by npcId", () => {
    it("matches when the named NPC's entry satisfies the where clause", () => {
      const relationships = [relationship("npc-neighbor", 10), relationship("npc-landlord", 60)];
      expect(goalStatusAfterWeek(landlordResentsGoal.id, relationships, [])).toBe("completed");
    });

    it("does not match when only a different NPC satisfies the non-id half", () => {
      const relationships = [relationship("npc-neighbor", 80), relationship("npc-landlord", 40)];
      expect(goalStatusAfterWeek(landlordResentsGoal.id, relationships, [])).toBe("active");
    });

    it("is unaffected by array order — the key is the id, not the index", () => {
      const forward = [relationship("npc-landlord", 60), relationship("npc-neighbor", 10)];
      const reversed = [...forward].reverse();
      expect(goalStatusAfterWeek(landlordResentsGoal.id, forward, [])).toBe("completed");
      expect(goalStatusAfterWeek(landlordResentsGoal.id, reversed, [])).toBe("completed");
    });

    it("count totals matching entries across the collection", () => {
      const two = [relationship("npc-landlord", 60), relationship("npc-neighbor", 80), relationship("npc-friend", 5)];
      const one = [relationship("npc-landlord", 60), relationship("npc-neighbor", 20), relationship("npc-friend", 5)];
      expect(goalStatusAfterWeek(twoResentfulGoal.id, two, [])).toBe("completed");
      expect(goalStatusAfterWeek(twoResentfulGoal.id, one, [])).toBe("active");
    });
  });

  describe("player.education.enrollments, keyed by courseId and filtered on status", () => {
    it("matches when the named course's enrollment is active", () => {
      const enrollments = [enrollment("course-night", "completed"), enrollment("course-evening", "active")];
      expect(goalStatusAfterWeek(eveningCourseActiveGoal.id, [], enrollments)).toBe("completed");
    });

    it("does not match when a different course is the active one", () => {
      const enrollments = [enrollment("course-night", "active"), enrollment("course-evening", "withdrawn")];
      expect(goalStatusAfterWeek(eveningCourseActiveGoal.id, [], enrollments)).toBe("active");
    });

    it("does not match when the named course is present but not active", () => {
      expect(goalStatusAfterWeek(eveningCourseActiveGoal.id, [], [enrollment("course-evening", "failed")])).toBe("active");
    });

    it("is unaffected by array order — the key is the id, not the index", () => {
      const forward = [enrollment("course-evening", "active"), enrollment("course-night", "completed")];
      const reversed = [...forward].reverse();
      expect(goalStatusAfterWeek(eveningCourseActiveGoal.id, [], forward)).toBe("completed");
      expect(goalStatusAfterWeek(eveningCourseActiveGoal.id, [], reversed)).toBe("completed");
    });
  });
});
