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

  it("throws for a condition needing collection support", () => {
    const condition = { count: { collection: "world.npcs", where: { field: "id", operator: "equals" as const, value: "x" } }, operator: "equals" as const, value: 1 };
    expect(() => evaluateSimulationCondition(condition, makeState())).toThrow(/no collection support/);
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
