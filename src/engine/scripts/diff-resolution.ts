/**
 * What changed between two content resolutions — `design/30-slices.md` § W79.
 *
 * Contract: `11-content-packs.md` §3 (resolution), §4 (`ContentRegistry.resolution`), §6
 * (identity). `resolvePacks` and `computeResolutionId` (`../src/core/registry/packs.ts`)
 * already prove two resolutions are not the same — that is what `ResolutionId` is for —
 * but the digest is deliberately opaque (§6), so it cannot say *how*. This tool answers
 * that by re-running the same two rules §3 already states over the resolved output: a
 * campaign either replaced wholesale by id, or a string key added, removed, or changed at
 * its value.
 *
 * `resolvePacks` and `computeResolutionId` are read here, never modified or reimplemented
 * (W79.5) — `diffPackSets` calls the former once per side and compares the results; it
 * never re-derives a merge rule of its own.
 *
 * Lives outside `src/`, alongside `loc-coverage.ts` and `check-content.ts` — authoring-time
 * tooling, not shipped engine code (architecture §9.2).
 *
 * Run with `npm run diff-resolution -- <set-a> <set-b>` from `src/engine/`, where each
 * argument names an entry in `PACK_SET_CATALOGUE` below (currently `base` and
 * `base+bulgaria`), or `npm run diff-resolution -- --list` to print the known set names.
 */

import type { LocKey } from "../src/core/localization/types.js";
import type { CommandResult } from "../src/core/kernel/reasons.js";
import type { ValidationError } from "../src/core/validation/types.js";
import type { ValidationWarning } from "../src/core/validation/types.js";
import type { Campaign, ContentRegistry } from "../src/core/registry/types.js";
import type { ContentPack } from "../src/core/registry/packs.js";
import { resolvePacks } from "../src/core/registry/packs.js";
import { canonicalStringify } from "../src/core/persistence/canonical.js";
import { runIfMainModule } from "./run-if-main.js";
import { joinOrNone } from "./format-list.js";

import { stableLifeBasePack, bulgariaCulturePack } from "../src/campaigns/stable-life-packs.js";

/**
 * Every named pack set this tool can compare, in the order the CLI reports them. The base
 * pack alone, and the base plus the Bulgarian culture pack — W71's proof that a culture
 * pack overrides text at existing keys is what W79.1/W79.2 assert against.
 */
export const PACK_SET_CATALOGUE: Readonly<Record<string, readonly ContentPack[]>> = {
  base: [stableLifeBasePack],
  "base+bulgaria": [stableLifeBasePack, bulgariaCulturePack],
};

export interface CampaignDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

export interface StringDiff {
  readonly added: readonly LocKey[];
  readonly removed: readonly LocKey[];
  readonly changed: readonly LocKey[];
}

export interface ResolutionDiff {
  readonly resolutionIdA: string;
  readonly resolutionIdB: string;
  readonly identical: boolean;
  readonly campaigns: CampaignDiff;
  readonly strings: StringDiff;
}

/**
 * `resolvePacks` stamps every campaign's `version` with the whole set's `ResolutionId`
 * (§6), so comparing `Campaign.version` between two resolutions always disagrees the
 * moment their `ResolutionId`s do — even for a campaign neither pack set actually
 * changed. What identifies a campaign's own content is everything else: `id`, `kindId`,
 * `titleKey` and `content`. `migrateState` is excluded the same way the pack-version
 * digest excludes it (`stable-life-packs.ts`) — it is an optional function, and
 * `canonicalStringify` rejects one outright.
 */
function campaignContentDigest(campaign: Campaign): string {
  return canonicalStringify({
    id: campaign.id,
    kindId: campaign.kindId,
    titleKey: campaign.titleKey,
    content: campaign.content,
  });
}

