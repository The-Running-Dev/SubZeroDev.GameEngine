/**
 * The frozen `Condition` tree — shared, kind-agnostic.
 *
 * Contract: `04-core.md` §18, which declares the operator set frozen but does not restate
 * its shape; the shape ported here is `games/04-engine-specification.md` §13.1 (the
 * ancestor spec, in the companion SubZeroDev.GameOfLife repo). That doc's `Condition` also
 * carries a `CollectionSelector` — a closed union of simulation-kind paths
 * (`player.inventory`, `world.npcs`, ...). None of those are kind-agnostic, so they don't
 * port: `collection` here is a plain `string`, and what strings are legal is entirely up to
 * whichever kind resolves them (`kinds/story-graph/conditions.ts` for this one). See
 * `plans/17-w10-conditions-and-requirements.md`, Decision 1.
 */

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "less_than"
  | "less_or_equal"
  | "greater_than"
  | "greater_or_equal"
  | "in"
  | "not_in"
  | "contains"
  | "has_tag"
  | "has_flag";

export interface ComparisonCondition {
  field: string;
  operator: ComparisonOperator;
  /**
   * Optional, not merely `unknown` -- `not_equals` against an absent field reads as "field is
   * set to something," authored as `value: undefined` (`campaigns/bulgaria-bureaucracy.ts`).
   * That satisfied `value: unknown` at the TypeScript level, but `JSON.stringify` silently
   * drops an `undefined`-valued key, so the published wire document never actually carried
   * `value` for that condition -- a `value: unknown` (required) schema is stricter than what
   * this engine has ever actually produced or needed. `value?:` makes the type honestly
   * describe the wire format; `compare` (`evaluate.ts`) already reads a missing `value` the
   * same way it reads an explicit `undefined` one, so this is a type-only change.
   */
  value?: unknown;
}

export interface AllCondition {
  all: Condition[];
}

export interface AnyCondition {
  any: Condition[];
}

export interface NotCondition {
  not: Condition;
}

export interface ExistsCondition {
  exists: { collection: string; where: Condition };
}

/**
 * `count`'s own comparison is always two numbers (a match total against `value`) — the
 * six ordering/equality operators, never the array/string-shaped ones (`in`, `contains`,
 * `has_tag`, `has_flag`), which would type-check but always throw at evaluation.
 */
export type CountComparisonOperator =
  | "equals"
  | "not_equals"
  | "less_than"
  | "less_or_equal"
  | "greater_than"
  | "greater_or_equal";

export interface CountCondition {
  count: { collection: string; where: Condition };
  operator: CountComparisonOperator;
  value: number;
}

export type Condition =
  | ComparisonCondition
  | AllCondition
  | AnyCondition
  | NotCondition
  | ExistsCondition
  | CountCondition;

/**
 * What a caller supplies to `evaluateCondition` — the evaluator itself knows nothing
 * about `var.*`, story nodes, or any other kind's field vocabulary. `collection` returns
 * one resolver per item, each able to resolve `where`'s fields relative to that item.
 */
export interface ConditionResolver {
  field(path: string): unknown;
  collection(name: string): readonly ConditionResolver[];
}
