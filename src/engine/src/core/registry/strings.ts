/**
 * The one dedup/conflict primitive behind the authoring boundary.
 *
 * Contract: `04-core.md` §10.1 — "Repeated identical key/text pairs deduplicate; the same
 * key with different text is a hard error." Used twice: once inside one campaign's own
 * `AuthoredText` list (`buildCampaign`, `build.ts`), and again across `CORE_REASON_MESSAGES`
 * plus every campaign's built strings (`buildContentRegistry`, `build.ts`).
 */

import type { LocKey } from "../localization/types.js";

export interface StringConflict {
  readonly key: LocKey;
  readonly existing: string;
  readonly incoming: string;
}

export type MergeStringTablesResult =
  | { readonly ok: true; readonly strings: ReadonlyMap<LocKey, string> }
  | { readonly ok: false; readonly conflicts: readonly StringConflict[] };

/**
 * Folds every table left to right. An identical key+text pair dedupes silently; the same
 * key with different text is recorded as a conflict. Every conflict is accumulated rather
 * than failing on the first, so one report shows everything wrong at once.
 */
export function mergeStringTables(tables: readonly ReadonlyMap<LocKey, string>[]): MergeStringTablesResult {
  const merged = new Map<LocKey, string>();
  const conflicts: StringConflict[] = [];

  for (const table of tables) {
    for (const [key, text] of table) {
      const existing = merged.get(key);
      if (existing === undefined) {
        merged.set(key, text);
      } else if (existing !== text) {
        conflicts.push({ key, existing, incoming: text });
      }
    }
  }

  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }
  return { ok: true, strings: merged };
}
