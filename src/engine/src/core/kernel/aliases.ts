/**
 * Response aliases — the one map every response surface uses for engine-owned keys.
 *
 * Contract: `20-contract.md` §3.1 (`ProjectionContext`), §7 (*Engine-owned keys resolve from
 * the running engine*), C29; `10-design.md` 06 §4 (`aliasEngineKeys`) and 16 §5.7.
 *
 * Internal: nothing here is exported from the package root. A kind reaches the map only
 * through `ProjectionContext.engineRef`, and the store only through the engine link below, so
 * no path that writes state can produce an alias (C29).
 */

import type { LocKey } from "../localization/types.js";
import type { ContentRegistry } from "../registry/types.js";
import { CORE_REASON_MESSAGES } from "./reasons.js";
import type { Engine, KindRegistry } from "./types.js";

export type AliasMode = "colliding" | "all";

/** Every engine-owned message this process ships: the core's `core.reason.*` set and each
 *  registered kind's `reasonMessages` (20-contract §7). */
export function runningCatalog(kinds: KindRegistry): ReadonlyMap<LocKey, string> {
  const catalog = new Map<LocKey, string>(CORE_REASON_MESSAGES);
  for (const kind of Object.values(kinds)) for (const [key, text] of kind.reasonMessages) catalog.set(key, text);
  return catalog;
}

/** `~key` if no authored key in scope equals it, else `~n~key` for the smallest positive `n`
 *  whose form is free. Engine keys contain no `~`, so distinct keys never share an alias. */
export function aliasOf(key: LocKey, scope: ReadonlySet<LocKey>): LocKey {
  const plain = `~${key}`;
  if (!scope.has(plain)) return plain;
  for (let n = 1; ; n += 1) {
    const numbered = `~${n}~${key}`;
    if (!scope.has(numbered)) return numbered;
  }
}

/** A registry's authored strings: its provenance where every campaign records one, else
 *  every string the running catalog does not own. */
export function registryAuthoredStrings(registry: ContentRegistry, catalog: ReadonlyMap<LocKey, string>): ReadonlyMap<LocKey, string> {
  const provenance = registry.provenance;
  if (provenance && [...registry.campaigns.keys()].every((id) => provenance.has(id))) {
    const strings = new Map<LocKey, string>();
    for (const entry of provenance.values()) for (const [key, text] of entry.strings) strings.set(key, text);
    return strings;
  }
  return new Map([...registry.strings].filter(([key]) => !catalog.has(key)));
}

/** The construction registry's authored keys — the alias scope when the archive offers none. */
export function registryAuthoredKeys(registry: ContentRegistry, catalog: ReadonlyMap<LocKey, string>): ReadonlySet<LocKey> {
  return new Set(registryAuthoredStrings(registry, catalog).keys());
}

export interface ResponseAliases {
  readonly mode: AliasMode;
  readonly catalog: ReadonlyMap<LocKey, string>;
  /** Archive-wide, read per call: `restore` can widen it after construction. */
  scope(): ReadonlySet<LocKey>;
  /** An engine-owned key → the key a response carries for it. */
  engineRef(key: LocKey): LocKey;
  /** Whether an engine-owned key is emitted under an alias. */
  aliases(key: LocKey): boolean;
}

export function createResponseAliases(mode: AliasMode, catalog: ReadonlyMap<LocKey, string>, scope: () => ReadonlySet<LocKey>): ResponseAliases {
  // A key the running catalog does not own is never engine-owned, so it is never aliased.
  const aliases = (key: LocKey): boolean => catalog.has(key) && (mode === "all" || scope().has(key));
  return {
    mode,
    catalog,
    scope,
    aliases,
    engineRef: (key) => (aliases(key) ? aliasOf(key, scope()) : key),
  };
}

/** The identity map, for a store composed over an engine `createEngine` did not return. */
export const IDENTITY_ALIASES: ResponseAliases = {
  mode: "colliding",
  catalog: new Map(),
  scope: () => new Set(),
  aliases: () => false,
  engineRef: (key) => key,
};

// ── The internal carrier (20-contract §7): a value whose key came from content although an
//    engine key could equal it. Not exported, not serialized, never part of a public type. ──

const authoredValues = new WeakSet<object>();

/** Marks `value` as carrying an authored key, so the response builder never aliases it. */
export function authoredRef<T extends object>(value: T): T {
  authoredValues.add(value);
  return value;
}

/** An `errors`/`warnings`/`messages` item is engine-owned iff the running catalog owns its key
 *  and no producer marked it authored. */
export function isEngineOwned(value: object, key: LocKey, aliases: ResponseAliases): boolean {
  return aliases.catalog.has(key) && !authoredValues.has(value);
}

// ── The engine link (06 §4): the session layer uses the engine's own map, never a second
//    option, so the two can never disagree. ──

const links = new WeakMap<Engine, ResponseAliases>();

export function linkEngine(engine: Engine, aliases: ResponseAliases): Engine {
  links.set(engine, aliases);
  return engine;
}

export function engineAliases(engine: Engine): ResponseAliases | undefined {
  return links.get(engine);
}
