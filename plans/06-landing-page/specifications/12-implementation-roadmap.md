# Implementation Roadmap

> **Two notes before using this document.**
>
> **Phase 0 is complete.** The audit was performed; its findings are
> `00-repository-reality.md`, which overrides this file on every question of fact. Do not
> re-run the discovery below.
>
> **The phase order here conflicts with `01-implementation-plan.md`, which wins.** This file
> puts motion (Phase 3) before architecture interaction (Phase 4); the implementation plan puts
> architecture interaction (Phase 5 there is motion) first. Follow the implementation plan: it
> is higher in the authority order, and animating an interaction that does not exist yet is the
> wrong dependency direction. Phase 5 below also specifies a formatter, linter, type check and
> unit tests that have nothing to run in — see `00-repository-reality.md` §7 for what replaces
> them.

## Phase 0 — Repository discovery — COMPLETE

Retained as the record of what was asked for:

- inspect repository instructions — `CLAUDE.md` and `agent.md`
- inspect package manager
- inspect React and build-tool versions
- inspect existing `src/pages/index.*`
- inspect `src/css/custom.css`
- inspect theme configuration
- inspect navbar and footer configuration
- inspect current brand assets
- inspect linting, testing, and CI
- inspect documentation routes
- identify actual engine terminology
- identify GitHub repository URL

### Deliverable

A short repository-specific implementation note before code changes.

## Phase 1 — Content and structure

Implement:

- page shell
- hero
- origin hook
- problem
- realization
- philosophy
- refusals
- capabilities
- documentation CTA
- footer

No complex animation.

### Acceptance

- content visible when a reveal does not fire
- all links work, and match the route inventory in `00-repository-reality.md` §3
- responsive layout works
- content matches approved copy
- default docs remain unchanged

## Phase 2 — Visual system

Implement:

- landing tokens
- typography
- section rhythm
- dark/light handling
- architecture layout
- CTA styling
- focus states

### Acceptance

- page does not resemble generic SaaS template
- spacing remains coherent across breakpoints
- site navigation feels integrated
- no overflow at 320px width

## Phase 3 — Motion

Add:

- hero sequence
- scroll reveals
- diagram selection transitions
- signature hover/focus Easter egg

### Acceptance

- no content hidden when JS fails
- reduced-motion mode works
- animations do not delay navigation
- no scroll-jacking

## Phase 4 — Architecture interaction

Implement an interactive architecture diagram based on real project terminology.

### Acceptance

- keyboard accessible
- mobile accessible
- static fallback
- each layer links to or explains actual documentation
- no invented architecture claims

## Phase 5 — Quality control

Run the `site/` project's own toolchain — it owns a `package.json`, so these are real:

- formatter
- linter
- type check
- unit tests
- production build
- accessibility review
- responsive screenshots

By hand, because nothing automates them:

- **CTA destinations** against the route inventory in `00-repository-reality.md` §3. They are
  cross-site absolute URLs, which no link checker in this repository sees.
- **Open Graph tags present in the built HTML**, not React-injected.
- **Reveal safety** — content visible when the observer does not fire.

Deploy verification **waits on a hosting decision**; none is made.

## Phase 6 — Optional enhancements

Only after the core page is complete:

- deterministic command demo — **blocked** until `advance(state, action)` exists. Do not fake it; a
  simulated demo of a determinism claim is the one lie this project cannot afford
- replay visualization — likewise, and replay is post-MVP
- architecture deep-linking
- social preview image
- analytics events
- live example world

Dropped: the origin timeline interaction. It duplicates the origin prose and repeats the architecture
diagram's shape — see `10-component-specifications.md`.

## Definition of done

- homepage is custom and visually distinct
- homepage tells the true origin story
- humor remains restrained
- architecture is accurate
- docs stay conventional
- mobile experience is deliberate
- accessibility is not an afterthought
- build and CI pass
- no unsupported product claims
- repository is ready for review
