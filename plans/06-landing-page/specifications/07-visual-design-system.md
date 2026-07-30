# Visual Design System

## Direction

The design should feel:

- minimal
- editorial
- technical
- deliberate
- dark by default
- premium without looking expensive for its own sake
- quiet rather than flashy

References may include the restraint of Apple, the clarity of Stripe documentation, and the typography of Linear, but the final result must not clone any of them.

## Design thesis

Typography and pacing are the primary visual elements.

The page should not depend on stock illustrations, 3D renders, character art, or generic AI imagery.

The architecture itself is the visual material.

## Color system

**Token values live in `01-implementation-plan.md` §7, and only there.** This document used to carry
a second copy of the palette; four of its values had silently diverged from the other set —
`--landing-muted`, `--landing-border`, `--landing-accent` and `--landing-accent-soft` — which is
worse than an obvious conflict, because both sets get implemented in different components without
anyone noticing. The duplicate is removed. This section describes how the tokens are *used*.

Also removed: `--landing-danger-soft` and `--landing-success-soft`. They were specified for a
treatment this design explicitly rejects — Refusals must not read as errors, and there are no red
cross icons.

**Dark only.** One palette, no light mode, no toggle, no `prefers-color-scheme` branch. Set
`color-scheme: dark` on the root so form controls, scrollbars, focus rings and autofill match rather
than rendering light against a near-black page. See `00-repository-reality.md` §6.

### Color rules

- one primary accent
- no rainbow gradients
- no glowing neon borders
- avoid pure black behind all sections
- distinguish sections using spacing and subtle surface changes
- diagrams use opacity and line style before adding more colors

### Contrast — two border tokens, not one

"Subtle 1px borders" as a blanket rule produces a specific failure. `--landing-border` at
`rgba(255,255,255,0.10)` over `#090a0d` is far below the 3:1 minimum WCAG sets for non-text elements
that carry meaning. So a border doing real work fails while the spec asserts it passes.

Split it by job:

- **`--landing-border`**, ~0.10 — decorative hairlines only. Nothing depends on seeing it.
- **A second, stronger token**, ~0.25–0.30 — anything meaning-bearing: diagram connectors, ledger
  dividers, selected or focused state, focus rings.

State which is which at every use site. Then verify: body copy, muted text, meaning-bearing borders,
accent text, hover states and diagram labels.

**The accent needs a stated direction.** `--landing-accent` works as text or a border on the dark
background. Used as a **fill** behind text, the foreground must be dark, not white. The spec never
said which way round accent buttons go; decide it once.

## Typography

### Display

Use a modern sans-serif with strong geometry and readable punctuation.

Candidates:

- Inter
- Geist
- Manrope
- IBM Plex Sans
- system font stack if performance and consistency are preferred

### Monospace

Use for engine concepts, commands, diagrams, and technical labels.

Candidates:

- JetBrains Mono
- IBM Plex Mono
- Geist Mono
- system monospace stack

### Scale suggestion

```css
--text-hero: clamp(2rem, 8vw, 7.5rem);
--text-display: clamp(2rem, 5vw, 5rem);
--text-section: clamp(1.75rem, 3vw, 3rem);
--text-body-large: clamp(1.125rem, 2vw, 1.5rem);
--text-body: 1rem;
--text-small: 0.875rem;
```

The hero floor is `2rem`, not `3rem`. At 48px the headline's longest line — *"Create infinite
games."*, 22 characters — runs to roughly 500px in a geometric sans, which overflows both 375px and
the 320px minimum the bundle requires. This was a direct conflict between two of its own rules.

### Deliberate line breaks are a breakpoint-conditional enhancement

"Preserve deliberate line breaks" and "no horizontal overflow at 320px" cannot both hold
unconditionally: enforcing the two-line hero break with a `<br>` or `white-space: nowrap` overflows
on a phone.

So: **deliberate breaks above the mobile breakpoint, natural wrapping below it.** The hero reads as
two composed lines on a wide viewport and wraps freely on a narrow one. Never `nowrap` on prose.

### Typography rules

- short lines
- large line breaks
- maximum prose width around 65–75 characters
- avoid giant paragraphs
- use sentence fragments intentionally
- keep technical sections denser than narrative sections
- preserve visible punctuation, especially ellipses — subject to the breakpoint rule above

### The ellipsis — one rule

Three documents gave it three treatments. The rule: the `...` is **decorative**, marked
`aria-hidden`, and never the only carrier of meaning or timing. Where a pause matters semantically,
the surrounding copy carries it.

## Spacing

The page needs generous vertical rhythm.

Suggested section padding:

```css
padding-block: clamp(6rem, 14vw, 12rem);
```

Hero may use:

```css
min-height: min(100svh, 960px);
```

Avoid forcing exactly 100vh on mobile.

## Layout

### Narrative sections

- narrow text column
- strong vertical space
- no cards unless content truly behaves like a unit

### Architecture sections

- wider canvas
- responsive diagram
- optional details panel
- readable without interaction

### CTA section

- compact
- direct
- no pricing-style cards

## Borders and surfaces

- subtle 1px borders
- low-contrast surfaces
- avoid heavy shadows
- use shadows only when needed to establish interaction hierarchy
- rounded corners should be restrained, around 10–16px

## Icons

Use icons sparingly.

Prefer:

- arrows
- chevrons
- simple state symbols
- command/result glyphs

Avoid:

- feature-grid icon soup
- cartoon game icons
- decorative logos for concepts
- emoji as interface icons

## Architecture diagram style

Nodes should be:

- rectangular
- simple
- labeled clearly
- connected with restrained lines
- animated only on entrance or selection
- legible without hover

The layer names and relationships are fixed by `00-repository-reality.md` §1 — four layers,
`Core → Kinds → Campaigns → Clients`. The five-layer stack this document used to draw, with a
`Reusable Mechanics` layer and `Games` at the bottom, described a model that does not exist.

**Fan out, do not stack.** Four nodes in a straight vertical line is a bulleted list with better
typography, and cannot carry the widest canvas on the page. The branch shape both fills the canvas
and demonstrates the thesis instead of asserting it:

```text
        ┌──────────────┐
        │ Core         │
        └──────┬───────┘
               │ inherited by
        ┌──────▼───────┐
        │ Kinds        │────┬─────────────┬─────────────┐
        └──────┬───────┘    │             │             │
               │ plus    story-graph   simulation   world-graph
               │ content    │             │             │
        ┌──────▼───────┐    │             │             │
        │ Campaigns    │  Bulgaria:    Life in the   Sun Trap
        └──────┬───────┘  Make-Your-   Fast Lane
               │ presented  Own-
               │ by         Adventure
        ┌──────▼───────┐
        │ Clients      │
        └──────────────┘
```

Three real kinds, three real campaigns, every element verified fact. `README.md`'s mermaid block
already draws this relationship with dotted branches.

**Each layer node is a link**, not a click target — to the core contract, the kind specs and so on,
using the absolute URLs in `00-repository-reality.md` §3. Hover and focus highlighting is a CSS rule.
No details panel: the summaries it would reveal have to be visible anyway, so revealing them adds
nothing.
