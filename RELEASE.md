# Release Checklist — `@the-running-dev/game-engine@0.15.0`

This is the `0.15.0` release checklist. It records what was verified, on exactly which commit
and exactly which archive, and what a release owner must do to publish — **as a separate,
explicit action that nothing in this repository performs.**

> **Publication requires a separate explicit user action.** This checklist prepares and verifies
> a candidate. It does not publish the package, push the `v0.15.0` tag, create a GitHub release,
> deploy the site, change DNS, or release anything in a companion repository. None of those
> happened while this checklist was produced.
>
> **`0.15.0` was published on 2026-11-26** by that separate action; see [§6](#6-publication--the-separate-explicit-action)
> for what was done and [§7](#7-after-publication--verification-and-recovery) for what was verified.

`0.15.0` supersedes nothing. It is the next candidate after the published `0.14.0`, cut from
`main` at `be6e090` once S141 had merged. The decision that shaped what it contains is in
`design/90-decisions.md`, 2026-11-26. The host evidence it must carry follows the rules `0.12.0`
used, from the same file, 2026-10-25.

Readiness status, and the wording that authorizes publication, is in
[§8 Authorization](#8-authorization). Read that before acting on anything below it.

---

## 1. Candidate identity

| | |
|---|---|
| Package | `@the-running-dev/game-engine` |
| Version | `0.15.0` |
| Required tag | `v0.15.0` (the guard rejects any other tag against this manifest) |
| Candidate commit | `b7517d8d8efb836422085fa1b5bb12057ffa4c04` (see §1.1) |
| Archive | `the-running-dev-game-engine-0.15.0.tgz` |
| Archive SHA-256 | `e3da18ddcfa84e1f9aa3b210904fa787636a62c85935b5c8f179aac84ea34d70` |
| Baseline for compatibility | tag `v0.14.0` |
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
`b7517d8d8efb83` exists on `release/0.15.0-candidate` and nowhere on `main`. That branch must not
be deleted before the `v0.15.0` tag exists at the candidate, and
[SubZeroDev.Adventures#112](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/112)
pins the same SHA as its engine submodule. The tag now exists, so the candidate commit is held by
`v0.15.0` and the branch is no longer needed.

### 1.1 Recorded candidate

<!-- candidate:start -->
| | |
|---|---|
| Candidate commit | `b7517d8d8efb836422085fa1b5bb12057ffa4c04` |
| Candidate committed | 2026-11-26T19:48:50+02:00 |
| Archive | `the-running-dev-game-engine-0.15.0.tgz` |
| Archive SHA-256 | `e3da18ddcfa84e1f9aa3b210904fa787636a62c85935b5c8f179aac84ea34d70` |
| Archive entries | 363 |
| Node / npm | Node v26.12.1, npm 11.7.0 |

The validation run on CI packed the candidate independently on Linux under Node 24 and recorded
the **same** digest, so the pack is reproducible across operating systems and Node versions, not
merely re-verifiable on one machine. CI pins Node 24 and the local run used Node 26.12.1; the
package declares `engines.node >= 24`, so both satisfy it, but the difference is recorded rather
than glossed.
<!-- candidate:end -->

The full per-gate record — command, exit code, duration, digest, evidence link, and every row
that did not run and why — is `.claude/release-candidate-0.15.0.json`. The `0.14.0` record
(`.claude/release-candidate-0.14.0.json`) and the records before it are history and are not
evidence for this candidate.

## 2. Registry access, checked read-only

The access mechanism is a GitHub token with `read:packages` (to check availability) and
`write:packages` (to publish). The release workflow uses `secrets.GITHUB_TOKEN` with
`packages: write`; **no credential was chosen, created or entered while producing this
checklist**, and the check below is read-only.

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.15.0
```

Result on the candidate: **`OK registry`** in the validation run on CI
([45870873821](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/45870873821)),
where the workflow's own token reads the scoped registry. Locally the check **could not be
evaluated** — exit 2, with no credential in the environment — and it is recorded as unevaluated,
not as a pass.

The same guard **rejects** an already-published version, which is what makes the positive answer
worth anything:

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.14.0
# REJECTED registry — @the-running-dev/game-engine@0.14.0 is already published … (exit 1)
```

An absent credential, a 401, a 403 or an unreachable registry all exit **2** — "could not be
evaluated" — and never `publishable`. A failing availability check is not proof that publication
is possible, and this guard will not let it read as one.

**The registry is level with the last tag.** `0.14.0` was published on 2026-11-03 by
[run 41686904892](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/41686904892)
and is the latest published version.

## 3. Non-publishing validation commands

Every command here is non-publishing. `npm publish` is not reachable from any of them.

```bash
# the guards, individually
node src/engine/scripts/verify-release.mjs mode --event workflow_dispatch --ref refs/heads/main --input-tag v0.15.0
node src/engine/scripts/verify-release.mjs tag --tag v0.15.0
node src/engine/scripts/verify-release.mjs clean
node src/engine/scripts/verify-release.mjs archive --archive src/engine/<tarball> --expect <sha256>
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.15.0
```

`archive --expect` takes the archive's SHA-256 digest, not the candidate's commit SHA. Passing
the commit SHA is rejected, which is the guard working.

```bash
# the guards, as the release workflow runs them, with the negatives, publishing nothing
gh workflow run release-engine-package.yml --ref release/0.15.0-candidate -f tag=v0.15.0
```

The same validation path also runs automatically on any pull request touching
`src/engine/package.json`, `src/engine/package-lock.json`, the guards, or the workflow. Mode is
derived from the trigger, not from an input: only a real `refs/tags/v*` push returns `publish`.

## 4. Gate evidence

`.claude/release-candidate-0.15.0.json` is the record. Every row carries its command, exit code,
duration, artifact digest and evidence link. Rows that did not run say so and name why; an
unavailable check is never rendered as a pass.

The one archive in §1.1 is the archive every archive consumer used. Source-only checks (text
client, MCP server, site, docs, host) and submodule consumers identify the same candidate SHA.

## 5. Release-note source

The changelog is generated from `main`'s merge history into `docs/docs/engine/CHANGELOG.md` by the
docs workflow's `changelog` input (GitHub-ActionTemplates `actions/changelog`). There is no
hand-maintained changelog and this checklist does not start one.

The immutable release-note source for `0.15.0` is the commit range — 6 commits:

```bash
git log --oneline v0.14.0..b7517d8d8efb836422085fa1b5bb12057ffa4c04
```

The range opens with `0.14.0`'s own evidence and publication commits (#631, #632), which landed
on `main` after the tag, and ends with the candidate commit itself. Use the generated changelog
entries in that range as the release notes. Do not retype them.

## 6. Publication — the separate explicit action

**Done on 2026-11-26**, on the user's explicit instruction, in this order:

- The evidence pull request [#636](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/636)
  merged as `fe3b99c`; `src/engine` at `main` is identical to the candidate's.
- Tag `v0.15.0` pushed at `b7517d8d8efb836422085fa1b5bb12057ffa4c04`.
- [Run 45878037211](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/45878037211)
  published the archive in `publish` mode and succeeded. Its registry guard found `0.15.0`
  publishable, and its archive guard recorded the §1.1 digest before and after the consumer smoke.
- GitHub release [v0.15.0](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.15.0)
  created with generated notes since `v0.14.0`.
- [SubZeroDev.Adventures#112](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/112)
  merged at 18:44Z as `74ea871`, **after** the tag (the publish run started at 18:42Z), so the
  order step 5 requires was kept this time. Adventures `main` CI, Container and Deploy at
  `74ea871` all succeeded.

The steps as written, for the next release:

1. Confirm §8 says readiness is authorized, and that the candidate SHA in §1.1 is still the
   commit you intend to publish. If `src/engine` has changed on `main` since, **re-verify**; the
   authorization names a SHA, not a branch.
2. Push the tag at that exact commit:
   ```bash
   git tag v0.15.0 b7517d8d8efb836422085fa1b5bb12057ffa4c04
   git push origin v0.15.0
   ```
3. `release-engine-package.yml` runs in `publish` mode. It re-runs every guard, re-verifies the
   archive digest against the one it just recorded, and publishes **that archive**
   (`npm publish <tarball>`) rather than packing a second, uninspected time.
4. Create the GitHub release against `v0.15.0`, with the §5 notes.
5. Merge [SubZeroDev.Adventures#112](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/112),
   which pins the engine submodule to the tagged candidate. It is held until the tag exists so
   that Adventures never pins an engine commit no tag names. `0.14.0` broke this order (its
   checklist, §6); keep it this time.

## 7. After publication — verification and recovery

**Verify (separately executed):**

1. Registry metadata:
   ```bash
   node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.15.0
   # must now REJECT with "already published" (exit 1) — that is the success signal here
   ```
2. Download the published tarball and compare its SHA-256 against §1.1. A different digest means
   something other than the approved artifact was published; stop and investigate.
   ```bash
   npm pack @the-running-dev/game-engine@0.15.0
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

**Recovery.** The last known-good published version is **`0.14.0`**. Consumer rollback is a
pinned reinstall:

```bash
npm install @the-running-dev/game-engine@0.14.0
```

Companions pin exact versions rather than ranges, so rollback is a one-line change in each
consumer and needs no registry operation.

**Deprecation — and its limits.** `0.15.0` is never overwritten, republished, or reused, and the
`v0.15.0` tag is never moved. **The recovery procedure this checklist promises is consumer-side
rollback to `0.14.0` plus publishing a corrected higher version, full stop** — decided 2026-09-13
(`design/90-decisions.md`). `npm deprecate` and `dist-tag` management are npmjs-registry features
whose GitHub Packages support this repository has never exercised, and npmjs behaviour must not be
assumed. A registry-supported deprecation remains available to test if a real withdrawal is ever
needed; it is not a precondition for this procedure.

## 8. Authorization

**0.15.0 readiness was not blocked, and it is now published** (see §6). Publishing was a separate
explicit action that nothing in this file performs.

The whole matrix was rerun against the candidate in §1.1. Nothing was carried forward from the
`0.14.0` record.

| Gate | Result on the candidate |
|---|---|
| Engine `typecheck`, `lint`, `test` | exit 0 each, from a clean `npm ci`; 127 test files, 2675 tests passed. Typecheck ran with a 4096 MB heap on this memory-starved host; unlike `0.14.0`, no test needed a longer timeout |
| Compatibility sweep vs `v0.14.0` | `build/Test-CompatibilitySweep.ps1 -BaselineTag v0.14.0` passed end to end: replay oracle, pack, archive inspection (363 entries, digest in §1.1) and the packed consumer smoke. None of `0.14.0`'s manual steps were needed |
| Release guards, local | `clean`, `tag` and `archive` OK; the guard suite passed inside the engine run. `registry`: unevaluated (exit 2) without a package-read token — never counted as a pass |
| Release validation run on CI | [45870873821](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/45870873821) green at the candidate: guards OK, the same digest packed independently on Node 24, consumer smoke passed, digest re-verified, registry guard reported `0.15.0` publishable. Publish step skipped |
| Static host | `dotnet test`: 12 of 12. Container build, route and probe smoke and the negative fixture: *Build, run, and smoke the image* on the evidence pull request |
| Documentation | drift check passes across 19 generated pages; Markdown checks pass across 138 files. Production Docusaurus build: *docs / Build* on the evidence pull request (`docs.ps1` was not run locally) |
| Site | locally, on the candidate with the evidence edits: `format:check`, `lint`, `typecheck` exit 0; `test` 20 of 20; `test:browser` 23 of 23; `test:build` exit 0 |
| Adventures (host evidence) | see below |
| ServiceContract | at its own commit `d53d8a7` with `0.14.0`: build (13 operations, 26 schemas), 59 of 59 tests pass. Against the candidate archive the build refuses with `EngineVersionMismatch`, as designed. With the authored version moved to `0.15.0`: build and typecheck pass, 58 of 59 tests (the failure is the test that asserts the authored version). The regenerated content contract gains `attachments` on `PortableManifest` and `includes` on the story-graph campaign |
| Platform `game-service` | typecheck passes against the candidate; serial run 336 passed, 7 failed, 68 skipped of 411 tests; 9 of 36 files failed, some at file level before any test ran. Not blocking, see below |
| GameOfLife | engine submodule at the candidate, at `0b2c99c`: typecheck, 77 of 77 tests, `export:content` and `check:clean`, and the spec-set check all pass |

**Adventures host evidence**, bound as `design/90-decisions.md` (2026-10-25) requires, on
[SubZeroDev.Adventures#112](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/112):

| | |
|---|---|
| Engine SHA | `b7517d8d8efb836422085fa1b5bb12057ffa4c04` |
| Archive digest | `e3da18ddcfa84e1f9aa3b210904fa787636a62c85935b5c8f179aac84ea34d70` |
| Adventures commit | `3c4d5d0d48b639ac90baee5a08f9ec0dcea8ca9c` |
| Content snapshot | `public/campaigns` tree `ff169b24512499c1ceef5df91b3bb9f832d424e9`, the same tree id as the `0.14.0` evidence (12 files, so the content did not change). The manifest digest was not recomputed |
| CI run | [45871139873](https://github.com/The-Running-Dev/SubZeroDev.Adventures/actions/runs/45871139873) |

On `postgres:17`, the `server` job ran 30 files and **396 tests, all passed, none skipped**. Every
DB-gated suite in Adventures is declared `databaseUrl ? describe : describe.skip`, so a skip would
appear in that count; there is none. The `offline-e2e` job passed against the same database, and
every other check on the pull request passed or was skipped by design. That pull request merged
only after the `v0.15.0` tag existed (§6).

**Compatibility with `0.14.0`.** For code that plays the engine, `0.15.0` is a compatible
superset: the sweep's replay oracle and the packed consumer pass unchanged, and `formatVersion`
stays 2. A host sees these changes, all from S141 and recorded in `design/90-decisions.md`:

- A portable manifest may carry `attachments`. They are digested into `resolution`, so a manifest
  without them resolves exactly as before. Portable story-graph campaigns gain an optional
  `includes`.
- A campaign an attachment reaches is stamped `<authored>+att.<12 hex>`, or `.att.<12 hex>`
  appended when the authored version already carries build metadata. A campaign nothing attaches
  to keeps its authored version.
- An authored version that already uses the reserved identifier fails Tier 1 with
  `reserved_version_identifier`.
- `getStrings` grows from 262 to 263 keys: `core.reason.reserved_version_identifier`. Additive:
  none removed, none changed.

The last one is what Platform `game-service` caught, as it did for `0.14.0`. At Platform `6b03666`,
against the candidate tarball and a ServiceContract regenerated at `0.15.0`, its typecheck passes.
Every failure falls in one of `0.14.0`'s three classes:

- Two golden-transcript tests (`durable-replay` S8.3, `replay` S5.2/S5.3) fail at step 4
  (`get-strings`) on the one added key, and on nothing else.
- Fixture-refresh guards fail because the previous-release fixture still names `0.14.0`:
  `owner-scope` S2.10, `pre-g3-deletion` S9.1, and the whole `previous-release` suite.
- Every test that starts `game-edge` could not, because `game-edge` was not built in the worktree:
  `replay-edge` S7.8 (two), the `s3-edge` and `mcp-through-edge` suites, and `s5-credentials`
  S5.1–S5.3, S5.7, S5.8 and S5.9. Those are unevaluated, not failed. The suites beyond `0.14.0`'s
  two landed on Platform `main` after its run.

Platform pins and vendors `0.14.0`, so publishing `0.15.0` does not break
it. Moving it is follow-up work, in order: regenerate ServiceContract at `0.15.0` (its tests pin
the engine version literally), then refresh Platform's golden transcript and previous-release
fixture.

**Verified after publication (2026-11-26):** the registry guard rejects `0.15.0` as already
published; the registry copy's SHA-256 is `e3da18ddcfa84e1f9aa3b210904fa787636a62c85935b5c8f179aac84ea34d70`,
equal to §1.1, with 363 entries; an isolated install plus the consumer smoke (install, build,
smoke, exit 0) passed from that copy; `.` and `./authoring` resolve and both deep `dist/` paths
fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## 9. History

`0.14.0` was qualified at `b7f9925`, published on 2026-11-03 and released as
[v0.14.0](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.14.0). Its
checklist is this file at `5c453f9` (its candidate evidence alone at `63f0fd2`), and its record is
`.claude/release-candidate-0.14.0.json`. `0.13.0`'s checklist is this file at `665a53c`, and
`0.12.0`'s, including the three deliberate breaks against `0.10.0`, at `9a8a54a`. None of it is
evidence for `0.15.0`; every row was rerun.

`0.15.0` was published on 2026-11-26 as `b7517d8` and released as
[v0.15.0](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.15.0). Its
candidate record is `.claude/release-candidate-0.15.0.json`; its checklist is this file at `fe3b99c`.

## 10. Scope fence

Anything that changes `src/engine` before `0.15.0` publishes invalidates the candidate in §1.1:
the tree being published is then no longer the tree verified here, and the whole matrix reruns
against a new candidate. Work after S141 is post-`0.15.0` scope for exactly this reason.
