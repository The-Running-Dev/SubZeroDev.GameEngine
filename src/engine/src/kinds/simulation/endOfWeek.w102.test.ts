/**
 * W102 — the `events` system advancing `EventChainState` (§2.2, §7.13, §10).
 *
 * Contract: `10-simulation-kind.md` §2.2 (`EventChainState`, `ChainScope`), §7.13
 * (`EventChainDefinition`), §10 (`chain_advanced`/`profile_chain_advanced`).
 *
 * Kept in its own file for the same reason `endOfWeek.w57.test.ts` is: real `world` content
 * and a real `RngHandle`, not `endOfWeek.test.ts`'s minimal fixture.
 */

import { describe, it, expect } from "vitest";
import { runEndOfWeek } from "./endOfWeek.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { NeedState } from "./actor.js";
import type { EventChainDefinition, EventDefinition, GoalDefinition } from "./content.js";
import type { SimulationKindState } from "./state.js";

const NO_GOALS: readonly GoalDefinition[] = [];
const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

function silentEmitter(): ResolutionEmitter {
  return { emit: () => undefined };
}

function baseState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      needs: { ...NEEDS },
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { weeklyCostCents: 0 },
      finances: { cashCents: 0 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      skills: {},
      flags: {},
      counters: {},
      inventory: [],
      relationships: [],
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {
      npcs: [], locations: [], agents: [], flags: {},
      jobMarket: { openings: [] },
      eventCooldowns: {}, firedUniqueEvents: [], chainStates: [],
      strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 },
    },
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

function run(state: SimulationKindState, world: Parameters<typeof runEndOfWeek>[7]): ReturnType<typeof runEndOfWeek> {
  return runEndOfWeek(state, silentEmitter(), NO_GOALS, "goals_win", [], [], [], world);
}

type EventDefOverrides = { [K in keyof EventDefinition]?: EventDefinition[K] | undefined };

function eventDef(overrides: EventDefOverrides = {}): EventDefinition {
  const base: EventDefinition = {
    id: "event-1",
    category: "test",
    titleKey: "k.title",
    descriptionKey: "k.desc",
    weight: 1,
    conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
    unique: true,
    automaticOutcome: { effects: [], messages: [], advancesChain: true },
    tags: [],
  };
  return { ...base, ...overrides } as EventDefinition;
}

describe("events — advancing a chain (W102)", () => {
  it("creates a game-scoped EventChainState on its first advance, and emits chain_advanced", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    const eventChains: readonly EventChainDefinition[] = [{ id: "eviction", scope: "game" }];
    const def = eventDef({ chainId: "eviction", chainStep: 1 });
    const result = run(state, { events: [def], eventChains });

    expect(result.state.world.chainStates).toEqual([
      { chainId: "eviction", scope: "game", currentStep: 1, startedWeek: 5, active: true },
    ]);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ path: "chain.eviction", reason: "chain_advanced", value: 1, visible: true }),
    );
  });

  it("advances an existing chain's currentStep as a maximum, and emits profile_chain_advanced for a profile-scoped chain", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
      world: {
        ...baseState().world,
        chainStates: [{ chainId: "saga", scope: "profile", currentStep: 1, startedWeek: 0, active: false }],
      },
    });
    const eventChains: readonly EventChainDefinition[] = [{ id: "saga", scope: "profile" }];
    const def = eventDef({ chainId: "saga", chainStep: 2 });
    const result = run(state, { events: [def], eventChains });

    expect(result.state.world.chainStates).toEqual([
      { chainId: "saga", scope: "profile", currentStep: 2, startedWeek: 5, active: true },
    ]);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ path: "chain.saga", reason: "profile_chain_advanced", value: 2, visible: true }),
    );
  });

  it("does not advance the chain when the fired outcome doesn't declare advancesChain", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    const eventChains: readonly EventChainDefinition[] = [{ id: "eviction", scope: "game" }];
    const def = eventDef({ chainId: "eviction", chainStep: 1, automaticOutcome: { effects: [], messages: [] } });
    const result = run(state, { events: [def], eventChains });

    expect(result.state.world.chainStates).toEqual([]);
    expect(result.changes.some((c) => c.reason === "chain_advanced" || c.reason === "profile_chain_advanced")).toBe(false);
  });

  it("never regresses currentStep — a lower chainStep firing after a higher one leaves the maximum in place", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
      world: {
        ...baseState().world,
        chainStates: [{ chainId: "eviction", scope: "game", currentStep: 5, startedWeek: 2, active: true }],
      },
    });
    const eventChains: readonly EventChainDefinition[] = [{ id: "eviction", scope: "game" }];
    const def = eventDef({ chainId: "eviction", chainStep: 1 });
    const result = run(state, { events: [def], eventChains });

    expect(result.state.world.chainStates).toEqual([
      { chainId: "eviction", scope: "game", currentStep: 5, startedWeek: 2, active: true },
    ]);
  });

  it("treats an unresolvable chain scope as game-scoped, defensively", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    const def = eventDef({ chainId: "unknown-chain", chainStep: 1 });
    const result = run(state, { events: [def], eventChains: [] });

    expect(result.state.world.chainStates).toEqual([
      { chainId: "unknown-chain", scope: "game", currentStep: 1, startedWeek: 5, active: true },
    ]);
  });
});
