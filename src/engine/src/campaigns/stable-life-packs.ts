/**
 * The Stable Life content-pack pair — W71's proof of mechanism, W72's full Bulgarian setting.
 *
 * `stableLifeBasePack` wraps the existing synthetic Stable Life campaign as a distributable
 * base. `bulgariaCulturePack` deliberately replaces that campaign wholesale under the same
 * id, authored independently in `bulgaria-stable-life.ts` — its own jobs, places, events,
 * housing, possessions and effects, not a voice-only reskin of the base's.
 */

import type { ContentPack } from "../core/registry/packs.js";
import type { BuiltCampaign, ContentRegistry } from "../core/registry/types.js";
import type { LocKey } from "../core/localization/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildValidatedPackRegistry } from "../core/validation/tiered.js";
import { canonicalStringify, sha256Hex } from "../core/persistence/canonical.js";
import { buildStableLifeCampaign } from "./stable-life.js";
import { buildBulgariaStableLifeCampaign } from "./bulgaria-stable-life.js";

function built(build: () => ReturnType<typeof buildStableLifeCampaign>): BuiltCampaign {
  const result = build();
  if (!result.ok || !result.value) throw new Error("expected the campaign to build");
  return result.value;
}

const baseCampaign = built(buildStableLifeCampaign);
const bulgarianCampaign = built(buildBulgariaStableLifeCampaign);

/**
 * A pack's `version` is the only thing besides its `id` that `computeResolutionId`
 * (`src/engine/src/core/registry/packs.ts`) digests, so 11 §6's identity promise holds only
 * while the version moves whenever the pack's shipped content does. A hand-written
 * `"1.0.0"` cannot promise that here: neither pack authors its campaign in this file — the
 * base pack builds from `stable-life.ts`, which has already grown three times (W52, W53,
 * W54) for reasons that had nothing to do with packs, and the Bulgarian pack builds from
 * `bulgaria-stable-life.ts`, authored independently. Nothing would have signalled to either
 * file's author that a version in *this* file had to move with theirs.
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

/**
 * The full string table `bulgaria-stable-life.ts` authored — every key its own campaign's
 * content and voice need, not a small hand-picked override subset. `resolvePacks` still
 * folds it per key (11 §3): any key this table does not carry stays whatever the base pack
 * supplied.
 */
export const bulgariaCulturePack: ContentPack = {
  id: "stable-life-bulgaria",
  version: packVersion(bulgarianCampaigns, bulgarianCampaign.strings),
  kindId: "simulation",
  // Reads `stableLifeBasePack.version` rather than restating it, so the derived version
  // above stays the single place either pack's identity is decided — a literal here would
  // fail resolution with `pack_dependency_missing` the moment the base's content changed.
  dependsOn: [{ id: stableLifeBasePack.id, version: stableLifeBasePack.version }],
  campaigns: bulgarianCampaigns,
  strings: bulgarianCampaign.strings,
};

/**
 * The sanctioned way to turn an ordered Stable Life pack set into a playable registry.
 * A thin, kind-fixed sibling of `buildValidatedPackRegistry` (`core/validation/tiered.ts`,
 * W76) — that function is the shared fold-validate-reattach sequence; this one exists so
 * `stable-life-packs.test.ts`, `scripts/demo-cli.ts`, and
 * `bulgaria-stable-life.replay.test.ts` keep one name for "resolve *this* pack pair"
 * rather than each re-passing `kinds` by hand.
 *
 * Callers should inspect `.warnings` rather than discard them: folding a pack whose
 * strings/campaigns are mostly new — like `bulgariaCulturePack`, a full independent
 * setting rather than a small override subset — legitimately produces many
 * `pack_override_unexpected` warnings (`registry/packs.ts`'s heuristic for "probably a
 * typo" fires on any key a later pack introduces that no earlier pack shipped). This
 * helper does not judge which of them are expected; it only refuses to make that decision
 * for the caller by throwing them away.
 */
export function resolveStableLifeRegistry(
  packs: readonly ContentPack[],
  kinds: KindRegistry,
): CommandResult<ContentRegistry> {
  return buildValidatedPackRegistry(packs, kinds);
}
