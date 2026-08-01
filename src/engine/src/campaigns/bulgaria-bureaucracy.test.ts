import { describe, it, expect } from "vitest";
import { buildStoryGraphCampaign, type StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { validateCampaign } from "../kinds/story-graph/validate.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { Campaign, ContentRegistry } from "../core/registry/types.js";
import {
  bulgariaBureaucracySource,
  buildBulgariaBureaucracyCampaign,
  BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
} from "./bulgaria-bureaucracy.js";
import {
  danglingNodeFixture,
  undeclaredVariableFixture,
  unreachableNodeFixture,
  settlementCycleFixture,
} from "./bulgaria-bureaucracy.broken.js";

// A fixed seed against the real "action:0" stream (`bureaucracy-seed-3`, found by scan —
// see plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md) whose first weighted pick
// at `clerk_review` (3 `expired` : 1 `room_14`) lands on `room_14` — the branch the
// `office_visits >= 3` gate needs exercised, since the "expired" branch dominates most seeds.
const SEEDED_ROOM_14_SEED = "bureaucracy-seed-3";

function buildValidRegistry(): { registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected the real campaign to validate");
  return { registry: result.value, kinds };
}

describe("bulgaria-bureaucracy — loads clean", () => {
  it("builds and validates with zero Tier 1 errors and zero Tier 2 warnings", () => {
    const built = buildBulgariaBureaucracyCampaign();
    expect(built.ok).toBe(true);
    if (!built.ok || !built.value) throw new Error("expected success");

    const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
    const result = buildValidatedContentRegistry([built.value], kinds);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("every authored string resolves through the registry", () => {
    const { registry } = buildValidRegistry();
    const { authoredText } = buildStoryGraphCampaign(bulgariaBureaucracySource);
    for (const { key } of authoredText) {
      expect(registry.strings.has(key)).toBe(true);
    }
  });
});

describe("bulgaria-bureaucracy — a full playthrough through the real engine", () => {
  it("wait, then two continue_cycle passes, reaches the office_visits >= 3 gate", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.value) throw new Error("expected success");

    const afterWait = engine.submitAction(created.value, "wait");
    expect(afterWait.ok).toBe(true);
    if (!afterWait.ok || !afterWait.value) throw new Error("expected success");
    const kindStateAfterWait = afterWait.value.kindState as StoryGraphKindState;
    expect(kindStateAfterWait.currentNodeId).toBe("room_6");
    expect(kindStateAfterWait.variables["office_visits"]).toBe(1);

    const goHomeBeforeGate = engine.availableActions(afterWait.value).find((a) => a.id === "go_home");
    expect(goHomeBeforeGate?.available).toBe(false);
    expect(goHomeBeforeGate?.reasonKey).toBe("bureaucracy.choice.go_home.requirement_fail");

    const afterFirstCycle = engine.submitAction(afterWait.value, "continue_cycle");
    if (!afterFirstCycle.ok || !afterFirstCycle.value) throw new Error("expected success");
    expect((afterFirstCycle.value.kindState as StoryGraphKindState).variables["office_visits"]).toBe(2);

    const afterSecondCycle = engine.submitAction(afterFirstCycle.value, "continue_cycle");
    if (!afterSecondCycle.ok || !afterSecondCycle.value) throw new Error("expected success");
    const kindStateAtGate = afterSecondCycle.value.kindState as StoryGraphKindState;
    expect(kindStateAtGate.currentNodeId).toBe("room_6");
    expect(kindStateAtGate.variables["office_visits"]).toBe(3);

    const goHomeAtGate = engine.availableActions(afterSecondCycle.value).find((a) => a.id === "go_home");
    expect(goHomeAtGate?.available).toBe(true);
  });

  it("go_home at the gate ends the game, unlocking it_builds_character", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    if (!created.ok || !created.value) throw new Error("expected success");

    const afterWait = engine.submitAction(created.value, "wait");
    if (!afterWait.ok || !afterWait.value) throw new Error("expected success");
    const afterFirstCycle = engine.submitAction(afterWait.value, "continue_cycle");
    if (!afterFirstCycle.ok || !afterFirstCycle.value) throw new Error("expected success");
    const afterSecondCycle = engine.submitAction(afterFirstCycle.value, "continue_cycle");
    if (!afterSecondCycle.ok || !afterSecondCycle.value) throw new Error("expected success");

    const result = engine.submitAction(afterSecondCycle.value, "go_home");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");

    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.endingId).toBe("ultimate_reward");
    expect(finalKindState.unlockedAchievements).toEqual(["it_builds_character"]);

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "ultimate_reward", outcome: "win" });
  });

  it("the seeded clerk_review transition reproduces across two independent createGame calls", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const landingNode = (): string => {
      const created = engine.createGame({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
      if (!created.ok || !created.value) throw new Error("expected success");
      const afterWait = engine.submitAction(created.value, "wait");
      if (!afterWait.ok || !afterWait.value) throw new Error("expected success");
      return (afterWait.value.kindState as StoryGraphKindState).currentNodeId;
    };

    const first = landingNode();
    expect(first).toBe("room_6"); // reached only via the room_14 branch
    expect(landingNode()).toBe(first);
  });
});

function validateSource(source: StoryGraphCampaignSource): ReturnType<typeof validateCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const strings = new Map(authoredText.map(({ key, text }) => [key, text] as const));
  const campaign: Campaign = {
    id: BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
    kindId: "story-graph",
    version: "1.0.0",
    titleKey: "bureaucracy.campaign.title",
    content,
  };
  return validateCampaign(campaign, strings);
}

describe("bulgaria-bureaucracy — broken fixtures", () => {
  it("the valid source itself passes, as a control", () => {
    const result = validateSource(bulgariaBureaucracySource);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("dangling node: Tier 1 dangling_reference at the retargeted goto, campaign does not load", () => {
    const result = validateSource(danglingNodeFixture);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "nonexistent_office" }),
    );
  });

  it("undeclared variable: Tier 1 undeclared_variable at the rewritten effect, campaign does not load", () => {
    const result = validateSource(undeclaredVariableFixture);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "undeclared_variable", path: "office_visits_undeclared" }),
    );
  });

  it("unreachable node: Tier 2 unreachable_node, campaign still loads", () => {
    const result = validateSource(unreachableNodeFixture);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unreachable_node", path: "orphan_office" }));
  });

  it("settlement cycle: Tier 2 unreachable_cycle, campaign still loads", () => {
    const result = validateSource(settlementCycleFixture);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unreachable_cycle", path: "room_14" }));
  });
});
