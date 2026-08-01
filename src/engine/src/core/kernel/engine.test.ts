import { describe, it, expect } from "vitest";
import { createEngine } from "./engine.js";
import type {
  AdvanceResult,
  AvailableAction,
  GameState,
  InitialStateResult,
  Kind,
  KindRegistry,
  SceneBody,
} from "./types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ValidationResult } from "../validation/types.js";
import type { EngineHost } from "../composition/types.js";
import { createRecordingEmitter, nullEmitter } from "../observability/emitter.js";
import type { GameEvent } from "../observability/types.js";

interface TestKindState {
  counter: number;
}

function makeTestKind(overrides?: Partial<Kind<TestKindState>>): Kind<TestKindState> {
  return {
    id: "story-graph",
    version: "1.0.0",
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
    ...overrides,
  };
}

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  return {
    id: "test-campaign",
    kindId: "story-graph",
    version: "1",
    titleKey: "test.title",
    content: {},
    ...overrides,
  };
}

function makeRegistry(campaigns: Campaign[] = [makeCampaign()]): ContentRegistry {
  return { campaigns: new Map(campaigns.map((c) => [c.id, c])), strings: new Map() };
}

/**
 * `KindRegistry` (kernel/types.ts) is a total `Record<KindId, Kind<unknown>>` — it
 * structurally requires all three kind ids, even though the MVP registers only
 * `story-graph`. Real composition code will hit this same wall; flagged for a follow-up,
 * not fixed here (kernel/types.ts is committed W1 output, out of this unit's scope).
 */
function makeKinds(kind: Kind<TestKindState> = makeTestKind()): KindRegistry {
  return { "story-graph": kind } as unknown as KindRegistry;
}

function makeHost(overrides?: Partial<EngineHost>): EngineHost {
  return { kinds: makeKinds(), registry: makeRegistry(), ...overrides };
}

