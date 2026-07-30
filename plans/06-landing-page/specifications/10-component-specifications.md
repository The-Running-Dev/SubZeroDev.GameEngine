# Component Specifications

## `HeroSection`

### Responsibilities

- render product label
- render primary message
- render signature line
- provide scroll invitation
- provide optional top-level links
- establish visual tone

### Props

Prefer none unless content is externalized.

Possible props:

```ts
type HeroSectionProps = {
  title: string;
  subtitle: string;
  signature: string;
  links: Array<{ label: string; href: string }>;
};
```

### Accessibility

- one page-level `h1`
- scroll prompt should not be the only navigation
- decorative ellipsis should be hidden from screen readers if needed
- links require visible focus styles

## `StoryBeat`

Reusable narrative section for one or more short statements.

```ts
type StoryBeatProps = {
  eyebrow?: string;
  heading?: string;
  lines: string[];
  align?: "left" | "center";
  tone?: "default" | "quiet" | "emphasis";
};
```

Must not become a generic abstraction for every section.

## `OriginSection`

### Responsibilities

- tell the short origin hook
- optionally show abstract LLM conversation fragments
- preserve pacing
- link to longer origin story only if needed

## `ProblemSection`

### Responsibilities

- establish the recurring-mechanics problem
- contrast solved engine concerns with repeatedly rebuilt gameplay systems
- end with the inefficiency observation

## `ArchitectureDiagram`

### Data

```ts
type ArchitectureLayer = {
  id: string;
  label: string;
  relationship?: string;
  summary: string;
  details?: string[];
  href?: string;
};
```

### Required behavior

- visible static fallback
- semantic buttons or links if interactive
- keyboard navigation
- touch support
- no hover-only descriptions
- active state reflected with `aria-pressed` or proper disclosure semantics
- no canvas unless necessary
- prefer SVG or semantic HTML

### Layers

1. Deterministic Core
2. Reusable Mechanics
3. Game Kinds
4. Campaigns
5. Games / Presentation

Names must be verified against actual project terminology before implementation.

## `PhilosophySection`

Contains:

- dragon statement
- games/data statement
- commands and validation
- renderer separation

Should not become a long wall of text.

## `RefusalsSection`

Render as a clean vertical list.

Do not use red cross icons everywhere.

Possible design:

```text
01  Rewrite inventory systems
02  Hide random state
03  Trust unvalidated content
```

## `CapabilitiesSection`

Render similarly to Refusals for visual symmetry.

Avoid a six-card feature grid unless later testing proves it is more readable.

## `StoryTimeline`

Optional.

Use only if it adds clarity without repeating the origin prose.

Timeline steps:

- I miss Jones
- Ask an LLM
- Mechanics explained
- Implementation suggested
- Reuse discovered
- Determinism required
- Engine appears

## `DocumentationCta`

### Primary action

Read the architecture

### Secondary actions

- Explore concepts
- View documentation
- Browse GitHub

### Tone

> Still here?
>
> Good.
>
> Now it becomes considerably less philosophical.

## `LandingFooter`

Contains project identity and signature closing.

Should not duplicate the full default Docusaurus footer if both are rendered.

## `Reveal`

Avoid creating a component that hides content before JavaScript.

Prefer a hook or data attribute that adds enhancement classes.

## Testing expectations

- render test for each major section
- keyboard interaction test for architecture layers
- reduced-motion behavior test where practical
- no broken internal links
- no hydration mismatch
- Lighthouse or equivalent checks
