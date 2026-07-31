import { describe, it, expect } from "vitest";
import { enter, type StoryGraphKindState } from "./state.js";

function baseState(): StoryGraphKindState {
  return {
    currentNodeId: "start",
    variables: {},
    turn: 0,
    visitedCounts: {},
    unlockedAchievements: [],
  };
}

describe("enter", () => {
  it("sets currentNodeId", () => {
    const next = enter(baseState(), "clerk_review");
    expect(next.currentNodeId).toBe("clerk_review");
  });

  it("increments visitedCounts from 0 on a first entry", () => {
    const next = enter(baseState(), "clerk_review");
    expect(next.visitedCounts.clerk_review).toBe(1);
  });

  it("increments visitedCounts again on a repeat entry", () => {
    let state = enter(baseState(), "room_14");
    state = enter(state, "room_6");
    state = enter(state, "room_14");
    expect(state.visitedCounts.room_14).toBe(2);
    expect(state.visitedCounts.room_6).toBe(1);
  });

  it("does not mutate its input", () => {
    const before = baseState();
    const snapshot = { ...before, visitedCounts: { ...before.visitedCounts } };
    enter(before, "clerk_review");
    expect(before).toEqual(snapshot);
  });

  it("a node id colliding with an Object.prototype member counts correctly, not an inherited value", () => {
    const next = enter(baseState(), "toString");
    expect(next.visitedCounts.toString).toBe(1);
  });

  it("a node id of __proto__ counts correctly rather than touching the prototype", () => {
    const next = enter(baseState(), "__proto__");
    expect(Object.hasOwn(next.visitedCounts, "__proto__")).toBe(true);
    expect((next.visitedCounts as Record<string, unknown>).__proto__).toBe(1);
  });
});
