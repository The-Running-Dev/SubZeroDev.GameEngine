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

import { canonicalStringify, sha256Hex } from "../persistence/canonical.js";
import type { LocKey } from "../localization/types.js";
import type { KindId } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { ExperimentSource } from "../composition/types.js";
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
  /** Absent means always included. Filtering on this is `applyExperimentGates`, below —
   *  `resolvePacks` never reads it. */
  readonly experimentGate?: ExperimentGate;
  readonly campaigns: readonly BuiltCampaign[];
  readonly strings: ReadonlyMap<LocKey, string>;
}

/**
 * §5a: filters the candidate pack array to the ones a resolved assignment set selects.
 * Runs *before* `resolvePacks`, not inside it — `resolvePacks` never learns gates exist,
 * because the array it receives has already had the excluded packs removed.
 *
 * A pack with no `experimentGate` is always included. A gated pack is included only when
 * `assignments[gate.experimentId] === gate.variant` — never true for `null` ("not
 * enrolled") or a missing key, which is what makes "no assignment resolved" safe by
 * construction.
 *
 * The `Object.hasOwn` guard is what keeps "a missing key" meaning *missing*: an
 * `experimentId` colliding with an `Object.prototype` member (`__proto__` is the sharp
 * one — assigning it on an object literal hits the inherited accessor and creates no own
 * property at all) would otherwise compare against an inherited value rather than an
 * absent one. Every such comparison happens to be false today, so the failure is
 * fail-closed, but a gate that silently ignores a real assignment is still a wrong
 * answer — and this function is the one §5a asks to be correct by construction rather
 * than by which strings an author picked.
 */
export function applyExperimentGates(
  packs: readonly ContentPack[],
  assignments: Readonly<Record<string, string | null>>,
): readonly ContentPack[] {
  return packs.filter((pack) => {
    const gate = pack.experimentGate;
    if (!gate) return true;
    return Object.hasOwn(assignments, gate.experimentId) && assignments[gate.experimentId] === gate.variant;
  });
}

/**
 * `bucketKey` per 06 §5.5: `profileId` when the session is profiled, else the session's
 * `seed`. Computed once, here, so every `ExperimentSource` implementation is handed the
 * same already-resolved key rather than each reimplementing the fallback itself.
 */
export function resolveBucketKey(profileId: string | undefined, seed: string): string {
  return profileId ?? seed;
}

/**
 * Resolves an assignment for every distinct `experimentId` an `experimentGate` among the
 * candidate packs references — one `ExperimentSource.resolve` call per distinct id, not
 * per pack, keyed by the same `bucketKey` for all of them. Returns `{}`, calling nothing,
 * when no `ExperimentSource` is supplied — the "no experiments running" default `06 §5.5`
 * names, and the same shape `applyExperimentGates` treats as excluding every gated pack.
 *
 * The map has a null prototype, which is the other half of `applyExperimentGates`'
 * `Object.hasOwn` guard: on an object literal, `assignments["__proto__"] = variant` hits
 * the inherited accessor and stores nothing, so a real assignment for that
 * `experimentId` would vanish between resolving it here and reading it there. With no
 * prototype there is no accessor to intercept it, and every `experimentId` behaves like
 * the plain string key `ExperimentGate` says it is.
 *
 * Known and retained: the null prototype is visible to callers — the returned map has no
 * `Object.prototype` methods, so `assignments.hasOwnProperty(id)` or coercing it to a
 * string throws where an ordinary `Record` would not. Read it with `Object.hasOwn`, `in`,
 * or indexing, the way `applyExperimentGates` does. A spread copy at the return would
 * restore the prototype without reintroducing the bug (spread creates own data
 * properties, bypassing the inherited `__proto__` setter), and is the fix if a consumer
 * ever needs an ordinary object more than the honest shape.
 */
export function resolveExperimentAssignments(
  packs: readonly ContentPack[],
  experiments: ExperimentSource | undefined,
  bucketKey: string,
): Readonly<Record<string, string | null>> {
  const assignments: Record<string, string | null> = Object.create(null) as Record<string, string | null>;
  if (!experiments) return assignments;
  const experimentIds = new Set<string>();
  for (const pack of packs) {
    if (pack.experimentGate) experimentIds.add(pack.experimentGate.experimentId);
  }
  for (const experimentId of experimentIds) {
    assignments[experimentId] = experiments.resolve(experimentId, bucketKey);
  }
  return assignments;
}

const PROTECTED_PREFIX = "core.reason.";

/**
 * A canonical digest over the ordered `{id, version}` list, per §6 — the same list twice
 * digests the same; a different order digests differently, since `canonicalStringify`
 * sorts object keys but never reorders an array.
 */
export function computeResolutionId(packs: readonly ContentPack[]): ResolutionId {
  const refs: PackRef[] = packs.map((p) => ({ id: p.id, version: p.version }));
  return sha256Hex(canonicalStringify(refs));
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
