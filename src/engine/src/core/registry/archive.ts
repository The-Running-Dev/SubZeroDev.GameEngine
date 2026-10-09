/**
 * The in-memory content archive — the reference archive and channel (16-content-epochs.md
 * §3.4, §4.3, §5.1).
 *
 * Contract: `20-contract.md` §4 (`createContentArchive`, `ContentArchive`, `EpochRef`), the
 * session-layer channel (`ContentChannel`, `ContentScope`), and C23.
 *
 * One key `(campaignId, campaignVersion)` names one content forever. `publish` validates every
 * campaign, refuses a held key whose content differs (`content_version_conflict`), and stores
 * deep-frozen copies, so nothing the archive serves can change after it validated it. It is
 * append-only and never evicts; a host that needs durability or eviction supplies its own.
 */

import { canonicalize as canonicalStringify, sha256Hex } from "subzerodev-data-json";
import type { KindRegistry, ResolutionArchive } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { LocKey } from "../localization/types.js";
import type { ValidationError, ValidationWarning } from "../validation/types.js";
import type { Campaign, ContentRegistry } from "./types.js";

/** One epoch: a campaign at one version. */
export interface EpochRef {
  campaignId: string;
  campaignVersion: string;
}

/** Who a channel is answering for (16 §4.2). */
export interface ContentScope {
  campaignId: string;
  sessionId: string;
  /** Absent for an anonymous session. */
  profileId?: string;
}

/** The session-layer port that offers a session a version (16 §4.2). */
export interface ContentChannel {
  /** The campaignVersion a session in this scope should be on, or undefined for no offer.
   *  Called under the session lock. A throw is read as no offer. */
  current(scope: ContentScope): string | undefined;
}

/** The reference archive (16 §4.3): both archive and channel, in memory, append-only. */
export interface ContentArchive extends ResolutionArchive, ContentChannel {
  /** Validate every campaign against `registry.strings`, refuse a held key with a different
   *  digest (`content_version_conflict`), then store deep-frozen copies and make this the
   *  latest. Returns the epochs newly added; an identical republish adds none. */
  publish(registry: ContentRegistry): CommandResult<readonly EpochRef[]>;
  /** The last publication that succeeded. Its channel answers this registry's version of
   *  the scope's campaign, for every scope. */
  latest(): ContentRegistry;
}

/**
 * 16 §3.4's content identity: 11 §6's canonical campaign digest — `id`, `kindId`, `version`,
 * `titleKey`, `content`, and `includes` only when present and non-empty, exactly as
 * `packVersion` reads them — plus the registry's full `strings` table, sorted by key. Never
 * `migrateState`, which is code, not content, and which `canonicalStringify` rejects.
 */
function epochDigest(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): string {
  return sha256Hex(
    canonicalStringify({
      campaign: {
        id: campaign.id,
        kindId: campaign.kindId,
        version: campaign.version,
        titleKey: campaign.titleKey,
        content: campaign.content,
        ...(campaign.includes && campaign.includes.length > 0 ? { includes: campaign.includes } : {}),
      },
      strings: [...strings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    }),
  );
}

function refuseMutation(): never {
  throw new TypeError("content archive: a published registry is frozen");
}

/** A frozen `Map` refuses `set`, `delete` and `clear`, which `Object.freeze` alone does not. */
function lockMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  Object.defineProperties(map, {
    set: { value: refuseMutation },
    delete: { value: refuseMutation },
    clear: { value: refuseMutation },
  });
  return Object.freeze(map);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value instanceof Map) {
    for (const [key, entry] of value) {
      deepFreeze(key);
      deepFreeze(entry);
    }
    lockMap(value);
    return value;
  }
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return Object.freeze(value);
}

/** Data is copied and frozen; `migrateState` is kept by reference (16 §4.3). */
function frozenCampaign(campaign: Campaign): Campaign {
  const { migrateState, ...data } = campaign;
  const copy: Campaign = structuredClone(data);
  if (migrateState) copy.migrateState = migrateState;
  return deepFreeze(copy);
}

function frozenRegistry(registry: ContentRegistry): ContentRegistry {
  const campaigns = new Map<string, Campaign>();
  for (const [id, campaign] of registry.campaigns) campaigns.set(id, frozenCampaign(campaign));
  return Object.freeze({
    campaigns: lockMap(campaigns),
    strings: lockMap(new Map(registry.strings)),
    ...(registry.resolution === undefined ? {} : { resolution: registry.resolution }),
  });
}

function validate(registry: ContentRegistry, kinds: KindRegistry): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  for (const campaign of registry.campaigns.values()) {
    const kind = kinds[campaign.kindId];
    if (!kind) {
      errors.push({ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: campaign.kindId });
      continue;
    }
    const result = kind.validateCampaign(campaign, registry.strings);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  return { errors, warnings };
}

interface HeldEpoch {
  digest: string;
  registry: ContentRegistry;
}

/**
 * The reference archive (20-contract.md §4). `initial` is its first publication — normally the
 * engine's own registry — and an `initial` that fails validation throws, a construction error
 * like every other one that section names.
 */
export function createContentArchive(options: { kinds: KindRegistry; initial: ContentRegistry }): ContentArchive {
  const { kinds } = options;
  // campaignId → campaignVersion → what that key names, forever.
  const held = new Map<string, Map<string, HeldEpoch>>();
  let latest: ContentRegistry | undefined;

  function publish(registry: ContentRegistry): CommandResult<readonly EpochRef[]> {
    const { errors, warnings } = validate(registry, kinds);
    if (errors.length > 0) return { ok: false, errors, warnings };

    // Digested before copying, and the copy is taken before anything is stored, so a refusal
    // leaves the archive exactly as it was.
    const added: { ref: EpochRef; digest: string }[] = [];
    const conflicts: ValidationError[] = [];
    for (const campaign of registry.campaigns.values()) {
      const digest = epochDigest(campaign, registry.strings);
      const existing = held.get(campaign.id)?.get(campaign.version);
      if (!existing) {
        added.push({ ref: { campaignId: campaign.id, campaignVersion: campaign.version }, digest });
      } else if (existing.digest !== digest) {
        conflicts.push({
          code: "content_version_conflict",
          messageKey: "core.reason.content_version_conflict",
          path: campaign.id,
          details: { campaignVersion: campaign.version },
        });
      }
    }
    if (conflicts.length > 0) return { ok: false, errors: conflicts, warnings };

    const frozen = frozenRegistry(registry);
    for (const { ref, digest } of added) {
      const versions = held.get(ref.campaignId) ?? new Map<string, HeldEpoch>();
      versions.set(ref.campaignVersion, { digest, registry: frozen });
      held.set(ref.campaignId, versions);
    }
    latest = frozen;
    return { ok: true, value: added.map(({ ref }) => ref), errors: [], warnings };
  }

  const first = publish(options.initial);
  if (!first.ok) {
    const codes = first.errors.map((e) => (e.path === undefined ? e.code : `${e.code} (${e.path})`)).join(", ");
    throw new Error(`createContentArchive: the initial registry fails validation: ${codes} (20-contract.md §4)`);
  }

  return {
    publish,
    latest: () => latest!,
    resolve: (campaignId, campaignVersion) => held.get(campaignId)?.get(campaignVersion)?.registry,
    current: (scope) => latest!.campaigns.get(scope.campaignId)?.version,
  };
}
