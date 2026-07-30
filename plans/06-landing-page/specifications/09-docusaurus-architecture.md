# Docusaurus Architecture

## Recommendation

Implement the homepage as a custom Docusaurus React page.

Do not attempt to build the full landing experience in Markdown or MDX unless the project strongly requires content-only editing.

Docusaurus remains the host, router, documentation framework, and theme foundation.

The homepage becomes a custom product experience.

## Suggested structure

```text
src/
├── components/
│   └── landing/
│       ├── ArchitectureDiagram/
│       │   ├── ArchitectureDiagram.tsx
│       │   ├── ArchitectureDiagram.module.css
│       │   ├── architectureData.ts
│       │   └── index.ts
│       ├── CapabilitiesSection.tsx
│       ├── DocumentationCta.tsx
│       ├── HeroSection.tsx
│       ├── OriginSection.tsx
│       ├── ProblemSection.tsx
│       ├── RefusalsSection.tsx
│       ├── StoryBeat.tsx
│       ├── StoryTimeline.tsx
│       ├── PhilosophySection.tsx
│       └── LandingFooter.tsx
├── css/
│   ├── custom.css
│   └── landing/
│       ├── tokens.css
│       ├── landing.css
│       ├── motion.css
│       └── typography.css
├── hooks/
│   ├── usePrefersReducedMotion.ts
│   └── useRevealOnScroll.ts
├── pages/
│   ├── index.tsx
│   └── index.module.css
└── data/
    └── landingPageContent.ts
```

Exact structure should follow existing repository conventions.

## Page implementation

`src/pages/index.tsx` should:

- use `Layout` from Docusaurus
- define SEO title and description
- render semantic sections
- avoid placing all copy directly in one giant component
- preserve static rendering
- avoid client-only dependencies where possible
- use normal Docusaurus navigation and footer only if they fit the experience

## Layout decision

Two valid options:

### Option A — Standard navigation, custom body

Keep the existing Docusaurus navbar for continuity.

Recommended when:

- docs are already established
- users need immediate navigation
- brand consistency matters

### Option B — Minimal landing navbar

Create a lighter landing-page header with:

- logo/name
- Architecture
- Docs
- GitHub

Recommended when:

- default navbar visually weakens the hero
- the landing page should feel separate
- implementation can remain accessible and maintainable

Do not hide navigation completely.

## Content separation

Place copy in `landingPageContent.ts` or structured JSON/TS objects when useful.

Benefits:

- easier editing
- easier testing
- cleaner components
- potential localization
- avoids large JSX text blocks

Do not overengineer content into a CMS.

## Styling approach

Use CSS Modules for component-specific styles.

Use global landing tokens for:

- colors
- typography
- spacing
- motion
- section widths

Avoid:

- inline style objects for the full design system
- runtime CSS-in-JS
- large dependency additions
- utility framework introduction solely for one page unless already used

## Dependencies

Prefer native browser APIs and CSS.

Potentially no new dependencies are required.

Use:

- `IntersectionObserver`
- CSS transitions
- semantic HTML
- inline SVG or CSS diagrams

Only add an animation library if the design genuinely cannot be implemented cleanly without it.

## Routing

Expected routes:

```text
/                    landing page
/docs/...             documentation
/blog/...             blog
/architecture/...     optional architecture entry
```

Link targets must match real repository paths.

## SEO metadata

Suggested title:

> SubZeroDev Game Engine — Build Mechanics Once

Suggested description:

> A deterministic game and simulation engine built around reusable mechanics, validated commands, replayable worlds, and content-driven games.

Do not mention unsupported capabilities.

## Analytics

If analytics already exist, define useful events:

- hero architecture click
- docs click
- GitHub click
- architecture diagram interaction
- demo interaction

Do not add analytics solely for vanity.
