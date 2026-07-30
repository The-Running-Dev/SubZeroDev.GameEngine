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

**There are no open questions of fact.** Two items were previously marked VERIFY AT BUILD — both
concerned the docs base image — and both closed as **moot** when the landing page became a standalone
site (§4). One decision remains outstanding, but it is a choice rather than a fact: **hosting** (§6),
recorded as undecided and deliberately not reconstructed.

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

### The diagram — fan out, do not stack

Replacing the bundle's invented chain (`validates` / `composed as` / `configured by` /
`presented as`), the relationships are:

```text
Core        ── inherited by ──→  Kinds
Kinds       ── plus content ──→  Campaigns
Campaigns   ── presented by ──→  Clients
```

But **do not draw that as a four-node vertical stack.** The bundle makes the architecture the
page's primary visual material and gives it the widest canvas on the page; four nodes in a straight
line is a bulleted list with better typography, and cannot carry that. Correcting the model to four
layers made the centerpiece thinner, and the diagram needs a different shape to compensate.

**Use the fan-out**, which `README.md`'s mermaid block already draws:

```text
Core
  ↓
Kinds ─────────┬────────────────┬────────────────┐
  ↓            │                │                │
Campaigns   story-graph      simulation      world-graph
  ↓            │                │                │
Clients     Bulgaria:        Life in the      Sun Trap
            Make-Your-Own-   Fast Lane
            Adventure
```

A linear chain *asserts* "build mechanics once, create many games". A branch **demonstrates** it —
and it puts three concrete game names on the page where the visitor can see the payoff, every one
of them verified fact.

**Each layer is a link, not a click target.** `Core` → the core contract, `Kinds` → the three kind
specs, and so on, using the absolute URLs in §3. That makes the diagram a list of links: keyboard
operation, focus handling and screen-reader semantics all come free, no `aria-pressed`, no details
region, no selection state, no separate mobile variant. Hover and focus highlighting stays as a CSS
rule. See the design review for why this beats a details panel — the summaries it would reveal must
be visible anyway, so revealing them adds no information.

Anywhere the five-layer stack appears — the ASCII diagram in
`specifications/07-visual-design-system.md`, the numbered layer list in
`specifications/10-component-specifications.md`, the storyboard's §5 diagram, the copy decks —
substitute the model above.

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
| Landing page | `/` — the site's own single route |
| Documentation index | `https://game-engine.subzerodev.com/docs/` |
| Architecture | `https://game-engine.subzerodev.com/docs/engine/architecture` |
| Vision | `https://game-engine.subzerodev.com/docs/engine/vision` |
| Core contract | `https://game-engine.subzerodev.com/docs/engine/core` |
| Story Graph kind | `https://game-engine.subzerodev.com/docs/engine/story-graph-kind` |
| Simulation kind | `https://game-engine.subzerodev.com/docs/engine/simulation-kind` |
| World Graph kind | `https://game-engine.subzerodev.com/docs/engine/world-graph-kind` |
| Content packs — what a Campaign resolves to | `https://game-engine.subzerodev.com/docs/engine/content-packs` |
| Clients contract | `https://game-engine.subzerodev.com/docs/engine/clients` |
| Engine package guide | `https://game-engine.subzerodev.com/docs/guide/engine-package` |
| Repository | `https://github.com/The-Running-Dev/SubZeroDev.GameEngine` |

**Every docs destination is an absolute cross-site URL.** The landing page is a separate site, so
`/docs/engine/architecture` is not a path it can resolve — it is a link to another origin. The
bundle writes these as site-relative paths throughout, which would 404 on the landing page.

**Nothing validates these links.** Docusaurus' `onBrokenLinks` governs only routes inside the docs
site, and `build/Test-Documentation.ps1` skips site-absolute targets by design. So **this table is
the only check that exists**, which has one practical consequence: renaming or renumbering a spec
silently breaks a landing-page CTA, with no build failure anywhere. Re-check it whenever
`docs/docs/engine/` is restructured.

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
`engine/vision`, which is why the URLs above carry no `01-`. That is a docs-site convention and has
no bearing on the landing page, which has one route of its own.

