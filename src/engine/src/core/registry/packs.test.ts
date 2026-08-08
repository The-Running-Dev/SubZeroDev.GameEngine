import { describe, it, expect } from "vitest";
import { computeResolutionId, resolvePacks } from "./packs.js";
import type { ContentPack, PackRef } from "./packs.js";
import type { BuiltCampaign, Campaign } from "./types.js";

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {}, ...overrides };
}

function built(campaign: Campaign, strings: Record<string, string> = {}): BuiltCampaign {
  return { campaign, strings: new Map(Object.entries(strings)) };
}

function pack(overrides: Partial<ContentPack> & Pick<ContentPack, "id" | "version">): ContentPack {
  return {
    kindId: "story-graph",
    dependsOn: [],
    campaigns: [],
    strings: new Map(),
    ...overrides,
  };
}

describe("computeResolutionId", () => {
  it("is the same digest for the same ordered {id, version} list", () => {
    const packs: ContentPack[] = [pack({ id: "base", version: "1" }), pack({ id: "culture", version: "1" })];
    expect(computeResolutionId(packs)).toBe(computeResolutionId(packs.map((p) => ({ ...p }))));
  });

  it("is a different digest when the same list is given in a different order", () => {
    const a = [pack({ id: "base", version: "1" }), pack({ id: "culture", version: "1" })];
    const b = [pack({ id: "culture", version: "1" }), pack({ id: "base", version: "1" })];
    expect(computeResolutionId(a)).not.toBe(computeResolutionId(b));
  });
});

describe("resolvePacks", () => {
  it("succeeds with no packs, producing an empty registry and a stable resolution for the empty set", () => {
    const result = resolvePacks([]);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.size).toBe(0);
    expect(result.value?.strings.size).toBe(0);
    expect(result.value?.resolution).toBe(computeResolutionId([]));
  });

  it("replaces a campaign wholesale by id when a later pack carries the same id, never field-merging it", () => {
    const first = pack({
      id: "base",
      version: "1",
      campaigns: [built(makeCampaign({ id: "story", titleKey: "a.title" }), { "a.title": "A" })],
    });
    const second = pack({
      id: "culture",
      version: "1",
      campaigns: [built(makeCampaign({ id: "story", titleKey: "b.title" }), { "b.title": "B" })],
    });
    const result = resolvePacks([first, second]);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.size).toBe(1);
    const resolved = result.value?.campaigns.get("story");
    expect(resolved?.titleKey).toBe("b.title");
  });

  it("replaces a string per key rather than wholesale, letting a culture pack restyle one line", () => {
    const first = pack({ id: "base", version: "1", strings: new Map([["node.start", "Hello."]]) });
    const second = pack({ id: "culture", version: "1", strings: new Map([["node.start", "Bonjour."]]) });
    const result = resolvePacks([first, second]);
    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("node.start")).toBe("Bonjour.");
  });

  it("stamps every produced campaign's version with the ResolutionId", () => {
    const packs: ContentPack[] = [
      pack({ id: "base", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] }),
      pack({ id: "extra", version: "1", campaigns: [built(makeCampaign({ id: "b" }))] }),
    ];
    const result = resolvePacks(packs);
    expect(result.ok).toBe(true);
    const resolution = computeResolutionId(packs);
    expect(result.value?.campaigns.get("a")?.version).toBe(resolution);
    expect(result.value?.campaigns.get("b")?.version).toBe(resolution);
    expect(result.value?.resolution).toBe(resolution);
  });

  it("rejects a pack whose campaign kindId doesn't match the pack's own kindId", () => {
    const bad = pack({
      id: "base",
      version: "1",
      kindId: "story-graph",
      campaigns: [built(makeCampaign({ id: "a", kindId: "simulation" }))],
    });
    const result = resolvePacks([bad]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("pack_kind_mismatch");
    expect(result.errors[0]?.path).toBe("a");
  });

  it("rejects two campaigns sharing an id within one pack, while the same collision across packs is fine", () => {
    const withinOnePack = pack({
      id: "base",
      version: "1",
      campaigns: [built(makeCampaign({ id: "dup" })), built(makeCampaign({ id: "dup" }))],
    });
    const result = resolvePacks([withinOnePack]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("duplicate_campaign_id_in_pack");
    expect(result.errors[0]?.path).toBe("dup");
  });

  it("rejects a pack writing into core.reason.*", () => {
    const bad = pack({ id: "base", version: "1", strings: new Map([["core.reason.unknown_action", "Nope."]]) });
    const result = resolvePacks([bad]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("protected_string_key");
  });

  it("fails when a dependsOn names a pack not present in the set", () => {
    const dependent = pack({ id: "culture", version: "1", dependsOn: [{ id: "base", version: "1" }] });
    const result = resolvePacks([dependent]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("pack_dependency_missing");
    expect(result.errors[0]?.path).toBe("base");
  });

  it("fails when two packs require different versions of the same dependency, rather than picking one", () => {
    const base1: ContentPack = pack({ id: "base", version: "1" });
    const a = pack({ id: "a", version: "1", dependsOn: [{ id: "base", version: "1" } as PackRef] });
    const b = pack({ id: "b", version: "1", dependsOn: [{ id: "base", version: "2" } as PackRef] });
    const result = resolvePacks([base1, a, b]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "pack_dependency_version_conflict")).toBe(true);
  });

  it("fails on a dependency cycle", () => {
    const a = pack({ id: "a", version: "1", dependsOn: [{ id: "b", version: "1" }] });
    const b = pack({ id: "b", version: "1", dependsOn: [{ id: "a", version: "1" }] });
    const result = resolvePacks([a, b]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "pack_dependency_cycle")).toBe(true);
  });

  it("never returns a partial registry — a structural failure returns errors and no value", () => {
    const bad = pack({ id: "base", version: "1", strings: new Map([["core.reason.unknown_action", "Nope."]]) });
    const result = resolvePacks([bad]);
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
  });

  it("warns when a later pack overrides a campaign no earlier pack supplied", () => {
    const first = pack({ id: "base", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] });
    const second = pack({ id: "extra", version: "1", campaigns: [built(makeCampaign({ id: "b" }))] });
    const result = resolvePacks([first, second]);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "pack_override_unexpected" && w.path === "b")).toBe(true);
  });

  it("warns when a later pack overrides a string no earlier pack supplied", () => {
    const first = pack({ id: "base", version: "1" });
    const second = pack({ id: "extra", version: "1", strings: new Map([["node.new", "New."]]) });
    const result = resolvePacks([first, second]);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "pack_override_unexpected" && w.path === "node.new")).toBe(true);
  });

  it("never warns about the first pack's own content, since nothing could have preceded it", () => {
    const first = pack({
      id: "base",
      version: "1",
      campaigns: [built(makeCampaign({ id: "a" }))],
      strings: new Map([["node.start", "Hello."]]),
    });
    const result = resolvePacks([first]);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not warn when a later pack genuinely overrides content an earlier pack supplied", () => {
    const first = pack({ id: "base", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] });
    const second = pack({ id: "culture", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] });
    const result = resolvePacks([first, second]);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
