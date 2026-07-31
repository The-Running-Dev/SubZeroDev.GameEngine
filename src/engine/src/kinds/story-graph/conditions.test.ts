import { describe, it, expect } from "vitest";
import { evaluateStoryGraphCondition, resolveField, validateConditionFields, type ConditionContext } from "./conditions.js";
import type { VariableSchema } from "./variables.js";
import type { Condition } from "../../core/condition/types.js";

const context: ConditionContext = {
  variables: { patience: 3, office_visits: 3, builds_character: true },
  turn: 7,
  visitedCounts: { municipality: 2 },
  unlockedAchievements: ["it_builds_character"],
};

describe("resolveField", () => {
  it("resolves var.<name> from variables", () => {
    expect(resolveField(context, "var.patience")).toBe(3);
  });

  it("resolves turn directly", () => {
    expect(resolveField(context, "turn")).toBe(7);
  });

  it("resolves visited.<nodeId>, defaulting to 0 for a node never entered", () => {
    expect(resolveField(context, "visited.municipality")).toBe(2);
    expect(resolveField(context, "visited.never_seen")).toBe(0);
  });

  it("resolves achieved.<id> to a boolean", () => {
    expect(resolveField(context, "achieved.it_builds_character")).toBe(true);
    expect(resolveField(context, "achieved.something_else")).toBe(false);
  });

  it("resolves ending — undefined while active, the id once ended", () => {
    expect(resolveField(context, "ending")).toBeUndefined();
    expect(resolveField({ ...context, endingId: "it_builds_character" }, "ending")).toBe("it_builds_character");
  });

  it("throws for an unrecognized field", () => {
    expect(() => resolveField(context, "foo.bar")).toThrow();
  });
});

describe("evaluateStoryGraphCondition — the Bureaucracy arc's real conditions (03 §12)", () => {
  it("var.patience <= 3 (question_reality's requirement)", () => {
    const condition: Condition = { field: "var.patience", operator: "less_or_equal", value: 3 };
    expect(evaluateStoryGraphCondition(condition, context)).toBe(true);
    expect(evaluateStoryGraphCondition(condition, { ...context, variables: { patience: 4 } })).toBe(false);
  });

  it("var.office_visits >= 3 (go_home's requirement)", () => {
    const condition: Condition = { field: "var.office_visits", operator: "greater_or_equal", value: 3 };
    expect(evaluateStoryGraphCondition(condition, context)).toBe(true);
    expect(evaluateStoryGraphCondition(condition, { ...context, variables: { office_visits: 2 } })).toBe(false);
  });

  it("var.builds_character == true (the achievement's condition)", () => {
    const condition: Condition = { field: "var.builds_character", operator: "equals", value: true };
    expect(evaluateStoryGraphCondition(condition, context)).toBe(true);
    expect(evaluateStoryGraphCondition(condition, { ...context, variables: { builds_character: false } })).toBe(false);
  });
});

describe("evaluateStoryGraphCondition — no collection is ever valid", () => {
  it("throws on exists", () => {
    const condition: Condition = { exists: { collection: "anything", where: { field: "turn", operator: "equals", value: 0 } } };
    expect(() => evaluateStoryGraphCondition(condition, context)).toThrow();
  });
});

const schema: VariableSchema = {
  patience: { type: "int", initial: 10 },
};
const nodeIds = new Set(["municipality", "clerk_review"]);

describe("validateConditionFields", () => {
  it("accepts a declared var.<name>", () => {
    expect(validateConditionFields({ field: "var.patience", operator: "equals", value: 1 }, schema, nodeIds)).toEqual([]);
  });

  it("rejects an undeclared var.<name>", () => {
    const errors = validateConditionFields({ field: "var.nope", operator: "equals", value: 1 }, schema, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("unknown_condition_field");
    expect(errors[0]!.path).toBe("var.nope");
  });

  it("accepts turn and ending", () => {
    expect(validateConditionFields({ field: "turn", operator: "equals", value: 1 }, schema, nodeIds)).toEqual([]);
    expect(validateConditionFields({ field: "ending", operator: "equals", value: "x" }, schema, nodeIds)).toEqual([]);
  });

  it("accepts visited.<nodeId> for a real node, rejects a fake one", () => {
    expect(validateConditionFields({ field: "visited.municipality", operator: "equals", value: 1 }, schema, nodeIds)).toEqual([]);
    const errors = validateConditionFields({ field: "visited.fake_node", operator: "equals", value: 1 }, schema, nodeIds);
    expect(errors).toHaveLength(1);
  });

  it("accepts any non-empty achieved.<id>", () => {
    expect(validateConditionFields({ field: "achieved.anything", operator: "equals", value: true }, schema, nodeIds)).toEqual([]);
  });

  it("rejects a garbage field", () => {
    const errors = validateConditionFields({ field: "foo.bar", operator: "equals", value: 1 }, schema, nodeIds);
    expect(errors).toHaveLength(1);
  });

  it("recurses through all/any/not", () => {
    const condition: Condition = {
      all: [
        { field: "var.patience", operator: "equals", value: 1 },
        { any: [{ not: { field: "var.nope", operator: "equals", value: 1 } }] },
      ],
    };
    const errors = validateConditionFields(condition, schema, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.path).toBe("var.nope");
  });

  it("rejects exists/count on their collection, regardless of contents", () => {
    const condition: Condition = {
      exists: { collection: "world.npcs", where: { field: "var.patience", operator: "equals", value: 1 } },
    };
    const errors = validateConditionFields(condition, schema, nodeIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.path).toBe("world.npcs");
  });
});
