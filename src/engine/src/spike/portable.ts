/**
 * SPIKE — the portable campaign format.
 *
 * Throwaway. Not a contract, not referenced by `design/`. See `plans/spike-notes.md`.
 *
 * A campaign is authored in TypeScript (typed source + builders, unchanged) and *deployed*
 * as one JSON file. This module is the hinge: `toPortable` runs at author time in the
 * export script, `fromPortable` runs in the browser after a `fetch`.
 *
 * This lives outside `core/` deliberately — the core owns no loader and no file I/O
 * (`core/registry/build.ts`), and this module imports a kind, which `core/` may not do.
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { KindId } from "../core/kernel/types.js";
import type { LocKey } from "../core/localization/types.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import type { VarValue } from "../kinds/story-graph/variables.js";

/**
 * The catalog metadata `/play/` needs to render a dossier card. On `main` this lives in a
 * positional array in `site/src/play/composition.ts`, index-coupled to a parallel array of
 * built campaigns. Here it travels *with* the campaign, which is the whole point.
 */
export interface PortableCatalog {
  readonly title: string;
  readonly description: string;
  readonly duration: string;
  readonly contentNotice: string;
  readonly featured: boolean;
  /** Registered and playable, but omitted from the public grid — direct `?campaign=` link only. */
  readonly hidden?: boolean;
  readonly sources?: readonly { readonly label: string; readonly href: string }[];
}

/**
 * A content migration, as data.
 *
 * `Campaign.migrateState` is a *function*, so it cannot survive JSON — which looked like a
 * blocker until `campaigns/adventure-builder.ts` turned out to hold the answer already:
 * `migrateV1AdventureState` is generic code parameterized by two id-remap tables. The
 * per-campaign part was always data. Only the tables travel; the generic walk is engine
 * code, reattached by `fromPortable`.
 */
export interface PortableMigration {
  /** The only `fromVersion` this migration accepts; anything else fails the load. */
  readonly fromVersion: string;
  readonly nodeMap?: Readonly<Record<string, string>>;
  readonly endingMap?: Readonly<Record<string, string>>;
}

export interface PortableCampaign {
  readonly formatVersion: 1;
  readonly catalog: PortableCatalog;
  readonly campaign: {
    readonly id: string;
    readonly kindId: KindId;
    readonly version: string;
    readonly titleKey: LocKey;
    readonly content: unknown;
  };
  readonly migration?: PortableMigration;
  /** The string table, flattened from `ReadonlyMap` — JSON has no Map. */
  readonly strings: Readonly<Record<string, string>>;
}

/** The manifest `/play/` fetches first: which campaign files exist, in catalog order. */
export interface PortableManifest {
  readonly formatVersion: 1;
  readonly campaigns: readonly string[];
}

function migrationFailed(): CommandResult<unknown> {
  return {
    ok: false,
    errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }],
    warnings: [],
  };
}

/**
 * Rebuilds a JSON-parsed map null-prototype.
 *
 * `JSON.parse` hands back objects with `Object.prototype`, but the story-graph kind's
 * node and variable maps are built with `Object.create(null)` precisely so content-controlled
 * keys (`__proto__`, `toString`) cannot reach the prototype chain — see the hardening notes
 * in `kinds/story-graph/variables.ts`. A round-trip through JSON silently undoes that, so it
 * is reapplied on the way back in.
 */
function nullProto<T>(source: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const key of Object.keys(source)) out[key] = source[key]!;
  return out;
}

/** Author-time: a built campaign plus its catalog card, ready to write as one JSON file. */
export function toPortable(
  built: BuiltCampaign,
  catalog: PortableCatalog,
  migration?: PortableMigration,
): PortableCampaign {
  const { campaign, strings } = built;
  return {
    formatVersion: 1,
    catalog,
    campaign: {
      id: campaign.id,
      kindId: campaign.kindId,
      version: campaign.version,
      titleKey: campaign.titleKey,
      content: campaign.content,
    },
    ...(migration !== undefined ? { migration } : {}),
    // Sorted so the exported file is stable across runs — a diff should mean a content
    // change, not a Map iteration order. Same instinct as the canonical serializer.
    strings: Object.fromEntries([...strings.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}

/**
 * The generic v1 → v2 adventure migration, driven by the built `content` rather than the
 * authoring source. `campaigns/adventure-builder.ts` reads `source.nodes` and
 * `source.variables`; the built content carries both with identical shape (authored text
 * replaced by its `LocKey`), and the migration never touches the text — so the source was
 * never actually required. That is what makes this reattachable after a JSON round-trip.
 */
function migrateFromContent(
  value: unknown,
  fromVersion: string,
  content: StoryGraphCampaign,
  migration: PortableMigration,
): CommandResult<unknown> {
  if (fromVersion !== migration.fromVersion || typeof value !== "object" || value === null) {
    return migrationFailed();
  }
  const state = value as StoryGraphKindState;
  if (typeof state.currentNodeId !== "string" || typeof state.variables !== "object" || state.variables === null) {
    return migrationFailed();
  }
  const nodeMap = migration.nodeMap ?? {};
  const endingMap = migration.endingMap ?? {};

  const variables: Record<string, VarValue> = { ...state.variables };
  for (const [name, declaration] of Object.entries(content.variables)) {
    if (!Object.hasOwn(variables, name)) variables[name] = declaration.initial;
  }

  const visitedCounts: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [id, count] of Object.entries(state.visitedCounts ?? {})) {
    const mapped = nodeMap[id] ?? id;
    visitedCounts[mapped] = (visitedCounts[mapped] ?? 0) + count;
  }

  const currentNodeId = nodeMap[state.currentNodeId] ?? state.currentNodeId;
  if (!Object.hasOwn(content.nodes, currentNodeId)) return migrationFailed();

  const routeDeclaration = content.variables.route;
  if (routeDeclaration?.type === "enum" && routeDeclaration.values !== undefined) {
    const routeForCurrentNode = routeDeclaration.values.find((route) => currentNodeId.startsWith(`${route}_`));
    if (routeForCurrentNode !== undefined) variables.route = routeForCurrentNode;
  }

  return {
    ok: true,
    value: {
      ...state,
      currentNodeId,
      variables,
      visitedCounts,
      ...(state.endingId === undefined ? {} : { endingId: endingMap[state.endingId] ?? state.endingId }),
    } satisfies StoryGraphKindState,
    errors: [],
    warnings: [],
  };
}

/**
 * Browser-side: a fetched `PortableCampaign` back into what the registry expects.
 *
 * Does **no** validation of its own — `buildValidatedContentRegistry` still runs over the
 * result exactly as it does for a compiled-in campaign, so a malformed file fails at the
 * same gate with the same errors. Proving that is part of the spike.
 */
export function fromPortable(portable: PortableCampaign): {
  built: BuiltCampaign;
  catalog: PortableCatalog;
} {
  const content = portable.campaign.content as StoryGraphCampaign;
  const hardened: StoryGraphCampaign = {
    ...content,
    variables: nullProto(content.variables),
    nodes: nullProto(content.nodes),
  };

  const campaign: Campaign = {
    id: portable.campaign.id,
    kindId: portable.campaign.kindId,
    version: portable.campaign.version,
    titleKey: portable.campaign.titleKey,
    content: hardened,
  };

  const { migration } = portable;
  if (migration !== undefined) {
    campaign.migrateState = (state, fromVersion) => migrateFromContent(state, fromVersion, hardened, migration);
  }

  return {
    built: { campaign, strings: new Map(Object.entries(portable.strings)) },
    catalog: portable.catalog,
  };
}
