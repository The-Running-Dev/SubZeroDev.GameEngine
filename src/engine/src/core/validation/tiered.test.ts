import { describe, it, expect } from "vitest";
import { buildValidatedContentRegistry, buildValidatedPackRegistry } from "./tiered.js";
import type { ValidationResult } from "./types.js";
import type { BuiltCampaign, Campaign } from "../registry/types.js";
import { computeResolutionId, type ContentPack } from "../registry/packs.js";
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
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(),
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

  it("threads a used kind's reasonMessages into the built registry's strings (04 §12)", () => {
    const kindWithMessage = makeStubKind({
      reasonCodes: ["dangling_node"],
      reasonMessages: new Map([["story-graph.reason.dangling_node", "A node reference is dangling."]]),
    });
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds(kindWithMessage));
    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("story-graph.reason.dangling_node")).toBe("A node reference is dangling.");
  });

  it("fails registry construction when a used kind declares a reasonCode with no matching message", () => {
    const incompleteKind = makeStubKind({
      reasonCodes: ["dangling_node"],
      reasonMessages: new Map(), // missing "story-graph.reason.dangling_node"
    });
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds(incompleteKind));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_kind_reason_message" && e.path === "story-graph.reason.dangling_node")).toBe(
      true,
    );
  });

  it("never checks or threads a kind's messages when no campaign in the batch uses it", () => {
    // A KindRegistry test double that only supplies "story-graph" — a campaign referencing
    // any other kind must never touch a (possibly absent) reasonMessages on it.
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds());
    expect(result.ok).toBe(true);
  });
});

function makePack(overrides?: Partial<ContentPack>): ContentPack {
  return {
    id: "pack-a",
    version: "1.0.0",
    kindId: "story-graph",
    dependsOn: [],
    campaigns: [],
    strings: new Map(),
    ...overrides,
  };
}

describe("buildValidatedPackRegistry", () => {
  it("W76.1 — folds an ordered pack set into a validated registry whose resolution matches computeResolutionId, distinct for a one- vs two-pack set", () => {
    const packA = makePack({
      id: "pack-a",
      campaigns: [built(makeCampaign({ id: "camp-a" }))],
      strings: new Map([["test.title", "Test Title"]]),
    });
    const packB = makePack({
      id: "pack-b",
      campaigns: [built(makeCampaign({ id: "camp-b" }))],
      strings: new Map([["test.title", "Test Title"]]),
    });

    const one = buildValidatedPackRegistry([packA], makeKinds());
    const two = buildValidatedPackRegistry([packA, packB], makeKinds());

    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
    expect(one.value?.resolution).toBe(computeResolutionId([packA]));
    expect(two.value?.resolution).toBe(computeResolutionId([packA, packB]));
    expect(one.value?.resolution).not.toBe(two.value?.resolution);
    // No caller reattaches anything: every campaign's own version is already stamped.
    expect(one.value?.campaigns.get("camp-a")?.version).toBe(one.value?.resolution);
    expect(two.value?.campaigns.get("camp-b")?.version).toBe(two.value?.resolution);
  });

  it("W76.2 — merges the used kind's own <kindId>.reason.* messages into the frozen table", () => {
    const kindWithMessage = makeStubKind({
      reasonCodes: ["dangling_node"],
      reasonMessages: new Map([["story-graph.reason.dangling_node", "A node reference is dangling."]]),
    });
    const pack = makePack({
      campaigns: [built(makeCampaign())],
      strings: new Map([["test.title", "Test Title"]]),
    });

    const result = buildValidatedPackRegistry([pack], makeKinds(kindWithMessage));

    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("story-graph.reason.dangling_node")).toBe("A node reference is dangling.");
  });

  it("W76.3 — fails at the fold stage on a Tier 1 pack-set violation, reporting only that stage's errors and no registry", () => {
    // The campaign's kindId ("simulation") doesn't match its pack's ("story-graph") —
    // 11 §7's first Tier 1 rule — so resolvePacks itself fails before any campaign is validated.
    const mismatched = makePack({
      kindId: "story-graph",
      campaigns: [built(makeCampaign({ kindId: "simulation" }))],
      strings: new Map([["test.title", "Test Title"]]),
    });

    const result = buildValidatedPackRegistry([mismatched], makeKinds());

    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("pack_kind_mismatch");
  });

  it("W76.3 — fails at the campaign stage when the fold resolves but a campaign fails Tier 1, reporting only that stage's errors and no registry", () => {
    // The pack itself folds cleanly (kinds match, no duplicate id, no protected write) —
    // the failure is 04 §11's own campaign-shape check, which only runs once folding succeeds.
    const badShape = makePack({
      campaigns: [built(makeCampaign({ id: "Not_Kebab_Case" }))],
      strings: new Map([["test.title", "Test Title"]]),
    });

    const result = buildValidatedPackRegistry([badShape], makeKinds());

    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("invalid_identifier");
  });

  it("W76.4 — combines Tier 2 warnings from both the fold stage and the campaign-validation stage into one result", () => {
    const warningKind = makeStubKind({
      validateCampaign: (): ValidationResult => ({
        ok: true,
        errors: [],
        warnings: [{ code: "no_reachable_choice", messageKey: "kind.story-graph.reason.no_reachable_choice" }],
      }),
    });
    const packA = makePack({
      id: "pack-a",
      campaigns: [built(makeCampaign({ id: "camp-a" }))],
      strings: new Map([["test.title", "Test Title"]]),
    });
    // A second pack introducing a key no earlier pack shipped trips resolvePacks' own
    // Tier 2 "probably a typo" heuristic (registry/packs.ts).
    const packB = makePack({
      id: "pack-b",
      dependsOn: [{ id: packA.id, version: packA.version }],
      campaigns: [],
      strings: new Map([["pack-b.new-key", "New text"]]),
    });

    const result = buildValidatedPackRegistry([packA, packB], makeKinds(warningKind));

    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "pack_override_unexpected" && w.path === "pack-b.new-key")).toBe(true);
    expect(result.warnings.some((w) => w.code === "no_reachable_choice")).toBe(true);
  });

  it("W76.5 — the no-pack route is unchanged: buildValidatedContentRegistry still yields resolution undefined", () => {
    const result = buildValidatedContentRegistry([built(makeCampaign())], makeKinds());
    expect(result.ok).toBe(true);
    expect(result.value?.resolution).toBeUndefined();
  });

  it("W76.6 — validates a campaign against the fully folded string table, not just its own pack's", () => {
    // camp-a's titleKey has no string in pack-a at all — only pack-b, which comes later in
    // the fold, supplies it. Validation must run against the merged table (11 §3's per-key
    // replace already folded pack-b's contribution in) or this campaign fails
    // missing_string_key even though the resolved registry has the key.
    const packA = makePack({
      id: "pack-a",
      // The built campaign's own `.strings` is not read by `resolvePacks` — only the
      // pack-level `strings` map, below, feeds the fold — so it is irrelevant here.
      campaigns: [built(makeCampaign({ id: "camp-a", titleKey: "test.title" }))],
      strings: new Map(),
    });
    const packB = makePack({
      id: "pack-b",
      dependsOn: [{ id: packA.id, version: packA.version }],
      campaigns: [],
      strings: new Map([["test.title", "Test Title"]]),
    });

    const result = buildValidatedPackRegistry([packA, packB], makeKinds());

    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("test.title")).toBe("Test Title");
  });
});
