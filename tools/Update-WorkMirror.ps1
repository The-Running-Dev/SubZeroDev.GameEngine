#Requires -Version 7.0
<#
.SYNOPSIS
    The mirror generator: refreshes WorkRef records from the tracker
    (design/20-contract.md § tools/Update-WorkMirror.ps1).

.DESCRIPTION
    Writes design/state/work/<issue>.md records and nothing else - never an issue, never a
    label, never a milestone, never git (S14.1). `/track`'s alone; no other command invokes it
    and no other command writes a WorkRef.

    One WorkRef per currently-open issue. `Rank` degrades rather than failing: the issue's
    position in the per-repository GitHub Project when one places it, otherwise its milestone
    number, otherwise the issue number itself - falling through is not a finding, and an
    emitted WorkRef never lacks a Rank (S14.3). `Criteria` is read from `- [ ] **<id>**`
    checkbox lines in the issue body, the same shape every issue template in this kit uses; an
    issue with none yields an empty list, not an absent field.

    `MirroredAt` is stamped with the current commit on every write, including a write that
    changed no other field (S14.2) - that stamp is the mirror's only claim to currency, and
    Test-DesignState.ps1's MirrorStale class is what a stale one costs (S14.7).

    Two ways this run does not touch the mirror at all: `design/FROZEN.md` present (S14.5,
    because `/track` does not run during a freeze either), and `gh` missing or unauthenticated
    (S14.4) - the second is could-not-evaluate, and never an empty mirror standing in for one
    that could not be read.

.PARAMETER RepoPath
    Repository root. Defaults to the current directory.

.PARAMETER Repository
    owner/repo. Defaults to the current git remote, via gh's own resolution.

.EXAMPLE
    pwsh ./tools/Update-WorkMirror.ps1
