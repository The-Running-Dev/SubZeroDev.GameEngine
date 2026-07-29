import { describe, it, expect } from "vitest";
import { encodeStreamId, rngHandleFor } from "./rng.js";

describe("encodeStreamId", () => {
  it("encodes all four StreamId variants exactly as specified (04 §8)", () => {
    expect(encodeStreamId({ kind: "action", seq: 3 })).toBe("action:3");
    expect(encodeStreamId({ kind: "system", system: "start", seq: 0 })).toBe("system:start:0");
    expect(encodeStreamId({ kind: "agent", agentId: "guest-7", seq: 12 })).toBe("agent:guest-7:12");
    expect(encodeStreamId({ kind: "tick", tick: 40, system: "weather" })).toBe("tick:40:weather");
  });
});

describe("rngHandleFor", () => {
  it("same (seed, streamId) yields identical draws across separately-constructed handles", () => {
    const streamId = { kind: "action", seq: 1 } as const;
    const a = rngHandleFor("seed-xyz", streamId);
    const b = rngHandleFor("seed-xyz", streamId);
    const drawsA = Array.from({ length: 8 }, () => a.nextInt(0, 1_000_000));
    const drawsB = Array.from({ length: 8 }, () => b.nextInt(0, 1_000_000));
    expect(drawsA).toEqual(drawsB);
  });

  it("different action seqs diverge", () => {
    const a = rngHandleFor("seed-xyz", { kind: "action", seq: 1 });
    const b = rngHandleFor("seed-xyz", { kind: "action", seq: 2 });
    expect(a.nextInt(0, 1_000_000)).not.toEqual(b.nextInt(0, 1_000_000));
  });

  it("agent streams differing only by agentId are independent", () => {
    const a = rngHandleFor("seed-xyz", { kind: "agent", agentId: "guest-1", seq: 0 });
    const b = rngHandleFor("seed-xyz", { kind: "agent", agentId: "guest-2", seq: 0 });
    expect(a.nextInt(0, 1_000_000)).not.toEqual(b.nextInt(0, 1_000_000));
  });

  it("tick streams differing only by system are independent", () => {
    const a = rngHandleFor("seed-xyz", { kind: "tick", tick: 5, system: "spawning" });
    const b = rngHandleFor("seed-xyz", { kind: "tick", tick: 5, system: "weather" });
    expect(a.nextInt(0, 1_000_000)).not.toEqual(b.nextInt(0, 1_000_000));
  });

  it("exposes no toState (04 §8: RngHandle carries no readable generator state)", () => {
    const handle = rngHandleFor("seed-xyz", { kind: "action", seq: 0 });
    expect((handle as unknown as { toState?: unknown }).toState).toBeUndefined();
  });

  it("nextInt stays in range", () => {
    const handle = rngHandleFor("seed-xyz", { kind: "action", seq: 0 });
    for (let i = 0; i < 200; i++) {
      const n = handle.nextInt(3, 8);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it("pick only returns provided items", () => {
    const handle = rngHandleFor("seed-xyz", { kind: "action", seq: 0 });
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(handle.pick(items));
    }
  });

  it("weightedPick honours weights (roughly)", () => {
    const handle = rngHandleFor("seed-xyz", { kind: "action", seq: 0 });
    const items = [
      { item: "a", weight: 1 },
      { item: "b", weight: 3 },
    ] as const;
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[handle.weightedPick(items)]!++;
    expect(counts.b).toBeGreaterThan(counts.a! * 2);
  });
});
