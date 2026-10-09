<#
.SYNOPSIS
The release workflow's stages (.github/workflows/release-engine-package.yml), one per -Stage.

.DESCRIPTION
The workflow runs the same stages in `publish` and `validate` mode, so the guards that gate a
publication are the guards a validation run exercises (W108.5). The guard logic itself lives in
src/engine/scripts/verify-release.mjs, where it is unit tested; these stages only sequence it.

Values move between steps as workflow step outputs, passed here as environment variables:

  Mode             EVENT_NAME, GIT_REF, INPUT_TAG       -> writes mode, tag to GITHUB_OUTPUT
  Registry         NODE_AUTH_TOKEN                      -> exit 2 is "could not be evaluated"
  RegistryOutcome  REGISTRY_OUTCOME, MODE               -> job summary line
  Pack             (none)                               -> writes tarball to GITHUB_OUTPUT
  Archive          TARBALL [, DIGEST]                   -> writes digest to GITHUB_OUTPUT, or re-checks DIGEST
  Consumer         TARBALL                              -> consumer smoke against that archive
  Negatives        TARBALL, DIGEST                      -> each guard must reject its case
  Publish          TARBALL, DIGEST, NODE_AUTH_TOKEN     -> npm publish of the inspected archive
  Report           MODE, TAG, TARBALL, DIGEST           -> job summary

A local validation run needs no GitHub variables: GITHUB_OUTPUT and GITHUB_STEP_SUMMARY are
optional, and the outputs are printed instead.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory)]
    [ValidateSet('Mode', 'Registry', 'RegistryOutcome', 'Pack', 'Archive', 'Consumer', 'Negatives', 'Publish', 'Report')]
    [string] $Stage
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$enginePath = Join-Path $repoRoot 'src/engine'
$guard = 'scripts/verify-release.mjs'

function Get-EnvironmentValue {
    param ([Parameter(Mandatory)] [string] $Name)
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($null -eq $value) { return '' }
    return $value
}

function Add-Output {
    param ([Parameter(Mandatory)] [string] $Line)
    Write-Host $Line
    if ($env:GITHUB_OUTPUT) { Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value $Line }
}

function Add-Summary {
    param ([Parameter(Mandatory)] [string] $Text)
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Text -NoNewline }
}

