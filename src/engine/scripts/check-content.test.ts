import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import type { Campaign } from "../src/core/registry/types.js";
import { buildCampaign } from "../src/core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../src/kinds/simulation/source.js";
import type { StoryGraphCampaignSource } from "../src/kinds/story-graph/source.js";

import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import {
  danglingNodeFixture,
  undeclaredVariableFixture,
  unreachableNodeFixture,
  settlementCycleFixture,
} from "../src/campaigns/bulgaria-bureaucracy.broken.js";
import { stableLifeSource } from "../src/campaigns/stable-life.js";
import {
  duplicateIdFixture,
  danglingReferenceFixture,
  numericNaturalKeyFixture,
  missingStringKeyFixture,
  readOnlyFieldFixture,
} from "../src/campaigns/stable-life.broken.js";

import {
  KINDS,
  CAMPAIGN_CATALOGUE,
  EXCLUDED_MODULES,
  checkBuiltCampaign,
  hasFailures,
  type ContentCheckResult,
} from "./check-content.js";

const CAMPAIGNS_DIR = fileURLToPath(new URL("../src/campaigns/", import.meta.url));

function buildStoryGraphFixture(source: StoryGraphCampaignSource): ContentCheckResult {
  const built = buildBulgariaBureaucracyCampaign(source);
  if (!built.ok || !built.value) throw new Error("story-graph fixture failed to build");
  return checkBuiltCampaign(built.value);
}

/** Mirrors `stable-life.broken.test.ts`'s own assembly — see that file for why it deliberately
 *  adds nothing beyond the campaign title. */
function buildSimulationFixture(source: SimulationCampaignSource): ContentCheckResult {
  const { content, authoredText } = buildSimulationCampaign(source);
  const campaign: Campaign = {
    id: "stable-life-broken",
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life.campaign.title",
    content,
  };
  const result = buildCampaign(campaign, [{ key: "stable-life.campaign.title", text: "Stable Life" }, ...authoredText]);
  if (!result.ok || !result.value) throw new Error("simulation fixture failed to build");
  return checkBuiltCampaign({ campaign, strings: result.value.strings }, KINDS);
}

describe("checkBuiltCampaign — W77.1, W77.2", () => {
  it("reports a Tier 1 error with its code, a resolved message, and a path", () => {
    const result = buildStoryGraphFixture(undeclaredVariableFixture);

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "undeclared_variable",
        path: "office_visits_undeclared",
      }),
    ]);
    expect(result.errors[0]!.message).not.toBe("story-graph.reason.undeclared_variable");
    expect(result.errors[0]!.message.length).toBeGreaterThan(0);
    expect(hasFailures(result)).toBe(true);
  });

  it("a campaign with only Tier 2 warnings reports them and does not carry a failure", () => {
    const result = buildStoryGraphFixture(unreachableNodeFixture);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "unreachable_node", path: "orphan_office" }),
    ]);
    expect(result.warnings[0]!.message).not.toBe("story-graph.reason.unreachable_node");
    expect(hasFailures(result)).toBe(false);
  });

  it("a clean campaign reports neither errors nor a failure", () => {
    const built = buildBulgariaBureaucracyCampaign();
    if (!built.ok || !built.value) throw new Error("bulgaria-bureaucracy failed to build");
    const result = checkBuiltCampaign(built.value);

    expect(result.errors).toEqual([]);
    expect(hasFailures(result)).toBe(false);
  });
});

