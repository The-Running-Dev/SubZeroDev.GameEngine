import { describe, it, expect } from "vitest";
import { buildStoryGraphCampaign } from "../kinds/story-graph/source.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { bulgariaReturnSource, buildBulgariaReturnCampaign, BULGARIA_RETURN_CAMPAIGN_ID } from "./bulgaria-return.js";

function buildValidRegistry(): { registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildBulgariaReturnCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected the real campaign to validate");
  return { registry: result.value, kinds };
}

describe("bulgaria-return — loads clean", () => {
  it("builds and validates with zero Tier 1 errors and zero Tier 2 warnings", () => {
    const built = buildBulgariaReturnCampaign();
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
    const { authoredText } = buildStoryGraphCampaign(bulgariaReturnSource);
    for (const { key } of authoredText) {
      expect(registry.strings.has(key)).toBe(true);
    }
  });
});

describe("bulgaria-return — all four choices reach the one ending", () => {
  it.each(["smile", "explain", "laugh", "accept_destiny"])(
    "%s reaches home_again, ended, neutral outcome",
    (choiceId) => {
      const { registry, kinds } = buildValidRegistry();
      const engine = createEngine({ kinds, registry });

      const created = engine.createGame({ campaignId: BULGARIA_RETURN_CAMPAIGN_ID, seed: "any-seed" });
      expect(created.ok).toBe(true);
      if (!created.ok || !created.value) throw new Error("expected success");

      const result = engine.submitAction(created.value, choiceId);
      expect(result.ok).toBe(true);
      if (!result.ok || !result.value) throw new Error("expected success");
      expect(result.value.status).toBe("ended");

      const finalKindState = result.value.kindState as StoryGraphKindState;
      expect(finalKindState.endingId).toBe("home_again");
      expect(finalKindState.unlockedAchievements).toEqual([]);

      const view = engine.view(result.value, "player");
      const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
      expect(kindView.ending).toEqual({ endingId: "home_again", outcome: "neutral" });
    },
  );

  it("an unknown action at the start node is rejected as unknown_action", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_RETURN_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");

    const result = engine.submitAction(created.value, "totally_fake_action");
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });
});
