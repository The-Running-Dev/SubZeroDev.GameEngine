/**
 * Digests for the portable campaign format.
 *
 * Reuses the exact `computeResolutionId` recipe (`core/registry/packs.ts`) — sha-256 over
 * canonical JSON, via the shared `sha256Hex` primitive — rather than defining a second
 * one. A `PortableManifest` is not a `ContentPack[]` (that function's own input shape), so
 * this is a sibling built on the same primitives, not a generalization of the pack function.
 */

import { canonicalize, sha256Hex } from "subzerodev-data-json";
import type { PortableManifestEntry } from "./format.js";

const DIGEST_PREFIX = "sha-256:";

function digestOf(value: unknown): string {
  return `${DIGEST_PREFIX}${sha256Hex(canonicalize(value))}`;
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
 * The manifest-level digest is an ordered list of campaign identities. A host must first
 * verify every campaign file against its entry digest, then use this value to identify the
 * verified content set. File paths are transport details, so they are deliberately excluded.
 */
export function digestManifestResolution(entries: readonly PortableManifestEntry[]): string {
  return digestOf(entries.map(({ id, version, digest }) => ({ id, version, digest })));
}
