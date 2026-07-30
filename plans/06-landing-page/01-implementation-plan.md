# SubZeroDev Game Engine Landing Page

## Implementation Plan

**Status:** Planning complete; repository inspection required before implementation  
**Scope:** A standalone React landing page under `site/`. Not part of the documentation site  
**Primary objective:** Turn the existing specification bundle into a polished, accessible, technically credible scrolling narrative without disrupting the documentation experience.

---

## 1. Intended outcome

The finished homepage should:

- introduce the engine through its true origin story;
- explain the repeated-mechanics problem;
- show how mechanics, content, simulation, and presentation are separated;
- establish deterministic commands and validation as the architectural core;
- guide technically curious visitors toward the architecture, documentation, and repository;
- feel like an editorial technical essay rather than a SaaS product template;
- remain clear and complete without animation or client-side JavaScript;
- leave the documentation site entirely alone — it is a separate property.

The homepage is successful when a visitor moves through this sequence:

1. **Curiosity:** “What is this?”
2. **Recognition:** “This repeated-mechanics problem is real.”
3. **Understanding:** “Mechanics are separated from fiction and presentation.”
4. **Confidence:** “The architecture is serious and internally consistent.”
5. **Action:** “I want to inspect the architecture, documentation, or code.”

---

## 2. Non-negotiable product and design principles

- Retain: **“Build mechanics once. Create infinite games.”**
- Retain: **“Well... why not?”**
- Make the Jones in the Fast Lane origin part of the homepage.
- Keep humor sparse, dry, and derived from real engineering observations.
- Do not position the engine as a Unity, Unreal, or Godot replacement.
- Do not present it as an unconstrained AI game generator.
- Do not invent adoption, benchmarks, maturity, routes, or implemented capabilities.
- Avoid feature-card grids, decorative 3D art, neon cyberpunk styling, particle effects, and generic AI gradients.
- Let typography, whitespace, architecture, and state-transition language carry the design.
- Treat motion as progressive enhancement.
- Keep documentation pages conventional and more serious than the homepage.

---

## 3. Delivery strategy

Implementation should proceed through seven gated phases:

```text
Repository truth audit
        ↓
Product claims and content lock
        ↓
Static semantic page
        ↓
Visual system and responsive composition
        ↓
Architecture interaction
        ↓
Motion and progressive enhancement
        ↓
Verification and release readiness
```

No phase should rely on assumptions that the preceding gate was intended to resolve.

---

## 4. Phase 0 — Repository truth audit — COMPLETE

> **This gate is closed.** The audit was performed against the repository and its findings are
> `00-repository-reality.md`, which supersedes this section and every other document here on
> questions of fact. Gate 0's exit criteria are met: no layer name is speculative, no
> call-to-action points to an invented route, the build and validation commands are known, and
> the boundary between implemented and aspirational capability is documented as a classified
> matrix.
>
> The rest of this section is retained as the record of what was asked for. Do not re-run it —
> a second derivation produces a second set of answers.

### Purpose

Replace specification assumptions with evidence from the actual project.

### Inspect

- repository-level instructions — `CLAUDE.md` and `agent.md`;
- package manager and lockfile;
- React and build-tool versions;
- current homepage implementation;
- global styles and existing design tokens;
- theme decision (dark only);
- navbar and footer configuration;
- documentation, architecture, blog, and repository routes;
- current fonts, icons, logo, favicon, and social-preview assets;
- light and dark mode behavior;
- linting, formatting, testing, type-checking, and build commands;
- CI requirements;
- actual engine names, namespace terminology, and hierarchy;
- implemented versus planned engine capabilities.

### Create a claim matrix

Every technical homepage claim should be classified as:

- **Implemented:** directly supported by code or current documentation;
- **Architectural contract:** designed and documented, but not necessarily complete;
- **Planned:** present only in roadmaps or proposals;
- **Unsupported:** absent or contradicted.

Claims requiring explicit verification include:

