/**
 * Registry — the content registry and campaign resolution.
 *
 * Contract: `04-core.md` §10.1.
 *
 * The registry is **frozen and pre-validated** before the engine sees it. Parsing and
 * file I/O live outside the engine, in an authoring adapter: authors write source, a
 * pure builder produces `BuiltCampaign`, and the registry is assembled from the result.
 * That is what keeps the engine free of a loader.
 */

import type { LocKey } from "../localization/types.js";
import type { KindId } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";

export interface ContentRegistry {
  readonly campaigns: ReadonlyMap<string, Campaign>;
  readonly strings: ReadonlyMap<LocKey, string>;
  /**
   * A digest over the ordered pack set `resolvePacks` (`packs.ts`) folded this registry
   * from (11-content-packs.md §6) — absent for a registry built the single-campaign way,
   * via `buildContentRegistry`, which knows no packs exist.
   */
  readonly resolution?: ResolutionId;
}

/** A canonical digest over an ordered `{id, version}` pack list (11-content-packs.md §6). */
export type ResolutionId = string;

/**
 * The runtime form: `LocKey`s only, no authored prose. Identity lives here and **not**
 * inside `content` — the envelope-duplication rule `CLAUDE.md` tracks is at its sharpest
 * on this type. See `CLAUDE.md` for the ledger; the count is not repeated here, since a
 * repeated count is exactly what has drifted before.
 */
export interface Campaign {
  id: string;
  kindId: KindId;
  version: string;
  titleKey: LocKey;
  /** Kind-specific; opaque to the core. */
  content: unknown;

  /**
   * Modules this campaign composes in at registry build (04 §10.4). Absent means none. In
   * the frozen registry the list stays as provenance only; `content` is already composed.
   */
  includes?: readonly CampaignInclude[];

  /**
   * Migrates a `kindState` forward when this campaign's own content ids or shape changed
   * between `fromVersion` and this `Campaign.version` (04 §10.2) — e.g. a node or
   * achievement id rename. Optional — most version bumps rename nothing a save
   * references. Runs at the save-load boundary only, after any `Kind.migrateState` (a
   * kind-state shape change is a precondition for content remapping to address the right
   * fields), never during `advance`.
   */
  migrateState?(kindState: unknown, fromVersion: string): CommandResult<unknown>;
}

/** A pin on a campaign's *authored* version — never a resolution id (11 §6). */
export interface CampaignRef {
  id: string;
  version: string;
}

/** One module a host composes in (04 §10.4). */
export interface CampaignInclude {
  /**
   * The prefix the module's ids take in the host (04 §17, *Composed ids*). An authored id:
   * ASCII `[a-z0-9_-]`, no `:`, unique among the host's includes and attachments.
   */
  alias: string;
  ref: CampaignRef;
  /** Kind-specific — entry, exit and variable mappings. Opaque to the core, like `content`. */
  binding: unknown;
}

/** An include a content pack adds to a campaign it does not own (11 §3a). */
export interface CampaignAttachment {
  hostCampaignId: string;
  include: CampaignInclude;
  /** Kind-specific — where in the host the module is reached from. */
  payload: unknown;
}

/**
 * What `Kind.composeContent` receives per module: the include as declared, and the module
 * campaign already composed — its own includes and attachments merged in.
 */
export interface ComposedModule {
  include: CampaignInclude;
  campaign: Campaign;
}

export interface ComposedAttachment {
  payload: unknown;
  module: ComposedModule;
}

/**
 * What `resolvePacks` (`packs.ts`) hands registry assembly (11 §3a). Neither extra field
 * survives into the frozen registry: `buildValidatedPackRegistry` composes from them and
 * returns a plain `ContentRegistry`.
 */
export interface ResolvedRegistry extends ContentRegistry {
  /** Each folded campaign's version *before* 11 §6 stamped it — what an include pins. */
  readonly authoredVersions: ReadonlyMap<string, string>;
  /** Every pack's attachments, in pack order and then declaration order. */
  readonly attachments: readonly CampaignAttachment[];
}

/** One authored string, before it is lifted into the string table. */
export interface AuthoredText {
  key: LocKey;
  text: string;
}

/** What the pure authoring builder returns. */
export interface BuiltCampaign {
  campaign: Campaign;
  strings: ReadonlyMap<LocKey, string>;
}
