/**
 * Content pack resolution and identity.
 *
 * Contract: `11-content-packs.md` §2–§7.
 *
 * `resolvePacks` is the pure, ordered fold §3 specifies: campaigns replace wholesale by
 * id, strings replace per key, and the caller's own array order is what "later" means —
 * significant, and never re-derived from `dependsOn` (§5's topological sort exists to
 * validate the graph before the fold, not to reorder it). It does not run `Kind.
 * validateCampaign` — a pack's `campaigns` are already `BuiltCampaign`s, and §3 leaves
 * per-campaign Tier 1/2 content validation to the same pipeline a single-campaign
 * registry already goes through (`validation/tiered.ts`), now over the folded result.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { canonicalStringify } from "../persistence/canonical.js";
import type { LocKey } from "../localization/types.js";
import type { KindId } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../validation/types.js";
import type { BuiltCampaign, Campaign, ContentRegistry, ResolutionId } from "./types.js";

export interface PackRef {
  readonly id: string;
  readonly version: string;
}

export interface ExperimentGate {
  readonly experimentId: string;
  readonly variant: string;
}

export interface ContentPack {
  readonly id: string;
  readonly version: string;
  readonly kindId: KindId;
  readonly dependsOn: readonly PackRef[];
  /** Absent means always included. Filtering on this is `applyExperimentGates` (W59) —
   *  `resolvePacks` never reads it. */
  readonly experimentGate?: ExperimentGate;
  readonly campaigns: readonly BuiltCampaign[];
  readonly strings: ReadonlyMap<LocKey, string>;
}

const PROTECTED_PREFIX = "core.reason.";

/**
 * A canonical digest over the ordered `{id, version}` list, per §6 — the same list twice
 * digests the same; a different order digests differently, since `canonicalStringify`
 * sorts object keys but never reorders an array.
 */
export function computeResolutionId(packs: readonly ContentPack[]): ResolutionId {
  const refs: PackRef[] = packs.map((p) => ({ id: p.id, version: p.version }));
  return bytesToHex(sha256(new TextEncoder().encode(canonicalStringify(refs))));
}

/** §7 Tier 1: "a pack's `kindId` matches every campaign it carries." */
function validatePackKinds(packs: readonly ContentPack[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const pack of packs) {
    for (const { campaign } of pack.campaigns) {
      if (campaign.kindId !== pack.kindId) {
        errors.push({
          code: "pack_kind_mismatch",
          messageKey: "core.reason.pack_kind_mismatch",
          path: campaign.id,
          details: { packId: pack.id, packKindId: pack.kindId, campaignKindId: campaign.kindId },
        });
      }
    }
  }
  return errors;
}

/** §7 Tier 1: "no campaign id collides *within* one pack — across packs is an override, within one is an authoring error." */
function validateNoDuplicateCampaignIdsWithinPack(packs: readonly ContentPack[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const pack of packs) {
    const seen = new Set<string>();
    for (const { campaign } of pack.campaigns) {
      if (seen.has(campaign.id)) {
        errors.push({
          code: "duplicate_campaign_id_in_pack",
          messageKey: "core.reason.duplicate_campaign_id_in_pack",
          path: campaign.id,
          details: { packId: pack.id },
        });
      }
      seen.add(campaign.id);
    }
  }
  return errors;
}

/** Same hard rule as `buildContentRegistry` (`build.ts`) — no pack may write `core.reason.*`. */
function validateNoProtectedStringWrites(packs: readonly ContentPack[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const pack of packs) {
    for (const key of pack.strings.keys()) {
      if (key.startsWith(PROTECTED_PREFIX)) {
        errors.push({
          code: "protected_string_key",
          messageKey: "core.reason.protected_string_key",
          path: key,
          details: { packId: pack.id },
        });
      }
    }
  }
  return errors;
}

/**
 * §5 and §7 Tier 1, all three: `dependsOn` names a pack present in the set (exact
 * `{id, version}`, since `PackRef` allows no ranges); two packs requiring different
 * versions of the same id is a conflict, not something to resolve by picking one; and no
 * cycle, checked over the id-level dependency graph.
 */
