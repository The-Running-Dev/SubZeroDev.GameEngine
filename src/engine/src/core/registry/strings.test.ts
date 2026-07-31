import { describe, it, expect } from "vitest";
import { mergeStringTables } from "./strings.js";

describe("mergeStringTables", () => {
  it("merges disjoint tables", () => {
    const result = mergeStringTables([new Map([["a", "A"]]), new Map([["b", "B"]])]);
    expect(result.ok).toBe(true);
    expect(result.ok && [...result.strings.entries()]).toEqual([
      ["a", "A"],
      ["b", "B"],
    ]);
  });

  it("dedupes an identical key/text pair repeated across tables", () => {
    const result = mergeStringTables([new Map([["a", "A"]]), new Map([["a", "A"]])]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.strings.get("a")).toBe("A");
  });

  it("dedupes an identical key/text pair repeated within one table's fold order", () => {
    const result = mergeStringTables([new Map([["a", "A"]]), new Map([["a", "A"]]), new Map([["a", "A"]])]);
    expect(result.ok).toBe(true);
  });

  it("fails on the same key with different text", () => {
    const result = mergeStringTables([new Map([["a", "A"]]), new Map([["a", "different"]])]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.conflicts).toEqual([{ key: "a", existing: "A", incoming: "different" }]);
  });

  it("accumulates every conflict rather than failing on the first", () => {
    const result = mergeStringTables([
      new Map([
        ["a", "A"],
        ["b", "B"],
      ]),
      new Map([
        ["a", "A2"],
        ["b", "B2"],
      ]),
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.conflicts).toHaveLength(2);
  });

  it("an empty input produces an empty, successful merge", () => {
    const result = mergeStringTables([]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.strings.size).toBe(0);
  });
});
