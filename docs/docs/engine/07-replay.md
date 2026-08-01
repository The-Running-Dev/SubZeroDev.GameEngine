---
sidebar_label: Replay
---

# Replay — The Regression Oracle

**Document status:** Revision 1 — new contract, post-MVP

**Reading order:** after [`04-core.md`](04-core.md) §14, which this extends. The
determinism harness answers *is the engine deterministic*; this answers *did a change alter
a game that already exists*.

> **Scope of this document**
>
> Replaying committed game data across **engine versions**, and comparing what came out.
> It defines the `Outcome` — what "the same game" means when the bytes are allowed to
> differ — the corpus, the runner, and how an intended change is distinguished from a
> regression.
>
> It does **not** cover capturing sessions from a running deployment. That is the second
> half of the idea and is deferred to §9, because it shares the runner and almost nothing
> else.

---

## 1. Why the Existing Harness Is Not This

The determinism harness ([`04-core.md`](04-core.md) §14) already replays
`{config, actionLog}` and asserts a byte-identical `serialize()`. It is the right tool for
the question it answers:

| Question | Tool | Compares |
|---|---|---|
| Is the engine deterministic? | Determinism harness (04 §14) | This build against **itself** |
| Did this change alter an existing game? | **This document** | This build against a **previous** build |

The distinction matters because the harness is *blind by design* to the thing a regression
oracle must catch. A change that alters every game identically — a new consequence
ordering, a corrected requirement evaluation — is perfectly deterministic. The harness
runs green. Every existing game now plays differently, and nothing said so.

Golden files narrow that gap and do not close it: a golden `serialize()` blob fails on any
change to the *serialization*, which is frequently intended, and so it cannot distinguish
"the format moved" from "the game changed."

---

## 2. Fixtures Are Inputs, Not State

The load-bearing property, and the reason this is tractable at all:

```typescript
interface ReplayFixture {
  readonly name: string;
  readonly config: NewGameConfig;         // campaignId, seed (04 §5)
  readonly campaignVersion: string;       // pinned here, not in NewGameConfig — below
  readonly capturedUnder: string;         // the engine version that recorded the outcome
  readonly submissions: readonly Submission[];   // every attempt, accepted or not — §2.1
}

interface Submission {
  readonly actionId: string;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
}
```

Every value is an **id or a primitive**, and ids are *stable once published* — a rename is a
migration ([`04-core.md`](04-core.md) §17). Nothing here is engine internals.

> **Why this is not `PlaythroughFixture` (04 §14).** Two fields that document needs and the
> determinism harness does not.
>
> `NewGameConfig` carries `campaignId`, `seed` and `audience` — **no `campaignVersion`**. The
> determinism harness does not need one: it runs against whatever the registry currently
> holds, and compares a build against itself in the same process. A cross-version oracle
> does need one, because "the same game" is only meaningful against a pinned content
> version, and because `unrunnable` (§6) has to be able to say *which* version went missing.
>
> `capturedUnder` exists for the same reason: a divergence report is not actionable without
> naming both engine versions that disagree. Neither field belongs on `NewGameConfig`, which
> is a *runtime* input — pinning them on the fixture keeps the core contract unchanged.
>
> **`capturedUnder` is `src/engine/package.json`'s own version** (W20 — Engine Versioning and
> Release Tags), read at the point a fixture is captured or regenerated. A fixture is always
> written with the version that recorded its outcome, never left blank or backfilled later.

### 2.1 Submissions, Not the Action Log

**A fixture records every submitted action, including rejected ones. The action log does
not.**

04 §4 is explicit that a rejected action leaves state unchanged and appends nothing to
`actionLog` — `seq` is the log's length, so the next attempt reuses it. That rule is correct
for replay determinism and it makes `actionLog` **unusable as a submission history**: the
rejections are simply not in it.

Reusing it here would have been self-defeating. §3 promises one `Decision` per submitted
action and §6 continues past a rejection specifically to see whether a later action
recovered — neither of which is possible from data that excludes rejections. So the fixture
carries its own `submissions` list, and `Decision[]` is exactly parallel to it.

The relationship to 04 §14 is then clean: filtering `submissions` to the accepted ones
reconstructs an `actionLog`, so a `ReplayFixture` can always produce a `PlaythroughFixture`,
but not the reverse.

Contrast the save path, which carries state and therefore carries the whole versioning
problem — `saveFormatVersion`, `serializationVersion`, `replayCompatible` (04 §10.2). A
migrated save is explicitly **not** replay-compatible, because its action log can no longer
be guaranteed to regenerate it.

