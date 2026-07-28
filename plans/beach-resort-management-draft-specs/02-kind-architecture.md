# Management-Simulation Kind — Architecture

**Document status:** Draft  
**Kind:** `management-simulation`

> **Scope**
> How the new kind fits into the existing Narrative Engine substrate and where the boundaries belong.

---

## 1. Three-Layer Model

```text
Clients
  web · desktop · test CLI · MCP
              │
              ▼
Kind
  management-simulation
              │
              ▼
Substrate
  deterministic RNG · serialization · projections · validation
  content registry · save/migration · localization · sessions
```

A campaign is:

```text
kind identifier + validated content + scenario data
```

A new resort, island, theme, or scenario should not require engine changes.

---

## 2. Why This Is a New Kind

The existing `simulation` kind models a person allocating a weekly time budget.

The management simulation models:

- Continuous or stepped world time.
- Spatial maps.
- Hundreds of autonomous entities.
- Buildings with service rates and capacities.
- Navigation.
- Queues.
- Staff work allocation.
- Construction.
- Continuous income and expenses.

Trying to represent this through weekly personal actions would remove the central gameplay.

---

## 3. Recommended Boundary

Use `management-simulation` as the kind name.

Reasons:

- The mechanics generalize beyond resorts.
- The same code could support hotels, parks, clubs, restaurants, malls, festivals, or holiday camps.
- `resort-management` can remain the flagship campaign family.

Potential future campaigns:

```text
management-simulation
├── tropical-resort
├── mountain-hotel
├── nightclub-district
├── festival-ground
├── theme-park
└── corporate-retreat-center
```

---

## 4. Substrate Responsibilities

The shared substrate owns:

- Seed creation and named RNG streams.
- Canonical serialization.
- Save envelopes.
- Migration pipeline.
- Content pack manifests.
- Registry assembly.
- Localization.
- Typed validation results.
- Reason codes.
- Projection framework.
- Session abstraction.
- Replay harness.
- Achievements.
- Generic condition evaluation where applicable.

The substrate must not know what a bar, guest, cleaner, queue, or resort is.

---

## 5. Kind Responsibilities

The kind owns:

- Resort map state.
- Tick processing.
- Agent lifecycle.
- Guest utility scoring.
- Staff task assignment.
- Building operation.
- Construction.
- Queue management.
- Pathfinding.
- Incidents.
- Resort economy.
- Scenario objectives.
- Failure evaluation.
- Resort-specific projections.

---

## 6. Determinism Contract

The kind is deterministic over:

```text
initial state
+ content versions
+ seed
+ ordered player commands
+ tick count
= identical state
```

Rules:

- No `Math.random`.
- No wall-clock time in resolution.
- Stable iteration order.
- Stable pathfinding tie-breaking.
- Stable utility-score tie-breaking.
- Stable queue ordering.
- Stable staff-task ordering.
- All generated IDs are deterministic.
- All random systems use isolated named streams.

Suggested streams:

```typescript
type ResortStreamId =
  | { kind: "guest_spawn"; tick: number }
  | { kind: "guest_decision"; guestId: string; decisionIndex: number }
  | { kind: "incident"; tick: number }
  | { kind: "weather"; day: number }
  | { kind: "staff"; staffId: string; taskIndex: number }
  | { kind: "scenario"; objectiveId: string; tick: number };
```

---

## 7. Tick Model

The engine should use fixed simulation ticks.

Suggested draft:

```text
1 tick = 10 simulated seconds
6 ticks = 1 simulated minute
360 ticks = 1 simulated hour
```

The exact duration is provisional.

A client may run ticks at different presentation speeds:

- Paused.
- 1×.
- 2×.
- 4×.
- Maximum simulation speed.

Presentation speed must not affect results.

---

## 8. Command Model

Commands express player intent.

Examples:

```typescript
type ResortCommand =
  | BuildCommand
  | DemolishCommand
  | HireStaffCommand
  | FireStaffCommand
  | AssignStaffCommand
  | SetPriceCommand
  | SetPolicyCommand
  | OpenBuildingCommand
  | CloseBuildingCommand
  | TakeLoanCommand
  | RepayLoanCommand
  | AdvanceTicksCommand;
```

The engine:

1. Validates the command.
2. Applies it atomically.
3. Emits audit records.
4. Advances only when explicitly told.

---

## 9. State Projection

Clients never receive authoritative state.

The player projection may contain:

- Discovered map.
- Buildings.
- Staff.
- Visible guests.
- Visible guest opinions.
- Queues.
- Finances.
- Objectives.
- Incidents.
- Alerts.
- Aggregate analytics.

Hidden:

- Exact random rolls.
- Future incident weights.
- Undiscovered preferences.
- Internal pathfinding caches.
- Hidden scenario triggers.
- RNG state.
- Debug-only utility components unless transparency mode is enabled.

---

## 10. Content Packs

Potential pack order:

```text
base rules
→ campaign
→ expansion
→ culture/theme pack
→ localization
→ user override
```

The merge strategy is not yet decided.

Before community packs are supported, define:

- Dependency resolution.
- Override precedence.
- ID conflicts.
- Definition replacement versus patching.
- Compatibility constraints.
- Save compatibility rules.

---

## 11. Package Shape

```text
packages/
  substrate/
  kinds/
    story-graph/
    simulation/
    management-simulation/
      src/
        agents/
        buildings/
        commands/
        construction/
        economy/
        incidents/
        map/
        objectives/
        pathfinding/
        projection/
        queues/
        staff/
        systems/
        ticks/
  content/
    resort-base/
  clients/
    resort-cli/
    resort-web/
  test-support/
    resort-fixtures/
    resort-agents/
```
