# Homepage Copy Draft

This is the recommended initial copy deck. It is not final until matched against the actual implemented architecture and repository terminology.

---

## Hero

### Eyebrow

SUBZERODEV GAME ENGINE

### Headline

Build mechanics once.  
Create infinite games.

### Pause line

...

### Signature

Well... why not?

### Scroll invitation

Scroll. It gets weirder.

### Optional navigation

Architecture · Documentation · GitHub

---

## Origin hook

I missed *Jones in the Fast Lane*.

So I asked an LLM how it worked.

That was a mistake.

---

## The answer

Jobs.

Needs.

Education.

Money.

Schedules.

Relationships.

Random events.

Then it started suggesting implementation details.

That was unfortunate.

---

## The question

Wait.

Why would I write this  
for one game?

---

## The change

That question changed everything.

A job system is not a game.

An inventory is not a game.

A relationship model is not a game.

They are mechanics.

And mechanics should be reusable.

---

## The problem

Game engines solved rendering.

They solved physics.

They solved input.

They solved networking.

Then we spent thirty years rewriting inventory systems.

That seemed... inefficient.

---

## The architecture transition

Build the rules once.

Replace the world.

```text
Core
  ↓
Kinds ─────┬──────────────┬──────────────┐
  ↓     story-graph    simulation    world-graph
Campaigns  Bulgaria     Life in the   Sun Trap
  ↓                     Fast Lane
Clients
```

Four layers, not five — there is no `Mechanics` layer, and the last one is `Clients`, not `Games`.
See `00-repository-reality.md` §1. Draw it as the fan-out above, not a vertical stack.

---

## The dragon statement

The engine doesn't know what a dragon is.

Or a detective.

Or a hotel.

Or a spaceship.

Or Bulgaria.

It knows:

State.

Commands.

Rules.

Time.

Consequences.

Everything else is remarkably specific data.

---

## Core philosophy

Games are data.

Gameplay is code.

Presentation observes the simulation.

It does not secretly become the simulation because someone needed a button to work before lunch.

---

## Human and AI interface

Humans submit commands.

AI submits commands.

The engine validates both.

Equality is important.

Especially when both are about to violate validation rules.

---

## Refusals

### Things this engine refuses to do

Rewrite the same inventory system.

Hide random state.

Mutate the world from arbitrary UI code.

Trust generated content because it sounded confident.

Pretend rendering is gameplay.

---

## Capabilities

### Things it happily does

Replay worlds.

Validate commands.

Run deterministic simulations.

Separate mechanics from fiction.

Support multiple presentations.

Accidentally become larger than originally intended.

---

## Origin story

This project did not begin with a grand vision.

It began because I missed *Jones in the Fast Lane*.

Mostly as a joke, I asked an LLM to explain how it worked.

It explained the jobs, education, needs, schedules, money, progression, relationships, movement, and random events.

Then it started suggesting implementation details.

At that point, the reasonable thing would have been to close the conversation and go to bed.

Instead, I thought:

> If I am already writing this, why would I write it for only one game?

The mechanics were reusable.

One question led to another.

If the mechanics were reusable, the simulation should not depend on the presentation.

If the simulation was separate, commands could be validated.

If commands were deterministic, worlds could be replayed.

If content was data, humans and AI could use the same engine interface.

A week later...

I had apparently started writing a game engine.

I still maintain this is entirely the LLM's fault.

It should have given a shorter answer.

---

## Documentation handoff

Still here?

Good.

Now it becomes considerably less philosophical.

### Buttons

Read the architecture  
View the documentation  
Browse the repository

---

## Footer

Started because someone asked an LLM the wrong question.

Built because nobody stopped asking better ones.

### Optional tiny footer line

No inventory systems were harmed during the making of this engine.

Probably.
