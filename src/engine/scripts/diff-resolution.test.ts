import { describe, it, expect } from "vitest";

import { stableLifeBasePack, bulgariaCulturePack } from "../src/campaigns/stable-life-packs.js";
import { computeResolutionId } from "../src/core/registry/packs.js";
import type { ContentPack } from "../src/core/registry/packs.js";
import type { BuiltCampaign, Campaign } from "../src/core/registry/types.js";
import { diffPackSets } from "./diff-resolution.js";

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

describe("diffPackSets — W79.1", () => {
  it("reports both ResolutionIds and an itemized diff for [base] versus [base, bulgaria]", () => {
    const result = diffPackSets([stableLifeBasePack], [stableLifeBasePack, bulgariaCulturePack]);
    if (!result.ok || !result.value) throw new Error(`expected diff to succeed: ${JSON.stringify(result.errors)}`);
    const diff = result.value;

    expect(diff.resolutionIdA).toBe(computeResolutionId([stableLifeBasePack]));
    expect(diff.resolutionIdB).toBe(computeResolutionId([stableLifeBasePack, bulgariaCulturePack]));
    expect(diff.resolutionIdA).not.toBe(diff.resolutionIdB);
    expect(diff.identical).toBe(false);

    // The Bulgarian pack (W72) replaces the same campaign id wholesale — no campaign is
    // added or removed, exactly one ("stable-life") is changed.
    expect(diff.campaigns.added).toEqual([]);
    expect(diff.campaigns.removed).toEqual([]);
    expect(diff.campaigns.changed).toEqual(["stable-life"]);

    // W72's Bulgarian pack authors its own `bulgaria-stable-life.*` key namespace with no
    // overlap against the base pack's keys — every one of its keys is new, none override
    // an existing base key. Asserted with the exact counts §W79.1 asks for.
    expect(diff.strings.added.length).toBe(bulgariaCulturePack.strings.size);
    expect(diff.strings.removed).toEqual([]);
    expect(diff.strings.changed).toEqual([]);
  });
});

describe("diffPackSets — W79.2", () => {
  it("reports a key whose value changed as changed, distinct from added or removed", () => {
    // Real committed content has no overlapping key between the base and Bulgarian
    // packs (asserted above), so the value-change case — a key present under both
    // resolutions with different text, distinct from a key that is only added or only
    // removed — is demonstrated on a synthetic pair, the same way `packs.test.ts` proves
    // `resolvePacks` mechanisms.
    const base = pack({
      id: "base",
      version: "1",
      campaigns: [built(makeCampaign())],
      strings: new Map(Object.entries({ shared: "hello", "base-only": "still here" })),
    });
    const override = pack({
      id: "override",
      version: "1",
      campaigns: [],
      strings: new Map(Object.entries({ shared: "bonjour", "override-only": "new here" })),
    });

    const result = diffPackSets([base], [base, override]);
    if (!result.ok || !result.value) throw new Error(`expected diff to succeed: ${JSON.stringify(result.errors)}`);
    const diff = result.value;

    expect(diff.strings.changed).toEqual(["shared"]);
    expect(diff.strings.added).toEqual(["override-only"]);
    expect(diff.strings.removed).toEqual([]);
    expect(diff.strings.added).not.toContain("shared");
    expect(diff.strings.removed).not.toContain("shared");
  });
});

describe("diffPackSets — W79.3", () => {
  it("reports equal ids and an explicit empty diff for two identical pack sets", () => {
    const result = diffPackSets([stableLifeBasePack], [stableLifeBasePack]);
    if (!result.ok || !result.value) throw new Error(`expected diff to succeed: ${JSON.stringify(result.errors)}`);
    const diff = result.value;

    expect(diff.resolutionIdA).toBe(diff.resolutionIdB);
    expect(diff.identical).toBe(true);
    expect(diff.campaigns.added).toEqual([]);
    expect(diff.campaigns.removed).toEqual([]);
    expect(diff.campaigns.changed).toEqual([]);
    expect(diff.strings.added).toEqual([]);
    expect(diff.strings.removed).toEqual([]);
    expect(diff.strings.changed).toEqual([]);
  });
});

describe("diffPackSets — W79.4", () => {
  it("is byte-identical across repeated runs over the same two pack sets", () => {
    const a = diffPackSets([stableLifeBasePack], [stableLifeBasePack, bulgariaCulturePack]);
    const b = diffPackSets([stableLifeBasePack], [stableLifeBasePack, bulgariaCulturePack]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not depend on the insertion order of a pack's strings map", () => {
    const reorderedBase = {
      ...stableLifeBasePack,
      strings: new Map([...stableLifeBasePack.strings].reverse()),
    };

    const a = diffPackSets([stableLifeBasePack], [stableLifeBasePack, bulgariaCulturePack]);
    const b = diffPackSets([reorderedBase], [reorderedBase, bulgariaCulturePack]);
    if (!a.ok || !a.value || !b.ok || !b.value) throw new Error("expected both diffs to succeed");

    expect(b.value.strings).toEqual(a.value.strings);
    expect(b.value.campaigns).toEqual(a.value.campaigns);
  });
});
