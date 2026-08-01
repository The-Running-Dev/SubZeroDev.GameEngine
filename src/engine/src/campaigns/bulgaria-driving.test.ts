import { describe, it, expect } from "vitest";
import { buildStoryGraphCampaign } from "../kinds/story-graph/source.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { bulgariaDrivingSource, buildBulgariaDrivingCampaign, BULGARIA_DRIVING_CAMPAIGN_ID } from "./bulgaria-driving.js";

function buildValidRegistry(): { registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildBulgariaDrivingCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected the real campaign to validate");
  return { registry: result.value, kinds };
}

describe("bulgaria-driving — loads clean", () => {
  it("builds and validates with zero Tier 1 errors and zero Tier 2 warnings", () => {
    const built = buildBulgariaDrivingCampaign();
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
    const { authoredText } = buildStoryGraphCampaign(bulgariaDrivingSource);
    for (const { key } of authoredText) {
      expect(registry.strings.has(key)).toBe(true);
    }
  });
});

describe("bulgaria-driving — the trust_mechanic gate actually gates", () => {
  it("believing the mechanic sets trust_mechanic true and hides the skeptical option entirely", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const afterBelieve = engine.submitAction(created.value, "believe_him");
    expect(afterBelieve.ok).toBe(true);
    if (!afterBelieve.ok || !afterBelieve.value) throw new Error("expected success");
    const kindState = afterBelieve.value.kindState as StoryGraphKindState;
    expect(kindState.currentNodeId).toBe("bmw_ownership");
    expect(kindState.variables["trust_mechanic"]).toBe(true);

    // showWhen omits the choice entirely — not present at all, not merely disabled.
    const available = engine.availableActions(afterBelieve.value);
    expect(available.map((a) => a.id).sort()).toEqual(["buy_him_lunch", "never_ask_questions", "pay_immediately"]);
    expect(available.find((a) => a.id === "ask_what_he_fixed")).toBeUndefined();
  });

  it("asking for another opinion sets trust_mechanic false and hides the trusting options entirely", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const afterAsk = engine.submitAction(created.value, "ask_another_opinion");
    if (!afterAsk.ok || !afterAsk.value) throw new Error("expected success");
    expect((afterAsk.value.kindState as StoryGraphKindState).variables["trust_mechanic"]).toBe(false);

    const available = engine.availableActions(afterAsk.value);
    expect(available.map((a) => a.id)).toEqual(["ask_what_he_fixed"]);
  });

  it.each(["believe_him", "ignore_warning", "turn_up_music"])(
    "%s all set trust_mechanic true, matching the driving scene's own 3-true/1-false split",
    (choiceId) => {
      const { registry, kinds } = buildValidRegistry();
      const engine = createEngine({ kinds, registry });
      const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
      if (!created.ok || !created.value) throw new Error("expected success");

      const after = engine.submitAction(created.value, choiceId);
      if (!after.ok || !after.value) throw new Error("expected success");
      expect((after.value.kindState as StoryGraphKindState).variables["trust_mechanic"]).toBe(true);
    },
  );
});

describe("bulgaria-driving — both endings are reachable", () => {
  it("believe_him, then pay_immediately reaches ending_trusting", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterBelieve = engine.submitAction(created.value, "believe_him");
    if (!afterBelieve.ok || !afterBelieve.value) throw new Error("expected success");

    const result = engine.submitAction(afterBelieve.value, "pay_immediately");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");

    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.endingId).toBe("trusting_the_mechanic");
    expect(finalKindState.unlockedAchievements).toEqual([]);

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "trusting_the_mechanic", outcome: "neutral" });
  });

  it("ask_another_opinion, then ask_what_he_fixed reaches ending_skeptical", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterAsk = engine.submitAction(created.value, "ask_another_opinion");
    if (!afterAsk.ok || !afterAsk.value) throw new Error("expected success");

    const result = engine.submitAction(afterAsk.value, "ask_what_he_fixed");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");

    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.endingId).toBe("asked_for_a_second_opinion");

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "asked_for_a_second_opinion", outcome: "neutral" });
  });

  it("submitting the hidden branch's choice anyway is rejected as unknown_action, indistinguishable from a nonexistent id (03 §4)", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_DRIVING_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterBelieve = engine.submitAction(created.value, "believe_him");
    if (!afterBelieve.ok || !afterBelieve.value) throw new Error("expected success");

    // trust_mechanic is true here, so ask_what_he_fixed is hidden, not just disabled.
    const result = engine.submitAction(afterBelieve.value, "ask_what_he_fixed");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});
