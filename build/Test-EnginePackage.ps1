<#
.SYNOPSIS
Packs the engine, inspects the tarball, and runs the consumer smoke against that tarball.

.DESCRIPTION
The package half of the `engine` CI job (.github/workflows/ci.yml), run after the engine's
install, typecheck, lint and test:

  1. `npm pack` the engine (prepack builds dist/ and stages the LICENSE).
  2. Inspect the tarball with the release workflow's own archive guard
     (src/engine/scripts/verify-release.mjs), so a pull request is held to the rules a
     release is held to -- including the packed LICENSE (S128).
  3. Install that tarball into consumer-smoke/ with no link back into src/engine, then build
     and run the smoke. ENGINE_TARBALL points install-engine.mjs at the inspected archive, so
     the smoke checks the artifact that was inspected and not a second pack.

Assumes the engine's dependencies are installed. Run it from anywhere:

  pwsh -NoProfile -File ./build/Test-EnginePackage.ps1
#>
[CmdletBinding()]
param ()

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$enginePath = Join-Path $repoRoot 'src/engine'
$consumerSmokePath = Join-Path $repoRoot 'consumer-smoke'

function Invoke-Native {
    param (
        [Parameter(Mandatory)] [string] $Command,
        [string[]] $Arguments = @()
    )
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
    }
}

Write-Host '==> Pack package' -ForegroundColor Cyan
Push-Location $enginePath
try {
    $tarballName = (npm pack --silent | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0) { throw "'npm pack' failed with exit code $LASTEXITCODE." }
    $tarballName = "$tarballName".Trim()
    if (-not $tarballName) { throw 'npm pack produced no tarball name.' }
    $tarballPath = Join-Path $enginePath $tarballName
    if (-not (Test-Path -LiteralPath $tarballPath -PathType Leaf)) { throw "npm pack did not produce $tarballPath." }

    Write-Host '==> Inspect tarball' -ForegroundColor Cyan
    Invoke-Native node @('scripts/verify-release.mjs', 'archive', '--archive', $tarballPath)
} finally {
    Pop-Location
}

Write-Host '==> Consumer smoke' -ForegroundColor Cyan
Push-Location $consumerSmokePath
try {
    foreach ($folder in 'node_modules', 'dist') {
        if (Test-Path -LiteralPath $folder) { Remove-Item -LiteralPath $folder -Recurse -Force }
    }
    $env:ENGINE_TARBALL = $tarballPath
    Invoke-Native npm @('ci')
    Invoke-Native npm @('run', 'install:engine')
    Invoke-Native npm @('run', 'build')
    Invoke-Native npm @('run', 'smoke')
} finally {
    Remove-Item Env:\ENGINE_TARBALL -ErrorAction SilentlyContinue
    Pop-Location
}
