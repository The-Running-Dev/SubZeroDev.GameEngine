import { describe, it, expect } from "vitest";
import type { Campaign } from "../core/registry/types.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";
import { validateCampaign } from "../kinds/simulation/validate.js";
import {
  duplicateIdFixture,
  danglingReferenceFixture,
  numericNaturalKeyFixture,
  missingStringKeyFixture,
  readOnlyFieldFixture,
} from "./stable-life.broken.js";

/** Mirrors `buildStableLifeCampaign`'s own assembly — see `stable-life.ts`. Deliberately does
 *  **not** add anything beyond the campaign title: a `startingEffects` `LocKey` a fixture
 *  introduces must stay unregistered for `missingStringKeyFixture` to actually exercise
 *  `missing_string_key`. */
function build(source: SimulationCampaignSource): { campaign: Campaign; strings: ReadonlyMap<string, string> } {
  const { content, authoredText } = buildSimulationCampaign(source);
  const campaign: Campaign = {
    id: "stable-life-broken",
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life.campaign.title",
    content,
  };
  const result = buildCampaign(campaign, [{ key: "stable-life.campaign.title", text: "Stable Life" }, ...authoredText]);
  if (!result.ok || !result.value) throw new Error("fixture failed to build");
  return { campaign, strings: result.value.strings };
}

describe("stable-life broken fixtures", () => {
  it("duplicateIdFixture fails Tier 1 with duplicate_id at the shared goal id", () => {
    const { campaign, strings } = build(duplicateIdFixture);
    const result = validateCampaign(campaign, strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "duplicate_id", path: "goal-well-rested" }),
    );
  });

  it("danglingReferenceFixture fails Tier 1 with dangling_reference at the missing housing id", () => {
    const { campaign, strings } = build(danglingReferenceFixture);
    const result = validateCampaign(campaign, strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "housing-nonexistent" }),
    );
  });

  it("numericNaturalKeyFixture fails Tier 1 with numeric_natural_key at the all-digit npc id", () => {
    const { campaign, strings } = build(numericNaturalKeyFixture);
    const result = validateCampaign(campaign, strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "numeric_natural_key", path: "123" }),
    );
  });

  it("missingStringKeyFixture fails Tier 1 with missing_string_key at the unregistered descriptionKey", () => {
    const { campaign, strings } = build(missingStringKeyFixture);
    const result = validateCampaign(campaign, strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "stable-life-broken.effect.missing" }),
    );
  });

  it("readOnlyFieldFixture fails Tier 1 with read_only_field at the formula-only target", () => {
    const { campaign, strings } = build(readOnlyFieldFixture);
    const result = validateCampaign(campaign, strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "read_only_field", path: "world.strangeness" }),
    );
  });
});
