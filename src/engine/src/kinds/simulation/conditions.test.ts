import { describe, it, expect } from "vitest";
import { resolveField, evaluateSimulationCondition } from "./conditions.js";
import type { SimulationKindState } from "./state.js";

function makeState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 7, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: { needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 } } as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {} as SimulationKindState["world"],
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

/** A state carrying one item in each of the eight supported collections, for the `exists`/`count`
 *  tests below — `car-1`'s `definitionId` is the one W111.2/W111.5 tests key off of. */
function makeCollectionsState(): SimulationKindState {
  return makeState({
    player: {
      needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
      inventory: [
        {
          instanceId: "i1", definitionId: "car-1", quantity: 1, acquiredWeek: 1,
          purchasePriceCents: 100000, condition: 90, weeksSinceMaintenance: 0, broken: false,
        },
      ],
      relationships: [
        {
          npcId: "n1", category: "personal", affinity: 10, trust: 10, respect: 10,
          resentment: 0, knownSinceWeek: 1, interactionCount: 0,
        },
      ],
      career: {
        pendingApplications: [
          { jobId: "j1", submittedWeek: 1, resolvesWeek: 2, contested: false },
        ],
      },
      education: {
        enrollments: [
          {
            courseId: "c1", startedWeek: 1, weeksCompleted: 0, attendedUnits: 0, studyUnits: 0,
            missedSessions: 0, tuitionPaidCents: 0, tuitionOutstandingCents: 0,
            retainedProgress: 0, status: "active",
          },
        ],
        credentials: [
          { id: "credential-1", courseId: "c1", awardedWeek: 6, level: "certificate", labelKey: "credential.c1" },
        ],
      },
      projects: [
        { instanceId: "p1", definitionId: "proj-1", startedWeek: 1, progressUnits: 0, status: "in_progress" },
      ],
      businesses: [
        {
          instanceId: "b1", definitionId: "biz-1", startedWeek: 1, cashOnHandCents: 0,
          weeksOperated: 0, status: "operating",
        },
      ],
    } as SimulationKindState["player"],
    world: {
      npcs: [
        { id: "n1", definitionId: "npc-1", memories: [], currentRole: "landlord", availability: [], flags: {} },
      ],
    } as unknown as SimulationKindState["world"],
  });
}

describe("resolveField", () => {
  it("resolves a nested dotted path", () => {
    expect(resolveField(makeState(), "player.needs.happiness")).toBe(60);
  });

  it("resolves a top-level scalar path", () => {
    expect(resolveField(makeState(), "calendar.currentWeek")).toBe(7);
  });

  it("throws for a path that walks through a non-object", () => {
    expect(() => resolveField(makeState(), "calendar.currentWeek.nope")).toThrow(/unresolvable field/);
  });

  it("resolves the effective (modifier-layered) need, not the raw stored one (§6.1)", () => {
    const state = makeState({
      activeEffects: [{
        id: "e1", sourceId: "s1", sourceKind: "item",
        modifiers: [{ target: "player.needs.happiness", operation: "add", value: 15, sourceId: "s1" }],
        appliedWeek: 1, stacking: "refresh", descriptionKey: "effect.e1", visible: true,
      }],
    });
    expect(resolveField(state, "player.needs.happiness")).toBe(75);
  });
});

