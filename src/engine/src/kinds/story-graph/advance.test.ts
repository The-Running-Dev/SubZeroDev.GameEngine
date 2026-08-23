import { describe, it, expect } from "vitest";
import { advance } from "./advance.js";
import { availableActions, scene } from "./scene.js";
import { project } from "./view.js";
import { initialState } from "./settle.js";
import { STORY_GRAPH_REASON_MESSAGES } from "./reasons.js";
import { storyGraphKind } from "./kind.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";
import type { VariableSchema } from "./variables.js";
import type { KindContext, Kind, KindRegistry, AvailableAction, SceneBody, InitialStateResult, AdvanceResult } from "../../core/kernel/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import type { EngineHost } from "../../core/composition/types.js";
import { createEngine } from "../../core/kernel/engine.js";
import { createRecordingEmitter, makeResolutionEmitters } from "../../core/observability/emitter.js";

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
          requirements: {
            all: [
              { field: "var.money", operator: "greater_or_equal", value: 5 },
              { field: "var.documents_collected", operator: "equals", value: false },
            ],
          },
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

/** Routes `ctx.emit` through the real validating emitter (declared-name enforcement, 05
 *  §3.1/§9) bound to `storyGraphKind.eventNames`, backed by a recorder — so a test can
 *  assert both that nothing emits outside the declared set and what was actually emitted. */