> **So cross-version replay largely sidesteps migration.** A fixture from an older engine
> is still a valid *input* to a newer one, because the newer engine still knows what a
> campaign id and an action id are. This is the opposite of the save story and it is worth
> stating plainly, since the two are easily conflated: **replay old inputs, never old
> state.**
>
> The exception is real but narrow: a fixture whose campaign no longer exists, or whose
> `campaignVersion` has been withdrawn, cannot run at all. §6 treats that as a distinct
> result rather than a failure.

---

## 3. What "The Same Outcome" Means

Bytes cannot be the comparison, since serialization is allowed to change. So the oracle
compares an **`Outcome`** — a deliberately small projection built only from vocabulary the
platform has already promised to keep stable.

```typescript
interface Outcome {
  readonly finalStatus: GameStatus;          // active | ended | abandoned (04 §2)
  readonly acceptedActions: number;          // how far the log got before diverging
  readonly decisions: readonly Decision[];   // one per SUBMISSION, in order — §2.1
  readonly achievements: readonly string[];  // unlocked ids, sorted — §3.2
  readonly terminal?: unknown;               // the kind's terminal identity — §3.3
}

interface Decision {
  readonly index: number;                    // 0-based position in submissions — §3.1
  readonly seq: number | null;               // the accepted log position, null if rejected
  readonly actionId: string;
  readonly accepted: boolean;
  readonly reason?: ReasonCode;              // set iff rejected (04 §12)
}
```

**Every field is stable across versions by an existing decree, not by hope:**

- `GameStatus` is a closed three-value union (04 §2).
- **`ReasonCode`s are additive and never renamed** (04 §12) — saves and replay logs
  reference them, so a rename already breaks old data and is already forbidden. That makes
  them the ideal cross-version vocabulary: the platform guarantees their meaning survives
  exactly as long as this oracle needs it to.
- Achievement ids are stable published ids (04 §17), read as §3.2 describes.
- `acceptedActions` is a count of log entries.

### 3.1 `index`, Because `seq` Is Not Unique

A rejected action does not advance `seq` (04 §4), so two rejected submissions at the same
position share one. `seq` therefore cannot identify a submission, and a divergence reported
at a `seq` would be ambiguous exactly where rejections cluster — which is where this oracle
is most useful.

`index` is the 0-based position in `submissions` and is unique by construction. `seq` is
retained as `number | null` because it is still the useful cross-reference into the action
log and into the observability stream (05 §5), and `null` states outright that a rejected
submission has no log position rather than leaving a repeated number to be misread.

### 3.2 Where Achievements Come From

`unlockedAchievements` lives in `kindState`, which is `unknown` to the core (04 §2), so a
pure-engine runner **cannot read it**. The profile store can — it is keyed
`campaignId + achievementId` (04 §7.1) and is kind-agnostic — but only if there is a profile
at all, and an anonymous session has none.

**So the runner needs a `ProfileStore` alongside the engine — but not the full `SessionStore`
a real client uses.** `finalStatus` and `terminal` (§3.3) both need the raw `GameState` itself
(`state.status`, `state.kindState`), and `SessionStore`'s client-facing surface
(`createInMemorySessionStore`, `src/engine/src/core/session/store.ts`) never returns one — a
client holds a `sessionId` and receives only a `Scene`/`PlayerView` projection (04 §7, 09 §1),
by design. The runner is not a client, so it is built the same way
`core/determinism/harness.ts`'s `runFixture` is: directly against `Engine`, driving
`createGame`/`submitAction` itself and reading `GameState` off the result.

Achievements still go through the exact tested path `createInMemorySessionStore` uses
internally, not a second reimplementation: `session/store.ts` exports `upsertAchievements`
for this reason, and the runner calls it with a fixed `profileId` after every accepted
submission, then reads the unlocked set from the `ProfileStore` once, after the last one.

> **Not `createSessionLayer`/`SessionHost` (06 §4) either.** That composition root is
> specified but unbuilt — W7 built `createInMemorySessionStore` directly against
> `session/types.ts` instead, and nothing in this document needs the unbuilt generality. See
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2 for the open item and its "revisit when."

### 3.3 `terminal` — Terminal Identity, and Only That

`finalStatus` records *that* a game ended. It cannot record *which* ending, because
`endingId` lives in `kindState`. Without it, a change that routes the last action to a
different ending — same decisions, same counts, same status — compares **equal**, and the
oracle reports `match` on exactly the kind of regression it exists to catch.

So `Kind` gains one member, mirroring `project` (04 §9). **Built** — `04-core.md` §3 already
carries it, and every real kind assembly implements it:

