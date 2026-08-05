# W62 — Platform Static Host Image

**Scope:** Implement the product-owned, web-only `SubZeroDev.Platform.Hosting` composition
specified in [`design/14-platform-static-host.md`](../design/14-platform-static-host.md), bake the
verified W61 site/docs artifact into a stateless container, prove it in PR CI, and publish an
immutable GHCR image from relevant `main` changes. Do not deploy it and do not host the engine.

**Depends on:** W61 and SubZeroDev.Platform S9 package publication. A temporary sibling project
reference may be used during development, but merge is blocked until an exact released Platform
package replaces it.

---

## Handoff — Start Here

Read [`CLAUDE.md`](../CLAUDE.md), [`agent.md`](../agent.md), the W62 spec above, and W62 in
[`design/30-slices.md`](../design/30-slices.md). Then inspect the current W61 artifact pipeline
before choosing filenames: W62 consumes its output and must not create a second site assembly.

Also read these files from sibling `../SubZeroDev.Platform` at implementation time because the
package surface may advance before S9:

1. `docs/docs/platform-identity.md`
2. `docs/docs/engine-hosting-contract.md`
3. `docs/docs/implementation-plan.md`
4. `docs/docs/adr/ADR-002-implementation-technology.md`
5. `docs/docs/adr/ADR-005-service-contract.md`
6. `samples/SubZeroDev.Platform.Sample.Web/Program.cs`

If those paths or the S9 package surface changed, reconcile this plan with the released package
before coding. Do not copy Platform source into this repository.

## Settled Decisions

| Concern | Decision |
|---|---|
| First hosting slice | Static delivery first; real hosted engine is W63 |
| Composition root | Product-owned under `src/host/` |
| Platform features | `AddPlatformWebHost()` plus probes; no worker or persistence |
| Current public host | GitHub Pages remains authoritative |
| Local bootstrap | Temporary sibling `ProjectReference` is allowed |
| Merge gate | Exact S9-or-later `SubZeroDev.Platform.Hosting` package is mandatory |
| Artifact assembly | Multi-stage build from one commit, using the protected merge |
| PR behavior | Build, start, positive/negative smoke; do not publish |
| Main behavior | Publish only on relevant input changes |
| Image identity | Immutable full-commit tag and digest; no `latest` |
| Deployment | None in W62 |

## Repository Reality to Re-verify

- `.github/workflows/docs-deploy.yml` currently owns the public GitHub Pages deployment.
- `build/Merge-LandingPage.ps1` protects the docs subtree while combining the standalone Vite
  output and Docusaurus output.
- `site/vite.config.ts` is the standalone multi-page build surface; W61 adds `/play/` there.
- The engine package requires Node.js 24, but the runtime host image must not contain Node.js.
- Platform currently targets the latest .NET line and exposes the supported web-host surface from
  `src/SubZeroDev.Platform.Hosting`; pin the released S9 result rather than this observation.

Stop if W61 has not produced one verified combined artifact, or if Platform S9 has not published a
consumable exact package. A sibling reference is permission to prototype, not permission to merge.

## Proposed File Map

Final names may follow repository conventions discovered at implementation time, but ownership
should remain this shape:

```text
src/host/
  SubZeroDev.GameEngine.Host.csproj
  Program.cs
  HostingOptions.cs                 # only if startup validation needs product settings
  SubZeroDev.GameEngine.Host.Tests/
    ...
build/
  Test-HostedArtifact.ps1           # route/probe/digest and negative smoke
.github/workflows/
  ci.yml                            # PR image build/smoke, preferably existing required job
  host-image.yml                    # path-filtered main GHCR publication
Dockerfile                          # one multi-stage production assembly, or host-scoped equivalent
.dockerignore
NuGet.config                        # package source only; never a credential
```

Prefer extending an existing CI workflow when that keeps required checks stable. A separate image
workflow is appropriate for `main` publication because it needs `packages: write`; PR jobs should
not receive that permission.

## Sequence

### 1. Freeze the consumed artifact contract

- Identify the exact W61 commands that build the Vite pages, build Docusaurus, and run the
  protected merge.
- Name one combined artifact directory and reuse it locally, in tests, and in the Docker build.
- Add an assertion inventory for `/`, `/roadmap/`, `/play/`, and `/docs/`, including expected
  metadata and the docs-subtree digest.
- Prove a deliberately missing route or modified docs file fails before adding the host.

### 2. Add the smallest product host

- Create the ASP.NET Core web project under `src/host/`.
- Initially use the sibling Hosting project only if S9 is not yet available.
- Compose `AddPlatformWebHost()`, static files, default documents, and Platform probes.
- Add startup validation for the baked artifact; do not add a catch-all fallback.
- Add focused tests for service registration, route behavior, missing artifact, and unknown-route
  `404`.