---

## 4. Why the docs project cannot host or tool this page

Background for §5 and §7. The bundle assumed a conventional Docusaurus repository it could add a
page to. This is not one.

`docs/` contains **only** `docusaurus.config.ts`, `sidebar.ts`, `Dockerfile`, `.dockerignore`,
`src/pages/index.md`, and markdown under `docs/`. There is no `package.json`, no
`node_modules`, no `src/components`, no `src/css/custom.css`, no `src/theme`.

The site is built by a published base image, `ghcr.io/the-running-dev/docs-template:latest`,
which carries the Docusaurus install at `/template`. `docs/Dockerfile` does `COPY . .` over
that path, so **`docs/` is an overlay**: local files win where paths collide, everything else
comes from the image. Both workflows build with
`/template/scripts/docs-build.ps1 -SourceDocs ./docs`.

What follows from that:

- **There is nothing here to extend.** No `src/components` to add to, no `src/css/custom.css` to
  build on, no design tokens, no theme to inherit. The bundle repeatedly instructs the implementer
  to reuse existing tokens and conventions — `specifications/12-implementation-roadmap.md` Phase 0
  and `specifications/13-agent-implementation-brief.md` both do. There are none. The landing page
  starts from nothing, which is simpler than it sounds.
- **There is no toolchain here to borrow.** No `package.json` means no formatter, linter,
  type-checker or test runner for the docs site, and React and TypeScript types resolve only inside
  the base image. See §7.
- **`docs/` is the whole Docker build context**, so `src/engine/` is not in the image. Spec prose
  names engine code by its repository-root path (`src/engine/eslint.config.js`) and never as a
  relative link — a relative traversal out of `docs/` resolves to nothing and fails the production
  build. Worth knowing if a landing-page document ever cites engine code.
- **The docs site's own local build is `./docs.ps1 -BuildOnly`**, which needs Docker Desktop.
  `docs.ps1` is installed by the docs installer and is **not committed**. Irrelevant to the landing
  page, which will have its own build once a stack is scaffolded.

### Two unknowns that closed

An earlier version of this document flagged two items as VERIFY AT BUILD: whether the base image
ships its own `src/pages/index.*` that `docs/src/pages/index.md` was masking, and whether it ships a
`src/css/custom.css` wired via `theme.customCss` that an overlay would silently replace.

Both concerned adding files *into* the docs project. The landing page shares neither its `src/` nor
its CSS, so both questions are **moot** — not deferred, not resolved, simply no longer questions.
Recorded because closing an open item by changing the plan is worth distinguishing from answering
it.

---

## 5. Why the landing page does not live in the docs project

The bundle's central instruction — in `specifications/09-docusaurus-architecture.md` and
`specifications/13-agent-implementation-brief.md` — is "implement the homepage as a custom
Docusaurus React page" at `src/pages/index.tsx`, on the assumption that the docs site is where it
goes. **It is not.** The landing page is a standalone site; see §6.

The docs project could not have hosted it anyway, and the reason is worth recording because it is
the boundary between the two:

- `docs/src/pages/index.md` is **generated from `README.md`** by
  `build/ConvertTo-DocumentationHomepage.ps1`.
- It is registered under `GeneratedFiles` in `.config/DocumentationRules.psd1`, so
  `build/Test-Documentation.ps1` fails on byte-for-byte drift.
- That gate runs as a required check in `.github/workflows/docs-ci.yml`.
- `CLAUDE.md` says of the file: *"Do not edit; edit the README."*

So `/` on the docs site is occupied, gated, and **stays that way**.

### Nothing in the documentation system changes

Stated explicitly, because an earlier version of this document specified a five-step procedure to
retire the generated homepage. That procedure was written under the wrong assumption and is
withdrawn in full. Do not:

