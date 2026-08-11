/**
 * Digests for the portable campaign format.
 *
 * Reuses the exact `computeResolutionId` recipe (`core/registry/packs.ts`) — sha-256 over
 * `canonicalStringify`, via the shared `sha256Hex` primitive — rather than defining a second
 * one. A `PortableManifest` is not a `ContentPack[]` (that function's own input shape), so
 * this is a sibling built on the same primitives, not a generalization of the pack function.
 */

import { canonicalStringify, sha256Hex } from "../core/persistence/canonical.js";
import type { PackRef } from "../core/registry/packs.js";

const DIGEST_PREFIX = "sha-256:";

function digestOf(value: unknown): string {
  return `${DIGEST_PREFIX}${sha256Hex(canonicalStringify(value))}`;
}

/**
 * One campaign file's content digest, as recorded in its `PortableManifestEntry`. Lets a
 * consumer detect a changed file without re-parsing it, and lets a publisher's CI catch a
 * manifest that no longer matches the file it describes.
 */
export function digestPortableCampaign(portable: unknown): string {
  return digestOf(portable);
}

/**
 * The manifest-level digest — the same ordered `{id, version}` list recipe `ResolutionId`
 * uses, over a portable manifest's own entries. Changes if a campaign is added, removed,
 * reordered, or re-versioned; does not change for a file-name or digest-only edit to an
 * otherwise-identical `{id, version}` list.
 */
export function digestManifestResolution(entries: readonly PackRef[]): string {
  return digestOf(entries.map(({ id, version }) => ({ id, version })));
}
