<#
.SYNOPSIS
Generates the human-facing engine documentation from the canonical agent-kit design files.

.DESCRIPTION
The canonical documents under design/ contain marked human-document blocks. This script
extracts those blocks into docs/docs/engine/, adds a generated-file notice after front matter,
and stamps or verifies the generated developer guide against a digest of the canonical files
that /make-human-docs reads.

.PARAMETER Check
Compare generated output and the guide digest without writing files.

.PARAMETER StampGuide
Update the design digest embedded in docs/docs/guide.md after /make-human-docs regenerates it.
#>
[CmdletBinding()]
param (
    [Parameter()]
    [switch] $Check,

    [Parameter()]
    [switch] $StampGuide
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$designRoot = Join-Path $repositoryRoot 'design'
$humanRoot = Join-Path $repositoryRoot 'docs' 'docs'
$guidePath = Join-Path $humanRoot 'guide.md'
$utf8NoBom = [Text.UTF8Encoding]::new($false)

$canonicalFiles = @(
    '00-brief.md'
    '10-design.md'
    '20-contract.md'
    '30-slices.md'
    '90-decisions.md'
)

$guideInputFiles = @(
    '00-brief.md'
    '10-design.md'
    '20-contract.md'
)

function ConvertTo-Lf {
    param ([Parameter(Mandatory)][string] $Text)
    return $Text.Replace("`r`n", "`n").Replace("`r", "`n")
}

function Add-GeneratedNotice {
    param (
        [Parameter(Mandatory)][string] $Content,
        [Parameter(Mandatory)][string] $SourceName
    )

    $notice = "<!-- Generated from design/$SourceName by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->"
    $normalized = ConvertTo-Lf -Text $Content

    if ($normalized.StartsWith("---`n", [StringComparison]::Ordinal)) {
        $frontMatterEnd = $normalized.IndexOf("`n---`n", 3, [StringComparison]::Ordinal)
        if ($frontMatterEnd -lt 0) {
            throw "Unclosed front matter in a block from design/$SourceName."
        }

        $insertAt = $frontMatterEnd + 5
        return $normalized.Substring(0, $insertAt) + "`n$notice`n" + $normalized.Substring($insertAt)
    }

    return "$notice`n`n$normalized"
}

function Get-HumanBlocks {
    param (
        [Parameter(Mandatory)][string] $SourcePath,
        [Parameter(Mandatory)][string] $SourceName
    )

    $content = ConvertTo-Lf -Text ([IO.File]::ReadAllText($SourcePath))
    $pattern = '<!-- human-doc:start path="(?<path>[^"]+)" -->\n(?<content>.*?)\n<!-- human-doc:end -->'
    $matches = [regex]::Matches($content, $pattern, [Text.RegularExpressions.RegexOptions]::Singleline)

    if ($matches.Count -eq 0) {
        throw "No human-document blocks found in design/$SourceName."
    }

    foreach ($match in $matches) {
        $relativePath = $match.Groups['path'].Value
        if ($relativePath.StartsWith('/') -or $relativePath.Contains('..')) {
            throw "Unsafe generated path '$relativePath' in design/$SourceName."
        }

        [pscustomobject]@{
            SourceName = $SourceName
            RelativePath = $relativePath
            Content = Add-GeneratedNotice -Content $match.Groups['content'].Value -SourceName $SourceName
        }
    }
}

function Get-DesignDigest {
    $builder = [Text.StringBuilder]::new()
    foreach ($name in $guideInputFiles) {
        $path = Join-Path $designRoot $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Canonical design file is missing: $path"
        }
        [void] $builder.Append($name).Append("`n")
        [void] $builder.Append((ConvertTo-Lf -Text ([IO.File]::ReadAllText($path)))).Append("`n")
    }

    $bytes = $utf8NoBom.GetBytes($builder.ToString())
    $hash = [Security.Cryptography.SHA256]::HashData($bytes)
    return [Convert]::ToHexString($hash).ToLowerInvariant()
}

