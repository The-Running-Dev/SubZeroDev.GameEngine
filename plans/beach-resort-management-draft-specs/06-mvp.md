# Resort Management Simulation — MVP

**Status:** Draft

---

## 1. MVP in One Sentence

A player places a drink stand on a small beach map, guests walk to it, queue, buy drinks, create litter, a cleaner responds, and the player reaches a simple profit objective before running out of money.

---

## 2. What This Proves

The MVP exercises:

- The third kind boundary.
- Spatial map state.
- Deterministic ticks.
- Guest spawning.
- Guest needs.
- Guest utility selection.
- Pathfinding.
- Queueing.
- Service.
- Revenue.
- Cleanliness.
- Staff tasks.
- Objectives.
- Failure.
- Save/load.
- Replay.
- Projection.
- A proving client.

---

## 3. In Scope

### Map

- One small grid map.
- One guest spawn.
- One exit.
- Walkable sand.
- Fixed paths or fully walkable terrain.

### Guests

- One guest archetype.
- Needs: thirst and toilet.
- Cash.
- Satisfaction.
- One opinion: price.
- Deterministic destination choice.

### Buildings

- Drink stand.
- Toilet.
- Trash bin or implicit waste point.

### Staff

- Cleaner.

### Economy

- Starting cash.
- Construction cost.
- Drink sales.
- Cleaner wage.
- Bankruptcy.

### Simulation

- Fixed ticks.
- A* pathfinding.
- Queueing.
- Service time.
- Litter generation.
- Cleaner task generation.

### Scenario

Objective:

```text
Earn $1,000 in total revenue
and maintain cleanliness above 50
before the end of Day 2.
```

Failure:

```text
Cash below an allowed emergency threshold
or cleanliness reaches zero for a sustained period.
```

---

## 4. Out of Scope

- Nightclubs.
- Alcohol effects.
- Security.
- Mechanics.
- Fires.
- Weather.
- Groups.
- Hotels.
- Building upgrades.
- Staff fatigue.
- Loans.
- Multiple guest archetypes.
- Complex product inventory.
- 3D graphics.
- Culture packs.
- Modding.
- Hosted service.

---

## 5. MVP Client

A CLI is enough to prove the kind.

Example:

```text
build drink-stand at 10,5
build toilet at 14,5
hire cleaner
advance 360
status
inspect drink-stand-1
inspect cleaner-1
save mvp-save
```

A minimal visual grid may follow immediately after engine proof.

---

## 6. Definition of Done

### Simulation

- [ ] Guests spawn deterministically.
- [ ] Guests develop thirst.
- [ ] Guests choose a reachable drink stand.
- [ ] Guests path to it.
- [ ] Guests queue.
- [ ] Guests are served.
- [ ] Cash transfers correctly.
- [ ] Guests generate litter.
- [ ] Cleaner receives a task.
- [ ] Cleaner reaches and resolves the litter.

### Management

- [ ] Player places buildings.
- [ ] Invalid placement is rejected with a reason.
- [ ] Player hires a cleaner.
- [ ] Player sets a drink price.
- [ ] Price affects demand or satisfaction.

### Scenario

- [ ] Objective can be completed.
- [ ] Bankruptcy or failure is reachable.
- [ ] Win and failure are reported clearly.

### Determinism

- [ ] Same seed and commands produce byte-identical serialized state.
- [ ] Save/load continuation is identical to uninterrupted execution.
- [ ] Simulation speed does not change results.

### Architecture

- [ ] No game logic in the client.
- [ ] Client receives projection, not raw state.
- [ ] Content definitions are validated.
- [ ] Kind uses shared substrate rather than duplicating it.

When these are complete, the new kind is proven.
