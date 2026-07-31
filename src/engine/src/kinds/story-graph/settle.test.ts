import { describe, it, expect } from "vitest";
import { SETTLE_STEPS, settle, initialState } from "./settle.js";
import { enter, type StoryGraphKindState } from "./state.js";
import type { Node } from "./nodes.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { VariableSchema } from "./variables.js";
import type { RngHandle } from "../../core/determinism/types.js";
import type { ResolutionEmitter, Severity, EventName, EventData } from "../../core/observability/types.js";
import type { ReasonCode } from "../../core/kernel/reasons.js";
import { rngHandleFor } from "../../core/determinism/rng.js";
import { createEngine } from "../../core/kernel/engine.js";
import type { Kind, KindRegistry, InitialStateResult, AvailableAction, SceneBody, AdvanceResult } from "../../core/kernel/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import type { EngineHost } from "../../core/composition/types.js";

interface RecordedEvent {
  name: EventName;
  severity: Severity;
  reason?: ReasonCode;
  data?: EventData;
}

function recordingEmitter(): { emitter: ResolutionEmitter; events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  return {
    emitter: {
      emit(name, severity, detail) {
        events.push({ name, severity, ...(detail?.reason !== undefined ? { reason: detail.reason } : {}), ...(detail?.data !== undefined ? { data: detail.data } : {}) });
      },
    },
    events,
  };
}

/** Always picks the first item — deterministic, for tests that don't care about the pick itself. */
function fixedRng(): RngHandle {
  return {
    nextInt: () => 0,
    nextPercent: () => 0,
    pick: <T>(items: readonly T[]): T => items[0]!,
    weightedPick: <T>(items: readonly { item: T; weight: number }[]): T => items[0]!.item,
  };
}

const schema: VariableSchema = {
  money: { type: "int", initial: 0, min: 0, max: 3 },
};

function baseState(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "n1",
    variables: { money: 0 },
    turn: 0,
    visitedCounts: {},
    unlockedAchievements: [],
    ...overrides,
  };
}

