import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { availableActions, scene } from "./scene.js";
import { project } from "./view.js";
import { initialState } from "./settle.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";
import type { VariableSchema } from "./variables.js";
import type { KindContext, Kind, KindRegistry, AvailableAction, SceneBody, InitialStateResult, AdvanceResult } from "../../core/kernel/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import type { EngineHost } from "../../core/composition/types.js";
import { createEngine } from "../../core/kernel/engine.js";

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
      textKey: "t",
      choices: [
        { id: "wait", labelKey: "choice.wait", effects: [{ op: "decrement", var: "money", by: 1 }], goto: "auto_step" },
        {
          id: "secret",
          labelKey: "choice.secret",
          showWhen: { field: "var.documents_collected", operator: "equals", value: true },
          goto: "start",
        },
        {
          id: "gated",
          labelKey: "choice.gated",
          requirements: { field: "var.money", operator: "greater_or_equal", value: 5 },
          requirementFailKey: "req.need_money",
          goto: "start",
        },
      ],
    },
    auto_step: { id: "auto_step", kind: "auto", textKey: "t", effects: [{ op: "increment", var: "money", by: 5 }], goto: "end_choice" },
    end_choice: { id: "end_choice", kind: "choice", textKey: "t", choices: [] },
  },
};

const endingViaAdvanceCampaign: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: schema,
  startNodeId: "start",
  achievements: [],
  nodes: {
    start: { id: "start", kind: "choice", textKey: "t", choices: [{ id: "go", labelKey: "choice.go", goto: "end" }] },
    end: { id: "end", kind: "ending", textKey: "t", endingId: "vignette" },
  },
};

const campaignWithAchievement: StoryGraphCampaign = {
  ...campaign,
  achievements: [
    {
      id: "flush",
      nameKey: "ach.flush.name",
      descriptionKey: "ach.flush.desc",
      condition: { field: "var.money", operator: "equals", value: 3 },
      hidden: false,
    },
  ],
};

function baseState(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "start",
    variables: { money: 2, documents_collected: false },
    turn: 0,
    visitedCounts: { start: 1 },
    unlockedAchievements: [],
    ...overrides,
  };
}

function fakeCtx(content: StoryGraphCampaign): KindContext {
  return {
    registry: { campaigns: new Map(), strings: new Map() },
    campaign: { id: "c", kindId: "story-graph", version: "1", titleKey: "t", content },
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 0,
    emit: { emit: () => undefined },
  };
}

describe("advance", () => {
  it("rejects a non-empty params object with unexpected_params, state unchanged", () => {
    const state = baseState();
    const result = advance(state, "wait", { foo: "bar" }, fakeCtx(campaign));
    expect(result.error?.code).toBe("unexpected_params");
    expect(result.state).toBe(state);
  });

  it("rejects when the current node is not a ChoiceNode, state unchanged", () => {
    const state = baseState({ currentNodeId: "auto_step" });
    const result = advance(state, "wait", undefined, fakeCtx(campaign));
    expect(result.error?.code).toBe("not_a_choice_node");
    expect(result.state).toBe(state);
  });

  it("rejects a genuinely unknown choice id with unknown_action", () => {
    const result = advance(baseState(), "totally_fake", undefined, fakeCtx(campaign));
    expect(result.error).toEqual({ code: "unknown_action", messageKey: "core.reason.unknown_action" });
  });

  it("rejects a showWhen-hidden choice with unknown_action — identical to a nonexistent id", () => {
    const result = advance(baseState(), "secret", undefined, fakeCtx(campaign));
    expect(result.error).toEqual({ code: "unknown_action", messageKey: "core.reason.unknown_action" });
  });

  it("accepts a showWhen-hidden choice once its condition is satisfied", () => {
    const state = baseState({ variables: { money: 2, documents_collected: true } });
    const result = advance(state, "secret", undefined, fakeCtx(campaign));
    expect(result.error).toBeUndefined();
  });

  it("rejects a gated choice with requirement_unmet, messageKey the requirementFailKey", () => {
    const result = advance(baseState(), "gated", undefined, fakeCtx(campaign));
    expect(result.error).toEqual({ code: "requirement_unmet", messageKey: "req.need_money" });
  });

  it("a successful advance combines the choice's own changes with settle's pass-through changes", () => {
    const result = advance(baseState(), "wait", undefined, fakeCtx(campaign));
    expect(result.error).toBeUndefined();
    expect(result.changes.map((c) => ({ path: c.path, value: c.value, previous: c.previous }))).toEqual([
      { path: "var.money", value: 1, previous: 2 }, // the choice's own decrement
      { path: "var.money", value: 3, previous: 1 }, // auto_step's increment, clamped to max
    ]);
    expect(result.state.turn).toBe(2); // one for the choice's own transition, one for auto_step's
    expect(result.state.currentNodeId).toBe("end_choice");
    expect(result.status).toBe("active");
  });

  it("reports status ended when the choice's own transition settles to an ending", () => {
    const result = advance(baseState(), "go", undefined, fakeCtx(endingViaAdvanceCampaign));
    expect(result.status).toBe("ended");
    expect(result.state.endingId).toBe("vignette");
  });

  it("unlocks an achievement whose condition becomes true from the turn's own effects", () => {
    const result = advance(baseState(), "wait", undefined, fakeCtx(campaignWithAchievement));
    expect(result.state.unlockedAchievements).toEqual(["flush"]);
    expect(result.changes.at(-1)).toEqual({
      path: "achieved.flush",
      op: "set",
      value: true,
      reason: "achievement_unlocked",
      visible: true,
    });
  });
});

