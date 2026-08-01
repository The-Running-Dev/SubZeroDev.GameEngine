# W26 — Toolchain Upgrade

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Known Open Items Carried
In*, the dev-dependency advisories entry.

**Scope:** Take the deferred major-version bumps of `vitest` and `eslint` (and whatever
`typescript-eslint` needs to match), clearing the outstanding `npm audit` advisories, and use
the determinism harness and replay corpus as the acceptance test that behaviour did not move.

**Depends on:** **W18** (determinism harness) and **W22** (replay corpus) — both done. These
are the entry's own stated precondition, and it is now met twice over.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md), Tranche A.
Independent of W24/W25 — runnable in any order relative to them.

---

## Why This Is Now Actionable, and Why It Is Interesting

TODO.md deferred this deliberately, with a precise condition:

> **Deferred deliberately**; revisit as a single toolchain upgrade once the determinism harness
> (W18) can prove the upgrade changed no behaviour.

W18 landed in PR #70. W20–W23 then added a *second*, stronger instrument the entry did not
anticipate: the replay oracle compares an `Outcome` built from cross-version-stable vocabulary
against committed JSON, per-fixture, reviewable as a diff. The stated gate is satisfied.

What makes this more than routine maintenance is the direction of proof. The usual major-bump
question — "did anything break?" — is answered by a test suite that is *itself* running on the
new tooling, which is partly circular. Here it is not: the determinism golden file and the
replay corpus are **committed artifacts**, byte-fixed, produced by the old toolchain and
reviewed as content. If `vitest` 4 changes how the engine behaves in any observable way, the
corpus diff says so in terms of `GameStatus`, `ReasonCode` and achievement ids — vocabulary
that has nothing to do with the test runner.

This is the first occasion the W18 and W20–W23 investment is *used* rather than merely
standing by, which is why [`plans/33`](33-post-mvp-programme.md) makes it milestone M5.

> **One precondition is not free.** The cross-version half of that claim needs a
> corpus-bearing baseline tag, and none exists — `v0.1.0` predates the corpus entirely.
> Decision 4 resolves it; the claim is unsupported without that step.

---

## Current State (measured, not recalled)

```
vitest             2.1.9   →  4.x        (two majors)
eslint             9.39.5  →  10.x       (one major)
typescript-eslint  8.65.0  →  as required by eslint 10
typescript         5.9.3   →  unchanged unless forced
```

- **`npm audit`: 6 vulnerabilities (3 moderate, 2 high, 1 critical).** TODO.md records 10
  (3 moderate, 6 high, 1 critical) — stale; several transitive advisories resolved upstream on
  their own. Correcting that number is part of W24's stale-entry pass, noted here so the two
  units do not both edit it.
- **Every advisory is in `devDependencies`.** The package has **no runtime dependencies**, so
  nothing ships with them.
- **The critical one is not reachable here.** It is `@vitest/mocker` via `vite`, and requires
  the **Vitest UI server**, which this project never starts — `npm test` is `vitest run`. The
  severity is real; the exposure is not. Worth restating in the PR so the bump is not
  mis-sold as an urgent security fix.
- **Baseline to preserve:** 39 test files, 445 tests, all passing.
- **No `vitest.config.*` or `vite.config.*` exists.** The suite runs on defaults — less to
  migrate, but also no place to pin behaviour if a default changes.
- **One snapshot file** — `src/campaigns/__snapshots__/bulgaria-bureaucracy.determinism.test.ts.snap`
  (the W18 event-stream golden).
- **`eslint.config.js` is already flat config**, which is the format eslint 10 wants.

---

## The Upgrade Surface

Three things could genuinely move. Listed as things to **verify**, not as known breakage — the
specific breaking-change lists for these majors must be read at the time rather than recalled.

### 1. The determinism guard (`eslint.config.js`)

This is the highest-value thing in the repository to not silently break. It bans `Math.random`,
the non-bit-stable `Math.*` functions, and `Date.now` in `src/`, and it enforces the 04 §1.1
dependency arrow and the 09 §2 client contract. It uses four core ESLint rules:
`no-restricted-properties`, `no-restricted-globals`, `no-restricted-imports`, plus
`tseslint.configs.recommended`.

