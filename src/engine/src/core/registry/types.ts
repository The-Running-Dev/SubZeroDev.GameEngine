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
   * Migrates a `kindState` forward when this campaign's own content ids or shape changed
   * between `fromVersion` and this `Campaign.version` (04 §10.2) — e.g. a node or
   * achievement id rename. Optional — most version bumps rename nothing a save
   * references. Runs at the save-load boundary only, after any `Kind.migrateState` (a
   * kind-state shape change is a precondition for content remapping to address the right
   * fields), never during `advance`.
   */
  migrateState?(kindState: unknown, fromVersion: string): CommandResult<unknown>;
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
