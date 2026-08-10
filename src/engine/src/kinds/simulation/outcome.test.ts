import { describe, it, expect } from "vitest";
import { outcome } from "./outcome.js";
import type { SimulationResolution, SimulationKindState } from "./state.js";

/**
 * W57 moved the decision out of this function. `outcome` no longer derives a resolution
 * from `goals` — `endOfWeek.ts`'s `failure` and `week_limit` systems decide it while the
 * campaign is still in scope, and this reads the record back (§12). The tests therefore
 * assert the projection, and the *deciding* is covered in `endOfWeek.test.ts`.
 */
function stateWith(resolution: SimulationResolution | null): SimulationKindState {
  return { resolution, goals: [] } as unknown as SimulationKindState;
}

describe("outcome", () => {
  it("returns resolution null while the game is live", () => {
    expect(outcome(stateWith(null))).toEqual({ resolution: null, goalsMet: [], goalsFailed: [] });
  });

  it("reads goals_met back verbatim, ids and all", () => {
    const result = outcome(stateWith({
      resolution: "goals_met", goalsMet: ["apple", "zebra"], goalsFailed: [], resolvedAtWeek: 6,
    }));
    expect(result).toEqual({ resolution: "goals_met", goalsMet: ["apple", "zebra"], goalsFailed: [] });
  });

  it("reads failed back verbatim, carrying both id lists", () => {
    const result = outcome(stateWith({
      resolution: "failed", goalsMet: ["zebra"], goalsFailed: ["apple"], resolvedAtWeek: 4,
    }));
    expect(result).toEqual({ resolution: "failed", goalsMet: ["zebra"], goalsFailed: ["apple"] });
  });

  it("returns week_limit_reached — the third terminal path, reachable since W57", () => {
    const result = outcome(stateWith({
      resolution: "week_limit_reached", goalsMet: [], goalsFailed: [], resolvedAtWeek: 12,
    }));
    expect(result).toEqual({ resolution: "week_limit_reached", goalsMet: [], goalsFailed: [] });
  });

  it("never reconstructs a resolution from goals — a decided-nothing state stays null", () => {
    const undecided = { resolution: null, goals: [{ definitionId: "a", status: "failed" }] } as unknown as SimulationKindState;
    expect(outcome(undecided).resolution).toBeNull();
  });

  it("does not leak resolvedAtWeek — §12 fixes three fields on the oracle's shape", () => {
    const result = outcome(stateWith({
      resolution: "goals_met", goalsMet: [], goalsFailed: [], resolvedAtWeek: 9,
    }));
    expect(Object.keys(result).sort()).toEqual(["goalsFailed", "goalsMet", "resolution"]);
  });
});
