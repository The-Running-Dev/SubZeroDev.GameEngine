/**
 * The in-memory content archive — the reference archive and channel (16-content-epochs.md
 * §3.4, §4.3, §5.1).
 *
 * Contract: `20-contract.md` §4 (`createContentArchive`, `ContentArchive`, `EpochRef`,
 * `EpochForm`, `StoredEpoch`, `RestoreResult`, `epochDigest`, `canonicalDigest`), the
 * session-layer channel (`ContentChannel`, `ContentScope`), C23 and C28.
 *
 * One key `(campaignId, campaignVersion)` names one content forever, and that content is its
 * **authored form** — the composed campaign, its attachments and its authored strings, never
 * the merged string table. `publish` validates every campaign, refuses a held key whose form
 * differs (`content_version_conflict`), and stores deep-frozen copies, so nothing the archive
 * serves can change after it validated it. Engine-owned messages come from the running catalog
 * whenever a registry is assembled. It is append-only and never evicts; a host that needs
 * durability or eviction persists `stored()` and brings it back with `restore`.
 */

import { canonicalize as canonicalStringify, sha256Hex } from "subzerodev-data-json";
import type { KindId, KindRegistry, ResolutionArchive } from "../kernel/types.js";
import { CORE_REASON_MESSAGES, type CommandResult } from "../kernel/reasons.js";
import type { LocKey } from "../localization/types.js";
import type { ValidationError, ValidationWarning } from "../validation/types.js";
import type { Campaign, CampaignAttachment, CampaignProvenance, ContentRegistry } from "./types.js";

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

/** An epoch's identity (C28): exactly what is hashed, and exactly what a host persists. */
export interface EpochForm {
  /** The composed campaign: its `content` already composed, `includes` kept as provenance,
   *  and no `migrateState`. */
  campaign: Omit<Campaign, "migrateState">;
  /** The attachments applied to this campaign, in composition order (04 §10.4). */
  attachments: readonly CampaignAttachment[];
  /** Authored strings only — `ContentRegistry.provenance` for this campaign. No engine-owned
   *  message, and no string of a campaign it does not compose. */
  strings: Readonly<Record<LocKey, string>>;
}

/** Recorded beside the form at publication; not hashed. */
export interface EpochPublication {
  kindId: KindId;
  kindVersion: string;
  /** The explicit keys the running engine reserved when it accepted the form (04 §12),
   *  sorted. `restore` tolerates an authored key reserved now only if it is absent here. */
  reservedKeys: readonly LocKey[];
}

export interface StoredEpoch {
  form: EpochForm;
  publication: EpochPublication;
  /** `epochDigest(form)`. */
  digest: string;
}

export type RestoreResult =
  | { outcome: "restored"; ref: EpochRef; warnings: readonly ValidationWarning[] }
  | {
      outcome: "unsupported";
      ref: EpochRef;
      rejectedBy: { kindId: KindId; kindVersion: string };
      publishedBy: { kindId: KindId; kindVersion: string };
      errors: readonly ValidationError[];
      /** `epoch_unsupported`. */
      warning: ValidationWarning;
    }
  | { outcome: "integrity_failure"; ref: EpochRef; errors: readonly ValidationError[] };

/** The reference archive (16 §4.3): both archive and channel, in memory, append-only. */
export interface ContentArchive extends ResolutionArchive, ContentChannel {
  /** Refuse a registry without `provenance` (`content_provenance_missing`) and any authored
   *  key the running engine reserves or that contains `~` (`protected_string_key`). Validate
   *  every campaign against its authored strings united with the running engine's catalog,
   *  refuse a held key whose `epochDigest` differs (`content_version_conflict`), then store
   *  deep-frozen copies and make this the latest. Returns the epochs newly added; an identical
   *  republish adds none, still becomes the latest, and never repoints a held key. */
  publish(registry: ContentRegistry): CommandResult<readonly EpochRef[]>;
  /** Bring back an epoch a previous process published, from exactly what it persisted. Never
   *  recomposes, and moves neither `latest()` nor `current`. */
  restore(stored: StoredEpoch, options?: { migrateState?: Campaign["migrateState"] }): RestoreResult;
  /** The persistable form of a held epoch, or undefined for a key this archive does not hold. */
  stored(campaignId: string, campaignVersion: string): StoredEpoch | undefined;
  /** The last publication that succeeded. Not the channel: `current` is per campaign. */
  latest(): ContentRegistry;
  /** The version of `scope.campaignId` in the last successful publication that held that
   *  campaign, or undefined if none did. */
  current(scope: ContentScope): string | undefined;
  authoredKeys(): ReadonlySet<LocKey>;
}

