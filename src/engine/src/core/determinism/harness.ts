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

import type { Engine, LoggedAction, NewGameConfig } from "../kernel/types.js";

export interface PlaythroughFixture {
  name: string;
  /**
   * `seed` narrowed from `NewGameConfig`'s own optional field to required — a fixture
   * with no explicit seed is not reproducible (`createGame` falls back to
   * `IdSource.newSeed()`, random by default), so the type itself forbids constructing
   * one that way rather than leaving it to a doc comment nobody enforces.
   */
  config: NewGameConfig & { seed: string };
  actionLog: LoggedAction[];
}

/**
 * `createGame(config) → for each logged action, submitAction → serialize final state`
 * (04 §14's own pseudocode, verbatim). `seq` on each `LoggedAction` is not consulted —
 * `submitAction` assigns it itself, sequentially, from the state it's handed — so a
 * fixture's own log only needs `actionId`/`params` to be meaningful; carrying `seq` too
 * is what lets a fixture double as a literal `GameState.actionLog` slice.
 *
 * Throws on the first rejection (`createGame` or any `submitAction`), naming the fixture
 * and the failing step — a fixture is authored to succeed end to end; a rejection means
 * the fixture or the engine drifted, and a thrown error is more informative during
 * `vitest run` than a silently wrong final `serialize()`.
 */
export function runFixture(engine: Engine, fixture: PlaythroughFixture): string {
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

  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) {
    throw new Error(
      `runFixture "${fixture.name}": createGame rejected — ${created.errors[0]?.code ?? "unknown"}`,
    );
  }

  let state = created.value;
  for (const logged of fixture.actionLog) {
    const result = engine.submitAction(state, logged.actionId, logged.params);
    if (!result.ok || !result.value) {
      throw new Error(
        `runFixture "${fixture.name}": submitAction("${logged.actionId}") rejected — ` +
          `${result.errors[0]?.code ?? "unknown"}`,
      );
    }
    state = result.value;
  }

  return engine.serialize(state);
}