describe("createGame", () => {
  it("assembles a fresh envelope with an empty action log", () => {
    const engine = createEngine(makeHost());
    const result = engine.createGame({ campaignId: "test-campaign" });
    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("active");
    expect(result.value?.kindId).toBe("story-graph");
    expect(result.value?.campaignId).toBe("test-campaign");
    expect(result.value?.campaignVersion).toBe("1");
    expect(result.value?.actionLog).toEqual([]);
    expect(result.value?.formatVersion).toBe(1);
    expect(typeof result.value?.gameId).toBe("string");
    expect(typeof result.value?.seed).toBe("string");
  });

  it("uses the given seed when one is supplied", () => {
    const engine = createEngine(makeHost());
    const result = engine.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
    expect(result.value?.seed).toBe("fixed-seed");
  });

  it("rejects an unknown campaign", () => {
    const engine = createEngine(makeHost());
    const result = engine.createGame({ campaignId: "does-not-exist" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_campaign");
  });

  it("rejects a campaign whose kind isn't registered", () => {
    const simCampaign = makeCampaign({ id: "sim-campaign", kindId: "simulation" });
    const engine = createEngine(makeHost({ registry: makeRegistry([simCampaign]) }));
    const result = engine.createGame({ campaignId: "sim-campaign" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_kind");
  });

  it("reports status: ended when the kind settles at start", () => {
    const settlingKind = makeTestKind({
      initialState: (): InitialStateResult<TestKindState> => ({
        state: { counter: 0 },
        status: "ended",
        changes: [],
        messages: [],
      }),
    });
    const engine = createEngine(makeHost({ kinds: makeKinds(settlingKind) }));
    const result = engine.createGame({ campaignId: "test-campaign" });
    expect(result.value?.status).toBe("ended");
    expect(result.value?.actionLog).toEqual([]);
  });
});

describe("submitAction", () => {
  it("appends exactly one monotonic LoggedAction per successful action", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;

    const first = engine.submitAction(state, "increment");
    expect(first.ok).toBe(true);
    expect(first.value?.actionLog).toEqual([{ seq: 0, actionId: "increment" }]);

    const second = engine.submitAction(first.value as GameState, "increment");
    expect(second.ok).toBe(true);
    expect(second.value?.actionLog).toEqual([
      { seq: 0, actionId: "increment" },
      { seq: 1, actionId: "increment" },
    ]);
  });

  it("leaves serialized state byte-identical on a rejected action", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;
    const before = engine.serialize(state);

    const result = engine.submitAction(state, "totally-unrecognized");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");

    const after = engine.serialize(state);
    expect(after).toBe(before);
  });

  it("never mutates the input state", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;
    const before = engine.serialize(state);

    const result = engine.submitAction(state, "increment");

    expect(engine.serialize(state)).toBe(before);
    expect(result.value).not.toBe(state);
  });

  it("rejects an action on an ended session without calling the kind", () => {
    let advanceCalls = 0;
    const countingKind = makeTestKind({
      advance: (state, actionId, params, ctx): AdvanceResult<TestKindState> => {
        advanceCalls += 1;
        return makeTestKind().advance(state, actionId, params, ctx);
      },
    });
    const engine = createEngine(makeHost({ kinds: makeKinds(countingKind) }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    const endedState: GameState = { ...(created.value as GameState), status: "ended" };

    const result = engine.submitAction(endedState, "increment");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("session_ended");
    expect(advanceCalls).toBe(0);
  });

  it("rejects submitAction on a state whose kindId isn't registered", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const foreignState: GameState = { ...(created.value as GameState), kindId: "world-graph" };

    const result = engine.submitAction(foreignState, "increment");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_kind");
  });

  it("rejects submitAction on a state whose campaignId isn't registered", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const foreignState: GameState = { ...(created.value as GameState), campaignId: "gone" };

    const result = engine.submitAction(foreignState, "increment");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_campaign");
  });

  it("surfaces the kind's own unknown_action rejection", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const result = engine.submitAction(created.value as GameState, "nope");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});

describe("read paths (scene, availableActions, view)", () => {
  it("scene, availableActions, and view derive ctx from a system:view stream distinct from the action stream", () => {
    const rollingKind = makeTestKind({
      scene: (_state, ctx): SceneBody => ({ textKey: "x", text: String(ctx.rng.nextInt(0, 1_000_000)) }),
      advance: (_state, actionId, _params, ctx): AdvanceResult<TestKindState> => {
        if (actionId === "roll") {
          return { state: { counter: ctx.rng.nextInt(0, 1_000_000) }, status: "active", changes: [], messages: [] };
        }
        return makeTestKind().advance(_state, actionId, _params, ctx);
      },
    });
    const engine = createEngine(makeHost({ kinds: makeKinds(rollingKind) }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;

    const viewDraw = Number(engine.scene(state).body.text);
    const actionResult = engine.submitAction(state, "roll");
    const actionDraw = (actionResult.value?.kindState as TestKindState).counter;

    expect(viewDraw).not.toBe(actionDraw);
  });

  it("view narrows kindState through Kind.project", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;
    const playerView = engine.view(state, "player");
    expect(playerView.gameId).toBe(state.gameId);
    expect(playerView.status).toBe("active");
    expect(playerView.kindView).toEqual({ counter: 0 });
  });

  it("scene bundles body, actions, and view", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const scene = engine.scene(created.value as GameState);
    expect(scene.body.text).toBe("counter=0");
    expect(scene.actions).toEqual([{ id: "increment", labelKey: "test.increment", available: true }]);
    expect(scene.view.kindView).toEqual({ counter: 0 });
  });
});

describe("serialize / deserialize / migrate", () => {
  it("round-trips a valid envelope", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const state = created.value as GameState;
    const data = engine.serialize(state);
    const result = engine.deserialize(data);
    expect(result.ok).toBe(true);
    expect(engine.serialize(result.value as GameState)).toBe(data);
  });

  it("rejects truncated JSON", () => {
    const engine = createEngine(makeHost());
    const result = engine.deserialize('{"formatVersion":1,');
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects valid JSON missing a required field", () => {
    const engine = createEngine(makeHost());
    const result = engine.deserialize(JSON.stringify({ formatVersion: 1, gameId: "g1" }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects an unknown kindId", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["kindId"] = "not-a-real-kind";
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects an invalid status", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["status"] = "paused";
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects an unsupported formatVersion", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["formatVersion"] = 2;
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects an actionLog with a gap in seq", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["actionLog"] = [{ seq: 0, actionId: "increment" }, { seq: 2, actionId: "increment" }];
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_state");
  });

  it("rejects an actionLog with a negative or non-integer seq", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["actionLog"] = [{ seq: -1, actionId: "increment" }];
    expect(engine.deserialize(JSON.stringify(raw)).ok).toBe(false);

    raw["actionLog"] = [{ seq: 0.5, actionId: "increment" }];
    expect(engine.deserialize(JSON.stringify(raw)).ok).toBe(false);
  });

  it("rejects a shape-valid envelope whose campaign isn't in this host's registry", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["campaignId"] = "some-other-campaign";
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_campaign");
  });

  it("rejects a shape-valid envelope whose kind isn't registered on this host", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const raw = JSON.parse(engine.serialize(created.value as GameState)) as Record<string, unknown>;
    raw["kindId"] = "simulation";
    const result = engine.deserialize(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_kind");
  });

  it("never throws on malformed input", () => {
    const engine = createEngine(makeHost());
    expect(() => engine.deserialize("not json at all")).not.toThrow();
    expect(() => engine.deserialize("null")).not.toThrow();
    expect(() => engine.deserialize("42")).not.toThrow();
  });

  it("migrate passes a valid envelope through deserialize", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign" });
    const data = engine.serialize(created.value as GameState);
    const result = engine.migrate(data);
    expect(result.ok).toBe(true);
    expect(result.value?.gameId).toBe(created.value?.gameId);
  });
});

