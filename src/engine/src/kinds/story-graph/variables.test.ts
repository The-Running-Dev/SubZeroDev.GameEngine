import { describe, it, expect } from "vitest";
import { applyConsequences, buildInitialVariables, type VariableSchema } from "./variables.js";
import { canonicalStringify } from "../../core/persistence/canonical.js";

const schema: VariableSchema = {
  money: { type: "int", initial: 2, min: 0, max: 3 },
  hidden_flag: { type: "bool", initial: false },
  mood: { type: "enum", initial: "neutral", values: ["neutral", "happy", "sad"], visible: true },
};

describe("buildInitialVariables", () => {
  it("reproduces every schema's declared initial value", () => {
    expect(buildInitialVariables(schema)).toEqual({ money: 2, hidden_flag: false, mood: "neutral" });
  });

  it("produces canonically identical output regardless of schema declaration order", () => {
    const reordered: VariableSchema = {
      mood: schema.mood!,
      hidden_flag: schema.hidden_flag!,
      money: schema.money!,
    };
    expect(canonicalStringify(buildInitialVariables(schema))).toBe(canonicalStringify(buildInitialVariables(reordered)));
  });
});

describe("applyConsequences — guards", () => {
  it("throws on set to an undeclared variable", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "set", var: "nope", value: 1 }])).toThrow();
  });

  it("throws on increment of an undeclared variable", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "increment", var: "nope", by: 1 }])).toThrow();
  });

  it("throws on decrement of an undeclared variable", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "decrement", var: "nope", by: 1 }])).toThrow();
  });

  it("throws when set gives a bool variable a non-boolean value", () => {
    const variables = buildInitialVariables(schema);
    expect(() =>
      applyConsequences(schema, variables, [{ op: "set", var: "hidden_flag", value: 1 as unknown as boolean }]),
    ).toThrow();
  });

  it("throws when set gives an int variable a non-number value", () => {
    const variables = buildInitialVariables(schema);
    expect(() =>
      applyConsequences(schema, variables, [{ op: "set", var: "money", value: "3" as unknown as number }]),
    ).toThrow();
  });

  it("throws when set gives an int variable a non-integer number", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "set", var: "money", value: 1.5 }])).toThrow();
  });

  it("throws when set gives an enum variable a non-member string", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "set", var: "mood", value: "furious" }])).toThrow();
  });

  it("throws on increment against a bool variable", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "increment", var: "hidden_flag", by: 1 }])).toThrow();
  });

  it("throws on decrement against an enum variable", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "decrement", var: "mood", by: 1 }])).toThrow();
  });

  it("throws on increment by a non-integer amount", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "increment", var: "money", by: 1.5 }])).toThrow();
  });

  it("throws on increment by NaN or Infinity", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "increment", var: "money", by: NaN }])).toThrow();
    expect(() => applyConsequences(schema, variables, [{ op: "increment", var: "money", by: Infinity }])).toThrow();
  });

  it("throws on increment against a corrupted (non-integer) current value", () => {
    const corrupted = { ...buildInitialVariables(schema), money: 1.5 };
    expect(() => applyConsequences(schema, corrupted, [{ op: "increment", var: "money", by: 1 }])).toThrow();
  });

  it("throws building initial variables from a schema with a non-integer int initial", () => {
    const badSchema: VariableSchema = { money: { type: "int", initial: 1.5 } };
    expect(() => buildInitialVariables(badSchema)).toThrow();
  });

  it("a variable named __proto__ is written and read like any other declared variable", () => {
    // Object-literal syntax specially interprets a literal `__proto__: ...` key as setting
    // the prototype rather than an own property — parsing JSON (as authored campaign
    // content would be) is how a genuine own "__proto__" key actually arises.
    const protoSchema: VariableSchema = JSON.parse('{"__proto__":{"type":"int","initial":1}}') as VariableSchema;
    expect(Object.hasOwn(protoSchema, "__proto__")).toBe(true);

    const variables = buildInitialVariables(protoSchema);
    expect(Object.keys(variables)).toEqual(["__proto__"]);
    expect((variables as Record<string, unknown>).__proto__).toBe(1);

    const result = applyConsequences(protoSchema, variables, [{ op: "increment", var: "__proto__", by: 1 }]);
    expect((result.variables as Record<string, unknown>).__proto__).toBe(2);
    expect(result.changes).toEqual([
      { path: "var.__proto__", op: "set", value: 2, previous: 1, reason: "consequence_applied", visible: false },
    ]);
  });

  it("does not resolve inherited Object.prototype members as declared variables", () => {
    const variables = buildInitialVariables(schema);
    expect(() => applyConsequences(schema, variables, [{ op: "set", var: "toString", value: 1 }])).toThrow();
  });
});

describe("applyConsequences — clamp-once semantics", () => {
  it("nets +5 then -5 back to the original value, rather than clipping at max", () => {
    const variables = buildInitialVariables(schema); // money = 2, min 0 max 3
    const result = applyConsequences(schema, variables, [
      { op: "increment", var: "money", by: 5 },
      { op: "decrement", var: "money", by: 5 },
    ]);
    expect(result.variables.money).toBe(2);
  });

  it("clamps a single increment past max to the bound", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [{ op: "increment", var: "money", by: 10 }]);
    expect(result.variables.money).toBe(3);
  });

  it("clamps a single decrement past min to the bound", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [{ op: "decrement", var: "money", by: 10 }]);
    expect(result.variables.money).toBe(0);
  });
});

describe("applyConsequences — audit records", () => {
  it("emits one StateChange per touched variable, sorted by name regardless of touch order", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [
      { op: "set", var: "mood", value: "happy" },
      { op: "increment", var: "money", by: 1 },
    ]);
    expect(result.changes.map((c) => c.path)).toEqual(["var.money", "var.mood"]);
  });

  it("carries previous and final value, the var.<name> path, and op: set", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [{ op: "increment", var: "money", by: 1 }]);
    expect(result.changes).toEqual([
      { path: "var.money", op: "set", value: 3, previous: 2, reason: "consequence_applied", visible: false },
    ]);
  });

  it("mirrors the variable's own visible declaration", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [{ op: "set", var: "mood", value: "sad" }]);
    expect(result.changes[0]!.visible).toBe(true);
  });

  it("still emits a StateChange for a net-zero change", () => {
    const variables = buildInitialVariables(schema);
    const result = applyConsequences(schema, variables, [
      { op: "increment", var: "money", by: 5 },
      { op: "decrement", var: "money", by: 5 },
    ]);
    expect(result.changes).toEqual([
      { path: "var.money", op: "set", value: 2, previous: 2, reason: "consequence_applied", visible: false },
    ]);
  });
});

describe("applyConsequences — purity", () => {
  it("does not mutate its variables input", () => {
    const variables = buildInitialVariables(schema);
    const snapshot = { ...variables };
    const result = applyConsequences(schema, variables, [{ op: "increment", var: "money", by: 1 }]);
    expect(variables).toEqual(snapshot);
    expect(result.variables).not.toBe(variables);
  });
});