describe("settle", () => {
  it("an auto chain settles to a choice node, status active", () => {
    const nodes: Record<string, Node> = {
      n1: { id: "n1", kind: "auto", textKey: "t", goto: "n2" },
      n2: { id: "n2", kind: "auto", textKey: "t", goto: "n3" },
      n3: { id: "n3", kind: "choice", textKey: "t", choices: [] },
    };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.status).toBe("active");
    expect(result.state.currentNodeId).toBe("n3");
  });

  it("an auto-then-random chain settles to an ending node, status ended", () => {
    const nodes: Record<string, Node> = {
      n1: { id: "n1", kind: "auto", textKey: "t", goto: "n2" },
      n2: { id: "n2", kind: "random", textKey: "t", transitions: [{ weight: 1, goto: "end" }] },
      end: { id: "end", kind: "ending", textKey: "t", endingId: "it_builds_character" },
    };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.status).toBe("ended");
    expect(result.state.endingId).toBe("it_builds_character");
  });

  it("stops immediately if the current node is already a choice or ending", () => {
    const nodes: Record<string, Node> = { n1: { id: "n1", kind: "choice", textKey: "t", choices: [] } };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.status).toBe("active");
    expect(result.state.currentNodeId).toBe("n1");
  });

  it("increments visitedCounts for every pass-through", () => {
    const nodes: Record<string, Node> = {
      n1: { id: "n1", kind: "auto", textKey: "t", goto: "n2" },
      n2: { id: "n2", kind: "auto", textKey: "t", goto: "n3" },
      n3: { id: "n3", kind: "choice", textKey: "t", choices: [] },
    };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.state.visitedCounts).toEqual({ n2: 1, n3: 1 });
  });

  it("accumulates visitedCounts across separate settle calls (turns) for a revisited node", () => {
    const nodes: Record<string, Node> = {
      loop: { id: "loop", kind: "auto", textKey: "t", goto: "choice" },
      choice: { id: "choice", kind: "choice", textKey: "t", choices: [] },
    };
    // settle's contract (matching 03 §8.2's pseudocode) is that the caller has already
    // entered state.currentNodeId — createGame/submitChoice both enter() before settling.
    const { emitter } = recordingEmitter();
    const first = settle(nodes, schema, enter(baseState(), "loop"), fixedRng(), emitter);
    expect(first.state.visitedCounts).toEqual({ loop: 1, choice: 1 });

    // Simulate a later turn whose choice transitions back into "loop".
    const second = settle(nodes, schema, enter(first.state, "loop"), fixedRng(), emitter);
    expect(second.state.visitedCounts).toEqual({ loop: 2, choice: 2 });
  });

  it("applies an auto node's effects (with clamp) before turn advances", () => {
    const nodes: Record<string, Node> = {
      n1: { id: "n1", kind: "auto", textKey: "t", effects: [{ op: "increment", var: "money", by: 10 }], goto: "n2" },
      n2: { id: "n2", kind: "choice", textKey: "t", choices: [] },
    };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.state.variables.money).toBe(3); // clamped to max
    expect(result.state.turn).toBe(1);
  });

  it("applies a random transition's effects before turn advances, and only the picked transition's", () => {
    const nodes: Record<string, Node> = {
      n1: {
        id: "n1",
        kind: "random",
        textKey: "t",
        transitions: [{ weight: 1, effects: [{ op: "set", var: "money", value: 2 }], goto: "n2" }],
      },
      n2: { id: "n2", kind: "choice", textKey: "t", choices: [] },
    };
    const { emitter } = recordingEmitter();
    const result = settle(nodes, schema, baseState(), fixedRng(), emitter);
    expect(result.state.variables.money).toBe(2);
    expect(result.state.turn).toBe(1);
  });

  it("emits settle.step once per iteration, node.entered per pass-through, random.picked only for random nodes", () => {
    const nodes: Record<string, Node> = {
      n1: { id: "n1", kind: "auto", textKey: "t", goto: "n2" },
      n2: { id: "n2", kind: "random", textKey: "t", transitions: [{ weight: 1, goto: "n3" }] },
      n3: { id: "n3", kind: "choice", textKey: "t", choices: [] },
    };
    const { emitter, events } = recordingEmitter();
    settle(nodes, schema, baseState(), fixedRng(), emitter);

    const steps = events.filter((e) => e.name === "kind.story-graph.settle.step");
    expect(steps).toHaveLength(3); // n1, n2, n3
    expect(steps.map((e) => e.data?.nodeId)).toEqual(["n1", "n2", "n3"]);
    expect(steps.map((e) => e.data?.step)).toEqual([0, 1, 2]);

    const entered = events.filter((e) => e.name === "kind.story-graph.node.entered");
    expect(entered.map((e) => e.data?.nodeId)).toEqual(["n2", "n3"]);
    expect(entered[0]?.data?.nodeKind).toBe("random");
    expect(entered[0]?.data?.visitCount).toBe(1);

    const picked = events.filter((e) => e.name === "kind.story-graph.random.picked");
    expect(picked).toHaveLength(1);
    expect(picked[0]?.data).toEqual({ nodeId: "n2", goto: "n3", weight: 1 });
  });

  it("a non-terminating auto cycle throws after SETTLE_STEPS, emitting settle.guard_tripped first", () => {
    const nodes: Record<string, Node> = {
      a: { id: "a", kind: "auto", textKey: "t", goto: "b" },
      b: { id: "b", kind: "auto", textKey: "t", goto: "a" },
    };
    const { emitter, events } = recordingEmitter();
    expect(() => settle(nodes, schema, baseState({ currentNodeId: "a" }), fixedRng(), emitter)).toThrow();

    const tripped = events.filter((e) => e.name === "kind.story-graph.settle.guard_tripped");
    expect(tripped).toHaveLength(1);
    expect(tripped[0]?.severity).toBe("error");
    expect(tripped[0]?.reason).toBe("settle_guard_tripped");
    expect(typeof tripped[0]?.data?.nodeId).toBe("string");

    const steps = events.filter((e) => e.name === "kind.story-graph.settle.step");
    expect(steps).toHaveLength(SETTLE_STEPS);
  });
});

const campaign: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: schema,
  startNodeId: "n1",
  achievements: [],
  nodes: {
    n1: { id: "n1", kind: "auto", textKey: "t", goto: "n2" },
    n2: { id: "n2", kind: "choice", textKey: "t", choices: [] },
  },
};

const endingCampaign: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: schema,
  startNodeId: "n1",
  achievements: [],
  nodes: {
    n1: { id: "n1", kind: "auto", textKey: "t", goto: "end" },
    end: { id: "end", kind: "ending", textKey: "t", endingId: "vignette" },
  },
};

