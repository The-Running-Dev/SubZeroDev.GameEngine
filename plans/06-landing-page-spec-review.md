# Landing-page spec bundle — review record

## Context

An externally-authored bundle of 34 markdown files arrived untracked under `site/`, specifying a
custom Docusaurus landing page for the engine. It was written **without access to this
repository** — it says so itself, and defers every repository fact to a "Gate 0 repository truth
audit" that the implementing agent is told to perform before writing code.

This document records the review of that bundle, what was done with it, and a peer review of the
approach taken.

The bundle is editorially strong. Its voice, pacing, refusals/capabilities device and
origin-story structure are the best material anyone has written about this project. But handed
to an implementing agent as-is, it would have produced an architecture diagram naming a layer
that does not exist, a homepage that cannot be routed, and five capability claims the code does
not support.

---

## What was done

| Step | Outcome |
|---|---|
| Review | Ten findings, below, all verified against the repository |
| Preserve | Bundle committed verbatim as `4e3601b`, *"Add the landing-page spec bundle as received"* |
| Move | `site/` → `plans/06-landing-page/`, flattening the redundant `subzerodev-implementation-handoff/` level |
| Cleanup | 16 files with no unique content removed; 18 documents remain |
| Correct | One new document, `00-repository-reality.md`, carries the deferred audit and overrides the bundle on every question of fact |
| Index | `plans/06-landing-page/README.md` states reading order, authority order, provenance and open decisions |
| Wire up | Four pointer edits so the bundle references its own correction rather than contradicting it |

**The authored documents were left as written.** Their content is good; their *facts* were wrong,
and facts are what a single overriding document can carry without touching a word of the
original. The wrong diagrams and overstated capability lists remain in place, overridden rather
than rewritten, which keeps the diff reviewable and the provenance intact.

Final shape — 20 documents:

```text
plans/06-landing-page/
├── README.md                      index, reading order, authority order, provenance
├── 00-repository-reality.md       the audit — highest authority
├── 00-handoff-readme.md           objective, creative direction, content rules
├── 01-implementation-plan.md      seven gated phases, sequence, components, verification
├── 02-approved-homepage-copy.md   the copy deck
└── specifications/                14 source specs + their README
```

### Cleanup detail

- 15 files named `*_1.md`, byte-identical to their siblings (verified with `cmp` on all 15).
- 1 top-level `subzerodev-landing-page-implementation-plan.md`, byte-identical to
  `01-implementation-plan.md`.

16 removed, 18 unique remained. *(An earlier draft of this document said "17 of 34 carry no
unique content" — the correct figures are 16 duplicates and 18 unique.)*

### Pointer edits

Four minimal edits, so an implementer cannot follow a stale instruction:

- `00-handoff-readme.md` — `00-repository-reality.md` inserted at the top of the authority
  order; "First: repository truth audit" marked **DONE** with a pointer; the `AGENTS.md`
  reference replaced with `CLAUDE.md` and `agent.md`.
- `01-implementation-plan.md` — Phase 0 marked **COMPLETE** with its exit criteria shown as met;
  `AGENTS.md` corrected.
- `specifications/12-implementation-roadmap.md` — Phase 0 marked **COMPLETE**; a note that its
  phase order conflicts with the implementation plan's, which wins; a note that its Phase 5
  tooling does not exist; `AGENTS.md` corrected.

---

## Findings

### 1. Half the bundle was duplicate files

16 of 34 files carried no unique content. See *Cleanup detail* above.

### 2. PLACEMENT CONSTRAINT — the docs site's `/` is a generated file behind a CI gate

> **Reclassified.** This was recorded as a blocker on the assumption that the landing page would be
> built inside the docs project. It is a **standalone site under `site/`**, so this is not a problem
> to solve — it is the boundary between the two properties, and the reason the landing page needs its
> own project. The retirement procedure this finding originally implied is withdrawn in full; nothing
> in the documentation system changes.



The bundle's core instruction (`specifications/09-docusaurus-architecture.md:5`,
`13-agent-implementation-brief.md:70`) is "implement the homepage as a custom Docusaurus React
page" at `src/pages/index.tsx`. In this repo:

- `docs/src/pages/index.md` is **generated from `README.md`** by
  `build/ConvertTo-DocumentationHomepage.ps1`;
- it is registered under `GeneratedFiles` in `.config/DocumentationRules.psd1:50-63`, so
  `build/Test-Documentation.ps1` fails on byte drift;
