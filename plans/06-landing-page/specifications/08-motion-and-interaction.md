# Motion and Interaction

## Philosophy

Motion should support timing, hierarchy, and understanding.

Nothing should spin.

Nothing should bounce.

No particles should follow the cursor.

The page should feel confident enough not to beg for attention.

## Motion principles

- subtle
- slow enough to perceive
- fast enough not to obstruct
- triggered once where possible
- disabled or simplified for reduced-motion users
- meaningful rather than decorative

## Suggested timings

```css
--motion-fast: 140ms;
--motion-standard: 240ms;
--motion-slow: 480ms;
--motion-story: 700ms;
```

Use easing similar to:

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

## Entrance animation

Narrative lines may enter with:

- opacity from 0 to 1
- translateY from 12–24px to 0
- slight stagger between lines

Do not animate every paragraph.

## Hero timing

Possible sequence:

1. Product label visible immediately.
2. Headline fades in.
3. Ellipsis appears.
4. `Well... why not?` appears.
5. Scroll invitation appears last.

A failed or absent reveal must leave content **visible, never hidden**. Content is visible by
default; animation is added on top. An `IntersectionObserver` that never fires — an element already
in view on load, an observer error, a bailed-out effect — must degrade to fully readable content, not
to a blank section.

## Scroll reveals

Use `IntersectionObserver`.

Requirements:

- content is visible on mount, before any observer fires
- animation class added only after observation
- no scroll-jacking
- no pinned ten-screen cinematic sections
- no dependency on exact scroll position
- avoid layout shifts

## Architecture diagram interaction

Desktop:

- hover or focus highlights a layer
- description updates beside or beneath the diagram
- selected layer remains readable
- keyboard focus matches hover behavior

Mobile:

- tap a layer to expand its explanation
- no hover-only content
- diagram may stack vertically

## “Well... why not?” Easter egg

Optional interaction:

Default:

> Well... why not?

On hover/focus:

> Seriously. Why not?

This should be accessible and not required to understand the page.

## Command validation micro-demo

Future enhancement:

A compact deterministic command example:

```text
> move(entity: "player", destination: "office")

VALID

Time advanced: 15 minutes
Money changed: 0
Location changed: home → office
```

Then an invalid command:

```text
> buy(entity: "player", item: "sports-car")

REJECTED

Insufficient funds.
Reality remains inconvenient.
```

This should be a real demo only when backed by actual engine behavior. Do not fake technical capabilities.

## Reduced motion

When `prefers-reduced-motion: reduce`:

- remove transforms
- remove delayed sequences
- show all copy immediately
- preserve hover/focus state changes without animation
- disable animated diagrams
- never hide content waiting for intersection