# Runs a command from src/engine and returns its exit code, printing what it wrote.
function Invoke-Guard {
    param ([Parameter(Mandatory)] [string[]] $Arguments)
    Push-Location $enginePath
    try {
        $lines = @(& node $guard @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $lines | ForEach-Object { Write-Host $_ }
    return [pscustomobject]@{ Code = $code; Lines = $lines }
}

function Assert-Guard {
    param ([Parameter(Mandatory)] [string[]] $Arguments)
    $result = Invoke-Guard $Arguments
    if ($result.Code -ne 0) { exit $result.Code }
    return $result
}

function Get-Manifest {
    Get-Content -LiteralPath (Join-Path $enginePath 'package.json') -Raw | ConvertFrom-Json
}

function Get-Required {
    param ([Parameter(Mandatory)] [string] $Name)
    $value = Get-EnvironmentValue $Name
    if (-not $value) { throw "Stage $Stage needs the $Name environment variable." }
    return $value
}

switch ($Stage) {
    # A validation run has no tag of its own, so it validates against the tag the current
    # manifest would require. That is the whole point: the candidate is checked before a tag
    # exists, not after one has been pushed.
    'Mode' {
        $tag = Get-EnvironmentValue 'INPUT_TAG'
        if (-not $tag) { $tag = "v$((Get-Manifest).version)" }
        $result = Assert-Guard @('mode', '--event', (Get-EnvironmentValue 'EVENT_NAME'), '--ref', (Get-EnvironmentValue 'GIT_REF'), '--input-tag', $tag)
        foreach ($line in $result.Lines | Where-Object { $_ -match '^(mode|tag)=' }) { Add-Output $line }
    }

    # Exit 2 is "could not be evaluated", which is not a pass. In validation mode the workflow
    # records that and continues; a publish run requires a real answer.
    'Registry' {
        $manifest = Get-Manifest
        [void] (Assert-Guard @('registry', '--package', $manifest.name, '--version', $manifest.version))
    }

    'RegistryOutcome' {
        Add-Summary ("- Registry availability guard: **{0}** (mode ``{1}``)`n" -f (Get-EnvironmentValue 'REGISTRY_OUTCOME'), (Get-EnvironmentValue 'MODE'))
    }

    # `prepack` starts by removing dist, so this is the package that would publish from a clean
    # checkout. The sentinel proves that: a file planted in dist beforehand must not survive
    # into the archive. The tarball path is an output -- every later step must use this
    # archive, never a second pack.
    'Pack' {
        Push-Location $enginePath
        try {
            [void] (New-Item -ItemType Directory -Force -Path 'dist')
            [System.IO.File]::WriteAllText((Join-Path $enginePath 'dist/stale-sentinel.txt'), "stale output from a previous build`n")
            $tarball = "$(npm pack --silent | Select-Object -Last 1)".Trim()
            if ($LASTEXITCODE -ne 0) { throw "'npm pack' failed with exit code $LASTEXITCODE." }
            if (-not $tarball) { throw 'npm pack produced no tarball name.' }
            if (-not (Test-Path -LiteralPath $tarball -PathType Leaf)) { throw "npm pack did not produce $tarball." }
            if (@(tar -tzf $tarball) -match 'stale-sentinel') {
                throw 'the clean build did not remove stale dist output'
            }
            Add-Output "tarball=$tarball"
        } finally {
            Pop-Location
        }
    }

    # Without DIGEST this inspects the archive and records its digest. With DIGEST it
    # re-checks that the archive the consumer smoke used is still the inspected one.
    'Archive' {
        $arguments = @('archive', '--archive', (Get-Required 'TARBALL'))
        $digest = Get-EnvironmentValue 'DIGEST'
        if ($digest) { $arguments += @('--expect', $digest) }
        $result = Assert-Guard $arguments
        if (-not $digest) {
            foreach ($line in $result.Lines | Where-Object { $_ -match '^digest=' }) { Add-Output $line }
        }
    }

    'Consumer' {
        $env:ENGINE_TARBALL = Join-Path $enginePath (Get-Required 'TARBALL')
        try {
            foreach ($arguments in @(@('ci'), @('run', 'install:engine'), @('run', 'build'), @('run', 'smoke'))) {
                npm --prefix (Join-Path $repoRoot 'consumer-smoke') @arguments
                if ($LASTEXITCODE -ne 0) { throw "'npm $($arguments -join ' ')' failed with exit code $LASTEXITCODE." }
            }
        } finally {
            Remove-Item Env:\ENGINE_TARBALL -ErrorAction SilentlyContinue
        }
    }

    # Negative evidence. A guard that has never rejected anything is not known to constrain
    # anything, so a validation run proves each rejection against this very candidate. Each
    # case must exit 1: exiting 0 fails the stage, and so does exit 2 ("could not be
    # evaluated"), which is not evidence that the guard fired.
    'Negatives' {
        $tarball = Get-Required 'TARBALL'
        $digest = Get-Required 'DIGEST'

        function Assert-Rejected {
            param (
                [Parameter(Mandatory)] [string] $Label,
                [Parameter(Mandatory)] [string[]] $Arguments
            )
            $code = (Invoke-Guard $Arguments).Code
            if ($code -eq 0) { throw "NOT REJECTED: $Label" }
            if ($code -ne 1) { throw "WRONG EXIT for ${Label}: expected 1 (rejected), got $code" }
            Add-Summary "- Rejected as expected: $Label`n"
        }

        Assert-Rejected 'a tag that does not match the manifest version' @('tag', '--tag', 'v0.0.0')

        $readme = Join-Path $repoRoot 'README.md'
        [System.IO.File]::AppendAllText($readme, "`n")
        try {
            Assert-Rejected 'a candidate tree with a tracked modification' @('clean', '--root', $repoRoot)
        } finally {
            git -C $repoRoot checkout -- README.md
        }

        $substituted = Join-Path $enginePath 'substituted.tgz'
        Copy-Item -LiteralPath (Join-Path $enginePath $tarball) -Destination $substituted
        try {
            [System.IO.File]::AppendAllText($substituted, "appended`n")
            Assert-Rejected 'an archive modified after its digest was recorded' @('archive', '--archive', $substituted, '--expect', $digest)
        } finally {
            Remove-Item -LiteralPath $substituted -Force
        }
    }

    # The only stage that publishes, and the workflow reaches it only when `mode` returned
    # `publish` -- which needs a real `refs/tags/v*` push. It re-verifies the digest first and
    # then publishes that exact archive, so the bytes inspected above are the bytes that ship;
    # `npm publish` with no argument would pack a second, unverified time.
    'Publish' {
        $tarball = Get-Required 'TARBALL'
        [void] (Assert-Guard @('archive', '--archive', $tarball, '--expect', (Get-Required 'DIGEST')))
        Push-Location $enginePath
        try {
            [System.IO.File]::WriteAllText((Join-Path $enginePath '.npmrc'), "//npm.pkg.github.com/:_authToken=$(Get-Required 'NODE_AUTH_TOKEN')`n")
            npm publish $tarball
            if ($LASTEXITCODE -ne 0) { throw "'npm publish' failed with exit code $LASTEXITCODE." }
        } finally {
            Pop-Location
        }
    }

    'Report' {
        Add-Summary @"

## Candidate

- Mode: ``$(Get-EnvironmentValue 'MODE')``
- Tag: ``$(Get-EnvironmentValue 'TAG')``
- Commit: ``$(Get-EnvironmentValue 'GITHUB_SHA')``
- Archive: ``$(Get-EnvironmentValue 'TARBALL')``
- Archive sha256: ``$(Get-EnvironmentValue 'DIGEST')``

"@
    }
}
