# Release Checklist — `@the-running-dev/game-engine@0.11.0`

This is the W108 release checklist. It records what was verified, on exactly which commit and
exactly which archive, and what a release owner must do to publish — **as a separate, explicit
action that nothing in this repository performs.**

> **Publication requires a separate explicit user action.** W108 prepares and verifies a
> candidate. It does not publish the package, push the `v0.11.0` tag, create a GitHub release,
> deploy the site, change DNS, or release anything in a companion repository. None of those
> happened while this checklist was produced.

Readiness status, and the wording that authorizes publication, is in
[§8 Authorization](#8-authorization). Read that before acting on anything below it.

---

## 1. Candidate identity

| | |
|---|---|
| Package | `@the-running-dev/game-engine` |
| Version | `0.11.0` |
| Required tag | `v0.11.0` (the guard rejects any other tag against this manifest) |
| Candidate commit | `2b525d38d6876829b35e9f5ff5fcf22af421f082` (see §1.1) |
| Archive | `the-running-dev-game-engine-0.11.0.tgz` |
| Archive SHA-256 | `53d5c1787d548e6b1defa35b48fe2301c9484a8e2d03f7523509abd9266b9db0` |
| Baseline for compatibility | tag `v0.10.0` |
| Registry | `https://npm.pkg.github.com` (GitHub Packages) |
| Intended visibility | public — the decision is in `design/90-decisions.md` §2 and is **not** reopened here |

**Why the candidate identity is filled in by a later commit.** A candidate is a committed tree.
Its SHA cannot be written into a file that is part of the same commit, and its archive digest
cannot be computed before that commit exists. So the release-only change is committed first and
*is* the candidate; the evidence commit that follows records the SHA and digest and changes
nothing the archive contains. That second commit is **not** the tested candidate, and the
authorization in §8 binds to the SHA it names, never to wherever `main` has since moved.

The same applies to any commit after the evidence one. Commits on this branch that follow
`2b525d3` fix the verification path, not the package: the archive contains `dist/`,
`package.json` and `README.md` only, so a change to a workflow, a guard test or this checklist
cannot alter its bytes. The digest in §1.1 is the check on that claim — re-pack and compare
rather than trusting this paragraph.

### 1.1 Recorded candidate

<!-- candidate:start -->
| | |
|---|---|
| Candidate commit | `2b525d38d6876829b35e9f5ff5fcf22af421f082` |
| Candidate committed | 2026-09-12T17:41:02+03:00 |
| Archive | `the-running-dev-game-engine-0.11.0.tgz` |
| Archive SHA-256 | `53d5c1787d548e6b1defa35b48fe2301c9484a8e2d03f7523509abd9266b9db0` |
| Archive entries | 332 |
| Node / npm | Node v25.3.0, npm 11.7.0 |

The archive digest was re-verified after the packed-consumer smoke and again after every
companion run, unchanged each time. CI pins Node 24 and this run used Node 25.3.0; the package
declares `engines.node >= 24`, so both satisfy it, but the difference is recorded rather than
glossed.
<!-- candidate:end -->

The full per-gate record — command, exit code, duration, digest, evidence link, and every row
that did not run and why — is `.claude/release-candidate-w108.json`. The superseded W107 record
is `.claude/release-candidate-w107.json`; it is kept as history and is not evidence for this
candidate.

## 2. Registry access, checked read-only

The access mechanism is a GitHub token with `read:packages` (to check availability) and
`write:packages` (to publish). The release workflow uses `secrets.GITHUB_TOKEN` with
`packages: write`; **no credential was chosen, created or entered while producing this
checklist**, and the check below is read-only.

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.11.0
```

Result on the candidate: `state=publishable` — the registry answered with 3 published versions
(`0.4.0`, `0.5.0`, `0.8.0`) and `0.11.0` is not among them. `dist-tags.latest` is `0.8.0`.

The same guard **rejects** an already-published version, which is what makes the positive
answer worth anything:

```bash
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.8.0
# REJECTED registry — @the-running-dev/game-engine@0.8.0 is already published … (exit 1)
```

An absent credential, a 401, a 403 or an unreachable registry all exit **2** — "could not be
evaluated" — and never `publishable`. A failing availability check is not proof that publication
is possible, and this guard will not let it read as one.

**`0.10.0` was tagged and never published.** Its release run
([33721497785](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/33721497785))
failed in 11 seconds on a shell syntax error inside the tag/version guard, before any publish
step. That is why the registry is two releases behind the source, and it is the direct reason
W108.5 requires the guards to be executable without pushing a tag.

## 3. Non-publishing validation commands

Every command here is non-publishing. `npm publish` is not reachable from any of them.

```bash
# the guards, individually
node src/engine/scripts/verify-release.mjs mode --event workflow_dispatch --ref refs/heads/main --input-tag v0.11.0
node src/engine/scripts/verify-release.mjs tag --tag v0.11.0
node src/engine/scripts/verify-release.mjs clean
node src/engine/scripts/verify-release.mjs archive --archive src/engine/<tarball> --expect <sha256>
node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.11.0
```

```bash
# the guards, as the release workflow runs them, with the negatives, publishing nothing
gh workflow run release-engine-package.yml --ref <branch> -f tag=v0.11.0
```

The same validation path also runs automatically on any pull request touching
`src/engine/package.json`, `src/engine/package-lock.json`, the guards, or the workflow. Mode is
derived from the trigger, not from an input: only a real `refs/tags/v*` push returns `publish`.

## 4. Gate evidence

`.claude/release-candidate-w108.json` is the record. Every row carries its command, exit code,
duration, artifact digest and evidence link. Rows that did not run say so and name why; an
unavailable check is never rendered as a pass.

The one archive in §1.1 is the archive every consumer check used. Source-only checks (text
client, MCP server, site, docs, host) identify the same candidate SHA.

## 5. Release-note source

The changelog is generated from `main`'s merge history by `build/ConvertTo-Changelog.ps1` into
`docs/docs/engine/CHANGELOG.md`. There is no hand-maintained changelog and this checklist does
not start one.

The immutable release-note source for `0.11.0` is the commit range:

```bash
git log --oneline v0.10.0..<candidate SHA>
```

Use the generated changelog entries in that range as the release notes. Do not retype them.

## 6. Publication — the separate explicit action

Nothing below has been done. It is written out so that the person doing it is not improvising.

1. Confirm §8 says readiness is authorized, and that the candidate SHA in §1.1 is still the
   commit you intend to publish. If `main` has moved, **re-verify**; the authorization names a
   SHA, not a branch.
2. Push the tag at that exact commit:
   ```bash
   git tag v0.11.0 <candidate SHA>
   git push origin v0.11.0
   ```
3. `release-engine-package.yml` runs in `publish` mode. It re-runs every guard, re-verifies the
   archive digest against the one it just recorded, and publishes **that archive**
   (`npm publish <tarball>`) rather than packing a second, uninspected time.
4. Create the GitHub release against `v0.11.0`, with the §5 notes.

## 7. After publication — verification and recovery

**Verify (separately executed, not part of W108):**

1. Registry metadata:
   ```bash
   node src/engine/scripts/verify-release.mjs registry --package @the-running-dev/game-engine --version 0.11.0
   # must now REJECT with "already published" (exit 1) — that is the success signal here
   ```
2. Download the published tarball and compare its SHA-256 against §1.1. A different digest means
   something other than the approved artifact was published; stop and investigate.
   ```bash
   npm pack @the-running-dev/game-engine@0.11.0
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

**Deprecation — and its limits.** `0.11.0` is never overwritten, republished, or reused, and the
`v0.11.0` tag is never moved. If a published `0.11.0` must be withdrawn, the intended operation
is a registry-supported deprecation of that exact version, leaving it installable but marked.

> **This has not been tested on GitHub Packages, and npmjs behaviour must not be assumed.**
> `npm deprecate` and `dist-tag` management are npmjs-registry features whose GitHub Packages
> support has not been exercised by this repository. Until one of them is actually run against a
> published version here, the only recovery this checklist can promise is **consumer-side
> rollback to `0.8.0` plus publishing a corrected higher version**. Establishing which
> registry-supported withdrawal operation works is open work, recorded in
> `design/90-decisions.md`'s open register — see [§8](#8-authorization), which is why W108.2 is
> not claimed complete.

## 8. Authorization

**0.11.0 readiness blocked.**

The full W107 matrix was rerun against the candidate in §1.1 — not carried forward from the
September 7 record, which is history. Most of it holds. Six things do not, and the authorization
wording in the brief is therefore deliberately not used:

| # | Criterion | Blocker | Whose call |
|---|---|---|---|
| 1 | W107.5 | **SubZeroDev.GameOfLife does not compile against the candidate engine.** `stable-life.ts` is missing `projects` and `businesses`, required on `SimulationCampaignSource` since W101. One typecheck error, 18 of 71 tests failing from it. **Not caused by 0.11.0** — re-pinning the submodule to the W107 candidate `31a24c3` reproduces the identical error, so it has existed since 2026-08-31 and W107's cited companion row did not detect it. | A companion-side fix, out of W108's scope by that unit's own terms |
| 2 | W107.3 | The production Docusaurus build did not run: the Docker daemon is down and `docs.ps1` is not installed in this worktree. It is the only gate that resolves routes and heading anchors. | Closes on this pull request's **Verify Documentation Build** check |
| 3 | W107.4 | The host container smoke, its route/probe 200s, its 404, its missing-artifact negative fixture and the host image digest did not run — same missing Docker daemon. The host's own 12 tests pass. | Closes on the **Platform Static Host Image** workflow |
| 4 | W107.5 | SubZeroDev.Platform's durable/Postgres profile could not run — `ECONNREFUSED 127.0.0.1:5432`, and no Docker to start a database. 52 of 198 tests unrun; the 145 in-memory tests pass against the retained archive. | Needs a Postgres, or a CI run of that profile |
| 5 | W108.2 | No registry-supported withdrawal operation is known to work on GitHub Packages, so §7 states a limitation rather than a procedure. | The user — closing it means deprecating a published version |
| 6 | W108.3 | W98.2 stays unchecked; its browser half is in a companion repository and the criterion has no cross-repository form. See §9. | The user — a parity proof or a scoped amendment |

Blockers 2, 3 and 4 are environmental, not findings about the candidate. Blocker 1 is a real
finding, and the most valuable thing the rerun produced: it is exactly what carrying the W107
companion evidence forward would have hidden.

The full per-gate record is `.claude/release-candidate-w108.json`. No aggregate status overrides
an unchecked criterion, and nothing in this file authorizes publication.

## 9. W93–W107 criterion-level reconciliation

**W107.4** was corrected by merged
[PR #461](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/461) (`a84d9c9`): the
static host receives no action, owns no session, and exposes no engine API, so the criterion no
longer requires session/action/save operations of it. The W107 report's failed row recorded the
*superseded* requirement and is kept as history. The W108 report exercises the corrected
requirement only — no engine API is added to this host.

**W98.7** (`typecheck`/`lint`/`test` from `src/engine/`; site and host checks pass with committed
replay outcomes unchanged) — the engine and site halves are established on this candidate, in the
report. The "committed replay outcomes unchanged" clause is **partly historical**:
[PR #414](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/414) deliberately updated
terminal-shape replay fixtures, so the corpus did move in that unit. It has not moved since, and
it did not move for `0.11.0` — the version bump regenerated no fixture. The host half needs
Docker and is unavailable here.

**W98.2** (text client, MCP `list_campaigns`, and the browser shelf render the same resolved
titles without starting a session or reading `ContentRegistry`) — the text and MCP halves are
covered in this repository's own suites. The browser half is no longer in this repository: the
in-repository `/play/` route was retired, and the browser surface is
[SubZeroDev.Adventures](https://github.com/The-Running-Dev/SubZeroDev.Adventures), where
`BrowserClient.listCampaigns()` is session-free and `PlayerHome` renders the catalog's resolved
`title`. That evidence is in a companion repository at a pinned commit, which is not the same
thing as the criterion's own proof, and retiring `/play/` did not retire catalog parity. The
criterion needs either a cross-repository parity proof or a narrowly scoped amendment through the
design process. **It stays blocked**; `/play/` was not recreated and the browser was not quietly
dropped.


**W107.5's companion row, reconciled.** The W107 report recorded this as Passed by citing issue
#392's point-in-time proof, because none of the four companion repositories were checked out in
that environment. All four were available for this rerun and all four were run fresh —
ServiceContract at its own commit (59 tests), Adventures and GameOfLife with their engine
submodules temporarily detached to the candidate SHA, and Platform with the retained 0.11.0
archive vendored in place of its 0.10.0 one. Every substitution was reverted and verified
afterwards. The run found what the citation could not: GameOfLife has not compiled against a
candidate engine since W101. The citation was not wrong about anything it claimed; it simply
could not have detected this, which is the argument for running rather than carrying forward.

## 10. Scope fence

W109–W113 are `0.12` scope. They are contract-only today and **cannot change this candidate**.
If one of them lands before `0.11.0` publishes, the candidate in §1.1 is no longer the tree being
published and the whole matrix reruns against a new candidate.
