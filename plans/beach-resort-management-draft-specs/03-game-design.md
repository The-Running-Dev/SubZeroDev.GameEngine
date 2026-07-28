# Resort Management Simulation — Game Design

**Document status:** Draft

---

## 1. Core Gameplay Loop

```text
Inspect resort
→ identify pressure or opportunity
→ build, price, hire, assign, or reconfigure
→ advance simulation
→ guests make decisions
→ staff perform work
→ buildings serve guests
→ queues and congestion evolve
→ money changes
→ incidents occur
→ objectives update
→ repeat
```

The player should repeatedly answer:

- What do guests currently want?
- What are they unable to reach?
- Where is capacity insufficient?
- Where are staff wasting time?
- Which buildings are profitable?
- Which prices are suppressing demand?
- Which failures are about to cascade?

---

## 2. Spatial Map

The map is a grid or navigation graph containing:

- Terrain.
- Walkable areas.
- Water.
- Construction zones.
- Buildings.
- Entrances.
- Paths.
- Scenery.
- Obstacles.
- Service zones.
- Spawn and exit points.

### 2.1 Placement Validation

A building may require:

- Valid terrain.
- Enough footprint.
- Path access.
- Shore access.
- Utility access.
- Distance from restricted zones.
- No overlap.
- Scenario unlock.
- Sufficient money.

### 2.2 Adjacency Effects

Nearby facilities may create bonuses or penalties.

Examples:

- Bars increase nearby toilet demand.
- Nightclubs benefit from nearby food.
- Luxury areas lose appeal near garbage.
- Security coverage reduces incident risk.
- Scenery increases attractiveness.
- Loud facilities reduce hotel satisfaction.

---

## 3. Guest Simulation

Guests are autonomous agents.

### 3.1 Guest State

Potential state:

- Position.
- Destination.
- Cash.
- Arrival time.
- Departure deadline.
- Group membership.
- Preferences.
- Needs.
- Conditions.
- Opinions.
- Current intent.
- Patience.
- Satisfaction.
- Incident history.

### 3.2 Needs

Initial needs:

- Hunger.
- Thirst.
- Toilet.
- Rest.
- Entertainment.
- Social.
- Comfort.

Potential conditions:

- Drunkenness.
- Sunburn.
- Headache.
- Nausea.
- Injury.
- Anger.
- Confusion.

### 3.3 Opinions

Guests may evaluate:

- Price.
- Variety.
- Cleanliness.
- Safety.
- Attractiveness.
- Queue length.
- Service quality.
- Staff behavior.
- Accessibility.
- Noise.

### 3.4 Guest Decision Model

A deterministic utility model should rank available intents.

Example:

```text
utility =
  need urgency
  + preference match
  + social relevance
  + quality
  + attractiveness
  - price resistance
  - travel cost
  - queue penalty
  - safety concern
```

The guest selects the highest-scoring valid destination.

Tie-breaking is deterministic and may use the guest's isolated RNG stream.

### 3.5 Leaving

A guest may leave because of:

- Time expired.
- No affordable options.
- Repeated path failures.
- Low satisfaction.
- High danger.
- Severe unmet needs.
- Ejection by security.
- Scenario event.

---

## 4. Guest Groups

Guests may arrive alone or in groups.

Group behavior may include:

- Choosing shared destinations.
- Waiting for slower members.
- Splitting temporarily.
- Preferring group-compatible facilities.
- Influencing one another's decisions.
- Escalating incidents.

Groups are optional for the MVP.

---

## 5. Buildings

Building categories:

- Food.
- Drink.
- Entertainment.
- Shopping.
- Toilets.
- Medical.
- Security.
- Cleaning.
- Maintenance.
- Administration.
- Staff facilities.
- Decorative.
- Transport.
- Accommodation, later.

### 5.1 Building State

A building may track:

- Position.
- Footprint.
- Entrances.
- Open/closed state.
- Capacity.
- Queue.
- Service rate.
- Inventory.
- Condition.
- Cleanliness.
- Staff assignment.
- Prices.
- Revenue.
- Operating cost.
- Power or utility state.
- Upgrade level.

### 5.2 Service Cycle

```text
guest enters queue
→ reaches service point
→ pays
→ service consumes time/resources
→ guest needs and opinions change
→ revenue recorded
→ waste, dirt, wear, or risk generated
```

### 5.3 Example Definition

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

---

## 6. Queues and Congestion

Queues should be explicit.

A queue has:

- Capacity.
- Ordered guests.
- Service rate.
- Estimated wait.
- Abandonment threshold.

Guests may leave a queue if:

- Wait exceeds patience.
- A better alternative appears.
- A need becomes critical.
- The facility closes.
- An incident interrupts service.

Path congestion may be deferred until after the basic queue model works.

