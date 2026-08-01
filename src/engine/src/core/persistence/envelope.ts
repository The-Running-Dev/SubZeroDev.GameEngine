/**
 * The `SaveEnvelope` boundary — construction, structural validation, checksum, and the
 * compatibility/migration resolution `SessionStore.loadGame` drives.
 *
 * Contract: `04-core.md` §10.2. Design: `plans/38-save-migration-programme.md`.
 *
 * Kept out of `session/store.ts` deliberately: this logic is pure given `(blob, kinds,
 * registry)`, so it is testable without a store's async/locking machinery, the same
 * separation `canonical.ts` already draws for serialization itself.
 */

import { createHash } from "node:crypto";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { GameState, Kind, KindRegistry } from "../kernel/types.js";
import { isValidGameStateShape } from "../kernel/engine.js";
import { canonicalStringify } from "./canonical.js";
import type { SaveEnvelope } from "./types.js";
import { ENGINE_VERSION } from "../../version.js";
import type { CommandResult } from "../kernel/reasons.js";

/** The only envelope shape and canonical-serializer version that have ever existed. Both
 *  are introduced by this unit, so a mismatch against either is unreachable today — see
 *  plans/38's Design section scope note. */
export const CURRENT_SAVE_FORMAT_VERSION = 1;
export const CURRENT_SERIALIZATION_VERSION = 1;

export function computeChecksum(serializedContent: string): string {
  return createHash("sha256").update(serializedContent).digest("hex");
}

/**
 * What the checksum actually covers: `state` plus `replayCompatible`. The latter has no
 * other cross-check protecting it (unlike `kindId`/`campaignId`, verified against each
 * other and the embedded state below) — without it here, flipping a migrated save's
 * `replayCompatible` from `false` back to `true` in the stored blob would silently defeat
 * the sticky-forward guarantee §10.2 documents.
 */
function checksummedContent(state: GameState, replayCompatible: boolean): string {
  return canonicalStringify({ state, replayCompatible });
}

export interface BuildSaveEnvelopeParams {
  state: GameState;
  kind: Kind<unknown>;
  campaign: Campaign;
  /** Carried forward from the session this save was taken from — sticky once false
   *  (Design section: a migrated lineage never becomes replay-compatible again). */
  replayCompatible: boolean;
}

export function buildSaveEnvelope(params: BuildSaveEnvelopeParams): SaveEnvelope {
  const { state, kind, campaign, replayCompatible } = params;
  const checksum = computeChecksum(checksummedContent(state, replayCompatible));
  return {
    saveFormatVersion: CURRENT_SAVE_FORMAT_VERSION,
    serializationVersion: CURRENT_SERIALIZATION_VERSION,
    engineVersion: ENGINE_VERSION,
    kindId: state.kindId,
    kindVersion: kind.version,
    campaignId: state.campaignId,
    campaignVersion: campaign.version,
    replayCompatible,
    checksum,
    state,
  };
}

