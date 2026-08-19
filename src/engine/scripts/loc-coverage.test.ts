import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import type { BuiltCampaign } from "../src/core/registry/types.js";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildBulgariaBureaucracyCampaignBG } from "../src/campaigns/bulgaria-bureaucracy.bg.js";
import { CAMPAIGN_CATALOGUE } from "./check-content.js";

import {
  SECOND_LOCALE_CATALOGUE,
  extractLocKeys,
  formatKeyList,
  computeLocaleCoverage,
  computeShelfCoverage,
} from "./loc-coverage.js";

const CAMPAIGNS_DIR = fileURLToPath(new URL("../src/campaigns/", import.meta.url));

function builtEN(): BuiltCampaign {
  const result = buildBulgariaBureaucracyCampaign();
  if (!result.ok || !result.value) throw new Error("expected the English Bureaucracy campaign to build");
  return result.value;
}

function builtBG(): BuiltCampaign {
  const result = buildBulgariaBureaucracyCampaignBG();
  if (!result.ok || !result.value) throw new Error("expected the Bulgarian Bureaucracy campaign to build");
  return result.value;
}

describe("extractLocKeys — W78.1", () => {
  it("emits the complete, sorted set of LocKeys a built campaign requires", () => {
    const built = builtEN();
    const keys = extractLocKeys(built);

    expect(keys).toEqual([...built.strings.keys()].sort());
    expect(keys.length).toBe(built.strings.size);
  });

  it("running it twice, and formatting it, produces byte-identical output", () => {
    const built = builtEN();
    const first = formatKeyList(extractLocKeys(built));
    const second = formatKeyList(extractLocKeys(built));

    expect(first).toBe(second);
  });
});

describe("computeLocaleCoverage — W78.2", () => {
  it("a complete second locale reports full coverage with no missing or extra keys", () => {
    const report = computeLocaleCoverage(builtEN(), builtBG(), "bg");

    expect(report.missing).toEqual([]);
    expect(report.extra).toEqual([]);
    expect(report.total).toBe(builtEN().strings.size);
    expect(report.covered).toBe(report.total);
  });

  it("a fixture with exactly one key removed names that key as missing", () => {
    const en = builtEN();
    const bg = builtBG();
    const removedKey = "bureaucracy.campaign.title";
    expect(bg.strings.has(removedKey)).toBe(true);

    const trimmedStrings = new Map(bg.strings);
    trimmedStrings.delete(removedKey);
    const trimmed: BuiltCampaign = { campaign: bg.campaign, strings: trimmedStrings };

    const report = computeLocaleCoverage(en, trimmed, "bg");

    expect(report.missing).toEqual([removedKey]);
    expect(report.covered).toBe(report.total - 1);
  });

  it("a key present only in the translated table is reported as extra", () => {
    const en = builtEN();
    const bg = builtBG();
    const extendedStrings = new Map(bg.strings);
    extendedStrings.set("bureaucracy.campaign.not_in_reference", "непозната");
    const extended: BuiltCampaign = { campaign: bg.campaign, strings: extendedStrings };

    const report = computeLocaleCoverage(en, extended, "bg");

    expect(report.extra).toEqual(["bureaucracy.campaign.not_in_reference"]);
  });
});

describe("computeLocaleCoverage — untranslated keys, W78.3", () => {
  it("a key present in both tables with byte-identical text is counted as untranslated, separate from missing", () => {
    const en = builtEN();
    // Start from a translated table with every key given genuinely different text, then
    // put exactly one key back to its English value — isolates the one case under test
    // from the real campaign's own translation completeness, which is a fact about the
    // fixture, not about this function.
    const fullyTranslatedStrings = new Map([...en.strings].map(([key, text]) => [key, `${text} [bg]`]));
    const sharedKey = [...en.strings.keys()][0]!;
    fullyTranslatedStrings.set(sharedKey, en.strings.get(sharedKey)!);
    const withOneUntranslated: BuiltCampaign = { campaign: en.campaign, strings: fullyTranslatedStrings };

    const report = computeLocaleCoverage(en, withOneUntranslated, "bg");

    expect(report.untranslated).toEqual([sharedKey]);
    expect(report.missing).toEqual([]);
  });

  it("a locale with every key given different text reports zero untranslated keys", () => {
    const en = builtEN();
    const fullyTranslatedStrings = new Map([...en.strings].map(([key, text]) => [key, `${text} [bg]`]));
    const fullyTranslated: BuiltCampaign = { campaign: en.campaign, strings: fullyTranslatedStrings };

    const report = computeLocaleCoverage(en, fullyTranslated, "bg");
    expect(report.untranslated).toEqual([]);
  });

  it("the real bulgaria-bureaucracy.bg build reports its actual untranslated keys, distinct from missing", () => {
    const report = computeLocaleCoverage(builtEN(), builtBG(), "bg");
    expect(report.missing).toEqual([]);
    expect(report.untranslated.length).toBeGreaterThan(0);
    for (const key of report.untranslated) {
      expect(builtBG().strings.get(key)).toBe(builtEN().strings.get(key));
    }
  });
});

describe("computeShelfCoverage — W78.4", () => {
  it("reports how many catalogued campaigns have a second locale, and which", () => {
    const entries = computeShelfCoverage();

    expect(entries).toHaveLength(Object.keys(CAMPAIGN_CATALOGUE).length);

    const withSecondLocale = entries.filter((entry) => entry.hasSecondLocale);
    expect(withSecondLocale).toHaveLength(1);
    expect(withSecondLocale[0]).toMatchObject({ campaignModule: "bulgaria-bureaucracy.ts", locale: "bg" });

    const withoutSecondLocale = entries.filter((entry) => !entry.hasSecondLocale);
    expect(withoutSecondLocale).toHaveLength(Object.keys(CAMPAIGN_CATALOGUE).length - 1);
  });

  it("every campaigns/*.bg.ts second-locale module is catalogued in SECOND_LOCALE_CATALOGUE", () => {
    const secondLocaleFiles = readdirSync(CAMPAIGNS_DIR).filter((name) => name.endsWith(".bg.ts") && !name.endsWith(".test.ts"));

    for (const file of secondLocaleFiles) {
      const baseModuleFile = file.replace(/\.bg\.ts$/, ".ts");
      const entry = SECOND_LOCALE_CATALOGUE[baseModuleFile];
      expect(entry, `${file} has no SECOND_LOCALE_CATALOGUE entry for ${baseModuleFile}`).toBeDefined();
      expect(entry!.moduleFile).toBe(file);
    }
  });
});
