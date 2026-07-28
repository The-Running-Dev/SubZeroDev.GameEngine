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
import type { ProfileStore, SessionStore } from "../session/types.js";

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
  now(): number;
}

/** Composition root for the pure engine. */
export interface EngineHost {
  kinds: KindRegistry;
  registry: ContentRegistry;
  ids?: IdSource;
  emitter?: Emitter;
}

/** Composition root for the session layer — the only place a clock appears. */
export interface SessionHost {
  engine: Engine;
  sessions: SessionStore;
  profiles?: ProfileStore;
  clock?: Clock;
}