describe("story-graph kind — through the real engine (integration)", () => {
  function makeStoryGraphKind(): Kind<StoryGraphKindState> {
    return {
      id: "story-graph",
      reasonCodes: ["not_a_choice_node", "unexpected_params", "settle_guard_tripped", "unknown_condition_field"],
      eventNames: [
        "kind.story-graph.settle.step",
        "kind.story-graph.node.entered",
        "kind.story-graph.random.picked",
        "kind.story-graph.settle.guard_tripped",
      ],
      initialState: (c, ctx): InitialStateResult<StoryGraphKindState> => initialState(c, ctx),
      availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
      scene: (state, ctx): SceneBody => scene(state, ctx),
      advance: (state, actionId, params, ctx): AdvanceResult<StoryGraphKindState> => advance(state, actionId, params, ctx),
      project: (state, audience, ctx) => project(state, audience, ctx),
      validateCampaign: () => ({ ok: true, errors: [], warnings: [] }),
      outcome: (state) => ({ endingId: state.endingId ?? null }),
    };
  }

  function makeHost(): EngineHost {
    const registryCampaign: Campaign = { id: "bureaucracy", kindId: "story-graph", version: "1", titleKey: "t", content: campaign };
    const strings = new Map([
      ["t", "Bureaucracy awaits."],
      ["choice.wait", "Wait"],
      ["choice.secret", "Slip through"],
      ["choice.gated", "Demand a refund"],
    ]);
    const registry: ContentRegistry = { campaigns: new Map([["bureaucracy", registryCampaign]]), strings };
    const kinds = { "story-graph": makeStoryGraphKind() } as unknown as KindRegistry;
    return { kinds, registry };
  }

  it("submitAction runs a real choice through availableActions, advance, scene, and project", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "bureaucracy" });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.value) throw new Error("expected success");

    const actionsBefore = engine.availableActions(created.value);
    expect(actionsBefore.map((a) => a.id).sort()).toEqual(["gated", "wait"]); // "secret" is showWhen-hidden

    const result = engine.submitAction(created.value, "wait");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");

    const sceneAfter = engine.scene(result.value);
    expect(sceneAfter.body.text).toBe("Bureaucracy awaits.");
    expect(sceneAfter.actions).toEqual([]); // end_choice has no choices

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { stats: { var: string; value: unknown }[] };
    expect(kindView.stats).toEqual([{ var: "money", labelKey: "stat.money", value: 3 }]);
  });

  it("an achievement unlock survives the real engine seam end to end", () => {
    const registryCampaign: Campaign = {
      id: "bureaucracy",
      kindId: "story-graph",
      version: "1",
      titleKey: "t",
      content: campaignWithAchievement,
    };
    const strings = new Map([["t", "Bureaucracy awaits."], ["choice.wait", "Wait"]]);
    const registry: ContentRegistry = { campaigns: new Map([["bureaucracy", registryCampaign]]), strings };
    const kinds = { "story-graph": makeStoryGraphKind() } as unknown as KindRegistry;
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: "bureaucracy" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const result = engine.submitAction(created.value, "wait");
    if (!result.ok || !result.value) throw new Error("expected success");

    expect(result.changes.some((c) => c.reason === "achievement_unlocked" && c.path === "achieved.flush")).toBe(true);

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { unlockedAchievements: string[] };
    expect(kindView.unlockedAchievements).toEqual(["flush"]);
  });

  it("submitAction rejects an unknown choice id via the real engine seam", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "bureaucracy" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const result = engine.submitAction(created.value, "totally_fake");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});
