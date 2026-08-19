/**
 * Localization coverage and string extraction — `design/30-slices.md` § W78.
 *
 * Contract: `04-core.md` §10.1 ("additional locales are string tables plus tooling, no
 * type change"), §11 (`missing_string_key`), §17 (identifier conventions).
 *
 * A translator can be handed the exact list of `LocKey`s a campaign needs
 * (`extractLocKeys`), and a maintainer can see, per second-locale build, which keys are
 * missing, which are extra, and which resolved but were never actually translated
 * (`computeLocaleCoverage`) — the one gap Tier 1 cannot see, since an untranslated key
 * still resolves. `computeShelfCoverage` answers the same question across the whole
 * catalogue: how many of the committed campaigns have a second locale, and which.
 *
 * `SECOND_LOCALE_CATALOGUE` is this file's own equivalent of `check-content.ts`'s
 * `CAMPAIGN_CATALOGUE` — every second-locale campaign build committed under
 * `src/campaigns/*.bg.ts` (or whatever locale suffix follows it), keyed by the base
 * module its coverage is measured against. `loc-coverage.test.ts` walks
 * `src/campaigns/` the same way `check-content.test.ts`'s coverage test does, so a new
 * `*.bg.ts` module landing without a catalogue entry fails a test rather than going
 * unnoticed.
 *
 * Lives outside `src/`, alongside `check-content.ts` and `validate-campaign.ts` —
 * authoring-time tooling, not shipped engine code (architecture §9.2).
 *
 * Run with `npm run loc-coverage -- <campaign-module>` from `src/engine/` for one
 * campaign's key list and (if it has one) its second-locale coverage report, or
 * `npm run loc-coverage -- --shelf` for the catalogue-wide summary (W78.4).
 */

import type { CommandResult } from "../src/core/kernel/reasons.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { LocKey } from "../src/core/localization/types.js";
import { runIfMainModule } from "./run-if-main.js";

import { buildBulgariaBureaucracyCampaignBG } from "../src/campaigns/bulgaria-bureaucracy.bg.js";
import { CAMPAIGN_CATALOGUE } from "./check-content.js";

interface SecondLocaleEntry {
  locale: string;
  moduleFile: string;
  build: () => CommandResult<BuiltCampaign>;
}

/**
 * Every second-locale campaign build committed under `src/campaigns/`, keyed by the base
 * module (`CAMPAIGN_CATALOGUE`'s own keys) its coverage is measured against. Currently one
 * entry — `bulgaria-bureaucracy.ts` is the only campaign of the nine catalogued with a
 * second locale.
 */
export const SECOND_LOCALE_CATALOGUE: Readonly<Record<string, SecondLocaleEntry>> = {
  "bulgaria-bureaucracy.ts": {
    locale: "bg",
    moduleFile: "bulgaria-bureaucracy.bg.ts",
    build: buildBulgariaBureaucracyCampaignBG,
  },
};

/** W78.1: the complete, sorted set of `LocKey`s a built campaign requires. */
export function extractLocKeys(built: BuiltCampaign): LocKey[] {
  return [...built.strings.keys()].sort();
}

/** One key per line — a translator can fill in text beside each. Deterministic. */
export function formatKeyList(keys: readonly LocKey[]): string {
  return keys.map((key) => `${key}\n`).join("");
}

export interface LocaleCoverageReport {
  locale: string;
  total: number;
  covered: number;
  missing: LocKey[];
  extra: LocKey[];
  untranslated: LocKey[];
}

/**
 * Compares a reference-locale build against a translated build of the same campaign.
 * `missing` is a reference key absent from the translated table (W78.2); `extra` is a
 * translated key absent from the reference table (W78.2); `untranslated` is a key present
 * in both with byte-identical text — the case Tier 1 cannot catch, since the key still
 * resolves (W78.3). `covered`/`total` count against the reference table's key set.
 */
