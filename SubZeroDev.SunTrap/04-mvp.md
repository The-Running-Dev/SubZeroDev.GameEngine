# Sun Trap — MVP

**Document status:** Draft

> **Scope**
> The smallest slice that proves this game, and what "done" means for it.
>
> **This is downstream of two other milestones.** The engine's own MVP proves the platform
> with the `story-graph` kind and explicitly excludes even the `simulation` kind. The
> `management-simulation` kind is the third milestone. Nothing here starts until that kind
> exists.

---

## 1. The MVP in One Sentence

A player places a drink stand on a small beach map; guests walk to it, queue, buy drinks and
create litter; a cleaner responds; and the player reaches a profit objective before running
out of money.

---

## 2. What It Proves

The kind boundary, spatial map state, deterministic ticks, guest spawning, guest needs,
guest utility selection, pathfinding, queueing, service, revenue, cleanliness, staff tasks,
objectives, failure, save and load, replay, projection, and a proving client.

---

## 3. In Scope

**Map** — one small grid, one spawn, one exit, walkable sand, fixed paths or fully walkable
terrain.

**Guests** — one archetype; needs limited to thirst and toilet; cash; satisfaction; one
opinion (price); deterministic destination choice.

**Buildings** — drink stand, toilet, trash bin or implicit waste point.

**Staff** — cleaner.

**Economy** — starting cash, construction cost, drink sales, cleaner wage, bankruptcy.

**Simulation** — fixed ticks, A\* pathfinding, queueing, service time, litter generation,
cleaner task generation.

**Scenario**

```text
Objective: earn $1,000 in total revenue and maintain cleanliness above 50
           before the end of Day 2.

Failure:   cash below the emergency threshold,
           or cleanliness at zero for a sustained period.
```

---

## 4. Out of Scope

Nightclubs, alcohol effects, security, mechanics, fires, weather, groups, hotels, building
upgrades, staff fatigue, loans, multiple guest archetypes, complex product inventory, 3D
graphics, content packs, modding, hosted service.

---

## 5. MVP Client

A CLI is enough.

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
- [ ] Cash transfers correctly, in integer cents.
- [ ] Guests generate litter.
- [ ] A cleaner receives a task, reaches it, and resolves it.

### Management

- [ ] The player places buildings.
- [ ] Invalid placement is rejected **with an engine reason code**, not a client message.
- [ ] The player hires a cleaner.
- [ ] The player sets a drink price.
- [ ] Price affects demand or satisfaction.

### Scenario

- [ ] The objective can be completed.
- [ ] Bankruptcy or failure is reachable.
- [ ] Win and failure are reported through the kind's terminal identity — published
      objective and failure ids, not cash figures.

### Determinism

- [ ] The same seed and the same actions produce byte-identical serialized state.
- [ ] Save and load mid-run continues identically to an uninterrupted run.
- [ ] **Batch invariance holds**: `advance 360` reaches the same world as 360 × `advance 1`,
      compared as an outcome rather than as bytes, because the action logs legitimately
      differ.
- [ ] No floating-point value appears in serialized state.
- [ ] Removing every emitted event changes nothing.

### Architecture

- [ ] No game logic in the client.
- [ ] The client receives a projection, never raw state.
- [ ] Placement previews go through the engine, not through client-side geometry.
- [ ] Content definitions are validated at load; a deliberately broken definition is
      rejected.
- [ ] The kind uses the shared substrate rather than duplicating it — no second serializer,
      no second RNG, no second session store.

When these are complete, the game is proven and the kind has earned its place.
