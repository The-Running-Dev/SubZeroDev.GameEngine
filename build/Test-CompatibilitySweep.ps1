<#
.SYNOPSIS
Runs the 0.11 release-candidate compatibility sweep (W104) from a clean checkout.

.DESCRIPTION
Composes, into one documented command, the checks that together decide whether
the current tree can call itself a compatibility candidate against a prior
release tag (W104.7):

  1. typecheck, lint, and the full test suite from src/engine -- includes the
     W96.2/W104.1 regression-evidence manifest (regressionManifest.test.ts and
     scripts/w104-manifest.test.ts), which fails the moment a named suite, fixture,
     host, built-in campaign/version, or packed-consumer file goes missing; the v0.10.0
     compatibility baseline comparison (W104.2, scripts/capture-compat-baseline.test.ts);
     and the representative-save load-through-SessionStore proof (W104.3,
     scripts/capture-save-fixtures.test.ts). This is also W104.5's in-repository evidence
     for the text client and MCP server: `lint` re-runs the client-boundary rule
     (eslint.config.js) that fails if either imports a kind instead of calling only
     `SessionStore`, and `test` re-runs their full API-coverage suites
     (src/clients/text/client.test.ts, src/mcp/server.test.ts) against a real store built
     from the same source this sweep packs below. Neither is a published export (only `.`
     and `./authoring` are), so there is no separate "against the packed archive" step for
     them the way there is for consumer-smoke. W104.5's other three named consumers --
     the static host, Adventures, and the service-contract generator -- live in
     repositories this one does not contain and stay unverified here, the same
     cross-repo limit #391 recorded for W103.7.
  2. The replay regression oracle (07-replay.md), run locally against the
     baseline tag's own committed fixtures and outcomes -- the same
     REPLAY_BASELINE_DIR mechanism .github/workflows/ci.yml's
     release-tag-replay job runs automatically on every release tag push.
     Running it here proves W104.4 (byte-identical replay) without waiting
     for a tag.
  3. npm pack, with the same tarball-content assertions ci.yml's engine job
     makes (no src/, no tsconfig, no test artifacts, dist/ present) --
     W104.6's clean-pack half.
  4. The packed-tarball consumer smoke (consumer-smoke/), installed with no
     workspace resolution back into src/engine -- W104.6's install/compile/run
     half, exercising the public and ./authoring entry points together.

This script does not replace ci.yml's two jobs; it reproduces their combined
result on demand, from any machine, without needing a release tag pushed
first -- exactly the gap W104 exists to close before 0.11 is cut.

.PARAMETER BaselineTag
The prior release tag to compare replay fixtures against. Defaults to the
most recent 'v*' tag reachable from HEAD, matching ci.yml's own
"previous tag" resolution.

.PARAMETER SkipConsumerSmoke
Skip the packed-tarball consumer-smoke step. For a fast local re-run of the
engine-only checks; CI always runs the full sweep.
#>
[CmdletBinding()]
param (
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string] $BaselineTag,

    [Parameter()]
    [switch] $SkipConsumerSmoke
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

function Find-RepositoryRoot {
    param ([Parameter(Mandatory)] [string] $StartPath)
    $current = Resolve-Path -LiteralPath $StartPath | Select-Object -ExpandProperty Path
    while ($true) {
        if (Test-Path -LiteralPath (Join-Path $current '.git')) { return $current }
        $parent = Split-Path -Path $current -Parent
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) {
            throw "Could not find a repository root (.git) above '$StartPath'."
        }
        $current = $parent
    }
}

$repoRoot = Find-RepositoryRoot -StartPath $PSScriptRoot
$enginePath = Join-Path $repoRoot 'src/engine'
$consumerSmokePath = Join-Path $repoRoot 'consumer-smoke'

function Invoke-Step {
    param (
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [scriptblock] $Script
    )
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Script
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "Compatibility sweep failed at step: $Name (exit $LASTEXITCODE)"
    }
}

