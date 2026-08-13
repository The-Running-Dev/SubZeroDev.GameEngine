/**
 * W71's first real content-pack pair.
 *
 * `stableLifeBasePack` wraps the existing synthetic Stable Life campaign as a distributable
 * base. `bulgariaCulturePack` deliberately replaces that campaign wholesale under the same
 * id, then changes only the voice-facing strings needed to prove the pack fold. W72 owns
 * the volume work: Bulgarian jobs, places, events, housing, possessions, and prices.
 */

import type { LocKey } from "../core/localization/types.js";
import type { ContentPack } from "../core/registry/packs.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import { canonicalStringify, sha256Hex } from "../core/persistence/canonical.js";
import { buildStableLifeCampaign } from "./stable-life.js";

function builtStableLife(): BuiltCampaign {
  const result = buildStableLifeCampaign();
  if (!result.ok || !result.value) throw new Error("expected the Stable Life campaign to build");
  return result.value;
}

/**
 * Two separate builds, deliberately — **not** one constant shared by both packs.
 * `resolvePacks` replaces a campaign wholesale by id (11 §3), and until W72 authors the
 * Bulgarian setting the two campaigns are deep-equal, so the only available evidence that
 * the *later* pack's campaign is the one that survived the fold is that it is a distinct
 * object. Collapsing these into one shared build would leave that half of §3 asserted but
 * untested — `stable-life-packs.test.ts` checks it by reference for exactly this reason.
 */
const baseCampaign = builtStableLife();
const bulgarianCampaign = builtStableLife();

/**
 * A pack's `version` is the only thing besides its `id` that `computeResolutionId`
 * (`src/engine/src/core/registry/packs.ts`) digests, so 11 §6's identity promise holds only
 * while the version moves whenever the pack's shipped content does. A hand-written
 * `"1.0.0"` cannot promise that here: neither pack authors its campaign in this file —
 * both build it from `stable-life.ts`, which has already grown three times (W52, W53, W54)
 * for reasons that had nothing to do with packs, and W72 will grow it again. Nothing would
 * have signalled to those authors that a version in *this* file had to move with theirs.
 *
 * Deriving the suffix from a canonical digest of what the pack actually ships makes that
 * self-enforcing rather than a rule someone has to remember: a replay fixture captured
 * under an older content set then resolves as `campaign_version_missing` (07 §6) instead
 * of silently replaying a different game and reporting a spurious `diverged`. The `1.0.0`
 * prefix stays for humans — semver build metadata, and `PackRef` compares versions
 * exactly, never as a range.
 *
 * The campaign fields are listed rather than digested whole: `Campaign.migrateState` (04
 * §10.1) is an optional *function*, and `canonicalStringify` rejects one outright, so a
 * campaign that ever gains a migration must not take this module down at import time.
 */
function packVersion(campaigns: readonly BuiltCampaign[], strings: ReadonlyMap<LocKey, string>): string {
  const digest = sha256Hex(
    canonicalStringify({
      campaigns: campaigns.map(({ campaign }) => ({
        id: campaign.id,
        kindId: campaign.kindId,
        version: campaign.version,
        titleKey: campaign.titleKey,
        content: campaign.content,
      })),
      // Sorted by key, not left in insertion order: the digest names what a pack ships, and
      // reordering an authoring file ships the same content.
      strings: [...strings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    }),
  );
  return `1.0.0+${digest.slice(0, 12)}`;
}

const baseCampaigns = [baseCampaign];

export const stableLifeBasePack: ContentPack = {
  id: "stable-life-base",
  version: packVersion(baseCampaigns, baseCampaign.strings),
  kindId: "simulation",
  dependsOn: [],
  campaigns: baseCampaigns,
  strings: baseCampaign.strings,
};

const bulgarianCampaigns = [bulgarianCampaign];

const bulgarianStrings = new Map<LocKey, string>([
  ["stable-life.campaign.title", "Стабилен живот"],
  ["stable-life.scene.status", "Седмица {week}, година {year}. Пари: {cash} лв. Енергия: {energy}."],
  ["stable-life.action.plan-add.label", "Добави към плана"],
  ["stable-life.action.plan-remove.label", "Премахни от плана"],
  ["stable-life.action.plan-clear.label", "Изчисти плана"],
  ["stable-life.action.end-week.label", "Приключи седмицата"],
]);

/**
 * A deliberate small voice layer, rather than partial setting data. This is enough to prove
 * replacement, string override, client rendering, resolution identity, and replay honesty;
 * W72 expands it into a complete Bulgarian setting.
 */
export const bulgariaCulturePack: ContentPack = {
  id: "stable-life-bulgaria",
  version: packVersion(bulgarianCampaigns, bulgarianStrings),
  kindId: "simulation",
  // Reads `stableLifeBasePack.version` rather than restating it, so the derived version
  // above stays the single place either pack's identity is decided — a literal here would
  // fail resolution with `pack_dependency_missing` the moment the base's content changed.
  dependsOn: [{ id: stableLifeBasePack.id, version: stableLifeBasePack.version }],
  campaigns: bulgarianCampaigns,
  strings: bulgarianStrings,
};
