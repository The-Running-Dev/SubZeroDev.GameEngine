/**
 * Composition — the two host roots and the ports a host may supply.
 *
 * Contract: `06-extensibility.md` §4–§5.
 *
 * The rule that decides what may be a port: **a host may supply anything that cannot
 * change `serialize()` output.** That makes the determinism boundary the trust boundary.
 * `gameId` and `seed` come from `IdSource` because they are *inputs*; entity ids inside
 * `kindState` may not, because they are serialized (12 §9).
 *
 * Kinds are not ports — they stay engine-owned (architecture N2).
 */

import type { ContentRegistry } from "../registry/types.js";
import type { Engine, KindRegistry } from "../kernel/types.js";
import type { Emitter } from "../observability/types.js";
import type { ProfileStore, SessionPersistence } from "../session/types.js";
import type { EmittedRecordSink } from "../observability/types.js";

/**
 * Supplies the identity the core does not generate itself. The default is random, so a
 * byte-identical cross-client comparison must fix it — a counting source is part of the
 * fixture, not an afterthought (09 §1).
 */
export interface IdSource {
  newGameId(): string;
  newSeed(): string;
}

/**
 * Wall-clock, supplied only above the pure core. Nothing inside `advance` may read it;
 * the determinism guard bans `Date.now` in source to keep that structural.
 */
export interface Clock {
  /** ISO-8601. Used for session-store record timestamps and `EmittedRecord.emittedAt`
   *  (05 §6) — the one place the platform reads a clock, and a named one. */
  now(): string;
}

/**
 * Composition root for the pure engine. Every port is supplied once, at construction,
 * and never swapped afterwards — replacing a store mid-session would make every
 * invariant in `04-core.md` conditional on when it was asked.
 */
export interface EngineHost {
  readonly kinds: KindRegistry;
  readonly registry: ContentRegistry;
  readonly ids?: IdSource;
  readonly emitter?: Emitter;
}

/** Composition root for the session layer — the only place a clock appears. */
export interface SessionHost {
  readonly engine: Engine;
  readonly registry: ContentRegistry;
  readonly persistence?: SessionPersistence;
  readonly profiles?: ProfileStore;
  readonly clock?: Clock;
  readonly recordSink?: EmittedRecordSink;
}