/** §3's two rules, read off a pair of already-resolved registries. */
function diffRegistries(a: ContentRegistry, b: ContentRegistry): { campaigns: CampaignDiff; strings: StringDiff } {
  const campaignIdsA = [...a.campaigns.keys()];
  const campaignIdsB = [...b.campaigns.keys()];
  const campaignIdSetA = new Set(campaignIdsA);
  const campaignIdSetB = new Set(campaignIdsB);

  const campaignsAdded = campaignIdsB.filter((id) => !campaignIdSetA.has(id)).sort();
  const campaignsRemoved = campaignIdsA.filter((id) => !campaignIdSetB.has(id)).sort();
  const campaignsChanged = campaignIdsA
    .filter((id) => campaignIdSetB.has(id))
    .filter((id) => campaignContentDigest(a.campaigns.get(id)!) !== campaignContentDigest(b.campaigns.get(id)!))
    .sort();

  const stringKeysA = [...a.strings.keys()];
  const stringKeysB = [...b.strings.keys()];
  const stringKeySetA = new Set(stringKeysA);
  const stringKeySetB = new Set(stringKeysB);

  const stringsAdded = stringKeysB.filter((key) => !stringKeySetA.has(key)).sort();
  const stringsRemoved = stringKeysA.filter((key) => !stringKeySetB.has(key)).sort();
  const stringsChanged = stringKeysA
    .filter((key) => stringKeySetB.has(key))
    .filter((key) => a.strings.get(key) !== b.strings.get(key))
    .sort();

  return {
    campaigns: { added: campaignsAdded, removed: campaignsRemoved, changed: campaignsChanged },
    strings: { added: stringsAdded, removed: stringsRemoved, changed: stringsChanged },
  };
}

/**
 * Resolves two ordered pack sets and reports what changed between them (W79.1–W79.4).
 * Fails, with both sides' `resolvePacks` errors, if either set does not resolve — there is
 * no partial diff, the same way `resolvePacks` itself is never partial (§3).
 */
export function diffPackSets(packsA: readonly ContentPack[], packsB: readonly ContentPack[]): CommandResult<ResolutionDiff> {
  const resultA = resolvePacks(packsA);
  const resultB = resolvePacks(packsB);

  const warnings: ValidationWarning[] = [...resultA.warnings, ...resultB.warnings];

  if (!resultA.ok || !resultA.value || !resultB.ok || !resultB.value) {
    const errors: ValidationError[] = [...resultA.errors, ...resultB.errors];
    return { ok: false, errors, warnings };
  }

  // Every registry `resolvePacks` returns carries its set's resolution id (§6) — reusing it
  // here avoids re-hashing the same pack list a second time.
  const resolutionIdA = resultA.value.resolution!;
  const resolutionIdB = resultB.value.resolution!;
  const { campaigns, strings } = diffRegistries(resultA.value, resultB.value);

  // Derived from the same arrays the caller already has, rather than a hand-maintained
  // conjunction, so a future diff category is covered without a matching edit here.
  const identical =
    resolutionIdA === resolutionIdB &&
    [...Object.values(campaigns), ...Object.values(strings)].every((items) => items.length === 0);

  return {
    ok: true,
    value: { resolutionIdA, resolutionIdB, identical, campaigns, strings },
    errors: [],
    warnings,
  };
}

function formatList(label: string, items: readonly string[]): string {
  return `  ${label}: ${joinOrNone(items)}`;
}

function printDiff(nameA: string, nameB: string, diff: ResolutionDiff): void {
  console.log(`"${nameA}" -> "${nameB}"`);
  console.log(`  resolution A: ${diff.resolutionIdA}`);
  console.log(`  resolution B: ${diff.resolutionIdB}`);
  if (diff.identical) {
    console.log("  identical — no difference in campaigns or strings.");
    return;
  }
  console.log("  campaigns:");
  console.log(formatList("added", diff.campaigns.added));
  console.log(formatList("removed", diff.campaigns.removed));
  console.log(formatList("changed", diff.campaigns.changed));
  console.log("  strings:");
  console.log(formatList("added", diff.strings.added));
  console.log(formatList("removed", diff.strings.removed));
  console.log(formatList("changed", diff.strings.changed));
}

async function main(): Promise<void> {
  const [nameA, nameB] = process.argv.slice(2);

  if (nameA === "--list") {
    console.log(Object.keys(PACK_SET_CATALOGUE).join(", "));
    return;
  }

  if (nameA === undefined || nameB === undefined) {
    console.error("Usage: diff-resolution <set-a> <set-b> | diff-resolution --list");
    process.exitCode = 1;
    return;
  }

  const packsA = PACK_SET_CATALOGUE[nameA];
  const packsB = PACK_SET_CATALOGUE[nameB];
  if (!packsA || !packsB) {
    console.error(`Unknown pack set. Known sets: ${Object.keys(PACK_SET_CATALOGUE).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const result = diffPackSets(packsA, packsB);
  if (!result.ok || !result.value) {
    console.error(`diff-resolution: failed to resolve — ${JSON.stringify(result.errors)}`);
    process.exitCode = 1;
    return;
  }
  printDiff(nameA, nameB, result.value);
}

runIfMainModule(import.meta.url, main);