```typescript
interface Kind<KState> {
  // …existing members (04 §3)…
  /** A minimal, cross-version-stable terminal identity. Ids only — never values. */
  outcome(state: KState): unknown;
}
```

**The constraint is what keeps it from becoming a false-positive generator.** A kind returns
*published ids* — `story-graph` returns `{ endingId }` (03 §8.5) — and never variable values, counts,
or anything a content rebalance legitimately changes. §3.4 stays the rule; `outcome` is the
narrow exception for terminal identity, not a door back to state comparison.

This was deferred in the first draft and the deferral was wrong: it traded a real, silent
miss for the avoidance of a hypothetical one.

**Nothing here is kind-specific**, which is the point — the oracle works for `story-graph`
and `simulation` alike with no new `Kind` member and no per-kind maintenance.

> **What `decisions` catches, and why it is the valuable field.** It records, for every
> action a player actually submitted, whether the engine took it and why not if it did
> not. That is the direct expression of *does this game still play the same way*: a choice
> that used to be available and is now gated flips one `accepted` from true to false, and
> names the `ReasonCode` that did it. A final-state comparison would report only that the
> game ended somewhere different, several turns later, with no indication of where it
> diverged.

### 3.4 What Is Deliberately Not in `Outcome`

- **Variable values.** Kind-specific, and they change for legitimate reasons — a rebalance
  is not a regression. Including them would make the oracle cry wolf on every content edit.
  This is the rule `terminal` (§3.3) is the single narrow exception to.
- **The event stream** ([`05-observability.md`](05-observability.md) §5). It is
  golden-fileable and it is a fine debugging aid, but event names are explicitly additive
  and retirable (05 §3.1), so the stream is *designed* to change. Comparing it would report
  intended additions as regressions.
- **`serialize()` bytes.** The whole reason this document exists (§1).

---

## 4. The Corpus

A committed set of fixtures, each with its recorded `Outcome`:

```text
fixtures/replay/
  bureaucracy-happy-path.fixture.json
  bureaucracy-happy-path.outcome.json     ← the oracle, reviewed like code
  bureaucracy-gate-blocked.fixture.json
  bureaucracy-gate-blocked.outcome.json
```

The outcome file is the artifact under review. A change to it is a **statement that the
game changed**, and it should read that way in a diff.

**Where fixtures come from**, in priority order:

1. **Confirmed bugs.** 05 §11 already establishes that a bug report *is* a
   `PlaythroughFixture`. Every fixed bug should leave one behind — the case that broke is
   the case most worth watching.
2. **Definition-of-Done paths.** Each MVP §5 playable box is a fixture: the arc completed,
   the loop traversed, the gate reached, the achievement unlocked.
3. **Deliberate edge cases.** A rejected action, an unknown action, a start that settles
   straight to an ending (04 §11, Tier 2 `no_reachable_choice`).

**A fixture records `capturedUnder` and `campaignVersion` (§2).** Not to migrate anything —
§2 explains why that is unnecessary — but so a divergence report can name which engine
versions disagree, and so `unrunnable` can distinguish a withdrawn campaign from a missing
version of one.

> **Plain JSON files, not vitest snapshots — a deliberate divergence from `04-core.md` §14.**
> The determinism harness's golden files are `toMatchSnapshot()`, and that choice was right
> there: a golden `serialize()` blob has no reviewable content of its own, so letting the
> tooling manage it costs nothing. An `Outcome` diff is the opposite — it is the artifact a
> human reads to decide *intended change* versus *regression* (§7), and `vitest -u` rewrites
> every snapshot in the suite in one keystroke. That is exactly the rubber-stamp failure mode
> §7 exists to prevent: regenerating must be a deliberate, reviewed, **single-fixture**
> operation, never a sweep. Plain committed JSON, regenerated one file at a time by a named
> script or manual edit, keeps that true structurally rather than by discipline.

---

## 5. Prerequisite: A Controllable `IdSource` {#prerequisite-a-controllable-idsource}

Cross-version replay requires `createGame` to be reproducible, and until
[`06-extensibility.md`](06-extensibility.md) §5.1 named the `IdSource` port it was not:
`gameId` came from nowhere specified and `seed` was "store-generated".

The runner supplies a **counting `IdSource`**, so `gameId` is fixed and any seed the
fixture omits is derived rather than random. Without it the oracle would have to exclude
game identity from comparison and could not replay creation at all — it would have to start
one action in, which is exactly where several interesting divergences live.

