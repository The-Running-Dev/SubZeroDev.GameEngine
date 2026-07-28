# Resort Management Simulation — Vision

**Document status:** Draft  
**Project stage:** Concept and kind design  
**Working kind:** `management-simulation`  
**Working game title:** Undecided

> **Scope**
> Why this game should exist, what it should feel like, what makes it distinct, and what is deliberately out of scope.

---

## 1. Project Summary

The game is a satirical resort-management simulation in which the player builds, operates, and expands a holiday resort while managing guests, staff, facilities, money, queues, cleanliness, safety, entertainment, incidents, and scenario objectives.

Guests are autonomous agents. They arrive with money, preferences, physical needs, tolerances, and opinions. They choose where to go based on urgency, distance, queues, price, quality, safety, attractiveness, and personal preference.

The player does not directly control guests. The player changes the environment in which guests make decisions.

The core player actions are:

- Build facilities.
- Set prices.
- Hire and assign staff.
- Improve access and layout.
- Respond to incidents.
- Expand capacity.
- Manage costs.
- Satisfy objectives.
- Prevent the resort from collapsing under the weight of its own success.

The game should be mechanically legible and narratively absurd.

---

## 2. Architectural Position

This game is not:

- A story-graph campaign.
- A culture pack.
- A scenario inside the existing weekly life-simulation kind.
- A UI layer over *Life in the Fast Lane*.

It requires a third kind:

```text
Narrative Engine Substrate
├── story-graph
├── simulation
└── management-simulation
```

The existing substrate is reused for:

- Determinism.
- Seeded randomness.
- Canonical serialization.
- Save/load.
- Migration.
- Content loading.
- Content validation.
- Localization.
- Projection.
- Achievements.
- Scenario conditions.
- Replay.
- Testing.
- API and MCP boundaries.

The new kind owns:

- Spatial maps.
- Simulation ticks.
- Guest agents.
- Staff agents.
- Buildings.
- Queues.
- Pathfinding.
- Construction.
- Services.
- Resort economy.
- Incidents.
- Objectives.

---

## 3. Product Vision

The player fantasy is:

> Build a functioning holiday paradise, then discover that people, alcohol, plumbing, weather, queues, staffing, and basic geometry have formed an alliance against you.

The experience should combine:

- Sandbox construction.
- Scenario-based objectives.
- Autonomous guest simulation.
- Staff logistics.
- Pricing decisions.
- Capacity management.
- Operational failures.
- Gradual escalation.
- Deadpan comedy.
- High replayability.

The player should be able to inspect why the resort behaves as it does.

Examples:

- A bar is profitable because it is close to the beach and has short queues.
- A nightclub is failing because guests cannot reach it.
- Toilets are overloaded because the player built three bars and one bathroom.
- Cleanliness is collapsing because cleaners spend all day walking.
- Security is overwhelmed because pricing encouraged excessive drinking.
- Guests leave because the resort is expensive, dirty, unsafe, repetitive, or impossible to navigate.

---

## 4. Design Principles

### 4.1 The Player Controls Systems, Not People

Guests and staff are autonomous.

The player influences them through:

- Placement.
- Pricing.
- Capacity.
- Staffing.
- Policies.
- Routes.
- Availability.
- Quality.
- Environment.

### 4.2 Spatial Decisions Must Matter

Location is a game mechanic.

A facility's performance depends on:

- Accessibility.
- Distance from demand.
- Nearby competition.
- Nearby complementary services.
- Queue space.
- Staff access.
- Terrain.
- Congestion.

### 4.3 Transparent Consequences

The player should be able to understand:

- Why a guest chose a facility.
- Why a guest left.
- Why a building is idle.
- Why a queue formed.
- Why staff are ineffective.
- Why revenue changed.
- Why an incident occurred.
- Why an objective progressed or failed.

Hidden values may exist, but the game should not feel dishonest.

### 4.4 Deterministic Simulation

Given the same:

- Seed.
- Engine version.
- Content versions.
- Scenario.
- Commands.
- Tick count.

The engine must produce the same mechanical result.

### 4.5 Controlled Absurdity

The simulation rules remain coherent.

The content may include:

- Financially sophisticated seagulls.
- Security staff negotiating with inflatable animals.
- A nightclub that causes regional plumbing instability.
- Guests who reject a free toilet because its ambience is insufficient.
- A resort inspector who arrives during a fire and asks about signage.

### 4.6 Simulation Before Presentation

The headless engine must work before investing in polished graphics.

The first proof is:

```text
build → advance ticks → inspect agents → verify outcomes
```

---

## 5. Initial Game Modes

### Scenario Mode

Authored maps, starting conditions, restrictions, objectives, and failure conditions.

### Sandbox Mode

Open-ended construction with configurable money and unlocks.

### Challenge Mode

Focused operational problems, such as:

- Survive a storm weekend.
- Operate with limited staff.
- Reach a profit target on a tiny map.
- Manage a party resort without exceeding an incident threshold.
- Recover a failing resort.

---

## 6. Non-Goals for the Initial Version

The initial version does not need:

- Full 3D rendering.
- Multiplayer.
- User-generated building models.
- Complex weather simulation.
- Real-world brands.
- Real-time online services.
- Procedural islands.
- Vehicle simulation.
- Staff unions.
- Detailed legal systems.
- Full hotel-room simulation.
- Hundreds of guests on day one.
- Mod marketplace.
- Hosted NEaaS integration.

---

## 7. Success Criteria

The concept is proven when:

- Guests make understandable autonomous decisions.
- Building placement changes outcomes.
- Queues and staff matter.
- Prices matter.
- The resort can succeed or fail.
- A scenario can be completed.
- A save can be replayed deterministically.
- The same engine can be driven by a proving client and a visual client.
