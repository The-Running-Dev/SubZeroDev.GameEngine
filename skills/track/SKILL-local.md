## vocabulary
`AGENTS.md` is named `CLAUDE.md` here. This repository retains its established `W` prefix — every
`S<n>` heading, id (`S3.1`), and issue-title pattern (`S<n> —`) below reads as `W<n>` here, matching
the existing positional `W3a` unit numbering one level down.

## document-map
`design/30-slices.md` has no `## Outstanding` / `## Landed` split, and is not going to acquire
one. A unit's state is carried on its own heading — `### [x] W102 — …` for landed, `### [ ] W103
— …` for outstanding, `### [~] W68 — … — cancelled` for abandoned — inside the topical section
that explains why the unit exists. `Test-DesignDrift.ps1` reads that convention correctly; it is
the *retirement* step that does not, because there is no second section for a body to move into.

Read this document by heading marker, therefore, and treat *Landed slices → retired* as not
applying here: `tools/Update-SlicesDocument.ps1` exits 2 with `NoLandedSection` on every run, and
that is the expected outcome rather than a finding to report or a gap to repair. Nothing else
about the step changes — a landed unit is still one whose issue is closed, and the reported-not-
claimed rule for a step that did not run is unaffected.

**Why the document is shaped this way.** The `[x]` heading and the surrounding narrative are the
same artifact: `### Correctness Debt — The Tick Pipeline Runs Twenty Systems and Implements
Fifteen` is only legible with the five units under it, landed or not, in delivery order.
Retiring a body to a table elsewhere would leave the section that argued for it empty, and
restructuring the ~4,600 lines would rewrite every `{#w<n>}` anchor and every cross-link into
them across `design/` and the generated pages. Recorded in `design/90-decisions.md`, 2026-09-05.
