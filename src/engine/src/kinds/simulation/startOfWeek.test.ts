import { describe, it, expect } from "vitest";
import { runStartOfWeek } from "./startOfWeek.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { SimulationKindState, StatusEffect } from "./state.js";

function recordingEmitter(): { emit: ResolutionEmitter; systems: string[]; expiredEffectIds: string[] } {
  const systems: string[] = [];
  const expiredEffectIds: string[] = [];
  return {
    emit: {
      emit: (name, _severity, detail) => {
        if (name === "kind.simulation.system.ran") systems.push(String(detail?.data?.["system"]));
        if (name === "kind.simulation.effect.expired") expiredEffectIds.push(String(detail?.data?.["effectId"]));
      },
    },
    systems,
    expiredEffectIds,
  };
}

function makeEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: "effect-1",
    sourceId: "item-1",
    sourceKind: "item",
    modifiers: [],
    appliedWeek: 1,
    stacking: "refresh",
    descriptionKey: "effect.description",
    visible: true,
    ...overrides,
  };
}

function baseState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 4, spentTimeUnits: 10 },
    player: {} as SimulationKindState["player"],
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

describe("runStartOfWeek", () => {
  it("increments currentWeek and resets spentTimeUnits", () => {
    const { emit } = recordingEmitter();
    const result = runStartOfWeek(baseState(), emit);
    expect(result.calendar.currentWeek).toBe(6);
    expect(result.calendar.spentTimeUnits).toBe(0);
  });

  it("does not reset committedTimeUnits (time_commit is a stub, not a clearing operation)", () => {
    const { emit } = recordingEmitter();
    const result = runStartOfWeek(baseState(), emit);
    expect(result.calendar.committedTimeUnits).toBe(4);
  });

  it("removes an effect whose expiresAtWeek is strictly before the new week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "expired", expiresAtWeek: 5 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects).toEqual([]);
  });

  it("keeps an effect whose expiresAtWeek equals the new week — it still applies throughout that week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "expiring-this-week", expiresAtWeek: 6 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["expiring-this-week"]);
  });

  it("keeps an effect whose expiresAtWeek is still in the future", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "ongoing", expiresAtWeek: 20 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["ongoing"]);
  });

  it("emits effect.expired with the expired effect's id, and nothing for a kept effect", () => {
    const { emit, expiredEffectIds } = recordingEmitter();
    const state = baseState({
      activeEffects: [makeEffect({ id: "expired", expiresAtWeek: 5 }), makeEffect({ id: "kept", expiresAtWeek: 20 })],
    });
    runStartOfWeek(state, emit);
    expect(expiredEffectIds).toEqual(["expired"]);
  });

  it("keeps a permanent effect (no expiresAtWeek) regardless of week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "permanent" })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["permanent"]);
  });

  it("runs the four systems in the documented order: time_advance, effects, time_commit, events", () => {
    const { emit, systems } = recordingEmitter();
    runStartOfWeek(baseState(), emit);
    expect(systems).toEqual(["time_advance", "effects", "time_commit", "events"]);
  });
});
