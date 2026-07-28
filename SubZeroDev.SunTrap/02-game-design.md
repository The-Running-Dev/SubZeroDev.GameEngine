# Sun Trap — Game Design

**Document status:** Draft

> **Scope**
> The gameplay. What the player does, what the world does back, and how the two interact.
> Field-level state shapes are in [`06-content-and-systems.md`](06-content-and-systems.md);
> anything the engine fixes is in the kind contract, not here.

---

## 1. Core Gameplay Loop

```text
inspect resort
→ identify pressure or opportunity
→ build, price, hire, assign, or reconfigure
→ advance simulation
→ guests decide · staff work · buildings serve
→ queues and congestion evolve
→ money changes · incidents occur · objectives update
→ repeat
```

The player should repeatedly answer: what do guests want, what can they not reach, where is
capacity insufficient, where are staff wasting time, which buildings are profitable, which
prices suppress demand, and which failures are about to cascade.

**The build/price/hire actions do not advance time.** Only `advance_ticks` does. That split
is the kind's turn model and it makes the loop above literal rather than figurative.

---

## 2. Spatial Map

A grid or navigation graph containing terrain, walkable areas, water, construction zones,
buildings, entrances, paths, scenery, obstacles, service zones, and spawn and exit points.

### 2.1 Placement Validation

A building may require valid terrain, sufficient footprint, path access, shore access,
utility access, distance from restricted zones, no overlap, a scenario unlock, and
sufficient money.

**Each failure has an engine reason code** — `placement_overlaps`,
`placement_terrain_unsuitable`, `placement_out_of_bounds`, `placement_unreachable`,
`building_locked`, `insufficient_funds`. The client shows the reason; it never computes it.

### 2.2 Adjacency Effects

Nearby facilities create bonuses and penalties: bars increase nearby toilet demand,
nightclubs benefit from nearby food, luxury areas lose appeal near garbage, security
coverage reduces incident risk, scenery increases attractiveness, loud facilities reduce
hotel satisfaction.

---

## 3. Guest Simulation

Guests are autonomous agents.

### 3.1 Needs and Conditions

Initial needs: hunger, thirst, toilet, rest, entertainment, social, comfort.

Potential conditions: drunkenness, sunburn, headache, nausea, injury, anger, confusion.

### 3.2 Opinions

Guests evaluate price, variety, cleanliness, safety, attractiveness, queue length, service
quality, staff behaviour, accessibility and noise.

### 3.3 The Decision Model

A deterministic utility model ranks available intents:

```text
utility =
    need urgency
  + preference match
  + social relevance
  + quality
  + attractiveness
  − price resistance
  − travel cost
  − queue penalty
  − safety concern
```

The guest selects the highest-scoring valid destination.

**Two engine constraints bind here.** Utility is computed in **integers** (fixed-point where
a fraction is needed) — floating point would break determinism. And **ties break by entity
id**, not by collection order, which means the formula never has to be tuned to avoid ties.

Any randomness in a guest's decision comes from that guest's own stream, keyed by guest id
and its own draw counter — never by how many actions the player has taken. That is what
keeps a guest's behaviour stable when the player builds something elsewhere.

### 3.4 Leaving

A guest may leave because time expired, no options are affordable, paths repeatedly failed,
satisfaction is low, danger is high, needs are severely unmet, security ejected them, or a
scenario event removed them.

---

## 4. Guest Groups

Guests may arrive alone or in groups. Group behaviour may include choosing shared
destinations, waiting for slower members, splitting temporarily, preferring group-compatible
facilities, influencing one another, and escalating incidents.

**Groups are out of scope for the MVP.**

---

## 5. Buildings

Categories: food, drink, entertainment, shopping, toilets, medical, security, cleaning,
maintenance, administration, staff facilities, decorative, transport, and accommodation
later.

### 5.1 Service Cycle

```text
guest enters queue
→ reaches service point
→ pays
→ service consumes time and resources
→ guest needs and opinions change
→ revenue recorded
→ waste, dirt, wear or risk generated
```

### 5.2 Example Definition

```yaml
id: beach_bar_basic
category: drink
constructionCostCents: 1200000
capacity: 12
queueCapacity: 20
serviceRatePerMinute: 4
staffRequired:
  bartender: 1
products:
  - id: soft_drink
    priceCents: 500
    effects:
      thirst: -25
  - id: cocktail
    priceCents: 900
    effects:
      thirst: -20
      entertainment: 5
      drunkenness: 12
```