function validateDependencies(packs: readonly ContentPack[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const requiredVersionsById = new Map<string, Set<string>>();
  for (const pack of packs) {
    for (const dep of pack.dependsOn) {
      const versions = requiredVersionsById.get(dep.id) ?? new Set<string>();
      versions.add(dep.version);
      requiredVersionsById.set(dep.id, versions);
    }
  }
  for (const [id, versions] of requiredVersionsById) {
    if (versions.size > 1) {
      errors.push({
        code: "pack_dependency_version_conflict",
        messageKey: "core.reason.pack_dependency_version_conflict",
        path: id,
        details: { requiredVersions: [...versions].sort().join(", ") },
      });
    }
  }

  for (const pack of packs) {
    for (const dep of pack.dependsOn) {
      const present = packs.some((candidate) => candidate.id === dep.id && candidate.version === dep.version);
      if (!present) {
        errors.push({
          code: "pack_dependency_missing",
          messageKey: "core.reason.pack_dependency_missing",
          path: dep.id,
          details: { packId: pack.id, requiredVersion: dep.version },
        });
      }
    }
  }

  const graph = new Map<string, readonly string[]>(packs.map((p) => [p.id, p.dependsOn.map((d) => d.id)]));
  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const state = new Map<string, 0 | 1 | 2>();
  const reportedCycles = new Set<string>();

  function visit(id: string, stack: readonly string[]): void {
    state.set(id, IN_PROGRESS);
    const nextStack = [...stack, id];
    for (const next of graph.get(id) ?? []) {
      const nextState = state.get(next) ?? UNVISITED;
      if (nextState === IN_PROGRESS) {
        const cycleStart = nextStack.indexOf(next);
        const cyclePath = [...nextStack.slice(cycleStart), next];
        const key = [...cyclePath].sort().join(">");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          errors.push({
            code: "pack_dependency_cycle",
            messageKey: "core.reason.pack_dependency_cycle",
            path: cyclePath.join(" -> "),
          });
        }
      } else if (nextState === UNVISITED && graph.has(next)) {
        visit(next, nextStack);
      }
    }
    state.set(id, DONE);
  }

  for (const pack of packs) {
    if ((state.get(pack.id) ?? UNVISITED) === UNVISITED) visit(pack.id, []);
  }

  return errors;
}

/**
 * Folds an ordered pack set into a `ContentRegistry` (§3), pure and total: either every
 * structural check in §7 passes and a complete registry comes back, or none of them do
 * and every conflict is reported together — never a partial registry.
 */
export function resolvePacks(packs: readonly ContentPack[]): CommandResult<ContentRegistry> {
  const errors: ValidationError[] = [
    ...validatePackKinds(packs),
    ...validateNoDuplicateCampaignIdsWithinPack(packs),
    ...validateNoProtectedStringWrites(packs),
    ...validateDependencies(packs),
  ];
  if (errors.length > 0) {
    return { ok: false, errors, warnings: [] };
  }

  const warnings: ValidationWarning[] = [];
  const campaigns = new Map<string, Campaign>();
  const strings = new Map<LocKey, string>();
  const seenCampaignIds = new Set<string>();
  const seenStringKeys = new Set<string>();

  packs.forEach((pack, index) => {
    // §7 Tier 2: a pack "overriding" a campaign or string no earlier pack supplied is
    // legal but almost always a typo. The first pack can never trigger it — nothing
    // precedes it to have supplied anything, so there is no override to be surprised by.
    const canOverride = index > 0;

    for (const { campaign } of pack.campaigns) {
      if (canOverride && !seenCampaignIds.has(campaign.id)) {
        warnings.push({
          code: "pack_override_unexpected",
          messageKey: "core.reason.pack_override_unexpected",
          path: campaign.id,
        });
      }
      campaigns.set(campaign.id, campaign);
    }

    for (const [key, text] of pack.strings) {
      if (canOverride && !seenStringKeys.has(key)) {
        warnings.push({
          code: "pack_override_unexpected",
          messageKey: "core.reason.pack_override_unexpected",
          path: key,
        });
      }
      strings.set(key, text);
    }

    for (const { campaign } of pack.campaigns) seenCampaignIds.add(campaign.id);
    for (const key of pack.strings.keys()) seenStringKeys.add(key);
  });

  const resolution = computeResolutionId(packs);
  const stampedCampaigns = new Map<string, Campaign>(
    [...campaigns].map(([id, campaign]) => [id, { ...campaign, version: resolution }]),
  );

  return { ok: true, value: { campaigns: stampedCampaigns, strings, resolution }, errors: [], warnings };
}
