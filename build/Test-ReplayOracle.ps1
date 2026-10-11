<#
.SYNOPSIS
Runs the replay regression oracle's cross-version comparison (07-replay.md §8).

.DESCRIPTION
Runs *this* tree's engine against a *baseline* tag's own fixture submissions and committed
.outcome.json files together -- the "did this change alter a game that already exists"
question, distinct from the engine's own test run, which only compares a build against its
own commit's corpus (07-replay.md §1). Both the fixture and the outcome come from the
baseline tag: comparing this commit's (possibly edited or removed) fixtures against an old
recorded outcome would not be a clean version-to-version comparison.

Which tag is the baseline:

  * -BaselineTag, when given.
  * On a tag build (GITHUB_REF is refs/tags/<tag>): the tag before <tag> by version order.
  * Otherwise: the newest 'v*' tag, the same default build/Test-CompatibilitySweep.ps1 uses.

Skips cleanly (exit 0, not a failure) when there is no baseline tag yet (the very first tag
has nothing to compare against), or when the baseline predates the replay corpus (W22).

Assumes the engine's dependencies are installed and the tags are fetched. Run it from anywhere:

  pwsh -NoProfile -File ./build/Test-ReplayOracle.ps1
#>
[CmdletBinding()]
param (
    [Parameter()]
    [string] $BaselineTag
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$enginePath = Join-Path $repoRoot 'src/engine'
$corpusPath = 'src/engine/fixtures/replay'

# Writes one blob's bytes unchanged. Piping `git show` through PowerShell would decode and
# re-encode it, and the comparison is against the recorded bytes.
function Save-GitBlob {
    param (
        [Parameter(Mandatory)] [string] $Revision,
        [Parameter(Mandatory)] [string] $Destination
    )
    $start = [System.Diagnostics.ProcessStartInfo]::new('git')
    foreach ($argument in '-C', $repoRoot, 'show', $Revision) { $start.ArgumentList.Add($argument) }
    $start.RedirectStandardOutput = $true
    $process = [System.Diagnostics.Process]::Start($start)
    $file = [System.IO.File]::Create($Destination)
    try {
        $process.StandardOutput.BaseStream.CopyTo($file)
    } finally {
        $file.Dispose()
        $process.WaitForExit()
    }
    if ($process.ExitCode -ne 0) { throw "git show $Revision failed with exit code $($process.ExitCode)." }
}

if (-not $BaselineTag) {
    $tags = @(git -C $repoRoot tag --list 'v*' --sort=-v:refname)
    if ($env:GITHUB_REF -like 'refs/tags/*') {
        $current = $env:GITHUB_REF.Substring('refs/tags/'.Length)
        $index = [array]::IndexOf($tags, $current)
        if ($index -ge 0 -and $index + 1 -lt $tags.Count) { $BaselineTag = $tags[$index + 1] }
        if (-not $BaselineTag) {
            Write-Host "No previous tag before $current -- nothing to compare yet (M3, plans/27)."
            return
        }
        Write-Host "Comparing $current against $BaselineTag"
    } elseif ($tags.Count -gt 0) {
        $BaselineTag = $tags[0]
        Write-Host "Comparing this tree against $BaselineTag"
    } else {
        Write-Host "No 'v*' tags found -- nothing to compare yet."
        return
    }
}

$baselineDir = Join-Path ([System.IO.Path]::GetTempPath()) "replay-baseline-$BaselineTag"
if (Test-Path -LiteralPath $baselineDir) { Remove-Item -LiteralPath $baselineDir -Recurse -Force }
[void] (New-Item -ItemType Directory -Path $baselineDir)

$paths = @(git -C $repoRoot ls-tree -r --name-only $BaselineTag -- $corpusPath | Where-Object { $_ -match '\.(fixture|outcome)\.json$' })
foreach ($path in $paths) {
    Save-GitBlob -Revision "${BaselineTag}:$path" -Destination (Join-Path $baselineDir (Split-Path -Path $path -Leaf))
}
if (-not (Get-ChildItem -LiteralPath $baselineDir -Filter '*.fixture.json')) {
    Write-Host "$BaselineTag predates the replay corpus (W22) -- nothing to compare yet."
    return
}

# stable-life.replay.test.ts (simulation kind, W40) and world-graph-mvp.replay.test.ts
# (world-graph kind, W49) join bureaucracy's own suite here. All read REPLAY_BASELINE_DIR, and
# all degrade to zero test cases rather than a failure when the baseline predates their own
# slice of the corpus.
$env:REPLAY_BASELINE_DIR = $baselineDir
Push-Location $enginePath
try {
    npx vitest run `
        src/campaigns/bulgaria-bureaucracy.replay.test.ts `
        src/campaigns/stable-life.replay.test.ts `
        src/campaigns/world-graph-mvp.replay.test.ts
    if ($LASTEXITCODE -ne 0) { throw "The replay oracle failed against $BaselineTag (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
    Remove-Item Env:\REPLAY_BASELINE_DIR -ErrorAction SilentlyContinue
}
