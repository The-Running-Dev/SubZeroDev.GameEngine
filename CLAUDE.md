# Project Instructions

## What This Project Is

**SubZeroDev.GameEngine — the Game Engine.** A deterministic, game-agnostic
narrative-game platform: its **source** (`src/engine/`) and its **specs**
(`design/`) in one repo. Human-facing documentation under `docs/docs/` is generated from
that canonical design.

The model is **core → kinds → campaigns**: one shared deterministic core, game-*type*
logic (`kinds`, engine-owned code), and content (`campaigns`, data). v1 ships three kinds:
`story-graph`, `simulation`, and `world-graph`.

**Companions:**
- **Game** — [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife):
  Life in the Fast Lane, the flagship `simulation`-kind game. Its docs are where much of
  this engine's core was first designed; `games/…` references throughout these specs point
  there.
  **`games/04-engine-specification.md` is the ancestor, not a second authority.** It is a
  104 KB *engine* spec that `02-architecture` and `04-core` were derived from, and it is
  cited ~21 times across these docs — every citation is provenance. For anything the core
  owns, the docs here supersede it. **It is no longer authoritative for anything.** It was, for
  one thing: the `simulation` **kind's** own content and resolution model (its §5, §7–§10, §12,
  §14), held upstream until a contract existed *here* against the Kind seam. That contract
  exists — `10-simulation-kind.md`, whole as of its Revision 2, expressed against the seam the
  way `03-story-graph-kind` is. What remains upstream is *provisional balance*, not contract:
  drift rates, scenario economics, `demandBand` thresholds, the housing-quality formula. Stated
  in `04-core`, *Reused, not re-derived*.
- **Game** — [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap):
  Sun Trap, the flagship `world-graph`-kind game — a satirical resort-management sim. Design
  only, no code. Its kind contract is `12-world-graph-kind.md` here; the game's maps,
  scenarios, balance and client live there. Nothing in these specs depends on it.
