/**
 * Default port implementations.
 *
 * Contract: `06-extensibility.md` §5.1.
 */

import type { IdSource } from "./types.js";

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