### 3. Build the production image

- Use pinned SDK/runtime and JavaScript toolchain images by digest where repository policy permits.
- Restore locked dependencies, build site and docs from the same checkout, and run the protected
  merge inside the build.
- Restore private NuGet packages through a BuildKit secret or equivalent non-persistent mount.
- Publish the host and copy only its output plus the verified artifact into the runtime stage.
- Run non-root and verify operation with a read-only root filesystem and no writable product
  volume.

### 4. Replace the bootstrap dependency

- After Platform S9, remove the sibling `ProjectReference`.
- Add one exact `PackageReference` for `SubZeroDev.Platform.Hosting`.
- Prove restore, build, and tests from a clean clone with no sibling repository present.
- Inspect the final image history and filesystem for package credentials, NuGet caches, project
  source, Node.js, npm, and build tools.

This phase is a merge gate, not cleanup deferred until release.

### 5. Add PR evidence

- Build the production image, start the exact image, and wait on readiness with a bounded timeout.
- Assert supported static routes, probe routes, metadata, docs digest, and unknown-route `404`.
- Run the W61 browser production smoke against the container and fail on an engine API or runtime
  content request.
- Send `SIGTERM`, require a clean bounded exit, and retain useful host logs on failure.
- Run the deliberately corrupted/missing-artifact case and assert non-zero build or startup.

### 6. Publish without deploying

- Add a `main` workflow filtered to the host, site, docs-build/merge tooling, container definition,
  workflow, and all relevant lockfiles. Include engine/package paths when they feed the browser
  bundle.
- Grant only `contents: read` and `packages: write` to the publish job.
- Push `ghcr.io/the-running-dev/game-engine-host:sha-<full-commit>` and record the registry digest
  in the job summary and provenance/attestation when supported.
- Do not push `latest`, update DNS, start a remote container, or modify Pages.

### 7. Reconcile documentation and hand off W63

- Update the W62 status and evidence links after implementation; do not mark it complete from a
  successful local prototype.
- Record the exact Platform package version and immutable image coordinate.
- Open W63 planning only after W62 is green. Its first boundary is one in-memory session through a
  generated JSON/HTTP contract with MCP as a projection, not static-host scope creep.

## Acceptance Evidence Matrix

| W62 criterion | Required evidence |
|---|---|
| W62.1 composition | host registration tests and dependency graph/package inspection |
| W62.2 released dependency | exact `PackageReference`, clean-clone restore, secret/image scan |
| W62.3 one artifact | container build log, merge guard, before/after docs digest |
| W62.4 routes/probes | running-image HTTP smoke with supported and unknown routes |
| W62.5 browser-local engine | W61 browser smoke plus captured request inventory |
| W62.6 runtime shape | image filesystem/history inspection, non-root/read-only run, `SIGTERM` test |
| W62.7 meaningful PR gate | positive smoke and deliberate red negative fixture |
| W62.8 publication | path-filter test, immutable GHCR tag, recorded digest, no `latest` |
| W62.9 Pages isolation | unchanged Pages workflow plus successful exact-merge check |

## Validation Commands

Adapt image coordinates to the implemented files, but preserve the evidence:

```powershell
npm --prefix site run check
./build/Test-Documentation.ps1
dotnet restore src/host/SubZeroDev.GameEngine.Host.csproj --locked-mode
dotnet test src/host/SubZeroDev.GameEngine.Host.Tests/SubZeroDev.GameEngine.Host.Tests.csproj
docker build --secret id=nuget_token,env=NUGET_TOKEN -t game-engine-host:w62 .
./build/Test-HostedArtifact.ps1 -Image game-engine-host:w62
git diff --check
git status --short --branch
```

Run the clean-clone/package-restore and image-content checks in CI as well; local sibling state can
otherwise make both pass for the wrong reason. Never print or persist `NUGET_TOKEN`.

## Risks and Stop Conditions

- **Platform S9 unavailable:** prototype may continue locally; PR remains draft and must not merge.
- **W61 artifact assembly differs between Pages and Docker:** stop and unify the assembly. Do not
  bless two production artifacts with similar route lists.
- **Private package restore requires a credential in a Docker layer:** stop and fix secret mounting
  before publishing any image.
- **Static middleware needs product behavior absent from Platform:** keep product policy here. Add a
  Platform feature only through a separate Platform decision and release, never a source copy.
- **A route works only by fallback:** fail it. Direct-file hosting is the contract.
- **Hosted action/session endpoint appears useful while implementing:** defer it to W63; it changes
  process, contract, failure, security, and persistence boundaries together.

## Done When

Every W62 checkbox in `design/30-slices.md` has named CI or registry evidence, the final dependency
is an exact released Platform package, the immutable GHCR image exists by digest, GitHub Pages is
unchanged, and nothing has been deployed.