describe("bulgaria-bureaucracy.broken.ts — W77.3, W77.6", () => {
  const fixtures = {
    danglingNodeFixture: buildStoryGraphFixture(danglingNodeFixture),
    undeclaredVariableFixture: buildStoryGraphFixture(undeclaredVariableFixture),
    unreachableNodeFixture: buildStoryGraphFixture(unreachableNodeFixture),
    settlementCycleFixture: buildStoryGraphFixture(settlementCycleFixture),
  };

  it("danglingNodeFixture reports exactly one Tier 1 error and cascades to 12 Tier 2 warnings", () => {
    expect(fixtures.danglingNodeFixture.errors).toHaveLength(1);
    expect(fixtures.danglingNodeFixture.errors[0]).toMatchObject({ code: "dangling_reference", path: "nonexistent_office" });
    expect(fixtures.danglingNodeFixture.warnings).toHaveLength(12);
  });

  it("undeclaredVariableFixture reports exactly one Tier 1 error and no warnings", () => {
    expect(fixtures.undeclaredVariableFixture.errors).toHaveLength(1);
    expect(fixtures.undeclaredVariableFixture.errors[0]).toMatchObject({ code: "undeclared_variable", path: "office_visits_undeclared" });
    expect(fixtures.undeclaredVariableFixture.warnings).toHaveLength(0);
  });

  it("unreachableNodeFixture reports no errors and exactly one Tier 2 warning", () => {
    expect(fixtures.unreachableNodeFixture.errors).toHaveLength(0);
    expect(fixtures.unreachableNodeFixture.warnings).toHaveLength(1);
    expect(fixtures.unreachableNodeFixture.warnings[0]).toMatchObject({ code: "unreachable_node", path: "orphan_office" });
  });

  it("settlementCycleFixture reports no errors and exactly seven cascading Tier 2 warnings", () => {
    expect(fixtures.settlementCycleFixture.errors).toHaveLength(0);
    expect(fixtures.settlementCycleFixture.warnings).toHaveLength(7);
    expect(fixtures.settlementCycleFixture.warnings).toContainEqual(
      expect.objectContaining({ code: "unreachable_cycle", path: "registry_route_event_2" }),
    );
  });

  it("every finding across all four fixtures carries a path (W77.6)", () => {
    for (const result of Object.values(fixtures)) {
      for (const finding of [...result.errors, ...result.warnings]) {
        expect(finding.path, `${finding.code} has no path`).toBeDefined();
      }
    }
  });

  it("the file totals two Tier 1 errors and twenty Tier 2 warnings", () => {
    const totalErrors = Object.values(fixtures).reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = Object.values(fixtures).reduce((sum, r) => sum + r.warnings.length, 0);
    expect(totalErrors).toBe(2);
    expect(totalWarnings).toBe(20);
  });
});

describe("stable-life.broken.ts — W77.3, W77.6", () => {
  const fixtures = {
    duplicateIdFixture: buildSimulationFixture(duplicateIdFixture),
    danglingReferenceFixture: buildSimulationFixture(danglingReferenceFixture),
    numericNaturalKeyFixture: buildSimulationFixture(numericNaturalKeyFixture),
    missingStringKeyFixture: buildSimulationFixture(missingStringKeyFixture),
    readOnlyFieldFixture: buildSimulationFixture(readOnlyFieldFixture),
  };

  it("duplicateIdFixture reports duplicate_id at the shared goal id", () => {
    expect(fixtures.duplicateIdFixture.errors).toEqual([expect.objectContaining({ code: "duplicate_id", path: "goal-well-rested" })]);
    expect(fixtures.duplicateIdFixture.warnings).toHaveLength(0);
  });

  it("danglingReferenceFixture reports dangling_reference and one cascading unreachable_content warning", () => {
    expect(fixtures.danglingReferenceFixture.errors).toEqual([
      expect.objectContaining({ code: "dangling_reference", path: "housing-nonexistent" }),
    ]);
    expect(fixtures.danglingReferenceFixture.warnings).toEqual([
      expect.objectContaining({ code: "unreachable_content", path: "housing-default" }),
    ]);
  });

  it("numericNaturalKeyFixture reports numeric_natural_key at the all-digit npc id", () => {
    expect(fixtures.numericNaturalKeyFixture.errors).toEqual([expect.objectContaining({ code: "numeric_natural_key", path: "123" })]);
    expect(fixtures.numericNaturalKeyFixture.warnings).toHaveLength(0);
  });

  it("missingStringKeyFixture reports missing_string_key at the unregistered descriptionKey", () => {
    expect(fixtures.missingStringKeyFixture.errors).toEqual([
      expect.objectContaining({ code: "missing_string_key", path: "stable-life-broken.effect.missing" }),
    ]);
    expect(fixtures.missingStringKeyFixture.warnings).toHaveLength(0);
  });

  it("readOnlyFieldFixture reports read_only_field at the formula-only target", () => {
    expect(fixtures.readOnlyFieldFixture.errors).toEqual([expect.objectContaining({ code: "read_only_field", path: "world.strangeness" })]);
    expect(fixtures.readOnlyFieldFixture.warnings).toHaveLength(0);
  });

  it("every finding across all five fixtures carries a path (W77.6)", () => {
    for (const result of Object.values(fixtures)) {
      for (const finding of [...result.errors, ...result.warnings]) {
        expect(finding.path, `${finding.code} has no path`).toBeDefined();
      }
    }
  });

  it("the file totals five Tier 1 errors and one Tier 2 warning", () => {
    const totalErrors = Object.values(fixtures).reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = Object.values(fixtures).reduce((sum, r) => sum + r.warnings.length, 0);
    expect(totalErrors).toBe(5);
    expect(totalWarnings).toBe(1);
  });
});

