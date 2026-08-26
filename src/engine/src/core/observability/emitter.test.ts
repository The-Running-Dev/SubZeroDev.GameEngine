import { describe, it, expect, afterEach } from "vitest";
import { createRecordingEmitter, emitSystemEvent, jsonlEmitter, makeResolutionEmitters, nullEmitter, safeEmit } from "./emitter.js";
import type { Emitter, EmittedRecord, GameEvent } from "./types.js";

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

describe("jsonlEmitter", () => {
  function makeRecord(overrides?: Partial<EmittedRecord>): EmittedRecord {
    return {
      event: { scope: "system", name: "core.a", severity: "info", ordinal: 0 },
      emittedAt: "2026-01-01T00:00:00.000Z",
      traceId: "trace-1",
      spanId: "span-1",
      attempt: 1,
      ...overrides,
    };
  }

  it("writes exactly one JSON-parseable line per record, in order", () => {
    const lines: string[] = [];
    const sink = jsonlEmitter((line) => lines.push(line));

    sink.write(makeRecord({ traceId: "trace-1" }));
    sink.write(makeRecord({ traceId: "trace-2" }));

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => !line.includes("\n"))).toBe(true);
    expect(JSON.parse(lines[0] as string).traceId).toBe("trace-1");
    expect(JSON.parse(lines[1] as string).traceId).toBe("trace-2");
  });

  it("round-trips every EmittedRecord field", () => {
    const lines: string[] = [];
    const sink = jsonlEmitter((line) => lines.push(line));
    const record = makeRecord({ sessionId: "session-1", experiments: { "homepage-layout": "compact" } });

    sink.write(record);

    expect(JSON.parse(lines[0] as string)).toEqual(record);
  });

  it("swallows a throwing write function", () => {
    const sink = jsonlEmitter(() => {
      throw new Error("disk is full");
    });
    expect(() => sink.write(makeRecord())).not.toThrow();
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

  describe("undeclared-name guard is dev-gated (05-observability.md §9)", () => {
    const original = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = original;
    });

    it("still throws under NODE_ENV=production's absence (the default test env)", () => {
      const emitters = makeResolutionEmitters(nullEmitter, "game-1", 0);
      expect(() => emitters.core.emit("kind.story-graph.a", "trace")).toThrow();
    });

    it("does not throw under NODE_ENV=production, and does not abort the caller", () => {
      process.env.NODE_ENV = "production";
      const emitters = makeResolutionEmitters(nullEmitter, "game-1", 0);
      expect(() => emitters.core.emit("kind.story-graph.a", "trace")).not.toThrow();

      const kindEmit = emitters.forKind("story-graph", ["kind.story-graph.a"]);
      expect(() => kindEmit.emit("kind.story-graph.undeclared", "trace")).not.toThrow();
    });

    it("under NODE_ENV=production, a malformed name reaches neither the sink nor the recorder", () => {
      process.env.NODE_ENV = "production";
      const recorder = createRecordingEmitter();
      const emitters = makeResolutionEmitters(recorder, "game-1", 0);
      emitters.core.emit("kind.story-graph.a", "trace");
      expect(recorder.events).toEqual([]);
    });
  });
});