- edit or remove the `GeneratedFiles` block in `.config/DocumentationRules.psd1`;
- re-run the docs installer with `-NoHomepage`;
- delete or modify `docs/src/pages/index.md`;
- change `CLAUDE.md` or the header comment in `docs/docusaurus.config.ts`;
- stop using `build/ConvertTo-DocumentationHomepage.ps1`, which remains in service.

`docs/docs/index.md`, the `/docs/` landing page, is likewise untouched. The docs site keeps its
README-generated root, its sidebar, its theme, its link checking and its deployment exactly as they
are. This work changes nothing outside `site/`.

---

## 6. Placement, stack and theme

Settled decisions. These are the facts the rest of the bundle must be read against.

| | |
|---|---|
| **Placement** | Standalone site under `site/`, independent of the docs project |
| **Stack** | React, client-rendered single-page app. Plain Vite is sufficient |
| **Theme** | Dark only |
| **Hosting** | **Not decided.** Not GitHub Pages |
| **`README.md`** | Out of scope. Not edited, not shortened, not consulted as a source of copy |

### Rendering — client-side, and the requirement that went with it

The page is client-rendered. It is **not** prerendered, statically generated or server-rendered.

Docusaurus used to satisfy a requirement invisibly by prerendering every route: the bundle asked in
seven places that content remain available without JavaScript. **That requirement is dropped**, and
the statements carrying it are struck rather than left as criteria nothing meets.

Three adjacent requirements survive untouched by the drop:

- **Keyboard and screen-reader operation** remain hard requirements. The Gate 2 wording in
  `01-implementation-plan.md` bundled four things into one clause; only the JavaScript clause goes.
- **Reduced motion** was always about `prefers-reduced-motion`, not about JavaScript being absent.
- **Reveal safety** — a failed or absent reveal must leave content **visible, never hidden**. This
  is the load-bearing form of what the no-JavaScript rule was protecting: an `IntersectionObserver`
  that never fires, an element already in view on load, a bailed-out effect.

Two consequences the copy and design must account for:

1. **Open Graph and social-preview tags must live in the static HTML shell**, not be injected by
   React. Slack, Discord, Twitter/X, LinkedIn and iMessage unfurlers do not execute JavaScript, so
   React-injected meta tags are invisible to them and every shared link renders bare. For a page
   whose main distribution is a pasted link, this is the most consequential effect of the decision.
2. **Search coverage depends on the crawler executing JavaScript.** A noted tradeoff, not a problem
   to solve — the bundle states no organic-search ambition anywhere.

### Theme — dark only

One palette. No light mode, no toggle.

- Set `color-scheme: dark` on the root. Without it, form controls, scrollbars, focus rings and
  autofill styling render in the browser's light defaults against a near-black page, which is the
  most common way a dark-only site ends up looking half-finished.
- **Do not** branch on `prefers-color-scheme`. There is nothing to branch to, and branching is how
  the accidental half-supported light mode appears — which `01-implementation-plan.md` §7 warns
  against by name.
- The three light-mode strategies in `01-implementation-plan.md` §7 are withdrawn. One of them
  ("follow the current site theme automatically") referred to a site theme that no longer exists.

### Hosting — not decided

Recorded as unknown, and **not** to be reconstructed. Until a host is chosen, the bundle cannot
specify build commands, deploy steps, a domain, a canonical URL, Open Graph URLs or sitemap entries.
Any document that appears to specify them is assuming, not stating.

The docs deployment is unrelated and untouched.

### Two smaller facts

- **`site/` needs no `.gitignore` change.** The existing `node_modules/` and `dist/` patterns match
  at any depth. Note that `.gitignore` carries a comment explaining why `build/` is deliberately
  *not* ignored, so that file is not a casual edit.
- **The determinism eslint guard does not apply here.** It lives in `src/engine/eslint.config.js`
  and covers the engine's `src/`. A landing page may use `Date.now` and `Math.random` freely. Worth
  saying, because "determinism is enforced" is prominent in `CLAUDE.md`.

