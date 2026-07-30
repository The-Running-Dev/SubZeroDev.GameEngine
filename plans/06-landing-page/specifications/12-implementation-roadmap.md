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
- inspect Docusaurus version
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

- complete page readable without JavaScript
- all links work
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

Run:

- formatter
- linter
- type check
- unit tests
- Docusaurus build
- internal link checks
- accessibility review
- responsive screenshots
- Lighthouse audit if available

## Phase 6 — Optional enhancements

Only after the core page is complete:

- deterministic command demo
- replay visualization
- timeline interaction
- architecture deep-linking
- social preview image
- analytics events
- live example world

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
