---
description: Produce or revise the design doc from the brief
---

Read `design/00-brief.md`. Write `design/10-design.md`.

## Stop if `design/` is frozen

If `design/FROZEN.md` exists, **stop before doing anything else.** Report its `Frozen because` and `Lifts when` lines verbatim and write nothing. The rule and the marker's format live in `CLAUDE.md`, *The design freeze* — not restated here.

**Repository overlay:** `design/10-design.md` is a compound canonical document. Read it in full
before revising it and preserve every `human-doc` block. The section map at the top satisfies the
generic structure below; detailed decisions belong in the marked Architecture or cross-cutting
blocks that own them. Never replace the compound document with a condensed summary. After an
approved edit, regenerate human docs with `build/ConvertTo-HumanDocumentation.ps1`.

This is the stage where irreversible decisions get made. Data model, module boundaries and error semantics are expensive to change later; code is not. Spend the reasoning here.

Required sections, in this order:

## Data model
Entities, their fields with types, ownership, lifecycle, and identity. State which fields are derived and from what. State what is persisted vs in-memory.

## Module boundaries
Each module: what it owns, what it depends on, what it exposes. Draw the dependency direction explicitly and confirm it is acyclic.

## Control flow
The two or three main paths through the system, end to end, named by what triggers them.

## Failure modes
For each external dependency and each boundary: what can fail, how it is detected, what the system does, what the user sees. Include partial failure and retry semantics. Include what state is left behind on failure.

## Concurrency and ordering
What can happen simultaneously, what must not, and what enforces that. If the answer is "nothing is concurrent," say so and say what enforces it.

## Alternatives considered
At least three architectural choices where a different option was viable. For each: what was chosen, what was rejected, and the specific reason for rejection. **A section with no rejected alternatives means the decision was not actually made — go back and make it.**

## Open questions
Things that cannot be resolved without information I have not given you. Ask them here rather than assuming.

Rules:
- No code. No file layouts. No package names beyond what a decision required.
- Every decision that survives goes into `design/90-decisions.md` in the logged format.
- If the brief is too thin to design against, stop and say what is missing rather than inventing requirements.