---

## 7. Staff

Initial roles:

- Builder.
- Cleaner.
- Mechanic.
- Security.
- Bartender or service worker.
- Medical worker, later.
- Entertainment representative, later.

### 7.1 Staff State

- Position.
- Role.
- Wage.
- Shift.
- Fatigue.
- Morale.
- Skill.
- Assigned zone.
- Current task.
- Task queue.
- Employment status.

### 7.2 Task Allocation

Tasks may include:

- Clean spill.
- Empty waste.
- Repair building.
- Build structure.
- Respond to fight.
- Escort guest.
- Staff facility.
- Inspect hazard.

Initial assignment modes:

- Automatic.
- Assigned zone.
- Assigned building.

### 7.3 Efficiency

Staff performance depends on:

- Distance.
- Skill.
- Fatigue.
- Tools.
- Workload.
- Path access.
- Morale.
- Facility quality.

---

## 8. Construction

Construction workflow:

```text
select definition
→ preview footprint
→ validate placement
→ pay cost
→ create construction site
→ builders deliver work
→ building completes
→ facility opens
```

MVP may simplify this to immediate construction.

Later systems:

- Construction time.
- Builder allocation.
- Material delivery.
- Demolition.
- Relocation.
- Upgrades.
- Damage repair.

---

## 9. Economy

Track:

- Cash.
- Revenue.
- Construction spending.
- Wages.
- Maintenance.
- Product costs.
- Utilities.
- Loans.
- Interest.
- Refunds.
- Fines.
- Scenario rewards.

### 9.1 Pricing

The player can set prices per building or product.

Price influences:

- Demand.
- Satisfaction.
- Revenue per service.
- Guest affordability.
- Resort reputation.
- Guest mix.

The player should be able to see:

- Unit price.
- Unit cost.
- Sales.
- Revenue.
- Queue.
- Rejected demand.
- Guest price opinion.

### 9.2 Bankruptcy

Bankruptcy should be an escalation, not necessarily an instant failure.

Possible ladder:

```text
cash shortage
→ unpaid maintenance or wages
→ reduced operation
→ emergency loan
→ forced closure
→ bankruptcy
```

Scenario rules may choose immediate failure.

---

## 10. Cleanliness, Wear, and Maintenance

Activities generate:

- Dirt.
- Trash.
- Spills.
- Wear.
- Damage.
- Health risk.

Buildings degrade through:

- Use.
- Weather.
- Neglect.
- Incidents.

Effects of poor condition:

- Slower service.
- Lower attractiveness.
- Higher failure risk.
- Guest dissatisfaction.
- Closure.
- Incident escalation.

---

## 11. Safety and Incidents

Initial incidents:

- Fight.
- Vomit.
- Building breakdown.
- Minor fire.
- Guest injury.
- Theft.
- Overcrowding.
- Staff shortage.

Later incidents:

- Severe weather.
- Shark alert.
- Power failure.
- Inspection.
- Water contamination.
- Celebrity visit.
- Regional plumbing emergency.

Incidents may be:

- Automatic.
- Staff-resolvable.
- Player-choice events.
- Scenario-specific.
- Chained.

---

## 12. Weather and Time of Day

Time of day affects:

- Guest arrival.
- Facility demand.
- Lighting.
- Staff shifts.
- Nightlife.
- Safety.
- Temperature.

Weather may affect:

- Sunburn.
- Beach demand.
- Indoor demand.
- Movement.
- Incidents.
- Building wear.

Weather is not required for the MVP.

---

## 13. Objectives

Objective categories:

- Profit.
- Revenue.
- Guest count.
- Satisfaction.
- Cleanliness.
- Safety.
- Construction.
- Reputation.
- Incident limits.
- Time limits.
- Specific building operation.

Example:

```text
Maintain:
- cash above $5,000
- average satisfaction above 65
- cleanliness above 70
- no unresolved major incident

for one simulated day.
```

---

## 14. Failure Conditions

Potential failures:

- Bankruptcy.
- Objective deadline missed.
- Resort closure.
- Safety rating collapse.
- Too many guests leave dissatisfied.
- Critical building unavailable.
- Scenario-specific disaster.

---

## 15. Progression

Campaign progression may unlock:

- Buildings.
- Products.
- Staff roles.
- Maps.
- Policies.
- Loans.
- Upgrades.
- Guest segments.
- Scenarios.

Progression belongs to game content and profile state, not hidden client logic.

---

## 16. Narrative Direction

The narrator remains calm and factual.

Example:

> The nightclub is full.
>
> The toilets are also full.
>
> These developments are related.

Example:

> Security has resolved the disagreement.
>
> The inflatable flamingo remains uncooperative.

Mechanical explanations remain separate from narration.
