# Sun Trap — Vision

**Document status:** Draft
**Working title:** Sun Trap

> **Scope**
> Why this game should exist, what it should feel like, what makes it distinct, and what is
> deliberately out of scope.

---

## 1. Project Summary

A satirical resort-management simulation in which the player builds, operates and expands a
holiday resort while managing guests, staff, facilities, money, queues, cleanliness, safety,
entertainment, incidents and scenario objectives.

Guests are autonomous agents. They arrive with money, preferences, physical needs,
tolerances and opinions. They choose where to go based on urgency, distance, queues, price,
quality, safety, attractiveness and personal preference.

The player does not control guests. The player changes the environment in which guests make
decisions.

The core player actions are to build facilities, set prices, hire and assign staff, improve
access and layout, respond to incidents, expand capacity, manage costs, satisfy objectives,
and prevent the resort from collapsing under the weight of its own success.

The game should be mechanically legible and narratively absurd.

---

## 2. Architectural Position

This game runs on the **`world-graph` kind** in the Game Engine. The kind already
exists as a contract; this repository supplies content, design and a client.

```text
Game Engine substrate
├── story-graph
├── simulation                 → Life in the Fast Lane (SubZeroDev.GameOfLife)
└── world-graph      → Sun Trap (this repository)
```

**Why it needed a new kind, stated correctly.** The engine's test
([architecture §1a](https://game-engine.subzerodev.com/docs/engine/architecture)) is that a
kind exists only when its resolution cannot be expressed as validated data over an existing
kind. Spatial maps, hundreds of agents and queues are *state*, and state richness never
qualifies — the core does not read game state. What qualifies is **code the content tier
cannot carry**: A\* pathfinding and guest utility scoring. A data-driven switch over those
would be a rules DSL, which the engine rejects on principle.

**The consequence is the good news.** One kind covers the genre. A mountain hotel, theme
park, nightclub district, festival ground or corporate retreat centre is a **campaign** of
`world-graph`, not another kind — no engine change, no release. Sun Trap is the
first campaign family, not the only possible one.

**What this game does not get to decide.** Determinism rules, the action list, state
boundaries, reason codes, event names and the meaning of win and loss are fixed by the kind
contract. See the table in [`README.md`](README.md).

---

## 3. Product Vision

The player fantasy:

> Build a functioning holiday paradise, then discover that people, alcohol, plumbing,
> weather, queues, staffing and basic geometry have formed an alliance against you.

The experience combines sandbox construction, scenario objectives, autonomous guest
simulation, staff logistics, pricing decisions, capacity management, operational failures,
gradual escalation, deadpan comedy and high replayability.

**The player must be able to inspect why the resort behaves as it does.** For example:

- A bar is profitable because it is close to the beach and has short queues.
- A nightclub is failing because guests cannot reach it.
- Toilets are overloaded because the player built three bars and one bathroom.
- Cleanliness is collapsing because cleaners spend all day walking.
- Security is overwhelmed because pricing encouraged excessive drinking.
- Guests leave because the resort is expensive, dirty, unsafe, repetitive or impossible to
  navigate.

The engine supports this directly: the kind emits a `guest.path.failed` event precisely
because "guests cannot reach it" and "guests do not want it" look identical otherwise.

---

## 4. Design Principles

### 4.1 The Player Controls Systems, Not People

Guests and staff are autonomous. The player influences them through placement, pricing,
capacity, staffing, policies, routes, availability, quality and environment.

### 4.2 Spatial Decisions Must Matter

Location is a mechanic. A facility's performance depends on accessibility, distance from
demand, nearby competition, nearby complementary services, queue space, staff access,
terrain and congestion.

### 4.3 Transparent Consequences

The player should be able to understand why a guest chose a facility, why a guest left, why
a building is idle, why a queue formed, why staff are ineffective, why revenue changed, why
an incident occurred, and why an objective progressed or failed.

Hidden values may exist, but the game must not feel dishonest. Per-candidate utility
components are available only under a declared transparency mode — the kind contract makes
that a projection rule, not a client courtesy.

### 4.4 Deterministic Simulation

Given the same seed, engine version, content versions, scenario, commands and tick count,
the result is identical. This is the engine's guarantee, not this game's — but this game can
break it by putting floating-point arithmetic in a formula, so all balance values are
integers or fixed-point.

**Presentation speed never changes results.** Pause, 1×, 2×, 4× and maximum are display
concerns. The engine guarantees this structurally through batch invariance.

### 4.5 Controlled Absurdity

The simulation rules stay coherent; the content need not. Financially sophisticated
seagulls. Security staff negotiating with inflatable animals. A nightclub that causes
regional plumbing instability. Guests who reject a free toilet because its ambience is
insufficient. A resort inspector who arrives during a fire and asks about signage.

### 4.6 Simulation Before Presentation

The headless engine must work before any investment in graphics. The first proof is:

```text
build → advance ticks → inspect agents → verify outcomes
```

---

## 5. Initial Game Modes

**Scenario** — authored maps, starting conditions, restrictions, objectives and failure
conditions.

**Sandbox** — open-ended construction with configurable money and unlocks.

**Challenge** — focused operational problems: survive a storm weekend, operate with limited
staff, reach a profit target on a tiny map, run a party resort without exceeding an incident
threshold, recover a failing resort.

---

## 6. Non-Goals for the Initial Version

Full 3D rendering, multiplayer, user-generated building models, complex weather, real-world
brands, real-time online services, procedural islands, vehicle simulation, staff unions,
detailed legal systems, full hotel-room simulation, hundreds of guests on day one, a mod
marketplace, and hosted service integration.

---

## 7. Success Criteria

The concept is proven when guests make understandable autonomous decisions, building
placement changes outcomes, queues and staff matter, prices matter, the resort can succeed
or fail, a scenario can be completed, a save replays deterministically, and the same engine
can be driven by a proving client and a visual client.
