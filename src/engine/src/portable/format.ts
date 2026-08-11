/**
 * The portable campaign format.
 *
 * Graduated from `src/spike/portable.ts` (`plans/spike-notes.md`) — answers that plan's own
 * open question, "where does `toPortable`/`fromPortable` actually live if this graduates":
 * here, as a real export, no longer disclaimed in `index.ts`.
 *
 * A campaign is authored in TypeScript (typed source + builders, unchanged) and *deployed*
 * as one JSON file. This module is the hinge: `toPortable` runs at author time in the export
 * script, `fromPortable` runs in a browser (or any host) after a `fetch`.
 *
 * This lives outside `core/` deliberately — the core owns no loader and no file I/O
 * (`core/registry/build.ts`), and this module imports every kind's content type, which
 * `core/` may not do.
 *
 * `fromPortable` deliberately performs no validation of its own — the same design choice the
 * spike made, kept on graduation. `buildValidatedContentRegistry` still runs over its result
 * exactly as it does for a compiled-in campaign, so a malformed file fails at that gate with
 * those errors. The wire-format checks (`formatVersion`, the `kindId`/`content` pairing) are
 * the published JSON Schema's job, enforced by whoever publishes or fetches a document, not
 * by this function.
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { KindId } from "../core/kernel/types.js";
import type { LocKey } from "../core/localization/types.js";
import type { SimulationCampaign } from "../kinds/simulation/campaign.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import type { VarValue } from "../kinds/story-graph/variables.js";
import type { WorldGraphCampaign } from "../kinds/world-graph/content.js";

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
 *
 * Lives inside the story-graph arm of `PortableCampaignBody`, not as a sibling of `campaign`
 * — `migrateFromContent` (below) is written against `StoryGraphCampaign`/
 * `StoryGraphKindState` specifically, so "a migration only makes sense for a story-graph
 * campaign" is a structural fact of the wire format now, not a runtime check this module (or
 * the schema it projects to) would otherwise have to state twice.
 */
export interface PortableMigration {
  /** The only `fromVersion` this migration accepts; anything else fails the load. */
  readonly fromVersion: string;
  readonly nodeMap?: Readonly<Record<string, string>>;
  readonly endingMap?: Readonly<Record<string, string>>;
}

interface PortableCampaignEnvelope<TKindId extends KindId, TContent> {
  readonly id: string;
  readonly kindId: TKindId;
  readonly version: string;
  readonly titleKey: LocKey;
  readonly content: TContent;
}

/**
 * The wire shape of `Campaign`, minus its function member — a `kindId`-discriminated union
 * so a fetched document's `content` is never opaque `unknown` on the wire, only inside a
 * kind's own definition of its content. This is what makes the format schema-closeable: see
 * `SubZeroDev.ServiceContract`'s content contract, gate `OpaqueContentPayload`.
 */
export type PortableCampaignBody =
  | (PortableCampaignEnvelope<"story-graph", StoryGraphCampaign> & {
      readonly migration?: PortableMigration;
    })
  | PortableCampaignEnvelope<"world-graph", WorldGraphCampaign>
  | PortableCampaignEnvelope<"simulation", SimulationCampaign>;

export interface PortableCampaign {
  /**
   * `2` — bumped from the spike's `1` by this graduation: `campaign.content` is no longer
   * opaque `unknown`, and `migration` moved from a sibling of `campaign` into the
   * story-graph arm of `PortableCampaignBody`. Both are wire-breaking; a `1` document is not
   * a valid `2` document and vice versa.
   */
  readonly formatVersion: 2;
  readonly catalog: PortableCatalog;
  readonly campaign: PortableCampaignBody;
  /** The string table, flattened from `ReadonlyMap` — JSON has no Map. */
  readonly strings: Readonly<Record<string, string>>;
}

/** One published campaign file, as an entry in `PortableManifest.campaigns`. */
export interface PortableManifestEntry {
  readonly file: string;
  readonly id: string;
  readonly version: string;
  /** `sha-256:<hex>` over the canonical JSON of the campaign file this entry names — see
   *  `digestPortableCampaign` (`./digest.js`). Lets a consumer detect a changed file without
   *  downloading and diffing it, and lets a publisher's CI catch a manifest/file mismatch. */
  readonly digest: string;
}