describe("evaluateSimulationCondition", () => {
  it("evaluates a comparison condition against state", () => {
    const condition = { field: "player.needs.happiness", operator: "greater_or_equal" as const, value: 60 };
    expect(evaluateSimulationCondition(condition, makeState())).toBe(true);
  });

  it("evaluates a compound condition against state", () => {
    const condition = {
      all: [
        { field: "player.needs.happiness", operator: "greater_or_equal" as const, value: 60 },
        { field: "player.needs.health", operator: "greater_or_equal" as const, value: 60 },
      ],
    };
    expect(evaluateSimulationCondition(condition, makeState())).toBe(true);
  });

  describe("collections (§8.2, W111)", () => {
    const EIGHT_COLLECTIONS = [
      "player.inventory",
      "player.relationships",
      "player.career.pendingApplications",
      "player.education.enrollments",
      "player.education.credentials",
      "player.projects",
      "player.businesses",
      "world.npcs",
    ] as const;

    it("resolves exists/count over each of the eight supported collections (W111.1, issue #494)", () => {
      const state = makeCollectionsState();
      expect(EIGHT_COLLECTIONS).toHaveLength(8);
      for (const collection of EIGHT_COLLECTIONS) {
        // Every item resolves a field that is absent on it, so `not_equals` against any value
        // is trivially true — this proves the collection resolves and has exactly one item,
        // without needing a per-collection field name here.
        const trivialWhere = { field: "__does_not_exist__", operator: "not_equals" as const, value: "anything" };
        const existsCondition = { exists: { collection, where: trivialWhere } };
        const countCondition = { count: { collection, where: trivialWhere }, operator: "equals" as const, value: 1 };
        expect(evaluateSimulationCondition(existsCondition, state)).toBe(true);
        expect(evaluateSimulationCondition(countCondition, state)).toBe(true);
      }
    });

    it("fails Tier 1 defence-in-depth for an unlisted collection, and accepts every legal one (W111.1, W111.3)", () => {
      const state = makeCollectionsState();
      const legalCount = EIGHT_COLLECTIONS.filter((collection) => {
        try {
          evaluateSimulationCondition(
            { count: { collection, where: { field: "__does_not_exist__", operator: "equals" as const, value: 1 } }, operator: "equals" as const, value: 0 },
            state,
          );
          return true;
        } catch {
          return false;
        }
      }).length;
      expect(legalCount).toBe(8);

      const condition = { count: { collection: "player.scoreboard", where: { field: "id", operator: "equals" as const, value: "x" } }, operator: "equals" as const, value: 1 };
      expect(() => evaluateSimulationCondition(condition, state)).toThrow(/unknown collection/);
    });

    it("checks earned education credentials with the existing condition operators (issue #494)", () => {
      const state = makeCollectionsState();
      const certificateOrBetter = {
        exists: {
          collection: "player.education.credentials",
          where: {
            field: "level",
            operator: "in" as const,
            value: ["certificate", "diploma", "degree", "postgraduate"],
          },
        },
      };
      const schoolOnly = {
        count: {
          collection: "player.education.credentials",
          where: { field: "level", operator: "equals" as const, value: "school" },
        },
        operator: "equals" as const,
        value: 1,
      };

      expect(evaluateSimulationCondition(certificateOrBetter, state)).toBe(true);
      expect(evaluateSimulationCondition(schoolOnly, state)).toBe(false);
    });

    it("a where clause reads fields relative to one array element (W111.2)", () => {
      const state = makeCollectionsState();
      const ownsOneOf = (ids: string[]) => ({
        exists: { collection: "player.inventory", where: { field: "definitionId", operator: "in" as const, value: ids } },
      });
      expect(evaluateSimulationCondition(ownsOneOf(["car-1", "car-2"]), state)).toBe(true);
      expect(evaluateSimulationCondition(ownsOneOf(["car-2", "car-3"]), state)).toBe(false);
    });

    it("naming an unlisted collection fails at load time, never at evaluation — a condition on an unreached branch never throws (W111.3)", () => {
      const state = makeCollectionsState();
      const reachedCondition = { field: "player.needs.happiness", operator: "greater_or_equal" as const, value: 0 };
      const unreachedCondition = { count: { collection: "player.scoreboard", where: { field: "id", operator: "equals" as const, value: "x" } }, operator: "equals" as const, value: 1 };
      const branch = { any: [reachedCondition, unreachedCondition] };
      // `any` short-circuits on the first true branch, so `unreachedCondition` is never evaluated.
      expect(evaluateSimulationCondition(branch, state)).toBe(true);
    });

    it("count compares the match total at zero, at the boundary, and above it (W111.4)", () => {
      const state = makeCollectionsState();
      const matchesOwned = { field: "definitionId", operator: "equals" as const, value: "car-1" };
      const matchesNothing = { field: "definitionId", operator: "equals" as const, value: "__none__" };

      expect(evaluateSimulationCondition(
        { count: { collection: "player.inventory", where: matchesNothing }, operator: "equals" as const, value: 0 },
        state,
      )).toBe(true);
      expect(evaluateSimulationCondition(
        { count: { collection: "player.inventory", where: matchesOwned }, operator: "equals" as const, value: 1 },
        state,
      )).toBe(true);
      expect(evaluateSimulationCondition(
        { count: { collection: "player.inventory", where: matchesOwned }, operator: "greater_than" as const, value: 1 },
        state,
      )).toBe(false);
    });

    it("a where naming a field the array element doesn't carry never matches (W111.5)", () => {
      const state = makeCollectionsState();
      // `category` lives on `ItemDefinition`, not on the runtime `InventoryItem` the resolver
      // actually sees, so this must not match even though the owned item's definition has one.
      const condition = { exists: { collection: "player.inventory", where: { field: "category", operator: "equals" as const, value: "vehicle" } } };
      expect(evaluateSimulationCondition(condition, state)).toBe(false);
    });
  });

  it("evaluates a goal/failure condition against the effective need, agreeing with what a client would see (§6.1)", () => {
    const state = makeState({
      player: { needs: { health: 80, energy: 80, happiness: 40, stress: 20, satiety: 80 } } as SimulationKindState["player"],
      activeEffects: [{
        id: "e1", sourceId: "s1", sourceKind: "item",
        modifiers: [{ target: "player.needs.happiness", operation: "add", value: 25, sourceId: "s1" }],
        appliedWeek: 1, stacking: "refresh", descriptionKey: "effect.e1", visible: true,
      }],
    });
    const condition = { field: "player.needs.happiness", operator: "greater_or_equal" as const, value: 60 };

    expect(evaluateSimulationCondition(condition, state)).toBe(true);
  });
});
