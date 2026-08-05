import { describe, it, expect } from "vitest";
import { derivedValueResolver } from "./derived.js";
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

describe("derivedValueResolver.resolve", () => {
  it("W51.1 — every DerivedPath §6.1 names resolves through the resolver", () => {
    // A path outside the closed union fails at load (compile time), not at read — the
    // `DerivedPath` type itself is what TypeScript checks here; there is no runtime branch
    // to exercise for an invalid path. This test exists to name every member the union
    // admits and prove each one resolves without throwing.
    const paths: readonly [import("./derived.js").DerivedPath, number][] = [
      ["player.needs.energy", 50],
      ["player.attributes.discipline", 50],
      ["player.skills.cooking", 50],
      ["player.housing.quality", 50],
      ["player.career.effectivePerformance", 50],
      ["calendar.energyRecoveryRate", 50],
      ["world.strangeness", 50],
    ];
    for (const [path, base] of paths) {
      expect(derivedValueResolver.resolve(path, base, [])).toBe(base);
    }
  });

  it("returns the base unchanged when no effect targets the path", () => {
    expect(derivedValueResolver.resolve("player.needs.energy", 60, [])).toBe(60);
  });

  it("W51.2 — two modifiers on the same path produce the identical result in either registration order", () => {
    const effects: StatusEffect[] = [
      effect({ appliedWeek: 1, modifiers: [{ target: "player.needs.energy", operation: "add", value: 10, sourceId: "a" }] }),
      effect({ appliedWeek: 2, modifiers: [{ target: "player.needs.energy", operation: "subtract", value: 4, sourceId: "b" }] }),
    ];
    const forward = derivedValueResolver.resolve("player.needs.energy", 50, effects);
    const reversed = derivedValueResolver.resolve("player.needs.energy", 50, [...effects].reverse());
    expect(forward).toBe(reversed);
    expect(forward).toBe(56);
  });

  it("W51.3 — a multiply chain against an integer base rounds half-away-from-zero once, differing from three separately-rounded multiplies", () => {
    const effects: StatusEffect[] = [
      effect({ modifiers: [{ target: "player.needs.energy", operation: "multiply", value: 333, sourceId: "a" }] }),
      effect({ modifiers: [{ target: "player.needs.energy", operation: "multiply", value: 333, sourceId: "b" }] }),
      effect({ modifiers: [{ target: "player.needs.energy", operation: "multiply", value: 333, sourceId: "c" }] }),
    ];
    // Combined once: 10 * 1.0333^3 = 10 * 1.10328... = 11.0328... -> rounds to 11.
    const combinedOnce = derivedValueResolver.resolve("player.needs.energy", 10, effects);
    expect(combinedOnce).toBe(11);

    // Rounded after each step: 10*1.0333=10.333->10, 10*1.0333=10.333->10, 10*1.0333=10.333->10.
    let steppedRounded = 10;
    for (const e of effects) {
      const factor = 1 + e.modifiers[0]!.value / 10_000;
      steppedRounded = Math.round(steppedRounded * factor);
    }
    expect(steppedRounded).not.toBe(combinedOnce);
  });

  it("clamps player.needs.*/player.attributes.*/player.skills.* to 0-100", () => {
    const effects: StatusEffect[] = [
      effect({ modifiers: [{ target: "player.needs.energy", operation: "add", value: 1000, sourceId: "a" }] }),
    ];
    expect(derivedValueResolver.resolve("player.needs.energy", 50, effects)).toBe(100);

    const negativeEffects: StatusEffect[] = [
      effect({ modifiers: [{ target: "player.needs.energy", operation: "subtract", value: 1000, sourceId: "a" }] }),
    ];
    expect(derivedValueResolver.resolve("player.needs.energy", 50, negativeEffects)).toBe(0);
  });

  it("leaves the four read-only formula paths unclamped (no declared range in this contract)", () => {
    const effects: StatusEffect[] = [
      effect({ modifiers: [{ target: "world.strangeness", operation: "add", value: 1000, sourceId: "a" }] }),
    ];
    expect(derivedValueResolver.resolve("world.strangeness", 50, effects)).toBe(1050);
  });
});

describe("derivedValueResolver.isReadOnly", () => {
  it("is true for the four formula-only paths with no stored counterpart", () => {
    expect(derivedValueResolver.isReadOnly("player.housing.quality")).toBe(true);
    expect(derivedValueResolver.isReadOnly("player.career.effectivePerformance")).toBe(true);
    expect(derivedValueResolver.isReadOnly("calendar.energyRecoveryRate")).toBe(true);
    expect(derivedValueResolver.isReadOnly("world.strangeness")).toBe(true);
  });

  it("is false for needs/attributes/skills, which have a real stored counterpart", () => {
    expect(derivedValueResolver.isReadOnly("player.needs.energy")).toBe(false);
    expect(derivedValueResolver.isReadOnly("player.attributes.discipline")).toBe(false);
    expect(derivedValueResolver.isReadOnly("player.skills.cooking")).toBe(false);
  });

  it("is false for an arbitrary path outside the DerivedPath union entirely", () => {
    expect(derivedValueResolver.isReadOnly("calendar.committedTimeUnits")).toBe(false);
  });
});
