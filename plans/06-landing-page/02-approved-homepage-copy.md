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

Scroll. It escalates.

*(Was "Scroll. It gets weirder." The page does not get weirder — it gets more serious, deliberately,
which is one of its better decisions. "Escalates" is truthful, keeps the deadpan, and reuses an
approved recurring line.)*

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

Labels and relationships are fixed by `00-repository-reality.md` §1. The five-layer version this
section used to carry — with a `Reusable Mechanics` layer and `Games` at the bottom — described a
model that does not exist.

**Core**

Deterministic state, seeded randomness, save and replay, validation. One API.

*inherited by*

**Kinds**

Reviewed engine mechanics. Three of them: story graphs, simulations, world graphs.

*plus content*

**Campaigns**

Characters, places, items, stories, worlds. A Kind plus the data that makes it a game.

*presented by*

**Clients**

Web. Command line. Discord. An AI agent. The simulation does not depend on any of them.

Mechanics live inside Kinds — there is no separate mechanics layer. Kinds define mechanics. Campaigns
define worlds. Clients simply present them.

A Client observes the simulation. It never participates in it.

*Render this as a fan-out: the spine on the left, and Kinds branching to `story-graph`, `simulation`
and `world-graph` with their flagship campaigns. Each layer name is a link to its spec. See*
`specifications/07-visual-design-system.md`.

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

Neither gets permission to reach into the world and rearrange state directly.

Equality is important.

Especially when both are about to violate validation rules.

**Verification note — ANSWERED.** The command boundary is an **architectural contract**, not current
behavior: `validation/` is types only and `advance(state, action)` is not written yet
(`00-repository-reality.md` §2). This section is written in the present tense as a statement of
design, which is legitimate — but it must not be surrounded by copy implying a running system, and it
must never claim the validation has been *observed* to work.

---

## Refusals

### Things this engine refuses to do

01 — Hide randomness where nobody can reproduce it.

02 — Embed gameplay rules inside rendering code.

03 — Allow arbitrary state mutation.

04 — Trust generated content because it sounded confident.

*(Four, down from six. "Rewrite the same inventory system for every game" is cut — the hero, the
problem section and the realization have each already said it. "Confuse presentation with simulation"
is cut as a near-duplicate of 02.)*

---

## Capabilities

### Things it happily does

01 — Produce randomness you can reproduce from a seed.

02 — Serialize a world to bytes, identically, every time.

03 — Separate mechanics from fiction.

04 — Become considerably larger than the original idea.

**Verification note — ANSWERED.** Rewritten against the capability matrix in
`00-repository-reality.md` §2, which is the authority for what may be claimed.

Removed, because they are **contracts or plans**, not behavior:

- *"Validate commands"* — `validation/` is types only.
- *"Produce deterministic state transitions"* — the RNG and canonical serialization exist; the
  transition function does not. Items 01 and 02 above claim exactly the parts that are real.
- *"Replay worlds"* — post-MVP, not implemented.
- *"Operate independently from a single presentation"* — a contract; no client exists yet.

Items 01–03 are implemented or genuinely architectural. Item 04 is a joke and stays.

Re-check this list whenever a work item lands — the matrix is a snapshot, and the first thing
`advance(state, action)` does is make three of the removed lines true.

---

## Origin resolution

### This project did not begin with a grand vision.

It began because I missed *Jones in the Fast Lane*.

The reasonable response would have been to enjoy the explanation, close the conversation, and go to bed.

Instead, one question led to another.

*(Four "If X, then Y" lines were cut here. They restated the architecture, operating-contract and
abstraction sections the reader has just finished — the repetition the trigger/resolution split
exists to avoid. The resolution's job is the turn and the punchline, not a recap.)*

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

- View the documentation
- Browse the repository

*("Explore the concepts" is cut — it had no destination, and four CTAs in one block was one too
many.)*

Destinations are the absolute cross-site URLs in `00-repository-reality.md` §3. The landing page is a
separate site, so `/docs/...` is a link to another origin, not a path it can resolve.

---

## Footer

Started because someone asked an LLM the wrong question.

Built because nobody stopped asking better ones.

**Well... why not?**

**Optional tiny line**

No inventory systems were harmed during the making of this engine.

Probably.

