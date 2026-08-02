import { describe, it, expect } from "vitest";
import { runEndOfWeek } from "./endOfWeek.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { NeedState } from "./actor.js";
import type { Opportunity, SimulationKindState } from "./state.js";

function recordingEmitter(): { emit: ResolutionEmitter; systems: string[] } {
  const systems: string[] = [];
  return {
    emit: {
      emit: (name, _severity, detail) => {
        if (name === "kind.simulation.system.ran") systems.push(String(detail?.data?.["system"]));
      },
    },
    systems,
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
    player: { needs } as SimulationKindState["player"],
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

describe("runEndOfWeek — needs drift", () => {
  it("drifts every need toward its provisional weekly rate", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    const result = runEndOfWeek(state, emit);
    expect(result.state.player.needs).toEqual({ health: 49, energy: 47, happiness: 48, stress: 52, satiety: 46 });
  });

  it("clamps at 0 rather than going negative", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 0, energy: 1, happiness: 0, stress: 0, satiety: 2 });
    const result = runEndOfWeek(state, emit);
    expect(result.state.player.needs.energy).toBe(0);
    expect(result.state.player.needs.satiety).toBe(0);
  });

  it("clamps at 100 rather than exceeding it", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 100, energy: 100, happiness: 100, stress: 99, satiety: 100 });
    const result = runEndOfWeek(state, emit);
    expect(result.state.player.needs.stress).toBe(100);
  });

  it("emits one StateChange per touched need, sorted by need name", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    const result = runEndOfWeek(state, emit);
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
    const result = runEndOfWeek(state, emit);
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
    const result = runEndOfWeek(state, emit);
    expect(result.state.activeOpportunities).toEqual([]);
  });

  it("keeps an opportunity whose expiresAtWeek is still in the future", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 }, {
      activeOpportunities: [makeOpportunity({ id: "open", expiresAtWeek: 10 })],
    });
    const result = runEndOfWeek(state, emit);
    expect(result.state.activeOpportunities.map((o) => o.id)).toEqual(["open"]);
  });
});

describe("runEndOfWeek — system ordering", () => {
  it("runs all fourteen systems in the documented order", () => {
    const { emit, systems } = recordingEmitter();
    const state = baseState({ health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 });
    runEndOfWeek(state, emit);
    expect(systems).toEqual([
      "employment", "education", "finance_income", "inventory", "housing",
      "finance_reconcile", "needs", "relationships", "opportunities", "events",
      "headline", "goals", "failure", "achievements",
    ]);
  });
});
