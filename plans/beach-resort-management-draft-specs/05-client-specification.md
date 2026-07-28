# Resort Management Simulation — Client Specification

**Document status:** Draft

---

## 1. Two Clients, Two Purposes

### Proving Client

A CLI or text client used to exercise every engine operation.

It is not the product.

### Visual Client

A 2D or isometric client used to make spatial management playable.

It is the first real product client.

---

## 2. Proving Client

Example commands:

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

The proving client must never calculate game rules.

It may:

- Parse commands.
- Call the engine.
- Render projections.
- Display validation errors.
- Save serialized state.

---

## 3. Visual Client Requirements

The first visual client should render:

- Terrain.
- Paths.
- Buildings.
- Construction previews.
- Guests.
- Staff.
- Queues.
- Incidents.
- Selection highlights.
- Objective progress.
- Financial status.
- Alerts.

---

## 4. Core Interaction

### Build Mode

- Select building.
- Rotate.
- Preview footprint.
- See placement errors.
- Confirm construction.
- Cancel.

### Inspect Mode

Select:

- Guest.
- Staff member.
- Building.
- Incident.
- Zone.

### Management Panels

- Build catalogue.
- Staff.
- Prices.
- Finances.
- Objectives.
- Alerts.
- Analytics.

---

## 5. Guest Inspector

Display:

- Current intent.
- Destination.
- Needs.
- Conditions.
- Satisfaction.
- Cash.
- Current opinions.
- Queue wait.
- Recent thoughts.

Example:

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

---

## 6. Building Inspector

Display:

- Status.
- Capacity.
- Queue.
- Service rate.
- Assigned staff.
- Prices.
- Sales.
- Revenue.
- Condition.
- Cleanliness.
- Alerts.

---

## 7. Overlays

Initial overlays:

- Guest demand.
- Cleanliness.
- Safety.
- Staff coverage.
- Building profitability.
- Queue pressure.
- Accessibility.

Later:

- Noise.
- Attractiveness.
- Sun exposure.
- Utilities.
- Congestion.

---

## 8. Presentation Technology

The exact framework is undecided.

The client should remain replaceable.

Possible implementation options:

- Web canvas.
- PixiJS.
- Phaser.
- Godot client consuming the engine API.
- Desktop wrapper around a web renderer.

The engine remains a TypeScript/Node-compatible pure library.

---

## 9. Rendering Model

Simulation and rendering are separate.

```text
engine ticks
→ immutable state snapshots or deltas
→ client interpolation
→ visual frame
```

The client may interpolate movement between ticks, but interpolation must never feed back into authoritative state.

---

## 10. Accessibility

Initial support should include:

- Pause.
- Speed control.
- Scalable UI.
- High-contrast overlays.
- Text alternatives for alerts.
- Keyboard navigation for management panels.
- Reduced-motion mode.

---

## 11. Client Acceptance Criteria

The visual client is sufficient when the player can:

1. Start a scenario.
2. Place a building.
3. Hire staff.
4. Set a price.
5. Advance time.
6. Inspect guests.
7. Inspect buildings.
8. Read alerts.
9. Track objectives.
10. Save and load.
11. Complete or fail the scenario.

No gameplay logic may exist in the client.
