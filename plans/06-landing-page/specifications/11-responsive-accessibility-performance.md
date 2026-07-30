# Responsive Design, Accessibility, and Performance

## Responsive behavior

### Desktop

- strong whitespace
- alternating narrow narrative and wide architecture sections
- optional side-by-side architecture description
- hero typography may use very large display sizing

### Tablet

- preserve narrative pacing
- reduce section padding
- architecture diagram remains readable
- avoid awkward centered text blocks wider than comfortable reading width

### Mobile

- stack all architecture layers vertically
- reduce hero scale without losing impact
- never require horizontal scrolling for prose
- ensure buttons are full-width or comfortably tappable
- keep origin story readable
- remove nonessential decorative transitions
- avoid viewport height traps caused by browser chrome

## Breakpoint guidance

Use existing Docusaurus breakpoints if available.

Suggested conceptual breakpoints:

- mobile: under 640px
- tablet: 640–996px
- desktop: above 996px

Do not hardcode these without checking project conventions.

## Accessibility

### Semantics

- one `h1`
- logical heading hierarchy
- meaningful `section` labels
- proper `nav`
- real links and buttons
- no clickable `div` elements

### Keyboard

All interactions must support:

- Tab
- Shift+Tab
- Enter
- Space where appropriate
- Escape only if modal/disclosure behavior exists

### Focus

Focus states must be visible against dark and light backgrounds.

Do not remove outlines without replacing them.

### Contrast

Target WCAG AA at minimum.

Check:

- body copy
- muted text
- borders used as important separators
- accent buttons
- hover states
- diagram labels

### Motion

Respect `prefers-reduced-motion`.

No content should become unavailable when motion is disabled.

### Screen readers

- architecture diagram needs a text equivalent
- decorative lines and arrows should be hidden
- active diagram description should announce changes if necessary
- ellipsis should not create confusing repeated punctuation
- external GitHub link should be clear

## Performance

### Goals

- fast initial render
- minimal JavaScript
- no large animation dependency by default
- no autoplay video
- no heavy hero image
- no web font explosion
- no layout shifts

### Suggested budgets

These are guidelines:

- no new JavaScript package unless justified
- landing page custom JS ideally under 20 KB compressed
- no image above 250 KB unless it provides essential value
- font variants limited to those actually used
- SVG optimized

### Rendering

Prefer static server rendering through Docusaurus.

Avoid client-only rendering for primary content.

### Fonts

Best options:

1. Use existing site fonts.
2. Self-host one variable sans font and one mono font.
3. Use system fonts for maximum performance.

Do not load five weights for each font.

## SEO and social previews

Create:

- page title
- meta description
- canonical URL
- Open Graph title
- Open Graph description
- project-specific social preview image

The social preview can use typography only:

```text
Build mechanics once.
Create infinite games.

Well... why not?
```

## Content integrity

Do not claim:

- supported genres not yet implemented
- production readiness without evidence
- AI content generation features if only validation exists
- benchmarks not measured
- deterministic guarantees beyond actual scope
