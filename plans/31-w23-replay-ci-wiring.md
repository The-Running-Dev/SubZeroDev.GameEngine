# W23 — Replay Oracle: CI Wiring

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W23

**Scope:** CI wiring so the engine suite doesn't waste a full run on documentation-only
changes, and a release-tag job that runs the corpus against the *previous* tag's own
committed fixtures and outcomes — the actual cross-version comparison 07-replay.md exists
to make.

**Depends on:** W20 (a real tag scheme), W22 (the corpus and the `REPLAY_BASELINE_DIR`
support it needed adding to the corpus test).

**Note:** This unit's first draft went through Qodo review on [PR #73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73)
and four of its findings were real, load-bearing bugs, not style nits — the version below
is the corrected design. The original draft and what was wrong with it are recorded under
*Post-Review Corrections* rather than silently overwritten, since the mistakes themselves
are informative for the next unit that touches CI path-filtering or cross-version tooling.

## What This Unit Builds

`.github/workflows/ci.yml`:

- No `paths` filter on either trigger. The `engine` job instead computes, as its own first
  step, whether anything under `src/engine/` changed (`git diff` against the PR's base/head
  SHAs for `pull_request`; always `true` for `push`, branch or tag), and every later step is
  conditional on that — so the job **always runs and always reports**, but skips
  `npm ci`/typecheck/lint/test entirely on a documentation-only PR.
- A new `release-tag-replay` job, gated `if: startsWith(github.ref, 'refs/tags/')`, that
  finds the previous `v*` tag, extracts **both** its `.fixture.json` and `.outcome.json`
  files via `git show` into one directory, and re-runs
  `bulgaria-bureaucracy.replay.test.ts` with `REPLAY_BASELINE_DIR` pointed at it.
- The `engine` job runs unconditionally on a tag push too now — every ref actually gets
  typecheck/lint/test somewhere, rather than trusting a tagged commit was already verified.

`campaigns/bulgaria-bureaucracy.replay.test.ts` gained `REPLAY_BASELINE_DIR` support: when
set, **both** fixtures and outcomes are read from that directory instead of the local
`fixtures/replay/`, and `FIXTURE_NAMES` is enumerated from it too — so cross-version mode
replays exactly the previous tag's own corpus, nothing added or edited since. Every
mechanics-only test (the gated-choice check, the hand-edited-divergence check, both
`unrunnable` checks, the reflexivity check) is `it.skipIf(COMPARING_ACROSS_VERSIONS)`, since
those assert against this commit's specific fixture names and aren't a cross-version
question at all.

## Decisions

### 1. No `paths` filter — the job self-skips its own steps instead

`engine` is a required status check on `main`'s ruleset. A `pull_request.paths` filter means
the workflow run itself never starts for a non-matching PR, so the required check never
reports anything at all — GitHub does not treat "the workflow didn't run" as "check passed";
it leaves the PR waiting on a check that will never arrive. Moving the skip decision *inside*
the job (a `git diff` step, then `if:` on every later step) keeps the job always present and
always green-or-red, while still skipping the actual `npm ci`/typecheck/lint/test work when
nothing under `src/engine/` changed.

### 2. `push` (branch and tag) always runs the full steps; only `pull_request` computes a diff

A `pull_request` event carries both `base.sha` and `head.sha` in its payload, so the diff is
unambiguous once `fetch-depth: 0` makes both commits locally reachable. A `push` event has no
equally reliable "before" state for a tag (tagging an already-pushed commit has nothing
meaningful to diff against), so `push` simply always runs the real steps — a doc-only merge
to `main` re-running `engine` once is a cheap, safe default next to the risk of getting a
tag-push diff wrong.

### 3. The release-tag job shells out to `git`, rather than adding a script to the package

Finding the previous tag (`git tag --list 'v*' --sort=-v:refname`, then the entry after the
current one) and extracting old file contents (`git ls-tree` + `git show <tag>:<path>`) are
both ordinary CLI git operations with no engine-specific logic in them. Writing a Node script
to do the same would be a second implementation of what `git` already does correctly, for a
one-time CI step — the workflow YAML is the more honest home for it.

