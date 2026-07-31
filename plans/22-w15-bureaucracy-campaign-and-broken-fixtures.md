# W15 — The Bureaucracy Campaign and Broken Fixtures

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W15

**Scope:** Author 03 §12 in the W4 source form with all its strings, plus four
deliberately broken copies: dangling node, undeclared variable, unreachable node,
settlement cycle.

**Depends on:** W4, W14 — both done, merged.

## What's Actually Left to Build

W15's own scope line says "the W4 source form" as if it already exists. It doesn't.
W4 built the **generic** half — `buildCampaign(campaign, authoredText[])` merges an
already-extracted `AuthoredText[]` into a string table (`registry/build.ts`) — but 03
§1's own text says the kind-specific half is separate: "Authors write
`StoryGraphCampaignSource`, whose player-facing fields are `AuthoredText`; a pure builder
lifts the strings out and produces [the runtime form] plus a string table." *Walking a
kind-specific source to find embedded `AuthoredText` is that kind's job* — CLAUDE.md's
own words for `buildCampaign`'s design — and nothing has built story-graph's version of
that job yet. This unit is the first thing that actually needs it, so it builds it.

No formal `StoryGraphCampaignSource` TypeScript shape appears anywhere in the docs — 03
§12's own worked example is written with bare `textKey`/`labelKey` fields and a trailing
comment showing what the text *would* say, which is a spec-doc readability shorthand, not
a literal authoring format (a real author needs a field that carries the actual string,
not a comment). This unit designs the shape.

## Decisions

### 1. `StoryGraphCampaignSource` mirrors the runtime shape, `AuthoredText` in place of every `LocKey`

Every `kinds/story-graph/*.ts` type that carries a `LocKey` — `VariableDecl.labelKey`,
`NodeBase.textKey`, `Choice.labelKey`/`requirementFailKey`, `AchievementDefinition.nameKey`/
`descriptionKey`, `StoryGraphCampaign.descriptionKey` — gets a source-form sibling type
with that one field replaced by `AuthoredText` (`{ key: LocKey; text: string }`,
`registry/types.ts`, W4). Everything else (`Condition`, `Consequence`, ids, `goto`,
weights, `hidden`) is identical in both forms — those were never localized to begin with.

`buildStoryGraphCampaign(source): { content: StoryGraphCampaign; authoredText:
AuthoredText[] }` is the mechanical "lift": walk the source tree once, collecting every
`AuthoredText` into a flat array while replacing it with its own `key` in the returned
runtime `content`. Pure, no validation performed here — Tier 1 (W14) still owns checking
the *result* makes sense; this only owns the mechanical shape translation. The output
feeds `buildCampaign(campaign, authoredText)` (W4) exactly as any other kind's builder
would.

Lives in `kinds/story-graph/source.ts` — engine-owned code (the extraction mechanism),
not content, so it belongs beside `nodes.ts`/`campaign.ts`, not with the campaign data
itself.

### 2. The campaign *content* lives in a new `campaigns/` tree, not inside `kinds/`

CLAUDE.md's own model is **core → kinds → campaigns**: `kinds` is "game-*type* logic,
engine-owned code," `campaigns` is "content, data" — a third, separate layer this repo's
`src/engine/src/` has never needed until now (W0–W14 built engine machinery only, no
actual campaign). The Bureaucracy arc — and its four broken siblings — are content, not
mechanism, so they open `src/engine/src/campaigns/`, a new top-level sibling to `core/`
and `kinds/`, matching the architecture doc's own vocabulary rather than filing content
under the kind that merely knows how to run it.

### 3. Real narrative text, not placeholders — sourced from `games/bulgaria.md`

