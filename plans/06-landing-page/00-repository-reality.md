# Repository Reality

> **Read this first.** It is the highest authority in this bundle and it overrides every other
> document here on any question of fact.

## What this document is

The rest of this bundle was written **without access to this repository**. It deferred every
repository fact to a "Gate 0 repository truth audit" that the implementing agent was told to
perform before writing code.

That audit has been performed. This document is its output, and it **replaces Gate 0
entirely**. Nothing here is provisional and nothing here needs re-deriving.

The other documents were deliberately left as authored. Their voice, pacing and editorial
reasoning are good and worth preserving; it was their *facts* that were wrong. So this document
corrects the facts in one place rather than rewriting eleven files, and the original diagrams,
capability lists and route tables stay where they are — **overridden, not deleted**. Where they
disagree with this document, they are wrong and this document is right.

Two items are marked **VERIFY AT BUILD** because they depend on the contents of a Docker base
image that cannot be inspected without pulling it. Those are the only open questions of fact.

---

## 1. The architecture model

The bundle asserts a five-layer model: `Core → Mechanics → Kinds → Campaigns → Games`
(`specifications/01-product-vision.md`, repeated in the storyboard, the copy drafts, the visual
design system and the component specifications). **That model does not exist.** It was
inferred, not observed.

The real model, from the mermaid block in `README.md` under "The Model", corroborated by
`CLAUDE.md`:

```text
Core        deterministic state, seeded RNG, replay, validation, one API
  ↓
Kinds       reviewed engine mechanics
  ↓
Campaigns   a Kind plus content
  ↓
Clients     web, CLI, Discord, MCP agents
```

Four layers, not five. The corrections are not cosmetic:

- **There is no `Mechanics` layer.** Mechanics live *inside* Kinds. The README states it
  directly: *"Kinds define mechanics. Campaigns define worlds. Clients simply present them."*
  A separate `Mechanics` layer between Core and Kinds is an invention.
- **The terminal layer is `Clients`, not `Games`.** A Client is a presentation of a session —
  web, CLI, Discord, or an MCP agent. `docs/docs/engine/09-clients.md` defines one as *a
  projection of the session store, never a participant*. "Games" as a layer name loses that,
  and that separation is exactly what the page is trying to sell.
- **Kinds are engine-owned code, not genre assemblies.** Per architecture decision N2, Kinds
  are reviewed and ship with the engine. There are exactly **three**, and the list is not
  open-ended:

  | Kind | What it is | Flagship campaign |
  |---|---|---|
  | `story-graph` | Authored narrative graph; the MVP vehicle | Bulgaria: Make-Your-Own-Adventure |
  | `simulation` | Weekly-budget life simulation | Life in the Fast Lane |
  | `world-graph` | Navigable world with autonomous inhabitants | Sun Trap |

  The bundle's list — "life simulation, detective story, management simulation, survival game,
  political simulation, hotel management, role-playing game" — describes campaigns or
  aspirations, not Kinds. Copy must never imply a visitor can add a Kind. They add a
  **Campaign**.

The distinction the page should carry is the one the README already makes: *"`simulation` is
the Kind — the rulebook for weekly-budget life sims. Life in the Fast Lane is the Campaign —
the actual game written with it."*

### Relationship labels for the diagram

Replacing the bundle's invented chain (`validates` / `composed as` / `configured by` /
`presented as`):

```text
Core        ── inherited by ──→  Kinds
Kinds       ── plus content ──→  Campaigns
Campaigns   ── presented by ──→  Clients
```

Anywhere the five-layer stack appears — including the ASCII diagram in
`specifications/07-visual-design-system.md` and the numbered layer list in
`specifications/10-component-specifications.md` — substitute the four-layer model above.

---

## 2. Capability matrix — what the copy may claim

`src/engine/src/core/` currently contains:

**Implemented code**

- `determinism/pcg32.ts` — seeded PCG32, verified bit-identical to reference vectors
- `determinism/rng.ts` — RNG handle and stream derivation
- `persistence/canonical.ts` — canonical serialization
- `kernel/reasons.ts` — reason-code constants

**Types only, no behavior** — `composition/`, `kernel/types.ts`, `localization/`,
`observability/`, `projection/`, `registry/`, `session/`, `validation/`

There is **no `advance(state, action)`**. `CLAUDE.md` calls it "next up". This is the single
most important fact for the copy: the state-transition function at the centre of the pitch is
specified and not yet written.

Every technical claim takes one of four classifications. **Implemented** may be stated as fact.
**Contract** must be phrased as design, not behavior. **Planned** and **Unsupported** may not
appear as capability claims at all.

