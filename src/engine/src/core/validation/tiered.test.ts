import { describe, it, expect } from "vitest";
import { buildValidatedContentRegistry } from "./tiered.js";
import type { ValidationResult } from "./types.js";
import type { BuiltCampaign, Campaign } from "../registry/types.js";
import type { Kind, KindRegistry } from "../kernel/types.js";

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {}, ...overrides };
}

function built(campaign: Campaign, strings: Record<string, string> = { "test.title": "Test Title" }): BuiltCampaign {
  return { campaign, strings: new Map(Object.entries(strings)) };
}

function makeStubKind(overrides?: Partial<Kind<unknown>>): Kind<unknown> {
  return {
    id: "story-graph",
    reasonCodes: [],
    eventNames: [],
    initialState: () => ({ state: {}, status: "active", changes: [], messages: [] }),
    availableActions: () => [],
    scene: () => ({ textKey: "test.scene", text: "" }),
    advance: (state) => ({ state, status: "active", changes: [], messages: [] }),
    project: () => ({}),
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    outcome: () => ({}),
    ...overrides,
  };
}

function makeKinds(kind: Kind<unknown> = makeStubKind()): KindRegistry {
  return { "story-graph": kind } as unknown as KindRegistry;
}

describe("buildValidatedContentRegistry", () => {
  it("succeeds for a well-formed campaign with no kind-reported problems", () => {
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds());
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.get("test-campaign")).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it("fails on a malformed campaign id, with a path and no value", () => {
    const campaign = makeCampaign({ id: "Not_Kebab_Case" });
    const result = buildValidatedContentRegistry([built(campaign)], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.errors[0]?.code).toBe("invalid_identifier");
    expect(result.errors[0]?.path).toBe("Not_Kebab_Case");
  });

  it("fails on a malformed titleKey shape", () => {
    const campaign = makeCampaign({ titleKey: "NotDotted" });
    const result = buildValidatedContentRegistry([built(campaign, { NotDotted: "x" })], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("invalid_loc_key");
  });

  it("accepts a hyphenated titleKey — 04 §17's ASCII [a-z0-9_-] rule applies to LocKeys too", () => {
    const campaign = makeCampaign({ titleKey: "event.pipe-disaster.title" });
    const result = buildValidatedContentRegistry(
      [built(campaign, { "event.pipe-disaster.title": "Pipe Disaster" })],
      makeKinds(),
    );
    expect(result.ok).toBe(true);
  });

  it("fails when titleKey is well-formed but has no authored string", () => {
    const campaign = makeCampaign({ titleKey: "test.title" });
    const result = buildValidatedContentRegistry([built(campaign, {})], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("missing_string_key");
    expect(result.errors[0]?.path).toBe("test.title");
  });

  it("folds in a kind-reported Tier-1 error", () => {
    const failingKind = makeStubKind({
      validateCampaign: (): ValidationResult => ({
        ok: false,
        errors: [{ code: "dangling_node", messageKey: "kind.story-graph.reason.dangling_node", path: "node.gone" }],
        warnings: [],
      }),
    });
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds(failingKind));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "dangling_node")).toBe(true);
  });

  it("a Tier-2 warning still loads: ok:true, a real registry, and the warning surfaced", () => {
    const warningKind = makeStubKind({
      validateCampaign: (): ValidationResult => ({
        ok: true,
        errors: [],
        warnings: [{ code: "no_reachable_choice", messageKey: "kind.story-graph.reason.no_reachable_choice" }],
      }),
    });
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds(warningKind));
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.size).toBe(1);
    expect(result.warnings.some((w) => w.code === "no_reachable_choice")).toBe(true);
  });

  it("never reaches buildContentRegistry when Tier 1 fails — a duplicate id never surfaces alongside a shape error", () => {
    // Same id twice would trip buildContentRegistry's own duplicate-id check, *if*
    // buildContentRegistry were ever called — it shouldn't be, because the third campaign
    // fails a core-owned Tier-1 check first.
    const first = built(makeCampaign({ id: "dup" }));
    const second = built(makeCampaign({ id: "dup" }));
    const shapeBad = built(makeCampaign({ id: "Bad_Shape" }));

    const result = buildValidatedContentRegistry([first, second, shapeBad], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_identifier")).toBe(true);
    expect(result.errors.some((e) => e.code === "duplicate_campaign_id")).toBe(false);
  });

  it("accumulates every Tier-1 problem across multiple campaigns, not just the first", () => {
    const a = built(makeCampaign({ id: "Bad_A" }));
    const b = built(makeCampaign({ id: "Bad_B" }));
    const result = buildValidatedContentRegistry([a, b], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.errors.filter((e) => e.code === "invalid_identifier")).toHaveLength(2);
  });

  it("reports unknown_kind instead of throwing when a campaign's kind isn't registered", () => {
    const campaign = makeCampaign({ kindId: "simulation" });
    const result = buildValidatedContentRegistry([built(campaign)], makeKinds());
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_kind");
  });
});