function recordingCtx(content: StoryGraphCampaign): { ctx: KindContext; events: () => readonly { name: string }[] } {
  const sink = createRecordingEmitter();
  const emit = makeResolutionEmitters(sink, "g", 0).forKind("story-graph", storyGraphKind.eventNames);
  return { ctx: { ...fakeCtx(content), emit }, events: () => sink.events };
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

/** Projects a recorded event down to the fields these tests assert on — `gameId`,
 *  `ordinal`, `scope`, `seq`, `kindId` and `severity` are `makeResolutionEmitters`'
 *  own concern (already covered by `emitter.test.ts`), not this kind's. */
function simplify(e: { name: string; reason?: string; data?: unknown }): { name: string; reason?: string; data?: unknown } {
  return { name: e.name, ...(e.reason !== undefined ? { reason: e.reason } : {}), ...(e.data !== undefined ? { data: e.data } : {}) };
}

describe("advance — events (03 §8.4)", () => {
  it("W86.1 emits choice.submitted with nodeId and choiceId, whether or not the choice exists", () => {
    const { ctx, events } = recordingCtx(campaign);
    advance(baseState(), "wait", undefined, ctx);
    const submitted = events().filter((e) => e.name === "kind.story-graph.choice.submitted").map(simplify);
    expect(submitted).toEqual([{ name: "kind.story-graph.choice.submitted", data: { nodeId: "start", choiceId: "wait" } }]);
  });

  it("W86.1 emits choice.rejected on unknown_action and requirement_unmet, not on the earlier step-0/step-1 rejections", () => {
    const unknown = recordingCtx(campaign);
    advance(baseState(), "totally_fake", undefined, unknown.ctx);
    const unknownRejected = unknown.events().filter((e) => e.name === "kind.story-graph.choice.rejected").map(simplify);
    expect(unknownRejected).toEqual([
      { name: "kind.story-graph.choice.rejected", reason: "unknown_action", data: { choiceId: "totally_fake" } },
    ]);

    const gated = recordingCtx(campaign);
    advance(baseState(), "gated", undefined, gated.ctx);
    const gatedRejected = gated.events().filter((e) => e.name === "kind.story-graph.choice.rejected").map(simplify);
    expect(gatedRejected).toEqual([
      { name: "kind.story-graph.choice.rejected", reason: "requirement_unmet", data: { choiceId: "gated" } },
    ]);

    const params = recordingCtx(campaign);
    advance(baseState(), "wait", { foo: "bar" }, params.ctx);
    expect(params.events().some((e) => e.name === "kind.story-graph.choice.rejected")).toBe(false);

    const notChoice = recordingCtx(campaign);
    advance(baseState({ currentNodeId: "auto_step" }), "wait", undefined, notChoice.ctx);
    expect(notChoice.events().some((e) => e.name === "kind.story-graph.choice.rejected")).toBe(false);
  });

  it("W86.2 fires requirement.evaluated once per leaf of a compound requirement, not once per choice", () => {
    // Two leaves, the failing one second, so a per-choice event would report one and a
    // per-leaf walk reports both. `all` short-circuits (below), so the passing leaf has to
    // come first for the second to be reached at all.
    const compound: StoryGraphCampaign = {
      ...campaign,
      nodes: {
        ...campaign.nodes,
        start: {
          id: "start",
          kind: "choice",
          textKey: "t",
          choices: [
            {
              id: "gated",
              labelKey: "choice.gated",
              requirements: {
                all: [
                  { field: "var.documents_collected", operator: "equals", value: false },
                  { field: "var.money", operator: "greater_or_equal", value: 5 },
                ],
              },
              goto: "start",
            },
          ],
        },
      },
    };

    const { ctx, events } = recordingCtx(compound);
    advance(baseState(), "gated", undefined, ctx);
    const evaluated = events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify);
    expect(evaluated).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "gated", satisfied: true } },
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "gated", satisfied: false } },
    ]);
  });

  it("W86.2 short-circuits `all` at the first failing leaf, exactly as availableActions does", () => {
    // The shared fixture's "gated" is `all: [money >= 5, documents_collected == false]`.
    // `money` is 2, so the first leaf fails and the second is never reached — one event,
    // and it is the clause that actually failed (03 §8.4).
    const { ctx, events } = recordingCtx(campaign);
    advance(baseState(), "gated", undefined, ctx);
    expect(events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify)).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "gated", satisfied: false } },
    ]);
  });

  it("W86.2 rejects a guarded requirement rather than throwing on the leaf the guard exists to skip", () => {
    // The guard-then-typed-compare idiom: the second leaf compares a `bool` with a numeric
    // operator, which `compare` throws on. `availableActions` short-circuits past it and
    // reports the choice unavailable; evaluating every leaf for the sake of one extra
    // `trace` event would make submitting it throw instead of rejecting cleanly.
    const guarded: StoryGraphCampaign = {
      ...campaign,
      nodes: {
        ...campaign.nodes,
        start: {
          id: "start",
          kind: "choice",
          textKey: "t",
          choices: [
            {
              id: "guarded",
              labelKey: "choice.gated",
              requirements: {
                all: [
                  { field: "var.documents_collected", operator: "equals", value: true },
                  { field: "var.documents_collected", operator: "greater_than", value: 3 },
                ],
              },
              goto: "start",
            },
          ],
        },
      },
    };

    const { ctx, events } = recordingCtx(guarded);
    expect(availableActions(baseState(), fakeCtx(guarded))).toEqual([
      { id: "guarded", labelKey: "choice.gated", available: false, reasonKey: "core.reason.requirement_unmet" },
    ]);

    const result = advance(baseState(), "guarded", undefined, ctx);
    expect(result.error?.code).toBe("requirement_unmet");
    expect(events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify)).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "guarded", satisfied: false } },
    ]);
  });

  it("W86.2 reports a leaf under `not` by its effective contribution, not its raw result", () => {
    // `clean` requires the player *not* to hold `bribed`; `twice` double-negates the same
    // leaf, so parity — not a single flip — is what decides the reported value.
    const negation: StoryGraphCampaign = {
      ...campaign,
      nodes: {
        ...campaign.nodes,
        start: {
          id: "start",
          kind: "choice",
          textKey: "t",
          choices: [
            {
              id: "clean",
              labelKey: "choice.gated",
              requirements: { not: { field: "achieved.bribed", operator: "equals", value: true } },
              goto: "start",
            },
            {
              id: "twice",
              labelKey: "choice.gated",
              requirements: { not: { not: { field: "achieved.bribed", operator: "equals", value: true } } },
              goto: "start",
            },
          ],
        },
      },
    };

    const bribed = baseState({ unlockedAchievements: ["bribed"] });

    // The leaf is raw-true, so the un-negated reading would report `satisfied: true` on a
    // requirement that is the reason the choice was rejected.
    const held = recordingCtx(negation);
    expect(advance(bribed, "clean", undefined, held.ctx).error?.code).toBe("requirement_unmet");
    expect(held.events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify)).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "clean", satisfied: false } },
    ]);

    // Same requirement, player without the achievement — it passes, and reports so.
    const notHeld = recordingCtx(negation);
    expect(advance(baseState(), "clean", undefined, notHeld.ctx).error).toBeUndefined();
    expect(notHeld.events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify)).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "clean", satisfied: true } },
    ]);

    // Two `not`s cancel: back to the leaf's raw result.
    const doubled = recordingCtx(negation);
    expect(advance(bribed, "twice", undefined, doubled.ctx).error).toBeUndefined();
    expect(doubled.events().filter((e) => e.name === "kind.story-graph.requirement.evaluated").map(simplify)).toEqual([
      { name: "kind.story-graph.requirement.evaluated", data: { choiceId: "twice", satisfied: true } },
    ]);
  });

  it("W86.1 emits consequence.applied once per typed effect, reporting the batch's own clamp", () => {
    const { ctx, events } = recordingCtx(campaign);
    advance(baseState(), "wait", undefined, ctx);
    const applied = events().filter((e) => e.name === "kind.story-graph.consequence.applied").map(simplify);
    expect(applied).toEqual([
      { name: "kind.story-graph.consequence.applied", data: { variable: "money", op: "decrement", clamped: false } },
      { name: "kind.story-graph.consequence.applied", data: { variable: "money", op: "increment", clamped: true } },
    ]);
  });

  it("W86.1 emits achievement.unlocked with the achievement's id", () => {
    const { ctx, events } = recordingCtx(campaignWithAchievement);
    advance(baseState(), "wait", undefined, ctx);
    expect(events().filter((e) => e.name === "kind.story-graph.achievement.unlocked").map(simplify)).toEqual([
      { name: "kind.story-graph.achievement.unlocked", data: { achievementId: "flush" } },
    ]);
  });

  it("W86.1 emits ending.reached with the ending's id when the choice's own transition settles to an ending", () => {
    const { ctx, events } = recordingCtx(endingViaAdvanceCampaign);
    advance(baseState(), "go", undefined, ctx);
    expect(events().filter((e) => e.name === "kind.story-graph.ending.reached").map(simplify)).toEqual([
      { name: "kind.story-graph.ending.reached", data: { endingId: "vignette" } },
    ]);
  });

  it("W86.1 declares all ten names, and a scenario built to exercise each emits exactly that set", () => {
    const randomEndingCampaign: StoryGraphCampaign = {
      descriptionKey: "d",
      variables: schema,
      startNodeId: "start",
      achievements: [],
      nodes: {
        start: { id: "start", kind: "choice", textKey: "t", choices: [{ id: "go", labelKey: "l", goto: "picker" }] },
        picker: { id: "picker", kind: "random", textKey: "t", transitions: [{ weight: 1, goto: "end" }] },
        end: { id: "end", kind: "ending", textKey: "t", endingId: "vignette" },
      },
    };
    const cycleCampaign: StoryGraphCampaign = {
      descriptionKey: "d",
      variables: schema,
      startNodeId: "start",
      achievements: [],
      nodes: {
        start: { id: "start", kind: "choice", textKey: "t", choices: [{ id: "go", labelKey: "l", goto: "a" }] },
        a: { id: "a", kind: "auto", textKey: "t", goto: "b" },
        b: { id: "b", kind: "auto", textKey: "t", goto: "a" },
      },
    };

    const emitted = new Set<string>();

    const gated = recordingCtx(campaign);
    advance(baseState(), "gated", undefined, gated.ctx);
    const withAchievement = recordingCtx(campaignWithAchievement);
    advance(baseState(), "wait", undefined, withAchievement.ctx);
    const randomEnding = recordingCtx(randomEndingCampaign);
    advance(baseState(), "go", undefined, randomEnding.ctx);
    const cycle = recordingCtx(cycleCampaign);
    expect(() => advance(baseState(), "go", undefined, cycle.ctx)).toThrow();

    for (const e of [...gated.events(), ...withAchievement.events(), ...randomEnding.events(), ...cycle.events()]) {
      emitted.add(e.name);
    }

    expect([...emitted].sort()).toEqual([...storyGraphKind.eventNames].sort());
  });
});

describe("story-graph kind — through the real engine (integration)", () => {
  function makeStoryGraphKind(): Kind<StoryGraphKindState> {
    return {
      id: "story-graph",
      version: "1.0.0",
      reasonCodes: ["not_a_choice_node", "unexpected_params", "settle_guard_tripped", "unknown_condition_field"],
      reasonMessages: STORY_GRAPH_REASON_MESSAGES,
      eventNames: [
        "kind.story-graph.settle.step",
        "kind.story-graph.node.entered",
        "kind.story-graph.random.picked",
        "kind.story-graph.settle.guard_tripped",
        "kind.story-graph.choice.submitted",
        "kind.story-graph.choice.rejected",
        "kind.story-graph.requirement.evaluated",
        "kind.story-graph.consequence.applied",
        "kind.story-graph.achievement.unlocked",
        "kind.story-graph.ending.reached",
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