if (-not $BaselineTag) {
    $tags = git -C $repoRoot tag --list 'v*' --sort=-v:refname
    if (-not $tags) {
        throw "No 'v*' tags found — nothing to compare the replay corpus against yet."
    }
    $BaselineTag = ($tags -split "`n")[0]
}
Write-Host "Compatibility sweep baseline tag: $BaselineTag" -ForegroundColor Yellow

Push-Location $enginePath
try {
    Invoke-Step 'Install dependencies' { npm ci }
    Invoke-Step 'Typecheck' { npm run typecheck }
    Invoke-Step 'Lint' { npm run lint }
    Invoke-Step 'Test (includes W104.1 regression-evidence manifest)' { npm test }

    Invoke-Step "Replay oracle vs $BaselineTag (W104.4)" {
        $baselineDir = Join-Path ([System.IO.Path]::GetTempPath()) "replay-baseline-$BaselineTag"
        if (Test-Path $baselineDir) { Remove-Item $baselineDir -Recurse -Force }
        New-Item -ItemType Directory -Path $baselineDir | Out-Null

        $paths = git -C $repoRoot ls-tree -r --name-only $BaselineTag -- src/engine/fixtures/replay |
            Where-Object { $_ -match '\.(fixture|outcome)\.json$' }
        foreach ($path in $paths) {
            $name = Split-Path -Path $path -Leaf
            git -C $repoRoot show "${BaselineTag}:${path}" | Out-File -FilePath (Join-Path $baselineDir $name) -Encoding utf8
        }
        if (-not (Get-ChildItem -Path $baselineDir -Filter '*.fixture.json' -ErrorAction SilentlyContinue)) {
            Write-Host "$BaselineTag predates the replay corpus — nothing to compare yet." -ForegroundColor Yellow
            return
        }

        $env:REPLAY_BASELINE_DIR = $baselineDir
        try {
            npx vitest run `
                src/campaigns/bulgaria-bureaucracy.replay.test.ts `
                src/campaigns/stable-life.replay.test.ts `
                src/campaigns/world-graph-mvp.replay.test.ts
        } finally {
            Remove-Item Env:\REPLAY_BASELINE_DIR
        }
    }

    $tarballPath = $null
    Invoke-Step 'Pack package (W104.6)' {
        $tarballName = (npm pack --silent | Select-Object -Last 1).Trim()
        $script:tarballPath = Join-Path $enginePath $tarballName
    }

    Invoke-Step 'Inspect tarball contents (W104.6)' {
        $entries = tar -tzf $tarballPath
        if ($entries | Select-String -Pattern '(^|/)src/') { throw 'tarball contains source files under src/' }
        if ($entries | Select-String -Pattern '(^|/)tsconfig[^/]*\.json$') { throw 'tarball contains tsconfig JSON files' }
        if ($entries | Select-String -Pattern '\.test\.(js|mjs|ts|d\.ts|js\.map|mjs\.map|ts\.map)$') { throw 'tarball contains test build artifacts' }
        if (-not ($entries | Select-String -Pattern '^package/dist/')) { throw 'tarball does not contain dist output' }
    }

    if (-not $SkipConsumerSmoke) {
        Push-Location $consumerSmokePath
        try {
            if (Test-Path 'node_modules') { Remove-Item 'node_modules' -Recurse -Force }
            if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }
            $env:ENGINE_TARBALL = $tarballPath
            try {
                Invoke-Step 'Consumer smoke: install (W104.6)' { npm ci }
                Invoke-Step 'Consumer smoke: install engine tarball (W104.6)' { npm run install:engine }
                Invoke-Step 'Consumer smoke: build + run (W104.6)' { npm run build; npm run smoke }
            } finally {
                Remove-Item Env:\ENGINE_TARBALL
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "Skipping consumer smoke (-SkipConsumerSmoke)." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

Write-Host "Compatibility sweep passed against baseline $BaselineTag." -ForegroundColor Green
