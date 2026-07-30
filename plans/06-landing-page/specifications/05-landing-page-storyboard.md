# Landing Page Storyboard

## Overall model

The landing page is a single standalone React page designed as a scrolling narrative, living under
`site/` and separate from the documentation site.

It should feel like an interactive essay, not a collection of product cards.

The page flow:

```text
Hero
  ↓
Origin hook
  ↓
The problem
  ↓
The realization
  ↓
The architecture
  ↓
What the engine knows
  ↓
What it refuses to do
  ↓
What it happily does
  ↓
Origin story
  ↓
Documentation and GitHub
  ↓
Footer
```

## Section 1 — Hero

### Goal

Create curiosity before explanation.

### Content

```text
SUBZERODEV GAME ENGINE

Build mechanics once.
Create infinite games.

...

Well... why not?

Scroll. It gets weirder.
```

### Layout

- full viewport or near-full viewport
- centered or slightly left-aligned
- no illustration
- large typography
- generous whitespace
- one subtle scroll indicator
- primary CTA may be absent above the fold
- optional small links: Docs, Architecture, GitHub

### Interaction

After a brief delay, the ellipsis may fade into:

> Scroll. It gets weirder.

Respect reduced-motion preferences.

## Section 2 — The origin hook

### Content

```text
I missed Jones in the Fast Lane.

So I asked an LLM how it worked.

That was a mistake.
```

### Visual

Large statements appearing one at a time while scrolling.

Optional chat-style fragments:

```text
How does Jones in the Fast Lane work?

Jobs.
Needs.
Education.
Money.
Time.
Random events.

Implementation idea...
```

The chat UI must be abstract and elegant, not an imitation of ChatGPT branding.

## Section 3 — The problem

### Heading

> The problem was not rendering.

### Copy

```text
Game engines solved rendering.
They solved physics.
They solved input.
They solved networking.

Then we spent thirty years rewriting inventory systems.
```

Final line:

> That seemed... inefficient.

### Visual

A sparse list where the solved engine concerns remain static and “inventory systems” repeats subtly in different forms.

## Section 4 — The realization

### Copy

```text
Wait.

Why would I write this
for one game?
```

Followed by:

```text
That question changed everything.
```

### Visual

Transition from a single box labeled `Game` into a hierarchy:

```text
Mechanics
  ↓
Kinds
  ↓
Campaigns
  ↓
Games
```

## Section 5 — Architecture

### Heading

> Reuse the rules. Replace the world.

### Diagram

Four layers, fixed by `00-repository-reality.md` §1. The five-layer version this section used to draw
described a model that does not exist.

```text
Core
  ↓
Kinds ─────┬──────────────┬──────────────┐
  ↓     story-graph    simulation    world-graph
Campaigns  Bulgaria     Life in the   Sun Trap
  ↓                     Fast Lane
Clients
```

**Fan out, do not stack.** Four nodes in a vertical line cannot carry the widest canvas on the page.
The branch fills it and demonstrates the thesis instead of asserting it.

Each layer name is a **link** to its spec, not a click target that reveals a panel — every summary is
visible already, so revealing it adds nothing. Hover and focus highlighting is CSS only.

### Core copy

> The simulation does not depend on a renderer.
>
> The renderer observes the simulation.

## Section 6 — What the engine knows

### Main statement

> The engine doesn't know what a dragon is.

Then progressively:

- Or a detective.
- Or a hotel.
- Or a spaceship.
- Or Bulgaria.

Final statement:

> It knows state, commands, rules, time, and consequences.

## Section 7 — Games are data

### Main quote

> Games are data.
>
> Gameplay is code.

Supporting explanation:

> Characters, places, items, stories, and worlds are content.
>
> Mechanics define what that content can do.

## Section 8 — Refusals

### Heading

> Things this engine refuses to do

- Rewrite the same inventory system again.
- Hide random state.
- Embed gameplay rules in rendering code.
- Allow arbitrary state mutation.
- Trust generated content without validation.
- Pretend “works on my machine” is a deployment strategy.

## Section 9 — Capabilities

### Heading

> Things it happily does

- Replay worlds.
- Validate commands.
- Run deterministic simulations.
- Separate content from mechanics.
- Accept commands from humans and AI through the same interface.
- Accidentally scale beyond the original idea.

## Section 10 — Origin story

Use a readable editorial layout with no cards.

Full recommended story appears in `02-origin-story.md` and `06-homepage-copy.md`.

The section should end:

```text
A week later...

I had apparently started writing a game engine.

...

Well... why not?
```

## Section 11 — Documentation handoff

### Heading

> Still here?

### Copy

> Good. Now it becomes considerably less philosophical.

### CTAs

- Read the architecture
- View the documentation
- Browse the repository

Primary CTA should be `Read the architecture`. "Explore the concepts" is cut — it had no destination,
and four CTAs in one block was one too many. Destinations are the absolute cross-site URLs in
`00-repository-reality.md` §3.

## Section 12 — Footer

Recommended:

```text
Started because someone asked an LLM the wrong question.

Built because nobody stopped asking better ones.
```

Alternate legal/footer note:

> No inventory systems were harmed during the making of this engine. Probably.