| Claim in the bundle | Classification | Evidence |
|---|---|---|
| Deterministic randomness, reproducible from a seed | **Implemented** | `determinism/pcg32.ts`, `determinism/rng.ts` |
| Canonical serialization | **Implemented** | `persistence/canonical.ts` |
| Determinism is enforced, not hoped for | **Implemented** | eslint guard bans `Math.random`, non-bit-stable `Math.*`, `Date.now` in `src/` |
| "Run deterministic simulations" / "deterministic state transitions" | **Contract** | RNG and serialization exist; the transition function does not |
| "Validate commands" | **Contract** | `validation/types.ts` is types only |
| "Replay worlds" | **Planned** | `docs/docs/engine/07-replay.md` is explicitly post-MVP |
| "Support multiple presentations" | **Contract** | `docs/docs/engine/09-clients.md`; no client exists yet |
| "Separate mechanics from fiction" | **Contract** | The Kind seam in `docs/docs/engine/04-core.md` |
| "Humans and AI submit the same commands" | **Contract** | MCP schemas in `04-core.md`, `09-clients.md`; no command boundary running |
| Multiple Kinds proving the seam | **Contract** | Three kind contracts written; none implemented |
| Adoption, benchmarks, maturity, production readiness | **Unsupported** | No evidence anywhere. Never claim. |

`README.md` under "Status" already models this split honestly and is the tonal reference for
phrasing a contract without either overclaiming or sounding apologetic. Reuse it rather than
inventing new hedging language.

### This matrix will go stale, and nothing will tell you

It is a snapshot of `src/engine/` as of W2 (RNG handle and stream derivation). Every subsequent
work item in `docs/docs/engine/TODO.md` moves a row from **Contract** toward **Implemented** —
`advance(state, action)` alone promotes three of them. No test, gate or link connects this table
to the code, so it degrades silently and in the safe direction only by luck.

**Re-check it against `src/engine/src/core/` before any copy change, and whenever a W-item
lands.** A claim that was honest when written becomes an understatement, then eventually a
different kind of inaccuracy.

### On the bundle's own verification notes

`02-approved-homepage-copy.md` carries two inline **Verification note** blocks — on the
human/AI command boundary and on the capabilities list — instructing a future auditor to check
those claims against the repository. **This document is that audit.** Both are hereby answered:
the command boundary is a **Contract**, and of the six listed capabilities one is **Planned**
and four are **Contract**.

The notes stay in the file as authored. Treat them as answered, not open.

---

## 3. Route inventory

Every destination the page may link to. Anything not on this list does not exist.

| Destination | Route |
|---|---|
| Landing page | `/` |
| Documentation index | `/docs/` |
| Architecture | `/docs/engine/architecture` |
| Vision | `/docs/engine/vision` |
| Core contract | `/docs/engine/core` |
| Engine package guide | `/docs/guide/engine-package` |
| Repository | `https://github.com/The-Running-Dev/SubZeroDev.GameEngine` |

Corrections to the bundle:

- **`/blog/...` does not exist.** `docs/docusaurus.config.ts` sets `blog: false`. Strike it
  from the route list in `specifications/09-docusaurus-architecture.md`.
- **`/architecture/...` does not exist.** The same file lists it as an "optional architecture
  entry". The real path is `/docs/engine/architecture`.
- **"Explore the concepts" has no destination.** It appears as a secondary CTA in
  `02-approved-homepage-copy.md`, `specifications/05-landing-page-storyboard.md`,
  `specifications/06-homepage-copy.md` and `specifications/10-component-specifications.md`.
  Either cut it or repoint it at `/docs/engine/vision`. Recommend cutting — four CTAs in one
  block was one too many regardless, and the primary action is *Read the architecture*.
- **The navbar currently has exactly one item** (`Docs`). Adding Architecture and GitHub is a
  deliberate change to `docs/docusaurus.config.ts`, not an existing state to preserve.

Route ids drop the numeric filename prefix — `docs/docs/engine/01-vision.md` becomes
`engine/vision`. A new docs page must also be listed in `docs/sidebar.ts` or it is invisible.
Neither applies to the landing page, which is a `src/pages` route and sits outside the sidebar.

---

## 4. How this site is actually built

The bundle assumed a conventional Docusaurus repository. This is not one.

`docs/` contains **only** `docusaurus.config.ts`, `sidebar.ts`, `Dockerfile`, `.dockerignore`,
`src/pages/index.md`, and markdown under `docs/`. There is no `package.json`, no
`node_modules`, no `src/components`, no `src/css/custom.css`, no `src/theme`.

