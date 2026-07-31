/**
 * Default port implementations.
 *
 * Contract: `06-extensibility.md` §5.1, §5.4.
 */

import type { Clock, IdSource } from "./types.js";

/**
 * The default `IdSource`: a random source, the one place in the platform where
 * randomness is legitimately unpredictable (06 §5.1). Uses `crypto.randomUUID()`, not
 * `Math.random` — the determinism guard bans the latter, and a CSPRNG is the more
 * correct choice for identity anyway.
 */
export const defaultIdSource: IdSource = {
  newGameId: () => crypto.randomUUID(),
  newSeed: () => crypto.randomUUID(),
};

/**
 * The default `Clock`: the real wall clock. `Clock` is boundary-only (06 §5.4) — nothing
 * inside `advance` ever receives it, so reading real time here does not reopen the
 * determinism boundary the eslint guard protects; it is "the one place the platform reads
 * a clock, and a named one" (`composition/types.ts`'s own doc comment on `Clock`).
 */
export const defaultClock: Clock = {
  // eslint-disable-next-line no-restricted-globals -- sanctioned boundary-only exception; see the doc comment above.
  now: () => new Date().toISOString(),
};
