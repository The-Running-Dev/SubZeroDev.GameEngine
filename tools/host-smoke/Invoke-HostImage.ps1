<#
.SYNOPSIS
The host-image workflow's stages (.github/workflows/host-image.yml), one per -Stage.

.DESCRIPTION
design/15-platform-static-host.md (W62). Values reach the stages as environment variables,
and outputs go to GITHUB_OUTPUT / GITHUB_STEP_SUMMARY when those exist:

  Credential       REGISTRY_TOKEN                 -> fails loudly when the secret is missing
  Start            (none)                         -> starts the smoke container
  Smoke            (none)                         -> positive route and probe smoke
  Stop             (none)                         -> orderly container stop
  NegativeFixture  (none)                         -> a corrupted artifact must fail to start
  Changed          BEFORE, SHA                    -> writes changed=true|false
  ImageRef         REPOSITORY                     -> writes ref
  Record           IMAGE_REF, SHA, DIGEST         -> job summary

Start, Smoke, Stop and NegativeFixture need the image built as
subzerodev-gameengine-host:smoke and Docker available:

  pwsh -NoProfile -File ./tools/host-smoke/Invoke-HostImage.ps1 -Stage Smoke
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory)]
    [ValidateSet('Credential', 'Start', 'Smoke', 'Stop', 'NegativeFixture', 'Changed', 'ImageRef', 'Record')]
    [string] $Stage
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$image = 'subzerodev-gameengine-host:smoke'
$container = 'host-smoke'
$baseUrl = 'http://127.0.0.1:18080'

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
    param ([Parameter(Mandatory)] [string] $Line)
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Line }
}

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

function Test-Route {
    param (
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [int] $Expected
    )
    $code = [int] (curl -s -o /dev/null -w '%{http_code}' "$baseUrl$Path")
    if ($code -ne $Expected) { throw "GET $Path -> $code, expected $Expected" }
    Write-Host "GET $Path -> $code"
}

switch ($Stage) {
    # SubZeroDev.Platform.Hosting is published from the sibling SubZeroDev.Platform
    # repository. The default GITHUB_TOKEN is scoped to this repository and cannot read
    # packages published from a different one, so restoring it needs a real cross-repo
    # `read:packages` token. Fail loudly rather than let `dotnet restore` fall back to an
    # unauthenticated request and fail with an opaque Docker build error.
    'Credential' {
        if (-not (Get-EnvironmentValue 'REGISTRY_TOKEN')) {
            Write-Host '::error::REGISTRY_TOKEN secret is required to restore SubZeroDev.Platform.Hosting from GitHub Packages in the SubZeroDev.Platform repository. The default GITHUB_TOKEN cannot read packages published from a sibling repository.'
            exit 1
        }
    }

    'Start' {
        Invoke-Native docker @('run', '-d', '--name', $container, '-p', '18080:8080', $image)
        Start-Sleep -Seconds 3
        Invoke-Native docker @('logs', $container)
    }

    'Smoke' {
        Test-Route '/' 200
        Test-Route '/roadmap/' 200
        Test-Route '/docs/' 200
        Test-Route '/health/live' 200
        Test-Route '/health/ready' 200
        # No SPA fallback (§4): an unknown route must 404, never the landing page.
        Test-Route '/this-route-does-not-exist' 404
    }

    'Stop' {
        Invoke-Native docker @('stop', '--timeout', '10', $container)
        docker logs $container | Select-Object -Last 5
        Invoke-Native docker @('rm', $container)
    }

    # §7 / W62.7: a deliberate missing-artifact fixture, proving the gate actually fails red
    # rather than merely never having been tested. Program.cs's own startup check
    # (StaticArtifact.FindMissingRequiredDocuments) is what turns this into a non-zero exit
    # rather than a container that starts and silently serves less.
    'NegativeFixture' {
        Push-Location $repoRoot
        try {
            Invoke-Native docker @(
                'build',
                '--build-arg', "BASE_IMAGE=$image",
                '-f', 'tools/host-smoke/Dockerfile.negative-fixture',
                '-t', 'subzerodev-gameengine-host:negative-fixture',
                '.')
        } finally {
            Pop-Location
        }
        docker run --rm subzerodev-gameengine-host:negative-fixture
        if ($LASTEXITCODE -eq 0) {
            throw 'Negative fixture started successfully -- it must not. The missing-artifact guard is not proven.'
        }
        Write-Host 'Negative fixture correctly failed to start.'
    }

    'Changed' {
        $before = Get-EnvironmentValue 'BEFORE'
        $sha = Get-EnvironmentValue 'SHA'
        if (-not $before -or $before -eq ('0' * 40)) {
            Write-Host 'No previous commit to diff against -- publishing.'
            Add-Output 'changed=true'
            return
        }
        git -C $repoRoot diff --quiet $before $sha -- Dockerfile .dockerignore src/host site docs src/engine
        switch ($LASTEXITCODE) {
            0 { Add-Output 'changed=false' }
            1 { Add-Output 'changed=true' }
            default { throw "git diff failed with exit code $LASTEXITCODE." }
        }
    }

    'ImageRef' {
        Add-Output "ref=ghcr.io/$((Get-EnvironmentValue 'REPOSITORY').ToLowerInvariant())-host"
    }

    # One immutable full-commit tag, no `latest`, no deployment -- §6's decision summary.
    # The digest is recorded in the job summary so a later slice can pin it.
    'Record' {
        Add-Summary "Published $(Get-EnvironmentValue 'IMAGE_REF'):$(Get-EnvironmentValue 'SHA')"
        Add-Summary "Digest: $(Get-EnvironmentValue 'DIGEST')"
    }
}
