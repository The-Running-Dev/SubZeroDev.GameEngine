# Resort Management Simulation — Roadmap, Risks, and Open Questions

**Document status:** Draft

---

## 1. Proposed Development Phases

### Phase 0 — Confirm the Kind Boundary

- Approve `management-simulation` as the kind.
- Decide whether the first game is a resort campaign within it.
- Define package ownership between substrate and kind.
- Freeze the first command and state contracts.

### Phase 1 — Headless Kernel

- Tick clock.
- Map state.
- Commands.
- Deterministic IDs.
- Guest spawn.
- Guest needs.
- One building.
- Revenue.
- Save/load.
- Replay.

### Phase 2 — Spatial Mechanics

- Placement.
- Entrances.
- Pathfinding.
- Movement.
- Queueing.
- Unreachable-state handling.
- Map revision and cache invalidation.

### Phase 3 — Staff

- Cleaner.
- Mechanic.
- Security.
- Builder.
- Task generation.
- Task assignment.
- Zones.
- Wages.

### Phase 4 — Resort Operations

- Multiple building categories.
- Prices.
- Product definitions.
- Cleanliness.
- Wear.
- Maintenance.
- Incidents.
- Objectives.
- Bankruptcy.

### Phase 5 — First Visual Client

- 2D map.
- Build mode.
- Selection.
- Guest inspector.
- Building inspector.
- Staff panel.
- Overlays.
- Alerts.
- Save/load UI.

### Phase 6 — Content Depth

- Guest archetypes.
- Nightlife.
- Alcohol.
- Toilets.
- Medical.
- Weather.
- Security.
- Larger scenarios.
- Campaign progression.
- Narrative voice.

### Phase 7 — Platform Integration

- Unified API.
- MCP surface.
- Content packs.
- Culture/theme packs.
- Additional management campaigns.

---

## 2. Largest Technical Risks

### 2.1 Pathfinding Cost

Hundreds of guests repeatedly recomputing paths can dominate runtime.

Mitigations:

- Cache by map revision.
- Reuse distance fields.
- Stagger decisions.
- Limit candidate destinations.
- Repath only when necessary.
- Profile before adding complexity.

### 2.2 Agent Decision Cost

Scoring every building for every guest every tick is too expensive.

Mitigations:

- Decision intervals.
- Spatial indexes.
- Category-first selection.
- Candidate caps.
- Need thresholds.
- Cached attractiveness.

### 2.3 Cascading Simulation Failures

Small problems can create irreversible collapse:

```text
long queues
→ unmet needs
→ incidents
→ staff overload
→ dirt and breakdowns
→ more dissatisfaction
→ revenue loss
→ inability to hire
```

This may be good gameplay, but must remain recoverable.

### 2.4 Deterministic Spatial Tie-Breaking

Pathfinding, queues, staff tasks, and utility scoring can diverge if ties depend on collection order.

Every tie requires an explicit stable rule.

### 2.5 Content Balance

The engine may work while the game remains boring or trivial.

Simulation harnesses should search for:

- Dominant layouts.
- Dominant pricing.
- Useless buildings.
- Permanent bottlenecks.
- Unavoidable bankruptcy.
- Infinite-profit loops.

### 2.6 Client Scope

A polished visual client can consume the entire project before the simulation is proven.

Keep the proving client first.

---

## 3. Product Risks

### 3.1 Becoming a Clone

The design must stay inspired by the genre, not reproduce proprietary expression.

Use original:

- Identity.
- Art.
- Writing.
- Scenarios.
- Building names.
- Maps.
- Balance.
- UI.

### 3.2 Kind Proliferation

A kind should exist only when the turn model and authoritative state are genuinely different.

Do not add a new kind for every theme.

### 3.3 Universal DSL Pressure

Avoid trying to move guest AI, pathfinding, or construction into a generic substrate DSL.

Kind logic is reviewed code.

Campaign logic is validated data.

### 3.4 Premature Platform Work

Do not add hosting, billing, accounts, analytics, or a mod marketplace before the headless simulation is proven.

---

## 4. Open Questions

### Architecture

- Final kind name: `management-simulation` or `resort-management`?
- Does the session store live outside the engine from day one?
- Are commands event-sourced, or is the command log initially diagnostic only?
- How much of the existing generic `Condition` system should be reused?

### Time

- Tick duration?
- Fixed-step batching rules?
- Maximum ticks per engine call?
- Should financial reports close hourly or daily?

### Guests

- How often do guests reconsider intent?
- Do they know every building or only discovered/visible ones?
- Are preferences fixed or partially randomized?
- When do guests abandon queues?
- Do groups ship in v1 or later?

### Buildings

- Immediate construction for MVP?
- Is product inventory modeled initially?
- Are utilities required?
- How are entrances authored?
- Can buildings rotate freely?

### Staff

- Automatic global dispatch or zones first?
- Do shifts exist initially?
- Are service workers explicit agents or part of building capacity?
- Do staff have needs?

### Economy

- How elastic is demand to price?
- Are wages charged continuously or daily?
- Is bankruptcy immediate?
- Are loans included before the first campaign?

### Incidents

- Which incidents are emergent?
- Which incidents are authored events?
- Which require player choices?
- Can incidents chain?

### Client

- PixiJS, Phaser, Godot, or another renderer?
- Grid view or isometric?
- Full local engine in client, or engine process with API boundary?
- State snapshots or deltas?

### Content

- How are content packs merged?
- How are IDs named?
- What is the first original game title?
- What is the first resort theme?
- What narrative tone differentiates it from its inspiration?

---

## 5. Recommended Immediate Next Step

Do not begin with the full game.

Build one deterministic experiment:

```text
small map
+ one guest
+ one drink stand
+ one path
+ one purchase
```

Then expand to:

```text
many guests
+ queue
+ toilet
+ litter
+ cleaner
+ objective
```

That vertical slice will reveal whether the core is enjoyable and whether the existing substrate actually supports a spatial management kind without distortion.
