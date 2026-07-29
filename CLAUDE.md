# Project Instructions

## What This Project Is

**SubZeroDev.GameEngine — the Game Engine.** A deterministic, game-agnostic
narrative-game platform: its **source** (`src/engine/`) and its **specs**
(`docs/docs/engine/`) in one repo.

The model is **core → kinds → campaigns**: one shared deterministic core, game-*type*
logic (`kinds`, engine-owned code), and content (`campaigns`, data). v1 ships two kinds,
`story-graph` (flagship, the MVP vehicle) and `simulation`.

**Companions:**
- **Game** — [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife):
  Life in the Fast Lane, the flagship `simulation`-kind game. Its docs are where much of
  this engine's core was first designed; `games/…` references throughout these specs point
  there.
  **`games/04-engine-specification.md` is the ancestor, not a second authority.** It is a
  104 KB *engine* spec that `02-architecture` and `04-core` were derived from, and it is
  cited ~21 times across these docs — every citation is provenance. For anything the core
  owns, the docs here supersede it. It still holds the only written rules for the
  `simulation` **kind** (its §5, §7–§10, §12, §14), which is engine-owned code that needs a
  contract *here* against the Kind seam, the way `03-story-graph-kind` is one. Stated in
  `04-core`, *Reused, not re-derived*.
- **Game** — [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap):
  Sun Trap, the flagship `world-graph`-kind game — a satirical resort-management sim. Design
  only, no code. Its kind contract is `12-world-graph-kind.md` here; the game's maps,
  scenarios, balance and client live there. Nothing in these specs depends on it.
- **Hosting / NEaaS** — [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform):
  the deferred hosting / SaaS layer.

The build strategy is **engine-first**: prove the deterministic engine with automated
tests and a plain text client before any UI.

## The Specs — `docs/docs/engine/`

Read in order. Files are scoped deliberately and cross-reference by section number.

| File | Holds |
|---|---|
| `01-vision.md` | Why the platform exists; the core/kind/campaign model |
| `02-architecture.md` | Every settled architecture decision with rationale. **The contract (decisions)** |
| `04-core.md` | The core as **types**: the Kind interface (the seam), `GameState` envelope, engine API, session store, projection, validation, reason codes, MCP schemas, determinism harness. **The contract (types)** |
| `03-story-graph-kind.md` | The flagship kind's content types: nodes, choices, typed variables, consequences, endings, achievements, turn/settle semantics + worked Bureaucracy-arc example. `kindState` plugs into 04's envelope |
| `11-content-packs.md` | Post-MVP: resolving an ordered pack set into the frozen registry. Campaigns replace wholesale, strings replace per key. The load-bearing part is **identity** — `campaignVersion` becomes a digest of the resolution, because two players on the same campaign version with different packs are playing different games and the envelope had no way to say so |
| `10-simulation-kind.md` | The second kind against the Kind seam — **the seam only**, not a port. Reconciles the upstream model with the envelope (seven fields it must not duplicate, and no persisted `RngState`), maps its richer verbs onto the one-action model (`plan.add`/`remove`/`clear`, `end_week`), and fixes projection, reason codes, events and terminal identity. §14 states what is still upstream and why |
| `12-world-graph-kind.md` | The third kind: a navigable world with autonomous inhabitants. A tick batch is the turn, and **batch invariance** — `advance_ticks n` reaches the same `kindState` as any split of it — is the load-bearing property, the one that forced `KindContext.derive` and the `tick` stream into 04. Win/loss is `Kind.outcome`, not a `GameStatus`. Not related to `story-graph` despite the suffix: a story graph is *authored*, a world graph is *navigated* |
| `09-clients.md` | The **client contract**, MVP scope: a client is a projection of the session store, never a participant — made testable as *two clients, same inputs, byte-identical `serialize()`*. Defines the **API coverage checklist** that `MVP.md` §5 and W16 both required and neither specified: nine store operations, nine MCP tools, one-to-one |
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
contracts it builds against are `04-core` and `03-story-graph-kind`; next up is the pure
engine `advance(state, action) → state`.

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

- `docs/docs/engine/` — the specs. `docs/docs/guide/` — how to work on the code and the
  site. **Sidebar order and sections are stated in `docs/sidebar.ts`, not inferred from
  filenames or front matter** — that is how `04-core` sits before `03-story-graph-kind`,
  matching the stated reading order. **A new page is invisible until it is listed there**;
  an id that does not resolve fails the build.
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

Lessons learned the hard way live in [`agent.md`](agent.md).
