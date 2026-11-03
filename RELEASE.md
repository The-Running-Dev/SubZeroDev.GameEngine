# Release Checklist — `@the-running-dev/game-engine@0.14.0`

This is the `0.14.0` release checklist. It records what was verified, on exactly which commit
and exactly which archive, and what a release owner must do to publish — **as a separate,
explicit action that nothing in this repository performs.**

> **Publication requires a separate explicit user action.** This checklist prepares and verifies
> a candidate. It does not publish the package, push the `v0.14.0` tag, create a GitHub release,
> deploy the site, change DNS, or release anything in a companion repository. None of those
> happened while this checklist was produced.

`0.14.0` supersedes nothing. It is the next candidate after the published `0.13.0`, cut from
`main` at `82f3942` once S136–S140 and their alignment had merged. The decisions that shaped what
it contains are in `design/90-decisions.md`, 2026-11-01 to 2026-11-03. The host evidence it must
carry follows the rules `0.12.0` used, from the same file, 2026-10-25.

Readiness status, and the wording that authorizes publication, is in
[§8 Authorization](#8-authorization). Read that before acting on anything below it.

---

## 1. Candidate identity

| | |
|---|---|
| Package | `@the-running-dev/game-engine` |
| Version | `0.14.0` |
| Required tag | `v0.14.0` (the guard rejects any other tag against this manifest) |
| Candidate commit | `b7f9925f260959ec02fa874555a45482eb63ab49` (see §1.1) |
| Archive | `the-running-dev-game-engine-0.14.0.tgz` |
| Archive SHA-256 | `43aa787484ce6ed0418775577cd964831a203e3b2504f26a3dd2df5c87eb90f4` |
| Baseline for compatibility | tag `v0.13.0` |
| Registry | `https://npm.pkg.github.com` (GitHub Packages) |
| Intended visibility | public — the decision is in `design/90-decisions.md` §2 and is **not** reopened here |

**Why the candidate identity is filled in by a later commit.** A candidate is a committed tree.
Its SHA cannot be written into a file that is part of the same commit, and its archive digest
cannot be computed before that commit exists. So the release-only change is committed first and
*is* the candidate; the evidence commit that follows records the SHA and digest and changes
nothing the archive contains. That second commit is **not** the tested candidate, and the
authorization in §8 binds to the SHA it names, never to wherever `main` has since moved.

The candidate commit changes the version and nothing else: `src/engine/package.json`, both
version fields of `src/engine/package-lock.json`, and the engine's entry in
`site/package-lock.json`. Commits after it touch this checklist, its record, the README's status
section, the roadmap's summary text and one example string in the release workflow. The archive
contains `dist/`, `package.json` and `README.md` from `src/engine/` only, so none of them can
alter its bytes. The digest in §1.1 is the check on that claim — re-pack and compare rather than
trusting this paragraph.

**Squash merge leaves the candidate off `main`.** The evidence pull request squash-merges, so
`b7f9925f260959` exists on `release/0.14.0-candidate` and nowhere on `main`. That branch must not
be deleted before the `v0.14.0` tag exists at the candidate, and
[SubZeroDev.Adventures#104](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/104)
pins the same SHA as its engine submodule.

### 1.1 Recorded candidate

<!-- candidate:start -->
| | |
|---|---|
| Candidate commit | `b7f9925f260959ec02fa874555a45482eb63ab49` |
| Candidate committed | 2026-11-03T15:06:48+02:00 |
| Archive | `the-running-dev-game-engine-0.14.0.tgz` |
| Archive SHA-256 | `43aa787484ce6ed0418775577cd964831a203e3b2504f26a3dd2df5c87eb90f4` |
| Archive entries | 363 |
| Node / npm | Node v26.12.1, npm 11.7.0 |

The validation run on CI packed the candidate independently on Linux under Node 24 and recorded
the **same** digest, so the pack is reproducible across operating systems and Node versions, not
merely re-verifiable on one machine. CI pins Node 24 and the local run used Node 26.12.1; the
package declares `engines.node >= 24`, so both satisfy it, but the difference is recorded rather
than glossed.
<!-- candidate:end -->

The full per-gate record — command, exit code, duration, digest, evidence link, and every row
that did not run and why — is `.claude/release-candidate-0.14.0.json`. The `0.13.0` record
(`.claude/release-candidate-0.13.0.json`) and the records before it are history and are not
evidence for this candidate.

## 2. Registry access, checked read-only

The access mechanism is a GitHub token with `read:packages` (to check availability) and
`write:packages` (to publish). The release workflow uses `secrets.GITHUB_TOKEN` with
`packages: write`; **no credential was chosen, created or entered while producing this
checklist**, and the check below is read-only.

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.14.0
```

Result on the candidate: **`OK registry`** in the validation run on CI
([41642910571](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/41642910571)),
where the workflow's own token reads the scoped registry. Locally the check **could not be
evaluated** — exit 2, with no credential in the environment — and it is recorded as unevaluated,
not as a pass.

The same guard **rejects** an already-published version, which is what makes the positive answer
worth anything:

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.13.0
# REJECTED registry — @the-running-dev/game-engine@0.13.0 is already published … (exit 1)
```

An absent credential, a 401, a 403 or an unreachable registry all exit **2** — "could not be
evaluated" — and never `publishable`. A failing availability check is not proof that publication
is possible, and this guard will not let it read as one.

**The registry is level with the last tag.** `0.13.0` was published on 2026-10-31 by
[run 41210532827](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/41210532827)
and is the latest published version.

## 3. Non-publishing validation commands

Every command here is non-publishing. `npm publish` is not reachable from any of them.

```bash
# the guards, individually
node src/engine/scripts/verify-release.mjs mode --event workflow_dispatch --ref refs/heads/main --input-tag v0.14.0
node src/engine/scripts/verify-release.mjs tag --tag v0.14.0
node src/engine/scripts/verify-release.mjs clean
node src/engine/scripts/verify-release.mjs archive --archive src/engine/<tarball> --expect <sha256>
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.14.0
```

`archive --expect` takes the archive's SHA-256 digest, not the candidate's commit SHA. Passing
the commit SHA is rejected, which is the guard working.

```bash
# the guards, as the release workflow runs them, with the negatives, publishing nothing
gh workflow run release-engine-package.yml --ref release/0.14.0-candidate -f tag=v0.14.0
```

The same validation path also runs automatically on any pull request touching
`src/engine/package.json`, `src/engine/package-lock.json`, the guards, or the workflow. Mode is
derived from the trigger, not from an input: only a real `refs/tags/v*` push returns `publish`.

## 4. Gate evidence

`.claude/release-candidate-0.14.0.json` is the record. Every row carries its command, exit code,
duration, artifact digest and evidence link. Rows that did not run say so and name why; an
unavailable check is never rendered as a pass.

The one archive in §1.1 is the archive every archive consumer used. Source-only checks (text
client, MCP server, site, docs, host) and submodule consumers identify the same candidate SHA.

## 5. Release-note source

The changelog is generated from `main`'s merge history into `docs/docs/engine/CHANGELOG.md` by the
docs workflow's `changelog` input (GitHub-ActionTemplates `actions/changelog`). There is no
hand-maintained changelog and this checklist does not start one.

The immutable release-note source for `0.14.0` is the commit range — 16 commits:

```bash
git log --oneline v0.13.0..b7f9925f260959ec02fa874555a45482eb63ab49
```

The range opens with `0.13.0`'s own evidence commit (#615), which landed on `main` after the
tag, and ends with the candidate commit itself. Use the generated changelog entries in that range
as the release notes. Do not retype them.

## 6. Publication — the separate explicit action

None of these steps has been taken.

1. Confirm §8 says readiness is authorized, and that the candidate SHA in §1.1 is still the
   commit you intend to publish. If `src/engine` has changed on `main` since, **re-verify**; the
   authorization names a SHA, not a branch.
2. Push the tag at that exact commit:
   ```bash
   git tag v0.14.0 b7f9925f260959ec02fa874555a45482eb63ab49
   git push origin v0.14.0
   ```
3. `release-engine-package.yml` runs in `publish` mode. It re-runs every guard, re-verifies the
   archive digest against the one it just recorded, and publishes **that archive**
   (`npm publish <tarball>`) rather than packing a second, uninspected time.
4. Create the GitHub release against `v0.14.0`, with the §5 notes.
5. Merge [SubZeroDev.Adventures#104](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/104),
   which pins the engine submodule to the tagged candidate. It is held until the tag exists so
   that Adventures never pins an engine commit no tag names.

## 7. After publication — verification and recovery

**Verify (separately executed):**

1. Registry metadata:
   ```bash
   node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.14.0
   # must now REJECT with "already published" (exit 1) — that is the success signal here
   ```
2. Download the published tarball and compare its SHA-256 against §1.1. A different digest means
   something other than the approved artifact was published; stop and investigate.
   ```bash
   npm pack @the-running-dev/game-engine@0.14.0
   node src/engine/scripts/verify-release.mjs archive --archive <downloaded tarball> --expect <§1.1 digest>
   ```
3. Isolated install and consumer smoke from the registry copy — a clean directory, no workspace
   link, no `file:` specifier:
   ```bash
   npm --prefix consumer-smoke ci
   ENGINE_TARBALL=<downloaded tarball> npm --prefix consumer-smoke run install:engine
   npm --prefix consumer-smoke run build && npm --prefix consumer-smoke run smoke
   ```
4. Confirm both supported entry points resolve from the installed package — `.` and
   `./authoring` — and that no deep `dist/` path resolves.

**Recovery.** The last known-good published version is **`0.13.0`**. Consumer rollback is a
pinned reinstall:

```bash
npm install @the-running-dev/game-engine@0.13.0
```

Companions pin exact versions rather than ranges, so rollback is a one-line change in each
consumer and needs no registry operation.

**Deprecation — and its limits.** `0.14.0` is never overwritten, republished, or reused, and the
`v0.14.0` tag is never moved. **The recovery procedure this checklist promises is consumer-side
rollback to `0.13.0` plus publishing a corrected higher version, full stop** — decided 2026-09-13
(`design/90-decisions.md`). `npm deprecate` and `dist-tag` management are npmjs-registry features
whose GitHub Packages support this repository has never exercised, and npmjs behaviour must not be
assumed. A registry-supported deprecation remains available to test if a real withdrawal is ever
needed; it is not a precondition for this procedure.

## 8. Authorization

**0.14.0 readiness is not blocked.** Publishing remains a separate explicit action that nothing
in this file performs.

The whole matrix was rerun against the candidate in §1.1. Nothing was carried forward from the
`0.13.0` record.

| Gate | Result on the candidate |
|---|---|
| Engine `typecheck`, `lint`, `test` | exit 0 each; 126 test files, 2631 tests passed. Typecheck needed a 4096 MB heap and the tests a 60 s timeout on this memory-starved host; at the default 5000 ms, process-spawning tests (`loc-coverage`, the `verify-release` guards, a compose fork-worker test) timed out, and none failed on an assertion |
| Compatibility sweep vs `v0.13.0` | The script's install step failed once (exit -4082, transient) and its `npm test` step failed under load, so after a standalone `npm ci` the steps ran by hand. Replay oracle: 3 files, 55 passed, 6 skipped. Pack and archive inspection: 363 entries, digest in §1.1. Consumer smoke against that archive: install, build, smoke pass, though clean-up could not remove a locked `node_modules`, so that install was not from an empty directory. The CI validation run did the whole sweep on a clean runner |
| Release guards, local | `clean` and `archive` OK; the guard suite passed inside the engine run. `registry`: unevaluated (exit 2) without a package-read token — never counted as a pass |
| Release validation run on CI | [41642910571](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/41642910571) green at the candidate: guards OK, the same digest packed independently on Node 24, consumer smoke passed, digest re-verified, registry guard reported `0.14.0` publishable. Publish step skipped |
| Static host | `dotnet test`: 12 of 12. Container build, route and probe smoke and the negative fixture: *Build, run, and smoke the image* on the evidence pull request |
| Documentation | drift check passes across 19 generated pages; Markdown checks pass across 138 files. Production Docusaurus build: *docs / Build* on the evidence pull request (`docs.ps1` was not run locally) |
| Site | locally, on the candidate: `format:check`, `lint`, `typecheck` exit 0; `test` 20 of 20; `test:browser` 23 of 23; `test:build` exit 0 |
| Adventures (host evidence) | see below |
| ServiceContract | at its own commit with `0.13.0`: build (13 operations, 26 schemas), 59 of 59 tests pass. Against the candidate archive the build refuses with `EngineVersionMismatch`, as designed. With the authored version moved to `0.14.0`: build and typecheck pass, 58 of 59 tests (the failure is the test that asserts the authored version) |
| Platform `game-service` | typecheck passes against the candidate; serial run 250 passed, 6 failed, 27 skipped of 283. Not blocking, see below |
| GameOfLife | engine submodule at the candidate: typecheck, 76 of 76 tests, `export:content` and `check:clean`, and the spec-set check all pass |

**Adventures host evidence**, bound as `design/90-decisions.md` (2026-10-25) requires, on
[SubZeroDev.Adventures#104](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/104):

| | |
|---|---|
| Engine SHA | `b7f9925f260959ec02fa874555a45482eb63ab49` |
| Archive digest | `43aa787484ce6ed0418775577cd964831a203e3b2504f26a3dd2df5c87eb90f4` |
| Adventures commit | `d11e1a580f0d69ab6577ad880a22f579c445663e` |
| Content snapshot | `public/campaigns` tree `ff169b24512499c1ceef5df91b3bb9f832d424e9`, the same tree id as the `0.13.0` evidence (12 files, so the content did not change). The manifest digest was not recomputed |
| CI run | [41664785683](https://github.com/The-Running-Dev/SubZeroDev.Adventures/actions/runs/41664785683) |

On `postgres:17`, the `server` job ran 29 files and **377 tests, all passed, none skipped**. Every
DB-gated suite in Adventures is declared `databaseUrl ? describe : describe.skip`, so a skip would
appear in that count; there is none. The `offline-e2e` job passed against the same database, and every other check on the pull
request passed or was skipped by design. That pull request merges only after the `v0.14.0`
tag exists.

**Compatibility with `0.13.0` depends on which side of the API you are on.** For code that plays
the engine, `0.14.0` is a compatible superset: the sweep's replay oracle and the packed consumer
pass unchanged. A host sees these changes, all from S136–S140 and recorded in
`design/90-decisions.md`:

- Simulation and world-graph refuse an action carrying a param key the kind did not declare, with
  the kind's own `unexpected_params`, before any value is read. Simulation used to copy undeclared
  keys into the stored action; world-graph used to ignore them.
- `branchSession` throws `invalid_state` for a retained log whose action a kind now refuses,
  instead of a plain `Error`.
- Simulation refuses an id it never issued (`unknown_target`).
- A host captures a played session as a `ReplayFixture` without the `/authoring` subpath: the root
  exports `ReplayFixture`, `Submission`, `ActionSubmission`, `AdoptionSubmission` and
  `EmittedRecordSink`, and `createReplayContext` is on `/authoring`. Additive.
- `getStrings` grows from 259 to 262 keys: `simulation.reason.unexpected_params`,
  `simulation.reason.unknown_target` and `world-graph.reason.unexpected_params`. Additive: none
  removed, none changed.

The last one is what Platform `game-service` caught again. Against the candidate tarball, with
ServiceContract regenerated at `0.14.0`, its typecheck passes. Two golden-transcript tests fail at
step 4 (`get-strings`) on the three added keys, two fixture-refresh guards fail (`owner-scope`
S2.10 and `pre-g3-deletion` S9.1), and two S7.8 `replay-edge` tests could not start because
`game-edge` was not built in the worktree — those two are unevaluated, not failed. Platform pins
and vendors `0.13.0`, so publishing `0.14.0` does not break it. Moving it is follow-up work, in
order: regenerate ServiceContract at `0.14.0`, then refresh Platform's golden transcript and
fixtures.

## 9. History

`0.13.0` was qualified at `45b7216`, published on 2026-10-31 and released as
[v0.13.0](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.13.0). Its
checklist is this file at `665a53c`, and its record is `.claude/release-candidate-0.13.0.json`.
`0.12.0`'s checklist, including the three deliberate breaks against `0.10.0`, is this file at
`9a8a54a`. None of it is evidence for `0.14.0`; every row was rerun.

## 10. Scope fence

Anything that changes `src/engine` before `0.14.0` publishes invalidates the candidate in §1.1:
the tree being published is then no longer the tree verified here, and the whole matrix reruns
against a new candidate. Work after S140 is post-`0.14.0` scope for exactly this reason.
