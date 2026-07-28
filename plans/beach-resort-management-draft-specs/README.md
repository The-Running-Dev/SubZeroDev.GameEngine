# Resort Management Simulation — Draft Specification Set

**Status:** Draft  
**Origin:** Expansion of the Narrative Engine discussion around recreating the gameplay category of *Beach Life* as an original game.  
**Important:** This is not a specification for copying *Beach Life*. It defines an original resort-management game inspired by the same broad management-simulation genre.

## Document Set

1. [`01-vision.md`](01-vision.md) — product vision, player fantasy, principles, non-goals.
2. [`02-kind-architecture.md`](02-kind-architecture.md) — how the new game fits into the existing Narrative Engine as a third kind.
3. [`03-game-design.md`](03-game-design.md) — gameplay loop, guests, buildings, staff, economy, incidents, objectives.
4. [`04-engine-specification.md`](04-engine-specification.md) — deterministic simulation model, state, systems, commands, data types.
5. [`05-client-specification.md`](05-client-specification.md) — proving client and first visual client.
6. [`06-mvp.md`](06-mvp.md) — smallest playable slice and definition of done.
7. [`07-roadmap-risks-and-open-questions.md`](07-roadmap-risks-and-open-questions.md) — phases, technical risks, unresolved design choices.

## Architectural Position

```text
Narrative Engine Substrate
├── story-graph
├── simulation
└── management-simulation
```

The new kind should be called **`management-simulation`** unless implementation proves that a narrower **`resort-management`** boundary is preferable.

The substrate remains responsible for shared deterministic infrastructure. The kind owns spatial simulation, autonomous guests, staff, buildings, queues, construction, resort finances, and scenario progression.

## Central Rule

> Reuse the deterministic substrate. Do not force spatial management gameplay into the weekly personal-life simulation kind.

## Legal and Creative Boundary

The project may recreate the broad mechanics and genre conventions of a resort-management simulation, but should use:

- Original code.
- Original title.
- Original maps.
- Original artwork.
- Original audio.
- Original writing.
- Original buildings and scenarios.
- Original balance and progression.

No original assets, maps, text, branding, or proprietary content from *Beach Life* should be included.
