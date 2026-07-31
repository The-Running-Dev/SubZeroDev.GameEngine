import { describe, it, expect } from "vitest";
import { evaluateCondition } from "./evaluate.js";
import type { Condition, ConditionResolver } from "./types.js";

function fieldResolver(values: Record<string, unknown>): ConditionResolver {
  return {
    field: (path) => values[path],
    collection: () => [],
  };
}

describe("evaluateCondition — comparison operators", () => {
  it("equals / not_equals", () => {
    const r = fieldResolver({ a: 1 });
    expect(evaluateCondition({ field: "a", operator: "equals", value: 1 }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "equals", value: 2 }, r)).toBe(false);
    expect(evaluateCondition({ field: "a", operator: "not_equals", value: 2 }, r)).toBe(true);
  });

  it("less_than / less_or_equal / greater_than / greater_or_equal", () => {
    const r = fieldResolver({ a: 3 });
    expect(evaluateCondition({ field: "a", operator: "less_than", value: 4 }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "less_than", value: 3 }, r)).toBe(false);
    expect(evaluateCondition({ field: "a", operator: "less_or_equal", value: 3 }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "greater_than", value: 2 }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "greater_or_equal", value: 3 }, r)).toBe(true);
  });

  it("ordering operators throw when either operand is not a number", () => {
    const r = fieldResolver({ a: "x" });
    expect(() => evaluateCondition({ field: "a", operator: "less_than", value: 4 }, r)).toThrow();
    expect(() => evaluateCondition({ field: "a", operator: "greater_than", value: "y" }, r)).toThrow();
  });

  it("in / not_in", () => {
    const r = fieldResolver({ a: "red" });
    expect(evaluateCondition({ field: "a", operator: "in", value: ["red", "blue"] }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "in", value: ["blue"] }, r)).toBe(false);
    expect(evaluateCondition({ field: "a", operator: "not_in", value: ["blue"] }, r)).toBe(true);
  });

  it("in throws when value is not an array", () => {
    const r = fieldResolver({ a: "red" });
    expect(() => evaluateCondition({ field: "a", operator: "in", value: "red" }, r)).toThrow();
  });

  it("contains against a string field", () => {
    const r = fieldResolver({ a: "hello world" });
    expect(evaluateCondition({ field: "a", operator: "contains", value: "world" }, r)).toBe(true);
    expect(evaluateCondition({ field: "a", operator: "contains", value: "nope" }, r)).toBe(false);
  });

  it("contains against an array field", () => {
    const r = fieldResolver({ a: ["x", "y"] });
    expect(evaluateCondition({ field: "a", operator: "contains", value: "y" }, r)).toBe(true);
  });

  it("has_tag / has_flag against an array field", () => {
    const r = fieldResolver({ tags: ["formal_clothing", "hat"] });
    expect(evaluateCondition({ field: "tags", operator: "has_tag", value: "formal_clothing" }, r)).toBe(true);
    expect(evaluateCondition({ field: "tags", operator: "has_flag", value: "nope" }, r)).toBe(false);
  });

  it("has_tag throws when the field is not an array", () => {
    const r = fieldResolver({ tags: "not-an-array" });
    expect(() => evaluateCondition({ field: "tags", operator: "has_tag", value: "x" }, r)).toThrow();
  });
});

describe("evaluateCondition — combinators", () => {
  it("all is true only when every child is true, vacuously true when empty", () => {
    const r = fieldResolver({ a: 1, b: 2 });
    const t = (v: number): Condition => ({ field: "a", operator: "equals", value: v });
    expect(evaluateCondition({ all: [t(1)] }, r)).toBe(true);
    expect(evaluateCondition({ all: [t(1), t(2)] }, r)).toBe(false);
    expect(evaluateCondition({ all: [] }, r)).toBe(true);
  });

  it("any is true when at least one child is true, vacuously false when empty", () => {
    const r = fieldResolver({ a: 1 });
    const t = (v: number): Condition => ({ field: "a", operator: "equals", value: v });
    expect(evaluateCondition({ any: [t(1), t(2)] }, r)).toBe(true);
    expect(evaluateCondition({ any: [t(2)] }, r)).toBe(false);
    expect(evaluateCondition({ any: [] }, r)).toBe(false);
  });

  it("not inverts", () => {
    const r = fieldResolver({ a: 1 });
    expect(evaluateCondition({ not: { field: "a", operator: "equals", value: 1 } }, r)).toBe(false);
    expect(evaluateCondition({ not: { field: "a", operator: "equals", value: 2 } }, r)).toBe(true);
  });

  it("nests three levels deep", () => {
    const r = fieldResolver({ a: 1, b: 2, c: 3 });
    const condition: Condition = {
      all: [
        { field: "a", operator: "equals", value: 1 },
        {
          any: [
            { field: "b", operator: "equals", value: 99 },
            { not: { field: "c", operator: "equals", value: 4 } },
          ],
        },
      ],
    };
    expect(evaluateCondition(condition, r)).toBe(true);
  });
});

describe("evaluateCondition — exists / count", () => {
  function npcResolver(npcs: readonly { name: string; hostile: boolean }[]): ConditionResolver {
    return {
      field: () => undefined,
      collection: (name) => {
        if (name !== "world.npcs") return [];
        return npcs.map((npc): ConditionResolver => fieldResolver({ name: npc.name, hostile: npc.hostile }));
      },
    };
  }

  it("exists is true when at least one item satisfies where", () => {
    const r = npcResolver([
      { name: "guard", hostile: true },
      { name: "villager", hostile: false },
    ]);
    const condition: Condition = {
      exists: { collection: "world.npcs", where: { field: "hostile", operator: "equals", value: true } },
    };
    expect(evaluateCondition(condition, r)).toBe(true);
  });

  it("exists is false when no item satisfies where, or the collection is unknown", () => {
    const r = npcResolver([{ name: "villager", hostile: false }]);
    const condition: Condition = {
      exists: { collection: "world.npcs", where: { field: "hostile", operator: "equals", value: true } },
    };
    expect(evaluateCondition(condition, r)).toBe(false);

    const empty: Condition = {
      exists: { collection: "world.unknown", where: { field: "x", operator: "equals", value: true } },
    };
    expect(evaluateCondition(empty, r)).toBe(false);
  });

  it("count compares the number of matching items", () => {
    const r = npcResolver([
      { name: "a", hostile: true },
      { name: "b", hostile: true },
      { name: "c", hostile: false },
    ]);
    const condition: Condition = {
      count: { collection: "world.npcs", where: { field: "hostile", operator: "equals", value: true } },
      operator: "greater_or_equal",
      value: 2,
    };
    expect(evaluateCondition(condition, r)).toBe(true);

    const tooFew: Condition = {
      count: { collection: "world.npcs", where: { field: "hostile", operator: "equals", value: true } },
      operator: "greater_or_equal",
      value: 3,
    };
    expect(evaluateCondition(tooFew, r)).toBe(false);
  });

  it("count's operator type excludes the array/string-shaped comparisons", () => {
    const r = npcResolver([{ name: "a", hostile: true }]);
    const where: Condition = { field: "hostile", operator: "equals", value: true };
    // @ts-expect-error "in" is not a CountComparisonOperator — it would throw at evaluation
    // since count always compares two numbers, never an array/string.
    const invalid: Condition = { count: { collection: "world.npcs", where }, operator: "in", value: 1 };
    expect(() => evaluateCondition(invalid, r)).toThrow();
  });
});
