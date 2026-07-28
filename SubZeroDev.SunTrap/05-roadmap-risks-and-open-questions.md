# Sun Trap — Roadmap, Risks, and Open Questions

**Document status:** Draft

---

## 1. Development Phases

**Phase 0 — the kind.** Not work in this repository. The `management-simulation` kind must
be specified (done) and built in the engine repository before Phase 1 starts.

**Phase 1 — headless kernel.** Tick clock, map state, actions, deterministic entity ids,
guest spawn, guest needs, one building, revenue, save and load, replay.

**Phase 2 — spatial mechanics.** Placement, entrances, pathfinding, movement, queueing,
unreachable-state handling, map revision and cache invalidation.

**Phase 3 — staff.** Cleaner, mechanic, security, builder; task generation and assignment;
zones; wages.

**Phase 4 — resort operations.** Multiple building categories, prices, product definitions,
cleanliness, wear, maintenance, incidents, objectives, bankruptcy.

**Phase 5 — first visual client.** 2D map, build mode, selection, guest and building
inspectors, staff panel, overlays, alerts, save and load UI.

**Phase 6 — content depth.** Guest archetypes, nightlife, alcohol, toilets, medical,
weather, security, larger scenarios, campaign progression, narrative voice.

**Phase 7 — platform integration.** MCP surface, content packs, theme packs, additional
management campaigns — hotels, parks, festivals — all as *campaigns*, no engine change.

---

## 2. Technical Risks

### 2.1 Pathfinding Cost

Hundreds of guests recomputing paths can dominate runtime. Mitigations: cache by map
revision, reuse distance fields, stagger decisions, limit candidate destinations, repath
only when necessary, profile before adding complexity.

**Sharper than it looks under this engine.** A tick batch runs inside a single synchronous,
pure engine call. There is no yielding, so the cost of `advance_ticks 360` is a latency
budget for one call, not an amortized background load.

### 2.2 Agent Decision Cost

Scoring every building for every guest every tick is too expensive. Mitigations: decision
intervals, spatial indexes, category-first selection, candidate caps, need thresholds,
cached attractiveness.

**Caches must not be serialized.** Anything cached is recomputed from state, never persisted
— a cached value in a save is free to drift from the truth it summarises.

### 2.3 Cascading Simulation Failures

```text
long queues → unmet needs → incidents → staff overload
→ dirt and breakdowns → more dissatisfaction → revenue loss → cannot hire
```

Possibly good gameplay, but it must stay recoverable.

### 2.4 Deterministic Spatial Tie-Breaking

Pathfinding, queues, staff tasks and utility scoring diverge if ties depend on collection
order. **Largely discharged by the kind contract** — every tie breaks by entity id, and
iteration is in id order rather than insertion order. The residual risk is a balance formula
that introduces a float.

### 2.5 Content Balance

The engine may work while the game is boring or trivial. A balance harness should search for
dominant layouts, dominant pricing, useless buildings, permanent bottlenecks, unavoidable
bankruptcy and infinite-profit loops.

**That harness lives here, not in the engine.** It is a long-running search, not a load-time
check, and the engine's validator must stay pure and total.

### 2.6 Client Scope

A polished visual client can consume the whole project before the simulation is proven. Keep
the proving client first.

---

## 3. Product Risks

**Becoming a clone.** Stay inspired by the genre, reproduce none of its expression. Original
identity, art, writing, scenarios, building names, maps, balance and UI.

**Kind proliferation.** A kind exists only when its resolution cannot be expressed as data
over an existing kind. Hotels, parks, clubs and festivals are **campaigns of this kind**, not
new kinds. The engine now states this as a written test.

**Universal DSL pressure.** Do not push guest AI, pathfinding or construction into a generic
substrate DSL. Kind logic is reviewed code; campaign logic is validated data.

**Premature platform work.** No hosting, billing, accounts, analytics or mod marketplace
before the headless simulation is proven.

---

## 4. Open Questions

Questions the engine has since answered are listed in §5 rather than here.

**Time and balance**

- Tick duration — the draft suggested 1 tick = 10 simulated seconds. Provisional.
- Do financial reports close hourly or daily?

**Guests**

- How often do guests reconsider intent?
- Do they know every building, or only discovered and visible ones?
- Are preferences fixed or partially randomized at arrival?
- At what point do guests abandon queues?
- Do groups ship in the first campaign or later?

**Buildings**

- Immediate construction for the MVP, or construction time from the start?
- Is product inventory modelled initially?
- Are utilities required?
- How are entrances authored?
- Can buildings rotate freely?

**Staff**

- Automatic global dispatch, or zones first?
- Do shifts exist initially?
- Are service workers explicit agents, or part of building capacity?
- Do staff have needs?

**Economy**

- How elastic is demand to price?
- Are wages charged continuously or daily?
- Is bankruptcy immediate, or does the escalation ladder apply?
- Are loans included before the first campaign?

**Incidents**

- Which are emergent and which are authored events?
- Which require player choices?
- Can incidents chain?

**Client**

- PixiJS, Phaser, Godot, or another renderer?
- Grid view or isometric?
- Full local engine in the client, or an engine process behind an API boundary?
- Snapshots or deltas?

**Content and identity**

- Is *Sun Trap* the final title? It is a working name, chosen when these documents were
  split out of the engine repository.
- What is the first resort theme?
- How are content ids named? (Entity ids at runtime are engine-derived; authored content ids
  are this repository's convention.)

---

## 5. Closed by the Engine

Recorded so they are not reopened.

| Question | Answer |
|---|---|
| Final kind name | `management-simulation`. `resort-management` is a campaign family, not a kind |
| Does the session store live outside the engine? | Yes, from day one — the core is a pure function and sessions are a store above it |
| Are commands event-sourced, or is the log diagnostic? | The action log **is** the replay spine, not diagnostics. `{ seed, actionLog }` reconstructs a session completely |
| Fixed-step batching rules | Batch invariance: any split of a tick batch reaches the same world |
| Maximum ticks per engine call | Capped by campaign data, Tier 1 validated; exceeding it is a rejection, never a silent truncation |
| How are content packs merged? | Campaigns replace wholesale, strings replace per key, dependencies exact-version and acyclic |
| How much of the generic condition system is reused? | The frozen operator set, unchanged. New operators need a concrete campaign need each |

---

## 6. Recommended First Step

Not the full game. One deterministic experiment:

```text
small map + one guest + one drink stand + one path + one purchase
```

Then:

```text
many guests + queue + toilet + litter + cleaner + objective
```

That vertical slice reveals whether the core loop is enjoyable, and whether the engine
supports a spatial management kind without distortion.
