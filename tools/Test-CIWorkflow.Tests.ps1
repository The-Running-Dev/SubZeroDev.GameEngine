#Requires -Version 7.0
#Requires -Modules Pester

<#
  Regression coverage for #79: the "Run Pester tests" CI step calls the real design-state
  check (S12.5, tools/Test-DesignState.Tests.ps1) against this repository, which needs an
  authenticated gh exactly as the later "Check the design state against the tree" step
  already does - so it needs the same GH_TOKEN. Without it, an unauthenticated gh turns
  S12.5 into a could-not-evaluate (TrackerUnavailable) rather than a check of anything this
  step is meant to gate.

  This regression only applies once the kit's design-state tracking is adopted here and
  verify.yml has grown the "Check the design state against the tree" step this test compares
  against - the kit's own compatibility promise (design/90-decisions.md, 2026-08-19) does not
  migrate that step to installed targets, so its absence here is not a divergence to report.
#>

Describe 'CI workflow: the Run Pester tests step is authenticated (#79)' {
    BeforeAll {
        # The assertion itself is intentionally skipped until this repository
        # adopts the design-state workflow step.  Pester still evaluates
        # BeforeAll for skipped examples, so avoid reading a workflow that is
        # deliberately absent in that compatibility state.
        $workflowPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.github/workflows/verify.yml'
        $script:RunGhTokenTest = (Test-Path $workflowPath) -and
            (Select-String -LiteralPath $workflowPath -Pattern '- name: Check the design state against the tree' -Quiet)
        if (-not $script:RunGhTokenTest) {
            $script:Lines = @()
            return
        }

        $script:WorkflowPath = $workflowPath
        $script:Lines = Get-Content -LiteralPath $script:WorkflowPath
    }

    It 'the "Run Pester tests" step carries a GH_TOKEN env, the same as "Check the design state against the tree"' {
        if (-not $script:RunGhTokenTest) {
            Set-ItResult -Skipped -Because 'This repository has not adopted the design-state workflow step.'
            return
        }
        $stepIndex = ($script:Lines | Select-String -Pattern '- name: Run Pester tests').LineNumber
        $stepIndex | Should -Not -BeNullOrEmpty

        # The step body runs from its `- name:` line to the line before the next `- name:`
        # (or end of file), so this only inspects this one step's own env block.
        $nextStepIndex = ($script:Lines | Select-String -Pattern '^\s*- name:' |
            Where-Object { $_.LineNumber -gt $stepIndex } |
            Select-Object -First 1).LineNumber
        $endIndex = if ($nextStepIndex) { $nextStepIndex - 1 } else { $script:Lines.Count }
        $stepBody = $script:Lines[($stepIndex - 1)..($endIndex - 1)] -join "`n"

        $stepBody | Should -Match 'GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}'
    }
}