export function computeLocaleCoverage(reference: BuiltCampaign, translated: BuiltCampaign, locale: string): LocaleCoverageReport {
  const referenceKeys = new Set(reference.strings.keys());
  const translatedKeys = new Set(translated.strings.keys());

  const missing = [...referenceKeys].filter((key) => !translatedKeys.has(key)).sort();
  const extra = [...translatedKeys].filter((key) => !referenceKeys.has(key)).sort();
  const untranslated = [...referenceKeys]
    .filter((key) => translatedKeys.has(key) && translated.strings.get(key) === reference.strings.get(key))
    .sort();

  return {
    locale,
    total: referenceKeys.size,
    covered: referenceKeys.size - missing.length,
    missing,
    extra,
    untranslated,
  };
}

export interface ShelfCoverageEntry {
  campaignModule: string;
  hasSecondLocale: boolean;
  locale?: string;
}

/** W78.4: across the whole catalogue, how many campaigns have a second locale, and which. */
export function computeShelfCoverage(
  catalogue: Readonly<Record<string, unknown>> = CAMPAIGN_CATALOGUE,
  secondLocales: Readonly<Record<string, SecondLocaleEntry>> = SECOND_LOCALE_CATALOGUE,
): ShelfCoverageEntry[] {
  return Object.keys(catalogue).map((campaignModule) => {
    const entry = secondLocales[campaignModule];
    return entry !== undefined
      ? { campaignModule, hasSecondLocale: true, locale: entry.locale }
      : { campaignModule, hasSecondLocale: false };
  });
}

function moduleKeyFor(argument: string): string {
  return `${argument}.ts`;
}

function buildOrThrow(build: () => CommandResult<BuiltCampaign>, label: string): BuiltCampaign {
  const result = build();
  if (!result.ok || !result.value) {
    throw new Error(`loc-coverage: ${label} failed to build — ${JSON.stringify(result.errors)}`);
  }
  return result.value;
}

function printShelfReport(): void {
  const entries = computeShelfCoverage();
  const withSecondLocale = entries.filter((entry) => entry.hasSecondLocale);
  console.log(`${withSecondLocale.length}/${entries.length} campaigns have a second locale.\n`);
  for (const entry of entries) {
    console.log(entry.hasSecondLocale ? `  ${entry.campaignModule} — ${entry.locale}` : `  ${entry.campaignModule} — none`);
  }
}

function printCampaignReport(moduleName: string): void {
  const entry = CAMPAIGN_CATALOGUE[moduleKeyFor(moduleName)];
  if (!entry) {
    const known = Object.keys(CAMPAIGN_CATALOGUE).map((file) => file.replace(/\.ts$/, "")).join(", ");
    console.error(`Usage: loc-coverage <campaign-module>\nKnown campaign modules: ${known}`);
    process.exitCode = 1;
    return;
  }

  const built = buildOrThrow(entry.build, moduleName);
  const keys = extractLocKeys(built);
  console.log(`"${entry.campaignId}" — ${keys.length} string key(s):\n`);
  console.log(formatKeyList(keys));

  const secondLocale = SECOND_LOCALE_CATALOGUE[moduleKeyFor(moduleName)];
  if (secondLocale === undefined) {
    console.log("No second locale.");
    return;
  }

  const translated = buildOrThrow(secondLocale.build, secondLocale.moduleFile);
  const report = computeLocaleCoverage(built, translated, secondLocale.locale);
  console.log(`\nLocale "${report.locale}": ${report.covered}/${report.total} covered.`);
  console.log(`  missing:      ${report.missing.length ? report.missing.join(", ") : "none"}`);
  console.log(`  extra:        ${report.extra.length ? report.extra.join(", ") : "none"}`);
  console.log(`  untranslated: ${report.untranslated.length ? report.untranslated.join(", ") : "none"}`);
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (argument === "--shelf") {
    printShelfReport();
    return;
  }
  if (argument === undefined) {
    console.error("Usage: loc-coverage <campaign-module> | loc-coverage --shelf");
    process.exitCode = 1;
    return;
  }
  printCampaignReport(argument);
}

runIfMainModule(import.meta.url, main);
