import { describe, it, expect } from "vitest";
import { runFixture, type PlaythroughFixture } from "./harness.js";
import { createEngine } from "../kernel/engine.js";
import type { AdvanceResult, AvailableAction, InitialStateResult, Kind, KindRegistry, SceneBody } from "../kernel/types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ValidationResult } from "../validation/types.js";
import type { EngineHost, IdSource } from "../composition/types.js";

// gameId comes from crypto.randomUUID() by default (composition/defaults.ts), regardless
// of the fixture's own seed -- two independent createGame calls being compared byte-for-
// byte need a fixed IdSource too (06-extensibility.md §5.1), the same fixture requirement
// engine.test.ts's own observability tests already establish.
const FIXED_IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

interface TestKindState {
  counter: number;
}

function makeTestKind(): Kind<TestKindState> {
  return {
    id: "story-graph",
    reasonCodes: [],
    eventNames: [],
    initialState: (): InitialStateResult<TestKindState> => ({
      state: { counter: 0 },
      status: "active",
      changes: [],
      messages: [],
    }),
    availableActions: (): AvailableAction[] => [{ id: "increment", labelKey: "test.increment", available: true }],
    scene: (state): SceneBody => ({ textKey: "test.scene", text: `counter=${state.counter}` }),
    advance: (state, actionId): AdvanceResult<TestKindState> => {
      if (actionId === "increment") {
        return { state: { counter: state.counter + 1 }, status: "active", changes: [], messages: [] };
      }
      if (actionId === "end") {
        return { state, status: "ended", changes: [], messages: [] };
      }
      return {
        state,
        status: "active",
        changes: [],
        messages: [],
        error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
      };
    },
    project: (state) => ({ counter: state.counter }),
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    outcome: (state) => ({ counter: state.counter }),
  };
}

function makeHost(ids?: IdSource): EngineHost {
  const campaign: Campaign = { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {} };
  const registry: ContentRegistry = { campaigns: new Map([["test-campaign", campaign]]), strings: new Map() };
  const kinds = { "story-graph": makeTestKind() } as unknown as KindRegistry;
  return { kinds, registry, ...(ids ? { ids } : {}) };
}

describe("runFixture", () => {
  it("runs createGame -> submitAction* -> serialize, returning the final serialized state", () => {
    const engine = createEngine(makeHost());
    const fixture: PlaythroughFixture = {
      name: "two increments then end",
      config: { campaignId: "test-campaign", seed: "fixed-seed" },
      actionLog: [
        { seq: 0, actionId: "increment" },
        { seq: 1, actionId: "increment" },
        { seq: 2, actionId: "end" },
      ],
    };

    const serialized = runFixture(engine, fixture);
    const parsed = JSON.parse(serialized) as { status: string; kindState: TestKindState; actionLog: unknown[] };
    expect(parsed.status).toBe("ended");
    expect(parsed.kindState.counter).toBe(2);
    expect(parsed.actionLog).toHaveLength(3);
  });

  it("does not consult a LoggedAction's own seq — submitAction assigns it from the state it's handed", () => {
    const engine = createEngine(makeHost());
    const fixture: PlaythroughFixture = {
      name: "seq is ignored",
      config: { campaignId: "test-campaign", seed: "fixed-seed" },
      // Deliberately wrong/out-of-order seq values.
      actionLog: [
        { seq: 41, actionId: "increment" },
        { seq: 7, actionId: "increment" },
      ],
    };

    const serialized = runFixture(engine, fixture);
    const parsed = JSON.parse(serialized) as { actionLog: { seq: number }[] };
    expect(parsed.actionLog.map((a) => a.seq)).toEqual([0, 1]);
  });

  it("the same fixture run twice produces byte-identical serialize() output", () => {
    const engine = createEngine(makeHost(FIXED_IDS));
    const fixture: PlaythroughFixture = {
      name: "repeatable",
      config: { campaignId: "test-campaign", seed: "fixed-seed" },
      actionLog: [{ seq: 0, actionId: "increment" }],
    };

    expect(runFixture(engine, fixture)).toBe(runFixture(engine, fixture));
  });

  it("throws, naming the fixture, when config.seed is missing — even past the type system", () => {
    // The type requires `seed`, so this can only happen via untyped data (JSON, an `as`
    // cast) — simulated here the same way, to prove the runtime backstop actually fires
    // rather than trusting the type alone.
    const engine = createEngine(makeHost());
    const fixture = {
      name: "no seed",
      config: { campaignId: "test-campaign" },
      actionLog: [],
    } as unknown as PlaythroughFixture;

    expect(() => runFixture(engine, fixture)).toThrow(/no seed/);
    expect(() => runFixture(engine, fixture)).toThrow(/config\.seed is required/);
  });

  it("throws when config.seed is explicitly null — createGame's own `??` treats null and undefined alike", () => {
    // `config.seed ?? ids.newSeed()` (kernel/engine.ts) is nullish coalescing, not an
    // `undefined` check, so a guard that only rejected `undefined` would still let a
    // null seed reach a random fallback silently.
    const engine = createEngine(makeHost());
    const fixture = {
      name: "null seed",
      config: { campaignId: "test-campaign", seed: null },
      actionLog: [],
    } as unknown as PlaythroughFixture;

    expect(() => runFixture(engine, fixture)).toThrow(/null seed/);
    expect(() => runFixture(engine, fixture)).toThrow(/config\.seed is required/);
  });

  it("throws, naming the fixture, when createGame rejects", () => {
    const engine = createEngine(makeHost());
    const fixture: PlaythroughFixture = {
      name: "unknown campaign",
      config: { campaignId: "does-not-exist", seed: "fixed-seed" },
      actionLog: [],
    };

    expect(() => runFixture(engine, fixture)).toThrow(/unknown campaign/);
    expect(() => runFixture(engine, fixture)).toThrow(/unknown_campaign/);
  });

  it("throws, naming the fixture and the failing action, when a submitAction rejects", () => {
    const engine = createEngine(makeHost());
    const fixture: PlaythroughFixture = {
      name: "bad action mid-arc",
      config: { campaignId: "test-campaign", seed: "fixed-seed" },
      actionLog: [
        { seq: 0, actionId: "increment" },
        { seq: 1, actionId: "totally_fake" },
      ],
    };

    expect(() => runFixture(engine, fixture)).toThrow(/bad action mid-arc/);
    expect(() => runFixture(engine, fixture)).toThrow(/totally_fake/);
  });
});

describe("deserialize(serialize(state)) round-trips", () => {
  it("a fixture's final state survives a serialize/deserialize round trip, deep-equal", () => {
    const engine = createEngine(makeHost());
    const fixture: PlaythroughFixture = {
      name: "round trip",
      config: { campaignId: "test-campaign", seed: "fixed-seed" },
      actionLog: [{ seq: 0, actionId: "increment" }],
    };

    const serialized = runFixture(engine, fixture);
    const result = engine.deserialize(serialized);
    expect(result.ok).toBe(true);
    expect(engine.serialize(result.value!)).toBe(serialized);
  });
});