- that gate is a required check in `.github/workflows/docs-ci.yml`;
- `CLAUDE.md` states plainly: *"Do not edit; edit the README."*

Adding `index.tsx` beside `index.md` creates two routes at `/`; deleting `index.md` breaks the
registered generated-file check. Not a Gate 0 detail — it invalidates the delivery vehicle, and
no document in the bundle mentions it.

### 3. Why a standalone project is required — there is nothing here to build into

> **Reclassified** from blocker for the same reason as finding 2. The absence of a project to extend
> is not a defect in the bundle; it is why the landing page gets its own `package.json` under `site/`
> — which in turn makes the bundle's test plan achievable rather than unrunnable.



`docs/` contains only `docusaurus.config.ts`, `sidebar.ts`, `Dockerfile`, `.dockerignore` and
markdown. No `package.json`, no `node_modules`, no `src/components`, no `src/css/custom.css`, no
`src/theme`. The site is built by the base image `ghcr.io/the-running-dev/docs-template:latest`
via `/template/scripts/docs-build.ps1 -SourceDocs ./docs`, with `docs/Dockerfile` doing
`COPY . .` as an overlay. Consequences the bundle never accounts for:

- every path needs rebasing `src/…` → `docs/src/…`;
- `src/css/custom.css` (`12-implementation-roadmap.md:11`) does not exist here to extend;
- **no formatter, linter, type-checker or test runner exists for the docs site.** The only npm
  project is `src/engine/` (vitest/eslint/tsc), and `.github/workflows/ci.yml` pins it to
  `working-directory: src/engine`. So `01-implementation-plan.md` §12 and
  `12-implementation-roadmap.md` Phase 5 have **nothing to run in**;
- React and TypeScript types resolve only inside the image, so a `.tsx` page cannot be
  type-checked locally.

### 4. The architecture model was wrong

The bundle asserts **five** layers — `Core → Mechanics → Kinds → Campaigns → Games`
(`01-product-vision.md:66-108`). The repo's model (`README.md:113` "The Model", `CLAUDE.md`) is
**four**: `Core → Kinds → Campaigns → Clients`.

- There is **no `Mechanics` layer.** Mechanics live *inside* Kinds — README: *"Kinds define
  mechanics. Campaigns define worlds. Clients simply present them."*
- The terminal layer is **Clients** (web, CLI, Discord, MCP agents), not "Games".
- Kinds are **engine-owned code** (architecture N2) and there are exactly **three**:
  `story-graph`, `simulation`, `world-graph`. The bundle describes them as open-ended genre
  assemblies — "detective story, survival game, political simulation, hotel management, RPG"
  (`01-product-vision.md:92-100`) — which is not what a Kind is. A visitor adds a **Campaign**,
  never a Kind.

Affected: `00-handoff-readme.md:82`, `02-approved-homepage-copy.md:118-154`,
`01-product-vision.md:66-108`, `05-landing-page-storyboard.md:159-177`,
`06-homepage-copy.md:116-122`, `07-visual-design-system.md:182-197`,
`10-component-specifications.md:97-100`.

This is the *naming* form of the envelope-duplication defect `CLAUDE.md` tracks: a layer invented
for the pitch that the contract does not own.

### 5. Capability claims outran the code

`src/engine/src/core/` holds `determinism/pcg32.ts`, `determinism/rng.ts`,
`persistence/canonical.ts`, `kernel/reasons.ts`, and otherwise **types-only** modules. There is
no `advance(state, action)` — `CLAUDE.md` calls it "next up". Against
`02-approved-homepage-copy.md:240-256`:

| Claim | Reality |
|---|---|
| "Validate commands" | contract only (`validation/types.ts`) |
| "Produce deterministic state transitions" | partial — RNG + canonical serialization exist, the transition function does not |
| "Replay worlds" | post-MVP (`07-replay.md`), not implemented |
| "Separate mechanics from fiction" | architectural contract |
| "Operate independently from a single presentation" | contract (`09-clients.md`); no client exists |