The site is built by a published base image, `ghcr.io/the-running-dev/docs-template:latest`,
which carries the Docusaurus install at `/template`. `docs/Dockerfile` does `COPY . .` over
that path, so **`docs/` is an overlay**: local files win where paths collide, everything else
comes from the image. Both workflows build with
`/template/scripts/docs-build.ps1 -SourceDocs ./docs`.

Consequences for this bundle:

- **Every path needs rebasing.** `src/pages/index.tsx` means `docs/src/pages/index.tsx`. Same
  for `docs/src/components/`, `docs/src/css/`, `docs/src/hooks/`, `docs/src/data/`. This applies
  to the whole suggested structure in `specifications/09-docusaurus-architecture.md`,
  `01-implementation-plan.md` §11 and `specifications/13-agent-implementation-brief.md`.
- **`src/css/custom.css` does not exist here to extend.**
  `specifications/12-implementation-roadmap.md` Phase 0 tells the implementer to inspect it.
- **`docs/` is the whole Docker build context**, so `src/engine/` is not in the image. Spec
  prose names engine code by its repository-root path (`src/engine/eslint.config.js`) and never
  as a relative link — a relative traversal out of `docs/` resolves to nothing and fails the
  production build.
- **The only local build is `./docs.ps1 -BuildOnly`**, which needs Docker Desktop running.
  `docs.ps1` is installed by the docs installer and is **not committed**; if it is missing, run
  the installer.

### VERIFY AT BUILD — two unknowns

Neither can be settled without pulling the base image. Both are cheap to check on the first
build and expensive to get wrong.

1. **Does the base image ship its own `src/pages/index.*`?** If it does,
   `docs/src/pages/index.md` is currently masking it, and deleting that file (see §5) would
   unmask it — while adding `index.tsx` could produce two routes at `/`. Watch the build output
   for duplicate-route warnings.
2. **Does the image ship `src/css/custom.css` wired via `theme.customCss`?** If so, overlaying
   that exact path replaces the image's defaults wholesale and silently. Landing styles must
   therefore arrive in a **new** file imported by the page, never by overwriting `custom.css`.

---

## 5. The homepage is generated — retiring it is a deliberate act

**This was the bundle's fatal defect.** Its central instruction — in
`specifications/09-docusaurus-architecture.md` and
`specifications/13-agent-implementation-brief.md` — is "implement the homepage as a custom
Docusaurus React page" at `src/pages/index.tsx`. In this repository that route is already taken
by a generated file behind a required CI check:

- `docs/src/pages/index.md` is **generated from `README.md`** by
  `build/ConvertTo-DocumentationHomepage.ps1`.
- It is registered under `GeneratedFiles` in `.config/DocumentationRules.psd1`, so
  `build/Test-Documentation.ps1` fails on byte-for-byte drift.
- That gate runs as a required check in `.github/workflows/docs-ci.yml`.
- `CLAUDE.md` says of the file: *"Do not edit; edit the README."*

So adding `index.tsx` beside `index.md` creates two routes at `/`, and deleting `index.md`
breaks a registered generated-file check. There is no version of the bundle's instruction that
works without changing the documentation system.

**Decision: the React page proceeds, and the generated homepage is retired.**

### Retirement procedure

Ordered, because steps 2 and 3 undo each other if reversed.

1. **Remove the `GeneratedFiles` block from `.config/DocumentationRules.psd1`.** The
   `# --- GeneratedFiles:start ---` / `# --- GeneratedFiles:end ---` comment markers delimit
   exactly what the docs installer removes when passed `-NoHomepage`, so prefer re-running the
   installer over hand-editing.
2. **Re-run the docs installer with `-NoHomepage`.** This also rewrites `docs.ps1`, which
   currently regenerates `docs/src/pages/index.md` from `README.md` **on every run**. Skip this
   and the next `./docs.ps1` recreates the file the new page replaces.
3. **Delete `docs/src/pages/index.md`; add `docs/src/pages/index.tsx`.**
4. **Update the documents that describe the old arrangement.** Both currently assert it as
   settled design, and both become wrong:
   - `CLAUDE.md` — the docs-site section describing `docs/src/pages/index.md` as generated from
     the README, and the "Do not edit" instruction.
   - `docs/docusaurus.config.ts` — the header comment explains that strict broken-link checking
     is safe *because* the root is a real route generated from the README. The reasoning needs
     restating; the setting does not change.
   - `build/ConvertTo-DocumentationHomepage.ps1` becomes unused. Deleting it or keeping it is
     an explicit call, not a side effect.
5. **Decide who owns the pitch.** See §6 — the one item that is a judgement call rather than a
   mechanical step.

### What does not change

