import { describe, it, expect } from "vitest";
import { runFixture, traceFixture, type PlaythroughFixture } from "./harness.js";
import { createEngine } from "../kernel/engine.js";
import type {
  AdvanceResult,
  AvailableAction,
  InitialStateResult,
  Kind,
  KindRegistry,
  ResolutionArchive,
  SceneBody,
} from "../kernel/types.js";
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
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(),
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
    validateState: () => true,
    outcome: (state) => ({ terminal: false, terminalId: null, counter: state.counter }),
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

describe("S130.5 — the harness replays across an epoch", () => {
  // Two epochs of the campaign, and a kind that adopts by adding 1000 — except onto "3",
  // which it refuses, so a fixture recorded before the kind changed its mind now fails.
  function epoch(version: string): ContentRegistry {
    const campaign: Campaign = { id: "test-campaign", kindId: "story-graph", version, titleKey: "test.title", content: {} };
    return { campaigns: new Map([["test-campaign", campaign]]), strings: new Map() };
  }
  const epochs = new Map([["1", epoch("1")], ["2", epoch("2")], ["3", epoch("3")]]);
  const archive: ResolutionArchive = {
    resolve: (id, version) => (id === "test-campaign" ? epochs.get(version) : undefined),
  };
  const adoptingKind: Kind<TestKindState> = {
    ...makeTestKind(),
    adoptContent: (state, _from, to) =>
      to.version === "3" ? { adopt: false, reason: "content_incompatible" } : { adopt: true, state: { counter: state.counter + 1000 } },
  };
  function epochEngine() {
    const kinds = { "story-graph": adoptingKind } as unknown as KindRegistry;
    // The default epoch is "2": the fixture's own log, not the host's default, decides where it starts.
    return createEngine({ kinds, registry: epochs.get("2")!, archive, ids: FIXED_IDS });
  }
  const crossing: PlaythroughFixture = {
    name: "crosses from 1 to 2",
    config: { campaignId: "test-campaign", seed: "fixed-seed" },
    actionLog: [
      { seq: 0, actionId: "increment" },
      { seq: 1, system: "content", from: "1", to: "2" },
      { seq: 2, actionId: "increment" },
    ],
  };

  it("starts on the first epoch entry's from and serializes byte-identically after every entry across two runs", () => {
    const first = traceFixture(epochEngine(), crossing);
    const second = traceFixture(epochEngine(), crossing);

    expect(first).toHaveLength(4);
    expect(second).toEqual(first);
    const states = first.map((blob) => JSON.parse(blob) as { campaignVersion: string; formatVersion: number; kindState: TestKindState });
    expect(states.map((s) => s.campaignVersion)).toEqual(["1", "1", "2", "2"]);
    expect(states.map((s) => s.formatVersion)).toEqual([1, 1, 2, 2]);
    expect(states.map((s) => s.kindState.counter)).toEqual([0, 1, 1001, 1002]);
    expect(runFixture(epochEngine(), crossing)).toBe(first[3]);
  });

  it("the replayed log is the fixture's log", () => {
    const final = JSON.parse(runFixture(epochEngine(), crossing)) as { actionLog: unknown[] };
    expect(final.actionLog).toEqual(crossing.actionLog);
  });

  it("fails the fixture when a content entry now refuses", () => {
    const refused: PlaythroughFixture = {
      ...crossing,
      name: "crosses onto 3",
      actionLog: [{ seq: 0, system: "content", from: "1", to: "3" }],
    };
    expect(() => runFixture(epochEngine(), refused)).toThrow(/adoptContent\("3"\) refused — content_incompatible/);
  });

  it("fails the fixture when a content entry moves from an epoch the replay is not on", () => {
    const mismatched: PlaythroughFixture = {
      ...crossing,
      name: "skips an epoch",
      actionLog: [
        { seq: 0, system: "content", from: "1", to: "2" },
        { seq: 1, system: "content", from: "1", to: "3" },
      ],
    };
    expect(() => runFixture(epochEngine(), mismatched)).toThrow(/moves from "1", but the replay is on "2"/);
  });

  it("fails the fixture on any migration entry", () => {
    const migrated: PlaythroughFixture = {
      ...crossing,
      name: "carries a migration",
      actionLog: [
        { seq: 0, system: "content", from: "1", to: "2" },
        { seq: 1, system: "migration", from: "2", to: "3" },
      ],
    };
    expect(() => runFixture(epochEngine(), migrated)).toThrow(/a migration entry at seq 1 cannot be replayed/);
  });
});
