# Product Vision

## Working product identity

**Name:** SubZeroDev Game Engine  
**Primary line:** Build mechanics once. Create infinite games.  
**Signature line:** Well... why not?

## Core idea

The engine is not primarily a rendering engine. It is a deterministic simulation platform for reusable gameplay mechanics, world rules, commands, content, and state transitions.

Traditional game engines often solve:

- rendering
- physics
- audio
- input
- scene management
- networking

Yet developers repeatedly rewrite:

- inventory systems
- needs and schedules
- jobs and education
- quests
- progression
- relationships
- economies
- event systems
- consequences
- world simulation logic

The SubZeroDev Game Engine begins from the opposite direction:

> Gameplay mechanics should be reusable independently from any one game, theme, renderer, or genre.

## Product philosophy

The engine should understand mechanics, not fiction.

It should not need to know what a dragon is, what Bulgaria is, what a hotel is, or what a detective is.

It should understand:

- entities
- state
- commands
- validation
- deterministic outcomes
- events
- time progression
- relationships
- resource transfer
- conditions
- consequences
- replay

The fiction is data.

The mechanics are reusable code.

## The engine model

A useful conceptual hierarchy is:

```text
Core
  ↓
Mechanics
  ↓
Kinds
  ↓
Campaigns
  ↓
Games
```

Possible interpretation:

### Core

Deterministic execution, commands, state transitions, replay, serialization, validation, identifiers, time, events, and rule evaluation.

### Mechanics

Reusable gameplay systems such as inventory, economy, needs, jobs, education, relationships, movement, schedules, dialogue state, quests, or reputation.

### Kinds

Genre or game-family assemblies that combine mechanics into reusable patterns, such as:

- life simulation
- detective story
- management simulation
- survival game
- political simulation
- hotel management
- role-playing game

### Campaigns

Specific content, settings, worlds, characters, rules, maps, stories, and configured mechanics.

### Games

Actual playable products with rendering, user experience, art, sound, platform-specific integration, and presentation.

## Positioning

The landing page should not claim that the engine replaces Unity, Unreal, Godot, or other rendering-focused engines.

Instead, position it as:

- a deterministic gameplay and simulation layer
- a reusable mechanics platform
- a foundation for multiple games
- a system that can operate independently from presentation
- a safe interface for human-authored and AI-authored content
- a replayable command-driven simulation

## Target audiences

### Primary

Experienced software engineers, engine developers, simulation developers, tool builders, and technically curious game developers.

### Secondary

AI-assisted developers who understand that generated content requires validation and deterministic constraints.

### Tertiary

People attracted by the unusual origin story who may become interested in the architecture.

## Desired visitor reaction

The landing page should produce this sequence:

1. **Curiosity:** What the hell is this?
2. **Recognition:** Wait, this problem is real.
3. **Understanding:** Ah, mechanics are separate from presentation and fiction.
4. **Respect:** This is not merely a joke.
5. **Action:** I want to read the architecture, inspect the code, or try a demo.

## What the page must avoid

- “The future of gaming”
- “Revolutionary”
- “Next-generation”
- “Enterprise-grade” without proof
- fake user testimonials
- invented adoption numbers
- giant feature-card grids
- decorative 3D objects
- neon cyberpunk clichés
- particle effects
- generic AI gradients
- excessive icons
- startup language disconnected from the actual engine
