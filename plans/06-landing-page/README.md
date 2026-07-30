# Landing Page — Planning Bundle

Planning documents for the SubZeroDev Game Engine landing page — a **standalone React site under
`site/`**, separate from the documentation.

**Objective:** a restrained, technically credible editorial page that reveals the serious
architecture behind the project's accidental origin.
**Primary line:** Build mechanics once. Create infinite games.
**Signature:** Well... why not?
**Design concept:** Cold logic, warm accident.

## Settled

| | |
|---|---|
| **Placement** | Standalone site under `site/`. Not part of the docs project |
| **Stack** | React, client-rendered SPA. Plain Vite is sufficient |
| **Rendering** | Client-side. No prerender. The no-JavaScript requirement is **dropped** |
| **Theme** | Dark only. `color-scheme: dark`, no `prefers-color-scheme` branch, no toggle |
| **Architecture diagram** | Fan-out from `Kinds` to the three real kinds. Each layer is a link to its spec |
| **Routing** | Decided: landing at `/`, docs at `/docs`, same origin — internal links are root-relative |
| **Hosting platform** | **Decided: GitHub Pages** — the docs site's existing deployment, now serving both, at `game-engine.subzerodev.com` |
| **Build assembly** | **Built.** `build/Merge-LandingPage.ps1`, wired into `docs-ci.yml` and `docs-deploy.yml` |
| **`README.md`** | Out of scope — not edited, not consulted as a source of copy |

`docs/docusaurus.config.ts` and `docs/sidebar.ts` are untouched — the merge is additive, overwriting
only the docs build's generated-from-README root `index.html`. The documentation site keeps its
sidebar, its theme, and every route under `/docs` exactly as they were; only the site root changes
owner, once this PR merges and the next deploy runs.

---

## Reading order

Stated here rather than inferred from filenames, the same way `docs/sidebar.ts` states the spec
order rather than deriving it.

| # | Document | Holds |
|---|---|---|
| 1 | `00-repository-reality.md` | **Start here.** The verified repository audit. Architecture model, capability matrix, route inventory, build system, homepage-retirement procedure, tooling limits. Replaces the "Gate 0" audit the rest of the bundle defers to |
| 2 | `00-handoff-readme.md` | Objective, authority order, working method, binding creative direction, content rules, completion requirements |
| 3 | `01-implementation-plan.md` | The seven gated phases, page sequence, component boundaries, visual system, motion, verification, risks. The most developed document in the bundle |
| 4 | `02-approved-homepage-copy.md` | The approved copy deck |
| 5 | `specifications/` | The source specification set — product vision, origin story, brand manifesto, voice and tone, storyboard, copy draft, visual design system, motion, Docusaurus architecture, component specifications, responsive/accessibility/performance, roadmap, agent brief, content inventory |

---

## Authority order

1. **`00-repository-reality.md`** — the verified audit. Supersedes everything below on any
   question of fact: architecture names, capability claims, routes, build mechanics, tooling.
2. **Repository evidence** — `CLAUDE.md`, `agent.md`, actual code and exported APIs, the specs
   under `docs/docs/engine/`, existing routes, build configuration, current tests and CI.
3. **`01-implementation-plan.md`**
4. **`02-approved-homepage-copy.md`**
5. **`specifications/`** — preserves product reasoning, creative context and alternatives. Not
   all of it is final decisions. Do not revive an older alternative that the plan or the
   approved copy has already resolved.

Where 1 and 2 appear to disagree, 2 is ground truth and 1 has gone stale — fix
`00-repository-reality.md` rather than working around it.

The bundle as received put repository evidence first and left the facts to be discovered later.
That inversion is what produced its defects: an implementer following the copy in good faith
would have shipped an architecture diagram naming a layer that does not exist.

---

## Provenance and what changed

The bundle arrived as 34 untracked markdown files under `site/`, authored **without access to
this repository**. It is preserved verbatim in the commit *"Add the landing-page spec bundle as
received"*, so nothing is lost and any decision recorded here can be traced back to the
original text.

**Cleanup:** 16 files carried no unique content and were removed — 15 named `*_1.md` that were
byte-identical to their siblings, plus a top-level copy of the implementation plan that was
byte-identical to `01-implementation-plan.md`. 18 documents remain. The redundant
`subzerodev-implementation-handoff/` nesting level was flattened away.

