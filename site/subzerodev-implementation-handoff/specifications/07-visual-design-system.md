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

Use CSS variables and preserve Docusaurus dark/light compatibility.

Suggested dark palette:

```css
--landing-bg: #090a0d;
--landing-surface: #101218;
--landing-surface-raised: #151821;
--landing-text: #f4f5f7;
--landing-muted: #9ca3af;
--landing-border: rgba(255, 255, 255, 0.10);
--landing-accent: #7dd3fc;
--landing-accent-soft: rgba(125, 211, 252, 0.12);
--landing-danger-soft: rgba(248, 113, 113, 0.10);
--landing-success-soft: rgba(74, 222, 128, 0.10);
```

These values are suggestions, not requirements. The accent should harmonize with the existing SubZeroDev brand if one exists.

### Color rules

- one primary accent
- no rainbow gradients
- no glowing neon borders
- avoid pure black behind all sections
- distinguish sections using spacing and subtle surface changes
- diagrams use opacity and line style before adding more colors
- ensure WCAG contrast

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
--text-hero: clamp(3rem, 8vw, 7.5rem);
--text-display: clamp(2.25rem, 5vw, 5rem);
--text-section: clamp(1.75rem, 3vw, 3rem);
--text-body-large: clamp(1.125rem, 2vw, 1.5rem);
--text-body: 1rem;
--text-small: 0.875rem;
```

### Typography rules

- short lines
- large line breaks
- maximum prose width around 65–75 characters
- avoid giant paragraphs
- use sentence fragments intentionally
- keep technical sections denser than narrative sections
- preserve visible punctuation, especially ellipses

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

Example:

```text
┌────────────────────┐
│ Deterministic Core │
└─────────┬──────────┘
          │ validates
          ▼
┌────────────────────┐
│ Reusable Mechanics │
└─────────┬──────────┘
          │ composed as
          ▼
┌────────────────────┐
│ Game Kinds         │
└─────────┬──────────┘
          │ configured by
          ▼
┌────────────────────┐
│ Campaigns          │
└─────────┬──────────┘
          │ presented as
          ▼
┌────────────────────┐
│ Games              │
└────────────────────┘
```
