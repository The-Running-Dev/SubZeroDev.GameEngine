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
interface PlaythroughFixture {          // 04 §14, unchanged
  name: string;
  config: NewGameConfig;                // campaignId, campaignVersion, seed
  actionLog: LoggedAction[];            // { seq, actionId, params }
}
```

Every value in a fixture is an **id or a primitive**, and ids are *stable once published* —
a rename is a migration ([`04-core.md`](04-core.md) §17). Nothing in a fixture is engine
internals.

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
  readonly decisions: readonly Decision[];   // one per submitted action, in order
  readonly achievements: readonly string[];  // unlocked ids, sorted (04 §7.1)
}

interface Decision {
  readonly seq: number;
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
- Achievement ids are core-visible through the profile store, keyed
  `campaignId + achievementId` (04 §7.1), so they need no kind-specific access.
- `acceptedActions` is a count of log entries.

**Nothing here is kind-specific**, which is the point — the oracle works for `story-graph`
and `simulation` alike with no new `Kind` member and no per-kind maintenance.

> **What `decisions` catches, and why it is the valuable field.** It records, for every
> action a player actually submitted, whether the engine took it and why not if it did
> not. That is the direct expression of *does this game still play the same way*: a choice
> that used to be available and is now gated flips one `accepted` from true to false, and
> names the `ReasonCode` that did it. A final-state comparison would report only that the
> game ended somewhere different, several turns later, with no indication of where it
> diverged.

### 3.1 What Is Deliberately Not in `Outcome`

- **Variable values.** Kind-specific, and they change for legitimate reasons — a rebalance
  is not a regression. Including them would make the oracle cry wolf on every content edit.
- **`endingId`.** Kind-specific (03 §3). `finalStatus` captures *that* a game ended, which
  is kind-agnostic; *which* ending is a candidate for the extension in §9.
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

**A fixture records the engine version it was captured under.** Not to migrate it — §2
explains why that is unnecessary — but so a divergence report can say *which* versions
disagree.

---

## 5. Prerequisite: A Controllable `IdSource`

Cross-version replay requires `createGame` to be reproducible, and until
[`06-extensibility.md`](06-extensibility.md) §5.1 named the `IdSource` port it was not:
`gameId` came from nowhere specified and `seed` was "store-generated".

The runner supplies a **counting `IdSource`**, so `gameId` is fixed and any seed the
fixture omits is derived rather than random. Without it the oracle would have to exclude
game identity from comparison and could not replay creation at all — it would have to start
one action in, which is exactly where several interesting divergences live.

---

## 6. The Runner and Its Verdicts

```typescript
type ReplayVerdict =
  | { kind: "match" }
  | { kind: "diverged"; at: number; expected: Outcome; actual: Outcome }
  | { kind: "unrunnable"; reason: "campaign_withdrawn" | "campaign_version_missing" };
```

The runner creates a game from the fixture's `config` under a counting `IdSource`, submits
each `LoggedAction` in order, builds an `Outcome`, and compares.

**Three verdicts, deliberately, rather than pass/fail:**

- `match` — the game plays as recorded.
- `diverged` — it does not, and `at` is the first `seq` whose `Decision` differs, so the
  report points at the action that changed rather than at the end of the game.
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

- **On changes to `src/engine/src/core/` or `kinds/`** — the code that can alter a game.
- **On every release tag**, against the previous tag's corpus, which is the comparison the
  oracle is actually for.
- **Never as a merge gate on documentation-only changes**, which is most of this
  repository's traffic today.

---

## 9. Deferred

- **Session capture from a deployment** — the second half of the original idea. Turning a
  real hosted session into a fixture needs a capture path, retention rules, and a privacy
  review: an action log is a record of what a person did, and 05 §3.2 already establishes
  that the platform does not put player-supplied text into operational data by default.
  Deferred deliberately, and it shares only the runner with this document.
- **A kind-supplied `Outcome` extension** — `Kind.outcome(state): unknown`, mirroring
  `project` (04 §9), so `story-graph` could contribute `endingId` and `simulation` its own
  summary. Worth adding when a divergence is missed that it would have caught; not before,
  since every kind-specific field is a new source of false positives (§3.1).
- **Bisecting a divergence across versions** — given a `diverged` verdict, finding the
  commit that caused it. Ordinary `git bisect` over the replay command covers this without
  new engine work.
- **Cross-*kind* replay** — meaningless: a fixture names a campaign, and a campaign names
  exactly one kind (02 §1).