- deterministic state transitions;
- replay support;
- serialization;
- command validation;
- time progression;
- human and AI use of the same command boundary;
- renderer independence;
- multiple presentation layers;
- reusable mechanics;
- Kinds and Campaigns as real project concepts.

### Gate 0 deliverable

A short repository findings note containing:

- confirmed terminology;
- confirmed routes;
- supported claims;
- claims requiring softer language;
- existing conventions to preserve;
- implementation constraints;
- unresolved decisions requiring owner input.

### Gate 0 exit criteria

- No homepage layer name is speculative.
- No call-to-action points to an invented route.
- Current build and test commands are known.
- The boundary between implemented and aspirational capabilities is documented.

---

## 5. Phase 1 — Content architecture and copy lock

### Purpose

Turn the specification bundle into one intentional narrative and eliminate repetition.

### Final recommended page sequence

1. **Landing header**
   - project identity;
   - Architecture, Documentation, and GitHub links;
   - existing theme control only if consistent with the site.

2. **Hero**
   - product label;
   - primary line;
   - ellipsis;
   - signature;
   - scroll invitation.

3. **Origin trigger**
   - missing Jones in the Fast Lane;
   - asking an LLM;
   - “That was a mistake.”

4. **Repeated-mechanics problem**
   - rendering, physics, input, and networking contrast;
   - recurring inventory, economy, schedule, progression, and relationship systems.

5. **Reusability realization**
   - “Why would I write this for one game?”
   - mechanics are not games;
   - mechanics should survive the first game that uses them.

6. **Architecture**
   - verified project hierarchy;
   - concise description for every layer;
   - relationship labels between layers;
   - renderer/presentation separation.

7. **Abstraction**
   - dragon, detective, hotel, spaceship, and Bulgaria sequence;
   - state, commands, rules, time, relationships, resources, and consequences.

8. **Operating contract**
   - games/content versus gameplay/mechanics;
   - validated command boundary;
   - human and AI equality only if technically accurate.

9. **Refusals and capabilities**
   - two visually related vertical ledgers;
   - no generic feature cards.

10. **Origin resolution**
    - continue the opening story rather than repeating it;
    - connect each architectural realization to the next;
    - end with the accidental engine and shorter-answer joke.

11. **Documentation handoff**
    - “Still here?” transition;
    - primary architecture action;
    - secondary concepts, documentation, and repository actions.

12. **Signature footer**
    - wrong-question/better-questions close;
    - final “Well... why not?”

### Editing rules

- Use the revised copy deck as the editorial starting point.
- Remove any repeated explanation that does not add a new conclusion.
- Prefer short concrete statements over marketing adjectives.
- Treat “Create infinite games” as a brand proposition, not a quantified promise.
- Prefer “And we kept rewriting inventory systems” over an unverifiable historical duration.
- Mention AI only in the origin and verified command-boundary sections.
- Introduce technical density gradually.
- Make the final CTA section nearly joke-free.

### Content model

Use a small typed content structure when it improves clarity:

```ts
type ArchitectureLayer = {
  id: string;
  label: string;
  relationship?: string;
  summary: string;
  details?: string[];
  href?: string;
};

type PrincipleItem = {
  number: string;
  statement: string;
};
```

Keep highly composed narrative copy close to its section component. Do not create a CMS-like abstraction for every line.

### Gate 1 deliverables

- final page outline;
- approved copy deck;
- verified link inventory;
- approved architecture labels and descriptions;
- technical claim matrix;
- SEO title and description;
- social-preview copy brief.

### Gate 1 exit criteria

- Each section introduces a new idea.
- The complete narrative works when read as plain text.
- Humor remains approximately 5–10% of the copy.
- Every technical claim has an evidence classification.
- CTA labels and destinations are real.

---

## 6. Phase 2 — Static semantic implementation

### Purpose

Build the entire narrative as an accessible, server-rendered page before adding motion or complex interaction.

### Recommended component boundaries

