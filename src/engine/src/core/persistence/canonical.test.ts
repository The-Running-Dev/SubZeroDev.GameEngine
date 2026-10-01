import { describe, it, expect } from "vitest";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";

describe("canonicalStringify", () => {
  it("is independent of key insertion order", () => {
    const a = { b: 2, a: 1, c: 3 };
    const b = { c: 3, a: 1, b: 2 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("sorts keys deeply", () => {
    const v = { z: { y: 1, x: 2 }, a: [{ n: 2, m: 1 }] };
    expect(canonicalStringify(v)).toBe('{"a":[{"m":1,"n":2}],"z":{"x":2,"y":1}}');
  });

  it("round-trips through JSON.parse without changing canonical output", () => {
    const state = { rng: { algorithm: "pcg32", state: "00ff", increment: "0001" }, turn: 4, vars: { b: true, a: 3 } };
    const once = canonicalStringify(state);
    const twice = canonicalStringify(JSON.parse(once));
    expect(twice).toBe(once);
  });

  it("preserves arrays in order (only object keys are sorted)", () => {
    expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("drops undefined-valued keys, matching JSON", () => {
    expect(canonicalStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalStringify({ x: NaN })).toThrow();
    expect(() => canonicalStringify({ x: Infinity })).toThrow();
  });

  it("rejects bigint (must be hex-encoded)", () => {
    expect(() => canonicalStringify({ x: 1n })).toThrow();
  });
});