**A rule that a major version quietly stops applying is a guard that stops guarding, with a
green build.** The verification for this is not "lint passes" — it is a **deliberate red-path
proof**, exactly the technique W0 used for its CI gates: introduce a `Math.random()` in `src/`,
confirm lint fails, revert. Same for one banned import. This is the single most important step
in the unit and is a done-criterion below, not an optional check.

### 2. Snapshot format and `expect` semantics (`vitest` 2 → 4)

Two majors is enough for snapshot serialization or default equality semantics to shift. If the
one `.snap` file needs regenerating, that is **a finding to review, not a step to perform**: the
event stream it holds is a behavioural golden. A reformat is acceptable; a content change is a
regression until proven otherwise, and the diff has to be read line by line.

### 3. `typescript-eslint` v8 → the eslint-10-compatible major

Whether `strict` + `exactOptionalPropertyTypes` type-checking behaviour under
`tseslint.configs.recommended` changes. `npm run typecheck` runs `tsc --noEmit` independently of
eslint, so a divergence between the two shows up as one passing and the other failing rather
than as silence.

---

## Sequence

1. **Capture the baseline.** `npm test`, `npm run lint`, `npm run typecheck` green on the
   current toolchain; record the 39/445 counts and the `npm audit` output verbatim.
2. **Upgrade in one commit**, not incrementally. Decision 1 below.
3. **Run the three gates.** Any failure is triaged as *tooling migration* or *behaviour change*
   before anything is edited — the distinction is the entire point of the unit.
4. **Run the red-path proof on the determinism guard** (surface 1). Non-negotiable.
5. **Read the corpus and golden diffs.** Ideally empty. Anything non-empty is a finding.
6. **Re-run `npm audit`** and record what actually cleared. If advisories remain, they are
   listed in the PR with the same "in devDependencies, no runtime deps, not reachable"
   reasoning the current entry uses — a partial clear is a fine outcome, a silently-reworded
   TODO entry is not.
7. **Update the TODO entry** to reflect the real post-upgrade state, or close it.

---

## Decisions

### 1. One commit for both majors, not one per tool

`npm audit fix --force` moves both together (`vitest` 2→4 and `eslint` 9→10), and TODO.md's own
framing is "a single toolchain upgrade." Splitting them sounds safer but is not: `eslint` and
`typescript-eslint` must move together anyway, and a half-upgraded lockfile means the corpus
gets validated twice against two intermediate states neither of which is ever shipped. One
commit, one corpus verification, one review.

The bisect argument against this is weak here — if something breaks, the failure surface is
either "lint no longer guards" or "a golden file moved," and both name their own culprit
without bisection.

### 2. Do not add a `vitest.config.ts` unless the upgrade forces one

There is none today and the suite runs on defaults. Adding configuration during a version bump
mixes "restore previous behaviour" with "make a new choice," and makes the diff hard to review.
If a changed default has to be pinned, that pin is the only content of the new file, with a
comment naming the default it restores.

### 3. Regenerating the golden or the corpus is a finding, never a step

`07-replay.md` §7 is explicit: regenerating a committed outcome is "never automatic… a command
that silently rewrites every outcome file turns the oracle into a rubber stamp." `vitest -u` is
precisely that command, and `plans/27` Decision 4 chose plain committed JSON for the corpus
specifically so that a dependency bump could not sweep it.

**So: `vitest -u` is not run in this unit.** If a snapshot must change, it changes by hand,
one file, with the diff explained in the PR — which is exactly the workflow the oracle exists
to force. A toolchain upgrade that rewrites behavioural goldens under the cover of a version
bump is the failure mode W18 and W20–W23 were built to prevent, and it would be ironic to
commit it in the first unit that uses them.

### 4. Tag `e26fa9d` as `v0.2.0` **first**, then cut `v0.3.0` from this unit

This decision originally read "cut `v0.2.0` from this unit," inheriting `plans/27` milestone M3
and TODO.md:460, which both say the **second** tag produces the first genuine cross-version
comparison. **That is wrong, and it was wrong before this plan repeated it.**

Verified:

