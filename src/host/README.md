# SubZeroDev.GameEngine.Host

The product-owned ASP.NET Core static host — design/15-platform-static-host.md (W62). A
delivery surround for the combined public site/roadmap/docs artifact, composed with
`SubZeroDev.Platform.Hosting`. It calls `AddPlatformWebHost()` and maps Platform's probes;
it adds no worker, persistence, migration, outbox, account, or session facility, and
exposes no engine API, game action, or runtime content endpoint. The engine still runs
entirely in the browser.

## Restoring `SubZeroDev.Platform.Hosting`

`nuget.config` in this directory points at GitHub Packages with no credential committed.
Restore needs a GitHub token with `read:packages`, supplied as environment variables NuGet
expands at restore time:

```bash
export NUGET_GITHUB_ACTOR="<your-github-username>"
export NUGET_GITHUB_TOKEN="$(gh auth token)"   # or a classic PAT with read:packages
dotnet build
```

## Running locally

The host serves whatever is in its `wwwroot`. It refuses to start if `index.html`,
`roadmap/index.html`, or `docs/index.html` is missing — that is the
same guard the container image's build proves red in CI (`StaticArtifact` in
`Program.cs`). To run against a real artifact, build the combined site+docs output first
(`npm --prefix site run merge`, the same package-backed merge `docs-ci.yml` and `docs-deploy.yml` use)
and copy it into `SubZeroDev.GameEngine.Host/wwwroot/` before `dotnet run`.

The container image (repository-root `Dockerfile`) does this assembly for you in one
build — see `design/15-platform-static-host.md` for the full pipeline and
`.github/workflows/host-image.yml` for how CI builds, runs, and smoke-tests it.

## Tests

`SubZeroDev.GameEngine.Host.Tests` covers the missing-artifact guard directly and boots
the real host (`WebApplicationFactory<Program>`) against a minimal fake artifact to prove
the required routes, the probes, and the absence of an SPA fallback.

```bash
dotnet test
```