All money is **integer cents**. There is no currency type with a fractional part anywhere in
this game.

---

## 6. Queues and Congestion

Queues are explicit, with capacity, ordered guests, a service rate, an estimated wait and an
abandonment threshold. **Queue order is stable** — the engine requires it.

Guests may leave a queue when the wait exceeds patience, a better alternative appears, a
need becomes critical, the facility closes, or an incident interrupts service.

Path congestion is deferred until the basic queue model works.

---

## 7. Staff

Initial roles: builder, cleaner, mechanic, security, bartender or service worker; medical
and entertainment representatives later.

### 7.1 Task Allocation

Tasks include cleaning spills, emptying waste, repairing buildings, building structures,
responding to fights, escorting guests, staffing facilities and inspecting hazards.

Initial assignment modes: automatic, assigned zone, assigned building.

### 7.2 Efficiency

Staff performance depends on distance, skill, fatigue, tools, workload, path access, morale
and facility quality.

---

## 8. Construction

```text
select definition → preview footprint → validate placement → pay cost
→ create construction site → builders deliver work → building completes → facility opens
```

**The preview step is an engine operation**, not a client calculation — the kind contract
specifies a `previewAction` that runs the real rules and discards the result. A client that
computes its own placement validity is a client with game logic in it.

The MVP may simplify this to immediate construction. Later: construction time, builder
allocation, material delivery, demolition, relocation, upgrades and damage repair.

---

## 9. Economy

Track cash, revenue, construction spending, wages, maintenance, product costs, utilities,
loans, interest, refunds, fines and scenario rewards.

### 9.1 Pricing

The player sets prices per building or product. Price influences demand, satisfaction,
revenue per service, guest affordability, resort reputation and guest mix.

The player should see unit price, unit cost, sales, revenue, queue, rejected demand and
guest price opinion.

### 9.2 Bankruptcy

Bankruptcy is an escalation, not necessarily an instant failure:

```text
cash shortage → unpaid maintenance or wages → reduced operation
→ emergency loan → forced closure → bankruptcy
```

Scenario rules may choose immediate failure instead.

---

## 10. Cleanliness, Wear and Maintenance

Activity generates dirt, trash, spills, wear, damage and health risk. Buildings degrade
through use, weather, neglect and incidents. Poor condition produces slower service, lower
attractiveness, higher failure risk, dissatisfaction, closure and incident escalation.

---

## 11. Safety and Incidents

Initial: fight, vomit, building breakdown, minor fire, guest injury, theft, overcrowding,
staff shortage.

Later: severe weather, shark alert, power failure, inspection, water contamination,
celebrity visit, regional plumbing emergency.

Incidents may be automatic, staff-resolvable, player-choice events, scenario-specific or
chained.

---

## 12. Weather and Time of Day

Time of day affects guest arrival, facility demand, lighting, staff shifts, nightlife,
safety and temperature. Weather may affect sunburn, beach demand, indoor demand, movement,
incidents and building wear.

**Weather is not required for the MVP.**

---

## 13. Objectives

Categories: profit, revenue, guest count, satisfaction, cleanliness, safety, construction,
reputation, incident limits, time limits, specific building operation.

```text
Maintain:
- cash above $5,000
- average satisfaction above 65
- cleanliness above 70
- no unresolved major incident
for one simulated day.
```

**Objectives are identified by published ids.** The engine's terminal identity records which
objective ids were met and which failure id ended the game — never the cash figure or the
tick it happened on, both of which change with every balance pass.

---

## 14. Failure Conditions

Bankruptcy, objective deadline missed, resort closure, safety rating collapse, too many
guests leaving dissatisfied, a critical building unavailable, or a scenario-specific
disaster.

---

## 15. Progression

Campaign progression may unlock buildings, products, staff roles, maps, policies, loans,
upgrades, guest segments and scenarios.

Progression belongs to content and profile state, never to hidden client logic.

---

## 16. Narrative Direction

The narrator stays calm and factual.

> The nightclub is full.
>
> The toilets are also full.
>
> These developments are related.

> Security has resolved the disagreement.
>
> The inflatable flamingo remains uncooperative.

Mechanical explanations stay separate from narration. Narration is localized string content;
mechanical audit is the engine's own record.
