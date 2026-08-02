import { describe, it, expect } from "vitest";
import { outcome } from "./outcome.js";
import type { GoalState, SimulationKindState } from "./state.js";

function makeGoal(overrides: Partial<GoalState> = {}): GoalState {
  return {
    definitionId: "goal-1",
    status: "active",
    satisfiedThisWeek: false,
    consecutiveWeeksSatisfied: 0,
    progressNotes: [],
    ...overrides,
  };
}

function stateWithGoals(goals: GoalState[]): SimulationKindState {
  return { goals } as unknown as SimulationKindState;
}

describe("outcome", () => {
  it("returns resolution null with no goals declared", () => {
    const result = outcome(stateWithGoals([]));
    expect(result).toEqual({ resolution: null, goalsMet: [], goalsFailed: [] });
  });

  it("returns resolution null while any goal is still active", () => {
    const result = outcome(stateWithGoals([
      makeGoal({ definitionId: "a", status: "completed" }),
      makeGoal({ definitionId: "b", status: "active" }),
    ]));
    expect(result.resolution).toBeNull();
  });

  it("returns goals_met, sorted, once every goal completes", () => {
    const result = outcome(stateWithGoals([
      makeGoal({ definitionId: "zebra", status: "completed" }),
      makeGoal({ definitionId: "apple", status: "completed" }),
    ]));
    expect(result).toEqual({ resolution: "goals_met", goalsMet: ["apple", "zebra"], goalsFailed: [] });
  });

  it("returns failed, sorted, once every goal is decided and at least one failed", () => {
    const result = outcome(stateWithGoals([
      makeGoal({ definitionId: "zebra", status: "completed" }),
      makeGoal({ definitionId: "apple", status: "failed" }),
    ]));
    expect(result).toEqual({ resolution: "failed", goalsMet: ["zebra"], goalsFailed: ["apple"] });
  });

  it("never returns week_limit_reached — not resolvable from state alone (§12)", () => {
    const result = outcome(stateWithGoals([makeGoal({ status: "failed" })]));
    expect(result.resolution).not.toBe("week_limit_reached");
  });
});
