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

There are no existing breakpoints to inherit — this is a new standalone project.

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

The page is a client-rendered React SPA. It is not prerendered or server-rendered, and the
requirement that content survive without JavaScript has been dropped — see
`00-repository-reality.md` §6.

What still holds: content is visible by default and animation is added on top, so a reveal that
never fires leaves the page readable rather than blank.

### Fonts

Best options:

1. Use existing site fonts.
2. Self-host one variable sans font and one mono font.
3. Use system fonts for maximum performance.

Do not load five weights for each font.

## SEO and social previews

**These tags must live in the static HTML shell, not be injected by React.** Slack, Discord,
Twitter/X, LinkedIn and iMessage unfurlers do not execute JavaScript, so a React-injected meta tag
is invisible to them and every shared link renders bare. For a page whose main distribution is a
pasted link, this is the single most consequential consequence of client-side rendering.

Search coverage likewise depends on the crawler executing JavaScript. A noted tradeoff — this
bundle states no organic-search ambition.

Create:

- page title
- meta description
- Open Graph title
- Open Graph description
- project-specific social preview image

Canonical URL, Open Graph URL and any sitemap entry **wait on a hosting decision** — the domain is
not decided (`00-repository-reality.md` §6). Do not fill them in speculatively.

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