```text
LandingPage
├── LandingHeader
├── HeroSection
├── OriginTrigger
├── ProblemSection
├── RealizationSection
├── ArchitectureSection
│   ├── ArchitectureDiagram
│   └── ArchitectureDescription
├── AbstractionSection
├── CommandContractSection
├── RefusalsSection
├── CapabilitiesSection
├── OriginResolution
├── DocumentationCta
└── LandingFooter
```

### Component rules

- Use one page-level `h1`.
- Give every major section an accessible heading or label.
- Use real links and buttons.
- Do not use clickable `div` elements.
- Do not create a universal section component that obscures semantics.
- Do not hide primary content behind a reveal that may never fire.
- The site owns its own shell — header, footer and layout. There is no framework layout to preserve.

### Static architecture presentation

The architecture must show, without any interaction:

- every layer;
- the order and relationship of the layers;
- a short explanation for each layer;
- a text alternative to decorative connectors;
- all essential information on mobile.

Since every layer is a link rather than a click target (`00-repository-reality.md` §1), this is not
a "fallback" — it is the component. Interaction adds highlighting, nothing more.

### Gate 2 deliverable

A complete, unanimated homepage that is understandable and navigable with CSS disabled, keyboard only, or a screen reader.

### Gate 2 exit criteria

- All required content is present.
- Heading hierarchy is logical.
- Links point to confirmed destinations, per the route inventory in `00-repository-reality.md` §3.
- Content is visible when a reveal does not fire.
- Open Graph and social-preview tags are in the built HTML shell.

---

## 7. Phase 3 — Visual system and responsive composition

### Design concept

**Cold logic, warm accident**

The system is precise, dark, restrained, and technical. The origin passages introduce a small amount of human warmth without creating a second visual brand.

### Suggested token direction

Final values should adapt to existing project tokens:

```css
--landing-bg: #090a0d;
--landing-surface: #101218;
--landing-surface-raised: #151821;
--landing-text: #f4f5f7;
--landing-muted: #a2a9b4;
--landing-border: rgba(255, 255, 255, 0.11);
--landing-accent: #82d8ff;
--landing-accent-soft: rgba(130, 216, 255, 0.12);
--landing-origin-text: #d8d0c2;
```

### Typography

- Display and narrative: existing brand sans, Geist, Inter, IBM Plex Sans, or a strong system stack.
- Technical labels: existing project mono, IBM Plex Mono, Geist Mono, or a system mono stack.
- Use only necessary weights.
- Preserve punctuation and deliberate line breaks.
- Limit body copy to approximately 65–75 characters per line.

### Layout

- Hero: near-full viewport without forcing `100vh` on mobile.
- Narrative sections: narrow reading column.
- Architecture: wide canvas with a details region on desktop.
- Refusals/capabilities: related ledger layouts, not cards.
- CTA: compact and direct.
- Section spacing: generous, responsive, and varied according to narrative importance.

### Recurring visual language

- thin rules;
- ordered numbers;
- restrained arrows;
- relationship verbs;
- state and validation labels;
- low-contrast surfaces;
- one ice-blue accent;
- no decorative illustration requirement.

### Responsive states

#### Desktop

- architecture diagram and description may sit side by side;
- narrative width remains narrow;
- whitespace carries pacing;
- header links remain immediately accessible.

#### Tablet

- reduce vertical spacing carefully;
- keep architecture relationships legible;
- avoid overly wide centered paragraphs;
- stack technical detail when side-by-side composition becomes cramped.

#### Mobile

- stack all architecture layers vertically;
- show explanations inline or through accessible disclosure controls;
- prevent horizontal prose scrolling;
- use comfortable touch targets;
- remove nonessential decorative transitions;
- avoid viewport-height traps;
- verify at 320px width.

### Theme — dark only

**Decided.** One palette, no light mode, no toggle. The three options this section used to offer are
withdrawn; one of them ("follow the current site theme automatically") referred to a site theme that
no longer exists.

- Set `color-scheme: dark` on the root, so form controls, scrollbars, focus rings and autofill match
  rather than rendering light against a near-black page.