/** `sha256Hex(canonicalize(value))` (04 §10) — the one digest helper a host uses for the
 *  identities the engine states. */
export function canonicalDigest(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

/** `canonicalDigest` over the form, so a host recomputes it without recomposing. */
export function epochDigest(form: EpochForm): string {
  return canonicalDigest(form);
}

const RESERVED_PREFIX = "core.reason.";

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

function lockSet<T>(set: Set<T>): ReadonlySet<T> {
  Object.defineProperties(set, {
    add: { value: refuseMutation },
    delete: { value: refuseMutation },
    clear: { value: refuseMutation },
  });
  return Object.freeze(set);
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

function frozenRegistry(
  campaigns: Iterable<Campaign>,
  strings: ReadonlyMap<LocKey, string>,
  provenance: ReadonlyMap<string, CampaignProvenance>,
  resolution: ContentRegistry["resolution"],
): ContentRegistry {
  const frozenCampaigns = new Map<string, Campaign>();
  for (const campaign of campaigns) frozenCampaigns.set(campaign.id, frozenCampaign(campaign));
  const frozenProvenance = new Map<string, CampaignProvenance>();
  for (const [id, entry] of provenance) {
    frozenProvenance.set(id, deepFreeze({ strings: new Map(entry.strings), attachments: structuredClone(entry.attachments) }));
  }
  return Object.freeze({
    campaigns: lockMap(frozenCampaigns),
    strings: lockMap(new Map(strings)),
    provenance: lockMap(frozenProvenance),
    ...(resolution === undefined ? {} : { resolution }),
  });
}

/** The campaign as hashed: 11 §6's fields, `includes` only when present and non-empty. */
function formCampaign(campaign: Campaign): Omit<Campaign, "migrateState"> {
  return {
    id: campaign.id,
    kindId: campaign.kindId,
    version: campaign.version,
    titleKey: campaign.titleKey,
    content: campaign.content,
    ...(campaign.includes && campaign.includes.length > 0 ? { includes: campaign.includes } : {}),
  };
}

function formOf(campaign: Campaign, provenance: CampaignProvenance): EpochForm {
  return {
    campaign: formCampaign(campaign),
    attachments: provenance.attachments,
    strings: Object.fromEntries([...provenance.strings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}

function refOf(form: EpochForm): EpochRef {
  return { campaignId: form.campaign.id, campaignVersion: form.campaign.version };
}

interface HeldEpoch {
  stored: StoredEpoch;
  registry: ContentRegistry;
}

/**
 * The reference archive (20-contract.md §4). `initial` is its first publication — normally the
 * engine's own registry — and an `initial` that fails validation throws, a construction error
 * like every other one that section names.
 */
export function createContentArchive(options: { kinds: KindRegistry; initial: ContentRegistry }): ContentArchive {
  const { kinds } = options;

  // The running catalog: every engine-owned message this process ships. Reserved keys are its
  // keys plus anything under `core.reason.` (04 §12).
  const catalog = new Map<LocKey, string>(CORE_REASON_MESSAGES);
  for (const kind of Object.values(kinds)) for (const [key, text] of kind.reasonMessages) catalog.set(key, text);
  const reservedKeys: readonly LocKey[] = Object.freeze([...catalog.keys()].sort());
  const isReserved = (key: LocKey) => key.startsWith(RESERVED_PREFIX) || catalog.has(key);

  // campaignId → campaignVersion → what that key names, forever.
  const held = new Map<string, Map<string, HeldEpoch>>();
  const currentVersion = new Map<string, string>();
  const authored = new Set<LocKey>();
  let authoredView: ReadonlySet<LocKey> = lockSet(new Set());
  let latest: ContentRegistry | undefined;

  function hold(stored: StoredEpoch, registry: ContentRegistry): void {
    const { campaignId, campaignVersion } = refOf(stored.form);
    const versions = held.get(campaignId) ?? new Map<string, HeldEpoch>();
    versions.set(campaignVersion, { stored, registry });
    held.set(campaignId, versions);
    for (const key of Object.keys(stored.form.strings)) authored.add(key);
  }

  function publish(registry: ContentRegistry): CommandResult<readonly EpochRef[]> {
    const provenance = registry.provenance;
    const missing = [...registry.campaigns.values()].filter((campaign) => !provenance?.has(campaign.id));
    if (!provenance || missing.length > 0) {
      const errors: ValidationError[] = missing.map((campaign) => ({
        code: "content_provenance_missing",
        messageKey: "core.reason.content_provenance_missing",
        path: campaign.id,
      }));
      return { ok: false, errors, warnings: [] };
    }

    const protectedKeys: ValidationError[] = [];
    for (const campaign of registry.campaigns.values()) {
      for (const key of provenance.get(campaign.id)!.strings.keys()) {
        const reason = isReserved(key) ? "engine_reserved" : key.includes("~") ? "response_alias_namespace" : undefined;
        if (reason) {
          protectedKeys.push({
            code: "protected_string_key",
            messageKey: "core.reason.protected_string_key",
            path: key,
            details: { campaignId: campaign.id, reason },
          });
        }
      }
    }
    if (protectedKeys.length > 0) return { ok: false, errors: protectedKeys, warnings: [] };

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    for (const campaign of registry.campaigns.values()) {
      const kind = kinds[campaign.kindId];
      if (!kind) {
        errors.push({ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: campaign.kindId });
        continue;
      }
      const strings = new Map([...catalog, ...provenance.get(campaign.id)!.strings]);
      const result = kind.validateCampaign(campaign, strings);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    if (errors.length > 0) return { ok: false, errors, warnings };

    // Digested before copying, and the copy is taken before anything is stored, so a refusal
    // leaves the archive exactly as it was.
    const added: StoredEpoch[] = [];
    const conflicts: ValidationError[] = [];
    for (const campaign of registry.campaigns.values()) {
      const form = formOf(campaign, provenance.get(campaign.id)!);
      const digest = epochDigest(form);
      const existing = held.get(campaign.id)?.get(campaign.version);
      if (!existing) {
        const kind = kinds[campaign.kindId]!;
        added.push(deepFreeze(structuredClone({ form, publication: { kindId: kind.id, kindVersion: kind.version, reservedKeys: [...reservedKeys] }, digest })));
      } else if (existing.stored.digest !== digest) {
        conflicts.push({
          code: "content_version_conflict",
          messageKey: "core.reason.content_version_conflict",
          path: campaign.id,
          details: { campaignVersion: campaign.version },
        });
      }
    }
    if (conflicts.length > 0) return { ok: false, errors: conflicts, warnings };

    // Engine messages from the running catalog; nothing authored collides with one, since the
    // reserved keys were refused above.
    const frozen = frozenRegistry(registry.campaigns.values(), new Map([...registry.strings, ...catalog]), provenance, registry.resolution);
    for (const stored of added) hold(stored, frozen);
    if (added.length > 0) authoredView = lockSet(new Set(authored));
    for (const campaign of registry.campaigns.values()) currentVersion.set(campaign.id, campaign.version);
    latest = frozen;
    return { ok: true, value: added.map((stored) => refOf(stored.form)), errors: [], warnings };
  }

  function restore(input: StoredEpoch, restoreOptions?: { migrateState?: Campaign["migrateState"] }): RestoreResult {
    const ref = refOf(input.form);
    const integrity = (errors: ValidationError[]): RestoreResult => ({ outcome: "integrity_failure", ref, errors });

    let digest: string;
    try {
      digest = epochDigest(input.form);
    } catch {
      digest = "";
    }
    if (digest !== input.digest) {
      return integrity([
        {
          code: "invalid_state",
          messageKey: "core.reason.invalid_state",
          path: ref.campaignId,
          details: { campaignVersion: ref.campaignVersion, reason: "digest_mismatch" },
        },
      ]);
    }

    const reservedThen = new Set(input.publication.reservedKeys);
    const authoredKeys = Object.keys(input.form.strings);
    const reservedAtPublication = authoredKeys.filter((key) => key.startsWith(RESERVED_PREFIX) || reservedThen.has(key));
    if (reservedAtPublication.length > 0) {
      return integrity(
        reservedAtPublication.map((key) => ({
          code: "protected_string_key",
          messageKey: "core.reason.protected_string_key",
          path: key,
          details: { campaignId: ref.campaignId, reason: "engine_reserved" },
        })),
      );
    }

    const existing = held.get(ref.campaignId)?.get(ref.campaignVersion);
    if (existing && existing.stored.digest !== input.digest) {
      return integrity([
        {
          code: "content_version_conflict",
          messageKey: "core.reason.content_version_conflict",
          path: ref.campaignId,
          details: { campaignVersion: ref.campaignVersion },
        },
      ]);
    }

    // Authored text stays at its key, so it wins a collision; the engine's text for that key
    // reaches clients through a response alias (20-contract §7).
    const strings = new Map<LocKey, string>([...catalog, ...Object.entries(input.form.strings)]);
    const campaign: Campaign = { ...structuredClone(input.form.campaign) };
    if (restoreOptions?.migrateState) campaign.migrateState = restoreOptions.migrateState;

    const publishedBy = { kindId: input.publication.kindId, kindVersion: input.publication.kindVersion };
    const kind = kinds[campaign.kindId];
    const result = kind
      ? kind.validateCampaign(campaign, strings)
      : { errors: [{ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: campaign.kindId } satisfies ValidationError], warnings: [] };
    if (result.errors.length > 0) {
      const rejectedBy = { kindId: campaign.kindId, kindVersion: kind?.version ?? "" };
      return {
        outcome: "unsupported",
        ref,
        rejectedBy,
        publishedBy,
        errors: result.errors,
        warning: {
          code: "epoch_unsupported",
          messageKey: "core.reason.epoch_unsupported",
          path: ref.campaignId,
          details: {
            campaignId: ref.campaignId,
            campaignVersion: ref.campaignVersion,
            potentialRegression: kind !== undefined && rejectedBy.kindId === publishedBy.kindId && rejectedBy.kindVersion === publishedBy.kindVersion,
          },
        },
      };
    }

    const collisions: ValidationWarning[] = authoredKeys
      .filter((key) => isReserved(key) && !reservedThen.has(key))
      .sort()
      .map((key) => ({
        code: "historical_string_collision",
        messageKey: "core.reason.historical_string_collision",
        path: key,
        details: { campaignId: ref.campaignId, campaignVersion: ref.campaignVersion, key },
      }));

    if (!existing) {
      const provenance = new Map<string, CampaignProvenance>([
        [campaign.id, { strings: new Map(Object.entries(input.form.strings)), attachments: input.form.attachments }],
      ]);
      hold(deepFreeze(structuredClone(input)), frozenRegistry([campaign], strings, provenance, undefined));
      authoredView = lockSet(new Set(authored));
    }
    return { outcome: "restored", ref, warnings: [...result.warnings, ...collisions] };
  }

  const first = publish(options.initial);
  if (!first.ok) {
    const codes = first.errors.map((e) => (e.path === undefined ? e.code : `${e.code} (${e.path})`)).join(", ");
    throw new Error(`createContentArchive: the initial registry fails validation: ${codes} (20-contract.md §4)`);
  }

  return {
    publish,
    restore,
    stored: (campaignId, campaignVersion) => held.get(campaignId)?.get(campaignVersion)?.stored,
    latest: () => latest!,
    resolve: (campaignId, campaignVersion) => held.get(campaignId)?.get(campaignVersion)?.registry,
    current: (scope) => currentVersion.get(scope.campaignId),
    authoredKeys: () => authoredView,
  };
}