| Fact | Evidence |
|---|---|
| `v0.1.0` is the only tag, and points at `96586bf` | `git rev-list -n1 v0.1.0` |
| `96586bf` contains **no** replay corpus | `git ls-tree -r --name-only v0.1.0 -- src/engine/fixtures/` returns nothing — it predates W22 |
| The job skips rather than compares in that case | `ci.yml`'s *Extract…* step sets `has_fixtures=false`, and the *Run…* step is gated on it |
| The workflow already knows | Its own comment: "an empty match (the previous tag predates W22's corpus entirely — **true of v0.1.0, the only tag today**)" — the `fec9ab4` guard was written *for* this case |

So a second tag compares against a corpus-free baseline and exercises **the guard, not the
oracle**. The first genuine comparison needs a *corpus-bearing* predecessor, which no tag is.

**The fix is not a workaround — it corrects a real omission.** `e26fa9d` (the W20–W23 merge)
shipped engine versioning and the replay oracle: features, warranting a minor bump under W20's
own plain-`vX.Y.Z` scheme. It never got a tag. Tagging it `v0.2.0` retroactively is correct
release hygiene on its own merits, *and* it establishes the corpus-bearing baseline, because
`e26fa9d` is the first commit where `src/engine/fixtures/replay/` exists.

This unit then cuts **`v0.3.0`**, whose predecessor `v0.2.0` has a full corpus — a genuine
comparison, and the ideal first exercise of the job, since W26 changes no engine behaviour by
design and should therefore produce a clean `match` on every fixture.

Rejected alternative: moving `v0.1.0` to `e26fa9d`. Tags are published references and W20
deliberately chose `96586bf` for a stated reason (`plans/28`, Decision 3). Re-pointing it would
invalidate that reasoning and rewrite a released marker to paper over a milestone error.

If W24/W25 land first, they are doc-only and equally safe to include in the `v0.3.0` tag.

### 5. TypeScript is not bumped unless something forces it

5.9.3 is current-enough and orthogonal to the advisories. Adding a compiler major to a unit
already carrying two tool majors widens the blast radius for no gain. If `typescript-eslint`'s
eslint-10-compatible major requires a newer `typescript`, it comes along and is called out —
otherwise it stays.

---

## Done-When

- `vitest`, `eslint` and `typescript-eslint` are on their new majors; `package.json` and
  `package-lock.json` agree (per W20's lockfile lesson — the lockfile was missed there and
  caught on review).
- `npm test` passes with **39 files / 445 tests**, or any difference is explained. A *reduced*
  test count is a failure, not a pass.
- `npm run lint` and `npm run typecheck` pass.
- **The determinism guard is proven still live by a deliberate red-path test** — a
  `Math.random()` in `src/` fails lint, and a banned cross-boundary import fails lint; both
  reverted. Run URLs or local output recorded in the PR, as W0 did.
- The replay corpus verifies with **no `.outcome.json` modified**, and the W18 event-stream
  golden is unmodified — or every change is individually reviewed and justified in the PR.
- `npm audit` is re-run and its real result recorded; remaining advisories are re-stated with
  their reachability, not dropped.
- The TODO.md entry reflects the true post-upgrade state.
- CI green, including the `engine` job and both documentation gates.
- `e26fa9d` tagged `v0.2.0` **before** this unit's own tag is cut (Decision 4), establishing the
  first corpus-bearing baseline.
- `v0.3.0` tagged from this unit, and the `release-tag-replay` job observed **running the
  comparison step** against `v0.2.0`'s committed outcomes — not skipping it. The distinction is
  the whole point: a green job that skipped proves nothing, and the run log must show
  `has_fixtures=true` and a `match` verdict per fixture (programme milestone M6).

---

## Explicitly Not In Scope

- **Any change under `src/engine/src/`** beyond what a tooling migration strictly forces. If a
  lint rule's new major flags real code, the fix is evaluated on its merits and may well be
  split into its own unit rather than smuggled into a dependency bump.
- **`vitest -u`, or any sweep regeneration of goldens or corpus files.** Decision 3.
- **Adding test infrastructure** — no coverage tooling, no reporters, no UI. The suite's shape
  is W18's and W22's business.
- **The `docs-template` advisories** — the three hardening findings in TODO.md sit in
  installer-owned files and belong in a PR against the template repository, per W0's standing
  decision never to hand-edit them.
- **Node's floor.** `engines.node` is `>=24` and CI runs 24; nothing here changes that.
