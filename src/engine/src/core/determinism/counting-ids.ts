/**
 * A genuinely *counting* `IdSource` — `09-clients.md` §1 and `06-extensibility.md` §5.1
 * both name this specific kind of fixture, not just "a fixed one": "the same seed, choices,
 * and counting IdSource produce byte-identical serialize() output." `07-replay.md` §5 names
 * the same prerequisite for the replay regression oracle.
 *
 * Promoted out of `mcp/server.test.ts` (W22, `plans/27-replay-oracle-programme.md` Decision
 * 5) — the replay runner and its corpus test need the exact same reproducible `IdSource`
 * the MCP test already proved correct, not a second definition.
 */

import type { IdSource } from "../composition/types.js";

/**
 * Independent counters, not one shared between them — `createGame` calls `newGameId()`
 * first and only falls back to `newSeed()` when a fixture omits its own seed, so a single
 * shared counter would couple seed numbering to how many game ids happened to be allocated
 * first, rather than each counting from 0 on its own (fixed in PR #72, review finding on
 * PR #71). A fresh counter per call, starting at 0 — two independent runs that each create
 * the same number of games in the same order still line up, which a single fixed constant
 * can't distinguish from a real counting source when exactly one game is created per run,
 * but which only a real counter proves for a run that creates more than one.
 */
export function createCountingIds(): IdSource {
  let gameN = 0;
  let seedN = 0;
  return {
    newGameId: () => `counting-game-id-${gameN++}`,
    newSeed: () => `counting-seed-${seedN++}`,
  };
}