### What the framework used to provide, and now does not

The no-JavaScript requirement was satisfied invisibly by Docusaurus prerendering, which is why nothing
in the bundle ever had to think about it. A sweep for others found little, because the page is one
route of mostly static content — but two things are worth stating, since both were free before:

- **Heading anchors.** Docusaurus generates a stable `#id` for every heading. A React SPA does not. If
  a section of the landing page ever needs to be linkable — the "deep links into architecture layers"
  listed as a post-release enhancement in `01-implementation-plan.md` §14 and
  `specifications/12-implementation-roadmap.md` Phase 6 — the ids must be authored by hand and kept
  stable, and nothing will warn when one changes.
- **Smooth scrolling and scroll restoration** on in-page navigation. Trivial to add, easy to forget,
  and the scroll invitation in the hero implies at least one in-page jump.

Neither is load-bearing. Both are listed so the next person does not discover them the way the
prerendering requirement was discovered.

### A standing rule, learned twice

This document has been wrong twice — about placement, and nearly about hosting — the same way each
time: it reconstructed a plausible answer where the bundle had no fact.

**Where there is no fact, the entry is "not decided" — never the most plausible reconstruction.**
And where a requirement is satisfied by the framework rather than by design, say so, because it
stops being satisfied the moment the framework changes.

---

## 7. Tooling — the project owns its own

The bundle specified component tests, interaction tests, a formatter, a linter, a type check and a
Lighthouse audit (`01-implementation-plan.md` §12,
`specifications/12-implementation-roadmap.md` Phase 5,
`specifications/10-component-specifications.md` "Testing expectations"). None of that exists in the
docs project, and for a while that made the test plan unrunnable.

As a standalone React project, `site/` brings its own `package.json`, so **all of it becomes
available** — a formatter, a linter, `tsc`, and a component test runner are ordinary choices for the
scaffold rather than things to work around. The bundle's original test plan is achievable as
written.

Two boundaries worth stating:

- **The engine's toolchain is not shared.** `src/engine/` has its own vitest, eslint and `tsc`, and
  `.github/workflows/ci.yml` pins that job to `working-directory: src/engine`. It tests the engine.
  `site/` gets its own, independent of it — including its own CI job, if and when one is added.
- **The determinism eslint guard does not apply**, per §6.

What can be verified, and how:

| Check | Mechanism |
|---|---|
| Type check, lint, format | The `site/` project's own toolchain, once scaffolded |
| Component and interaction tests | Same. Achievable now that a project exists to host them |
| Site builds | The `site/` build. **Deploy verification waits on a hosting decision** (§6) |
| Docs and engine untouched | `build/Test-Documentation.ps1`, `.github/workflows/docs-ci.yml`, `.github/workflows/ci.yml` — none of which this work should affect |
| **Social-preview unfurl** | Manual, against the **built** HTML. Confirm Open Graph tags are in the served shell, not React-injected (§6) |
| **Reveal safety** | Content visible when the observer never fires — force by disabling it, or test an element already in view on load |
| Keyboard, focus order, screen-reader order | Manual |
| Reduced motion | Manual, with the OS or DevTools preference set |
| WCAG AA contrast | Manual, against the tokens actually shipped. Note the two border tokens in the design review |
| 320px and no horizontal overflow | Manual, at the widths listed in `01-implementation-plan.md` §10 |

The manual checks are not weaker for being manual, but they are only real if performed and recorded.
The release note required by `01-implementation-plan.md` Gate 6 must state each one's result.

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
  content never gated on an intersection event.
- The refusal to fake a technical demo. `specifications/08-motion-and-interaction.md` says a
  command-validation demo should exist "only when backed by actual engine behavior". That is
  exactly right, and per §2 it is not yet buildable.
- The instruction not to position the engine against Unity, Unreal or Godot, and not to present
  it as a no-code creator or an unconstrained AI generator.
