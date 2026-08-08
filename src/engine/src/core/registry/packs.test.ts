import { describe, it, expect } from "vitest";
import { applyExperimentGates, computeResolutionId, resolveBucketKey, resolveExperimentAssignments, resolvePacks } from "./packs.js";
import type { ContentPack, PackRef } from "./packs.js";
import type { ExperimentSource } from "../composition/types.js";
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

function counting(assignments: Record<string, string | null>): { source: ExperimentSource; calls: Array<{ experimentId: string; bucketKey: string }> } {
  const calls: Array<{ experimentId: string; bucketKey: string }> = [];
  return {
    calls,
    source: {
      resolve(experimentId, bucketKey) {
        calls.push({ experimentId, bucketKey });
        return assignments[experimentId] ?? null;
      },
    },
  };
}

describe("applyExperimentGates", () => {
  it("always includes a pack with no experimentGate", () => {
    const ungated = pack({ id: "base", version: "1" });
    expect(applyExperimentGates([ungated], {})).toEqual([ungated]);
  });

  it("includes a gated pack only on an exact variant match", () => {
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } });
    expect(applyExperimentGates([gated], { colors: "warm" })).toEqual([gated]);
  });

  it("excludes a gated pack when the assignment is a different variant", () => {
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } });
    expect(applyExperimentGates([gated], { colors: "cool" })).toEqual([]);
  });

  it("excludes a gated pack when the assignment is null (not enrolled)", () => {
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } });
    expect(applyExperimentGates([gated], { colors: null })).toEqual([]);
  });

  it("excludes a gated pack when the experimentId key is simply missing", () => {
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } });
    expect(applyExperimentGates([gated], {})).toEqual([]);
  });

  it("with no ExperimentSource supplied (empty assignments), excludes every gated pack and includes every ungated pack", () => {
    const ungated = pack({ id: "base", version: "1" });
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } });
    expect(applyExperimentGates([ungated, gated], {})).toEqual([ungated]);
  });

  it("treats an experimentId colliding with an Object.prototype member as a plain key, in both directions", () => {
    // `__proto__` is the sharp case: on an object literal it stores nothing and reads
    // back as Object.prototype, so without the null-prototype map and the Object.hasOwn
    // guard a real assignment silently vanishes and an absent one compares against an
    // inherited value.
    const gated = pack({ id: "culture", version: "1", experimentGate: { experimentId: "__proto__", variant: "warm" } });
    const inherited = pack({ id: "layout", version: "1", experimentGate: { experimentId: "toString", variant: "grid" } });

    // Computed key, not `{ __proto__: "warm" }` — the literal form is the prototype
    // setter and would store nothing, which is the very bug under test.
    const { source } = counting({ ["__proto__"]: "warm" });
    const assignments = resolveExperimentAssignments([gated], source, "bucket-1");
    expect(applyExperimentGates([gated], assignments)).toEqual([gated]);

    expect(applyExperimentGates([gated, inherited], {})).toEqual([]);
  });

  it("runs before resolvePacks and resolvePacks never sees a gated-out pack", () => {
    const ungated = pack({ id: "base", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] });
    const gatedOut = pack({
      id: "culture",
      version: "1",
      experimentGate: { experimentId: "colors", variant: "warm" },
      campaigns: [built(makeCampaign({ id: "b" }))],
    });
    const filtered = applyExperimentGates([ungated, gatedOut], { colors: "cool" });
    const result = resolvePacks(filtered);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.has("b")).toBe(false);
    // resolvePacks' own signature is untouched — it still takes a plain pack array.
    expect(filtered).toEqual([ungated]);
  });
});

describe("resolveBucketKey", () => {
  it("uses profileId when present", () => {
    expect(resolveBucketKey("profile-1", "seed-1")).toBe("profile-1");
  });

  it("falls back to seed when profileId is absent", () => {
    expect(resolveBucketKey(undefined, "seed-1")).toBe("seed-1");
  });
});

describe("resolveExperimentAssignments", () => {
  it("calls resolve exactly once per distinct experimentId across the candidate packs, keyed by bucketKey", () => {
    const packs: ContentPack[] = [
      pack({ id: "a", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } }),
      pack({ id: "b", version: "1", experimentGate: { experimentId: "colors", variant: "cool" } }),
      pack({ id: "c", version: "1", experimentGate: { experimentId: "layout", variant: "grid" } }),
      pack({ id: "d", version: "1" }),
    ];
    const { source, calls } = counting({ colors: "warm", layout: "grid" });
    const assignments = resolveExperimentAssignments(packs, source, "bucket-1");
    expect(assignments).toEqual({ colors: "warm", layout: "grid" });
    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        { experimentId: "colors", bucketKey: "bucket-1" },
        { experimentId: "layout", bucketKey: "bucket-1" },
      ]),
    );
  });

  it("returns an empty assignment map and calls nothing when no pack is gated", () => {
    const packs: ContentPack[] = [pack({ id: "a", version: "1" })];
    const { source, calls } = counting({});
    expect(resolveExperimentAssignments(packs, source, "bucket-1")).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("returns an empty assignment map without calling resolve when no ExperimentSource is supplied", () => {
    const packs: ContentPack[] = [pack({ id: "a", version: "1", experimentGate: { experimentId: "colors", variant: "warm" } })];
    expect(resolveExperimentAssignments(packs, undefined, "bucket-1")).toEqual({});
  });
});

describe("W59.6 — two variants of the same gated pack set produce different campaignVersions", () => {
  it("resolves distinct ResolutionIds (and therefore campaignVersions) for two different assignment combinations, through the existing digest — no further mechanism", () => {
    const base = pack({ id: "base", version: "1", campaigns: [built(makeCampaign({ id: "a" }))] });
    const warm = pack({
      id: "warm-culture",
      version: "1",
      experimentGate: { experimentId: "colors", variant: "warm" },
      campaigns: [built(makeCampaign({ id: "a", titleKey: "warm.title" }))],
    });
    const cool = pack({
      id: "cool-culture",
      version: "1",
      experimentGate: { experimentId: "colors", variant: "cool" },
      campaigns: [built(makeCampaign({ id: "a", titleKey: "cool.title" }))],
    });
    const candidates = [base, warm, cool];

    const { source: warmSource } = counting({ colors: "warm" });
    const warmAssignments = resolveExperimentAssignments(candidates, warmSource, "player-a");
    const warmPacks = applyExperimentGates(candidates, warmAssignments);
    const warmResult = resolvePacks(warmPacks);

    const { source: coolSource } = counting({ colors: "cool" });
    const coolAssignments = resolveExperimentAssignments(candidates, coolSource, "player-b");
    const coolPacks = applyExperimentGates(candidates, coolAssignments);
    const coolResult = resolvePacks(coolPacks);

    expect(warmResult.ok).toBe(true);
    expect(coolResult.ok).toBe(true);
    expect(warmResult.value?.resolution).not.toBe(coolResult.value?.resolution);
    expect(warmResult.value?.campaigns.get("a")?.version).toBe(warmResult.value?.resolution);
    expect(coolResult.value?.campaigns.get("a")?.version).toBe(coolResult.value?.resolution);
  });
});
