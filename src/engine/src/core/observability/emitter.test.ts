import { describe, it, expect } from "vitest";
import { createRecordingEmitter, emitSystemEvent, makeResolutionEmitters, nullEmitter, safeEmit } from "./emitter.js";
import type { Emitter, GameEvent } from "./types.js";

describe("nullEmitter", () => {
  it("discards every event and never throws", () => {
    expect(() => nullEmitter.emit({ scope: "system", name: "core.x", severity: "info", ordinal: 0 })).not.toThrow();
  });
});

describe("createRecordingEmitter", () => {
  it("keeps events in emission order", () => {
    const recorder = createRecordingEmitter();
    recorder.emit({ scope: "system", name: "core.a", severity: "info", ordinal: 0 });
    recorder.emit({ scope: "system", name: "core.b", severity: "info", ordinal: 1 });
    expect(recorder.events.map((e) => e.name)).toEqual(["core.a", "core.b"]);
  });

  it("returns a fresh instance with independent storage each call", () => {
    const a = createRecordingEmitter();
    const b = createRecordingEmitter();
    a.emit({ scope: "system", name: "core.a", severity: "info", ordinal: 0 });
    expect(b.events).toEqual([]);
  });
});

describe("safeEmit", () => {
  it("swallows a throwing sink", () => {
    const throwingSink: Emitter = {
      emit: () => {
        throw new Error("sink is broken");
      },
    };
    expect(() => safeEmit(throwingSink, { scope: "system", name: "core.a", severity: "info", ordinal: 0 })).not.toThrow();
  });

  it("forwards to a well-behaved sink", () => {
    const recorder = createRecordingEmitter();
    safeEmit(recorder, { scope: "system", name: "core.a", severity: "info", ordinal: 0 });
    expect(recorder.events).toHaveLength(1);
  });
});

describe("emitSystemEvent", () => {
  it("builds a system-scope event with ordinal 0 and no game identity", () => {
    const recorder = createRecordingEmitter();
    emitSystemEvent(recorder, "core.deserialize.rejected", "error", { reason: "invalid_state" });
    const [event] = recorder.events;
    expect(event?.scope).toBe("system");
    expect(event?.ordinal).toBe(0);
    expect(event?.reason).toBe("invalid_state");
    expect("gameId" in (event ?? {})).toBe(false);
  });

  it("omits reason/data when not given", () => {
    const recorder = createRecordingEmitter();
    emitSystemEvent(recorder, "core.validation.completed", "info");
    const [event] = recorder.events;
    expect(event && "reason" in event).toBe(false);
    expect(event && "data" in event).toBe(false);
  });
});

describe("makeResolutionEmitters", () => {
  it("core view builds a game-scoped event with no kindId", () => {
    const recorder = createRecordingEmitter();
    const emitters = makeResolutionEmitters(recorder, "game-1", 5);
    emitters.core.emit("core.action.accepted", "info", { data: { actionId: "go" } });

    const [event] = recorder.events as GameEvent[];
    expect(event?.scope).toBe("game");
    expect(event?.gameId).toBe("game-1");
    expect(event?.seq).toBe(5);
    expect(event?.ordinal).toBe(0);
    expect(event?.data).toEqual({ actionId: "go" });
    expect(event && "kindId" in event).toBe(false);
  });

  it("forKind view stamps kindId", () => {
    const recorder = createRecordingEmitter();
    const emitters = makeResolutionEmitters(recorder, "game-1", 0);
    const kindEmit = emitters.forKind("story-graph", ["kind.story-graph.settle.step"]);
    kindEmit.emit("kind.story-graph.settle.step", "trace");

    const [event] = recorder.events as GameEvent[];
    expect(event?.kindId).toBe("story-graph");
  });

  it("shares one ordinal counter across the core view and every forKind view", () => {
    const recorder = createRecordingEmitter();
    const emitters = makeResolutionEmitters(recorder, "game-1", 0);
    const kindEmit = emitters.forKind("story-graph", ["kind.story-graph.a", "kind.story-graph.b"]);

    emitters.core.emit("core.rng.stream.derived", "trace");
    kindEmit.emit("kind.story-graph.a", "trace");
    emitters.core.emit("core.action.accepted", "info");
    kindEmit.emit("kind.story-graph.b", "trace");

    expect(recorder.events.map((e) => e.ordinal)).toEqual([0, 1, 2, 3]);
  });

  it("a fresh call restarts ordinals at 0", () => {
    const recorder = createRecordingEmitter();
    const first = makeResolutionEmitters(recorder, "game-1", 0);
    first.core.emit("core.action.accepted", "info");
    first.core.emit("core.game.ended", "info");

    const second = makeResolutionEmitters(recorder, "game-1", 1);
    second.core.emit("core.action.accepted", "info");

    expect(recorder.events.map((e) => e.ordinal)).toEqual([0, 1, 0]);
  });

  it("core view rejects a name outside core.*", () => {
    const emitters = makeResolutionEmitters(nullEmitter, "game-1", 0);
    expect(() => emitters.core.emit("kind.story-graph.a", "trace")).toThrow(/core\.\*/);
  });

  it("forKind view rejects a name outside its own kind namespace", () => {
    const emitters = makeResolutionEmitters(nullEmitter, "game-1", 0);
    const kindEmit = emitters.forKind("story-graph", ["kind.story-graph.a"]);
    expect(() => kindEmit.emit("kind.simulation.a", "trace")).toThrow();
  });

  it("forKind view rejects a name not in declaredEventNames even if in-namespace", () => {
    const emitters = makeResolutionEmitters(nullEmitter, "game-1", 0);
    const kindEmit = emitters.forKind("story-graph", ["kind.story-graph.a"]);
    expect(() => kindEmit.emit("kind.story-graph.undeclared", "trace")).toThrow();
  });

  it("a throwing sink does not propagate out of either view", () => {
    const throwingSink: Emitter = {
      emit: () => {
        throw new Error("boom");
      },
    };
    const emitters = makeResolutionEmitters(throwingSink, "game-1", 0);
    expect(() => emitters.core.emit("core.action.accepted", "info")).not.toThrow();
  });
});