Same for `02-approved-homepage-copy.md:276` ("humans and AI could use the same engine
interface"). The copy's inline "Verification note" blocks anticipate this correctly; the bundle
just left the work undone when it was doable. `README.md:332` "Status" already models the honest
split.

### 6. Dead and wrong routes

- `09-docusaurus-architecture.md:151` lists `/blog/...`. Blog is **off** —
  `docusaurus.config.ts:56` sets `blog: false`.
- Same file lists `/architecture/...`; the real path is `/docs/engine/architecture`.
- The navbar today has exactly one item (Docs).
- `02-approved-homepage-copy.md:302` "Explore the concepts" has **no** corresponding route. Cut.
- **Every docs destination is an absolute cross-site URL**, not a path — the landing page is a
  separate origin and cannot resolve `/docs/...`. And nothing validates them: Docusaurus'
  `onBrokenLinks` covers only the docs site, and `build/Test-Documentation.ps1` skips site-absolute
  targets by design. The route inventory is the only check that exists, so renaming a spec silently
  breaks a CTA with no build failure anywhere.

### 7. `AGENTS.md` does not exist

Referenced by `00-handoff-readme.md:30`, `01-implementation-plan.md:82`,
`12-implementation-roadmap.md:7`. This repo uses `CLAUDE.md` and `agent.md`. Corrected in all
three.

### 8. The README already tells this story — OUT OF SCOPE by decision

> The observation stands and is left on record, but `README.md` is **out of scope**: not edited, not
> shortened, not consulted as a source of copy. There is no pitch-ownership decision to make, because
> the docs site keeps its README-generated root unchanged and the landing page is a separate property.



`README.md` is 459 lines and its headings map almost 1:1 onto the bundle's proposed sequence.
Because the README *is* the homepage today (finding 2), the bundle proposed a second home for
the same pitch and never acknowledged the original.

Any resolution that keeps a React page at `/` creates a **content-ownership question**: the
README serves the code host, the page serves the site, they will drift, and the drift gate being
removed is exactly the check that would have caught it. Recorded as an open decision.

Related: the README's contributor sections — `Layout`, `Build the Docs Site`, `Developing the
Engine` (`README.md:421-455`) — currently land on the public homepage.

### 9. Internal contradictions

- **Three page sequences**: `01-implementation-plan.md` §5 (12 sections), 
  `13-agent-implementation-brief.md` (12, different), `12-implementation-roadmap.md` Phase 1
  (10, includes "philosophy" which neither other has).
- **Phase order conflict**: the implementation plan runs architecture interaction before motion;
  the roadmap reverses it, contradicting the authority order its own
  `00-handoff-readme.md:19-26` establishes.
- **Component names disagree**: `09-docusaurus-architecture.md` has `OriginSection`, `StoryBeat`,
  `StoryTimeline`, `PhilosophySection`; `01-implementation-plan.md` §6 has `OriginTrigger`,
  `OriginResolution`, `AbstractionSection`, `CommandContractSection`, `RealizationSection`.

Resolved by authority order rather than by editing — the implementation plan wins on all three.

### 10. Gate scope

`build/Test-Documentation.ps1` defaults to `$Path = @($repositoryRoot)` (line 116) and recurses
for `*.md`; the bundle is in scope wherever it sits. Passes at every stage of this work.

---

## Peer review of the approach

A critical pass on the decisions taken above, including the ones I would push back on.

### The errata pattern is the same bet this project has already lost five times

An override document correcting eleven files creates **two places** that answer "what are the
architecture layers?" — and this repository has a written ledger of that exact failure.
`CLAUDE.md` records envelope-duplication recurring five times, and notes that *the ledger itself
drifted* because four documents carried four different counts, each written from memory rather
than from the list.

The errata is structurally the same wager: it is correct only for as long as readers reach it
first. Mitigations applied — top of the authority order in three documents, inline **DONE**
markers at each point where the bundle defers to an audit, and reading order stated in the index
— but they are conventions, not gates. Nothing fails if someone opens
`specifications/07-visual-design-system.md`, sees a five-layer ASCII diagram, and builds it.

**The honest assessment: correcting the diagrams in place would be safer.** It was ruled out to
preserve the bundle as authored, which is a legitimate call — but the risk is real and it is not
mitigated to zero. If this bundle is going to be handed to an implementing agent rather than
read by a human, correcting the seven affected files in place is the better trade.

### ~~Retiring the generated homepage is expensive~~ — WITHDRAWN

This was the strongest objection to the earlier plan: retiring the generated homepage meant giving up
a working drift gate, re-running an installer that rewrites an uncommitted script, and editing
`CLAUDE.md` plus a config comment.

**It evaporated with the assumption beneath it.** The landing page is standalone, so nothing is
retired and nothing in the documentation system changes. Recorded rather than deleted because it is
the clearest evidence that the placement correction genuinely simplified the work rather than shuffling
complexity — two open unknowns closed as moot at the same time.

### The no-JavaScript requirement was found late, and there may be others

It sat in seven places, in documents read in full, and only became visible when the stack changed —
because Docusaurus satisfied it invisibly. **A constraint met by accident is indistinguishable from a
constraint understood**, until the thing meeting it is removed.

Dropping it was the call, and the strike deliberately preserved the three requirements tangled with it
(keyboard, screen reader, reduced motion) plus restated reveal safety. But the class of error is worth
naming: route handling, heading-anchor generation and image handling were also framework-provided and
have not been audited with the same care. Theme toggling and `prefers-color-scheme` closed when the
dark-only decision landed.

### Two unknowns sit on the critical path

The VERIFY AT BUILD items in `00-repository-reality.md` §4 are not minor. If the base image ships
its own `src/pages/index.*`, removing the generated markdown may unmask it and the retirement
procedure needs another step. That cannot be settled without Docker, and it gates the delivery
vehicle. It is flagged rather than resolved, which is correct, but it means the procedure in §5
is *probably* complete rather than *known* complete.

### The capability matrix is a drift surface I introduced

It snapshots `src/engine/` at W2. Every subsequent W-item promotes rows from Contract toward
Implemented, and nothing links the table to the code. This is a new place for the repository to
disagree with itself. A note has been added to §2 requiring a re-check before any copy change
and whenever a W-item lands — again a convention, not a gate.

Worth noting the direction of failure is benign: a stale matrix *understates* what is built, so
the page becomes modest rather than dishonest. That is the right way round, and it is luck rather
than design.

### Smaller items

- **`plans/06-landing-page/` is the first subdirectory under `plans/`.** The existing convention
  is five flat numbered files. Justified by this being a multi-document bundle, but it is a new
  convention and worth knowing.
- **20 markdown files entered the documentation gate's scope.** Fine today — the gate passes —
  but any future relative link or terminology slip in the bundle now fails Docs CI. Accepted.
- **Nothing was done about the copy itself.** Correcting the architecture section and the
  capability list in `02-approved-homepage-copy.md` is downstream work, deliberately gated on
  pitch ownership being decided. Until then the approved copy still contains a five-layer diagram
  — overridden, but present.

---

## Verification

| Check | Result |
|---|---|
| `./build/Test-Documentation.ps1` | **Passes**, 49 files. Links, anchors, terminology, generated-file drift |
| Bundle file count | 20 — 18 originals + index + errata |
| Duplicates remaining | None. No `*_1.md` survives |
| `AGENTS.md` as an instruction | None. Sole occurrence is in `README.md`, describing the defect |
| Errata reachable | Referenced from `README.md`, `00-handoff-readme.md`, `01-implementation-plan.md`, `specifications/12-implementation-roadmap.md` |
| Architecture names | `Core`, `Kinds`, `Campaigns`, `Clients` — matches the mermaid block at `README.md:113` |
| Scope | Changes confined to `plans/`. No file under `docs/`, `.config/`, `build/` or `src/` touched |
| Provenance | `git log --follow` reaches `4e3601b` |

Not verified, and stated as such: the two base-image unknowns need Docker and a build.

---

## Open decisions

1. **Who owns the pitch.** `00-repository-reality.md` §6. Retiring the generated homepage removes
   the only check keeping `README.md` and the landing page in agreement. Recommendation: the page
   owns the narrative, the README shortens to a code-host entry point. **Decide before copy is
   locked** — the failure mode is silent.
2. **Whether to correct the seven diagram/claim locations in place** rather than relying on the
   errata's authority. See the peer review's first item. Recommended if an agent rather than a
   human will implement from this bundle.
3. **The two VERIFY AT BUILD unknowns.** `00-repository-reality.md` §4.

## Not done

- **No implementation.** The homepage retirement in `00-repository-reality.md` §5 is *specified,
  not executed* — it changes `.config/`, `docs/` and `CLAUDE.md`.
- **No consolidation or rewrite** of the authored documents.
- **No copy changes.** Gated on decision 1.
- **No docs-site test infrastructure.** Out of scope; `00-repository-reality.md` §7 states what
  replaces the bundle's test plan.
