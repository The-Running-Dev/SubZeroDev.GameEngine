# W21 — Replay Oracle: Outcome and the Runner

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W21

**Scope:** The `Outcome`/`Decision`/`ReplayVerdict` types and the three-verdict runner,
proved against a synthetic kind first — the same core-owned, kind-agnostic split
`core/determinism/harness.ts` (W18) used.

**Depends on:** W20 (for `capturedUnder`).

## What This Unit Builds

`core/replay/types.ts` — `Submission`, `ReplayFixture`, `Decision`, `Outcome`,
`ReplayVerdict` (07-replay.md §2–§3, §6), narrowing `ReplayFixture.config.seed` to required
the same way `PlaythroughFixture` does.

`core/replay/runner.ts` — `buildReplayOutcome` (fixture → `Outcome` or `unrunnable`),
`findDivergence` (two `Outcome`s → the diverging index or `undefined`), and
`runReplayFixture` (composes both).

`core/replay/runner.test.ts` — mechanics tests against a synthetic `story-graph`-shaped kind
(counter/ending, one achievement path), mirroring `harness.test.ts`'s own pattern.

`session/store.ts`'s `upsertAchievements` gains an `export` — the one production change
this unit makes outside `core/replay/`.

## Decisions

### 1. Composed directly against `Engine`, not `createInMemorySessionStore`

The original plan (`plans/27-replay-oracle-programme.md`, before this unit was built)
assumed the runner would compose `createInMemorySessionStore`. Implementing it found that
doesn't work: `SessionStore`'s client-facing surface (`getScene`/`getView`/`submitAction`)
returns a `Scene`/`PlayerView` projection and never the raw `GameState` —
`Outcome.finalStatus` and `Outcome.terminal` (`kind.outcome(state.kindState)`) both need the
state itself. The runner ended up built the way `harness.ts`'s `runFixture` already is:
directly against `Engine`, driving `createGame`/`submitAction` and reading `GameState` off
the result. `07-replay.md` §3.2/§6 were amended to match after this was discovered — see
`plans/27`, Decision 2, for the full account of the reversal.

Achievements still go through the exact tested path `createInMemorySessionStore` uses
internally, not a second reimplementation: `upsertAchievements` was exported from
`session/store.ts` for this reason, called with a fixed `profileId` after every accepted
submission, with the final unlocked set read from the `ProfileStore` once at the end.

### 2. `at` is `submissions.length` when every `Decision` matches but the tail doesn't

07 §3.1/§6 says `at` is the index of the first differing `Decision` — but a change that
alters `finalStatus`, `achievements`, or `terminal` without changing whether any individual
submission was accepted has no `Decision` to blame. `findDivergence` reports
`expected.decisions.length` in that case — one past the last valid index — rather than
`undefined` (which would silently report `match` on a real regression) or `-1` (a value with
no obvious meaning as an array index). `canonicalStringify` (`core/persistence/canonical.ts`)
compares the tail fields, reused rather than a second deep-equal implementation, since it
already sorts keys deterministically — a naive `JSON.stringify` comparison is not safe
against key-order differences the way `canonicalStringify` already is.

### 3. A rejected submission does not stop replay — the loop always runs every submission

Directly implements 07 §6's own instruction. Unlike `harness.ts`'s `runFixture`, which
throws on the first rejection (a `PlaythroughFixture` is authored to succeed end to end),
`buildReplayOutcome` records a `Decision` for every submission regardless of outcome and
keeps going, because a later submission recovering is itself the signal 07 §6 says this
oracle exists to catch.

## Design

### New files

| File | Contents |
|---|---|
| `core/replay/types.ts` **(new)** | `Submission`, `ReplayFixture`, `Decision`, `Outcome`, `ReplayVerdict`. |
| `core/replay/runner.ts` **(new)** | `buildReplayOutcome`, `findDivergence`, `runReplayFixture`, `ReplayRunnerContext`. |
| `core/replay/runner.test.ts` **(new)** | Mechanics against a synthetic kind: match, diverged (mid-decision and tail-only), a rejected-then-accepted sequence, both `unrunnable` reasons. |

### Test Plan

- [x] All three verdicts (`match`/`diverged`/`unrunnable`) reachable and tested.
- [x] `at` is a `Decision.index`, never a `seq`.
- [x] A rejected submission records `seq: null` and a `reason`, and does not stop the replay
      — a later submission in the same fixture still gets recorded and can still succeed.
- [x] Achievements are read from an in-memory `ProfileStore` after the last submission.
- [x] `campaign_withdrawn` (campaignId absent) and `campaign_version_missing` (present, wrong
      version) are distinguished, checked before `createGame` is ever called.

### Explicit Non-Goals

- No real campaign, no real corpus — that's W22. This unit's own kind is synthetic, the same
  way `harness.test.ts` and `engine.test.ts` keep their mechanics tests independent of any
  real content.
- No CI wiring — W23.