- **Client** — [SubZeroDev.Adventures](https://github.com/The-Running-Dev/SubZeroDev.Adventures):
  the browser play surface, extracted from this repository's `/play/` route and **the one going
  forward** — the in-repository `site/src/play/` route has been retired (`10-design.md`,
  *Succeeded by SubZeroDev.Adventures*). It is a **client repository**: no `design/`, no
  pipeline, no contract of its own. It consumes this engine as a pinned git submodule and adds
  a hosted Fastify API, Postgres persistence and accounts — all without a reciprocal engine
  change, which is the dependency direction working.
  **It is the first host to implement the ports outside a browser tab**, and that turned up
  eight contract findings, indexed together in `90-decisions.md` §2, *Found by the first
  downstream host*. Two things to know before touching it: it depends on `fromPortable` and
  the `Portable*` types, which graduated from the spike and are contracted package-root exports
  (`20-contract.md` §19; `90-decisions.md`, 2026-08-11), so a submodule bump that breaks them is
  a contract break rather than a legitimate one; and its visual identity diverged from
  `14-game-interface.md` deliberately — do not port it back.
- **Hosting / NEaaS** — [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform):
  the deferred hosting / SaaS layer.

The build strategy is **engine-first**: prove the deterministic engine with automated
tests and a plain text client before any UI.

## The Specs — `design/`

The agent-kit files are canonical. Edit these, never their generated copies under
`docs/docs/engine/`:

| File | Owns |
|---|---|
| `design/00-brief.md` | Product vision, scope, non-goals, MVP, and definition of done |
| `design/10-design.md` | Architecture plus observability, extensibility, replay, capture, client, and content-pack design |
| `design/20-contract.md` | Core and all kind contracts, including exact types and invariants |
| `design/30-slices.md` | The W-numbered vertical delivery ledger; W ids are retained because repository history already cites them |
| `design/90-decisions.md` | Decision history, deferred items, and judgement calls to revisit |

Each file contains marked human-document blocks. `build/ConvertTo-HumanDocumentation.ps1`
extracts them deterministically into `docs/docs/engine/`; `build/Test-Documentation.ps1`
fails when a generated page differs or the generated developer guide is stale.

### Generated human documentation — `docs/docs/engine/`

Read in order. These files are scoped deliberately and cross-reference by section number, but
they are outputs, not editing surfaces.

| File | Holds |
|---|---|
| `01-vision.md` | Why the platform exists; the core/kind/campaign model |
| `02-architecture.md` | Every settled architecture decision with rationale. **The contract (decisions)** |
| `04-core.md` | The core as **types**: the Kind interface (the seam), `GameState` envelope, engine API, session store, projection, validation, reason codes, MCP schemas, determinism harness. **The contract (types)** |
| `03-story-graph-kind.md` | The flagship kind's content types: nodes, choices, typed variables, consequences, endings, achievements, turn/settle semantics + worked Bureaucracy-arc example. `kindState` plugs into 04's envelope |
| `11-content-packs.md` | Post-MVP: resolving an ordered pack set into the frozen registry. Campaigns replace wholesale, strings replace per key. The load-bearing part is **identity** — `campaignVersion` becomes a digest of the resolution, because two players on the same campaign version with different packs are playing different games and the envelope had no way to say so |
| `10-simulation-kind.md` | The second kind against the Kind seam — **the seam only**, not a port. Reconciles the upstream model with the envelope (seven fields it must not duplicate, and no persisted `RngState`), maps its richer verbs onto the one-action model (`plan.add`/`remove`/`clear`, `end_week`), and fixes projection, reason codes, events and terminal identity. §14 states what is still upstream and why |
| `12-world-graph-kind.md` | The third kind: a navigable world with autonomous inhabitants. A tick batch is the turn, and **batch invariance** — `advance_ticks n` reaches the same `kindState` as any split of it — is the load-bearing property, the one that forced `KindContext.derive` and the `tick` stream into 04. Win/loss is `Kind.outcome`, not a `GameStatus`. Not related to `story-graph` despite the suffix: a story graph is *authored*, a world graph is *navigated* |
| `09-clients.md` | The **client contract**, MVP scope: a client is a projection of the session store, never a participant — made testable as *two clients, same inputs, byte-identical `serialize()`*. Defines the **API coverage checklist** that `MVP.md` §5 and W16 both required and neither specified: ten store operations, ten MCP tools, one-to-one |
| `13-playable-web-demo.md` | The first public browser client: a static `/play/` route over the Bureaucracy MVP, the browser-portability boundary, same-page checkpoint lifetime, client-parity proof, responsive/accessibility rules, and the explicit line between an engine demo and a finished game |
| `14-game-interface.md` | The presentation redesign for `/play/`: an original absurd adventure cabinet with a scene stage, tactile action deck, projected status console, controlled joke density, original-asset rules, and responsive/accessibility proof |
| `15-platform-static-host.md` | The first Platform consumer: a product-owned ASP.NET static host and immutable container image for the existing combined artifact, with the package-release gate, CI smoke contract, GHCR publication boundary, and the explicit line before a hosted engine |
| `08-session-capture.md` | Turning a played session into a `ReplayFixture` — post-MVP, gated on hosting. Mostly a **privacy contract**: no identity, only kind-declared params (`ActionParams` is arbitrary caller input), no timing; the seed is the sharp edge; promotion to the committed corpus is a reviewed one-way door |
| `07-replay.md` | The **regression oracle**, post-MVP: replaying `{config, actionLog}` fixtures across *engine versions* and comparing an `Outcome` built only from cross-version-stable vocabulary (`GameStatus`, `ReasonCode`, achievement ids). Distinct from 04 §14, which compares a build against itself. Fixtures are inputs, not state, so this sidesteps save migration |
| `06-extensibility.md` | Where the engine can be extended: the **ports** a host supplies (`IdSource`, stores, `Emitter`, `Clock`, `ExperimentSource`), the two composition roots, and the rule that decides — *a host may supply anything that cannot change `serialize()` output*, which makes the determinism boundary the trust boundary. Kinds stay engine-owned per architecture N2 |
| `05-observability.md` | Logging and tracing as a **separate channel** from `StateChange`: the clock-free `EngineEvent`, the per-resolution emitter handle, sinks, and the boundary that stamps time and trace ids. The invariant is that dropping every event changes nothing |
| `MVP.md` | The smallest slice that proves the platform, + Definition of Done (finalized) |
| `TODO.md` | The MVP as ordered **units of work** (W0–W19), each with contract refs, dependencies, and done-criteria; the MVP boundary is marked |
| `OPEN-QUESTIONS.md` | Living register of unknowns, gaps, deferred decisions. §1 is now a **decision log** — the eight MVP-blocking gaps are all resolved; start here for the reasoning behind a contract |

## The Code — `src/engine/`

The engine npm package (`package.json`, `tsconfig.json` strict, `eslint.config.js` with
the determinism guard, `README.md`). Phase 1 core under `src/engine/src/core/`:
`determinism/pcg32.ts` (seeded PCG32, verified bit-identical to reference vectors),
`persistence/canonical.ts` (canonical serialization), each with a `.test.ts` alongside. The
contracts it builds against are the canonical core and kind documents; current work is
stabilization and release hardening, not Phase 1 bootstrap.

**Numbering is positional.** Inserting a doc between existing ones means renumbering
everything after it and rewriting every cross-link. Prefer appending. *Reordering* is now
free — reorder the list in `docs/sidebar.ts` — but *inserting* still is not.

### Where Drift Happens

**`03-story-graph-kind` ↔ `04-core`** drift: `04` implements `03` as types. An edit to one
not mirrored in the other is this project's most common defect. When a type changes, update
the prose description, any example, the projection, and the validation/test list too.

**Envelope-duplication recurs — five times now.** A kind must not duplicate what the
`GameState` envelope, `Campaign`, or registry already own. The full ledger, in order:

1. `StoryGraphKindState` duplicated envelope fields (03 §8.1)
2. `StoryGraphCampaign` duplicated `id`/`version`/`titleKey`/`strings` belonging to
   `Campaign` / the registry (04-core §10.1)
3. `StoryGraphView` duplicated scene and status fields (03 §9 vs 04-core §6/§9)
4. `SimulationKindState` carried seven envelope fields plus a persisted `RngState` (10 §2)
5. `ResortGameState` carried six plus a persisted `RngState` (12 §3)

**This ledger itself drifted** — four documents carried four different counts, none of them
complete, because each was written from memory rather than from the list. When updating it,
add to the list and re-count; do not increment a number.

**It recurs on the *view* side too**, not just state and content (entry 3). Whenever a kind
mirrors a core concept, check the identity fields live in exactly one place — the envelope,
not the kind.

**Determinism is enforced, not hoped for.** The eslint guard bans `Math.random`, the
non-bit-stable `Math.*` functions, and `Date.now` in `src/`. The core must replay
byte-for-byte from a seed and inputs; the determinism harness (04-core §14) is the
acceptance test with teeth.

---

## Tooling

### Docs Site — `docs/` (Docusaurus)

The specs are a Docusaurus site. `docs/` is both the Docusaurus overlay and the Docker
build context:

- `design/` — the canonical specs. `docs/docs/engine/` — their generated human-facing pages.
  `docs/docs/guide/` — generated and authored how-to pages for working on the code and the
  site. **Sidebar order and sections are stated in `docs/sidebar.ts`, not inferred from
  filenames or front matter** — that is how `04-core` sits before `03-story-graph-kind`,
  matching the stated reading order. **A new page is invisible until it is listed there**;
  an id that does not resolve fails the build.
- `build/ConvertTo-HumanDocumentation.ps1` — the design → human-doc generator. Run it after
  editing marked blocks in `design/`; run `/make-human-docs` for `docs/docs/guide.md`, then
  stamp the guide with `./build/ConvertTo-HumanDocumentation.ps1 -StampGuide`. Never edit a
  generated engine page directly. `./build/Test-Documentation.ps1` runs the corresponding
  `-Check` automatically.
- `docs/docusaurus.config.ts`, `docs/sidebar.ts` — **local overrides** of the base image's
  defaults (a manual sidebar — grouping by folder would move files and change every URL;
  all three Docusaurus link checks are `'throw'`, anchors included — they
  were `'warn'` only while a static file held the site root, and `build/Test-Documentation.ps1`
  is the second gate, covering the relative links and anchors Docusaurus resolves differently;
  see `agent.md`, *Two link checks*). **Spec docs name `src/engine/` code by its
  repository-root path in prose — `src/engine/eslint.config.js` — never by a relative
  traversal, and never as a markdown link.** `docs/` is the whole Docker build context
  (`COPY . .`), so `src/engine/` is not in the image: a relative link out of `docs/docs/engine/`
  would resolve to nothing and fail the production build under `onBrokenLinks: 'throw'`. A
  relative path in *prose* is no better — it is clickable nowhere, meaningless on the published
  page (which lives at a URL, not a directory), and correct only while reading raw markdown in
  a checkout. To point a reader at the code, link the **guide page**
  (`/docs/guide/engine-package`), which is a real route.
- `docs/src/pages/index.md` — **the site root, generated from `README.md`.** Do not edit;
  edit the README. `.config/DocumentationRules.psd1` registers it for drift checking, and
  the gate fails the build if the two disagree. Because `routeBasePath` is `'docs'`, the
  README becomes the root page rather than the docs index, and the generator appends a
  `[View the documentation](/docs/)` link to it.
- `docs/docs/index.md` — the `/docs/` landing page, listing the specs in reading order.
  Ordinary authored content: it used to be the generated copy of the README, and no longer
  is.
- `docs/Dockerfile` — extends `ghcr.io/the-running-dev/docs-template` and `COPY . .`
  overlays the above onto `/template`.

Run it with **`docs.ps1`** (repo root; needs Docker Desktop running). **It is installed by
`Invoke-SetupDocs`, not committed** — the installer rewrites it for this project's paths and
tag, so it is generated rather than vendored. A hand-written copy predating the template used
to be committed here and was deleted; if the file is missing, run the installer. The installed
version also regenerates `docs/src/pages/index.md` from `README.md` on every run, which
retires doing that by hand:

| Command | Does |
|---|---|
| `./docs.ps1` | Build the image, run it, serve <http://localhost:3000/docs/engine/vision> |
| `./docs.ps1 -Live` | Same, but bind-mounts `docs/` so edits hot-reload without a rebuild |
| `./docs.ps1 -BuildOnly` | Build the image only |

### Graphify — `/graphify`

Personal skill at `~/.claude/skills/graphify/`. Turns the folder into a knowledge graph
with community detection. There is **no current graph** in this repo — run `/graphify` to
build one.

- **On the code (`src/engine/`)** it is nearly **free** — TypeScript is extracted
  structurally via AST, no LLM. Worth it as the code grows.
- **On the prose specs** it is **expensive** (~200K tokens for a full rebuild) and its
  value is marginal on this small a corpus — reading the docs directly finds more. Don't
  full-rebuild the specs casually; use `--cluster-only` (free) or `query`.
- **TRAP — `--update` destroys cross-file edges.** `build_merge` drops every edge a
  re-extracted file owns, and chunked LLM extraction only recreates an edge when both
  endpoints are in the same chunk. When running `--update`, extract the changed files
  **together with everything they cross-reference**; verify cross-file edge counts against
  the backup afterward.

### Claude-Mem

Plugin at `~/.claude/plugins/cache/thedotmack/claude-mem/`. **`/claude-mem:learn-codebase`**
reads every file in full — run it after a long session of many small edits; editing from
diffs accumulates drift only a full read catches. **`/claude-mem:cloud-sync`** uploads to
cmem.ai Pro and needs a token the **user** places themselves (Claude never handles
credentials). Troubleshoot with `npx claude-mem doctor`.

### Two Memory Systems — Do Not Confuse Them

- **claude-mem** — background worker on `localhost:37777`, captures observations passively.
- **Claude's file memory** — plain markdown under
  `~/.claude/projects/D--Dropbox-Projects-SubZeroDev-GameEngine/memory/`, written
  deliberately, loaded each session via `MEMORY.md`.

Independent. Neither affects the other.

---

## Working Conventions

Findings and review items are presented **one at a time for sign-off**, not applied in
bulk. When a suggestion is declined, record it in the affected document (or
`OPEN-QUESTIONS.md`) as a known-and-retained issue rather than dropping it silently.

**A reconciliation ends in a decision, not a report.** Any time you compare two things and
find they disagree — `/reconcile`, `/install`, `/track` drift, a spec checked against the
code, or any time the user says "reconcile" — the work is not finished at the findings.
Close by asking, one divergence at a time, each with a recommendation and what the
alternatives cost. **A report the user has to turn into questions is half the job.**
Recommend the *resolution*: what changes, in which file, and what reversing it costs. If
nothing diverged, say so plainly rather than manufacturing a fork.

`/redteam` is the one exception, and only partly: it must not propose fixes, since naming a
fix frames the problem. It still recommends a **classification** — defect, accepted risk,
brief conflict, or not sustained.

Lessons learned the hard way live in [`agent.md`](agent.md).

### Safe Start

Before editing: `git status --short --branch`, `git remote -v`, and enough of a file listing
to know what is actually here. Read this file and the relevant sources **completely** — this
project's recurring defect is editing from memory rather than from the artifact. Preserve
unrelated work; never commit secrets, caches, or build output (`artifacts/`, `dist/`,
`node_modules/`). Work on a focused branch.

### Effort and Model Selection

Match capability and reasoning effort to the **task**, not to the tool that reached it. Use
the smallest model and lowest effort that still produces production-quality output; reserve
the strongest model and highest effort for genuinely ambiguous or architectural work. Budget
scales with **complexity, not size** — a one-line change to the determinism guard is
architectural; a 500-line spec transcription against a settled seam is not.

| Tier | Work | Model here |
|---|---|---|
| **Deep reasoning** | Architecture, specs, API/seam design, root-cause analysis, multi-step planning, comparing implementation approaches, security and performance strategy | **Opus**, high effort |
| **Implementation** | Code against settled contracts, tests, refactors, bug fixes, CI/infra, docs tightly coupled to implementation | **Sonnet** — or Opus at standard effort for significant features, large PRs, or hard bugs |
| **High volume** | Summaries, changelogs, commit messages, PR descriptions, formatting, triage, log and tool-output summarization | **Haiku**, default effort |

Worked examples from this repository: the W20–W26 programme split and the
`10-simulation-kind` `outcome()` reconciliation were deep-reasoning; W24's execution — eight
enumerated edits against an approved plan — was implementation tier and did not need Opus.

**Division of control.** The *user* sets the session model with `/model`; *Claude* sets
subagent models via the Agent tool's `model` parameter and scales its own reasoning depth.
Claude cannot switch its own session model — if a task warrants a different tier, say so
rather than silently over- or under-spending.

**Never use `max` effort unless the user asks for it by name.** **`xhigh` is for one
question, not one phase** — running a whole design pass at `xhigh` is not rigour, it is a
substitute for asking a precise question. If the session is *stronger* than the task needs,
just proceed; do not interrupt to say so.

**Budget discipline.**

- Do not spend reasoning to manufacture findings, alternatives, or open questions. "None at
  this level" is a valid result; a padded answer is worse than a short one.
- Once a decision is signed off and recorded, do not relitigate it without new evidence.
  Name the evidence if you think there is some.
- Spend frontier-model reasoning on decisions that are expensive to reverse, not on
  producing more prose.
- Never recommend re-running a phase gate. The user decides when a phase repeats;
  `/redteam` carries its own stopping rule.

**What should stop being model work.** The tiers above decide *which* model does a job. This
decides whether a model should be doing it at all.

| | Work | Where it belongs |
|---|---|---|
| 🟢 **Necessary** | Architecture, contracts, root-cause analysis, design tradeoffs, adjudicating findings | A model, at the tier above |
| 🟡 **Maybe avoidable** | Regenerating context already established, duplicate repository scans, rewriting boilerplate | A model, but the repetition is a signal — say so |
| 🔴 **Definitely avoidable** | Formatting, mechanical text transformation, arithmetic over files, counting, collecting metrics | Code. It should leave the model entirely |

A red item is a defect in the tooling, not in the run. Noticing one is worth a line; performing it
repeatedly and never saying so is the failure. When a red item recurs, add it to the open register
in `design/90-decisions.md` so `/track` can turn it into an issue — that is the existing path, and
there is no separate mechanism for this. This repository has already taken that route once:
`build/ConvertTo-HumanDocumentation.ps1` exists because regenerating human pages by hand was red.

Two distinctions that are easy to get wrong:

- **The mechanical half of a task is red; the judgement half is not.** Opening an issue is an API
  call, but deciding what warrants one is not. Writing a PR description is a template, but which
  merge convention governs is not. Do not classify a whole command by its cheapest step.
- **Do not report a cost you did not measure.** A model is not given its own token counts or
  elapsed time, so any figure it states about its own run is an estimate presented as a
  measurement. `tools/Measure-Session.ps1` reads the real per-call usage from the session
  transcript, and runs as a `SessionEnd` hook. It measures **Claude Code sessions only** —
  Codex writes a different schema this has no reader for, and Copilot records no token usage
  at all. Use it, or say nothing — under either of those, *say nothing* is the whole
  instruction.

### Hard Rules

- **Non-goals are binding.** Anything listed as a non-goal in `01-vision.md` §5 is out of
  scope even if it looks trivial, even if you are already touching that file.
- **One unit at a time.** Do not start W<n+1> because you noticed something while doing
  W<n>. Write it to `90-decisions.md`'s open register instead.
- **No new dependencies** without a decision-log entry naming the alternatives rejected and
  why.
- **No new public interfaces** that are not in `20-contract.md`. If you need one, stop and
  ask for a contract amendment.
- **Ask instead of assuming.** If two readings of a spec are both defensible, stop and
  present both. Do not pick one and proceed.
- **Every unit ends runnable.** No half-wired states committed.

### The Design Freeze

The pipeline's normal loop keeps `design/` live: a unit lands, `/reconcile` writes reality
back, `/track` resyncs the tracker. That is right while the design is still being settled
and **wrong once implementation is the bottleneck**, because each pass is generative rather
than merely checking — landing W<n> rewrites W<n+1>'s specification, which desyncs the
tracker, which needs `/track`, which finds drift, which needs `/reconcile`. The loop has no
fixed point. Freezing is how it is escaped.

**`design/FROZEN.md` is the marker, and its existence is the whole mechanism.** It is
tracked, not ignored — a freeze is a statement to everyone working in the repository, not
local state. While it exists:

- **`/reconcile` and `/track` do not run.** The tracker is deliberately allowed to go stale.
- **`/design`, `/contract` and `/slices` refuse.** Authoring is gated too, so the docs
  cannot drift forward while the implementation is being checked against them.
- **Units implement against `20-contract.md` as a fixed artifact**, at the SHA the marker
  names.
- **A contradiction found while implementing is stated in that unit's pull request and left
  in the document.** Do not fix it in `design/`. The staleness is the point; recording it in
  the PR is what makes the eventual reconciliation cheap.

**`/freeze` writes the marker; `/unfreeze` lifts it** — deletes the file, then runs one
reconciliation pass, `/reconcile` then `/track`, in the same session. `/unfreeze` runs
unattended, without a confirmation prompt; the freeze itself is still the user's decision,
made when `/freeze` is invoked, and lifting it early is one command call away rather than
gated a second time. A unit that turns out to need a contract amendment still stops and
says so; that escalation is the user's to answer, and answering it may well be "thaw,
amend, re-freeze."

The marker's format, which the five gated commands read and must not restate:

```markdown
# design/ is frozen

Frozen at: <sha>, <YYYY-MM-DD>
Frozen because: <what the freeze is escaping>
Lifts when: <the checkable condition — "tier one is code-complete", not "when we are ready">

To lift: run `/unfreeze`, or delete this file by hand and run `/reconcile`, then `/track`.
```

A command that refuses reports `Frozen because` and `Lifts when` **verbatim** rather than
paraphrasing them — the point of a stated condition is that it can be checked against, and a
paraphrase is where it stops being checkable.

### The Agent Kit — Canonical Workflow

`.claude/commands/` holds the
[agent kit](https://github.com/The-Running-Dev/SubZeroDev.AgentKit)'s pipeline commands.
`design/00-brief.md`, `10-design.md`, `20-contract.md`, `30-slices.md`, and
`90-decisions.md` are now their real canonical inputs. This repository extends the generic kit
in two deliberate ways:

- Existing W identifiers remain the slice ids. Renumbering them to S would break plans, tests,
  issues, changelog entries, and merged history without changing the work.
- The design and contract files contain marked, independently generated human pages. Commands
  must read the complete canonical file, including every marked block relevant to the task.

`plans/` remains implementation history and handoff material. It may explain how one slice was
executed, but it never overrides the five canonical design files.

**Generation workflow.** After a canonical edit:

1. Run `./build/ConvertTo-HumanDocumentation.ps1` to regenerate detailed engine pages.
2. Run `/make-human-docs` to regenerate `docs/docs/guide.md` when the brief, design, or contract
   changed semantically.
3. Run `./build/ConvertTo-HumanDocumentation.ps1 -StampGuide` after regenerating the guide.
4. Run `./build/Test-Documentation.ps1`; it checks both exact generated pages and guide digest.

Routing, when a command is run:

| Command | Tier |
|---|---|
| `/brief-check`, `/design`, `/contract`, `/slices` | Opus, high |
| `/redteam` | strongest model, **different vendor from the design author**; if it must be Claude, a fresh Opus session |
| `/slice` | Sonnet, medium — high for a large or difficult work unit |
| `/reconcile` | Opus, high to decide which side of a drift is correct; Sonnet, medium to apply the edits |
| `/install` | Sonnet, medium |
| `/install-all` | Sonnet, medium — escalate only to judge whether a per-repo hard stop is actually safe to resolve; never to resolve it unattended |
| `/make-human-docs` | Sonnet, medium — generate the developer guide from canonical `design/`, then stamp its digest |
| `/track` | Sonnet, medium — escalate only to judge whether a drifted work unit is a design change |
| `/verify` | Sonnet, medium — escalate to deep reasoning only to diagnose a failure, never to run the gates |
| `/pr` | Sonnet, medium |
| `/resolve` | Sonnet, medium — escalate to judge a contested finding, not to triage the obvious ones |
| `/refine` | Sonnet, medium — never escalates; an architectural ask is routed to the command that owns it, not refined |
| `/kit-help` | Haiku, low — orientation from file existence and a tracker listing; escalate only where the repository's state matches no stage |
| `/done` | Haiku, low — mechanical git housekeeping; escalate only to judge whether an unmerged-looking branch is actually safe to delete |
| `/freeze` | Sonnet, medium — `Frozen because`/`Lifts when` come from the user, never invented |
| `/unfreeze` | Sonnet, medium for the sequencing; runs `/reconcile` (Opus, high) and `/track` (Sonnet, medium) as its own phases |

**`/track` reads `design/30-slices.md`.** It opens one issue per unvisited W-numbered work unit;
W is this repository's retained slice prefix. New units carry stable per-criterion ids
(`W42.1`, `W42.2`, never reused or renumbered — the same discipline as the existing positional
`W3a` unit numbering, one level down), and issues open in the shape `.claude/commands/track.md`
defines: a human-first narrative, `### Done when` checkboxes, and a fenced `<!-- agent:start -->`
block that `/track` regenerates but never overwrites outside the fence. Existing checked units
predate this and are not retrofitted or reopened.

**Tracking work.** Opening, labelling, closing, commenting on, and editing an issue — including
one opened by someone else — needs no per-instance approval in a repository the user owns;
issues are cheap and reversible. Creating a milestone or a project is carved out the same way;
deleting either is not, since that direction is not cheaply reversible. Writing to a repository
the user does not own is never carved out. **Resolving or replying to a review thread is not
covered by this carve-out** — a pull request's review threads are a different object and stay
authorized regardless, same as any other external write in **Git and Pull Requests** below.
`/track` owns every GitHub write it can make idempotent; closing an issue and ticking a
checkbox are the exceptions — the command that observes the work done (`/track`, `/slice`)
does those directly, in the same run, rather than waiting for a sync pass.

**Session boundaries.** Routing above says which model runs a command. This says **when a session
must end.** A boundary exists wherever carrying context would corrupt the next step's judgement, or
wherever the next step must read the tree rather than remember it. The artifact is the handoff, not
the conversation — a stage that writes one has already handed over everything the next stage is
entitled to.

| Boundary | Rule | Why |
|---|---|---|
| `/design` → `/redteam` | **Fresh session, and a different vendor.** | A model recognises its own output distribution and defends it. Fresh context on the same model is already the weak form; the same session is not a review at all. |
| Any stage that writes a canonical `design/` file → the next | Fresh. | The next stage's input is the committed file. A session that also remembers the arguments behind it will design against the arguments. |
| `/slices` → `/slice` | Fresh, and **one work unit per session**. | A unit that does not fit one session without compaction is too large — that is a `/slices` defect, so say so rather than pressing on. |
| `/slice` → `/verify` → `/pr` → `/resolve` | **Same session.** | These act on the branch and worktree the unit just produced, and `/pr` must carry `/verify`'s did-not-run list into the description **verbatim**. A fresh session would restate it from a summary, which is the fabricated gate result **Validation** below exists to prevent. |
| merge → `/track` | Fresh. | `/track` reads the tracker and `design/` as they now stand. The session that just implemented the unit holds an opinion about whether it is done, and doneness is the user's mark, not an agent's. |
| implementation → `/reconcile` | Fresh. | It compares the tree against the canonical documents. The session that wrote the code carries what it *intended* to write, which is the one thing the comparison must not be given. |

**Compaction is a boundary you did not choose.** If a session compacts mid-unit, report it — the
unit was mis-sized, and the work after the compaction was done against a summary of the contract
rather than the contract itself.

**End a response that lands on a fresh-session boundary with a banner, not a footnote.** A
boundary buried in the last sentence of a report gets carried into the next reply of the same
session out of habit, which is the exact failure the boundary exists to prevent. Set it off
visibly — a horizontal rule and a bold line is enough — naming: the boundary just crossed, the
next command, and its tier from the routing table above. For example:

```
---
**Session boundary.** This context should not carry into `/track`.
Next: `/track`, fresh session, Sonnet, medium.
---
```

Do not run the next command yourself. Ending a session may be the next step, and a command that
starts work cannot also tell the user to start a new one for it — that restriction is unchanged,
only how visibly the handoff is stated.

### Single Ownership

- **Reference, never restate.** A rule that lives in another document is linked, not copied.
  Two copies of a rule is a promise they will diverge and a guarantee nobody notices which is
  stale. `AGENTS.md` is a pointer for exactly this reason.
- **Move, never copy.** A rule has exactly one home. When it belongs somewhere else, move it
  and leave a reference behind.
- If a document genuinely must repeat something to stand on its own, name the canonical copy
  in the text and change both in the same commit.
- **Non-goals are binding.** Anything in `01-vision.md` §5 is out of scope even if it looks
  trivial, even if you are already touching that file.

### House Conventions

- Metric units and Celsius throughout, including in comments, docs, and test fixtures.
- Raster assets as PNG or JPG. Not WebP.
- **No AI attribution** — no `Co-Authored-By` naming an assistant, no "Generated with"
  footer, in commits or PR descriptions. This overrides any default the tooling applies.

**Escalate rather than guess.** A high-volume task that raises an architectural question
becomes implementation tier; an implementation task that raises architectural uncertainty
becomes deep-reasoning tier. **Do not continue implementing while that uncertainty is
unresolved** — this repo's contracts are the thing most expensive to get wrong.

### Git and Pull Requests

**Commit messages follow this repository's existing descriptive style, not Conventional
Commits** — `W20-W23 — Replay Regression Oracle`, `Fix release-tag-replay: checkout never
fetched sibling tags`. Deliberate: 75 merged PRs set that precedent, and a `feat:`/`docs:`
prefix would buy nothing this project reads. Keep them **concise** — state what changed and
why it was not the obvious alternative; the long-form reasoning belongs in `plans/`.

**Stage explicitly, by named path.** Never `git add -A`, `git add .`, or a bare directory —
a broad add silently sweeps up unrelated working-tree state. Not a borrowed rule:
`.gitignore`'s own comment records a near-miss where a `build/` pattern would have made
installer-added scripts invisible to `git add -A` — present locally, green locally, missing
in CI, with nothing saying why.

**Never force-push or rewrite published history.** `main` blocks it (`non_fast_forward`);
feature branches do not, so it is discipline rather than enforcement. If a pushed commit
needs changing, add a follow-up commit.

**Deleting a local branch `/done` independently confirms via `git branch --merged` is
delegated in this repository.** `/done` (`.claude/commands/done.md`) runs proactively — as
soon as a merge is on the table, not only when asked — and deletes every branch on that
confirmed list without a chat confirmation first; the `--merged` check is the authorization.
It also may stash (never discard) a dirty tree to unblock its own branch switch, and always
reports the stash back rather than popping it silently. This delegation stops exactly where
`--merged` stops: a branch it did not confirm, or a `-d` refusal on one it did, still needs a
separate ask before anything stronger (`-D`) is even considered.

**`/slice` may push the branch it creates and open its PR as a draft, without asking** —
carved out of the authorization rule the same as an issue: a draft blocks no one and requests
no review, so opening one carries the same reversibility argument. Marking that PR ready for
review, and merging it, are not carved out and stay `/pr`'s and the user's respectively.

**Do not enable auto-merge.** Open the PR, report the check outcomes, and leave the merge to
the user. (Auto-merge is enabled at the repository level and `required_approving_review_count`
is `0`, so it *would* work — this is a deliberate workflow choice, not a limitation.)

> **Push every commit before announcing a PR is ready.** Announcing invites an immediate
> merge, and a commit pushed after that lands on a branch nobody merges — PR #77's second
> commit was squashed out exactly this way and needed recovering as PR #78. With auto-merge
> off, this discipline is the only thing preventing it.

**Three required checks** on `main` — `engine`, `Documentation links and terminology`,
`Verify Documentation Build`. The deploy job is *not* required (it runs only on `main`, so
requiring it would leave every PR pending).

**`required_review_thread_resolution` is on.** Automated PR review runs via the
`anthropics/claude-code-action` GitHub Action (Qodo is retired and no longer in use).
Automated review comments can leave conversation threads that do **not** appear in
`gh pr view --json reviewRequests,latestReviews`; query threads directly via the GraphQL
`reviewThreads` field. Resolve a thread only when a validated fix satisfies it; leave
ambiguous findings open and report them.

### Validation

Run what applies, and do not claim a gate passed that did not run:

```powershell
./build/Test-Documentation.ps1                                  # links, terminology, generated-doc drift
cd src/engine; npm run typecheck; npm run lint; npm test        # the `engine` job's own three
git diff --check
git status --short --branch
```

`./docs.ps1 -BuildOnly` is the production Docusaurus build (`onBrokenLinks: 'throw'`, the only
gate that resolves *routes* and heading anchors). It needs Docker **and** an installed
`docs.ps1`. When either is missing, say so plainly and verify the *Verify Documentation Build*
check on the PR instead — never report it as locally passing.

**Never state or imply a published URL until the deploy workflow for that exact merge commit
reports success.** A merged PR is not a deployed site; poll the run rather than estimating.

**A regression test is verified by reverting the fix** and confirming it fails. A test that
passes with and without the fix guards nothing.

**A schema or validator change is not done until it has rejected something.** Positive and
negative cases both, with the counts stated. A validator that has never failed is not known
to constrain anything.

### Imported From the Blog Repository — and What Did Not Transfer

The conventions above were reconciled from `The-Running-Dev`'s blog-repository guidelines.
Recorded here so the same reconciliation is not redone, and so the non-transferring rules are
not re-imported by someone reading that document next to this one.

**Two of its rules are inverted here and must not be adopted:**

1. *"Do not restore `build/ConvertTo-DocumentationHomepage.ps1` or `docs/src/pages/index.md`"*
   — correct there, because its blog owns `/`. **Both are load-bearing here**: `routeBasePath`
   is `'docs'`, so the README *is* the site root, generated into `docs/src/pages/index.md` and
   drift-checked by `.config/DocumentationRules.psd1`.
2. *"Required PR checks are"* — it lists two. This repo requires **three**; `engine` has no
   equivalent there and is this repository's most valuable gate.

**Absent here, so the rules referencing them do not apply:** `tools/blog-mcp/` (and every
`blog_*` tool), `docs/blog/`, `docs/src/pages/blog/`, `MILESTONES.md`, `.config/blog.json`,
`build/Test-DocumentationArtifact.ps1`, `.agents/workflows/`. There is no blog, no
front-matter/tag/slug contract, and no `/welcome/` route — this repository publishes specs
under `/docs/`.
