/**
 * Persistence — the save envelope and migration.
 *
 * Contract: `04-core.md` §10, §10.2.
 *
 * Canonical serialization itself lives beside this in `canonical.ts`, already built and
 * verified: sorted keys, non-finite values rejected.
 */

import type { GameState, KindId } from "../kernel/types.js";

/**
 * The wrapper a *save* carries. Distinct from `GameState.formatVersion`, and both are
 * kept deliberately: `Engine.serialize`/`deserialize` round-trip a **bare envelope with
 * no wrapper** — the golden files compare exactly that string — so the envelope needs
 * its own stamp independent of the save format around it.
 */
export interface SaveEnvelope {
  /** Shape of THIS envelope. */
  saveFormatVersion: number;
  /** Version of the canonical serializer that wrote `state`. */
  serializationVersion: number;
  engineVersion: string;
  kindId: KindId;
  /** A kind's code can change independently of the engine. */
  kindVersion: string;
  campaignId: string;
  campaignVersion: string;
  /** False after a migration — a migrated save is no longer byte-replayable. */
  replayCompatible: boolean;
  checksum: string;
  state: GameState;
}
