# Sun Trap — Client Specification

**Document status:** Draft

> **Scope**
> This game's visual client: what it renders and how it presents a spatial simulation.
>
> **The client *contract* is not here.** What a client may and may not do is engine-owned —
> [Clients](https://game-engine.subzerodev.com/docs/engine/clients). This document assumes
> that contract and adds only what is specific to rendering a resort.

---

## 1. The Contract, in One Line

A client is a **projection of the session store, never a participant.** It parses input,
calls the engine, renders projections and displays validation errors. It computes no game
rules.

The engine makes that testable rather than aspirational: two clients given the same seed,
the same id source and the same inputs must produce byte-identical serialized state. If a
client contributes anything beyond the order of the actions it submits, that test fails.

---

## 2. Two Clients, Two Purposes

**Proving client** — a CLI that exercises every engine operation. Not the product.

**Visual client** — a 2D or isometric client that makes spatial management playable. The
first real product client.

### 2.1 Proving Client

```text
new scenario-tutorial seed-ogre-001
build beach-bar 12 8
hire cleaner
assign cleaner-1 zone-beach
set-price beach-bar-1 cocktail 900
advance 60
inspect guest guest-104
inspect building beach-bar-1
finances
objectives
save tutorial-save
load tutorial-save
```

Each line maps one-to-one onto an engine action. `advance 60` is `advance_ticks` with
`{ ticks: 60 }`.

---

## 3. What the Visual Client Renders

Terrain, paths, buildings, construction previews, guests, staff, queues, incidents,
selection highlights, objective progress, financial status and alerts.

---

## 4. Core Interaction

**Build mode** — select building, rotate, preview footprint, see placement errors, confirm,
cancel.

> **The preview is an engine call.** Footprint validity comes from `previewAction`, which
> runs the real placement rules and discards the resulting state. A client that decides
> locally whether a tile is buildable has re-implemented the rules and will drift from them.

**Inspect mode** — select a guest, staff member, building, incident or zone.

**Management panels** — build catalogue, staff, prices, finances, objectives, alerts,
analytics.

> **The build catalogue comes from the projection, not from the action list.** The engine's
> available-action list carries verbs (`build`, `hire_staff`, …) with availability and a
> reason; *what* can be built, at what cost, and where, is projection data. Enumerating
> every building against every map cell as an action would be combinatorial.

---

## 5. Guest Inspector

Current intent, destination, needs, conditions, satisfaction, cash, opinions, queue wait,
recent thoughts.

```text
Guest 104

Intent: Find a drink
Destination: Beach Bar
Walking time: 2m 10s

Thirst: Critical
Cash: $22.00
Price opinion: Acceptable
Queue opinion: Becoming philosophical
```

**Per-candidate utility components are not shown by default.** They cross the projection
boundary only when the campaign enables a declared transparency mode.

---

## 6. Building Inspector

Status, capacity, queue, service rate, assigned staff, prices, sales, revenue, condition,
cleanliness, alerts.

---

## 7. Overlays

Initial: guest demand, cleanliness, safety, staff coverage, building profitability, queue
pressure, accessibility.

Later: noise, attractiveness, sun exposure, utilities, congestion.

---

## 8. Presentation Technology

Undecided, and the client should stay replaceable. Options: web canvas, PixiJS, Phaser, a
Godot client consuming the engine API, or a desktop wrapper around a web renderer.

The engine remains a pure TypeScript library that runs under Node.js with no DOM
dependency — the client choice cannot change that.

---

## 9. Rendering Model

```text
engine ticks → immutable snapshots or deltas → client interpolation → visual frame
```

The client may interpolate movement between ticks. **Interpolation must never feed back into
authoritative state.**

**Speed controls are presentation only.** Pause, 1×, 2×, 4× and maximum change how many
ticks the client requests and how often, never the result. The engine guarantees this: a
batch of ticks produces the same world as the same ticks taken singly, so a session played
at 4× and one played at 1× reach the same outcome.

---

## 10. Accessibility

Pause, speed control, scalable UI, high-contrast overlays, text alternatives for alerts,
keyboard navigation for management panels, reduced-motion mode.

---

## 11. Client Acceptance Criteria

The visual client is sufficient when the player can start a scenario, place a building, hire
staff, set a price, advance time, inspect guests, inspect buildings, read alerts, track
objectives, save and load, and complete or fail the scenario.

And when the engine's own client proof passes: the same scenario, seed and inputs driven
through the proving client and the visual client serialize identically.
