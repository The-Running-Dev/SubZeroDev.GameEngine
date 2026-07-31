# W13 — Endings and Achievements

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W13

**Scope:** Ending resolution, achievement evaluation after every turn, unlock-once into
`kindState` plus an `achievement_unlocked` `StateChange` (03 §7, §8.2).

**Depends on:** W8, W11 — both done, merged.

## What's Actually Left to Build

"Ending resolution" doesn't need new code — W11's `settle` already sets `state.endingId`
on landing on an `EndingNode`, and W10's `resolveField` already serves `ending` as a
condition field. What's missing is the piece that makes those two facts useful:
`AchievementDefinition` (03 §7) doesn't exist yet — `StoryGraphCampaign.achievements` has
been a `readonly unknown[]` placeholder since W11 (plan 18, Decision 4) — and nothing
evaluates achievement conditions or unlocks anything. "Ending resolution" in this unit's
scope line means *achievement conditions can react to the ending the same turn it
happens*, which falls out of running evaluation after settle, not a separate deliverable.

W8 already built the session-store half — `session/store.ts`'s `achievementIdFrom`
already pattern-matches `change.reason === "achievement_unlocked"` and
`change.path.startsWith("achieved.")`, upserting into `ProfileStore` after a successful
action. This unit is the first thing that actually emits one.

## Decisions

### 1. Achievement evaluation runs once, after `settle`, inside `advance` — not `initialState`

03 §8.2's pseudocode places achievement evaluation at step 7, strictly inside
`submitChoice` — after settle (step 6), before returning (step 8).
`createGame`/`initialState` (04 §4) never mentions it. The MVP's own achievement
("It Builds Character") can only become true via a `reward` node's effect reached deep in
the graph, never at a start state, so nothing forces the question either way — but the
spec's own pseudocode placement is unambiguous, and evaluating at `initialState` too would
mean a hand-authored, already-conditions-met starting state could unlock an achievement
before the player has done anything. Scoped to `advance` only, matching the pseudocode.

### 2. Same-turn cross-achievement dependencies resolve in authored array order

03 §6 lists `achieved.<id>` as a legal condition field — nothing stops one achievement's
`condition` from checking whether *another* achievement already unlocked. If both become
satisfiable on the same turn, does the second see the first's fresh unlock? No spec text
addresses it. `evaluateAchievements` rebuilds the condition context after each check
(threading the growing `unlockedAchievements` list through), rather than once up front —
so achievements *can* see each other's same-turn unlocks, resolved deterministically in
`content.achievements`' authored order. This costs nothing extra and is strictly more
capable than the alternative (evaluating all conditions against the pre-turn snapshot),
which would silently drop an achievement chain a campaign author might reasonably expect
to fire together.

### 3. `unlockedAchievements` in the projection is *not* filtered by `hidden` — 03 §7 and §9 read in tension, §7 wins

03 §9's `StoryGraphView.unlockedAchievements` field comment says "non-hidden, unlocked."
Read literally, a *hidden* achievement would never appear even after unlocking — but 03
§7 defines `hidden` as "if true, **not listed until unlocked**," which only makes sense if
unlocking is exactly what makes it listed. The two can't both be right as written. §7 is
the section that defines `hidden`'s semantics in full prose across several sentences; §9's
comment is three words attached to a field that was typed before `AchievementDefinition`
existed (W12 built `StoryGraphView` against the `readonly unknown[]` placeholder, with no
`hidden` to filter on yet — plan 19, Decision 5). Resolved in §7's favor:
`unlockedAchievements` passes through every unlocked id, hidden or not — a hidden
achievement becomes visible in the projection at exactly the moment it's unlocked, which
is the reward 03 §7 describes. `view.ts`'s W12-era comment (which deferred this
question because the type didn't exist) is updated to state the resolution, not the
deferral. Recorded in `TODO.md`'s Known Open Items as a spec-internal tension worth a doc
pass, not silently smoothed over.

### 4. `StateChange` shape matches W8's session-store detection exactly, not just its Known Open Item's prose