- Do **not** branch on `prefers-color-scheme`. There is nothing to branch to, and branching is
  precisely how the accidental half-supported light mode this section warned about appears.

### Gate 3 deliverable

A responsive, visually complete homepage with no animation dependency.

### Gate 3 exit criteria

- The page does not resemble a generic SaaS template.
- Architecture is the main visual event — drawn as a fan-out, not a four-node stack.
- Contrast meets WCAG AA, including the meaning-bearing border token.
- No content overflows at 320px, with the hero headline wrapping rather than holding its composed
  line break.

---

## 8. Phase 4 — Architecture interaction

### Purpose

Give the reader a way into the specs from the diagram, without building a component whose only job is
re-showing text already on the page.

### The layers are links

This phase used to specify a details region: click a layer, its summary appears in a stable panel,
selection persists. That is withdrawn. Because interaction must never gate meaning, all four summaries
had to be visible anyway — so the panel revealed nothing new, at the cost of `aria-pressed`, selection
state, a separate mobile disclosure variant and their tests.

Instead, **each layer node is an `<a>`** pointing at that layer's spec, using the absolute cross-site
URLs in `00-repository-reality.md` §3. `Core` → the core contract, `Kinds` → the three kind specs, and
so on.

### Behavior

- hover and focus highlight the layer — **CSS only**, no state;
- every layer and its summary is visible at all times, on every viewport;
- activating a layer navigates to its spec;
- decorative connectors are hidden from assistive technology;
- no hover-only information anywhere;
- no live-region announcements — nothing changes in place.

Keyboard operation, focus handling and screen-reader semantics all come free from using real links.
There is no separate mobile behavior to design: a link works the same everywhere.

### Gate 4 deliverable

An architecture diagram, drawn as a fan-out from `Kinds` to the three real kinds, whose layer names
are working links into the documentation.

### Gate 4 exit criteria

- Every layer and summary is readable without interacting.
- Focus order follows reading order.
- Every href matches the route inventory.
- Highlighting adds no ARIA state and no JavaScript.

---

## 9. Phase 5 — Motion and progressive enhancement

### Add only

- a restrained hero reveal on the **last two lines only** — see below;
- selected narrative reveals at key transitions;
- architecture highlight transitions;
- the signature hover/focus response, desktop-only.

### The hero paints immediately

The eyebrow, headline and ellipsis render in full on mount, with **no reveal**. Only the signature and
the scroll invitation stagger in — the two lines whose timing is actually a joke.

The five-stage sequence originally specified (label, then headline, then ellipsis, then signature,
then invitation) was written when the page was prerendered, so it began from painted content. The page
is now a client-rendered SPA: it starts blank, waits for the bundle to parse and mount, and only then
would begin staggering. That puts well over a second of nothing in front of the page's most important
words, against this plan's own "fast initial render" and "no layout shifts" goals.

Keep the comic beat. Lose the blank screen.

### Timing direction

```css
--motion-fast: 140ms;
--motion-standard: 240ms;
--motion-slow: 480ms;
--motion-story: 700ms;
--motion-ease: cubic-bezier(0.22, 1, 0.36, 1);
```

### Technical approach

- prefer CSS transitions and `IntersectionObserver`;
- add enhancement classes only after JavaScript initializes;
- avoid animation libraries unless the approved design cannot be achieved cleanly;
- never use scroll-jacking, pinned cinematic sequences, cursor particles, bounce, or decorative spinning.

### Reduced-motion behavior

When reduced motion is requested:

- show all content immediately;
- remove reveal transforms and delays;
- disable animated diagram transitions;
- preserve clear instant hover and focus states;
- do not wait for intersection events to expose content.

This is a `prefers-reduced-motion` requirement and is unaffected by the page being client-rendered.
It is also distinct from **reveal safety** — that content stays visible when an observer never fires —
which applies whether or not reduced motion is requested.

### Gate 5 deliverable

A restrained motion pass that improves timing and hierarchy without changing content availability.

