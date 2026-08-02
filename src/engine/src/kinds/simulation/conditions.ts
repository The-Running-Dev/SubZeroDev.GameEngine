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

export function resolveField(state: SimulationKindState, path: string): unknown {
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
