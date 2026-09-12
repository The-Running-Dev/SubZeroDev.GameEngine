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
| Candidate commit | _recorded in §1.1 by the evidence commit — see the note below_ |
| Archive | _recorded in §1.1_ |
| Archive SHA-256 | _recorded in §1.1_ |
| Baseline for compatibility | tag `v0.10.0` |
| Registry | `https://npm.pkg.github.com` (GitHub Packages) |
| Intended visibility | public — the decision is in `design/90-decisions.md` §2 and is **not** reopened here |

**Why the candidate identity is filled in by a later commit.** A candidate is a committed tree.
Its SHA cannot be written into a file that is part of the same commit, and its archive digest
cannot be computed before that commit exists. So the release-only change is committed first and
*is* the candidate; the evidence commit that follows records the SHA and digest and changes
nothing the archive contains. That second commit is **not** the tested candidate, and the
authorization in §8 binds to the SHA it names, never to wherever `main` has since moved.

### 1.1 Recorded candidate

<!-- candidate:start -->
| | |
|---|---|
| Candidate commit | NOT YET RECORDED |
| Candidate committed | NOT YET RECORDED |
| Archive | NOT YET RECORDED |
| Archive SHA-256 | NOT YET RECORDED |
| Node / npm | NOT YET RECORDED |

> Filled in by the evidence commit that follows the candidate. While any row reads NOT YET
> RECORDED, nothing in this file authorizes anything.
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

The candidate is prepared and verified as far as this environment allows, but three criteria are
not established, so the authorization wording is deliberately not used:

| Criterion | Blocker |
|---|---|
| W108.2 | The registry-supported deprecation/withdrawal operation for GitHub Packages is undocumented and untested here. §7 states the limitation instead of a procedure, which is honest but is not the criterion. |
| W108.3 | W98.2 and W98.7 remain unchecked on [#386](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/386). §9 below records the evidence found for each and what is still missing. |
| W107.3 / W107.4 | The production Docusaurus build and the host container smoke need Docker, which was unavailable in this run. Both are listed as unavailable in the report, not as passes. |

The full per-criterion position is in `.claude/release-candidate-w108.json` and in
`design/30-slices.md`'s W107/W108 entries. No aggregate status overrides an unchecked criterion.

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

## 10. Scope fence

W109–W113 are `0.12` scope. They are contract-only today and **cannot change this candidate**.
If one of them lands before `0.11.0` publishes, the candidate in §1.1 is no longer the tree being
published and the whole matrix reruns against a new candidate.
