/**
 * Simulation kind — derived-value resolution (10-simulation-kind.md §6.1).
 *
 * Contract: `10-simulation-kind.md` §6.1.
 *
 * State stores base values; a derived value is computed on read by layering every active
 * modifier over the base (`modifiers.ts`) and clamping to the field's declared range.
 * `DerivedPath` is the closed union Tier 1 validation (§14, not built by this unit) checks a
 * `Modifier.target` against — TypeScript closes it "at load" the same way `ActionType` does
 * (§4.2's own reasoning): passing an unlisted literal is a compile error, not a runtime
 * surprise.
 *
 * `isReadOnly` is the finer partition *within* that closed union. `player.needs.*`,
 * `player.attributes.*` and `player.skills.*` have a real stored counterpart and are
 * legitimate `Modifier` targets — §6.1's own motivating example is a need `set` for three
 * weeks. `player.housing.quality`, `player.career.effectivePerformance`,
 * `calendar.energyRecoveryRate` and `world.strangeness` have none ("a path can name a value
 * with no literal stored counterpart... precisely because it is derived") and are
 * `read_only_field` (§14) if content ever targets them with a `Modifier`.
 *
 * This resolver has no opinion on how a caller arrives at `base` for those four formula-only
 * paths — computing `career.effectivePerformance` from `JobPerformanceRules.factors` needs
 * `JobDefinition`, content this unit deliberately doesn't wire. The caller supplies whatever
 * `base` its own formula produces; `resolve` only layers modifiers over it.
 */

import type { AttributeState, NeedKey } from "./actor.js";
import type { StatusEffect } from "./state.js";
import { collectModifiers, combineModifiers } from "./modifiers.js";

export type DerivedPath =
  | `player.needs.${NeedKey}`
  | `player.attributes.${keyof AttributeState}`
  | `player.skills.${string}`
  | "player.housing.quality"
  | "player.career.effectivePerformance"
  | "calendar.energyRecoveryRate"
  | "world.strangeness";

export interface DerivedValueResolver {
  resolve(path: DerivedPath, base: number, effects: readonly StatusEffect[]): number;
  isReadOnly(path: string): boolean;
}

const READ_ONLY_PATHS: ReadonlySet<string> = new Set<string>([
  "player.housing.quality",
  "player.career.effectivePerformance",
  "calendar.energyRecoveryRate",
  "world.strangeness",
]);

/** `player.needs.*`/`player.attributes.*`/`player.skills.*` clamp to the shared 0–100
 *  integer range (§6.2). The four read-only formula paths have no declared range stated in
 *  this contract yet, so `resolve` leaves them unclamped — provisional, the same status
 *  §6.1's own caching-strategy callout already carries for this section. */
function clampToDeclaredRange(path: DerivedPath, value: number): number {
  if (
    path.startsWith("player.needs.")
    || path.startsWith("player.attributes.")
    || path.startsWith("player.skills.")
  ) {
    return Math.min(100, Math.max(0, value));
  }
  return value;
}

export const derivedValueResolver: DerivedValueResolver = {
  resolve(path, base, effects) {
    const modifiers = collectModifiers(effects, path);
    const combined = combineModifiers(base, modifiers);
    return clampToDeclaredRange(path, combined);
  },
  isReadOnly(path) {
    return READ_ONLY_PATHS.has(path);
  },
};