`onBrokenLinks` and `onBrokenAnchors` stay `throw`. The config's comment explains they were
relaxed to `warn` only while the site root was a *static file*, because Docusaurus resolves
links against routes and the navbar brand's link to `/` could never resolve. A React page at
`/` is a real route — exactly the condition that made strict checking safe. Retiring the
generated markdown does not reintroduce the old problem.

`docs/docs/index.md` — the `/docs/` landing page — is ordinary authored content and is **not
affected**. It used to be the generated copy of the README and no longer is. Do not touch it.

---

## 6. Who owns the pitch

Retiring the generated homepage solves the route collision and creates a content problem the
bundle never had to consider.

Today there is exactly one source for the project's pitch: `README.md`. It renders on the code
host and, via generation, as the site root. The drift gate guarantees they agree.

After retirement there are **two** — the README and the React page — and **nothing checks that
they agree**. The gate being removed is precisely that check. Left alone they will drift, and
the published page will quietly stop matching the repository's own front door.

This matters more than it sounds, because the README already tells the whole story. Its
headings map almost one-to-one onto this bundle's proposed section sequence: Why This Exists,
Origin Story, The Model, Build Mechanics Once, The Engine Doesn't Know, Deterministic By
Design, AI Native, Not Another Game Engine, Philosophy, Status, Continue Reading. The bundle
proposed a second home for the same narrative without noticing the first.

**Recommendation: the landing page becomes the owner of the narrative, and the README shortens
to a code-host entry point** — what the project is, current status, how to build it, where the
docs are, with a link to the site for the full pitch. One owner, no drift surface, and the
contributor sections that currently land on the public homepage (`Layout`, `Build the Docs
Site`, `Developing the Engine`) go back to serving contributors instead of visitors.

This is a recommendation, not a settled decision, and it is **the last thing that should be
decided before copy is locked**. The alternative — both documents carry the pitch and are
reconciled by hand — is viable but needs stating explicitly, because the failure mode is
silent.

---

## 7. Tooling — what can and cannot be verified

The bundle specified component tests, interaction tests, a formatter, a linter, a type check
and a Lighthouse audit (`01-implementation-plan.md` §12,
`specifications/12-implementation-roadmap.md` Phase 5,
`specifications/10-component-specifications.md` "Testing expectations"). **None of that
infrastructure exists for the docs site.**

The only npm project in the repository is `src/engine/`, which carries vitest, eslint and
`tsc`. `.github/workflows/ci.yml` pins that job to `working-directory: src/engine`. It tests
the engine. It cannot test a Docusaurus page, and React and TypeScript types for the site
resolve only inside the base image — so a `.tsx` page cannot even be type-checked locally.

**Standing up a docs-site npm project is out of scope.** Saying so plainly beats a test plan
that silently never runs.

What is actually available, and what the verification steps must be written against:

| Check | Mechanism |
|---|---|
| Site builds; no broken routes, links or anchors | `./docs.ps1 -BuildOnly`, and the `verify` job in `.github/workflows/docs-ci.yml` |
| Markdown links, anchors, terminology, generated-file drift | `build/Test-Documentation.ps1` |
| Engine untouched | `.github/workflows/ci.yml` |
| Keyboard, focus order, screen-reader order | Manual |
| Reduced motion | Manual, with the OS or DevTools preference set |
| WCAG AA contrast | Manual, against the tokens actually shipped |
| 320px and no horizontal overflow | Manual, at the widths listed in `01-implementation-plan.md` §10 |
| Content available without JavaScript | Manual, JavaScript disabled |

The manual checks are not weaker for being manual, but they are only real if performed and
recorded. The release note required by `01-implementation-plan.md` Gate 6 must state each
one's result.

---

## 8. What the bundle got right

Stated so the corrections above are not mistaken for a verdict on the whole bundle. The
following needed no change and should be preserved:

- The *Jones in the Fast Lane* origin, and the decision to put it on the homepage rather than
  hide it on an About page.
- The trigger/resolution split — opening as the hook, later section as the payoff, never the
  same story twice.
- "Build mechanics once. Create infinite games." and "Well... why not?"
- The refusals/capabilities ledger device, and the instruction to render it as vertical ledgers
  rather than a feature-card grid.
- The voice guide, the 5–10% humor target, and the tone progression from mysterious hero to
  joke-free CTA.
- Progressive enhancement as the motion strategy: static semantic page first, motion last,
  content never gated on JavaScript or an intersection event.
- The refusal to fake a technical demo. `specifications/08-motion-and-interaction.md` says a
  command-validation demo should exist "only when backed by actual engine behavior". That is
  exactly right, and per §2 it is not yet buildable.
- The instruction not to position the engine against Unity, Unreal or Godot, and not to present
  it as a no-code creator or an unconstrained AI generator.
