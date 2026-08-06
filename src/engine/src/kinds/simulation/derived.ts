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

import type { AttributeState, NeedKey, NeedState } from "./actor.js";
import type { SimulationKindState, StatusEffect } from "./state.js";
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

/**
 * Resolves one dotted field path to its effective (derived) value when `path` names a
 * `player.needs.*`, `player.attributes.*`, or `player.skills.*` field — the three
 * `DerivedPath` members with a real stored base this unit wires. Returns `undefined` for
 * every other path (including the four formula-only paths, which need a caller-supplied
 * `base` this function has no way to produce), so a caller with its own generic field
 * resolution — `conditions.ts`'s `resolveField` — can fall back to it. Every reader of a
 * `player.needs.*`/`player.attributes.*`/`player.skills.*` value must resolve through here
 * (or `resolveEffective{Needs,Attributes,Skills}` below): §6.1's "computed on read" is not
 * scoped to the projection alone, and a second, un-modifier-aware read path is exactly the
 * `Scene.body`-vs-`Scene.view`/goal-condition disagreement this function closes.
 */
export function resolveEffectiveField(state: SimulationKindState, path: string): number | undefined {
  if (path.startsWith("player.needs.")) {
    const key = path.slice("player.needs.".length) as NeedKey;
    const base = state.player.needs[key];
    return base === undefined ? undefined : derivedValueResolver.resolve(path as DerivedPath, base, state.activeEffects);
  }
  if (path.startsWith("player.attributes.")) {
    const key = path.slice("player.attributes.".length) as keyof AttributeState;
    const base = state.player.attributes[key];
    return base === undefined ? undefined : derivedValueResolver.resolve(path as DerivedPath, base, state.activeEffects);
  }
  if (path.startsWith("player.skills.")) {
    const key = path.slice("player.skills.".length);
    const base = state.player.skills[key];
    return base === undefined ? undefined : derivedValueResolver.resolve(path as DerivedPath, base, state.activeEffects);
  }
  return undefined;
}

/** Effective (derived) needs — shared by every reader (`view.ts`'s `SimulationView.needs`,
 *  `scene.ts`'s status text) so none of them can drift back to the raw stored value. */
export function resolveEffectiveNeeds(state: SimulationKindState): NeedState {
  const { needs } = state.player;
  const { activeEffects } = state;
  return {
    health: derivedValueResolver.resolve("player.needs.health", needs.health, activeEffects),
    energy: derivedValueResolver.resolve("player.needs.energy", needs.energy, activeEffects),
    happiness: derivedValueResolver.resolve("player.needs.happiness", needs.happiness, activeEffects),
    stress: derivedValueResolver.resolve("player.needs.stress", needs.stress, activeEffects),
    satiety: derivedValueResolver.resolve("player.needs.satiety", needs.satiety, activeEffects),
  };
}

/** Effective (derived) attributes, `luck` excluded per `SimulationView`'s own rule — same
 *  base/derived split as `resolveEffectiveNeeds`. */
export function resolveEffectiveAttributes(state: SimulationKindState): Omit<AttributeState, "luck"> {
  const { attributes } = state.player;
  const { activeEffects } = state;
  return {
    intelligence: derivedValueResolver.resolve("player.attributes.intelligence", attributes.intelligence, activeEffects),
    discipline: derivedValueResolver.resolve("player.attributes.discipline", attributes.discipline, activeEffects),
    charisma: derivedValueResolver.resolve("player.attributes.charisma", attributes.charisma, activeEffects),
    creativity: derivedValueResolver.resolve("player.attributes.creativity", attributes.creativity, activeEffects),
    resilience: derivedValueResolver.resolve("player.attributes.resilience", attributes.resilience, activeEffects),
    wisdom: derivedValueResolver.resolve("player.attributes.wisdom", attributes.wisdom, activeEffects),
  };
}

/** Effective (derived) skills — sorted iteration (§2) applies the same as every other
 *  `Record`-typed field in `SimulationView`. */
export function resolveEffectiveSkills(state: SimulationKindState): Record<string, number> {
  const skills: Record<string, number> = {};
  for (const key of Object.keys(state.player.skills).sort()) {
    skills[key] = derivedValueResolver.resolve(`player.skills.${key}`, state.player.skills[key]!, state.activeEffects);
  }
  return skills;
}
