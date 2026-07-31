import { describe, it, expect } from "vitest";
import { evaluateAchievements, type AchievementDefinition } from "./achievements.js";
import { evaluateStoryGraphCondition, toConditionContext } from "./conditions.js";
import type { StoryGraphKindState } from "./state.js";
import type { Condition } from "../../core/condition/types.js";

function baseState(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "n1",
    variables: { builds_character: true },
    turn: 5,
    visitedCounts: {},
    unlockedAchievements: [],
    ...overrides,
  };
}

const builtCharacter: AchievementDefinition = {
  id: "it_builds_character",
  nameKey: "ach.builds_character.name",
  descriptionKey: "ach.builds_character.desc",
  condition: { field: "var.builds_character", operator: "equals", value: true },
  hidden: true,
};

describe("evaluateAchievements", () => {
  it("unlocks an achievement whose condition is satisfied", () => {
    const result = evaluateAchievements([builtCharacter], baseState());
    expect(result.unlockedAchievements).toEqual(["it_builds_character"]);
  });

  it("does not unlock an achievement whose condition isn't satisfied", () => {
    const result = evaluateAchievements([builtCharacter], baseState({ variables: { builds_character: false } }));
    expect(result.unlockedAchievements).toEqual([]);
    expect(result.changes).toEqual([]);
  });

  it("fires exactly once — a second evaluation on an already-unlocked state doesn't re-add or re-emit", () => {
    const first = evaluateAchievements([builtCharacter], baseState());
    const secondState = { ...baseState(), unlockedAchievements: first.unlockedAchievements };
    const second = evaluateAchievements([builtCharacter], secondState);
    expect(second.unlockedAchievements).toEqual(["it_builds_character"]);
    expect(second.changes).toEqual([]);
  });

  it("emits a StateChange matching the achievement_unlocked convention exactly", () => {
    const result = evaluateAchievements([builtCharacter], baseState());
    expect(result.changes).toEqual([
      { path: "achieved.it_builds_character", op: "set", value: true, reason: "achievement_unlocked", visible: true },
    ]);
  });

  it("the unlock is readable as achieved.<id> in a later condition", () => {
    const result = evaluateAchievements([builtCharacter], baseState());
    const state = { ...baseState(), unlockedAchievements: result.unlockedAchievements };
    const laterCondition: Condition = { field: "achieved.it_builds_character", operator: "equals", value: true };
    expect(evaluateStoryGraphCondition(laterCondition, toConditionContext(state))).toBe(true);
  });

  it("unlocks two achievements satisfied on the same turn, in authored order", () => {
    const second: AchievementDefinition = {
      id: "second",
      nameKey: "ach.second.name",
      descriptionKey: "ach.second.desc",
      condition: { field: "turn", operator: "greater_or_equal", value: 1 },
      hidden: false,
    };
    const result = evaluateAchievements([builtCharacter, second], baseState());
    expect(result.unlockedAchievements).toEqual(["it_builds_character", "second"]);
    expect(result.changes.map((c) => c.path)).toEqual(["achieved.it_builds_character", "achieved.second"]);
  });

  it("an achievement can react to another achievement unlocked earlier in the same call", () => {
    const chained: AchievementDefinition = {
      id: "chained",
      nameKey: "ach.chained.name",
      descriptionKey: "ach.chained.desc",
      condition: { field: "achieved.it_builds_character", operator: "equals", value: true },
      hidden: false,
    };
    const result = evaluateAchievements([builtCharacter, chained], baseState());
    expect(result.unlockedAchievements).toEqual(["it_builds_character", "chained"]);
  });

  it("does not unlock the dependent achievement if authored before its dependency", () => {
    const chained: AchievementDefinition = {
      id: "chained",
      nameKey: "ach.chained.name",
      descriptionKey: "ach.chained.desc",
      condition: { field: "achieved.it_builds_character", operator: "equals", value: true },
      hidden: false,
    };
    // chained is evaluated first, before it_builds_character has unlocked this same call.
    const result = evaluateAchievements([chained, builtCharacter], baseState());
    expect(result.unlockedAchievements).toEqual(["it_builds_character"]);
  });

  it("unlocks an achievement whose condition reads the ending field", () => {
    const reachedEnding: AchievementDefinition = {
      id: "reached_ending",
      nameKey: "ach.reached_ending.name",
      descriptionKey: "ach.reached_ending.desc",
      condition: { field: "ending", operator: "equals", value: "vignette" },
      hidden: false,
    };
    const ended = baseState({ endingId: "vignette" });
    const result = evaluateAchievements([reachedEnding], ended);
    expect(result.unlockedAchievements).toEqual(["reached_ending"]);
  });

  it("does not mutate its state input", () => {
    const state = baseState();
    const snapshot = { ...state, unlockedAchievements: [...state.unlockedAchievements] };
    evaluateAchievements([builtCharacter], state);
    expect(state).toEqual(snapshot);
  });
});