### Gate 5 exit criteria

- JavaScript failure does not hide content.
- Reduced-motion mode is complete.
- Animations do not delay navigation or interaction.
- Motion is used selectively, not section by section.

---

## 10. Phase 6 — Verification and release readiness

### Functional checks

- all navigation and CTA links;
- architecture mouse, keyboard, and touch behavior;
- theme switching where supported;
- no hydration mismatch;
- no broken documentation behavior;
- external-link behavior;
- default and reduced-motion states.

### Responsive checks

Minimum target widths:

- 320px;
- 375px;
- 768px;
- 996px;
- 1280px;
- 1440px or wider.

Check:

- text wrapping;
- deliberate line breaks;
- architecture labels;
- tap-target size;
- header behavior;
- absence of horizontal scrolling;
- mobile browser viewport behavior.

### Accessibility checks

- one `h1`;
- logical heading order;
- landmark structure;
- keyboard-only navigation;
- visible focus;
- WCAG AA contrast;
- architecture text equivalent;
- reduced motion;
- screen-reader reading order;
- decorative punctuation and connectors hidden where appropriate.

### Performance checks

- no heavy hero media;
- no autoplay video;
- minimal custom JavaScript;
- no unjustified dependency;
- limited font variants;
- no layout shift caused by reveals;
- optimized social-preview and brand assets.

### Project checks

Run the `site/` project's own toolchain — it owns a `package.json`, so these are real rather than
borrowed (`00-repository-reality.md` §7):

- formatter;
- linter;
- type check;
- component/unit tests;
- production build.

Two that are **not** available:

- **Deploy verification waits on a hosting decision.** No host is chosen, so there is no deploy to
  verify.
- **Automated link validation does not exist** for the docs CTAs. They are cross-site absolute URLs,
  which Docusaurus' checker never sees and `build/Test-Documentation.ps1` skips by design. Check them
  by hand against the route inventory in `00-repository-reality.md` §3.

Confirm also that this work left the docs and engine alone: `build/Test-Documentation.ps1`,
`.github/workflows/docs-ci.yml` and `.github/workflows/ci.yml` should all be unaffected.

### Editorial verification

- compare every claim against the claim matrix;
- confirm capitalization and architecture terminology;
- check that AI is not overemphasized;
- confirm humor becomes quieter toward the CTA;
- verify that the opening and closing origin passages form one story rather than a repetition;
- confirm that documentation copy remains conventional.

### Gate 6 deliverable

A release-readiness note covering:

- changed files;
- major design decisions;
- verified commands and results;
- accessibility and responsive findings;
- known limitations;
- deferred enhancements;
- any remaining claim or route uncertainty.

### Definition of done

- Homepage is visually distinctive and product-specific.
- The true origin story is clear and memorable, and told once — trigger and resolution, not a recap.
- The architecture is accurate: four layers, drawn as a fan-out, every layer name a working link.
- The story works without animation.
- Content stays visible when a reveal does not fire.
- Every interaction supports keyboard and touch.
- Reduced motion is complete.
- The page works at 320px width.
- Every CTA matches the route inventory.
- Open Graph tags are in the built HTML shell, not React-injected.
- Build and the project's own checks pass.
- No unsupported capabilities are presented as current fact.

---

## 11. Suggested implementation structure

Everything lives under `site/`, a standalone React project. There is no `landing/` subfolder because
there is nothing else in the project to distinguish it from.

```text
site/
├── index.html                  the shell — Open Graph tags live HERE
├── package.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── ArchitectureDiagram/
    │   ├── AbstractionSection.tsx
    │   ├── CommandContractSection.tsx
    │   ├── DocumentationCta.tsx
    │   ├── HeroSection.tsx
    │   ├── LedgerSection.tsx
    │   ├── OriginResolution.tsx
    │   ├── OriginTrigger.tsx
    │   ├── ProblemSection.tsx
    │   └── RealizationSection.tsx
    ├── css/
    │   ├── motion.css
    │   ├── tokens.css
    │   └── typography.css
    ├── data/
    │   └── landingContent.ts
    └── hooks/
        ├── usePrefersReducedMotion.ts
        └── useRevealOnScroll.ts
```

