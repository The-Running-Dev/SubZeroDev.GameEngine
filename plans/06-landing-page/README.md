# Landing Page — Planning Bundle

Planning documents for a custom Docusaurus homepage for the SubZeroDev Game Engine.

**Objective:** a restrained, technically credible editorial page at `/` that reveals the
serious architecture behind the project's accidental origin.
**Primary line:** Build mechanics once. Create infinite games.
**Signature:** Well... why not?
**Design concept:** Cold logic, warm accident.

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

**Correction:** one new document, `00-repository-reality.md`, carries the repository audit the
bundle deferred. The authored documents were left as written — their content is good and their
reasoning is worth keeping. What was wrong were their *facts*, and facts are exactly what one
overriding document can carry without touching a word of the original.

The defects it corrects, in brief:

- A **five-layer architecture model** (`Core → Mechanics → Kinds → Campaigns → Games`) that does
  not exist. The real model is four layers: `Core → Kinds → Campaigns → Clients`. There is no
  `Mechanics` layer, and there are exactly three Kinds, all engine-owned.
- **Five capability claims** stated as current behavior that are contracts or post-MVP plans.
  There is no `advance(state, action)` yet.
- **Three dead routes** — `/blog/…` (blog is off), `/architecture/…`, and an "Explore the
  concepts" CTA with no destination.
- **A reference to `AGENTS.md`**, which does not exist. This repo uses `CLAUDE.md` and
  `agent.md`.
- **The homepage is a generated file behind a required CI check**, so the bundle's central
  instruction — a custom React page at `src/pages/index.tsx` — cannot be followed without
  retiring that generation first.
- **No local Docusaurus project exists** to build into, and **no test runner exists** for the
  docs site, so the bundle's test plan cannot run as written.

---

## Open decisions

Both are recorded in `00-repository-reality.md` and neither is settled.

1. **Who owns the pitch** (§6). Retiring the generated homepage removes the only check keeping
   `README.md` and the landing page in agreement. Recommendation: the page owns the narrative
   and the README shortens to a code-host entry point. **Decide before copy is locked** — the
   failure mode is silent drift.
2. **Two base-image unknowns** (§4), marked VERIFY AT BUILD: whether the image ships its own
   `src/pages/index.*`, and whether it ships a `custom.css` wired via `theme.customCss`.

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
- **No docs-site test infrastructure is being built.** The bundle's component and interaction
  test plan cannot run. Accepted as out of scope; `00-repository-reality.md` §7 lists what
  replaces it. If site tests are wanted later, that is separate work and it starts with a
  `package.json`.
- **Three internal contradictions are resolved by the authority order rather than by editing.**
  The bundle carries three different page sequences, two conflicting phase orders, and two
  disjoint component trees. `01-implementation-plan.md` wins on all three, being both the most
  developed and higher in the authority order than `specifications/`.
