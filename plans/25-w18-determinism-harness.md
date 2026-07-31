# W18 — Determinism Harness

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W18

**Scope:** The `PlaythroughFixture` runner, committed golden files, property tests, and
the sink-independence pass.

**Depends on:** W3a (observability), W15 (the real Bureaucracy campaign) — both done.

## What This Unit Builds

04 §14 names the shape exactly:

```typescript
interface PlaythroughFixture {
  name: string;
  config: NewGameConfig;         // includes a fixed seed
  actionLog: LoggedAction[];
}
// runner: createGame(config) → for each logged action, submitAction → serialize final state
```

This is the **acceptance test with teeth** (MVP §5) — everything the pieces built across
W1–W17 were supposed to add up to. Nothing here is new engine behavior; it's the harness
that proves the existing behavior actually holds.

## Decisions

### 1. The runner is core-owned and kind-agnostic; the real fixtures live beside the campaign that owns them

`runFixture` only needs an already-built `Engine` and a `PlaythroughFixture` — it never
touches a kind or a campaign directly, so it belongs in `core/determinism/` next to
`pcg32.ts`/`rng.ts`, and its own test (`harness.test.ts`) proves its mechanics (the
`createGame → submitAction* → serialize` chain, error propagation on a bad fixture) against
a synthetic in-file kind, the same pattern `core/kernel/engine.test.ts` already uses —
keeping it clean of the core-must-not-import-`kinds/` rule.

The **real** golden-file suite — fixtures against the actual Bureaucracy campaign (W15) —
lives beside it: `campaigns/bulgaria-bureaucracy.determinism.test.ts`, which builds the
real registry/kind exactly as `bulgaria-bureaucracy.test.ts` already does, then drives it
through the generic runner. This is what actually satisfies "the identical arc" language
MVP.md §5 uses — a synthetic fixture couldn't.

### 2. Golden files are vitest snapshots, not a hand-rolled comparison

04 §14 asks for "committed fixtures with expected `serialize()` output; a one-byte diff
catches an unintended behaviour change." Vitest's `toMatchSnapshot()` *is* exactly this —
a committed `.snap` file, byte-exact comparison, already part of the toolchain (vitest is
already a devDependency; nothing new to add, so the zero-runtime-dependency rule is
untouched). Hand-rolling a second golden-file mechanism next to a testing framework that
already has one would be pure duplication.

The fixture **definitions** (config, seed, action log) are still fully explicit,
hand-authored TypeScript in the test file — only the *expected output* is
snapshot-managed. A reviewer sees exactly what a fixture does; the `.snap` file is the
part that's mechanically generated and diffed, same as any snapshot test anywhere.

### 3. "A one-byte edit fails the suite" is proven by construction, not by a subprocess

Actually spawning `vitest run` against a deliberately-corrupted snapshot file and
asserting a red exit code would be a heavier, stranger pattern than anything else in this
codebase (no existing test spawns the runner on itself). `toMatchSnapshot()`'s
byte-exact-comparison semantics are vitest's own well-established, independently-tested
behavior — not something this unit needs to re-prove from scratch. What *is* this unit's
job: make the underlying comparison's sensitivity visible in the suite itself. A direct
unit test asserts two canonical-serialize outputs differing by exactly one character are
`not.toBe` equal, pinning the byte-level sensitivity property the snapshot tests rely on.

### 4. Property tests use a fixed set of seed strings, not genuine per-run randomness

"N random seeds, each run twice, outputs compared" doesn't require the seeds themselves
to be unpredictable — only that running the *same* seed twice produces the same output.
A fixed array of arbitrary seed strings keeps a CI failure reproducible (the same seed
fails the same way on every run) rather than flaky-looking. Tests are exempt from the
determinism guard (`eslint.config.js`), so `crypto.randomUUID()` would be legal here too,
but it buys nothing this unit needs and costs reproducibility.

### 5. "No DOM, network, or AI adapter installed" holds by construction, not by a canary test

No `vitest.config.ts` exists, so vitest's environment defaults to `node` (never `jsdom`);
`package.json` has zero runtime dependencies and no DOM/HTTP/AI devDependency either. A
test asserting `typeof window === "undefined"` would be asserting something already
structurally impossible to violate — the absence of a dependency is the proof, not a
runtime check.

### 6. Real fixtures cover the full arc and the loop gate — the two MVP.md §5 "Playable" boxes W18 is the proof for

Two fixtures against the real campaign: one drives `wait → continue_cycle ×2 → go_home`
to the ending (reusing W15's seed, `bureaucracy-seed-3`, since it's the one seed already
proven to route through the `room_14`/`room_6` loop) — exercising the achievement unlock
and the `office_visits >= 3` gate in the same fixture. A second, shorter fixture (`wait`
into the `expired` retry branch, an ordinary un-seeded-for-branch run) covers a
non-terminal mid-arc state, so the golden suite isn't only ever snapshotting endings.

## Design

### New files

| File | Contents |
|---|---|
| `core/determinism/harness.ts` **(new)** | `PlaythroughFixture`, `runFixture(engine, fixture)`. |
| `core/determinism/harness.test.ts` **(new)** | Runner mechanics against a synthetic kind: happy path, a failing action surfaces its error, `deserialize(serialize(state))` round-trips. |
| `campaigns/bulgaria-bureaucracy.determinism.test.ts` **(new)** | The real golden-file suite: two fixtures, golden `serialize()` snapshots, golden event-stream snapshots, sink independence, stream reproducibility, the property test, the byte-sensitivity unit check. |

### Test Plan

Against 04 §14, 05 §12, and TODO's W18 done-when, directly:

- [ ] The same seed + action log serializes byte-identically (golden snapshot, both real
      fixtures).
- [ ] A one-byte difference is detectable — a direct unit check on canonical output,
      pinning the sensitivity `toMatchSnapshot()` itself relies on.
- [ ] N fixed seeds, each run twice through `runFixture`, produce identical output.
- [ ] `deserialize(serialize(state))` round-trips to a deep-equal `GameState`.
- [ ] Both real fixtures replay byte-identically under `nullEmitter` and
      `recordingEmitter`.
- [ ] The event stream is itself golden-filed (a second snapshot), and reproduces
      identically across two `recordingEmitter` runs of the same fixture, `gameId`
      normalized out of the comparison (05 §5, matching `engine.test.ts`'s own precedent).
- [ ] The suite runs in plain Node — true by construction (Decision 5), recorded as a
      design note rather than a runtime assertion.

### Explicit Non-Goals

- No replay-across-engine-versions comparison — that's `07-replay.md`, explicitly out of
  scope for this unit (04 §14's own callout: "this harness compares a build against
  itself").
- No changes to the engine, a kind, or the session store — this unit is proof, not new
  behavior.