**Already built, as a test-local helper.** `createCountingIds()` exists in
`src/engine/src/mcp/server.test.ts`, with independent counters for `newGameId`/`newSeed` (fixed
in PR #72, addressing a review finding on PR #71). It is promoted to shared test support — so
the runner and every corpus test import one definition rather than each defining its own — as
part of building the corpus (§4).

---

## 6. The Runner and Its Verdicts

```typescript
type ReplayVerdict =
  | { kind: "match" }
  | { kind: "diverged"; at: number; capturedUnder: string;
      expected: Outcome; actual: Outcome }
  | { kind: "unrunnable"; reason: "campaign_withdrawn" | "campaign_version_missing" };
```

The runner resolves the fixture's `campaignVersion` in the registry, builds an `Engine` with
a counting `IdSource` and pairs it with an in-memory `ProfileStore` (§3.2), creates a game
from `config`, submits each `Submission` in order, builds an `Outcome`, and compares.

`at` is the **`index`** of the first differing `Decision`, not a `seq` — §3.1 explains why
`seq` cannot serve. `capturedUnder` comes from the fixture, so a divergence report names both
engine versions that disagree rather than only the one running.

**Three verdicts, deliberately, rather than pass/fail:**

- `match` — the game plays as recorded.
- `diverged` — it does not, and `at` is the `index` of the first differing `Decision` (§3.1),
  so the report points at the submission that changed rather than at the end of the game.
- `unrunnable` — the fixture's content is gone (§2). **Not a failure**, because a withdrawn
  campaign is a legitimate content decision, and reporting it as a regression would train
  the team to ignore the suite. It is reported and counted separately.

**A rejected action does not stop the replay.** The runner submits every logged action and
records each `Decision`, because the interesting signal is often that a *later* action
recovered or did not. Stopping at the first rejection would discard it.

---

## 7. Intended Change Versus Regression

The oracle cannot tell them apart, and should not try. It reports a divergence; a human
decides which it is.

The workflow makes the decision explicit and reviewable:

1. The suite reports a divergence with its `at` and both outcomes.
2. Either the change was unintended — fix the engine — or it was intended, and the
   committed `.outcome.json` is regenerated **in the same commit as the change that caused
   it**.
3. That regeneration is never automatic. A command that silently rewrites every outcome
   file turns the oracle into a rubber stamp, which is the failure mode this whole document
   exists to avoid.

> **The diff is the deliverable.** An outcome file changing from `accepted: true` to
> `accepted: false, reason: "requirement_unmet"` at `seq: 4` is a reviewable sentence: *the
> fourth choice in this arc is now gated.* That is the artifact worth having, and it is why
> `Outcome` is small — a large one produces diffs nobody reads.

---

## 8. Where This Runs

Not on every commit. The corpus grows without bound and most changes cannot affect it.

- **On changes to `src/engine/src/core/` or `src/engine/src/kinds/`** — the code that can
  alter a game ([Engine Package](/docs/guide/engine-package)).
- **On every release tag**, against the previous tag's corpus, which is the comparison the
  oracle is actually for. This needs a real versioning and tagging scheme first — W20, since
  today `src/engine/package.json` is `0.0.0` and the repository has no git tags at all.
- **Never as a merge gate on documentation-only changes**, which is most of this
  repository's traffic today.

**`.github/workflows/ci.yml` has no path filters yet** — it runs the full `engine` job (typecheck,
lint, test) on every `pull_request` and every `push` to `main`, documentation-only changes
included. Restricting it to `src/engine/src/core/` and `src/engine/src/kinds/` paths, and adding
the release-tag comparison job, is W23's job — this document specifies the trigger, not the
workflow YAML.

---

## 9. Deferred

- **Session capture from a deployment** — the second half of the original idea, now
  specified separately in [`08-session-capture.md`](08-session-capture.md). It produces
  exactly the `ReplayFixture` above and needs no new format; what it needed was a privacy
  contract, which is why it is its own document and is gated on the hosting layer rather
  than on anything here.
- **Widening `Kind.outcome` beyond terminal identity** — the member exists (§3.3) and is
  deliberately confined to published ids. Letting a kind contribute counts or values would
  make the oracle sensitive to content rebalancing, which §3.4 exists to prevent. Revisit
  only against a divergence that terminal identity provably missed.
- **Bisecting a divergence across versions** — given a `diverged` verdict, finding the
  commit that caused it. Ordinary `git bisect` over the replay command covers this without
  new engine work.
- **Cross-*kind* replay** — meaningless: a fixture names a campaign, and a campaign names
  exactly one kind (02 §1).