describe("catalogue coverage — W77.4", () => {
  // A module "exports a campaign builder" iff it declares a top-level `export function`
  // whose name starts with `build` and ends with `Campaign` (optionally `...CampaignBG`)
  // — the naming convention every committed campaign builder in this repository follows.
  const CAMPAIGN_BUILDER_EXPORT = /^export function (build\w*Campaign(?:BG)?)\s*\(/m;

  function campaignModuleFiles(): string[] {
    return readdirSync(CAMPAIGNS_DIR).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  }

  it("every campaigns/*.ts module exporting a campaign builder is catalogued or excluded with a stated reason", () => {
    for (const file of campaignModuleFiles()) {
      const text = readFileSync(join(CAMPAIGNS_DIR, file), "utf8");
      if (!CAMPAIGN_BUILDER_EXPORT.test(text)) continue;

      const inCatalogue = Object.hasOwn(CAMPAIGN_CATALOGUE, file);
      const excludedReason = EXCLUDED_MODULES[file];
      expect(
        inCatalogue || (excludedReason !== undefined && excludedReason.length > 0),
        `${file} exports a campaign builder but is neither catalogued nor excluded with a reason`,
      ).toBe(true);
      expect(inCatalogue && excludedReason !== undefined, `${file} is both catalogued and excluded`).toBe(false);
    }
  });

  it("the deliberately-broken and second-locale fixtures are excluded on the record", () => {
    for (const file of ["bulgaria-bureaucracy.broken.ts", "stable-life.broken.ts", "bulgaria-bureaucracy.bg.ts"]) {
      expect(EXCLUDED_MODULES[file], `${file} has no stated exclusion reason`).toBeTruthy();
    }
  });

  it("every catalogued campaign builds and checks cleanly through the same checker (W77.5)", () => {
    for (const [file, entry] of Object.entries(CAMPAIGN_CATALOGUE)) {
      const built = entry.build();
      if (!built.ok || !built.value) throw new Error(`${file}: catalogued campaign failed to build`);
      const result = checkBuiltCampaign(built.value);
      expect(result.errors, `${file} reported an unexpected Tier 1 error`).toEqual([]);
    }
  });
});

describe("checkBuiltCampaign delegates to buildValidatedContentRegistry unchanged — W77.5", () => {
  it("is pure — checking the same built campaign twice returns equal findings", () => {
    const built = buildBulgariaBureaucracyCampaign(danglingNodeFixture);
    if (!built.ok || !built.value) throw new Error("fixture failed to build");

    const first = checkBuiltCampaign(built.value);
    const second = checkBuiltCampaign(built.value);
    expect(second).toEqual(first);
  });

  it("the real committed stable-life source still checks clean through the same build path", () => {
    const result = buildSimulationFixture(stableLifeSource);
    expect(result.errors).toEqual([]);
  });
});
