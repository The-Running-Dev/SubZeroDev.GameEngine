/**
 * The frozen `Condition` evaluator — generic over a caller-supplied `ConditionResolver`.
 *
 * Contract: `04-core.md` §18. Semantics for the operators the story-graph worked example
 * (03 §12) never exercises are this module's own fixed choice, not restated anywhere —
 * see `plans/17-w10-conditions-and-requirements.md`, Decision 2.
 */

import type { ComparisonOperator, Condition, ConditionResolver } from "./types.js";

export function evaluateCondition(condition: Condition, resolver: ConditionResolver): boolean {
  if ("all" in condition) return condition.all.every((c) => evaluateCondition(c, resolver));
  if ("any" in condition) return condition.any.some((c) => evaluateCondition(c, resolver));
  if ("not" in condition) return !evaluateCondition(condition.not, resolver);

  if ("exists" in condition) {
    const items = resolver.collection(condition.exists.collection);
    return items.some((item) => evaluateCondition(condition.exists.where, item));
  }

  if ("count" in condition) {
    const items = resolver.collection(condition.count.collection);
    const matched = items.filter((item) => evaluateCondition(condition.count.where, item)).length;
    return compare(condition.operator, matched, condition.value);
  }

  return compare(condition.operator, resolver.field(condition.field), condition.value);
}

function requireNumber(label: string, value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`condition: expected a number for ${label}, got ${typeof value} (${JSON.stringify(value)})`);
  }
  return value;
}

function membershipTarget(value: unknown, field: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value.includes(field) ? [field] : [];
  throw new Error(`condition: expected an array value, got ${typeof value} (${JSON.stringify(value)})`);
}

function compare(operator: ComparisonOperator, field: unknown, value: unknown): boolean {
  switch (operator) {
    case "equals":
      return field === value;
    case "not_equals":
      return field !== value;
    case "less_than":
      return requireNumber("field", field) < requireNumber("value", value);
    case "less_or_equal":
      return requireNumber("field", field) <= requireNumber("value", value);
    case "greater_than":
      return requireNumber("field", field) > requireNumber("value", value);
    case "greater_or_equal":
      return requireNumber("field", field) >= requireNumber("value", value);
    case "in":
      return membershipTarget(value, field).length > 0;
    case "not_in":
      return membershipTarget(value, field).length === 0;
    case "contains":
      if (typeof field === "string") return field.includes(String(value));
      if (Array.isArray(field)) return field.includes(value);
      throw new Error(`condition: "contains" needs a string or array field, got ${typeof field}`);
    case "has_tag":
    case "has_flag":
      if (Array.isArray(field)) return field.includes(value);
      throw new Error(`condition: "${operator}" needs an array field, got ${typeof field}`);
  }
}
