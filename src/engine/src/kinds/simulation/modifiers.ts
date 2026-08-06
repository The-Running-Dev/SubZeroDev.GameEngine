/**
 * Simulation kind — modifier combination (10-simulation-kind.md §6.1, §7.1).
 *
 * Contract: `10-simulation-kind.md` §6.1 (application order, stacking, expiry),
 * §7.1 (`Modifier`'s own shape and the `multiply` rounding rule).
 *
 * Pure combination logic shared by `derived.ts` (read-time layering over a `DerivedPath`)
 * and `startOfWeek.ts`'s `time_commit` (layering over `calendar.committedTimeUnits`, which
 * is a genuinely stored field, not a `DerivedPath` — §3's own two-phase callout is the only
 * place this contract describes an effect changing committed time, and names no formula
 * beyond "recompute ... from job and course commitments", so the order/stacking/rounding
 * rule this section already fixes is the one mechanism available to apply it).
 */

import type { Modifier, StatusEffect } from "./state.js";

export interface ResolvedModifier {
  modifier: Modifier;
  /** The owning `StatusEffect.appliedWeek` — `set` conflicts break ties by earliest
   *  `appliedWeek`, and `Modifier` itself carries no week of its own (§6.1, §7.1). */
  appliedWeek: number;
}

/** Every modifier across `effects` whose `target` matches `path`, paired with the week its
 *  owning effect was applied. */
export function collectModifiers(effects: readonly StatusEffect[], path: string): ResolvedModifier[] {
  const result: ResolvedModifier[] = [];
  for (const effect of effects) {
    for (const modifier of effect.modifiers) {
      if (modifier.target === path) result.push({ modifier, appliedWeek: effect.appliedWeek });
    }
  }
  return result;
}

/** Round half away from zero. `Math.round` rounds half *toward positive infinity*, which is
 *  wrong for a negative half (`Math.round(-0.5) === -0`, not `-1`) — the determinism guard
 *  already rules out the `Math.pow`/string round-tripping banker's-rounding would need, and
 *  this is the exact rule §7.1 states for `multiply`. */
function roundHalfAwayFromZero(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

/**
 * §6.1's fixed application order, over one `path`'s already-collected modifiers:
 *
 * 1. `base`
 * 2. every `add`/`subtract`, summed
 * 3. every `multiply`, combined into one product and rounded **once** (§7.1 — never
 *    per-step, which would let registration order change an operation §6.1 already
 *    declares order-independent)
 * 4. every `set`, highest `priority` wins; ties broken by earliest `appliedWeek`
 *
 * Clamping to the field's declared range is the caller's job — this function has no way to
 * know it generically across every `DerivedPath` and `calendar.committedTimeUnits` alike.
 */
export function combineModifiers(base: number, modifiers: readonly ResolvedModifier[]): number {
  let value = base;

  let addSubtractSum = 0;
  for (const { modifier } of modifiers) {
    if (modifier.operation === "add") addSubtractSum += modifier.value;
    else if (modifier.operation === "subtract") addSubtractSum -= modifier.value;
  }
  value += addSubtractSum;

  const multiplyMods = modifiers.filter((m) => m.modifier.operation === "multiply");
  if (multiplyMods.length > 0) {
    let factor = 1;
    for (const { modifier } of multiplyMods) factor *= 1 + modifier.value / 10_000;
    value = roundHalfAwayFromZero(value * factor);
  }

  const setMods = modifiers.filter((m) => m.modifier.operation === "set");
  if (setMods.length > 0) {
    let winner = setMods[0]!;
    for (const candidate of setMods.slice(1)) {
      const candidatePriority = candidate.modifier.priority ?? 0;
      const winnerPriority = winner.modifier.priority ?? 0;
      const wins = candidatePriority > winnerPriority
        || (candidatePriority === winnerPriority && candidate.appliedWeek < winner.appliedWeek);
      if (wins) winner = candidate;
    }
    value = winner.modifier.value;
  }

  return value;
}
