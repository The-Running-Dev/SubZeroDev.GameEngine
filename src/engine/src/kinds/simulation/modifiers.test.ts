import { describe, it, expect } from "vitest";
import { collectModifiers, combineModifiers, insertStatusEffect } from "./modifiers.js";
import type { StatusEffect } from "./state.js";

function effect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: "effect-1",
    sourceId: "source-1",
    sourceKind: "item",
    modifiers: [],
    appliedWeek: 1,
    stacking: "refresh",
    descriptionKey: "effect.description",
    visible: true,
    ...overrides,
  };
}

describe("collectModifiers", () => {
  it("collects only modifiers whose target matches path, across every effect", () => {
    const effects: StatusEffect[] = [
      effect({
        appliedWeek: 3,
        modifiers: [
          { target: "player.needs.energy", operation: "add", value: 5, sourceId: "a" },
          { target: "player.needs.stress", operation: "add", value: 1, sourceId: "a" },
        ],
      }),
      effect({
        appliedWeek: 4,
        modifiers: [{ target: "player.needs.energy", operation: "subtract", value: 2, sourceId: "b" }],
      }),
    ];
    const result = collectModifiers(effects, "player.needs.energy");
    expect(result).toEqual([
      { modifier: { target: "player.needs.energy", operation: "add", value: 5, sourceId: "a" }, appliedWeek: 3 },
      { modifier: { target: "player.needs.energy", operation: "subtract", value: 2, sourceId: "b" }, appliedWeek: 4 },
    ]);
  });

  it("returns an empty array when nothing targets the path", () => {
    expect(collectModifiers([effect()], "player.needs.energy")).toEqual([]);
  });
});

describe("combineModifiers", () => {
  it("returns the base unchanged with no modifiers", () => {
    expect(combineModifiers(50, [])).toBe(50);
  });

  it("sums add/subtract modifiers over the base", () => {
    const result = combineModifiers(50, [
      { modifier: { target: "x", operation: "add", value: 10, sourceId: "a" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "subtract", value: 3, sourceId: "b" }, appliedWeek: 1 },
    ]);
    expect(result).toBe(57);
  });

  it("combines several multiply modifiers into one product, rounded once — not folded with an intermediate rounding step", () => {
    // 100 * 1.025 * 1.025 = 105.0625 -> rounds to 105 once combined.
    // Rounding each step separately would give 103 (100*1.025=102.5->103, 103*1.025=105.575->106) or similar drift.
    const result = combineModifiers(100, [
      { modifier: { target: "x", operation: "multiply", value: 250, sourceId: "a" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "multiply", value: 250, sourceId: "b" }, appliedWeek: 1 },
    ]);
    expect(result).toBe(105);
  });

  it("multiply composes the same regardless of registration order (order-independent, §6.1)", () => {
    const mods = [
      { modifier: { target: "x", operation: "multiply" as const, value: 250, sourceId: "a" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "multiply" as const, value: -500, sourceId: "b" }, appliedWeek: 2 },
    ];
    const forward = combineModifiers(200, mods);
    const reversed = combineModifiers(200, [...mods].reverse());
    expect(forward).toBe(reversed);
  });

  it("rounds a negative product half away from zero", () => {
    // -3 * 1.05 = -3.15 -> away from zero rounds to -3, not -4 (toward -infinity) or 3 (toward +infinity).
    const result = combineModifiers(-3, [
      { modifier: { target: "x", operation: "multiply", value: 500, sourceId: "a" }, appliedWeek: 1 },
    ]);
    expect(result).toBe(-3);
  });

  it("set overrides everything else, highest priority winning", () => {
    const result = combineModifiers(50, [
      { modifier: { target: "x", operation: "add", value: 10, sourceId: "a" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "set", value: 20, priority: 1, sourceId: "b" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "set", value: 99, priority: 5, sourceId: "c" }, appliedWeek: 1 },
    ]);
    expect(result).toBe(99);
  });

  it("breaks a set priority tie by earliest appliedWeek", () => {
    const result = combineModifiers(0, [
      { modifier: { target: "x", operation: "set", value: 30, sourceId: "later" }, appliedWeek: 5 },
      { modifier: { target: "x", operation: "set", value: 10, sourceId: "earlier" }, appliedWeek: 2 },
    ]);
    expect(result).toBe(10);
  });

  it("treats an absent priority as 0", () => {
    const result = combineModifiers(0, [
      { modifier: { target: "x", operation: "set", value: 5, sourceId: "a" }, appliedWeek: 1 },
      { modifier: { target: "x", operation: "set", value: 9, priority: -1, sourceId: "b" }, appliedWeek: 1 },
    ]);
    expect(result).toBe(5);
  });
});

describe("insertStatusEffect — §2.3/§6.1's one insertion invariant", () => {
  it("a same-source refresh replaces the prior layer, including its expiry", () => {
    const existing = effect({ id: "e-old", sourceId: "s", appliedWeek: 1, expiresAtWeek: 5, stacking: "refresh" });
    const incoming = effect({ id: "e-new", sourceId: "s", appliedWeek: 10, expiresAtWeek: 20, stacking: "refresh" });
    expect(insertStatusEffect([existing], incoming)).toEqual([incoming]);
  });

  it("a same-source stack keeps the prior layer and adds this one as an independent layer", () => {
    const existing = effect({ id: "e-old", sourceId: "s", stacking: "stack" });
    const incoming = effect({ id: "e-new", sourceId: "s", stacking: "stack" });
    expect(insertStatusEffect([existing], incoming)).toEqual([existing, incoming]);
  });

  it("a different source always coexists, whether the incoming effect refreshes or stacks", () => {
    const existing = effect({ id: "e-a", sourceId: "a" });
    const refreshing = effect({ id: "e-b", sourceId: "b", stacking: "refresh" });
    expect(insertStatusEffect([existing], refreshing)).toEqual([existing, refreshing]);

    const stacking = effect({ id: "e-c", sourceId: "c", stacking: "stack" });
    expect(insertStatusEffect([existing], stacking)).toEqual([existing, stacking]);
  });

  it("inserting into an empty list just adds the effect", () => {
    const incoming = effect({ id: "e-1", sourceId: "s" });
    expect(insertStatusEffect([], incoming)).toEqual([incoming]);
  });
});