`{ path: "achieved.<id>", op: "set", value: true, reason: "achievement_unlocked", visible:
true }` — the first four fields were already fixed by W8's own convention (`TODO.md` Known
Open Item, `session/store.ts`'s `achievementIdFrom`, which only actually inspects `reason`
and `path`). `visible: true` is this unit's own call: an achievement unlock is a
celebratory, player-facing moment regardless of the achievement's `hidden` flag — `hidden`
gates *pre-unlock listing* (Decision 3), not whether the unlock event itself is shown.

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/achievements.ts` **(new)** | `AchievementDefinition` (03 §7); `evaluateAchievements(achievements, state)`. |
| `kinds/story-graph/achievements.test.ts` **(new)** | Coverage below. |

### Changed files

| File | Change |
|---|---|
| `kinds/story-graph/campaign.ts` | `achievements: readonly unknown[]` → `AchievementDefinition[]` — the placeholder this unit exists to resolve. |
| `kinds/story-graph/advance.ts` | After `settle`, run `evaluateAchievements`; fold its `unlockedAchievements` into the returned state and its `changes` into `AdvanceResult.changes`. |
| `kinds/story-graph/view.ts` | Doc comment only — states Decision 3's resolution instead of deferring it. |
| `docs/docs/engine/TODO.md` | Records Decision 3's 03 §7/§9 tension as a new Known Open Item. |

### `evaluateAchievements`

```typescript
export function evaluateAchievements(
  achievements: readonly AchievementDefinition[],
  state: StoryGraphKindState,
): { unlockedAchievements: string[]; changes: StateChange[] }
```

Pure — no I/O, matching the done-criterion verbatim. For each achievement not already in
`state.unlockedAchievements`, evaluates `condition` against a context built from the
*current* (possibly already-updated-this-call) unlocked list (Decision 2); on success,
appends the id and a `StateChange` (Decision 4).

### Test Plan

Against TODO's W13 done-criteria directly:

- [ ] An achievement fires exactly once: satisfied on turn N, still satisfied on turn N+1
      (condition remains true) — no second `StateChange`, `unlockedAchievements` has no
      duplicate.
- [ ] Once unlocked, `achieved.<id>` reads `true` in a later condition (an `evaluateStoryGraphCondition`
      call against the post-unlock state) — proving the "readable in a later condition"
      claim directly, not just that the id landed in an array.
- [ ] `evaluateAchievements` performs no I/O by construction (pure function, no `ctx`
      parameter — a structural guarantee, not a runtime-checked one).
- [ ] The emitted `StateChange` matches
      `{ path: "achieved.<id>", op: "set", value: true, reason: "achievement_unlocked", visible: true }`
      exactly.
- [ ] Two achievements satisfied on the same turn both unlock, in `content.achievements`
      order, each with its own `StateChange`.
- [ ] An achievement whose condition depends on another achievement's `achieved.<id>`
      unlocks on the same turn the dependency does (Decision 2, proven directly).
- [ ] An achievement condition referencing `ending` fires on the same turn `settle` lands
      on the matching ending — proving "ending resolution" is actually exercised, not
      just structurally possible.
- [ ] `advance`'s final `changes` includes achievement `StateChange`s alongside the
      choice's own and settle's pass-through changes, in that order.
- [ ] One integration test through `createEngine`/`submitAction`, extending W12's stub
      `Kind`, proving an achievement unlock survives the real engine seam end to end.

### Explicit Non-Goals

- No `ProfileStore`/cross-session persistence work — W8 already built the consuming side;
  this unit only has to produce a `StateChange` in the shape it expects.
- No achievement listing/catalog surface (browsing not-yet-unlocked, non-hidden
  achievements with their `nameKey`/`descriptionKey`) — nothing in `Kind`'s interface or
  `StoryGraphView` exposes achievement definitions at all; a client-facing concern for
  whichever later unit needs it (not named by any current `TODO.md` unit).
- No achievement evaluation at `initialState` — Decision 1.
- No `Kind.outcome` — still not asked for by any unit's done-criteria (W11/W12 both
  deferred it for the same reason); this unit's "ending resolution" is achievement-facing,
  not the replay-oracle terminal identity (03 §8.5).
