import { describe, it, expect } from "vitest";
import { addAction, removeAction, clearPlan, type WeeklyActionPlan, type GameAction } from "./plan.js";

function makeAction(id: string): GameAction {
  return { id, type: "rest", actorId: "player", parameters: {} };
}

function makePlan(actions: GameAction[] = []): WeeklyActionPlan {
  return { week: 3, actions };
}

describe("addAction", () => {
  it("appends to the end of the plan", () => {
    const plan = makePlan([makeAction("a1")]);
    const result = addAction(plan, makeAction("a2"));
    expect(result.actions.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("preserves week", () => {
    const plan = makePlan();
    expect(addAction(plan, makeAction("a1")).week).toBe(3);
  });

  it("does not mutate its input plan", () => {
    const plan = makePlan([makeAction("a1")]);
    const before = plan.actions.length;
    addAction(plan, makeAction("a2"));
    expect(plan.actions.length).toBe(before);
  });
});

describe("removeAction", () => {
  it("removes the action at the given index, preserving order of the rest", () => {
    const plan = makePlan([makeAction("a1"), makeAction("a2"), makeAction("a3")]);
    const result = removeAction(plan, 1);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.actions.map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("preserves week", () => {
    const plan = makePlan([makeAction("a1")]);
    const result = removeAction(plan, 0);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.week).toBe(3);
  });

  it("rejects a negative index with action_not_planned", () => {
    const plan = makePlan([makeAction("a1")]);
    const result = removeAction(plan, -1);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("action_not_planned");
  });

  it("rejects an index equal to the plan's length", () => {
    const plan = makePlan([makeAction("a1")]);
    const result = removeAction(plan, 1);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("action_not_planned");
  });

  it("rejects an index on an empty plan", () => {
    const plan = makePlan();
    const result = removeAction(plan, 0);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("action_not_planned");
  });

  it("rejects a non-integer index", () => {
    const plan = makePlan([makeAction("a1"), makeAction("a2")]);
    const result = removeAction(plan, 0.5);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("action_not_planned");
  });

  it("does not mutate its input plan", () => {
    const plan = makePlan([makeAction("a1"), makeAction("a2")]);
    const before = plan.actions.length;
    removeAction(plan, 0);
    expect(plan.actions.length).toBe(before);
  });
});

describe("clearPlan", () => {
  it("empties the plan", () => {
    const plan = makePlan([makeAction("a1"), makeAction("a2")]);
    expect(clearPlan(plan).actions).toEqual([]);
  });

  it("preserves week", () => {
    const plan = makePlan([makeAction("a1")]);
    expect(clearPlan(plan).week).toBe(3);
  });

  it("does not mutate its input plan", () => {
    const plan = makePlan([makeAction("a1")]);
    const before = plan.actions.length;
    clearPlan(plan);
    expect(plan.actions.length).toBe(before);
  });
});