Verified locally against this repository's own tag list before being trusted in CI: with
only `v0.1.0` (W20's tag) present, the "previous tag" logic correctly reports none found; a
second, temporary tag confirmed it resolves to the actual next-older one when two exist. The
job's *execution inside GitHub Actions* is still unverified beyond that — it needs a second
real tag pushed to exercise end to end (M3, `plans/27-replay-oracle-programme.md`).

### 4. `REPLAY_BASELINE_DIR` supplies both fixtures and outcomes, not outcomes alone

Comparing this commit's fixture *inputs* against a previous tag's recorded outcome is not a
clean cross-version comparison the moment a fixture's `submissions` have changed shape or
the fixture was removed since — an edit could produce a spurious divergence attributed to
the wrong cause, and a removal would silently drop the old scenario from the comparison
entirely rather than still checking it. Extracting both files from the same tag and
enumerating fixture names from that same directory means cross-version mode always replays
exactly what the previous tag itself recorded — nothing added, edited, or removed since is
in scope, which is the correct scope for "did this engine change break something that used
to work."

## Post-Review Corrections

Seven findings from Qodo's review of the first two drafts were acted on; one was not.

**Real, fixed:**

1. **Required check never reports** (the `pull_request.paths` filter from Decision 1's first
   draft) — see Decision 1 above for the fix. The original filter would have silently stalled
   every documentation-only PR against a required check that could never fire.
2. **Old fixtures not replayed** — the original design fetched only `.outcome.json` from the
   previous tag while still reading `.fixture.json` from the current checkout. See Decision 4.
3. **Missing baselines still failed some tests** — a consequence of the same design: the
   mechanics tests (hand-edited-divergence, both `unrunnable` checks) called a
   `requireExpectedOutcome` that threw on a genuinely absent previous-tag baseline. Resolved
   the same way as finding 2, by skipping all mechanics-only tests in cross-version mode
   rather than patching each call site.
4. **`runner.ts`'s `findDivergence` ignored `Decision.index`** — a hand-edited `.outcome.json`
   with a corrupted or reordered index could still report `match`. Fixed in `runner.ts` (see
   `plans/29-w21-replay-outcome-and-runner.md`).
5. **A `null` seed could bypass reproducibility** in `buildReplayOutcome`, the same class of
   gap `core/determinism/harness.ts`'s `runFixture` already guards against. Fixed with the
   same runtime backstop (see `plans/29`).
6. **A tag push skipped the `engine` job entirely**, relying on the unenforced assumption
   that the tagged commit had already passed CI as a branch push or PR. Fixed by removing the
   tag-skip — every ref now runs the full job (Decision 2's "push always runs" now covers
   tags too).
7. **`package-lock.json`'s root `version` was still `0.0.0`** after `package.json` moved to
   `0.1.0`. Patched surgically (the two `version` fields only) rather than via a full
   `npm install --package-lock-only`, which was tried first and reverted — it also rewrote
   unrelated `libc` metadata on optional platform dependencies, apparently from a difference
   in the local npm version's serialization, and that churn had nothing to do with this fix.
8. **The release-tag job never checked whether the previous tag actually had a corpus.**
   `v0.1.0` (W20's tag, the only one that exists today) was cut *before* the corpus (W22)
   existed — the very first time a second tag makes this job run for real, "the previous tag"
   would be `v0.1.0`, whose `src/engine/fixtures/replay/` is empty. Extraction would silently
   produce zero files, and the corpus test's own "the corpus is non-empty" assertion would
   fail on a false alarm, not a real regression. Fixed by checking, right after extraction,
   whether any `*.fixture.json` landed in the baseline directory, and skipping the "run the
   corpus" step entirely (not a failure) when none did — the same "not a failure" framing the
   "no previous tag at all" case already gets. Verified empirically that a failing `grep`
   inside `for x in $(cmd | grep ...)` does not itself abort the step under this shell's
   `-eo pipefail` default (a `for` loop over zero words simply iterates zero times), though
   `|| true` was added anyway as cheap, explicit insurance.

**Reviewed, not acted on:**

- **"`findDivergence` compares unstable fields"** — the claim was that comparing
  `Decision.seq`/`actionId`/`accepted`, `acceptedActions`, and `terminal` exceeds the
  cross-version-stable field set. This is contrary to `07-replay.md` §3's own text: every one
  of those fields is explicitly declared stable "by an existing decree, not by hope" — closed
  `GameStatus` union, additive-and-never-renamed `ReasonCode`s, a log-entry count, and
  `terminal` existing *specifically* to be compared (§3.3). Comparing less than all of
  `Outcome` would mean `findDivergence` couldn't do the one thing §6 names it for: report the
  index of the first differing `Decision`.

## Design

### Changed files

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | No trigger-level `paths`; `engine` job gains a self-computed `changed` step gating every later step; tag-skip removed; `release-tag-replay` extracts both fixture and outcome files, fixed pathspec (see `plans/29`/`plans/30` for the `runner.ts`/test-file changes this job's fixes depend on). |
| `campaigns/bulgaria-bureaucracy.replay.test.ts` | `REPLAY_BASELINE_DIR` (renamed from `REPLAY_EXPECTED_OUTCOMES_DIR`) supplies both fixtures and outcomes; `FIXTURE_NAMES` is enumerated from the resolved corpus directory; mechanics-only tests are `it.skipIf(COMPARING_ACROSS_VERSIONS)`. |

### Test Plan

- [x] YAML syntax validated (`js-yaml`).
- [x] Previous-tag shell logic validated against this repository's real tag list: correctly
      reports "none" with one tag present, correctly resolves to the older of two.
- [x] `REPLAY_BASELINE_DIR` smoke-tested locally: pointed at a baseline missing a fixture
      added since (that fixture isn't enumerated at all, the rest still run and match);
      pointed at a baseline with one outcome deliberately altered (reports `diverged`).
- [ ] The `release-tag-replay` job's actual GitHub Actions execution — needs a real tag push
      and a second tag to compare against (M3). Not verifiable locally.
- [ ] The `engine` job's self-computed diff step, specifically for a real `pull_request`
      event (the `git diff` against `base.sha`/`head.sha` was validated by reading, not by
      opening a documentation-only PR against this branch).

### Explicit Non-Goals

- No changes to `docs-ci.yml`/`docs-deploy.yml` — those already gate documentation changes
  independently of the engine job.
- No third-party GitHub Action (e.g. `dorny/paths-filter`) for the changed-files check —
  the hand-rolled `git diff` step keeps every action in this workflow first-party
  (`actions/checkout`, `actions/setup-node`), which was judged worth the small amount of
  shell over adding a marketplace dependency to CI provenance.