**Correction:** one new document, `00-repository-reality.md`, carries the repository audit the bundle
deferred, and is the highest authority here. The authored documents were largely left as written —
their voice and reasoning are good. What was wrong were their *facts*, plus a set of design decisions
recorded in `../08-landing-page-design-review.md`.

The defects corrected, in brief:

- A **five-layer architecture model** (`Core → Mechanics → Kinds → Campaigns → Games`) that does not
  exist. The real model is four: `Core → Kinds → Campaigns → Clients`. There is no `Mechanics` layer,
  and there are exactly three Kinds, all engine-owned.
- **Five capability claims** stated as current behavior that are contracts or post-MVP plans. There
  is no `advance(state, action)` yet.
- **Three dead routes** — `/blog/…` (blog is off), `/architecture/…`, and an "Explore the concepts"
  CTA with no destination. Docs links are also **absolute cross-site URLs**, not paths.
- **A reference to `AGENTS.md`**, which does not exist. This repo uses `CLAUDE.md` and `agent.md`.
- **Two divergent token sets**, disagreeing on four values. `01-implementation-plan.md` §7 is now
  canonical.
- **`--landing-border` failed contrast** wherever it carried meaning. Split into decorative and
  meaning-bearing tokens.
- **The type scale overflowed 320px** while the bundle required it not to.
- **A placement constraint, not a defect:** the docs site's `/` is a generated file behind a required
  CI check, so the landing page could never have lived there. It is a separate project, and that is
  the boundary rather than a problem to solve.
- **No Docusaurus project existed to build into** — which is why the landing page needs its own,
  and why its test plan is now achievable rather than unrunnable.

---

## Open

Nothing. The build-assembly step is built (`build/Merge-LandingPage.ps1`), and the `<noscript>`
fallback question resolved to yes — it's in `site/index.html`.

The one thing genuinely outside this bundle's control: the docs build process is expected to be
reworked at some point, and `build/Merge-LandingPage.ps1` is the piece most likely to need
revisiting when that happens. Its inputs are two directory trees with a verified shape, so that is a
bounded change, not a rewrite.

Two items previously marked VERIFY AT BUILD **closed as moot** when placement changed: both concerned
the docs base image masking or colliding with `src/pages/index.*` and `custom.css`, and a standalone
project shares neither.

## Known and retained

Items considered and deliberately kept or dropped, recorded rather than left silent.

- **"Thirty years" is retained.** `01-implementation-plan.md` §5 asks to replace "we spent
  thirty years rewriting inventory systems" with undated phrasing. Kept: `README.md` already
  uses it, and the objection it was reaching for is a different one — the content inventory
  forbids implying *the project* took years, which it did not. The industry's thirty years is
  fair comment and matches the repository's existing voice.
- **The command-validation micro-demo is deferred, not cut.**
  `specifications/08-motion-and-interaction.md` specifies a valid/rejected command exchange. It
  is genuinely good and unbuildable until `advance(state, action)` exists. That document already
  says it should be real "only when backed by actual engine behavior" — which is correct, and
  the reason it waits. Do not fake it; a simulated demo of a determinism claim is the one lie
  this project cannot afford.
- **The origin story is now told twice, not three times.** Four "If X, then Y" lines were cut from
  the resolution — they summarised the middle of the page. The resolution keeps the turn and the
  punchline, which is its actual job.
- **`StoryTimeline` is dropped.** It failed its own admission criterion ("only if it adds clarity
  without repeating the origin prose" — its seven steps are all already narrated), and it is visually
  the same vertical-node shape as the architecture diagram, which flattens the page's one visual
  event.
- **The interactive diagram's details panel is dropped.** Because interaction must never gate
  meaning, its summaries had to be visible anyway — so the panel re-showed text already on the page,
  at the cost of `aria-pressed`, selection state and a separate mobile variant. Layers are links
  instead: keyboard, focus and screen-reader semantics come free, and the detail lives in the spec.
- **The signature easter egg is desktop-only**, and that is stated rather than left implicit. Touch
  has no hover, and making a decorative line focusable adds a tab stop announcing nothing.
- **Three internal contradictions are resolved by the authority order rather than by editing.** The
  bundle carries three different page sequences, two conflicting phase orders, and two disjoint
  component trees. `01-implementation-plan.md` wins on all three, being both the most developed and
  higher in the authority order than `specifications/`.
- **The capability matrix will go stale.** It snapshots `src/engine/` at W2, and nothing links it to
  the code. Re-check before any copy change and whenever a work item lands. The failure direction is
  benign — a stale matrix understates what is built — but that is luck, not design.
