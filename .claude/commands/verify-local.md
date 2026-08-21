## gate-commands
| Flagged step | Workflow | Run locally |
|---|---|---|
| `Typecheck` | `ci.yml` | `npm --prefix src/engine run typecheck` |
| `Lint` | `ci.yml` | `npm --prefix src/engine run lint` |
| `Test` | `ci.yml` | `npm --prefix src/engine test` |
| `Pack package` | `ci.yml` | `cd src/engine; npm pack --silent` |
| `Inspect tarball` | `ci.yml` | `tar -tzf` the packed tarball; assert no `src/`, no `tsconfig*.json`, no `.test.*` artifacts, `package/dist/` present |
| `Consumer smoke` | `ci.yml` | Clear `consumer-smoke/{node_modules,package-lock.json,dist}`, then `npm run install:engine && npm run build && npm run smoke` |
| `Parse-check PowerShell scripts` | `verify.yml` | Parse every `*.ps1` with `[System.Management.Automation.Language.Parser]::ParseFile`, as the step does |
| `Run Pester tests` | `verify.yml` | `Invoke-Pester -Path tools -Output Detailed -PassThru` |
| `Validate the core/companion split` | `verify.yml` | `./tools/Test-Companion.ps1` |
| `Check the design state against the tree` | `verify.yml` | `./tools/Test-DesignState.ps1` |
| `Validate Markdown links, terminology, and generated files` | `docs-ci.yml` | `./build/Test-Documentation.ps1` |
| `Build documentation` | `docs-ci.yml` | `./docs.ps1 -BuildOnly` — needs Docker **and** an installed `docs.ps1` |
| `Build and verify landing page` | `docs-ci.yml` | `npm --prefix src/engine run build; npm --prefix site run check` |
| `Merge landing page into documentation build` | `docs-ci.yml` | `npm --prefix site run merge` — needs a completed docs build in `artifacts/docs` |
| `Test the host` | `host-image.yml` | `dotnet test src/host/SubZeroDev.GameEngine.Host.Tests/…csproj` — needs `NUGET_GITHUB_TOKEN` for the sibling-repo feed |
| `Positive route and probe smoke` | `host-image.yml` | Build and run the host image, then `curl` `/`, `/roadmap/`, `/docs/`, `/health/live`, `/health/ready` → 200 and an unknown route → 404 |
| `Negative fixture -- corrupted artifact must fail to start` | `host-image.yml` | `docker build -f tools/host-smoke/Dockerfile.negative-fixture …`; the run must exit non-zero |

Discover by reading the workflow files rather than trusting a memorized list; the seventeen rows
above describe this repository's gates as of the last sync, not a substitute for reading
`.github/workflows/*.yml` directly.

Local discovery, beyond the workflow files:
```powershell
if (Test-Path package.json) { Get-Content package.json | Select-String '"scripts"' -Context 0,20 }
Get-ChildItem . -Include *.sln, *.csproj -Recurse -Depth 2
if (Test-Path build) { Get-ChildItem build -Filter *.ps1 }
```