`LedgerSection` serves both Refusals and Capabilities, which share a shape without being rendered
identically. See `specifications/09-docusaurus-architecture.md` for the fuller layout.

Avoid unnecessary fragmentation. A smaller structure is preferable if it stays readable.

---

## 12. Testing strategy

The project owns a test runner, so all of this is achievable (`00-repository-reality.md` §7).

### Component-level

- each major section renders its approved content;
- architecture layers render as links with the correct `href`, matching the route inventory;
- every layer summary is present without interaction;
- CTA destinations match the route inventory.

### Interaction-level

- the page is fully operable with keyboard only;
- focus order follows reading order;
- layer highlighting requires no ARIA state.

### Resilience

- **reveal safety** — content is present when the observer never fires. Force it by stubbing
  `IntersectionObserver`, or by testing an element already in view on load;
- reduced-motion mode removes delayed reveals and shows everything immediately;
- the hero's eyebrow, headline and ellipsis are present on first render, with no reveal;
- unknown or missing optional content does not break the layout;
- long labels do not destroy the architecture layout.

### Build output

- **Open Graph and social-preview tags are present in the built HTML**, not injected by React. This
  is the one test that catches the most consequential failure mode of client-side rendering, and it
  must assert against the build output rather than the rendered DOM;
- no horizontal overflow at 320px.

### Not applicable

The regression suite this section used to specify — docs routes still render, navbar and footer
behavior intact, theme variables not leaking into documentation, landing styles not altering unrelated
pages — assumed the page lived inside the docs site. It is a separate project with no shared styles,
routes or theme, so there is nothing to regress. Confirm the docs are untouched via
`build/Test-Documentation.ps1` and leave it there.

---

## 13. Primary risks and mitigations

### Risk: architecture terminology is wrong

**Mitigation:** Treat repository evidence as authoritative and complete Gate 0 before final copy.

### Risk: the origin story becomes repetitive

**Mitigation:** Use the opening as the trigger and the later section as the resolution. Do not restart the story.

### Risk: humor weakens credibility

**Mitigation:** Keep jokes attached to truthful observations and reduce humor as technical depth increases.

### Risk: the page looks like a generic software launch

**Mitigation:** Use editorial pacing, narrow prose, architecture as the visual centerpiece, and vertical ledgers instead of cards.

### Risk: animation hides content

**Mitigation:** Render everything visible by default and add animation only after enhancement initialization.

### Risk: AI becomes the apparent product

**Mitigation:** Limit AI references to the true origin and verified command boundary.

### Risk: landing styles damage documentation

**Mitigation:** No longer applicable. The landing page is a separate project with no shared styles,
routes or theme, so it cannot affect the documentation. Confirm with `build/Test-Documentation.ps1`.

### Risk: dark mode is polished but light mode is accidental

**Mitigation:** Make an explicit theme decision during Gate 0 and implement it deliberately.

### Risk: unsupported capabilities slip into marketing copy

**Mitigation:** Maintain the claim matrix through editorial and final QA.

---

## 14. Optional enhancements after release

These are explicitly outside the first implementation:

- a real deterministic command-validation demo;
- a replay visualization backed by engine behavior;
- deep links into architecture layers;
- an interactive origin timeline;
- a live example world;
- analytics for meaningful navigation and architecture interactions;
- a project-specific social preview image.

Do not build a simulated technical demo solely for visual effect.

---

## 15. Immediate next action

Provide or open the actual SubZeroDev repository in Codex.

The first implementation task should then be:

> Inspect the repository and produce the Gate 0 repository findings note. Do not change code. Confirm terminology, routes, existing brand conventions, implemented capabilities, build requirements, and the safest homepage integration strategy.

Only after that note is reviewed should the copy and architecture labels be locked for implementation.