export function serializeSaveEnvelope(envelope: SaveEnvelope): string {
  return canonicalStringify(envelope);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Structural only — the checksum (verified separately, by the caller) is what actually
 *  proves `state` matches what was saved; this just confirms the wrapper's own shape. */
function isValidSaveEnvelopeShape(v: unknown): v is SaveEnvelope {
  if (!isPlainObject(v)) return false;
  if (typeof v["saveFormatVersion"] !== "number") return false;
  if (typeof v["serializationVersion"] !== "number") return false;
  if (typeof v["engineVersion"] !== "string") return false;
  if (typeof v["kindId"] !== "string") return false;
  if (typeof v["kindVersion"] !== "string") return false;
  if (typeof v["campaignId"] !== "string") return false;
  if (typeof v["campaignVersion"] !== "string") return false;
  if (typeof v["replayCompatible"] !== "boolean") return false;
  if (typeof v["checksum"] !== "string") return false;
  if (!isValidGameStateShape(v["state"])) return false;
  return true;
}

export type SaveEnvelopeResolution =
  | { ok: true; state: GameState; replayCompatible: boolean }
  | { ok: false; code: "invalid_state" | "unknown_campaign" | "unknown_kind" | "save_requires_migration" | "migration_failed" };

/**
 * Runs a `migrateState` implementation defensively — it is kind- or campaign-owned
 * content code, not core code, so a throw must degrade to the documented
 * `migration_failed` rejection rather than escape as an arbitrary error. Same reasoning
 * as `submitAction`'s own `profiles` catch in `session/store.ts`: content-adjacent code
 * that fails must never propagate past its own well-defined failure channel.
 */
function invokeMigration(
  migrateState: (state: unknown, fromVersion: string) => CommandResult<unknown>,
  state: unknown,
  fromVersion: string,
): CommandResult<unknown> {
  try {
    return migrateState(state, fromVersion);
  } catch {
    return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
  }
}

/**
 * Parses, validates, and — if `kindVersion`/`campaignVersion` moved — migrates a stored
 * blob forward. Every failure names a reason code; the caller (`SessionStore.loadGame`)
 * is the one that actually throws, matching its own established "session store: X
 * rejected — ${code}" convention (e.g. `createSession`) rather than this module
 * inventing a second error-reporting shape.
 *
 * Dispatch order matches the Design section: `Kind.migrateState` first (a kind-state
 * shape change is a precondition for content remapping to address the right fields),
 * then `Campaign.migrateState`. `saveFormatVersion`/`serializationVersion` reuse
 * `save_requires_migration` too — this unit introduces both, so neither has ever moved,
 * and there is equally nothing to migrate either from yet (Finding 4's reasoning).
 * `engineVersion` is never checked here at all: informational only, per §10.2's own
 * "changes independently" rationale.
 */
export function resolveSaveEnvelope(blob: string, kinds: KindRegistry, registry: ContentRegistry): SaveEnvelopeResolution {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    parsed = undefined;
  }

  if (!isValidSaveEnvelopeShape(parsed)) {
    return { ok: false, code: "invalid_state" };
  }

  if (computeChecksum(checksummedContent(parsed.state, parsed.replayCompatible)) !== parsed.checksum) {
    return { ok: false, code: "invalid_state" };
  }

  if (parsed.saveFormatVersion !== CURRENT_SAVE_FORMAT_VERSION) {
    return { ok: false, code: "save_requires_migration" };
  }
  if (parsed.serializationVersion !== CURRENT_SERIALIZATION_VERSION) {
    return { ok: false, code: "save_requires_migration" };
  }

  const campaign = registry.campaigns.get(parsed.campaignId);
  if (!campaign) return { ok: false, code: "unknown_campaign" };
  const kind = kinds[parsed.kindId];
  if (!kind) return { ok: false, code: "unknown_kind" };

  // The checksum covers only `state` — nothing stops the *outer* wrapper fields from
  // being edited independently of it. Cross-checking them against each other and against
  // the embedded (checksummed) GameState closes that: a campaign that doesn't actually
  // belong to the claimed kind, or outer ids that disagree with the embedded state's own,
  // can only mean tampered or corrupt wrapper metadata.
  if (campaign.kindId !== parsed.kindId) return { ok: false, code: "invalid_state" };
  if (parsed.state.kindId !== parsed.kindId) return { ok: false, code: "invalid_state" };
  if (parsed.state.campaignId !== parsed.campaignId) return { ok: false, code: "invalid_state" };

  let kindState = parsed.state.kindState;
  let migrated = false;

  if (parsed.kindVersion !== kind.version) {
    if (!kind.migrateState) return { ok: false, code: "save_requires_migration" };
    const result = invokeMigration(kind.migrateState.bind(kind), kindState, parsed.kindVersion);
    if (!result.ok || result.value === undefined) return { ok: false, code: "migration_failed" };
    kindState = result.value;
    migrated = true;
  }

  if (parsed.campaignVersion !== campaign.version) {
    if (!campaign.migrateState) return { ok: false, code: "save_requires_migration" };
    const result = invokeMigration(campaign.migrateState.bind(campaign), kindState, parsed.campaignVersion);
    if (!result.ok || result.value === undefined) return { ok: false, code: "migration_failed" };
    kindState = result.value;
    migrated = true;
  }

  const state: GameState = { ...parsed.state, kindState, campaignVersion: campaign.version };
  return { ok: true, state, replayCompatible: parsed.replayCompatible && !migrated };
}
