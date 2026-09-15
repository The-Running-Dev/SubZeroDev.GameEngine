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
 * **Collections (W111, §8.2).** `ConditionResolver.collection` supports exactly the seven
 * paths §8.2's closed table names — `player.inventory`, `player.relationships`,
 * `player.career.pendingApplications`, `player.education.enrollments`, `player.projects`,
 * `player.businesses`, `world.npcs` — each resolving to its state array. `where` reads a
 * field relative to one array element (`resolveItemField`, a non-throwing walk: an absent
 * field, such as an item's `category` which lives only on its content definition, resolves
 * to `undefined` and so never matches, rather than raising the "loud" error `resolveField`
 * raises for a bad top-level path). A collection name outside the seven throws here too —
 * defence in depth — but the load-bearing check is `validate.ts`'s Tier 1 `unknown_collection`,
 * which rejects an unlisted name at load time, before any condition naming it is ever
 * evaluated. A nested `exists`/`count` inside a `where` clause still resolves its own
 * `collection` against this same state-rooted table, never against the enclosing item —
 * §8.2 gives every collection name one fixed meaning regardless of nesting depth.
 */

import type { Condition, ConditionResolver } from "../../core/condition/types.js";
import { evaluateCondition } from "../../core/condition/evaluate.js";
import type { SimulationKindState } from "./state.js";
import { resolveEffectiveField } from "./derived.js";

/** `player.needs.*`/`player.attributes.*`/`player.skills.*`/`player.reputation.*` resolve through
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

/** §8.2's closed seven-path table — the only names `resolveCollection` accepts. */
const COLLECTION_ACCESSORS: Readonly<Record<string, (state: SimulationKindState) => readonly unknown[]>> = {
  "player.inventory": (state) => state.player.inventory,
  "player.relationships": (state) => state.player.relationships,
  "player.career.pendingApplications": (state) => state.player.career.pendingApplications,
  "player.education.enrollments": (state) => state.player.education.enrollments,
  "player.projects": (state) => state.player.projects,
  "player.businesses": (state) => state.player.businesses,
  "world.npcs": (state) => state.world.npcs,
};

/** A `where` field is relative to one collection item, not the full state — an absent field
 *  (an item's `category`, which lives only on its content definition and never reaches the
 *  resolver) resolves to `undefined` rather than throwing, so it simply never matches. */
function resolveItemField(item: unknown, path: string): unknown {
  let current: unknown = item;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function resolveCollection(state: SimulationKindState, name: string): readonly ConditionResolver[] {
  const accessor = COLLECTION_ACCESSORS[name];
  if (accessor === undefined) {
    throw new Error(`simulation conditions: unknown collection "${name}"`);
  }
  return accessor(state).map((item) => ({
    field: (path: string) => resolveItemField(item, path),
    collection: (nested: string) => resolveCollection(state, nested),
  }));
}

export function evaluateSimulationCondition(condition: Condition, state: SimulationKindState): boolean {
  const resolver: ConditionResolver = {
    field: (path) => resolveField(state, path),
    collection: (name) => resolveCollection(state, name),
  };
  return evaluateCondition(condition, resolver);
}
