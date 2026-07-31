# W6 — Projection

**Status:** Draft — implementing immediately after this document (user directive: "plan
and execute").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W6

**Scope:** `Engine.view`, the `player`/`ai` audiences, and the `kind.project` seam (04 §9).

## What's Actually Left to Build

Read `kernel/engine.ts` in full before planning this one, because the honest answer
changes the shape of the unit: **`Engine.view`, `kind.project`, and `ProjectionAudience`
are already built** — they shipped as part of W3 (`view()`, `availableActions()`, and
`scene()` all construct their return values by picking exactly `gameId`/`status`/
`kindView`/`body`/`actions`, never spreading `...state`, so `seed`/`actionLog`/raw
`kindState` structurally cannot leak through any of the three read paths). There is no
missing production code to write for the seam itself.

What genuinely doesn't exist yet: a **dedicated, black-box test suite** that proves the
two done-criteria as observable properties rather than relying on "the type doesn't have
that field" reasoning, plus two small, honest documentation fixes found while checking. W7
lists W6 as a dependency (`Depends on: W3a, W3, W6`), so this unit is what TODO's own
sequencing calls for next regardless of how much new code it turns out to need — and
writing the acceptance test now is exactly the kind of "prove it, don't assume it" this
project's other units already do (the determinism harness, the observability
sink-independence check).

### Two things found while verifying, fixed here

1. **A slightly wrong comment.** `scene()`'s bundled `view` is hardcoded to `"player"`
   with a comment claiming it "matches `NewGameConfig.audience`'s own default." It
   doesn't — nothing connects them; `scene()` picked `"player"` independently, and it's
   only a coincidence that 04 §5 also names `"player"` as `NewGameConfig.audience`'s
   default. Fixed to say what's actually true.
2. **`config.audience` is genuinely unused inside `createGame`, and that's correct, not a
   bug.** `GameState` carries no audience field (by design — one envelope must serve both
   the `player` and `ai` views, 04 §9), so there is nothing for the pure engine to *do*
   with `NewGameConfig.audience` at this layer. It's a session-layer concern: `NewGameConfig`
   is the base type both `Engine.createGame` and `CreateSessionConfig` (`session/types.ts`)
   share, and only the session store (W7) has anywhere to remember "this session defaults
   to the `ai` view" across repeated `getScene`/`getView` calls. Left as a one-line comment
   in `createGame` rather than silently leaving future readers to wonder why the field is
   never read.

## Decisions

### 1. "`ai` not wider than `player` by default" is a kind-authoring property, not a core invariant

The core cannot enforce this on an arbitrary `Kind.project` — it has no visibility into
what a kind's projection does with `audience`. What the core *can* guarantee, and what
this unit tests, is faithful pass-through: whatever `audience` a caller passes to
`Engine.view` reaches `kind.project` unchanged, never silently upgraded or ignored. The
"not wider by default" property itself is demonstrated with a well-behaved stub kind (one
that doesn't widen), documented as the behavior a real kind is expected to have unless it
deliberately opts into a wider `ai` view as a declared difficulty setting (04 §9's own
framing) — not something provable in the abstract against a kind that hasn't been written.

### 2. A dedicated test file, not another `describe` block in `engine.test.ts`

`kernel/engine.test.ts` is already large and covers the pure engine broadly.
`kernel/projection.test.ts` names the projection boundary as its own acceptance concern —
more discoverable, and it's the kind of property (data leak prevention) worth being able
to point at on its own.

## Design

### Black-box leak test: distinctive markers, not type reasoning

Build a `GameState` with a highly distinctive seed (e.g. `"MARKER-SEED-should-never-leak"`)
and a distinctive `actionLog` entry, using a stub kind whose `kindState` carries an extra
field its `project`/`scene`/`availableActions` deliberately omit (a `secret` field, the way
`03-story-graph-kind.md` will later have non-visible variables). `JSON.stringify` the output
of `view`, `scene`, and `availableActions` and assert the marker strings never appear
anywhere in it — proving the exclusion at the value level, not just the type level.

### Audience pass-through test

A stub kind's `project` records which `audience` it was called with (a captured array, not
a return-value trick — keeps the test about *pass-through*, not about what the projection
contains). Call `Engine.view(state, "player")` then `Engine.view(state, "ai")` and assert
each call recorded the audience actually requested, in order — proving the core never
substitutes or defaults the value itself.

## Test Plan

- [ ] `view`, `scene`, and `availableActions` on a state with a distinctive seed and
      distinctive `actionLog` entries never contain either in their JSON-serialized output.
- [ ] A `kindState` field a stub kind's own projection deliberately excludes never appears
      in `view`/`scene`'s JSON-serialized output either — the kind's own exclusion is
      exercised, not just assumed.
- [ ] `Engine.view` passes `"player"` and `"ai"` through to `kind.project` unchanged, in
      the order requested.
- [ ] A well-behaved stub kind (identical `player`/`ai` projections by default) produces
      the same `kindView` for both audiences — the default-non-widening case, made
      concrete.
- [ ] `scene()`'s bundled view and a direct `Engine.view(state, "player")` call agree
      (same `kindView`), confirming the inlined construction (plan 10's Qodo fix) didn't
      drift from `view`'s own behavior.

## Explicit Non-Goals

- No change to any `types.ts` file, `Engine`'s public interface, or `KindContext`.
- No enforcement mechanism for "`ai` not wider than `player`" — Decision 1 explains why
  none is possible at this layer.
- No session-layer consumption of `NewGameConfig.audience` — that's W7's.
