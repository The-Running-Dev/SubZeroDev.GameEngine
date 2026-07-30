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

**Each layer is a link, not a click target.** That decision removes most of what this component used
to need:

- every layer and its summary visible without interaction — there is no "fallback", this is the
  component
- layers are `<a>` elements pointing at the specs, using the absolute URLs in
  `00-repository-reality.md` §3
- keyboard operation, focus handling and screen-reader semantics therefore come free
- hover and focus highlighting via CSS only
- no details region, no `aria-pressed`, no selection state, no separate mobile disclosure variant
- decorative connectors hidden from assistive technology
- prefer SVG or semantic HTML; no canvas

The earlier design had clicking a layer reveal its summary in a details panel. Since interaction must
never gate meaning, those summaries had to be visible anyway — so the panel re-showed text already on
the page, at the cost of the entire ARIA and mobile-disclosure surface above.

### Layers

Four, fixed by `00-repository-reality.md` §1:

1. `Core`
2. `Kinds` — which fans out to `story-graph`, `simulation`, `world-graph`
3. `Campaigns`
4. `Clients`

There is no `Mechanics` layer and no `Games` layer; both were inventions. Mechanics live inside
Kinds. Draw it as a fan-out, not a vertical stack — see `specifications/07-visual-design-system.md`.

## `PhilosophySection`

Contains:

- dragon statement
- games/data statement
- commands and validation
- renderer separation

Should not become a long wall of text.

## `RefusalsSection` and `CapabilitiesSection`

**Four items each, and break the symmetry.**

As authored these were six items each, in deliberately matched vertical ledgers — "render similarly
to Refusals for visual symmetry". That produced twelve numbered short lines back to back in identical
form, in the longest text-only stretch of the page. Two identical blocks read as one long block, and
the rhetorical contrast the pairing exists to create is exactly what identical treatment destroys.

So:

- **Four items each**, not six. Both lists had filler by item five.
- **Drop the refusal "Rewrite the same inventory system for every game."** By the time the reader
  reaches it, the hero, the problem section and the realization have each said it.
- **Treat them differently.** One as the numbered vertical ledger; the other tighter — inline, or
  two columns, or unnumbered. Or merge both into a single side-by-side "refuses / does" contrast,
  which is one visual event instead of two identical ones.

Still true: no red cross icons, no six-card feature grid, and Refusals must not read as errors —
which is why `--landing-danger-soft` was removed from the palette.

Numbered ledger form, for whichever list keeps it:

```text
01  Rewrite inventory systems
02  Hide random state
03  Trust unvalidated content
```

## `StoryTimeline` — DROPPED

Do not build it. Two reasons.

**It fails its own admission criterion.** The condition was "use only if it adds clarity without
repeating the origin prose". Its seven steps — *I miss Jones / Ask an LLM / Mechanics explained /
Implementation suggested / Reuse discovered / Determinism required / Engine appears* — are each
already narrated: the first four in the origin trigger, the last three across the realization and
resolution sections. It can only repeat the origin prose, so the condition is unsatisfiable.

**It is visually the same shape as the architecture diagram** — vertical stacked nodes joined by
arrows. Two of those on one page reads as the same component twice, which flattens the one element
that is supposed to be the page's single visual event. The cost is not just repetition; it is
dilution of the centerpiece.

## `DocumentationCta`

### Primary action

Read the architecture

### Secondary actions

- View documentation
- Browse GitHub

"Explore the concepts" is cut — it had no destination (`00-repository-reality.md` §3), and four CTAs
in one block was one too many regardless.

### Tone

> Still here?
>
> Good.
>
> Now it becomes considerably less philosophical.

## `LandingFooter`

Contains project identity and signature closing. The site owns its own footer — there is no framework
footer to avoid duplicating.

### The signature interaction

*"Well... why not?"* becoming *"Seriously. Why not?"* is **hover and focus on desktop only**, and that
limitation is deliberate rather than an oversight. Touch devices have no hover, and making a
decorative line focusable adds a tab stop that announces nothing useful to a screen-reader user — a
real accessibility cost for a joke.

If it should be available to everyone, make it a real `<button>` with an accessible name. Do not
leave it as a focusable non-control.

## `Reveal`

Never hide content behind a reveal that may not fire. Prefer a hook or data attribute that adds
enhancement classes on top of content that is already visible.

The rule: **a failed or absent reveal leaves content visible, never hidden.** An
`IntersectionObserver` that never fires — element already in view on load, observer error, bailed-out
effect — must degrade to readable content, not a blank section.

## Testing expectations

The project owns its own test runner (`00-repository-reality.md` §7), so these are achievable rather
than aspirational.

- render test for each major section
- architecture layers render as links with the correct hrefs, matching the route inventory
- reduced-motion behavior
- reveal safety — content present when the observer does not fire
- Open Graph tags present in the built HTML, not React-injected
- no horizontal overflow at 320px
