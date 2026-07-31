<#
.SYNOPSIS
    Builds the changelog body from main's merge history.

.DESCRIPTION
    Every commit on `main` in this repository is a squash-merged pull request, so
    `git log` already IS the changelog -- one entry per shipped PR, newest first,
    linking back to the PR itself. No manual maintenance, no second source of
    truth that can drift from what actually merged.

    Returns the changelog BODY only, as an array of lines -- no front matter. The
    two callers that write it (the Docusaurus page and the repository-root copy
    GitHub's own UI recognizes) wrap the same body differently, so front matter
    doesn't belong in the generator itself.

    A commit whose subject contains "update changelog" (case-insensitive, anywhere
    in the subject rather than an exact prefix) is skipped -- that is this
    generator's own regeneration commit, once `.github/workflows/changelog.yml`
    merges one, and it would otherwise show up inside the changelog it produced.
    Matched loosely on purpose: a merge commit's exact subject depends on how it
    was merged and whether a reviewer edited the pre-filled title, so an exact
    prefix match is one retitle away from missing it.

.PARAMETER RepoRoot
    Path to the git repository root. Needs full history (not a shallow clone).

.PARAMETER RepositorySlug
    "<owner>/<repo>", used to build pull-request links.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $RepoRoot,

    [Parameter(Mandatory)]
    [string] $RepositorySlug
)

$ErrorActionPreference = 'Stop'

# A control character no commit subject will contain, so splitting on it can't
# be confused by punctuation a real subject might use.
$separator = [char]0x1f
$format = "%ad$separator%s"

$rawLog = & git -C $RepoRoot log --date=short --pretty=format:$format HEAD
if ($LASTEXITCODE -ne 0) {
    throw 'git log failed -- is this running inside a git checkout with full history (fetch-depth: 0)?'
}

# Markdown-escapes a commit subject before it's embedded as link text or a
# plain list item -- an unescaped '[' or ']' in a PR title would otherwise
# corrupt the surrounding link syntax (backslash escaped first, so escaping
# the brackets afterwards can't double up on a subject that already contains
# a literal backslash).
function ConvertTo-EscapedMarkdown {
    param([Parameter(Mandatory)][string] $Text)
    $Text.Replace('\', '\\').Replace('[', '\[').Replace(']', '\]')
}

$entryLines = foreach ($entry in ($rawLog -split "`n")) {
    if ([string]::IsNullOrWhiteSpace($entry)) { continue }

    $parts = $entry -split [regex]::Escape([string]$separator), 2
    $date = $parts[0]
    $subject = $parts[1]

    if ($subject -match '(?i)update changelog') { continue }

    $escapedSubject = ConvertTo-EscapedMarkdown -Text $subject
    $prMatch = [regex]::Match($subject, '\(#(?<pr>\d+)\)\s*$')
    if ($prMatch.Success) {
        $prUrl = "https://github.com/$RepositorySlug/pull/$($prMatch.Groups['pr'].Value)"
        "- **$date** — [$escapedSubject]($prUrl)"
    }
    else {
        "- **$date** — $escapedSubject"
    }
}

@(
    '# Changelog'
    ''
    'One entry per merged pull request, newest first — generated from the merge history'
    'of `main`, not maintained by hand. This project squash-merges every pull request, so'
    '`git log` already is the changelog; regenerating it is strictly more reliable than a'
    'second, hand-kept copy.'
    ''
) + $entryLines
