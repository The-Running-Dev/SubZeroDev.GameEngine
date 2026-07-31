/**
 * Story-graph kind — typed variables and consequences.
 *
 * Contract: `03-story-graph-kind.md` §2, §5, §8.1.
 *
 * The one place a story-graph game is allowed to mutate a variable: every write goes
 * through `applyConsequences`, which is typed against a declared `VariableSchema` and
 * clamps once, after a whole transition's effects have applied — not after each one
 * (see `plans/16-w9-variables-and-consequences.md`, Decision 2).
 *
 * Undeclared-variable and mistyped writes throw rather than returning a `ValidationError`
 * — 03 §11 assigns that check to Tier 1 load-time validation (W14, `validateCampaign`),
 * which a well-formed campaign has already passed by the time any of this runs. This
 * guard is the runtime backstop for content that shouldn't be able to reach here, the
 * same precedent `determinism/pcg32.ts`'s `weightedPick` sets for an all-zero-weight
 * `random` node. See plan 16, Decision 1.
 *
 * Two defensive-hardening notes (both raised in PR #41 review, matching the pattern
 * `canonical.ts`/`pcg32.ts` already apply to foreign/corrupted input):
 * - `increment`/`decrement` validate that both the running value and `by` are finite
 *   integers before doing arithmetic, so corrupted `kindState` or a bad delta can't
 *   produce a `NaN`/`Infinity` that later crashes canonical serialization.
 * - Variable maps use a null-prototype object (`Object.create(null)`), and lookups use
 *   `Object.hasOwn`, so a schema-declared variable literally named `__proto__` can't have
 *   its writes silently swallowed by the prototype accessor, and an inherited
 *   `Object.prototype` member name can't be misread as a declared variable.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";

export type VarType = "bool" | "int" | "enum";

export type VarValue = boolean | number | string;

export interface VariableDecl {
  type: VarType;
  initial: VarValue;

  values?: string[]; // enum only — the allowed values
  min?: number; // int only — clamp floor
  max?: number; // int only — clamp ceiling

  visible?: boolean; // surfaced to the player as a stat
  labelKey?: LocKey; // required when visible
}

export type VariableSchema = Record<string, VariableDecl>;

export type Consequence =
  | { op: "set"; var: string; value: VarValue }
  | { op: "increment"; var: string; by: number } // int only
  | { op: "decrement"; var: string; by: number }; // int only

/**
 * Seeds the runtime `variables` map from a schema's declared `initial` values, walking
 * the schema's keys sorted rather than in declaration order — a `Record` iterated in a
 * state-affecting way is sorted first, so two structurally-equal schemas authored with
 * their entries in different orders still produce indistinguishable output (plan 16,
 * Decision 4).
 */
export function buildInitialVariables(schema: VariableSchema): Record<string, VarValue> {
  const variables: Record<string, VarValue> = Object.create(null) as Record<string, VarValue>;
  for (const name of Object.keys(schema).sort()) {
    const decl = schema[name]!;
    checkSetValue(name, decl, decl.initial);
    variables[name] = decl.initial;
  }
  return variables;
}

function requireDecl(schema: VariableSchema, name: string): VariableDecl {
  if (!Object.hasOwn(schema, name)) {
    throw new Error(`story-graph variables: undeclared variable "${name}"`);
  }
  return schema[name]!;
}

function checkSetValue(name: string, decl: VariableDecl, value: VarValue): void {
  switch (decl.type) {
    case "bool":
      if (typeof value !== "boolean") {
        throw new Error(`story-graph variables: "${name}" is bool, got ${typeof value} value`);
      }
      return;
    case "int":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`story-graph variables: "${name}" is int, got ${JSON.stringify(value)}`);
      }
      return;
    case "enum":
      if (typeof value !== "string" || !decl.values?.includes(value)) {
        throw new Error(`story-graph variables: "${name}" is enum, got invalid member ${JSON.stringify(value)}`);
      }
      return;
  }
}

function requireInt(name: string, decl: VariableDecl, op: string): void {
  if (decl.type !== "int") {
    throw new Error(`story-graph variables: "${op}" requires an int variable, "${name}" is ${decl.type}`);
  }
}

function requireFiniteInt(label: string, value: number): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`story-graph variables: ${label} is not a finite integer (${JSON.stringify(value)})`);
  }
}

function clamp(decl: VariableDecl, value: number): number {
  let v = value;
  if (decl.min !== undefined && v < decl.min) v = decl.min;
  if (decl.max !== undefined && v > decl.max) v = decl.max;
  return v;
}

/**
 * Applies a batch of typed consequences — one transition's `effects` array — against
 * declared variables. Accumulates raw (unclamped) values per touched variable across the
 * whole batch and clamps `int`s exactly once at the end, so a `+5` then `-5` nets to zero
 * rather than clipping against a bound it only ever transiently crossed (plan 16,
 * Decision 2). Returns a new `variables` object (the input is never mutated) plus one
 * coalesced `StateChange` per touched variable, sorted by name (plan 16, Decisions 3–4).
 */
export function applyConsequences(
  schema: VariableSchema,
  variables: Readonly<Record<string, VarValue>>,
  consequences: readonly Consequence[],
): { variables: Record<string, VarValue>; changes: StateChange[] } {
  const next: Record<string, VarValue> = Object.create(null) as Record<string, VarValue>;
  for (const key of Object.keys(variables)) next[key] = variables[key] as VarValue;
  const before = new Map<string, VarValue>();

  for (const c of consequences) {
    const decl = requireDecl(schema, c.var);
    if (!before.has(c.var)) before.set(c.var, variables[c.var] as VarValue);

    switch (c.op) {
      case "set":
        checkSetValue(c.var, decl, c.value);
        next[c.var] = c.value;
        break;
      case "increment":
        requireInt(c.var, decl, "increment");
        requireFiniteInt(`"${c.var}"'s current value`, next[c.var] as number);
        requireFiniteInt(`"${c.var}" increment amount`, c.by);
        next[c.var] = (next[c.var] as number) + c.by;
        break;
      case "decrement":
        requireInt(c.var, decl, "decrement");
        requireFiniteInt(`"${c.var}"'s current value`, next[c.var] as number);
        requireFiniteInt(`"${c.var}" decrement amount`, c.by);
        next[c.var] = (next[c.var] as number) - c.by;
        break;
    }
  }

  const changes: StateChange[] = [];
  for (const name of Array.from(before.keys()).sort()) {
    const decl = schema[name]!;
    if (decl.type === "int") {
      next[name] = clamp(decl, next[name] as number);
    }

    changes.push({
      path: `var.${name}`,
      op: "set",
      value: next[name] as VarValue,
      previous: before.get(name)!,
      reason: "consequence_applied",
      visible: decl.visible ?? false,
    });
  }

  return { variables: next, changes };
}
