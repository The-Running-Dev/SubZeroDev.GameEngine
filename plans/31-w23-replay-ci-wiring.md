# W23 — Replay Oracle: CI Wiring

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W23

**Scope:** Path-filtered CI triggers so the engine suite doesn't run on documentation-only
changes, and a release-tag job that runs the corpus against the *previous* tag's committed
outcomes — the actual cross-version comparison 07-replay.md exists to make.

**Depends on:** W20 (a real tag scheme), W22 (the corpus and
`REPLAY_EXPECTED_OUTCOMES_DIR` support it needed adding to the corpus test).

## What This Unit Builds

`.github/workflows/ci.yml`:

- `pull_request` gained `paths: [src/engine/**]`. `push` to `main` stays unfiltered.
- A new `release-tag-replay` job, gated `if: startsWith(github.ref, 'refs/tags/')`, that
  finds the previous `v*` tag, extracts its committed `.outcome.json` files via `git show`,
  and re-runs `bulgaria-bureaucracy.replay.test.ts` with `REPLAY_EXPECTED_OUTCOMES_DIR`
  pointed at them.
- The existing `engine` job gained `if: ${{ !startsWith(github.ref, 'refs/tags/') }}`, so a
  tag push runs only the new job, not a redundant repeat of typecheck/lint/test against a
  commit that already passed them as a branch push or PR.

`campaigns/bulgaria-bureaucracy.replay.test.ts` gained `REPLAY_EXPECTED_OUTCOMES_DIR` support
(added here, not W22, since W22 had no CI consumer yet to justify it): when set, expected
outcomes are read from that directory instead of the local `fixtures/replay/`, and a fixture
with no baseline there is skipped rather than failing — it was added since the comparison
target's tag and has nothing to compare against yet.

## Decisions

### 1. `pull_request` filters to `src/engine/**`, not just `core/`/`kinds/`

07 §8 frames the trigger as "changes to `core/` or `kinds/`" — but the engine job also runs
lint and typecheck across the whole package, and a campaign-, client-, or MCP-only PR still
needs all of that. Scoping the filter that narrowly would silently skip CI on real engine
changes outside those two directories. `src/engine/**` gets the actual ask right — "never a
merge gate on documentation-only changes" — without that gap.

### 2. `push` to `main` stays unfiltered

GitHub Actions' path-filter diff for a tag push is not the same "files changed since the
last build" comparison it is for a branch push — tagging an already-pushed commit has no
clean "before" state to diff against, and the documented behavior for combining `paths` with
a `tags` trigger is inconsistent enough that getting it wrong risks the release-tag job
silently never firing. A doc-only merge to `main` re-running the full `engine` job once is a
cheap, safe default set against that risk — this was a deliberate choice to accept a known
inefficiency rather than an oversight.

### 3. The release-tag job shells out to `git`, rather than adding a script to the package

Finding the previous tag (`git tag --list 'v*' --sort=-v:refname`, then the entry after the
current one) and extracting old file contents (`git ls-tree` + `git show
<tag>:<path>`) are both ordinary CLI git operations with no engine-specific logic in them.
Writing a Node script to do the same would be a second implementation of what `git` already
does correctly, for a one-time CI step — the workflow YAML is the more honest home for it.

Verified locally against this repository's own tag list before being trusted in CI: with
only `v0.1.0` (W20's tag) present, the "previous tag" logic correctly reports none found; a
second, temporary tag confirmed it resolves to the actual next-older one when two exist. The
job's *execution inside GitHub Actions* is still unverified beyond that — it needs a second
real tag pushed to exercise end to end (M3, `plans/27-replay-oracle-programme.md`).

### 4. `REPLAY_EXPECTED_OUTCOMES_DIR` skips missing baselines only in cross-version mode

In the default run (no override — every PR, every push), a `.fixture.json` with no matching
`.outcome.json` is a real authoring bug and the corpus test throws, same as before this unit.
Only when comparing against an external directory (the previous tag's corpus) does a missing
file mean "added since then, nothing to compare yet" rather than a mistake — mirrored from
`unrunnable`'s own "not a failure" framing (07 §6). The self-reflexivity check
(`findDivergence(expected, expected)` for every fixture) is skipped entirely in cross-version
mode instead of tolerating the same gap, since it is testing the comparator itself, not
anything specific to a particular tag's corpus, and `requireExpectedOutcome` is meant to
throw loudly there.

## Design

### Changed files

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | `pull_request.paths`, `engine` job gains a tag-skip `if`, new `release-tag-replay` job. |
| `campaigns/bulgaria-bureaucracy.replay.test.ts` | `REPLAY_EXPECTED_OUTCOMES_DIR` env var support; `loadExpectedOutcome` returns `undefined` for a missing cross-version baseline instead of throwing; the reflexivity check is `it.skipIf(COMPARING_ACROSS_VERSIONS)`. |

### Test Plan

- [x] YAML syntax validated (`js-yaml`).
- [x] Previous-tag shell logic validated against this repository's real tag list: correctly
      reports "none" with one tag present, correctly resolves to the older of two.
- [x] `REPLAY_EXPECTED_OUTCOMES_DIR` smoke-tested locally three ways: pointed at a copy of
      the current corpus (all match), pointed at a directory missing one fixture's outcome
      (that one skips, the rest still run), and pointed at a directory with one outcome
      deliberately altered (reports `diverged` at the correct index).
- [ ] The `release-tag-replay` job's actual GitHub Actions execution — needs a real tag push
      and a second tag to compare against (M3). Not verifiable locally.

### Explicit Non-Goals

- No changes to `docs-ci.yml`/`docs-deploy.yml` — those already gate documentation changes
  independently of the engine job.
- No attempt to make path-filtering work uniformly across `push` and tag events — Decision 2
  explains why that risk wasn't worth taking for a same-day efficiency gain.