describe("observability", () => {
  // A fixed IdSource, not just a fixed seed: gameId comes from crypto.randomUUID() by
  // default (composition/defaults.ts) regardless of seed, so two runs being compared
  // byte-for-byte need the same gameId too (06-extensibility.md §5.1 — "with a counting
  // IdSource, a fixture produces the same envelope every run, including gameId").
  const fixedIds = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

  function runFixture(emitter: EngineHost["emitter"]): string {
    const engine = createEngine(makeHost({ ids: fixedIds, ...(emitter ? { emitter } : {}) }));
    const created = engine.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
    const afterFirst = engine.submitAction(created.value as GameState, "increment");
    const afterSecond = engine.submitAction(afterFirst.value as GameState, "end");
    return engine.serialize(afterSecond.value as GameState);
  }

  it("sink independence: nullEmitter and a recordingEmitter produce byte-identical serialize() output", () => {
    const withoutRecording = runFixture(nullEmitter);
    const withRecording = runFixture(createRecordingEmitter());
    expect(withRecording).toBe(withoutRecording);
  });

  it("stream reproducibility: the same fixture replayed twice under recordingEmitter yields the identical event sequence modulo gameId", () => {
    const firstRecorder = createRecordingEmitter();
    runFixture(firstRecorder);
    const secondRecorder = createRecordingEmitter();
    runFixture(secondRecorder);

    const normalize = (events: readonly GameEvent[]) =>
      events.map((event) => {
        const clone: Record<string, unknown> = { ...event };
        delete clone["gameId"];
        return clone;
      });
    const gameEvents = (recorder: ReturnType<typeof createRecordingEmitter>) =>
      recorder.events.filter((e): e is GameEvent => e.scope === "game");

    expect(normalize(gameEvents(firstRecorder))).toEqual(normalize(gameEvents(secondRecorder)));
  });

  it("ordinals restart at 0 on each resolution", () => {
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: recorder }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    const afterFirst = engine.submitAction(created.value as GameState, "increment");
    engine.submitAction(afterFirst.value as GameState, "increment");

    const bySeq = new Map<number, number[]>();
    for (const event of recorder.events) {
      if (event.scope !== "game") continue;
      const list = bySeq.get(event.seq) ?? [];
      list.push(event.ordinal);
      bySeq.set(event.seq, list);
    }
    expect(bySeq.size).toBeGreaterThan(1);
    for (const ordinals of bySeq.values()) {
      expect(ordinals[0]).toBe(0);
    }
  });

  it("core.deserialize.rejected is scope: system and carries no gameId", () => {
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: recorder }));
    engine.deserialize("not json");
    const [event] = recorder.events;
    expect(event?.scope).toBe("system");
    expect(event?.name).toBe("core.deserialize.rejected");
    expect(event && "gameId" in event).toBe(false);
  });

  it("omits actionId for an unresolved action, includes it for a resolved-but-rejected one", () => {
    const rejectingKind = makeTestKind({
      advance: (state, actionId): AdvanceResult<TestKindState> => {
        if (actionId === "gated") {
          return {
            state,
            status: "active",
            changes: [],
            messages: [],
            error: { code: "requirement_unmet", messageKey: "core.reason.requirement_unmet" },
          };
        }
        return {
          state,
          status: "active",
          changes: [],
          messages: [],
          error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
        };
      },
    });
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ kinds: makeKinds(rejectingKind), emitter: recorder }));
    const state = engine.createGame({ campaignId: "test-campaign" }).value as GameState;

    engine.submitAction(state, "totally-unknown");
    engine.submitAction(state, "gated");

    const rejected = recorder.events.filter((e) => e.name === "core.action.rejected") as GameEvent[];
    expect(rejected[0]?.data).toBeUndefined();
    expect(rejected[1]?.data).toEqual({ actionId: "gated" });
  });

  it("createEngine rejects a kind whose eventNames escape its own namespace", () => {
    const badKind = makeTestKind({ eventNames: ["kind.wrong-kind.foo"] });
    expect(() => createEngine(makeHost({ kinds: makeKinds(badKind) }))).toThrow();
  });

  it("a kind's own ctx.emit reaches the sink with kindId stamped", () => {
    const emittingKind = makeTestKind({
      eventNames: ["kind.story-graph.tested"],
      advance: (state, actionId, _params, ctx): AdvanceResult<TestKindState> => {
        ctx.emit.emit("kind.story-graph.tested", "debug");
        if (actionId === "increment") {
          return { state: { counter: state.counter + 1 }, status: "active", changes: [], messages: [] };
        }
        return { state, status: "ended", changes: [], messages: [] };
      },
    });
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ kinds: makeKinds(emittingKind), emitter: recorder }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    engine.submitAction(created.value as GameState, "increment");

    const kindEvents = recorder.events.filter((e) => e.name === "kind.story-graph.tested") as GameEvent[];
    expect(kindEvents).toHaveLength(1);
    expect(kindEvents[0]?.kindId).toBe("story-graph");
  });

  it("a sink that throws on every call does not fail a game", () => {
    const throwingEmitter = {
      emit: () => {
        throw new Error("boom");
      },
    };
    const throwing = createEngine(makeHost({ ids: fixedIds, emitter: throwingEmitter }));
    const clean = createEngine(makeHost({ ids: fixedIds }));

    const createdThrowing = throwing.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
    const createdClean = clean.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
    expect(createdThrowing.ok).toBe(true);

    const afterThrowing = throwing.submitAction(createdThrowing.value as GameState, "increment");
    const afterClean = clean.submitAction(createdClean.value as GameState, "increment");
    expect(afterThrowing.ok).toBe(true);
    expect(throwing.serialize(afterThrowing.value as GameState)).toBe(clean.serialize(afterClean.value as GameState));
  });

  it("emits core.game.created with campaign identity and core.action.accepted with actionId", () => {
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: recorder }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    engine.submitAction(created.value as GameState, "increment");

    const createdEvent = recorder.events.find((e) => e.name === "core.game.created") as GameEvent | undefined;
    expect(createdEvent?.data).toEqual({
      campaignId: "test-campaign",
      campaignVersion: "1",
      kindId: "story-graph",
    });

    const acceptedEvent = recorder.events.find((e) => e.name === "core.action.accepted") as GameEvent | undefined;
    expect(acceptedEvent?.data).toEqual({ actionId: "increment" });
  });

  it("emits core.game.ended when an action ends the game", () => {
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: recorder }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    engine.submitAction(created.value as GameState, "end");

    expect(recorder.events.some((e) => e.name === "core.game.ended")).toBe(true);
  });

  it("scene() uses one read context for body, actions, and its bundled view — not two", () => {
    const recorder = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: recorder }));
    const created = engine.createGame({ campaignId: "test-campaign" });
    const before = recorder.events.length;
    engine.scene(created.value as GameState);
    const rngDerivedDuringScene = recorder.events.slice(before).filter((e) => e.name === "core.rng.stream.derived");

    // A single read context derives ctx.rng exactly once; a second, independent context
    // built via a nested view() call would double this and also restart the ordinal
    // sequence at 0 a second time within the same logical scene() call.
    expect(rngDerivedDuringScene).toHaveLength(1);
    expect(rngDerivedDuringScene[0]?.ordinal).toBe(0);
  });
});

describe("withEmitter", () => {
  it("redirects emitted events to the new emitter, not the original one", () => {
    const original = createRecordingEmitter();
    const swapped = createRecordingEmitter();
    const engine = createEngine(makeHost({ emitter: original }));
    const rebound = engine.withEmitter(swapped);

    const created = rebound.createGame({ campaignId: "test-campaign" });
    rebound.submitAction(created.value as GameState, "increment");

    expect(original.events).toEqual([]);
    expect(swapped.events.length).toBeGreaterThan(0);
  });

  it("leaves game-affecting behaviour unchanged by the swap", () => {
    const engine = createEngine(makeHost({ ids: { newGameId: () => "g", newSeed: () => "s" } }));
    const rebound = engine.withEmitter(createRecordingEmitter());

    const viaOriginal = engine.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
    const viaRebound = rebound.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });

    expect(engine.serialize(viaRebound.value as GameState)).toBe(engine.serialize(viaOriginal.value as GameState));
  });
});
