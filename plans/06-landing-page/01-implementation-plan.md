# SubZeroDev Game Engine Landing Page

## Implementation Plan

**Status:** Planning complete; repository inspection required before implementation  
**Scope:** Custom Docusaurus homepage only  
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
- preserve the behavior, conventions, and routes of the existing Docusaurus site.

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
- Docusaurus and React versions;
- current homepage implementation;
- global styles and existing design tokens;
- Docusaurus theme configuration;
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
- Do not hide primary content before hydration.
- Preserve Docusaurus layout behavior unless the approved design explicitly replaces the landing header or footer.
- Keep primary copy statically rendered.

### Static architecture fallback

Before any interactivity, the architecture must show:

- every layer;
- the order and relationship of the layers;
- a short explanation for each layer;
- a text alternative to decorative connectors;
- all essential information on mobile.

### Gate 2 deliverable

A complete, unanimated homepage that is understandable and navigable with CSS disabled, JavaScript disabled, keyboard only, or a screen reader.

### Gate 2 exit criteria

- All required content is present.
- Heading hierarchy is logical.
- Links point to confirmed destinations.
- Page renders without client-only dependencies.
- Documentation routes and theme behavior remain intact.

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

### Light-mode strategy

Choose one after repository inspection:

- fully support a deliberate light palette;
- keep the homepage intentionally dark while preserving theme controls elsewhere;
- follow the current site theme automatically.

Do not allow an accidental half-supported light mode.

### Gate 3 deliverable

A responsive, visually complete homepage with no animation dependency.

### Gate 3 exit criteria

- The page does not resemble a generic SaaS template.
- Architecture is the main visual event.
- Contrast meets WCAG AA.
- No content overflows at 320px.
- Navigation and documentation still feel related to the homepage.

---

## 8. Phase 4 — Architecture interaction

### Purpose

Make the core concept easier to explore without making interaction necessary for comprehension.

### Desktop behavior

- hovering or focusing a layer highlights it;
- activating a layer selects it;
- the corresponding summary appears in a stable details region;
- selection persists until another layer is chosen;
- focus and pointer states communicate the same meaning.

### Mobile behavior

- layers use buttons or disclosure controls;
- tapping reveals the layer explanation immediately below it;
- only one expanded layer is acceptable, but not mandatory;
- there is no hover-only information.

### Accessibility behavior

- use semantic buttons or links;
- support Tab, Shift+Tab, Enter, and Space;
- reflect state using appropriate disclosure semantics or `aria-pressed`;
- keep decorative connectors hidden from assistive technology;
- avoid unnecessary live-region announcements;
- retain a visible text equivalent.

### Gate 4 deliverable

A keyboard-, pointer-, and touch-accessible architecture explorer built from verified project terminology.

### Gate 4 exit criteria

- Interaction adds detail but never gates meaning.
- Focus order is predictable.
- Mobile behavior is deliberate.
- The static fallback remains intact.

---

## 9. Phase 5 — Motion and progressive enhancement

### Add only

- a restrained hero reveal sequence;
- selected narrative reveals at key transitions;
- architecture highlight transitions;
- the optional signature hover/focus response.

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
- preserve clear instant hover, focus, and selection states;
- do not wait for intersection events to expose content.

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

Run the repository’s established:

- formatter;
- linter;
- type check;
- component/unit tests;
- Docusaurus production build;
- internal-link validation;
- CI-equivalent checks.

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
- The true origin story is clear and memorable.
- The architecture is accurate.
- The story works without animation.
- Every interaction supports keyboard and touch.
- Reduced motion is complete.
- The page works at 320px width.
- Internal links work.
- Documentation behavior is unchanged.
- Build and required checks pass.
- No unsupported capabilities are presented as current fact.

---

## 11. Suggested implementation structure

Exact paths must follow the repository:

```text
src/
├── components/
│   └── landing/
│       ├── ArchitectureDiagram/
│       ├── AbstractionSection.tsx
│       ├── CapabilitiesSection.tsx
│       ├── CommandContractSection.tsx
│       ├── DocumentationCta.tsx
│       ├── HeroSection.tsx
│       ├── OriginResolution.tsx
│       ├── OriginTrigger.tsx
│       ├── ProblemSection.tsx
│       ├── RealizationSection.tsx
│       └── RefusalsSection.tsx
├── css/
│   └── landing/
│       ├── motion.css
│       ├── tokens.css
│       └── typography.css
├── data/
│   └── landingPageContent.ts
├── hooks/
│   ├── usePrefersReducedMotion.ts
│   └── useRevealOnScroll.ts
└── pages/
    ├── index.tsx
    └── index.module.css
```

Avoid unnecessary fragmentation. A smaller structure is preferable if existing conventions favor it.

---

## 12. Testing strategy

### Component-level

- each major section renders its approved content;
- architecture layers expose correct labels and descriptions;
- interactive layer state changes correctly;
- CTA destinations match the verified route inventory.

### Interaction-level

- architecture can be operated with keyboard only;
- mobile disclosures work with touch;
- focus and selected states remain synchronized;
- signature Easter egg is available on both hover and focus if included.

### Resilience

- content remains visible when JavaScript is unavailable;
- reduced-motion mode removes delayed reveals;
- unknown or missing optional content does not break the layout;
- long translated or edited labels do not destroy the architecture layout.

### Regression

- docs routes still render;
- default navbar/footer behavior remains correct;
- theme variables do not leak unexpectedly into documentation;
- global landing styles do not alter unrelated pages.

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

**Mitigation:** Scope page styles, preserve Docusaurus conventions, and add documentation regression checks.

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
