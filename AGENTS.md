# Agent Instructions

This file exists for tools that look for `AGENTS.md` by convention. It is a pointer, not a
copy — the instructions live in two files, and duplicating them here would give the
repository two answers to every question.

| Read | For |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Standing instructions.** What this project is, where the specs and source live, the docs-site tooling, working conventions, and the drift hazards this repo keeps hitting. Start here. |
| [`agent.md`](agent.md) | **Lessons learned the hard way.** Retrospective notes — token economy, what worked, repo-specific drift hazards, open concerns. |

Both apply regardless of which agent or tool is reading them. Nothing in either is specific
to one assistant except the names of the tools it describes, and those are named accurately
because getting them wrong sends the reader to paths that do not exist.

## Why this is a pointer

An earlier version of this file was a full copy of `CLAUDE.md` with every occurrence of one
assistant's name mechanically replaced by another's. That rewrote nine real references into
paths and packages that do not exist — `~/.Codex/skills/graphify/`, `npx Codex-mem doctor`,
`/Codex-mem:learn-codebase` — while leaving 14 KB of otherwise identical prose free to drift
from its source.

A duplicate that can disagree with its original is the failure mode `CLAUDE.md` itself
tracks, applied to the instructions. One file, one answer.

## Writing a design-state record

This repository has adopted **half** of the kit's `design/state/` system, and the half it did
not adopt is the half this heading is about. What exists: `/track`'s work-mirror
(`design/state/work/`, one `WorkRef` per issue — `design/90-decisions.md`, 2026-08-24) and
`design/state-index.md`, the projection over it (2026-09-05). What does not: `design/state/units/`,
and every other record kind. There are no `Unit`, `Invariant`, `Contract`, `Decision` or
`Question` records here, which is why five of the index's six regions render an empty-set
placeholder and only `outstanding` carries rows.

So the full record-writing sequence the kit's own `AGENTS.md` describes under this heading —
appending to `90-decisions.md`, writing a decision record, updating unit records, regenerating
projections — still does not apply. **Write the decision-log entry alone**, in
`design/90-decisions.md`'s own register, in its existing format. Do not hand-write
`design/state-index.md`: it is generated, `/track` regenerates it, and an edit between two of
its markers is discarded on the next run.
