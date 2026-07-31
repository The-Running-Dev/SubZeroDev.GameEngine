/**
 * Story-graph kind — the condition field namespace (03 §6): `var.*`, `turn`, `visited.*`,
 * `achieved.*`, `ending`.
 *
 * Contract: `03-story-graph-kind.md` §6, §11.
 *
 * `ConditionContext` is deliberately narrower than the full `StoryGraphKindState` (03
 * §8.1) — it carries only the fields this namespace resolves against. `currentNodeId`
 * plays no part in condition evaluation, so it isn't here; W11 folds this context into
 * the full kind state as a structural superset, not a rename (plan 17, Decision 4).
 *
 * `validateConditionFields` returns `ValidationError[]` rather than throwing — unlike
 * W9's typed-write guard, this check *is* Tier 1 territory (03 §11: "every variable in a
 * condition... is declared"), so it produces the same audit shape `Kind.validateCampaign`
 * (W14) will eventually fold in. See plan 17, Decision 3.
 */

import type { VariableSchema } from "./variables.js";
import type { Condition, ConditionResolver } from "../../core/condition/types.js";
import { evaluateCondition } from "../../core/condition/evaluate.js";
import type { ValidationError } from "../../core/validation/types.js";
import type { StoryGraphKindState } from "./state.js";

export interface ConditionContext {
  variables: Readonly<Record<string, unknown>>;
  turn: number;
  visitedCounts: Readonly<Record<string, number>>;
  unlockedAchievements: readonly string[];
  endingId?: string;
}

/**
 * The `StoryGraphKindState → ConditionContext` adapter — both `scene.ts` (choice gating)
 * and `advance.ts` (`showWhen`/`requirements` evaluation, 03 §8.2 steps 1–2) need it.
 */
export function toConditionContext(state: StoryGraphKindState): ConditionContext {
  return {
    variables: state.variables,
    turn: state.turn,
    visitedCounts: state.visitedCounts,
    unlockedAchievements: state.unlockedAchievements,
    ...(state.endingId !== undefined ? { endingId: state.endingId } : {}),
  };
}

/**
 * No collection is ever valid for this kind (plan 17, Decision 1) — `exists`/`count`
 * reach here only if `validateConditionFields` was skipped, so this is the same
 * runtime-backstop-throws pattern as W9's Decision 1.
 */
function unresolvableCollection(name: string): never {
  throw new Error(`story-graph conditions: no collection "${name}" — this kind declares none`);
}

export function resolveField(context: ConditionContext, path: string): unknown {
  if (path === "turn") return context.turn;
  if (path === "ending") return context.endingId;

  if (path.startsWith("var.")) {
    const name = path.slice("var.".length);
    return context.variables[name];
  }

  if (path.startsWith("visited.")) {
    const nodeId = path.slice("visited.".length);
    return context.visitedCounts[nodeId] ?? 0;
  }

  if (path.startsWith("achieved.")) {
    const id = path.slice("achieved.".length);
    return context.unlockedAchievements.includes(id);
  }

  throw new Error(`story-graph conditions: unresolvable field "${path}"`);
}

export function evaluateStoryGraphCondition(condition: Condition, context: ConditionContext): boolean {
  const resolver: ConditionResolver = {
    field: (path) => resolveField(context, path),
    collection: unresolvableCollection,
  };
  return evaluateCondition(condition, resolver);
}

function isValidField(path: string, schema: VariableSchema, nodeIds: ReadonlySet<string>): boolean {
  if (path === "turn" || path === "ending") return true;
  if (path.startsWith("var.")) return Object.hasOwn(schema, path.slice("var.".length));
  if (path.startsWith("visited.")) return nodeIds.has(path.slice("visited.".length));
  if (path.startsWith("achieved.")) return path.length > "achieved.".length;
  return false;
}

/**
 * Walks every comparison leaf in `condition`, reporting a Tier 1 error for each field
 * path that isn't legal for this kind. `exists`/`count` are rejected on their `collection`
 * alone, without walking into `where` — a field meaningful only relative to a collection
 * item would spuriously fail this state-level check, and the node is already invalid
 * regardless (plan 17, Decision 3).
 */
export function validateConditionFields(
  condition: Condition,
  schema: VariableSchema,
  nodeIds: ReadonlySet<string>,
): ValidationError[] {
  if ("all" in condition) return condition.all.flatMap((c) => validateConditionFields(c, schema, nodeIds));
  if ("any" in condition) return condition.any.flatMap((c) => validateConditionFields(c, schema, nodeIds));
  if ("not" in condition) return validateConditionFields(condition.not, schema, nodeIds);

  if ("exists" in condition || "count" in condition) {
    const collection = "exists" in condition ? condition.exists.collection : condition.count.collection;
    return [
      {
        code: "unknown_condition_field",
        messageKey: "story-graph.reason.unknown_condition_field",
        path: collection,
      },
    ];
  }

  if (isValidField(condition.field, schema, nodeIds)) return [];
  return [
    {
      code: "unknown_condition_field",
      messageKey: "story-graph.reason.unknown_condition_field",
      path: condition.field,
    },
  ];
}
