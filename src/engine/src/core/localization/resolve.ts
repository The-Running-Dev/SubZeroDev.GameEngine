/**
 * `LocKey` resolution against the registry's native string table.
 *
 * Contract: `04-core.md` §12, §17.
 *
 * `ContentRegistry.strings` is a `ReadonlyMap<LocKey, string>` — this resolves against
 * that shape directly. The client-facing `StringTable` (`localization/types.ts`) is a
 * `Readonly<Record<LocKey, string>>`, narrowed to one session's campaign and locale
 * (04 §7's `getStrings`) — that narrowing and the Map→Record conversion belong to the
 * session store (W7), not here.
 */

import type { LocKey } from "./types.js";

export function resolveLocKey(strings: ReadonlyMap<LocKey, string>, key: LocKey): string | undefined {
  return strings.get(key);
}
