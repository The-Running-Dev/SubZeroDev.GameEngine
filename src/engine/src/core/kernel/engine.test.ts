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

interface TestKindState {
  counter: number;
}

function makeTestKind(overrides?: Partial<Kind<TestKindState>>): Kind<TestKindState> {
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
