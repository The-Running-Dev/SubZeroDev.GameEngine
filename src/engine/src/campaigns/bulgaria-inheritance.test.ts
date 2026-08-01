import { describe, it, expect } from "vitest";
import { buildStoryGraphCampaign } from "../kinds/story-graph/source.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import {
  bulgariaInheritanceSource,
  buildBulgariaInheritanceCampaign,
  BULGARIA_INHERITANCE_CAMPAIGN_ID,
} from "./bulgaria-inheritance.js";

function buildValidRegistry(): { registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildBulgariaInheritanceCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected the real campaign to validate");
  return { registry: result.value, kinds };
}

describe("bulgaria-inheritance — loads clean", () => {
  it("builds and validates with zero Tier 1 errors and zero Tier 2 warnings", () => {
    const built = buildBulgariaInheritanceCampaign();
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
    const { authoredText } = buildStoryGraphCampaign(bulgariaInheritanceSource);
    for (const { key } of authoredText) {
      expect(registry.strings.has(key)).toBe(true);
    }
  });
});

describe("bulgaria-inheritance — pretend_never_inherited skips family_meeting entirely", () => {
  it("reaches ending_avoided directly from village_life, never visiting family_meeting", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "accept_tomato_logic");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    expect((afterFirst.value.kindState as StoryGraphKindState).currentNodeId).toBe("village_life");

    const result = engine.submitAction(afterFirst.value, "pretend_never_inherited");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");

    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.endingId).toBe("avoided_the_inheritance");

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "avoided_the_inheritance", outcome: "neutral" });
  });
});

describe("bulgaria-inheritance — bring_out_documents is gated on prior choices, not merely disabled", () => {
  it("is absent from availableActions when no earlier choice set has_documentation", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    // call_mother sets no documentation.
    const afterFirst = engine.submitAction(created.value, "call_mother");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    const afterSecond = engine.submitAction(afterFirst.value, "ask_oldest_neighbour");
    if (!afterSecond.ok || !afterSecond.value) throw new Error("expected success");
    expect((afterSecond.value.kindState as StoryGraphKindState).currentNodeId).toBe("family_meeting");
    expect((afterSecond.value.kindState as StoryGraphKindState).variables["has_documentation"]).toBe(false);

    const available = engine.availableActions(afterSecond.value);
    expect(available.map((a) => a.id).sort()).toEqual(["change_subject", "leave_before_lunch", "stay_silent"]);
    expect(available.find((a) => a.id === "bring_out_documents")).toBeUndefined();

    const rejected = engine.submitAction(afterSecond.value, "bring_out_documents");
    expect(rejected.ok).toBe(false);
    expect(rejected.errors[0]?.code).toBe("unknown_action");
  });

  it("is present and leads to ending_resolved (win) when request_records set has_documentation earlier", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "request_records");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    expect((afterFirst.value.kindState as StoryGraphKindState).variables["has_documentation"]).toBe(true);

    const afterSecond = engine.submitAction(afterFirst.value, "ask_oldest_neighbour");
    if (!afterSecond.ok || !afterSecond.value) throw new Error("expected success");

    const available = engine.availableActions(afterSecond.value);
    expect(available.find((a) => a.id === "bring_out_documents")).toBeDefined();

    const result = engine.submitAction(afterSecond.value, "bring_out_documents");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect(result.value.status).toBe("ended");

    const finalKindState = result.value.kindState as StoryGraphKindState;
    expect(finalKindState.endingId).toBe("the_documents_settle_it");

    const view = engine.view(result.value, "player");
    const kindView = view.kindView as { ending?: { endingId: string; outcome: string } };
    expect(kindView.ending).toEqual({ endingId: "the_documents_settle_it", outcome: "win" });
  });

  it("consult_lawyer also sets has_documentation, same as request_records", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const after = engine.submitAction(created.value, "consult_lawyer");
    if (!after.ok || !after.value) throw new Error("expected success");
    expect((after.value.kindState as StoryGraphKindState).variables["has_documentation"]).toBe(true);
  });
});

describe("bulgaria-inheritance — family_tension accumulates and clamps at its floor", () => {
  it("increments on call_mother, decrements on attempt_mediation, never goes below 0", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    expect((created.value.kindState as StoryGraphKindState).variables["family_tension"]).toBe(0);

    // accept_tomato_logic applies no effect at all — tension stays at the floor.
    const afterFirst = engine.submitAction(created.value, "accept_tomato_logic");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    expect((afterFirst.value.kindState as StoryGraphKindState).variables["family_tension"]).toBe(0);

    const afterSecond = engine.submitAction(afterFirst.value, "attempt_mediation");
    if (!afterSecond.ok || !afterSecond.value) throw new Error("expected success");
    expect((afterSecond.value.kindState as StoryGraphKindState).variables["family_tension"]).toBe(0);
  });

  it("cut_padlock (+3) then measure_land_yourself (+1) reaches 4 before the climax", () => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "cut_padlock");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    expect((afterFirst.value.kindState as StoryGraphKindState).variables["family_tension"]).toBe(3);

    const afterSecond = engine.submitAction(afterFirst.value, "measure_land_yourself");
    if (!afterSecond.ok || !afterSecond.value) throw new Error("expected success");
    expect((afterSecond.value.kindState as StoryGraphKindState).variables["family_tension"]).toBe(4);
  });
});

describe("bulgaria-inheritance — the three ungated family_meeting choices all reach ending_unresolved", () => {
  it.each(["stay_silent", "change_subject", "leave_before_lunch"])("%s reaches the_argument_continues", (choiceId) => {
    const { registry, kinds } = buildValidRegistry();
    const engine = createEngine({ kinds, registry });

    const created = engine.createGame({ campaignId: BULGARIA_INHERITANCE_CAMPAIGN_ID, seed: "any-seed" });
    if (!created.ok || !created.value) throw new Error("expected success");
    const afterFirst = engine.submitAction(created.value, "call_mother");
    if (!afterFirst.ok || !afterFirst.value) throw new Error("expected success");
    const afterSecond = engine.submitAction(afterFirst.value, "ask_oldest_neighbour");
    if (!afterSecond.ok || !afterSecond.value) throw new Error("expected success");

    const result = engine.submitAction(afterSecond.value, choiceId);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected success");
    expect((result.value.kindState as StoryGraphKindState).endingId).toBe("the_argument_continues");
  });
});
