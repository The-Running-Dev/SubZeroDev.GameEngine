import { describe, it, expect } from "vitest";
import { buildStoryGraphCampaign } from "../kinds/story-graph/source.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import {
  bulgariaEnterpriseSource,
  buildBulgariaEnterpriseCampaign,
  BULGARIA_ENTERPRISE_CAMPAIGN_ID,
} from "./bulgaria-enterprise.js";

function buildValidRegistry(): { registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildBulgariaEnterpriseCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected the real campaign to validate");
  return { registry: result.value, kinds };
}

describe("bulgaria-enterprise — loads clean", () => {
  it("builds and validates with zero Tier 1 errors and zero Tier 2 warnings", () => {
    const built = buildBulgariaEnterpriseCampaign();
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
    const { authoredText } = buildStoryGraphCampaign(bulgariaEnterpriseSource);
    for (const { key } of authoredText) {
      expect(registry.strings.has(key)).toBe(true);
    }
  });
});

describe("bulgaria-enterprise — all four starting_a_business choices proceed to entrepreneur", () => {
  it.each(["offer_coffee", "hide", "ask_who_invited_them", "pretend_business_never_opened"])(
    "%s proceeds to entrepreneur with debt_cents unchanged at 0",
    (choiceId) => {
      const { registry, kinds } = buildValidRegistry();
      const engine = createEngine({ kinds, registry });
      const created = engine.createGame({ campaignId: BULGARIA_ENTERPRISE_CAMPAIGN_ID, seed: "any-seed" });
      if (!created.ok || !created.value) throw new Error("expected success");

      const result = engine.submitAction(created.value, choiceId);
      expect(result.ok).toBe(true);
      if (!result.ok || !result.value) throw new Error("expected success");
      const kindState = result.value.kindState as StoryGraphKindState;
      expect(kindState.currentNodeId).toBe("entrepreneur");
      expect(kindState.variables["debt_cents"]).toBe(0);
    },
  );
});

describe("bulgaria-enterprise — debt_cents accumulates per entrepreneur choice, all reach the one ending", () => {
  it("borrow_money accumulates the most debt (20000), reaching a_permanent_line_item", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });
    const created = engine.createGame({ campaignId: BULGARIA_ENTERPRISE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "offer_coffee");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");

    const result = engine.submitAction(afterFirst.value, "borrow_money");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");
    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.variables["debt_cents"]).toBe(20000);
    expect(finalKindState.endingId).toBe("a_permanent_line_item");

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "a_permanent_line_item", outcome: "neutral" });
  });

  it("negotiate accumulates less debt (5000) than borrow_money", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });
    const created = engine.createGame({ campaignId: BULGARIA_ENTERPRISE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "hide");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");

    const result = engine.submitAction(afterFirst.value, "negotiate");
    if (!result.ok || !result.value) throw new Error("expected success");
    expect((result.value.kindState as StoryGraphKindState).variables["debt_cents"]).toBe(5000);
    expect((result.value.kindState as StoryGraphKindState).endingId).toBe("a_permanent_line_item");
  });

  it.each(["call_the_client", "discover_entrepreneurship"])(
    "%s carries no debt effect — reaches the ending with debt_cents still 0",
    (choiceId) => {
      const { registry, kinds } = buildValidRegistry();
      const engine = createEngine({ kinds, registry });
      const created = engine.createGame({ campaignId: BULGARIA_ENTERPRISE_CAMPAIGN_ID, seed: "any-seed" });
      if (!created.ok || !created.value) throw new Error("expected success");
      const afterFirst = engine.submitAction(created.value, "ask_who_invited_them");
      if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");

      const result = engine.submitAction(afterFirst.value, choiceId);
      if (!result.ok || !result.value) throw new Error("expected success");
      expect((result.value.kindState as StoryGraphKindState).variables["debt_cents"]).toBe(0);
      expect((result.value.kindState as StoryGraphKindState).endingId).toBe("a_permanent_line_item");
    },
  );

  it("an unknown action at entrepreneur is rejected as unknown_action", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });
    const created = engine.createGame({ campaignId: BULGARIA_ENTERPRISE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "offer_coffee");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");

    const result = engine.submitAction(afterFirst.value, "totally_fake_action");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});
