import { describe, it, expect } from "vitest";
import { Pcg32, deriveStream } from "./pcg32.js";

describe("Pcg32", () => {
  it("matches the canonical PCG32 reference vectors (seed 42, 54)", () => {
    // Gold standard: pcg32_srandom_r(rng, 42u, 54u) from the reference C implementation
    // produces exactly these first outputs. Bit-identical output proves correctness.
    const g = Pcg32.seed(42n, 54n);
    const got = Array.from({ length: 6 }, () => g.next().toString(16).padStart(8, "0"));
    expect(got).toEqual(["a15c02b7", "7b47f409", "ba1d3330", "83d2f293", "bfa4784b", "cbed606e"]);
  });

  it("is deterministic: same seed → same sequence", () => {
    const a = Pcg32.seed(42n, 54n);
    const b = Pcg32.seed(42n, 54n);
    const seqA = Array.from({ length: 32 }, () => a.next());
    const seqB = Array.from({ length: 32 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = Pcg32.seed(1n, 1n);
    const b = Pcg32.seed(2n, 1n);
    expect(a.next()).not.toEqual(b.next());
  });

  it("round-trips through serialized state mid-sequence", () => {
    const g = Pcg32.seed(123n, 456n);
    g.next();
    g.next();
    const snapshot = g.toState();
    const rest = Array.from({ length: 16 }, () => g.next());

    const restored = Pcg32.fromState(snapshot);
    const restRestored = Array.from({ length: 16 }, () => restored.next());
    expect(restRestored).toEqual(rest);
  });

  it("emits 32-bit unsigned integers", () => {
    const g = Pcg32.seed(7n, 7n);
    for (let i = 0; i < 1000; i++) {
      const n = g.next();
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("nextInt stays in range and covers a single value", () => {
    const g = Pcg32.seed(9n, 9n);
    for (let i = 0; i < 1000; i++) {
      const n = g.nextInt(3, 8);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
    expect(g.nextInt(5, 5)).toBe(5);
  });

  it("weightedPick honours weights (roughly) and only returns provided items", () => {
    const g = Pcg32.seed(11n, 22n);
    const items = [
      { item: "a", weight: 1 },
      { item: "b", weight: 3 },
    ] as const;
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[g.weightedPick(items)]!++;
    // b should be roughly 3x a; assert it is clearly more common, not exact.
    expect(counts.b).toBeGreaterThan(counts.a! * 2);
  });

  it("deriveStream: same (seed, streamId) reproduces; different streamId diverges", () => {
    const s1 = deriveStream("seed-xyz", "events:week-1");
    const s1again = deriveStream("seed-xyz", "events:week-1");
    const s2 = deriveStream("seed-xyz", "events:week-2");
    const a = Array.from({ length: 8 }, () => s1.next());
    const aAgain = Array.from({ length: 8 }, () => s1again.next());
    const b = Array.from({ length: 8 }, () => s2.next());
    expect(a).toEqual(aAgain);
    expect(a).not.toEqual(b);
  });
});
