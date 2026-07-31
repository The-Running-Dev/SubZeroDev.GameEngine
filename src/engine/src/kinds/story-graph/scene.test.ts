import { describe, it, expect } from "vitest";
import { availableActions, scene } from "./scene.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";
import type { VariableSchema } from "./variables.js";
import type { KindContext } from "../../core/kernel/types.js";

const schema: VariableSchema = {
  money: { type: "int", initial: 2, min: 0, max: 3, visible: true, labelKey: "stat.money" },
  documents_collected: { type: "bool", initial: false },
};

const campaign: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: schema,
  startNodeId: "start",
  achievements: [],
  nodes: {
    start: {
      id: "start",
      kind: "choice",
      textKey: "node.start.text",
      choices: [
        { id: "wait", labelKey: "choice.wait", goto: "start" },
        {
          id: "secret",
          labelKey: "choice.secret",
          showWhen: { field: "var.documents_collected", operator: "equals", value: true },
          goto: "start",
        },
        {
          id: "gated_with_reason",
          labelKey: "choice.gated_with_reason",
          requirements: { field: "var.money", operator: "greater_or_equal", value: 5 },
          requirementFailKey: "req.need_more_money",
          goto: "start",
        },
        {
          id: "gated_no_reason",
          labelKey: "choice.gated_no_reason",
          requirements: { field: "var.money", operator: "greater_or_equal", value: 5 },
          goto: "start",
        },
      ],
    },
    ending: { id: "ending", kind: "ending", textKey: "node.ending.text", endingId: "e1" },
  },
};

function baseState(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "start",
    variables: { money: 2, documents_collected: false },
    turn: 0,
    visitedCounts: {},
    unlockedAchievements: [],
    ...overrides,
  };
}

function fakeRng(): KindContext["rng"] {
  return { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item };
}

function fakeCtx(strings: Record<string, string> = {}): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map(Object.entries(strings)) },
    campaign: { id: "c", kindId: "story-graph", version: "1", titleKey: "t", content: campaign },
    rng: fakeRng(),
    derive: fakeRng,
    seq: 0,
    emit: { emit: () => undefined },
  };
}

describe("availableActions", () => {
  it("omits a showWhen-hidden choice entirely", () => {
    const actions = availableActions(baseState(), fakeCtx());
    expect(actions.find((a) => a.id === "secret")).toBeUndefined();
  });

  it("includes a showWhen-hidden choice once its condition is satisfied", () => {
    const state = baseState({ variables: { money: 2, documents_collected: true } });
    const actions = availableActions(state, fakeCtx());
    expect(actions.find((a) => a.id === "secret")).toBeDefined();
  });

  it("shows a gated choice with available: false and its requirementFailKey", () => {
    const actions = availableActions(baseState(), fakeCtx());
    const gated = actions.find((a) => a.id === "gated_with_reason");
    expect(gated).toEqual({
      id: "gated_with_reason",
      labelKey: "choice.gated_with_reason",
      available: false,
      reasonKey: "req.need_more_money",
    });
  });

  it("falls back to core.reason.requirement_unmet when requirementFailKey is omitted", () => {
    const actions = availableActions(baseState(), fakeCtx());
    const gated = actions.find((a) => a.id === "gated_no_reason");
    expect(gated?.reasonKey).toBe("core.reason.requirement_unmet");
  });

  it("an ungated, shown choice has available: true and no reasonKey", () => {
    const actions = availableActions(baseState(), fakeCtx());
    const wait = actions.find((a) => a.id === "wait");
    expect(wait).toEqual({ id: "wait", labelKey: "choice.wait", available: true });
  });

  it("returns [] outside a ChoiceNode", () => {
    const actions = availableActions(baseState({ currentNodeId: "ending", endingId: "e1" }), fakeCtx());
    expect(actions).toEqual([]);
  });
});

describe("scene", () => {
  it("renders the current node's textKey", () => {
    const body = scene(baseState(), fakeCtx({ "node.start.text": "You wait in line." }));
    expect(body).toEqual({ textKey: "node.start.text", text: "You wait in line." });
  });

  it("interpolates a visible variable", () => {
    const body = scene(baseState(), fakeCtx({ "node.start.text": "You have {money} coins." }));
    expect(body.text).toBe("You have 2 coins.");
  });

  it("throws when the template references a non-visible or undeclared variable", () => {
    const ctx = fakeCtx({ "node.start.text": "You have {documents_collected} papers." });
    expect(() => scene(baseState(), ctx)).toThrow();

    const ctxUndeclared = fakeCtx({ "node.start.text": "You have {nope} things." });
    expect(() => scene(baseState(), ctxUndeclared)).toThrow();
  });

  it("throws when no string is registered for the node's textKey", () => {
    expect(() => scene(baseState(), fakeCtx({}))).toThrow();
  });
});