The companion `SubZeroDev.GameOfLife` repo (available locally) has the actual Bureaucracy
scenes this arc dramatizes: "Municipality," "Government Office," "Bureaucracy" (Room 14/
Room 6), and "Ultimate Bulgarian Reward" — `games/bulgaria.md`, cited directly by this
unit's own spec line. Node text is adapted from those scenes rather than invented, so the
authored content is the real MVP deliverable `bulgaria-adventure.md` describes ("the
simplest game to build... the vehicle for the MVP"), not a synthetic stand-in nobody
would ship.

### 4. The four broken fixtures are mutations of the *same* campaign, not four new toy examples

TODO's own phrasing — "four deliberately broken **copies**" — and the done-criterion
("each broken fixture produces its expected tier and path") both point at testing the
real campaign with one thing wrong, not four independent minimal reproductions. Each
fixture takes the valid `StoryGraphCampaignSource`, breaks exactly one thing, and asserts
`validateCampaign` reports the exact expected code/tier/path — proving the validator
(W14) against real, full-sized content instead of only the synthetic fixtures its own
unit tests already used.

- **Dangling node** — `expired`'s `question_reality` choice's `goto` retargeted to a
  nonexistent node id. Tier 1, `dangling_reference`.
- **Undeclared variable** — `room_14`'s effect rewritten to write an undeclared variable.
  Tier 1, `undeclared_variable`.
- **Unreachable node** — an extra node added with no incoming edge from anywhere
  reachable. Tier 2, `unreachable_node`, load succeeds with a warning.
- **Settlement cycle** — `room_14`/`room_6`'s loop rewired so neither ever reaches
  `reward`/`ending_character` — an auto/random cycle with no exit. Tier 2,
  `unreachable_cycle`, load succeeds with a warning (settle would trip its own guard if
  ever actually played, which this fixture doesn't attempt — Tier 2 catches it first).

### 5. The seeded clerk-transition test uses a hand-found seed, not a random one

`clerk_review`'s weights (3 `expired` : 1 `room_14`) mean most seeds route through
`expired`, not the `room_14`/`room_6` loop the "reaches its `office_visits >= 3` gate"
done-criterion specifically needs exercised. A short throwaway scan against the real
`rngHandleFor`/`weightedPick` (not committed) found `"scan-seed-3"` lands on `room_14` on
the very first draw — used as the fixed seed for that playthrough test, and reused
verbatim in the reproducibility test (two independent `createGame` calls, same seed, same
pick).

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/source.ts` **(new)** | `StoryGraphCampaignSource` and its per-type siblings; `buildStoryGraphCampaign`. |
| `campaigns/bulgaria-bureaucracy.ts` **(new)** | The valid campaign, in source form. |
| `campaigns/bulgaria-bureaucracy.broken.ts` **(new)** | The four broken variants, each a small mutation of the valid source. |
| `campaigns/bulgaria-bureaucracy.test.ts` **(new)** | Coverage below. |

`source.ts` gets no direct `.test.ts` — `buildStoryGraphCampaign` is exercised
end-to-end by every test in `bulgaria-bureaucracy.test.ts` (it's the only caller, and
there's no meaningful behavior to test in isolation from real content).

### Test Plan

Against TODO's W15 done-criteria directly:

- [ ] The valid campaign, built and validated through the real pipeline
      (`buildStoryGraphCampaign` → `buildCampaign` → `buildValidatedContentRegistry`),
      loads with zero Tier 1 errors.
- [ ] Every authored string resolves through the registry — the built `strings` map has
      an entry for every `LocKey` the content references (no gaps).
- [ ] A playthrough (fixed seed `"scan-seed-3"`, `wait` at `municipality`, `room_14` at
      `clerk_review`, `continue_cycle` at `room_6` twice) reaches `office_visits >= 3`
      and `go_home` becomes available/succeeds — the loop's gate is actually exercised,
      not just present in content.
- [ ] The same seed reproduces the same `clerk_review` pick across two independent
      `createGame` calls.
- [ ] Playing to `reward`/`ending_character` unlocks `it_builds_character` and reaches
      `status: "ended"`.
- [ ] Each of the four broken fixtures, run through `validateCampaign`, produces exactly
      its expected code, tier (error vs. warning), and path — Tier 1 fixtures also
      confirm `ok: false`; Tier 2 fixtures confirm `ok: true` (load succeeds) with the
      warning present.

### Explicit Non-Goals

- No other arc (Inheritance, Enterprise, Driving, Return) — `MVP.md` §3 scopes the MVP to
  Bureaucracy only; the others follow once this is proven, matching
  `bulgaria-adventure.md`'s own sequencing.
- No file-based content loading/parsing — `04-core.md` §10.1 keeps that in an outer
  adapter that doesn't exist yet; this campaign is authored as a TypeScript source-form
  object literal, imported directly, the same way every test fixture in this codebase
  already is.
- No changes to `validateCampaign`, `buildCampaign`, or any engine mechanism — this unit
  is content plus the one missing extraction step, not new engine behavior.
