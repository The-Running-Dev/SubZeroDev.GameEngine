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

This repository has not adopted the kit's `design/state/` system — no `design/state/units/`
and no `design/state-index.md`. The only thing under `design/state/` is `/track`'s own
work-mirror (`design/state/work/`), an unrelated feature (`design/90-decisions.md`,
2026-08-24). The full record-writing sequence the kit's own `AGENTS.md` describes under this
heading — appending to `90-decisions.md`, writing a decision record, updating unit records,
regenerating projections — assumes that adoption and does not apply here. Write the
decision-log entry alone, in `design/90-decisions.md`'s own register, in its existing format.