describe("initialState", () => {
  it("enters startNodeId, counted, before settling", () => {
    const { emitter } = recordingEmitter();
    const ctx = { rng: fixedRng(), emit: emitter } as unknown as Parameters<typeof initialState>[1];
    const result = initialState({ id: "c", kindId: "story-graph", version: "1", titleKey: "t", content: campaign }, ctx);
    expect(result.state.visitedCounts.n1).toBe(1);
    expect(result.state.visitedCounts.n2).toBe(1);
  });

  it("reports status active when the start settles to a choice", () => {
    const { emitter } = recordingEmitter();
    const ctx = { rng: fixedRng(), emit: emitter } as unknown as Parameters<typeof initialState>[1];
    const result = initialState({ id: "c", kindId: "story-graph", version: "1", titleKey: "t", content: campaign }, ctx);
    expect(result.status).toBe("active");
  });

  it("reports status ended, with endingId set, when the start settles straight to an ending", () => {
    const { emitter } = recordingEmitter();
    const ctx = { rng: fixedRng(), emit: emitter } as unknown as Parameters<typeof initialState>[1];
    const result = initialState(
      { id: "c", kindId: "story-graph", version: "1", titleKey: "t", content: endingCampaign },
      ctx,
    );
    expect(result.status).toBe("ended");
    expect(result.state.endingId).toBe("vignette");
  });

  it("reproduces byte-identically from the same seed through a random node", () => {
    const randomCampaign: StoryGraphCampaign = {
      descriptionKey: "d",
      variables: schema,
      startNodeId: "n1",
      achievements: [],
      nodes: {
        n1: {
          id: "n1",
          kind: "random",
          textKey: "t",
          transitions: [
            { weight: 1, goto: "a" },
            { weight: 1, goto: "b" },
            { weight: 1, goto: "c" },
          ],
        },
        a: { id: "a", kind: "choice", textKey: "t", choices: [] },
        b: { id: "b", kind: "choice", textKey: "t", choices: [] },
        c: { id: "c", kind: "choice", textKey: "t", choices: [] },
      },
    };
    const runOnce = () => {
      const { emitter } = recordingEmitter();
      const rng = rngHandleFor("reproducible-seed", { kind: "system", system: "start", seq: 0 });
      const ctx = { rng, emit: emitter } as unknown as Parameters<typeof initialState>[1];
      return initialState({ id: "c", kindId: "story-graph", version: "1", titleKey: "t", content: randomCampaign }, ctx);
    };
    const first = runOnce();
    const second = runOnce();
    expect(second.state).toEqual(first.state);
  });
});

describe("initialState — through the real engine (integration)", () => {
  interface StubOverrides {
    initialState: (campaign: Campaign, ctx: import("../../core/kernel/types.js").KindContext) => InitialStateResult<StoryGraphKindState>;
  }

  function makeStoryGraphKind(overrides: StubOverrides): Kind<StoryGraphKindState> {
    return {
      id: "story-graph",
      reasonCodes: ["settle_guard_tripped"],
      eventNames: [
        "kind.story-graph.settle.step",
        "kind.story-graph.node.entered",
        "kind.story-graph.random.picked",
        "kind.story-graph.settle.guard_tripped",
      ],
      initialState: overrides.initialState,
      availableActions: (): AvailableAction[] => [],
      scene: (): SceneBody => ({ textKey: "t", text: "t" }),
      advance: (): AdvanceResult<StoryGraphKindState> => {
        throw new Error("not exercised in this test — W12's job");
      },
      project: (state) => state,
      validateCampaign: () => ({ ok: true, errors: [], warnings: [] }),
      outcome: (state) => ({ endingId: state.endingId ?? null }),
    };
  }

  function makeHost(): EngineHost {
    const registryCampaign: Campaign = { id: "bureaucracy", kindId: "story-graph", version: "1", titleKey: "t", content: campaign };
    const registry: ContentRegistry = { campaigns: new Map([["bureaucracy", registryCampaign]]), strings: new Map() };
    const kinds = { "story-graph": makeStoryGraphKind({ initialState }) } as unknown as KindRegistry;
    return { kinds, registry };
  }

  it("createGame calls this unit's initialState through the real engine seam", () => {
    const engine = createEngine(makeHost());
    const result = engine.createGame({ campaignId: "bureaucracy" });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("active");
    const kindState = result.value.kindState as StoryGraphKindState;
    expect(kindState.currentNodeId).toBe("n2");
    expect(kindState.visitedCounts).toEqual({ n1: 1, n2: 1 });
  });
});
