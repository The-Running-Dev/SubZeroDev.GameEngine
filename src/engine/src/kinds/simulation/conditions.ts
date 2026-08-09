/**
 * Simulation kind — condition field resolution against `SimulationKindState`.
 *
 * Contract: `10-simulation-kind.md` §8 (reused core `Condition`), §7.1 (addressing).
 *
 * Unlike `kinds/story-graph/conditions.ts`'s small closed namespace (`var.*`, `turn`,
 * `visited.*`, `achieved.*`), this kind's fields are arbitrary dotted paths into a much
 * larger state tree, so `resolveField` walks the path generically — plain property access
 * per segment — rather than a fixed `if`/`else` per legal field. That covers everything
 * this unit's own goal/failure conditions need (`player.needs.*`, `player.finances.*`,
 * `calendar.currentWeek`, …) without hand-maintaining a list.
 *
 * **Collections are not supported yet.** §7.1's addressing table (`player.relationships.
 * <npcId>.affinity` and friends) exists for *content* targeting a collection member by its
 * natural key — a different concern from a `Condition`'s own `exists`/`count` operators,
 * which need a `ConditionResolver.collection` that returns one resolver per array item.
 * Nothing this unit wires needs that yet (goal/failure conditions here only ever compare
 * scalar fields), so `collection` throws — the same honest-gap pattern `story-graph`'s own
 * conditions module uses for what it doesn't support, adjusted from "never" to "not yet."
 * **Revisit when** a goal or event condition needs `exists`/`count` over a real collection.
 */

import type { Condition, ConditionResolver } from "../../core/condition/types.js";
import { evaluateCondition } from "../../core/condition/evaluate.js";
import type { SimulationKindState } from "./state.js";
import { resolveEffectiveField } from "./derived.js";

/** `player.needs.*`/`player.attributes.*`/`player.skills.*` resolve through
 *  `resolveEffectiveField` first — §6.1's derived values are computed on every read, and a
 *  goal or failure condition reading the raw stored value instead would disagree with what
 *  `SimulationView` and `scene.ts` show for the same field. Every other path falls through to
 *  the generic walk below unchanged. */
/**
 * **An unrecorded counter is zero, not missing (W57).** `player.counters` (§6.2) is built by
 * `advance.ts`'s automatic fold, which creates a key the first time a `StateChange` carries
 * that reason — so before anything of a given kind has happened, the key simply is not
 * there, and the generic walk below would resolve `undefined` and the evaluator would throw
 * on a numeric comparison. "Nothing has happened yet" is a real, answerable state of the
 * game, and the answer is zero: `counters[reason] = (counters[reason] ?? 0) + 1` is already
 * how the fold itself reads an absent key.
 *
 * This is reachable for the first time in W57, because `AchievementDefinition.condition` is
 * the first condition evaluated against counters at all, and §7.9 says an achievement is
 * "typically over counters" — so the very first achievement authored would have thrown in
 * week one. Scoped deliberately to `player.counters.*`: every other absent path stays an
 * error, since a typo'd `player.finances.cashCent` should still be loud.
 */
function counterOrZero(state: SimulationKindState, path: string): number | undefined {
  if (!path.startsWith("player.counters.")) return undefined;
  return state.player.counters[path.slice("player.counters.".length)] ?? 0;
}

export function resolveField(state: SimulationKindState, path: string): unknown {
  const effective = resolveEffectiveField(state, path);
  if (effective !== undefined) return effective;

  const counter = counterOrZero(state, path);
  if (counter !== undefined) return counter;

  let current: unknown = state;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") {
      throw new Error(`simulation conditions: unresolvable field "${path}"`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function unresolvableCollection(name: string): never {
  throw new Error(`simulation conditions: no collection support yet ("${name}")`);
}

export function evaluateSimulationCondition(condition: Condition, state: SimulationKindState): boolean {
  const resolver: ConditionResolver = {
    field: (path) => resolveField(state, path),
    collection: unresolvableCollection,
  };
  return evaluateCondition(condition, resolver);
}
