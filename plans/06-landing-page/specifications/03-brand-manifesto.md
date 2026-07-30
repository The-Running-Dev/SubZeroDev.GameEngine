# Brand Manifesto

## Declaration

We are not building another rendering engine because the world is clearly suffering from a shortage of those.

We are building the part that keeps getting rewritten.

The inventory.

The schedule.

The economy.

The consequences.

The systems that decide what happens after a player, an NPC, an AI agent, or an unpaid intern attempts something inadvisable.

The engine does not care whether an entity is a dragon, a hotel manager, a detective, a politician, a spaceship, or a Bulgarian with poor impulse control.

It cares whether the command is valid.

It cares whether the outcome is deterministic.

It cares whether the world can be replayed, inspected, tested, and understood.

Everything else is content.

## Principles

### Build mechanics once

A mechanic should not be trapped inside one game unless it is genuinely unique to that game.

### Separate fiction from rules

“Dragon” is content.  
“Can possess inventory” is a capability.  
“Consumes a resource” is a mechanic.  
“Sets nearby villages on fire” is probably a command.

### Determinism first

Given the same initial state and the same commands, the engine should produce the same outcome.

This enables:

- replay
- testing
- debugging
- simulation
- synchronization
- auditing
- AI validation
- reproducible worlds

### Commands are the interface

Humans and AI submit the same commands.

Neither receives magical permission to mutate state directly.

Equality is important, especially when both are about to violate validation rules.

### Presentation is replaceable

The simulation should not depend on a particular renderer, UI framework, camera, or platform.

A world may be rendered as:

- a 3D game
- a 2D game
- a web interface
- a text interface
- a headless simulation
- a test suite
- a replay viewer

### Content is constrained, not trusted

Human-authored and AI-authored content should be validated against the same engine rules.

The engine should not “believe” content.

It should parse it, validate it, and reject nonsense politely.

Or at least deterministically.

### Serious architecture, unserious origin

The project may be funny.

The architecture should not be.

## What will not change

- deterministic state transitions
- command-driven interaction
- clear separation between engine, mechanics, content, and presentation
- reusable systems
- validation before mutation
- replayability
- testability
- renderer independence

## What this is not

- a promise to support every game genre
- an excuse to abstract everything
- a replacement for every existing engine
- a no-code game creator
- an AI that invents game logic without constraints
- a giant framework built only to admire itself

## Final statement

This engine exists because writing the same gameplay systems repeatedly seemed inefficient.

Apparently that seemed reasonable.

Well... why not?
