# Release Checklist — `@the-running-dev/game-engine@0.12.0`

This is the `0.12.0` release checklist. It records what was verified, on exactly which commit
and exactly which archive, and what a release owner must do to publish — **as a separate,
explicit action that nothing in this repository performs.**

> **Publication requires a separate explicit user action.** This checklist prepares and verifies
> a candidate. It does not publish the package, push the `v0.12.0` tag, create a GitHub release,
> deploy the site, change DNS, or release anything in a companion repository. None of those
> happened while this checklist was produced.

`0.12.0` replaces the `0.11.0` candidate, which qualified at `2b525d3` and was superseded on
2026-10-25 when W109–W113 landed on `main` after it. `0.11.0` was never tagged or published and
will not be; its record is `.claude/release-candidate-w108.json`, kept as history. The decisions
that set this candidate's version, its cut point and the host evidence it must carry are in
`design/90-decisions.md`, 2026-10-25.

Readiness status, and the wording that authorizes publication, is in
[§8 Authorization](#8-authorization). Read that before acting on anything below it.

---

## 1. Candidate identity

| | |
|---|---|
| Package | `@the-running-dev/game-engine` |
| Version | `0.12.0` |
| Required tag | `v0.12.0` (the guard rejects any other tag against this manifest) |
| Candidate commit | `914383610dc2afbb26fe2e224206dbf0a7b2d9e4` (see §1.1) |
| Archive | `the-running-dev-game-engine-0.12.0.tgz` |
| Archive SHA-256 | `e76fbf5d5c0ea97ea0168be0c23100f840ae366f1bb17a32936ab7e7e22d7f63` |
| Baseline for compatibility | tag `v0.10.0` |
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
`914383610dc2` exists on `release/0.12.0-candidate` and nowhere on `main`. That branch must not
be deleted before the `v0.12.0` tag exists at the candidate, and
[SubZeroDev.Adventures#90](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/90)
pins the same SHA as its engine submodule.

### 1.1 Recorded candidate

<!-- candidate:start -->
| | |
|---|---|
| Candidate commit | `914383610dc2afbb26fe2e224206dbf0a7b2d9e4` |
| Candidate committed | 2026-10-27T20:00:47+02:00 |
| Archive | `the-running-dev-game-engine-0.12.0.tgz` |
| Archive SHA-256 | `e76fbf5d5c0ea97ea0168be0c23100f840ae366f1bb17a32936ab7e7e22d7f63` |
| Archive entries | 360 |
| Node / npm | Node v26.12.1, npm 11.7.0 |

The validation run on CI packed the candidate independently on Linux under Node 24 and recorded
the **same** digest, so the pack is reproducible across operating systems and Node versions, not
merely re-verifiable on one machine. CI pins Node 24 and the local run used Node 26.12.1; the
package declares `engines.node >= 24`, so both satisfy it, but the difference is recorded rather
than glossed.
<!-- candidate:end -->

The full per-gate record — command, exit code, duration, digest, evidence link, and every row
that did not run and why — is `.claude/release-candidate-0.12.0.json`. The `0.11.0` record
(`.claude/release-candidate-w108.json`) and the W107 record before it are history and are not
evidence for this candidate.

## 2. Registry access, checked read-only

The access mechanism is a GitHub token with `read:packages` (to check availability) and
`write:packages` (to publish). The release workflow uses `secrets.GITHUB_TOKEN` with
`packages: write`; **no credential was chosen, created or entered while producing this
checklist**, and the check below is read-only.

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.12.0
```

Result on the candidate: **`OK registry`** in the validation run on CI
([40556997077](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/40556997077)),
where the workflow's own token reads the scoped registry. Locally the check **could not be
evaluated** — exit 2, once with no credential and once with a token that answered 403 for lack of
`read:packages` — and it is recorded as unevaluated, not as a pass.

The same guard **rejects** an already-published version, which is what makes the positive answer
worth anything:

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.8.0
# REJECTED registry — @the-running-dev/game-engine@0.8.0 is already published … (exit 1)
```

An absent credential, a 401, a 403 or an unreachable registry all exit **2** — "could not be
evaluated" — and never `publishable`. A failing availability check is not proof that publication
is possible, and this guard will not let it read as one.

**The registry is two candidates behind the source.** `0.10.0` was tagged and never published:
its release run
([33721497785](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/33721497785))
failed in 11 seconds on a shell syntax error inside the tag/version guard, before any publish
step. `0.11.0` was qualified and superseded before it was tagged. `0.8.0` is still the latest
published version.

## 3. Non-publishing validation commands

Every command here is non-publishing. `npm publish` is not reachable from any of them.

```bash
# the guards, individually
node src/engine/scripts/verify-release.mjs mode --event workflow_dispatch --ref refs/heads/main --input-tag v0.12.0
node src/engine/scripts/verify-release.mjs tag --tag v0.12.0
node src/engine/scripts/verify-release.mjs clean
node src/engine/scripts/verify-release.mjs archive --archive src/engine/<tarball> --expect <sha256>
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.12.0
```

`archive --expect` takes the archive's SHA-256 digest, not the candidate's commit SHA. Passing
the commit SHA is rejected, which is the guard working.

```bash
# the guards, as the release workflow runs them, with the negatives, publishing nothing
gh workflow run release-engine-package.yml --ref release/0.12.0-candidate -f tag=v0.12.0
```

The same validation path also runs automatically on any pull request touching
`src/engine/package.json`, `src/engine/package-lock.json`, the guards, or the workflow. Mode is
derived from the trigger, not from an input: only a real `refs/tags/v*` push returns `publish`.

## 4. Gate evidence

`.claude/release-candidate-0.12.0.json` is the record. Every row carries its command, exit code,
duration, artifact digest and evidence link. Rows that did not run say so and name why; an
unavailable check is never rendered as a pass.

The one archive in §1.1 is the archive every archive consumer used. Source-only checks (text
client, MCP server, site, docs, host) and submodule consumers identify the same candidate SHA.

## 5. Release-note source

The changelog is generated from `main`'s merge history into `docs/docs/engine/CHANGELOG.md` by the
docs workflow's `changelog` input (GitHub-ActionTemplates `actions/changelog`). There is no
hand-maintained changelog and this checklist does not start one.

The immutable release-note source for `0.12.0` is the commit range — 157 commits:

```bash
git log --oneline v0.10.0..914383610dc2afbb26fe2e224206dbf0a7b2d9e4
```

The range starts at `v0.10.0`, not at `0.11.0`, because `0.11.0` was never tagged. Use the
generated changelog entries in that range as the release notes. Do not retype them.

## 6. Publication — the separate explicit action

Steps 1–3 were done on 2026-10-28: `v0.12.0` was pushed at the candidate, and
[run 40601204925](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/40601204925)
published the archive at the §1.1 digest. Steps 4 and 5 followed the same day: the
[v0.12.0 release](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/releases/tag/v0.12.0),
and SubZeroDev.Adventures#90 merged as `9676271`.

1. Confirm §8 says readiness is authorized, and that the candidate SHA in §1.1 is still the
   commit you intend to publish. If `src/engine` has changed on `main` since, **re-verify**; the
   authorization names a SHA, not a branch.
2. Push the tag at that exact commit:
   ```bash
   git tag v0.12.0 914383610dc2afbb26fe2e224206dbf0a7b2d9e4
   git push origin v0.12.0
   ```
3. `release-engine-package.yml` runs in `publish` mode. It re-runs every guard, re-verifies the
   archive digest against the one it just recorded, and publishes **that archive**
   (`npm publish <tarball>`) rather than packing a second, uninspected time.
4. Create the GitHub release against `v0.12.0`, with the §5 notes.
5. Merge [SubZeroDev.Adventures#90](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/90),
   which pins the engine submodule to the tagged candidate. It is held until the tag exists so
   that Adventures never pins an engine commit no tag names.

## 7. After publication — verification and recovery

Checks 1–4 below were run against the registry copy on 2026-10-28: the registry guard
rejected 0.12.0 as already published, the downloaded archive matched the §1.1 digest
(360 entries), the consumer smoke installed, built and ran from it, and `.` and
`./authoring` resolved while `dist/` paths were refused (`ERR_PACKAGE_PATH_NOT_EXPORTED`).

**Verify (separately executed):**

1. Registry metadata:
   ```bash
   node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.12.0
   # must now REJECT with "already published" (exit 1) — that is the success signal here
   ```
2. Download the published tarball and compare its SHA-256 against §1.1. A different digest means
   something other than the approved artifact was published; stop and investigate.
   ```bash
   npm pack @the-running-dev/game-engine@0.12.0
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

**Recovery.** The last known-good published version is **`0.8.0`** (registry `dist-tags.latest`
at the time of writing). Consumer rollback is a pinned reinstall:

```bash
npm install @the-running-dev/game-engine@0.8.0
```

Companions pin exact versions rather than ranges, so rollback is a one-line change in each
consumer and needs no registry operation.

**Deprecation — and its limits.** `0.12.0` is never overwritten, republished, or reused, and the
`v0.12.0` tag is never moved. **The recovery procedure this checklist promises is consumer-side
rollback to `0.8.0` plus publishing a corrected higher version, full stop** — decided 2026-09-13
(`design/90-decisions.md`). `npm deprecate` and `dist-tag` management are npmjs-registry features
whose GitHub Packages support this repository has never exercised, and npmjs behaviour must not be
assumed. A registry-supported deprecation remains available to test if a real withdrawal is ever
needed; it is not a precondition for this procedure.

## 8. Authorization

**0.12.0 readiness is not blocked.** Publishing remains a separate explicit action that nothing
in this file performs.

The whole matrix was rerun against the candidate in §1.1. Nothing was carried forward from the
`0.11.0` record.

| Gate | Result on the candidate |
|---|---|
| Engine `typecheck`, `lint`, `test` | exit 0 each; 122 test files, 2419 tests passed |
| Compatibility sweep vs `v0.10.0` | exit 0. Replay oracle: 3 files, 51 passed, 6 skipped. Pack and archive inspection: 360 entries, digest in §1.1. Consumer smoke against that archive: install, build, smoke pass |
| Release guards, local | `mode` resolves `publish` only for a `refs/tags/v0.12.0` push; `validate` for dispatch and pull request; unevaluated (exit 2) for a branch push with no tag. `tag v0.12.0` OK, `tag v0.11.0` rejected. `clean` OK. `archive` OK against the digest, rejected against the commit SHA. Guard suite 26 of 26 |
| Release validation run on CI | [40556997077](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/40556997077) green at the candidate: mode, tag, clean, registry and archive guards OK, the same digest packed independently, consumer smoke passed, digest re-verified, all three negatives rejected (tag `v0.0.0`, a modified tree, a substituted archive). Publish step skipped |
| Static host | `dotnet test`: 12 of 12, 0 skipped. Container build, route and probe smoke and the negative fixture: *Build, run, and smoke the image* on the candidate pull request |
| Documentation | generators are a no-op; drift check passes across 19 generated pages; Markdown checks pass. Production Docusaurus build: *docs / Build* on the candidate pull request |
| Site | locally: `ci`, `format:check`, `lint`, `typecheck` exit 0; `test` 20 of 20; `test:merge` exit 0. `test:browser` and `test:build` did not complete locally, because Dropbox held `.vite/vitest` and `site/dist`. *docs / Build* on the candidate pull request runs the whole `check merge` |
| Adventures (host evidence) | see below |
| ServiceContract | at its own commit with `0.10.0`: build, 59 of 59 tests, typecheck pass. Against the candidate archive, the build refuses with `EngineVersionMismatch`, as designed, because its authored engine version is `0.10.0`. With that one value moved to `0.12.0`: build passes (13 operations, 26 schemas), 58 of 59 tests (the failure is the test that asserts the authored version), typecheck passes |
| Platform `game-service` | typecheck fails on the two persistence changes below; tests 122 passed, 75 failed, 1 skipped. Not blocking, see below |
| GameOfLife | typecheck fails on the manifest-digest change below; 76 of 76 tests and the spec-set check pass. Not blocking, see below |

**Adventures host evidence**, bound as `design/90-decisions.md` (2026-10-25) requires, on
[SubZeroDev.Adventures#90](https://github.com/The-Running-Dev/SubZeroDev.Adventures/pull/90):

| | |
|---|---|
| Engine SHA | `914383610dc2afbb26fe2e224206dbf0a7b2d9e4` |
| Archive digest | `e76fbf5d5c0ea97ea0168be0c23100f840ae366f1bb17a32936ab7e7e22d7f63` |
| Adventures commit | `abcc1ab598f41a2fd2e3e0ef08a444fa50179772` |
| Content snapshot | `public/campaigns` tree `ff169b24512499c1ceef5df91b3bb9f832d424e9`; SHA-256 of the sorted 12-file manifest `fd134948c0e1deae1ecb898d34956e98491f974fb125d5b4a11c3404644bd19c` |
| CI run | [40556942573](https://github.com/The-Running-Dev/SubZeroDev.Adventures/actions/runs/40556942573) |

On `postgres:17`, the `server` job ran 24 files and **287 tests, all passed, none skipped**. Every
DB-gated suite in Adventures is declared `databaseUrl ? describe : describe.skip`, so a skip would
appear in that count; there is none. That run includes the Postgres session adapter and its
compare-and-swap conflict (`persistence.test.ts`, and the concurrent-write case in `api.test.ts`),
the independent-rebuild suite (`composition.test.ts`), and authoritative offline replay through
the retained pre-bump runtime (`offline/offline.test.ts`). The `offline-e2e` job exercises durable
offline play and authoritative synchronization in a browser against the same database.

**Compatibility with `0.10.0` depends on which side of the API you are on.** For code that plays
the engine, `0.12.0` is a compatible superset: the sweep's replay oracle and the packed consumer
pass unchanged, and nothing the `0.10.0` surface exposed was removed. It is **breaking** in three
deliberate changes, all recorded. Two affect a host that implements the persistence ports:

- `StoredSessionRecord.revision` is required: the compare-and-swap field from S122
  ([#572](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/572)).
- `PlayerProfile` is `formatVersion: 3` with a required `kindData`: per-kind profile data from S133
  ([#591](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/591)). The decision for
  it in `design/90-decisions.md` calls it expensive to reverse.

The third affects an authoring pipeline that publishes portable manifests:

- `digestManifestResolution` takes `readonly PortableManifestEntry[]` instead of `PackRef[]`, and
  digests the ordered `{id, version, digest}` list instead of `{id, version}`. A manifest's
  `resolution` therefore changes for unchanged content. The helper is also now a package-root
  export. This came in with
  [#528](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/528), which was described
  as a dependency move and went unrecorded until this sweep; `design/90-decisions.md`
  (2026-10-27) records it now. The same pull request replaced `@noble/hashes` with
  `subzerodev-data-json`, so a consumer that pins the engine by path must refresh its lockfile.

Adventures.Content's `scripts/export-content.ts` already passes whole manifest entries, so its
call compiles under either signature; its next export publishes a `resolution` from the new
recipe. That repository was not run against the candidate. GameOfLife was, and with a refreshed
lockfile its `scripts/export-content.ts` fails typecheck where it passes `{id, version}` objects. Its 76 tests
and spec-set check pass, and its committed `content/manifest.json` carries a `resolution` computed
by the old recipe. It pins and vendors `0.10.0`, so publishing does not break it. Moving it is a
follow-up in that repository: pass the full entries, re-export `content/`, refresh the lockfile.

Adventures already implements both persistence changes, as the `server` job above shows. Platform `game-service`
does not. Against the candidate tarball its typecheck fails on exactly these two changes. Most of
its 75 failing tests stop earlier, at the authored-engine-version guard, because the contract it
consumes was generated at `0.10.0`; that guard is working as designed (see the record). Platform
pins and vendors `0.10.0`, so publishing `0.12.0` does not break it. Moving Platform to `0.12.0`
is follow-up work, in order: regenerate ServiceContract at `0.12.0`, then update Platform's
adapters.

## 9. History

`0.11.0` was qualified at `2b525d3` (W108) and superseded before it was tagged. Its §8 and §9 —
the W93–W107 criterion-level reconciliation, the GameOfLife `stable-life` mismatch closed by
[SubZeroDev.GameOfLife#120](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife/pull/120),
the Platform Postgres profile closed once Docker was available, and the W98.2 and W108.2
decisions of 2026-09-13 — are in this file's history at `2b525d3`'s successors and in
`.claude/release-candidate-w108.json`. None of it is evidence for `0.12.0`; every row was rerun.

## 10. Scope fence

Anything that changes `src/engine` before `0.12.0` publishes invalidates the candidate in §1.1:
the tree being published is then no longer the tree verified here, and the whole matrix reruns
against a new candidate. Plan 54 (durable content epochs in Adventures, whose engine contract
slice amends `src/engine`) and World Graph steps 3 and 5 are post-`0.12.0` scope for exactly this
reason.