#>
[CmdletBinding()]
param(
    [string] $RepoPath = (Get-Location).Path,
    [string] $Repository
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Both gh-dependent helpers below read a native command's *exit code* as part of their answer,
# which $PSNativeCommandUseErrorActionPreference = $true (the 7.3+ default) would turn into a
# terminating error under Stop. Test-DesignDrift.ps1 and Test-DesignState.ps1 both assign this
# for the same reason; assigning it is inert on versions that predate the preference.
$PSNativeCommandUseErrorActionPreference = $false

function New-WorkMirrorFailure {
    param([Parameter(Mandatory)][string] $Reason, [Parameter(Mandatory)][string] $Detail)
    [pscustomobject]@{ Reason = $Reason; Detail = $Detail }
}

function New-WorkMirrorResult {
    param(
        [Parameter(Mandatory)][string]   $State,
        [object[]] $Written = @(),
        [object[]] $CouldNotEvaluate = @()
    )
    [pscustomobject]@{
        State            = $State
        Written          = @($Written)
        CouldNotEvaluate = @($CouldNotEvaluate)
    }
}

function Invoke-GhRaw {
    <#
    Runs gh and returns raw stdout text via StreamReader, bypassing PowerShell's
    native-command capture - which decodes stdout using the console's OEM code page rather
    than the UTF-8 gh actually writes, corrupting any non-ASCII byte (an em dash, for
    example) into mojibake before it ever reaches ConvertFrom-Json. Sync-Kit.ps1's
    Invoke-GitRaw fixed the identical class of bug for git output under #20 (a24541e); this
    mirrors that fix for gh. Exit code is returned through -ExitCode since a Mock cannot set
    $LASTEXITCODE (Update-WorkMirror.Tests.ps1's own rationale for mocking above this seam).
    #>
    param([Parameter(Mandatory)][string[]] $GhArgs, [ref] $ExitCode)

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'gh'
    foreach ($a in $GhArgs) { $psi.ArgumentList.Add($a) }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)

    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $proc.StandardError.ReadToEnd() | Out-Null
    $proc.WaitForExit()
    if ($ExitCode) { $ExitCode.Value = $proc.ExitCode }
    $stdout
}

<#
    Every checkbox under a "Done when" section in an issue template carries its id as the
    entire bolded lead of the line - `- [ ] **S14.1** ...` - regardless of the id's own scheme
    (slice criteria, or anything a future template invents). A bug or story issue with no ids
    yields an empty list, which is the grammar's own distinction between "empty" and "absent"
    (design/20-contract.md § The state set) - this always emits the field, never omits it.
#>
function Get-IssueCriteriaIds {
    param([string] $Body)
    if ([string]::IsNullOrWhiteSpace($Body)) { return @() }

    $ids = [System.Collections.Generic.List[string]]::new()
    foreach ($line in ($Body -split "`r?`n")) {
        if ($line -match '^\s*-\s*\[[ xX]\]\s*\*\*([^\*]+)\*\*') {
            $ids.Add($Matches[1].Trim())
        }
    }
    @($ids)
}

function Get-OpenIssueList {
    param([string] $Repository)

    $ghArgs = @('issue', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title,state,body,milestone')
    if ($Repository) { $ghArgs += @('-R', $Repository) }

    $exitCode = 0
    try {
        $json = Invoke-GhRaw -GhArgs $ghArgs -ExitCode ([ref]$exitCode)
        if ($exitCode -ne 0) {
            return [pscustomobject]@{ Issues = @(); Failure = (New-WorkMirrorFailure -Reason 'GhUnavailable' -Detail "gh exited $exitCode") }
        }
    } catch {
        return [pscustomobject]@{ Issues = @(); Failure = (New-WorkMirrorFailure -Reason 'GhUnavailable' -Detail $_.Exception.Message) }
    }

    if ([string]::IsNullOrWhiteSpace($json)) {
        return [pscustomobject]@{ Issues = @(); Failure = $null }
    }

    try {
        $parsed = $json | ConvertFrom-Json
    } catch {
        return [pscustomobject]@{ Issues = @(); Failure = (New-WorkMirrorFailure -Reason 'TrackerUnreadable' -Detail $_.Exception.Message) }
    }

    [pscustomobject]@{ Issues = @($parsed); Failure = $null }
}

<#
    Best-effort only, per the same convention track.md already states for the `project` scope:
    a repository with no matching project, or a `gh project` call that fails for any reason
    (missing scope among them), is not a could-not-evaluate here - it is the ordinary case that
    sends Rank to the next tier down (S14.3). Returns $null on any of those; a hashtable of
    issue number -> 1-based board position otherwise.
#>
function Get-ProjectItemPositions {
    param([Parameter(Mandatory)][string] $Owner, [Parameter(Mandatory)][string] $RepoName)

    try {
        $projExit = 0
        $projJson = Invoke-GhRaw -GhArgs @('project', 'list', '--owner', $Owner, '--format', 'json') -ExitCode ([ref]$projExit)
        if ($projExit -ne 0 -or [string]::IsNullOrWhiteSpace($projJson)) { return $null }
        $projects = $projJson | ConvertFrom-Json
    } catch {
        return $null
    }

    $project = @($projects.projects) | Where-Object { $_.title -eq $RepoName } | Select-Object -First 1
    if (-not $project) { return $null }

    try {
        $itemsExit = 0
        $itemsJson = Invoke-GhRaw -GhArgs @('project', 'item-list', $project.number, '--owner', $Owner, '--format', 'json') -ExitCode ([ref]$itemsExit)
        if ($itemsExit -ne 0 -or [string]::IsNullOrWhiteSpace($itemsJson)) { return $null }
        $items = $itemsJson | ConvertFrom-Json
    } catch {
        return $null
    }

    $positions = @{}
    $rank = 1
    foreach ($item in @($items.items)) {
        if ($item.content -and $item.content.number) {
            $positions[[int]$item.content.number] = $rank
        }
        $rank++
    }
    $positions
}

function Get-CurrentRepoOwnerName {
    param([string] $Repository)

    if ($Repository -and $Repository.Contains('/')) {
        $parts = $Repository -split '/', 2
        return [pscustomobject]@{ Owner = $parts[0]; Name = $parts[1] }
    }

    try {
        $repoExit = 0
        $json = Invoke-GhRaw -GhArgs @('repo', 'view', '--json', 'owner,name') -ExitCode ([ref]$repoExit)
        if ($repoExit -ne 0 -or [string]::IsNullOrWhiteSpace($json)) { return $null }
        $parsed = $json | ConvertFrom-Json
    } catch {
        return $null
    }
    if (-not $parsed.owner -or -not $parsed.owner.login) { return $null }
    [pscustomobject]@{ Owner = $parsed.owner.login; Name = $parsed.name }
}

function Get-IssueRank {
    param([Parameter(Mandatory)] $Issue, $ProjectPositions)

    if ($ProjectPositions -and $ProjectPositions.ContainsKey([int]$Issue.number)) {
        return "$($ProjectPositions[[int]$Issue.number])"
    }
    if ($Issue.milestone -and $Issue.milestone.number) {
        return "milestone/$($Issue.milestone.number)"
    }
    return "$($Issue.number)"
}

function Get-CurrentWorkMirrorSha {
    param([Parameter(Mandatory)][string] $RepoPath)
    try {
        Push-Location $RepoPath
        $sha = (& git rev-parse HEAD 2>$null)
        if ($LASTEXITCODE -ne 0) { return $null }
        return $sha.Trim()
    } finally {
        Pop-Location
    }
}

function ConvertTo-WorkRefLines {
    param([Parameter(Mandatory)] $Issue, [Parameter(Mandatory)][string] $Rank, [Parameter(Mandatory)][string] $Sha)

    $criteria = Get-IssueCriteriaIds -Body $Issue.body
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("# work/$($Issue.number)")
    $lines.Add("Issue: $($Issue.number)")
    $lines.Add("Title: $($Issue.title)")
    $lines.Add("State: $($Issue.state)")
    $lines.Add("Rank: $Rank")
    $lines.Add("MirroredAt: $Sha")
    $lines.Add("Criteria: $($criteria -join ', ')")
    ,@($lines)
}

<#
    The mirrored-field signature: every WorkRef line except MirroredAt, which is the mirror's
    freshness stamp rather than mirrored content (S14.2) - two records agree here exactly when
    they differ, if at all, only in which commit last touched them.
#>
function Get-WorkRefSignature {
    param([string[]] $Lines)
    (@($Lines) | Where-Object { $_ -notmatch '^MirroredAt:' }) -join "`n"
}

function Get-ExistingWorkRefLines {
    param([Parameter(Mandatory)][string] $Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $raw = Get-Content -LiteralPath $Path -Raw
    $lines = $raw -split "`r?`n"
    if ($lines.Count -gt 0 -and $lines[-1] -eq '') { $lines = $lines[0..($lines.Count - 2)] }
    ,@($lines)
}

<#
    The main entry point. RepoPath scopes both the freeze check and where records land;
    Repository (owner/repo) is passed through to gh exactly as Test-DesignDrift.ps1 does, and
    left empty to let gh resolve the current remote itself.
#>
function Invoke-WorkMirrorUpdate {
    param([Parameter(Mandatory)][string] $RepoPath, [string] $Repository)

    $frozenMarker = Join-Path $RepoPath 'design/FROZEN.md'
    if (Test-Path -LiteralPath $frozenMarker) {
        return New-WorkMirrorResult -State 'Frozen'
    }

    $issueList = Get-OpenIssueList -Repository $Repository
    if ($issueList.Failure) {
        return New-WorkMirrorResult -State 'NotEvaluated' -CouldNotEvaluate @($issueList.Failure)
    }

    $sha = Get-CurrentWorkMirrorSha -RepoPath $RepoPath
    if (-not $sha) {
        return New-WorkMirrorResult -State 'NotEvaluated' -CouldNotEvaluate @((New-WorkMirrorFailure -Reason 'ShallowCheckout' -Detail 'no history to resolve HEAD'))
    }

    $repoInfo = Get-CurrentRepoOwnerName -Repository $Repository
    $projectPositions = if ($repoInfo) { Get-ProjectItemPositions -Owner $repoInfo.Owner -RepoName $repoInfo.Name } else { $null }

    $workDir = Join-Path $RepoPath 'design/state/work'
    if ($issueList.Issues.Count -gt 0 -and -not (Test-Path -LiteralPath $workDir)) {
        New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    }

    $written = [System.Collections.Generic.List[object]]::new()
    foreach ($issue in $issueList.Issues) {
        $rank = Get-IssueRank -Issue $issue -ProjectPositions $projectPositions
        $lines = ConvertTo-WorkRefLines -Issue $issue -Rank $rank -Sha $sha
        $file = Join-Path $workDir "$($issue.number).md"

        $existingLines = Get-ExistingWorkRefLines -Path $file
        if ($existingLines -and (Get-WorkRefSignature $existingLines) -eq (Get-WorkRefSignature $lines)) {
            continue
        }

        $text = (($lines -join "`n") + "`n")
        Set-Content -LiteralPath $file -Value $text -NoNewline -Encoding utf8NoBOM
        $written.Add([pscustomobject]@{ Id = "work/$($issue.number)"; Path = $file })
    }

    New-WorkMirrorResult -State 'Clean' -Written @($written)
}

# Guards the invocation so this script's tests can dot-source it - the same shape
# Test-DesignState.ps1, Read-DesignState.ps1 and Test-DesignDrift.ps1 already use.
if ($MyInvocation.InvocationName -ne '.') {
    $RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
    $result = Invoke-WorkMirrorUpdate -RepoPath $RepoPath -Repository $Repository

    switch ($result.State) {
        'Frozen'       { Write-Host "design/FROZEN.md is present; the mirror is not refreshed." }
        'NotEvaluated' { foreach ($f in $result.CouldNotEvaluate) { Write-Warning "Update-WorkMirror: $($f.Reason) - $($f.Detail)" } }
        'Clean'        { Write-Host "Wrote $($result.Written.Count) WorkRef record(s)." }
    }

    $result
    if ($result.State -eq 'NotEvaluated') { exit 2 }
    exit 0
}
