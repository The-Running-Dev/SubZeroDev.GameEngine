# Site Architecture

> **This document was rewritten.** As authored it specified a custom page inside the engine's
> Docusaurus documentation site — *"Docusaurus remains the host, router, documentation framework,
> and theme foundation."* That premise is void: the landing page is a **standalone React site under
> `site/`**, with no relationship to the docs project. See `00-repository-reality.md` §5 and §6.
>
> The filename is kept because this bundle's numbering is positional and `specifications/README.md`
> lists files by name. Its subject is the site's architecture, not Docusaurus.

## Recommendation

Build a standalone React single-page application under `site/`.

Plain Vite plus React is sufficient. The page is one route with almost no dynamic behaviour, so
there is nothing here needing a meta-framework, a router, a state library or a CSS-in-JS runtime.

Deliberately **not** required:

- **No prerendering, static generation or server rendering.** The no-JavaScript requirement was
  dropped (`00-repository-reality.md` §6), which is what removed the need for a framework that
  builds to static HTML.
- **No router.** One route. Every other destination is an external link to the docs or the
  repository.
- **No animation library.** CSS transitions and `IntersectionObserver` cover the whole motion spec.
- **No utility CSS framework.** Introducing one for a single page is not a trade that pays.
- **No UI component library.** The design is typography and spacing; a component kit would fight it.

## Suggested structure

```text
site/
├── index.html                  the shell — Open Graph tags live HERE, not in React
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── ArchitectureDiagram/
    │   │   ├── ArchitectureDiagram.tsx
    │   │   ├── ArchitectureDiagram.module.css
    │   │   └── architectureData.ts
    │   ├── LandingHeader.tsx
    │   ├── HeroSection.tsx
    │   ├── OriginTrigger.tsx
    │   ├── ProblemSection.tsx
    │   ├── RealizationSection.tsx
    │   ├── AbstractionSection.tsx
    │   ├── CommandContractSection.tsx
    │   ├── LedgerSection.tsx
    │   ├── OriginResolution.tsx
    │   ├── DocumentationCta.tsx
    │   └── LandingFooter.tsx
    ├── css/
    │   ├── tokens.css
    │   ├── typography.css
    │   └── motion.css
    ├── data/
    │   └── landingContent.ts
    └── hooks/
        ├── usePrefersReducedMotion.ts
        └── useRevealOnScroll.ts
```

Avoid unnecessary fragmentation — a smaller structure is better if it stays readable. `LedgerSection`
covers both Refusals and Capabilities, which share a shape without being rendered identically; see
the design review on breaking their symmetry.

`site/` needs no `.gitignore` change: the repository's existing `node_modules/` and `dist/` patterns
match at any depth.

## The shell

`site/index.html` is the served HTML, and it carries everything that must exist before React runs:

- `<title>`, meta description, Open Graph and social-preview tags. **Unfurlers do not execute
  JavaScript**, so tags injected by React are invisible to Slack, Discord, Twitter/X, LinkedIn and
  iMessage. This is the single most consequential effect of client-side rendering for a page whose
  distribution is a pasted link.
- `color-scheme: dark` on the root element, so form controls, scrollbars, focus rings and autofill
  match the palette instead of rendering light against a near-black page.
- Font declarations, kept to the variants actually used.
- Optionally a one-line `<noscript>` message. A deliberate choice either way, not an omission.

Canonical and Open Graph **URLs are now known**: `https://game-engine.subzerodev.com/`, the docs
site's existing GitHub Pages deployment (`00-repository-reality.md` §6). Set them in `index.html`
rather than leaving them out — see `site/index.html` for the implemented tags.

## Page implementation

`App.tsx` should:

- render one page-level `h1`;
- render semantic sections, each with an accessible heading or label;
- use real `<a>` and `<button>` elements, never clickable `div`s;
- keep section components thin, with copy in `data/landingContent.ts`;
- not create a universal section component that obscures semantics.

The site owns its own header and footer. There is no framework layout to preserve or defer to.

## Content separation

Put composed copy in `src/data/landingContent.ts` as structured objects. Benefits: easier editing,
easier testing, cleaner components, no large JSX text blocks.

Do not build a CMS. Keep highly composed narrative copy beside the section that renders it wherever
splitting it would obscure the pacing — the line breaks are part of the writing.

## Styling

CSS Modules for component styles. Global tokens for colour, typography, spacing, motion and section
widths.

**One token set only.** The canonical values are in `01-implementation-plan.md` §7; a duplicate in
`07-visual-design-system.md` was removed because four of its values had silently diverged. That
document now describes usage rules rather than values.

**Dark only.** One palette, no light mode, no toggle, and no `prefers-color-scheme` branch — there
is nothing to branch to. See `00-repository-reality.md` §6.

Avoid: inline style objects carrying the design system, runtime CSS-in-JS, large dependency
additions.

## Routing

One route.

```text
/    the landing page
```

Everything else is an **external absolute URL** to the documentation site or the repository, listed
in the route inventory at `00-repository-reality.md` §3. The landing page cannot resolve `/docs/...`
— that path belongs to a different origin.

Nothing validates these links automatically. The route inventory is the only check, so re-read it
whenever the docs are restructured.

## Tooling

The project owns its own `package.json`, and therefore its own formatter, linter, `tsc` and component
test runner. None of it is shared with `src/engine/`, whose CI job is pinned to that directory.

The engine's determinism eslint guard does **not** apply here — a landing page may use `Date.now` and
`Math.random` freely.

## Dependencies

Prefer native browser APIs and CSS: `IntersectionObserver`, CSS transitions, semantic HTML, inline
SVG or CSS for the diagram.

Potentially no runtime dependencies beyond React itself are required.

## Analytics

If analytics are added later, define events that answer a real question — architecture-layer clicks,
docs clicks, repository clicks. Do not add analytics for vanity metrics.