function Get-CompatibilityPointer {
    param (
        [Parameter(Mandatory)] $Document
    )

    $source = ConvertTo-Lf -Text $Document.Content
    $headings = [regex]::Matches(
        $source,
        '^#{1,6}\s+.+$',
        [Text.RegularExpressions.RegexOptions]::Multiline
    )
    $builder = [Text.StringBuilder]::new()
    [void] $builder.Append("<!-- Generated compatibility pointer. Do not edit directly. -->`n`n")
    [void] $builder.Append(
        "> Canonical content is in [$($Document.SourceName)]($($Document.SourceName)). " +
        "This file preserves pre-migration relative links and section anchors only.`n`n"
    )

    foreach ($heading in $headings) {
        [void] $builder.Append($heading.Value).Append("`n`n")
    }

    # Some legacy ledgers retain their newer work units as checkbox bullets.
    # Preserve their stable W-number anchors in the compatibility pointer too,
    # without making the pointer a second copy of the canonical prose.
    $headingWorkUnits = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($heading in $headings) {
        $match = [regex]::Match($heading.Value, '\b(W\d+[a-z]?)\b')
        if ($match.Success) {
            $null = $headingWorkUnits.Add($match.Groups[1].Value)
        }
    }

    $taskBullets = [regex]::Matches(
        $source,
        '^\s*-\s+\[([ xX~])\]\s+\*\*(W\d+[a-z]?)(?:\s+proposed)?\s+—\s+(.+?)(?:\*\*)?\s*$',
        [Text.RegularExpressions.RegexOptions]::Multiline
    )
    foreach ($task in $taskBullets) {
        $workUnit = $task.Groups[2].Value
        if ($headingWorkUnits.Contains($workUnit)) {
            continue
        }

        $status = $task.Groups[1].Value.ToLowerInvariant()
        $title = ($task.Groups[3].Value -replace '\*\*', '').Trim()
        $anchor = $workUnit.ToLowerInvariant()
        [void] $builder.Append("### [$status] $workUnit — $title {#$anchor}`n`n")
    }

    return $builder.ToString().TrimEnd("`n") + "`n"
}

$generated = @()
foreach ($name in $canonicalFiles) {
    $path = Join-Path $designRoot $name
    $blocks = @(Get-HumanBlocks -SourcePath $path -SourceName $name)
    $generated += $blocks
}

$duplicate = $generated | Group-Object RelativePath | Where-Object Count -gt 1
if ($duplicate) {
    throw "A human-document output path is owned by more than one canonical block: $($duplicate.Name -join ', ')"
}

$failures = [Collections.Generic.List[string]]::new()
$expectedOutputPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($document in $generated) {
    $outputPath = Join-Path $humanRoot $document.RelativePath
    [void] $expectedOutputPaths.Add([IO.Path]::GetFullPath($outputPath))
    $expected = (ConvertTo-Lf -Text $document.Content).TrimEnd("`n") + "`n"

    if ($Check) {
        if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
            $failures.Add("Missing generated document: $($document.RelativePath)")
            continue
        }

        $actual = (ConvertTo-Lf -Text ([IO.File]::ReadAllText($outputPath))).TrimEnd("`n") + "`n"
        if ($actual -cne $expected) {
            $failures.Add("Generated document is stale: $($document.RelativePath) (source design/$($document.SourceName))")
        }
        continue
    }

    $directory = Split-Path -Parent $outputPath
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    [IO.File]::WriteAllText($outputPath, $expected, $utf8NoBom)
    Write-Host "[HUMAN-DOCS] Generated $($document.RelativePath) from design/$($document.SourceName)"
}

$expectedPointerPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($document in $generated) {
    $pointerName = [IO.Path]::GetFileName($document.RelativePath)
    $pointerPath = Join-Path $designRoot $pointerName
    [void] $expectedPointerPaths.Add([IO.Path]::GetFullPath($pointerPath))
    $expected = Get-CompatibilityPointer -Document $document

    if ($Check) {
        if (-not (Test-Path -LiteralPath $pointerPath -PathType Leaf)) {
            $failures.Add("Missing generated compatibility pointer: design/$pointerName")
            continue
        }
        $actual = (ConvertTo-Lf -Text ([IO.File]::ReadAllText($pointerPath))).TrimEnd("`n") + "`n"
        if ($actual -cne $expected) {
            $failures.Add("Generated compatibility pointer is stale: design/$pointerName")
        }
        continue
    }

    [IO.File]::WriteAllText($pointerPath, $expected, $utf8NoBom)
    Write-Host "[HUMAN-DOCS] Generated compatibility pointer design/$pointerName"
}

$generatedDocumentNotice = '<!-- Generated from design/'
foreach ($file in Get-ChildItem -LiteralPath $humanRoot -Recurse -File -Filter '*.md') {
    $firstLine = Get-Content -LiteralPath $file.FullName -TotalCount 1
    if ($firstLine.StartsWith($generatedDocumentNotice, [StringComparison]::Ordinal) -and
        -not $expectedOutputPaths.Contains([IO.Path]::GetFullPath($file.FullName))) {
        $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
        if ($Check) {
            $failures.Add("Obsolete generated document: $relativePath")
        }
        else {
            Remove-Item -LiteralPath $file.FullName
            Write-Host "[HUMAN-DOCS] Removed obsolete generated document $relativePath"
        }
    }
}

$compatibilityPointerNotice = '<!-- Generated compatibility pointer. Do not edit directly. -->'
foreach ($file in Get-ChildItem -LiteralPath $designRoot -File -Filter '*.md') {
    $firstLine = Get-Content -LiteralPath $file.FullName -TotalCount 1
    if ($firstLine -eq $compatibilityPointerNotice -and
        -not $expectedPointerPaths.Contains([IO.Path]::GetFullPath($file.FullName))) {
        $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
        if ($Check) {
            $failures.Add("Obsolete generated compatibility pointer: $relativePath")
        }
        else {
            Remove-Item -LiteralPath $file.FullName
            Write-Host "[HUMAN-DOCS] Removed obsolete generated compatibility pointer $relativePath"
        }
    }
}

$digest = Get-DesignDigest
$digestPattern = '<!-- design-digest: [a-f0-9]{64} -->'

if (-not (Test-Path -LiteralPath $guidePath -PathType Leaf)) {
    $failures.Add('Generated guide is missing: docs/docs/guide.md')
}
else {
    $guide = ConvertTo-Lf -Text ([IO.File]::ReadAllText($guidePath))
    $expectedMarker = "<!-- design-digest: $digest -->"

    if ($StampGuide) {
        if ([regex]::IsMatch($guide, $digestPattern)) {
            $guide = [regex]::Replace($guide, $digestPattern, $expectedMarker, 1)
        }
        else {
            $frontMatterEnd = $guide.IndexOf("`n---`n", 4, [StringComparison]::Ordinal)
            if ($frontMatterEnd -lt 0) {
                throw 'docs/docs/guide.md must have closed front matter before it can be stamped.'
            }
            $insertAt = $frontMatterEnd + 5
            $guide = $guide.Substring(0, $insertAt) + "`n$expectedMarker`n" + $guide.Substring($insertAt)
        }
        [IO.File]::WriteAllText($guidePath, $guide.TrimEnd("`n") + "`n", $utf8NoBom)
        Write-Host '[HUMAN-DOCS] Stamped docs/docs/guide.md with the canonical design digest.'
    }
    elseif (-not $guide.Contains($expectedMarker, [StringComparison]::Ordinal)) {
        $failures.Add('Generated guide is stale: docs/docs/guide.md (run /make-human-docs, then stamp the guide)')
    }
}

if ($failures.Count -gt 0) {
    throw "Human-documentation generation failed:`n$($failures -join "`n")"
}

if ($Check) {
    Write-Host "Human-documentation drift check passed across $($generated.Count) generated engine page(s), compatibility pointers, and the guide."
}