/** The manifest `/play/` (or any host) fetches first: which campaign files exist, in catalog
 *  order, and enough per-entry identity to decide what to fetch next. */
export interface PortableManifest {
  readonly formatVersion: 2;
  readonly campaigns: readonly PortableManifestEntry[];
  /** Canonical digest over the ordered `{id, version}` list — the manifest-level analogue of
   *  `ResolutionId` (`core/registry/packs.ts`, `computeResolutionId`), over this format's own
   *  entries rather than a `ContentPack[]`. Changes if a campaign is added, removed,
   *  reordered, or re-versioned; does not change if only file names or digests change for an
   *  otherwise-identical `{id, version}` list. See `digestManifestResolution` (`./digest.js`). */
  readonly resolution: string;
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

/**
 * Author-time: a built campaign plus its catalog card, ready to write as one JSON file.
 *
 * `migration` is only meaningful for a story-graph campaign — `PortableCampaignBody`'s
 * story-graph arm is the only one with a `migration` member. Passing one for another kind is
 * an authoring mistake, not a malformed wire document (this function's input is trusted,
 * first-party `BuiltCampaign` data, not fetched JSON), so it throws rather than silently
 * dropping the migration.
 */
export function toPortable(
  built: BuiltCampaign,
  catalog: PortableCatalog,
  migration?: PortableMigration,
): PortableCampaign {
  const { campaign, strings } = built;
  return {
    formatVersion: 2,
    catalog,
    campaign: toPortableBody(campaign, migration),
    // Sorted so the exported file is stable across runs — a diff should mean a content
    // change, not a Map iteration order. Same instinct as the canonical serializer.
    strings: Object.fromEntries([...strings.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}

function toPortableBody(campaign: Campaign, migration: PortableMigration | undefined): PortableCampaignBody {
  const envelope = { id: campaign.id, version: campaign.version, titleKey: campaign.titleKey };
  switch (campaign.kindId) {
    case "story-graph":
      return {
        ...envelope,
        kindId: "story-graph",
        content: campaign.content as StoryGraphCampaign,
        ...(migration !== undefined ? { migration } : {}),
      };
    case "world-graph":
      if (migration !== undefined) {
        throw new Error(
          `toPortable: migration is only supported for story-graph campaigns, got world-graph for "${campaign.id}"`,
        );
      }
      return { ...envelope, kindId: "world-graph", content: campaign.content as WorldGraphCampaign };
    case "simulation":
      if (migration !== undefined) {
        throw new Error(
          `toPortable: migration is only supported for story-graph campaigns, got simulation for "${campaign.id}"`,
        );
      }
      return { ...envelope, kindId: "simulation", content: campaign.content as SimulationCampaign };
  }
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
 * Browser-side (or any host): a fetched `PortableCampaign` back into what the registry
 * expects.
 *
 * Dispatches on `campaign.kindId` — the wire format ties `kindId` to `content`'s shape, so
 * there is no cast here to a single assumed kind, unlike the pre-graduation spike.
 */
export function fromPortable(portable: PortableCampaign): {
  built: BuiltCampaign;
  catalog: PortableCatalog;
} {
  const { campaign } = portable;
  const content = hardenContent(campaign);

  const built: Campaign = {
    id: campaign.id,
    kindId: campaign.kindId,
    version: campaign.version,
    titleKey: campaign.titleKey,
    content,
  };

  if (campaign.kindId === "story-graph" && campaign.migration !== undefined) {
    const storyContent = content as StoryGraphCampaign;
    const migration = campaign.migration;
    built.migrateState = (state, fromVersion) => migrateFromContent(state, fromVersion, storyContent, migration);
  }

  return {
    built: { campaign: built, strings: new Map(Object.entries(portable.strings)) },
    catalog: portable.catalog,
  };
}

function hardenContent(campaign: PortableCampaignBody): unknown {
  if (campaign.kindId !== "story-graph") return campaign.content;
  const content = campaign.content;
  return { ...content, variables: nullProto(content.variables), nodes: nullProto(content.nodes) };
}
