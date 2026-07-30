# SubZeroDev Game Engine — Approved Homepage Copy

## Editorial status

This is the approved starting copy for implementation.

Repository evidence remains authoritative. Technical terms, layer names, capabilities, and destinations must be verified before the copy is treated as final.

Editorial changes should preserve the narrative, voice, pacing, and retained phrases unless repository accuracy requires a revision.

---

## Navigation

**Project label**

SubZeroDev Game Engine

**Links**

- Architecture
- Documentation
- GitHub

Use only verified destinations.

---

## Hero

**Eyebrow**

SUBZERODEV GAME ENGINE

**Headline**

Build mechanics once.  
Create infinite games.

**Pause**

...

**Signature**

Well... why not?

**Scroll invitation**

Scroll. It gets weirder.

---

## Origin trigger

I missed *Jones in the Fast Lane*.

So I asked an LLM how it worked.

That was a mistake.

Jobs.  
Education.  
Money.  
Needs.  
Schedules.  
Relationships.  
Random events.

Then it started suggesting implementation details.

That was unfortunate.

---

## The repeated-mechanics problem

### The problem was not rendering.

Game engines solved rendering.

They solved physics.  
Input.  
Audio.  
Networking.

And we kept rewriting inventory systems.

Then schedules.  
Economies.  
Progression.  
Relationships.  
Consequences.

That seemed... inefficient.

---

## The realization

### Wait.

Why would I write this  
for one game?

A job system is not a game.

An inventory is not a game.

A relationship model is not a game.

They are mechanics.

And mechanics should be reusable.

---

## Architecture

### Reuse the rules. Replace the world.

The following labels and relationships are provisional until confirmed against the repository.

**Deterministic Core**

Validates commands, advances time, and controls state transitions.

*establishes*

**Reusable Mechanics**

Inventory, economy, schedules, relationships, progression, and other reusable systems.

*composed as*

**Game Kinds**

Reusable arrangements of mechanics for families of games and simulations.

*configured by*

**Campaigns**

Characters, places, items, stories, worlds, and configured rules.

*presented as*

**Games**

The simulation does not depend on a renderer.

The renderer observes the simulation.

---

## What the engine understands

### The engine doesn't know what a dragon is.

Or a detective.

Or a hotel.

Or a spaceship.

Or Bulgaria.

It understands:

State.  
Commands.  
Rules.  
Time.  
Relationships.  
Resources.  
Consequences.

Everything else is remarkably specific data.

---

## Mechanics and content

### Games are data.

### Gameplay is code.

Characters, places, objects, stories, and worlds belong to the fiction.

Mechanics define what that fiction can do.

Change the world.

Keep the rules.

Or replace the rules too.

They were built to survive the first game.

---

## Command boundary

### Commands are the boundary.

Humans submit commands.

AI submits commands.

The engine validates both.

Neither receives permission to reach into the world and rearrange state directly.

Equality is important.

Especially when both are about to violate validation rules.

**Verification note:** If the human/AI command boundary is planned rather than implemented, revise this section so it describes an architectural principle rather than current behavior.

---

## Refusals

### Things this engine refuses to do

01 — Rewrite the same inventory system for every game.

02 — Hide randomness where nobody can reproduce it.

03 — Embed gameplay rules inside rendering code.

04 — Allow arbitrary state mutation.

05 — Trust generated content because it sounded confident.

06 — Confuse presentation with simulation.

---

## Capabilities

### Things it happily does

01 — Validate commands.

02 — Produce deterministic state transitions.

03 — Replay worlds.

04 — Separate mechanics from fiction.

05 — Operate independently from a single presentation.

06 — Become considerably larger than the original idea.

**Verification note:** Present only verified current capabilities as direct statements. Rephrase architectural contracts and remove unsupported items.

---

## Origin resolution

### This project did not begin with a grand vision.

It began because I missed *Jones in the Fast Lane*.

The reasonable response would have been to enjoy the explanation, close the conversation, and go to bed.

Instead, one question led to another.

If mechanics were reusable, the simulation should not depend on presentation.

If the simulation was separate, commands could be validated.

If commands were deterministic, worlds could be replayed.

If content was data, humans and AI could use the same engine interface.

A week later...

I had apparently started writing a game engine.

I still maintain this is entirely the LLM's fault.

It should have given a shorter answer.

---

## Documentation handoff

### Still here?

Good.

Now it becomes considerably less philosophical.

**Primary action**

Read the architecture

**Secondary actions**

- Explore the concepts
- View the documentation
- Browse the repository

Use only verified destinations.

---

## Footer

Started because someone asked an LLM the wrong question.

Built because nobody stopped asking better ones.

**Well... why not?**

**Optional tiny line**

No inventory systems were harmed during the making of this engine.

Probably.

