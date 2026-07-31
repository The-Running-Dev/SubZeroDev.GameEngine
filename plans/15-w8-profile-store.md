# W8 — Profile Store

**Status:** Draft — implementing immediately after this document (user directive: "do next
milestone, open PR").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W8

**Scope:** `PlayerProfile`, `ProfileStore`, `profileId` on `CreateSessionConfig`, and the
post-action idempotent upsert (04 §7.1).

**Depends on:** W7 — done, merged (`plans/14-w7-session-store.md`).

## What's Actually Left to Build

`PlayerProfile`/`ProfileStore`/`AchievementRecord`/`ProfileWarning*` are already fully
typed (`session/types.ts`, W1 scaffold). `CreateSessionConfig.profileId` exists but W7's
store leaves it inert (its own header comment says so explicitly). Nothing consumes any of
it yet. This unit builds:

1. `createInMemoryProfileStore(...)` (`session/profile-store.ts`) — the concrete
   `ProfileStore`.
2. Three new base reason codes (`profile_missing`, `profile_corrupt`,
   `profile_write_failed`) in `kernel/reasons.ts`, so a `ProfileWarning` can be surfaced
   through `SessionActionResult.warnings` (`ValidationWarning[]`) without inventing a
   second warning shape.
3. Wiring inside `createInMemorySessionStore` (`session/store.ts`): accept an optional
   `profiles: ProfileStore`, remember `profileId` per session, and — after a successful
   `submitAction` whose `changes` include an achievement unlock — idempotently upsert into
   the profile.

## Decisions

### 1. The achievement-unlock `StateChange` convention is under-specified at the core level — and this unit has to pick one

04 §7.1 says a kind "emits an `achievement_unlocked` `StateChange`" and 03 §7 says the same
("unlock into `kindState` and emit an `achievement_unlocked` `StateChange` (04 §12). The
store does the rest."). Neither document pins the *shape* — `StateChange.reason` is a bare
`ReasonCode` (`type ReasonCode = string`), and nothing in `04-core.md` §12 reserves the
literal string `"achievement_unlocked"` the way `BASE_REASON_CODES` reserves e.g.
`unknown_campaign`. Without a fixed convention, a kind-agnostic session store cannot tell
"this `StateChange` is an achievement unlock" from any other domain-data change a kind
might record.

03 §6 already fixes `achieved.<id>` as a cross-kind condition-field name (listed beside
`var.*`, `turn`, `visited.*`, `ending` as the kind's frozen field namespace), and 03 §7
says achievements were "ported from the simulation kind" — i.e., the same mechanism is
meant to work identically for every kind that wants cross-session achievements, not just
`story-graph`. Reusing that already-fixed field name as the `StateChange.path` is the
natural, minimal-invention choice, paired with the literal reason `"achievement_unlocked"`
(matching the kind event name `kind.<kindId>.achievement.unlocked`, 03 §8.4's own naming).

**The convention this unit builds against:**

```typescript
{ path: `achieved.${achievementId}`, op: "set", value: true, reason: "achievement_unlocked", visible: true }
```

The session store detects it by testing `change.reason === "achievement_unlocked"` and
`change.path.startsWith("achieved.")`, stripping the prefix for `achievementId`.
`campaignId` doesn't need to travel in the `StateChange` at all — the store already has
`state.campaignId` from the envelope it just advanced.

**Recorded as a known-and-retained open item**, the same way W7's `SessionHost` gap was
(`plans/14-w7-session-store.md` Decision 1): this convention needs formal codification in
`04-core.md` §12 (or a dedicated subsection) once a real kind (W9–14's `story-graph`, or
the `simulation` kind later) actually emits one, so the two sides can be checked against
each other rather than trusted by inspection. Added to `TODO.md`'s Known Open Items.

### 2. `profile_missing` / `profile_corrupt` / `profile_write_failed` become base reason codes, not a second warning shape

`ProfileWarning { code: ProfileWarningCode; profileId: string }` (session/types.ts) and
`ValidationWarning { code: ReasonCode; messageKey: LocKey; path?: string }`
(validation/types.ts) are structurally close but not the same type, and
`SessionActionResult.warnings` is typed `ValidationWarning[]` — the only channel this
unit's public API has for surfacing a profile problem to a caller. Rather than widen
`SessionActionResult` (touching `session/types.ts`, itself a W1-owned surface this unit
has no mandate to reshape) or drop the information silently, a `ProfileWarning` is adapted
inline: `{ code, messageKey: `core.reason.${code}`, path: profileId }`. That only works if
`core.reason.profile_missing` etc. already resolve — so the three `ProfileWarningCode`
values join `BASE_REASON_CODES`, following the exact pattern the file's own history
comment describes for every prior addition (W3's three, W4's two, W5's three). A missing
message would fail to compile, per `CORE_REASON_TEXT`'s `Record<BaseReasonCode, string>`
literal — the same compiler-enforced completeness this file already relies on.

### 3. A profile is loaded and saved only around `submitAction` — never at `createSession`

03 §7 and 04 §7.1 are explicit: "nothing in resolution ever reads it," and "a profile read
can be shown never to affect resolution" is a literal TODO done-criterion. `SessionHandle`
(`createSession`'s return type) carries no warnings field at all, so there is nowhere to
report a `profile_missing`/`profile_corrupt` warning from session creation even if this
unit wanted to load there. Loading only happens when it's actually needed — inside a
successful `submitAction` whose `changes` contain at least one achievement unlock, right
before the idempotent merge-and-save. No load, no save, and no `ProfileStore` call at all
happens on a session with no `profileId`, satisfying "no `profileId` → no read, no write"
by construction rather than by an extra branch to remember.

**Provable "never affects resolution":** the loaded profile's *content* is used for exactly
one thing — deciding whether `{campaignId, achievementId}` is already present, to keep the
upsert idempotent — and that decision runs strictly *after* `decoratedEngine.submitAction`
has already returned its `result`. The loaded profile can't reach `advance`; there's no
code path between "profile loaded" and "engine invoked" for it to travel through, because
the engine call already happened. A test proves this by pre-seeding two different
profiles (one with a decoy achievement already present, one empty) for the same session
sequence and asserting the resulting `scene`/`GameState` is byte-identical regardless.

### 4. `createInMemoryProfileStore` stores raw, unvalidated entries — so "corrupt" is actually reachable

An in-memory store that only ever stores well-typed `PlayerProfile` objects it wrote
itself has no way to become "corrupt," making that done-criterion untestable as written.
`createInMemoryProfileStore` instead keeps its backing map typed `Map<string, unknown>` —
mirroring what a real backend (file, KV store) would hand back — and validates shape on
every `load()`, the same defensive-parsing discipline `kernel/engine.ts`'s
`isValidGameStateShape` already uses for `GameState`. `InMemoryProfileStoreOptions.raw`
lets a caller (a test) seed an entry directly, including a deliberately malformed one, to
exercise the `profile_corrupt` path without needing a second store implementation.

### 5. Write-failure simulation is an injectable hook, not a mode flag

"A write failure warns without rolling back the game action" needs some way to make
`save()` fail on demand. Rather than a `simulateFailure: boolean` toggled externally (which
couldn't target *which* save call fails), `InMemoryProfileStoreOptions.onSave?: (profile)
=> boolean` runs before the write; returning `false` reports `profile_write_failed` and
skips the write, returning `true` (the default when omitted) writes normally. A test can
fail exactly the one call it cares about by inspecting the profile passed in.

## Design

### New/changed files

| File | Change |
|---|---|
| `kernel/reasons.ts` | Add `profile_missing`, `profile_corrupt`, `profile_write_failed` to `BASE_REASON_CODES` + `CORE_REASON_TEXT`. |
| `kernel/reasons.test.ts` | Extend existing coverage for the three new codes/messages. |
| `session/profile-store.ts` **(new)** | `createInMemoryProfileStore(options?): ProfileStore`. |
| `session/profile-store.test.ts` **(new)** | Missing/corrupt load, save, write-failure coverage. |
| `session/store.ts` | Accept optional `profiles: ProfileStore`; track `profileId` per `SessionRecord`; detect + upsert achievement unlocks after a successful `submitAction`; update the file header (no longer says W8 is out of scope). |
| `session/store.test.ts` | Achievement upsert, cross-session persistence via the same `ProfileStore`, no-profileId inertness, "never affects resolution," warning surfacing. |
| `docs/docs/engine/TODO.md` | Add Decision 1's gap to Known Open Items. |

### `createInMemoryProfileStore` shape

```typescript
interface InMemoryProfileStoreOptions {
  raw?: Map<string, unknown>;                      // seeds the backing store, decision 4
  onSave?: (profile: PlayerProfile) => boolean;     // decision 5
}
```

`load(profileId)`: missing key → `profile_missing` warning, empty `formatVersion: 1`
profile. Present but shape-invalid (structural check, same style as
`isValidGameStateShape`) → `profile_corrupt` warning, empty profile. Valid → the stored
profile, no warnings.

`save(profile)`: `onSave?.(profile) ?? true` decides; `false` → `profile_write_failed`
warning, `ok: false`, no write; otherwise writes and returns `ok: true`.

### `session/store.ts` wiring

- `SessionRecord` gains `profileId?: string`, set from `config.profileId` in
  `createSession` and left untouched thereafter (matches `EngineHost`/`SessionHost`'s
  "supplied once, at construction" convention, 06 §4).
- In `submitAction`'s success branch, after computing `result`: if `record.profileId` and
  `options.profiles` are both present, scan `result.changes` for entries matching Decision
  1's convention. For each: `profiles.load(profileId)` → skip if
  `{campaignId: state.campaignId, achievementId}` already present → append and
  `profiles.save(...)` → adapt any `ProfileWarning`s (Decision 2) into
  `SessionActionResult.warnings`.
- No `profiles` option and/or no `profileId` → the scan still runs (cheap), but the
  load/save calls are skipped entirely — not merely no-opped inside the store, genuinely
  unreached.

### Test Plan

Against TODO's W8 done-criteria directly:

- [ ] An unlock survives a new session with the same `profileId`: submit an
      unlocking action on session 1 (`profileId: "p1"`), then read the *same*
      `ProfileStore` instance directly and see the record — proven independent of
      `SessionStore`, which exposes no profile-read method (Decision 3's note).
- [ ] No `profileId` on `CreateSessionConfig` → an unlocking action never calls `load` or
      `save` on a `profiles` spy.
- [ ] Missing profile loads empty with `profile_missing`; corrupt (seeded via
      `InMemoryProfileStoreOptions.raw`) loads empty with `profile_corrupt` — both via
      `profile-store.test.ts` directly, and once through `store.ts`'s warning
      surfacing.
- [ ] A write failure (`onSave` returns `false`) produces a `profile_write_failed`
      warning on `SessionActionResult`, and the triggering action's `ok`/`scene`/game
      state are unaffected — the action is not rolled back.
- [ ] The same achievement unlocked twice (two different sessions, same `profileId`, or a
      buggy kind re-emitting) upserts idempotently — one record, not two.
- [ ] Two different pre-seeded profiles (decoy achievement present vs. absent) for the same
      action sequence produce byte-identical `scene`/serialized state — Decision 3's
      never-affects-resolution proof.

### Explicit Non-Goals

- No real kind emits an achievement unlock yet — all achievement tests use a stub kind,
  the same pattern `engine.test.ts`/`store.test.ts` already use.
- No change to `session/types.ts` — `ProfileStore`, `PlayerProfile`, etc. are unchanged;
  only new consumers of the existing shapes.
- No client-facing "read my achievements" surface — `SessionStore` gains no new method;
  that's a later client concern if one ever needs it.
