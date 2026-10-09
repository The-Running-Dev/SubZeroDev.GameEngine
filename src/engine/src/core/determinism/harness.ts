/**
 * The determinism harness — the `PlaythroughFixture` runner (04-core.md §14).
 *
 * Contract: `04-core.md` §14. The acceptance test with teeth: proves a fixed
 * `(config, actionLog)` replays to a byte-identical `serialize()` output, not that the
 * engine does anything new. Kind-agnostic and core-owned — it only ever touches the
 * already-built `Engine`, never a kind or a campaign directly, so it stays clear of the
 * core-must-not-import-`kinds/` rule. The real, kind-specific fixtures (the Bureaucracy
 * arc, W15) are defined beside the campaign that owns them and drive this runner from
 * there — see `campaigns/bulgaria-bureaucracy.determinism.test.ts`.
 */

import type { Engine, GameState, LoggedEntry, NewGameConfig } from "../kernel/types.js";
import { isLoggedAction, startingCampaignVersion } from "../kernel/log.js";

export interface PlaythroughFixture {
  name: string;
  /**
   * `seed` narrowed from `NewGameConfig`'s own optional field to required — a fixture
   * with no explicit seed is not reproducible (`createGame` falls back to
   * `IdSource.newSeed()`, random by default), so the type itself forbids constructing
   * one that way rather than leaving it to a doc comment nobody enforces.
   */
  config: NewGameConfig & { seed: string };
  /** Actions and content entries both replay (C21). A migration entry fails the fixture. */
  actionLog: LoggedEntry[];
}

/**
 * `createGame(config, starting version) → for each entry: an action → submitAction, a content
 * entry → adoptContent(state, entry.to), which must adopt → serialize` (04 §14's pseudocode).
 * `seq` on each entry is not consulted — the engine assigns it itself, sequentially, from the
 * state it's handed — so carrying it is what lets a fixture double as a literal
 * `GameState.actionLog` slice. The starting version is derived from the log (04 §2); a log
 * with no epoch entry starts on the engine's default epoch.
 *
 * Returns `serialize()` after `createGame` and after every entry, so a caller can compare two
 * runs entry by entry (C21), not only at the end.
 *
 * Throws on the first failure, naming the fixture and the failing step — a fixture is
 * authored to succeed end to end; a rejection, a refused adoption or a migration entry means
 * the fixture or the engine drifted, and a thrown error is more informative during
 * `vitest run` than a silently wrong final `serialize()`.
 */
export function traceFixture(engine: Engine, fixture: PlaythroughFixture): string[] {
  const trace: string[] = [];
  replayFixture(engine, fixture, (state) => trace.push(engine.serialize(state)));
  return trace;
}

/**
 * `traceFixture`'s last `serialize()` — the byte-identical comparison golden files make.
 * Serializes once, not per entry: a long-horizon fixture replays thousands of entries.
 */
export function runFixture(engine: Engine, fixture: PlaythroughFixture): string {
  return engine.serialize(replayFixture(engine, fixture));
}

function replayFixture(engine: Engine, fixture: PlaythroughFixture, visit?: (state: GameState) => void): GameState {
  // Runtime backstop, not just the type: a fixture built from untyped data (JSON, an
  // `as` cast) could still smuggle a missing seed past the compiler. `typeof !== "string"`
  // rather than an `undefined` check alone — `createGame` falls back to `IdSource.newSeed()`
  // via `config.seed ?? ids.newSeed()`, and `??` treats `null` as missing exactly the same
  // way `undefined` is, so a narrower check would still let a null seed through. Same
  // trust-but-verify pattern the rest of this codebase applies to content-controlled
  // input, even where a type already claims the shape is guaranteed.
  if (typeof fixture.config.seed !== "string") {
    throw new Error(`runFixture "${fixture.name}": config.seed is required for a reproducible fixture`);
  }

  const created = engine.createGame(fixture.config, startingCampaignVersion(fixture.actionLog));
  if (!created.ok || !created.value) {
    throw new Error(
      `runFixture "${fixture.name}": createGame rejected — ${created.errors[0]?.code ?? "unknown"}`,
    );
  }

  let state: GameState = created.value;
  visit?.(state);
  for (const logged of fixture.actionLog) {
    state = replayEntry(engine, fixture.name, state, logged);
    visit?.(state);
  }
  return state;
}

function replayEntry(engine: Engine, name: string, state: GameState, logged: LoggedEntry): GameState {
  if (isLoggedAction(logged)) {
    const result = engine.submitAction(state, logged.actionId, logged.params);
    if (!result.ok || !result.value) {
      throw new Error(
        `runFixture "${name}": submitAction("${logged.actionId}") rejected — ${result.errors[0]?.code ?? "unknown"}`,
      );
    }
    return result.value;
  }
  if (logged.system === "migration") {
    // Not a step replay can perform: the epoch it left is one the host could not run (04 §10.2).
    throw new Error(`runFixture "${name}": a migration entry at seq ${logged.seq} cannot be replayed`);
  }
  // A content entry records a move from the epoch the state is on; any other `from` means the
  // log and the replay disagree before the adoption even runs.
  if (logged.from !== state.campaignVersion) {
    throw new Error(
      `runFixture "${name}": content entry at seq ${logged.seq} moves from "${logged.from}", ` +
        `but the replay is on "${state.campaignVersion}"`,
    );
  }
  const adoption = engine.adoptContent(state, logged.to);
  if (!adoption.adopted) {
    throw new Error(`runFixture "${name}": adoptContent("${logged.to}") refused — ${adoption.reason}`);
  }
  return adoption.state;
}
