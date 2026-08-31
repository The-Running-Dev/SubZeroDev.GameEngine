import { describe, it, expect } from "vitest";
import { project, type StoryGraphView } from "./view.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";
import type { VariableSchema } from "./variables.js";
import type { KindContext } from "../../core/kernel/types.js";

const schema: VariableSchema = {
  money: { type: "int", initial: 2, min: 0, max: 3, visible: true, labelKey: "stat.money" },
  patience: { type: "int", initial: 10, min: 0, max: 10, visible: true, labelKey: "stat.patience" },
  documents_collected: { type: "bool", initial: false },
};

function campaign(overrides?: Partial<StoryGraphCampaign>): StoryGraphCampaign {
  return {
    descriptionKey: "d",
    variables: schema,
    startNodeId: "start",
    achievements: [],
    nodes: {
      start: { id: "start", kind: "choice", textKey: "t", choices: [] },
      ending_default: { id: "ending_default", kind: "ending", textKey: "t", endingId: "e1" },
      ending_win: { id: "ending_win", kind: "ending", textKey: "t", endingId: "e2", outcome: "win" },
    },
    ...overrides,
  };
}

function baseState(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "start",
    variables: { money: 2, patience: 7, documents_collected: true },
    turn: 3,
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

describe("project", () => {
  it("includes only visible variables as stats, with their labelKey and current value", () => {
    const view = project(baseState(), "player", fakeCtx(campaign()));
    expect(view.stats).toEqual([
      { var: "money", labelKey: "stat.money", value: 2, min: 0, max: 3 },
      { var: "patience", labelKey: "stat.patience", value: 7, min: 0, max: 10 },
    ]);
  });

  it("excludes non-visible variables and visitedCounts entirely", () => {
    const view = project(baseState(), "player", fakeCtx(campaign()));
    expect(view.stats.find((s) => s.var === "documents_collected")).toBeUndefined();
    expect(view).not.toHaveProperty("visitedCounts");
  });

  it("carries turn directly", () => {
    const view = project(baseState({ turn: 12 }), "player", fakeCtx(campaign()));
    expect(view.turn).toBe(12);
  });

  it("omits ending while the game is active", () => {
    const view = project(baseState(), "player", fakeCtx(campaign()));
    expect(view.ending).toBeUndefined();
  });

  it("reports ending with the node's outcome once ended", () => {
    const state = baseState({ currentNodeId: "ending_win", endingId: "e2" });
    const view = project(state, "player", fakeCtx(campaign()));
    expect(view.ending).toEqual({ endingId: "e2", outcome: "win" });
  });

  it("defaults outcome to neutral when the ending node omits it", () => {
    const state = baseState({ currentNodeId: "ending_default", endingId: "e1" });
    const view = project(state, "player", fakeCtx(campaign()));
    expect(view.ending).toEqual({ endingId: "e1", outcome: "neutral" });
  });

  it("repeats nothing the generic Scene/PlayerView already carries", () => {
    const view: StoryGraphView = project(baseState(), "player", fakeCtx(campaign()));
    const keys = Object.keys(view);
    expect(keys).not.toContain("gameId");
    expect(keys).not.toContain("status");
    expect(keys).not.toContain("body");
    expect(keys).not.toContain("actions");
  });

  it("throws when a visible variable has no labelKey (Tier 1's own job, not yet built)", () => {
    const noLabel: VariableSchema = { money: { type: "int", initial: 2, visible: true } };
    const brokenCampaign = campaign({ variables: noLabel });
    const state = baseState({ variables: { money: 2 } });
    expect(() => project(state, "player", fakeCtx(brokenCampaign))).toThrow();
  });
});
