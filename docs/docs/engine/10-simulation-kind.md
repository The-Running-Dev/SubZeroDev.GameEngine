---
sidebar_label: Simulation Kind
---

# Simulation Kind — Contract

**Document status:** Revision 1 — **the seam only.** Field-level content detail is still
upstream; §15 says exactly what and why.

**Kind:** `simulation`

> **Scope of this document**
>
> The second engine-owned kind, expressed against the Kind seam
> ([`04-core.md`](04-core.md) §3) the way
> [`03-story-graph-kind.md`](03-story-graph-kind.md) is. It reconciles the model in
> `games/04-engine-specification.md` with the `GameState` envelope, the one-action model,
> projection, reason codes, events and terminal identity.
>
> It is **not** a port of that document. Roughly half of it is core material `04-core` now
> owns, and the half that is kind-specific runs to ~50 KB of field detail that this contract
> deliberately does not restate — see §15.

---

## 1. What This Kind Is

A weekly-tick life simulation: the player plans a week's actions, ends the week, and the
engine resolves them, then runs its systems. Where `story-graph`'s unit of play is *one
choice*, this kind's is *one week*.

That difference is the entire reason the Kind seam exists (architecture §1, N2). Everything
below is the consequence of expressing it through `04` §3 rather than through a bespoke
engine.

---

## 2. `KindState` — What Belongs Here

**The upstream `GameState` is not this kind's state.** It was written before the envelope
existed and carries seven fields the core now owns. Reproducing it verbatim would be the
envelope-duplication defect `CLAUDE.md` names as this project's recurring one — already
caught three times, in 03 §8.1, 04 §10.1 and 03 §9 — the last on the *view* side.

| Upstream field | Where it belongs now |
|---|---|
| `version` | `GameState.formatVersion` — the envelope (04 §2) |
| `gameId` | The envelope, from the `IdSource` port (06 §5.1) |
| `seed` | The envelope — the *only* randomness state |
| `status` | The envelope — but narrowed. Upstream's `GameStatus` is `"active" \| "completed" \| "failed" \| "abandoned"`; the envelope's is `"active" \| "ended" \| "abandoned"` (04 §2). `completed` and `failed` both map to `ended` — **the core has no concept of winning**, the same resolution [`12-world-graph-kind.md`](12-world-graph-kind.md) §8 gives the identical upstream conflict. The win/loss/week-limit distinction lives in `outcome()` (§12), not here |
| `actionLog` | The envelope — the replay spine |
| `metadata` | The session-store record, outside replayable state (04 §7) |
| **`rng: RngState`** | **Nowhere.** 04 §2 bans persisted generator state outright: streams derive from `(seed, streamId)`, so a stored `RngState` is a field written every action and read by nothing, free to drift from the derivable truth |

What remains is the kind's own:

```typescript
interface SimulationKindState {
  calendar: CalendarState;                     // §2.1
  player: PlayerState;                         // §6
  economy: EconomyState;                       // §2.5
  world: WorldState;                           // §2.2

  activeEffects: StatusEffect[];                // §2.3
  activeOpportunities: Opportunity[];           // §2.3
  scheduledEvents: ScheduledEvent[];            // §2.3
  pendingEventResponses: PendingEventResponse[]; // §2.3

  goals: GoalState[];                          // §2.4
  plan: WeeklyActionPlan | null;               // §4.1 — the week being assembled
}
```

> **Two upstream fields are deliberately absent, and both need a decision before this
> contract is complete.**
>
> **`history: HistoryEntry[]`** — a narrative record of what happened. That is very close to
> what `StateChange[]` already returns from `advance` (04 §12) and to what the event stream
> carries (05). Three overlapping records of the same events is exactly the duplication rule
> §2 exists to prevent, so `history` is not adopted until it is established what it holds
> that `StateChange` does not. Recorded in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).
>
> **`WeeklyActionPlan.totalTimeCost` / `totalMoneyCostCents`** — marked "engine-computed"
> upstream. Derived values do not belong in serialized state: they can disagree with the
> actions they summarise, and a disagreement is unresolvable. They are computed on read (§4.1).

The rest of this section restates every field type `SimulationKindState` names above, except
`PlayerState` (§6, deferred) — the field-level port `plans/36-simulation-kind-programme.md`
calls **W27** (assigned as a real `W` number when this unit is cut), sized against upstream
§5.1, §5.3–§5.6.

Two primitives recur across several of these types and are introduced once, here, rather than
per-field: **money is integer cents**, and **rates are integer basis points**, matching
upstream §2.1 and already stated as this kind's own rule in §6 below.

```typescript
type Cents = number;         // integer; 1234 === $12.34
type BasisPoints = number;   // integer; 250 === 2.50%
```

Both are simulation-kind primitives — no other kind has a money concept — reused by every
later section that needs them, including §6 (Player State) once ported.

**A second recurring rule: `Record<string, T>` iteration that affects state must use sorted
keys.** `Record` key order follows insertion order, which after a `serialize`/`deserialize`
round trip follows the order of keys in the JSON text — so an iteration whose *result* depends
on order (weighted selection, decay, a scan that stops at the first match) can diverge between
a fresh game and a loaded one even though the two states are logically identical. Read-only
iteration for display is exempt. This is a real, upstream-inherited requirement (§2.2) that
`04-core.md` does not yet state generically — flagged here because this kind is the first with
`Record`-typed state fields whose iteration order is load-bearing, not because it is settled
that the rule belongs only here. Applies below to `WorldState.eventCooldowns` and
`EconomyState.sectorDemand`/`marketPrices` (§2.5), and will apply to `PlayerState.skills`/
`reputation`/`counters` once §6 is ported.

### 2.1 Calendar State

```typescript
interface CalendarState {
  currentWeek: number;
  currentYear: number;
  season?: "spring" | "summer" | "autumn" | "winter";

  totalTimeUnits: number;
  committedTimeUnits: number;
  spentTimeUnits: number;
}
```

Invariant, checked after every mutation (upstream §5.1):

```text
0 ≤ committedTimeUnits + spentTimeUnits ≤ totalTimeUnits
availableTimeUnits = totalTimeUnits − committedTimeUnits − spentTimeUnits
```

Upstream fixes `totalTimeUnits`' starting value at a bare constant (`WEEKLY_TIME_UNITS = 14`).
Not restated as a constant here: `totalTimeUnits` already lives in mutable state, not as a
fixed rule, and whether a scenario may start a game with a different weekly budget is a
`ScenarioDefinition` question for §7 once content types are ported — stating 14 as fixed now
would prejudge that.

### 2.2 World State

```typescript
interface WorldState {
  npcs: NPCState[];                          // §7 once ported (upstream §14.6)
  locations: LocationState[];

  jobMarket: JobMarketState;
  eventCooldowns: Record<string, number>;     // eventId → week last fired. Sorted-iteration rule applies (above)
  firedUniqueEvents: string[];
  chainStates: EventChainState[];

  strangenessBase: number;                   // 0–100; the derived value below adds modifiers
  headlinePool: HeadlinePoolState;

  agents: AgentState[];                      // rivals; empty in open_life mode. §7 once ported (upstream §14.9)

  flags: Record<string, boolean>;
}

interface HeadlinePoolState {
  remainingIds: string[];        // shuffled, drawn from the front
  shownThisWeek?: string;
  cyclesCompleted: number;
}

interface LocationState {
  definitionId: string;
  discovered: boolean;
  accessible: boolean;
}

interface JobMarketState {
  openings: JobOpening[];
}

interface JobOpening {
  jobId: string;
  contested: boolean;
  positionsAvailable?: number;   // absent = uncontested, unbounded
  postedWeek: number;
  expiresAtWeek?: number;
}

interface EventChainState {
  chainId: string;
  scope: ChainScope;
  currentStep: number;
  startedWeek: number;
  active: boolean;
}

type ChainScope = "game" | "profile";
```

`JobOpening.contested`/`positionsAvailable` implement the scarcity model §7 will need (upstream
§14.1, §14.3): `entry`/`skilled` postings are uncontested with unbounded positions, while
`professional`/`senior` roles and promotion slots carry real, finite counts the player and a
rival compete for.

**`positionsAvailable` is optional here, not `Number.POSITIVE_INFINITY` as upstream states it.**
`canonicalStringify` (`core/persistence/canonical.ts`) rejects any non-finite number outright —
`Infinity` cannot survive a save/load round trip in this engine, whether or not `JSON.stringify`
would silently coerce it to `null` first. Absence-means-unbounded is not invented for this: it
is the same pattern upstream's own `CourseDefinition.seatsAvailable`/`HousingDefinition.
unitsAvailable` already use for an identical "uncapped" concept (§7 once ported, upstream
§14.2–§14.3) — `JobOpening` is the one place upstream reached for a literal infinity instead of
its own more common convention.

#### World Strangeness

Content (once §7 is ported) gates events and headlines on a **derived** strangeness value, not
the raw `strangenessBase` above — so a `Modifier` (upstream §13.3, deferred with the rest of
content mechanics) can push it, and so the raw number never leaks into a projection. The player
is meant to notice the drift, not read the dial. `strangenessBase` itself rises on a curve with
elapsed weeks; the curve's shape is content-balance material, out of scope here the same way §7
(Base and Derived Values, upstream) is out of scope for this unit.

#### Chain Scope — and an Item This Raises

Scope is declared per chain, not globally, because event chains are not all the same kind of
thing: a `"game"`-scoped chain cannot survive past this game (an eviction ladder should not
follow a new character into their next life), while a `"profile"`-scoped chain is meant to
outlive any single game and advance on cumulative weeks played across every game under one
profile.

**This is a real, unresolved item, not a restatement.** A `"profile"`-scoped `EventChainState`
needs somewhere to live that is *not* `GameState`/`SimulationKindState` — by definition, since
it must survive past the game that's ending. The only persistent, cross-game store this
platform has is `PlayerProfile` (04 §7.1: `{ formatVersion, profileId, achievements }`), and it
has no field for arbitrary kind-declared profile-scoped data today. Whether `PlayerProfile`
gains one, and what a kind-agnostic core does with a shape it cannot introspect, is a design
question for whichever unit first needs a `"profile"`-scoped chain to actually persist — not
this one. Until then, `ChainScope` is specified as a closed union of two values (matching
upstream) with the second value's storage genuinely unimplemented, the same honest-gap pattern
`history` already uses in this document. Recorded in
[`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) alongside it.

### 2.3 Effects, Opportunities, and Scheduled Events

```typescript
interface StatusEffect {
  id: string;
  sourceId: string;
  sourceKind: "item" | "housing" | "trait" | "event" | "job" | "course" | "system";

  modifiers: Modifier[];         // §7 once ported (upstream §13.3)

  appliedWeek: number;
  expiresAtWeek?: number;        // absent = permanent while source persists
  stacking: "refresh" | "stack";
  descriptionKey: LocKey;
  visible: boolean;
}

interface Opportunity {
  id: string;                    // unique per occurrence
  definitionId: string;
  kind: OpportunityKind;
  targetId: string;

  offeredWeek: number;
  expiresAtWeek: number;

  terms?: Record<string, unknown>;
}

type OpportunityKind =
  | "job_offer" | "promotion" | "course_place"
  | "housing" | "business" | "social";

interface ScheduledEvent {
  id: string;
  eventId: string;
  scheduledWeek: number;
  createdWeek: number;

  chainId?: string;
  chainStep?: number;
  payload?: Record<string, unknown>;
}

interface PendingEventResponse {
  id: string;
  eventId: string;
  rolledWeek: number;          // week N — when it fired
  presentWeek: number;         // week N+1 — when the player answers
  availableChoiceIds: string[];
}
```

`PendingEventResponse` implements the deferred-event model (upstream §11.5): events roll at the
end of week N; those needing a decision queue here and are presented at the start of week N+1
(the `events` entry in §12.1's start-of-week order), where their time cost competes against a
fresh budget. `end_week` (§4) refuses to resolve while `pendingEventResponses` is non-empty —
the concrete reason code is named once §10 (Reason Codes) has a real caller to attach it to.

#### Opportunity Lifecycle

**Generation**, three paths, all producing an `Opportunity` from an `OpportunityDefinition`
(§7 once ported, upstream §14.8):

| Path | Trigger |
|---|---|
| Rolled | An end-of-week system draws from the eligible pool, weighted, from the world stream |
| Action | An action's own outcome — negotiating well produces an offer |
| Event or reward | An event outcome, or a `Reward` of type `"opportunity"` (§7) |

`expiresAtWeek` is set from the definition's `durationWeeks`.

**Resolution.** An open opportunity leaves `activeOpportunities` exactly one way:

| Outcome | Cause |
|---|---|
| Accepted | An `accept_opportunity` action |
| Declined | A `decline_opportunity` action |
| Expired | `expiresAtWeek` passed |
| Revoked | A contested position filled by a rival |

**End-of-week ordering, within the `opportunities` system (§12.2):** revoke anything whose
target position was just filled, then expire anything past `expiresAtWeek`, then offer new
opportunities from the eligible pool. Revoking and expiring before offering means a slot freed
this week becomes available to re-offer this week rather than next.

**Why explicit decline exists.** Letting an offer lapse and refusing it to someone's face are
different acts once NPCs remember things (§7 once ported, upstream §14.6) — turning down a
manager's offer is a relationship event; forgetting to answer is a different one. Without a
distinct decline path the engine cannot tell them apart.

**Revocation is deliberate, not a bug.** If holding an unexpired offer reserved the slot, a
contested position could never actually be taken by a rival, and the scarcity model (§2.2)
would be decorative. The offer evaporates instead, with a visible message.

#### Scheduled Event Lifecycle

**Creation.** An event outcome's own `scheduledEvents: Array<{ eventId, inWeeks }>` (§7 once
ported) produces a `ScheduledEvent` with `scheduledWeek = currentWeek + inWeeks`, inheriting
`chainId`/`chainStep` from the event that scheduled it.

**Firing**, within the `events` system, in this order: take every `ScheduledEvent` where
`scheduledWeek <= currentWeek` and fire each one **unconditionally** — ignoring weight,
cooldown, uniqueness and its own conditions, since it was already committed to when scheduled —
queue any with choices as a `PendingEventResponse` for next week, then roll random eligible
events by weight as normal. Firing scheduled events before rolling random ones matters for the
same reason revoke-before-offer does above.

Re-checking eligibility at fire time was considered and rejected: it lets a multi-week chain
break silently in the middle (a three-week-out hearing whose triggering condition drifted in
week two just never fires, with nothing recording why), which is a worse failure than an
event firing on a stale premise.

**Cancellation.** An event outcome's `endsChain: true` cancels every pending `ScheduledEvent`
sharing that `chainId`. This is the intended way to stop a sequence — paying off arrears ends
an eviction chain, which cancels the scheduled hearing — and it is explicit and inspectable,
not implicit.

> **Deliberate limitation, carried from upstream.** A `ScheduledEvent` with no `chainId` has no
> cancellation path: it fires regardless of anything that happens between scheduling and
> firing. Content that wants a scheduled event to be cancellable must put it in a chain.

### 2.4 Goal State

```typescript
interface GoalState {
  definitionId: string;
  status: "active" | "completed" | "failed";

  satisfiedThisWeek: boolean;
  consecutiveWeeksSatisfied: number;
  requiredDurationWeeks?: number;

  firstSatisfiedWeek?: number;
  completedWeek?: number;
  failedWeek?: number;

  progressNotes: GoalProgressNote[];
}

interface GoalProgressNote {
  conditionIndex: number;
  satisfied: boolean;
  currentValue: unknown;
  targetValue: unknown;
}
```

`consecutiveWeeksSatisfied` resets to zero on any unsatisfied week — no partial credit for a
goal that requires a sustained condition, which is what makes a duration requirement
anti-exploit rather than decorative.

`progressNotes` exists for the Transparent Consequences principle — a client can show *which*
clause of a compound goal (§8, `Condition`'s `all`/`any` tree) is currently unmet, not just that
the goal isn't done yet.

### 2.5 Economy State

```typescript
interface EconomyState {
  inflation: BasisPoints;
  unemploymentRate: BasisPoints;
  interestRate: BasisPoints;

  sectorDemand: Record<string, number>;      // exact value — hidden. Sorted-iteration rule applies (above)
  marketPrices: Record<string, Cents>;       // sorted-iteration rule applies (above)

  publishedIndicators: string[];   // which keys the player is allowed to see
  flags: Record<string, boolean>;
}

type DemandBand = "cold" | "steady" | "hot";

function demandBand(value: number): DemandBand;   // <35 cold, 35–65 steady, >65 hot
```

**Sector demand is banded in projection, never the raw value.** The exact number is a direct
input to job-availability rolls, and exposing it would let a player optimise against the
formula directly. But hiding *which* industries are hiring entirely would make every education
decision a blind guess — the opposite of Transparent Consequences. So a projection exposes
`demandBand(value)` and never `value`: a player learns that logistics is hot and retail is
cold, never that logistics is exactly 71.

`publishedIndicators` controls the rest — inflation, unemployment and interest are ordinary
published facts by default; a scenario may withhold them.

The `35`/`65` band thresholds are carried from upstream as provisional, the same status
`TODO.md`'s *Known Open Items* already gives the simulation kind's other unbalanced numbers —
tune once real demand distributions exist to tune against.

---

## 3. The Turn Is a Week

`story-graph` resolves one choice per action. This kind assembles a plan across several
actions and then resolves the whole week at once:

```text
plan.add / plan.remove / plan.clear     → mutate the pending plan, no week advance
end_week                                → resolve the plan, then run end-of-week systems,
                                          then start the next week
```

**Start-of-week ordering is normative and its two-phase time handling is load-bearing**
(upstream §12.1):

```text
time_advance   increment week, reset spent time units
effects        expire activeEffects past expiresAtWeek
time_commit    recompute committed time from job and course commitments
events         present responses deferred from last week
```

> **Why time is split across two phases.** The week must increment *before* expiry, because
> `expiresAtWeek` is compared against the new week number — but commitments must be
> recomputed *after* it, because an expiring "reduced hours" effect changes what those
> commitments are. Collapsing them forces one to be wrong, and the failure is silent: the
> player is quietly granted or robbed of time units with nothing to show it. This is the
> kind of rule the determinism harness cannot catch and the replay oracle (07) can.

**`initialState(campaign, ctx): InitialStateResult<KState>`** (04 §4) builds the calendar
at week one with a full time budget, the player and world state the campaign declares, and
an empty plan. `status` is always `"active"`: unlike `story-graph`, where an authored chain
can settle straight to an ending before the player ever acts, this kind has no path from
`initialState` to a terminal state — every `outcome()` value besides `null` (§12) requires
at least one `end_week`, and week one has not run yet. `InitialStateResult` exists so a kind
can report an immediate terminal state (04 §4: `KState` is opaque to the core, "so the kind
must *say so*"); this kind simply never needs to.

---

## 4. Actions — One Model, Richer Verbs

04 §3 states the core's action is a string `actionId` plus optional `params`, and anticipates
this kind mapping "richer verbs" onto it. Here is that mapping, which did not previously
exist:

| `actionId` | `params` | Effect |
|---|---|---|
| `plan.add` | `{ actionType, targetId?, … }` | Append to the pending plan |
| `plan.remove` | `{ index }` | Remove one planned action |
| `plan.clear` | — | Empty the plan |
| `end_week` | — | Resolve the plan and advance (§3) |

**Every one is a `submitAction` and appends one `LoggedAction`** (04 §2). Assembling a plan
is therefore replayable at the same grain as playing it — which matters, because a plan the
player built and revised is part of how the week turned out.

**This kind declares `params`**, unlike `story-graph` which rejects any (03 §8.2). That makes
it the first kind for which `08-session-capture` §3.2's rule has teeth: capture keeps only
*declared* parameters, and every parameter above is a declared id or an integer index — none
is free text.

**Plans are immutable.** Every edit produces a new plan; preview is free and never requires
re-validating from scratch.

### 4.1 The Weekly Action Plan

```typescript
interface WeeklyActionPlan {
  readonly week: number;
  readonly actions: readonly GameAction[];   // §7 once ported (upstream §9) — the action schema itself
}
```

Sized against upstream §9.1, minus the two fields §2's callout box already excludes —
`totalTimeCost`/`totalMoneyCostCents` are computed on read, never stored, for the same reason
every other derived value in this kind is (§2.5's `demandBand`, and §7's derived-value layer
once ported).

Upstream also carries a `finalized` flag with no setter and no defined effect — dropped here
entirely, not merely unstated. `plan.clear`/`plan.add`/`plan.remove` mutate nothing in place
(immutability, above); `end_week` consuming a plan already *is* the commit point, so a second
"are you sure" flag inside replayable state would duplicate a decision the action model already
makes. A client wanting a confirmation prompt owns that prompt as presentation, not state.

`GameAction`'s own shape (`ActionType`, `targetId`, `parameters`) is upstream §9, not §9.1 —
out of scope for this unit, ported alongside action resolution
(`plans/36-simulation-kind-programme.md`'s **W30**).

---

## 5. Resolution and `StateChange`

The pipeline dispatches per action type, validates, applies, and emits audit records
(upstream §10.0–§10.4). Two rules carry over unchanged because the core already adopted
them from here:

- **`StateChange` is an audit record emitted by typed reducers, never the mutation
  mechanism** (04 §12 — which cites this kind's §10.4 as its origin).
- **Immutability is unconditional**: every operation returns a new state.

A rejected action returns a `ValidationError` with its reason code, leaves state unchanged,
and does **not** advance the log (04 §4) — so `seq` repeats on the next attempt, with the
consequences 05 §5 and 07 §3.1 describe.

---

## 6. Player State

Nine areas: identity, finances, needs, attributes, education, career, housing, inventory,
relationships (upstream §8.1–§8.9), plus the base/derived-value layer they read through
(upstream §7). Both are ported below — the field-level port
`plans/36-simulation-kind-programme.md` calls **W28** (assigned as a real `W` number when this
unit is cut), sized against upstream §7 and §8.1–§8.9.

- **Money is integer cents; rates are integer basis points** — `Cents`/`BasisPoints` (§2),
  used throughout finances, career and housing below.
- **Derived values are computed, never stored** (§6.1) — for the reason in §2: a stored
  derived value can disagree with what it's derived from, and the disagreement is
  unresolvable.

### 6.1 Base and Derived Values

**State stores base values. Modifiers never write to state.** A derived value is computed on
read by applying every active modifier over the base — the fix for a defect upstream's earlier
revisions had: a modifier that *sets* a need to a fixed value for three weeks has nothing to
restore when it expires, if the base was overwritten rather than layered over.

```typescript
type DerivedPath =
  | `player.needs.${NeedKey}`                     // §6.5
  | `player.attributes.${keyof AttributeState}`    // §6.6
  | `player.skills.${string}`
  | "player.housing.quality"                       // §6.9
  | "player.career.effectivePerformance"           // §6.8
  | "calendar.energyRecoveryRate"
  | "world.strangeness";                           // §2.2

interface DerivedValueResolver {
  resolve(path: DerivedPath, base: number, effects: StatusEffect[]): number;
  isReadOnly(path: string): boolean;
}
```

`DerivedPath` is a closed union — the same reason `ActionType` is (§9, once ported): it is what
lets Tier 1 validation (§14) reject a `Modifier` targeting a derived field at load time, rather
than discovering it at runtime. A path can name a value with no literal stored counterpart
(`career.effectivePerformance`, `calendar.energyRecoveryRate`) precisely because it is
derived — computing it does not require anything to have been written down first.

**Application order is fixed:**

```text
1. base value
2. all `add` and `subtract` modifiers, summed
3. all `multiply` modifiers, multiplied
4. `set` overrides, highest priority wins; ties broken by earliest appliedWeek
5. clamp to the field's declared range
```

**Stacking** is governed by `StatusEffect.stacking` (§2.3): a second effect from the same
`sourceId` with `"refresh"` replaces the first and resets its expiry; `"stack"` adds a second,
independent layer. Two different sources always stack.

**Expiry** is removal from `activeEffects` at the *start* of the week following
`expiresAtWeek` (the `effects` entry in §3's start-of-week order) — an effect expiring in week
12 still applies throughout week 12. Because nothing was ever overwritten, expiry has nothing
to undo; the derived value simply recomputes against a shorter effect list.

Derived paths are read-only: a `Modifier` or content effect targeting one is a Tier 1
validation error (`read_only_field`, already a base reason code).

> **Provisional, not settled.** Resolving a derived value on every access costs against a
> performance budget this contract does not itself set a number for. The assumed mitigation is
> memoizing per week per path, invalidated when `activeEffects` changes — carried from
> upstream as the intended strategy, not yet measured against anything real in this repository.
> If it turns out wrong, the caching strategy changes; the layer model above does not.

### 6.2 The Shared Actor Shape

**The player and every rival share one shape.** A rival obeying different mechanics than the
player would be undetectable drift, not a feature — the only way to guarantee identical rules
structurally is for both to run the same state through the same systems.

```typescript
interface ActorState {
  identity: ActorIdentity;          // §6.3
  currentLocationId: string;
  finances: FinancialState;         // §6.4
  needs: NeedState;                 // §6.5
  attributes: AttributeState;       // §6.6

  education: EducationState;        // §6.7
  career: CareerState;              // §6.8
  housing: HousingState;            // §6.9

  inventory: InventoryItem[];       // §6.10
  relationships: RelationshipState[]; // §6.11

  skills: Record<string, number>;
  traits: string[];
  reputation: Record<string, number>;

  flags: Record<string, boolean>;
  counters: Record<string, number>;  // hidden — never appears in a projection
}

/** The player is an actor. Alias kept for readability at call sites. */
type PlayerState = ActorState;
```

`SimulationKindState.player: PlayerState` (§2) is this same shape; a rival is
`AgentState.actor: ActorState` (§7 once ported, upstream §14.9) — identical fields, run through
identical resolvers. Porting "player state" narrowly and adding rival support later was
considered and rejected: it would produce a shape that has to be re-derived the moment a rival
exists, rather than one written correctly once.

**Needs, skills, attributes and reputation values are integers in `0–100`**, matching this
kind's numeric-representation rule (§2.1's `Cents`/`BasisPoints` sit beside this same rule
upstream). Not a type-level constraint — `number` cannot express a bounded integer range in
TypeScript — so it is enforced the same way every other declared range in this kind is: Tier 1
validation once the relevant content type exists to declare the bound against (§14), and typed
reducers that clamp on write, never a raw assignment.

**`skills`, `reputation`, `flags` and `counters` are open-keyed `Record`s, not a violation of
"the loose bag is banned" (`02-architecture.md` N6).** N6's own reasoning names what it
protects against: *this kind's* typed-reducer discipline (§5 — `StateChange` is emitted only by
typed reducers, never an arbitrary mutation), which is the mechanism story-graph's
`VariableSchema` (03 §2) exists to bring to a campaign-authored variable bag that has no such
reducers of its own. Every key entering these `Record`s arrives through a resolver that already
knows the id is real — a reward granting a skill, an achievement condition reading a counter —
and once content types are ported (§7), Tier 1 validation (§14) checks referential integrity the
same way it will for every other content-id reference in this kind. `counters` in particular is
filled two ways: **automatically**, incrementing `counters[change.reason]` for every emitted
`StateChange` (the reason-code vocabulary is already a taxonomy of things that happen, so
statistics like "times evicted" or "checks failed" come free), and **explicitly**, from a
`"counter"`-type `Reward` (§7 once ported) for statistics that are not state changes in their
own right. Both paths write through typed code, never through a client-supplied key.

**All four are subject to the sorted-iteration rule (§2).** `counters` is the newest and the
easiest to forget, because the automatic path writes to it from inside every reducer rather
than from one obvious call site.

`counters` never appears in a projection, for the same reason `luck` (§6.6) and `resentment`
(§6.11) do not: a player who can see the count knows they are being measured, which defeats
the point of measuring it.

### 6.3 Identity

```typescript
interface ActorIdentity {
  actorId: string;          // "player" or a rival's agent id
  name: string;
  age: number;
  backgroundId: string;     // §7 once ported (upstream §14.8) — BackgroundDefinition
}

type PlayerIdentity = ActorIdentity;
```

`actorId` is load-bearing, not decorative: relationships are held per actor (§6.11) and NPCs
remember things about specific actors (§7 once ported, upstream §14.6), so every actor must be
individually addressable.

### 6.4 Finances

```typescript
interface FinancialState {
  cashCents: Cents;
  savingsCents: Cents;
  debtCents: Cents;

  weeklyIncomeCents: Cents;
  weeklyExpensesCents: Cents;

  overdueBalanceCents: Cents;
  creditScore?: number;

  accounts: FinancialAccount[];
}

interface FinancialAccount {
  id: string;
  kind: "checking" | "savings" | "credit_card" | "loan" | "investment";
  label: LocKey;

  balanceCents: Cents;            // negative = owed
  interestRate: BasisPoints;      // per annum

  minimumPaymentCents?: Cents;
  paymentDueWeek?: number;

  openedWeek: number;
  closedWeek?: number;
}
```

### 6.5 Needs

```typescript
interface NeedState {
  health: number;
  energy: number;
  happiness: number;
  stress: number;
  satiety: number;
}

type NeedKey = keyof NeedState;

const NEED_POLARITY: Record<NeedKey, "higher_is_better" | "lower_is_better"> = {
  health:    "higher_is_better",
  energy:    "higher_is_better",
  happiness: "higher_is_better",
  satiety:   "higher_is_better",
  stress:    "lower_is_better",
};
```

`NEED_POLARITY` exists so generic code — a "most urgent need" helper, rival need-scoring, goal
evaluation — cannot get direction wrong for `stress`, the one need where higher is worse.
Content-balance material (drift rates, clamp semantics) is out of scope here — already named
provisional in `TODO.md`'s *Known Open Items*.

### 6.6 Attributes

```typescript
interface AttributeState {
  intelligence: number;
  discipline: number;
  charisma: number;
  creativity: number;
  resilience: number;
  wisdom: number;
  luck: number;      // hidden — never appears in a projection
}
```

`wisdom` has no consumer specified anywhere in this contract or upstream — already tracked in
`TODO.md`'s *Known Open Items* ("`wisdom` attribute has no consumer... needs one to earn its
place"), not repeated as a second open item here.

### 6.7 Education

```typescript
interface EducationState {
  enrollments: CourseEnrollment[];
  credentials: Credential[];
  completedCourseIds: string[];
  failedCourseIds: string[];
}

interface CourseEnrollment {
  courseId: string;               // §7 once ported (upstream §14.2) — CourseDefinition
  startedWeek: number;
  weeksCompleted: number;

  attendedUnits: number;
  studyUnits: number;
  missedSessions: number;

  tuitionPaidCents: Cents;
  tuitionOutstandingCents: Cents;

  retainedProgress: number;      // 0–100, carried from a prior failed attempt
  status: "active" | "completed" | "failed" | "withdrawn";
}

interface Credential {
  id: string;
  courseId: string;
  awardedWeek: number;
  level: CredentialLevel;
  labelKey: LocKey;
}

type CredentialLevel =
  | "none"
  | "school"
  | "certificate"
  | "diploma"
  | "degree"
  | "postgraduate";
```

`CredentialLevel` is ordered, which is what makes a scenario requirement like "certificate or
better" directly expressible rather than needing an enumerated list of acceptable values.

### 6.8 Career

```typescript
interface CareerState {
  currentEmployment?: Employment;
  history: EmploymentRecord[];

  totalWeeksEmployed: number;
  pendingApplications: JobApplication[];

  highestTierAchieved: JobTier;
}

interface Employment {
  jobId: string;                 // §7 once ported (upstream §14.1) — JobDefinition
  employerId: string;
  startedWeek: number;

  performance: number;           // 0–100
  attendanceRatio: number;       // 0–100, rolling
  warnings: number;
  probationUntilWeek?: number;

  weeklyPayCents: Cents;
  weeksAtCurrentPay: number;
}

interface EmploymentRecord {
  jobId: string;
  employerId: string;
  tier: JobTier;
  startedWeek: number;
  endedWeek: number;
  endReason: ReasonCode;
  finalPerformance: number;
}

interface JobApplication {
  jobId: string;
  submittedWeek: number;
  resolvesWeek: number;
  contested: boolean;
  outcome?: "pending" | "offered" | "rejected" | "position_filled";
}

type JobTier = "entry" | "skilled" | "professional" | "senior";

const JOB_TIER_RANK: Record<JobTier, number> = {
  entry: 0, skilled: 1, professional: 2, senior: 3,
};
```

`JobTier` is ranked for the same reason `CredentialLevel` is ordered (§6.7): a career goal or
job requirement reading "skilled or better" needs an ordering, not just a tag. `career.
effectivePerformance` (§6.1's `DerivedPath`) is computed from `Employment.performance` plus
whatever `PerformanceFactor`s (§7 once ported, upstream §14.1) apply — never stored itself.

### 6.9 Housing

```typescript
interface HousingState {
  definitionId: string;           // §7 once ported (upstream §14.3) — HousingDefinition
  movedInWeek: number;

  ownership: "renting" | "owned" | "mortgaged" | "staying_with_someone";

  damage: number;                // 0–100, mutable
  weeklyCostCents: Cents;
  depositPaidCents: Cents;

  rentDueWeek: number;
  overdueRentCents: Cents;
  missedPayments: number;
  evictionStage: EvictionStage;

  landlordNpcId?: string;        // §7 once ported (upstream §14.6) — NPCState
}

type EvictionStage =
  | "none"
  | "warning"
  | "penalty"
  | "formal_notice"
  | "hearing_scheduled"
  | "evicted";
```

`quality` (§6.1's `player.housing.quality`) is derived and read-only, never stored: writing to
it fails Tier 1 validation the same way any other `DerivedPath` write does. Its formula —
`clamp(round((comfort + safety) / 2) − round(damage × 0.6), 0, 100)`, against
`HousingDefinition` fields not yet ported (§7) — is carried from upstream as provisional
content-balance material, the same status `TODO.md`'s *Known Open Items* already gives it.

### 6.10 Inventory

```typescript
interface InventoryItem {
  instanceId: string;
  definitionId: string;          // §7 once ported (upstream §14.4) — ItemDefinition

  quantity: number;
  acquiredWeek: number;
  purchasePriceCents: Cents;

  condition: number;             // 0–100
  weeksSinceMaintenance: number;
  broken: boolean;
}
```

### 6.11 Relationships

**A relationship is held by the actor, not by the NPC.** Each actor carries their own record of
how a given NPC regards them — the player and a rival can hold different, independent
relationships with the same NPC, which is what a competitive life sim needs (an NPC "social
climber" rival strategy, upstream design, is unimplementable any other way).

```typescript
interface RelationshipState {
  npcId: string;                  // §7 once ported (upstream §14.6) — NPCState
  category: "professional" | "personal" | "transactional" | "adversarial";

  affinity: number;
  trust: number;
  respect: number;
  resentment: number;      // hidden — never appears in a projection

  knownSinceWeek: number;
  lastInteractionWeek?: number;
  interactionCount: number;
}
```

The affective dimensions (`affinity`/`trust`/`respect`/`resentment`) live here, on the actor —
`NPCState` (§7 once ported) holds only what genuinely belongs to the NPC itself: its role,
availability and memories, none of which differ per observer.

---

## 7. Content Definition Types

Jobs, courses, housing, items, events, NPCs, goals, scenarios, agents (upstream §14.1–§14.9),
plus `Modifier` and `Reward` (upstream §13.3–§13.4) — simulation mechanics hanging off
`Condition`, not condition operators, so they belong here rather than in §8. Ported below —
the field-level port `plans/36-simulation-kind-programme.md` calls **W29** (assigned as a real
`W` number when this unit is cut), sized against upstream §13.3–§13.4 and §14.1–§14.9.

These are **campaign data**, loaded through the content registry (04 §10.1) exactly as
story-graph campaigns are. A simulation campaign is `kindId: "simulation"` plus data
conforming to this kind's schema — the same core/kind/campaign split (architecture §1), with
no new loading mechanism.

Identity fields — `id`, `version`, `titleKey` — live on the core `Campaign` envelope and
**not** in the kind's content types, the correction already applied to
`StoryGraphCampaign` (04 §10.1).

Every type below references `Requirement`/`RequirementType` (upstream §13.2) and `GameAction`'s
own schema (upstream §9) by name — neither is ported yet, deferred to the last contract unit
(`plans/36`'s W30, "Resolution and systems") alongside end-of-week ordering, which several of
these types also reference.

### 7.1 Modifiers and Rewards

```typescript
interface Modifier {
  target: string;                 // must resolve to a writable base path (§6.1's DerivedPath, or a stored field)
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  durationWeeks?: number;
  sourceId: string;
  priority?: number;              // `set` conflict resolution; default 0
}
```

Application order, stacking and expiry are §6.1's — this is the content shape that produces the
`StatusEffect.modifiers` (§2.3) `resolve` reads.

**`multiply`'s arithmetic, stated precisely.** `value` is basis-points-shaped: `value/100` is
the percentage change, so `value: 250` means "+2.50%" (a factor of `1.0250`), matching this
kind's `BasisPoints` convention (§2) exactly even though the field itself is typed `number`
here, not `BasisPoints` — `operation` is the discriminant a reader (and a validator) needs, the
same way `StateChange.value`'s meaning already depends on `StateChange.op` elsewhere in this
platform. Several `multiply` modifiers targeting the same path compose by multiplying their
exact factors together — never by rounding after each one — and **round-half-away-from-zero
applies exactly once, after the full chain is combined**, matching this kind's numeric
convention (§2) of stating a rounding rule at the point of use. Rounding after each step instead
of once at the end would let modifier *order* change the result of an operation §6.1 already
declares order-independent ("all `multiply` modifiers, multiplied" — a product, not a fold with
an intermediate rounding step), which would be a second, silent source of divergence beyond
whatever `add`/`subtract`/`set` already contribute.

> **A claim in `plans/36-simulation-kind-programme.md`'s own Finding 2 needed correcting while
> writing this section.** That finding — reasonably, given it's exactly the kind of hazard this
> kind's determinism story cares about — flagged `multiply` against integer-cents money as
> having "no rounding rule specified" upstream. Checked directly against the primary source
> while drafting this port: upstream *does* specify one, in the sentence immediately following
> `Modifier`'s own declaration. The finding missed it; the correction is recorded in `plans/32`
> and `plans/36` themselves, not just here, since a wrong claim about a primary source is worth
> fixing where it was made, not only where it was next read.

**Addressing collection members.** Several state collections are arrays rather than `Record`s
(§2, §6), and content needs to target one member — the landlord's affinity, one item's
condition. Array-typed state is addressed **by its natural key, never by index**:

| Collection | Key | Example target |
|---|---|---|
| `player.relationships` | `npcId` | `player.relationships.npc-landlord.affinity` |
| `player.inventory` | `instanceId` | `player.inventory.item-0041.condition` |
| `player.education.enrollments` | `courseId` | `player.education.enrollments.crs-bookkeeping.studyUnits` |
| `world.npcs` | `id` | `world.npcs.npc-landlord.currentRole` |

Index addressing is forbidden: array order is not part of the state contract (§2's canonical
iteration rule already establishes why insertion order cannot be load-bearing), so
`relationships.0.affinity` would target a different NPC after any reordering and silently
corrupt a save. Tier 1 validation (§14) rejects a numeric path segment.

```typescript
interface Reward {
  type: RewardType;
  target?: string;
  value?: unknown;
  parameters?: Record<string, unknown>;
}

type RewardType =
  | "credential" | "skill" | "attribute" | "money" | "item"
  | "reputation" | "relationship" | "unlock_location"
  | "unlock_course" | "opportunity" | "flag" | "modifier"
  | "counter";        // increments ActorState.counters (§6.2)
```

`RewardType` is the entire outcome vocabulary of this kind, in one closed union — every way a
job, course, event or achievement can change an actor's state funnels through it.

### 7.2 Jobs

```typescript
interface JobDefinition {
  id: string;
  titleKey: LocKey;
  descriptionKey: LocKey;

  employerId: string;          // EmployerDefinition, §7.9
  careerPathId: string;
  tier: JobTier;                // §6.8

  schedule: JobSchedule;
  compensation: JobCompensation;

  requirements: Requirement[];  // §13.2, deferred (W30)
  performance: JobPerformanceRules;

  promotionPaths: PromotionPath[];
  terminationRules: TerminationRule[];

  contested: boolean;
  positionsAvailable?: number;    // required when contested. Never Infinity — absent = uncontested (§2.2)

  tags: string[];
}

interface JobSchedule {
  weeklyTimeCost: number;
  flexibility: number;
  requiredDays?: string[];
  shiftTypes?: string[];
  remoteEligible?: boolean;
}

interface JobCompensation {
  baseWeeklyPayCents: Cents;
  performanceBonusCents?: Cents;
  commissionRate?: BasisPoints;
  overtimeRate?: BasisPoints;
  benefits?: string[];
}

interface JobPerformanceRules {
  factors: PerformanceFactor[];
  weeklyDriftToward: number;      // performance regresses toward this baseline
  minimumAcceptable: number;
}

interface PerformanceFactor {
  source: "skill" | "attribute" | "need" | "relationship" | "item" | "housing";
  key: string;
  weight: number;                 // may be negative, e.g. stress
}

interface PromotionPath {
  toJobId: string;
  minimumWeeksInRole: number;
  minimumPerformance: number;
  requirements: Requirement[];    // §13.2, deferred (W30)
  contested: boolean;
  baseChance: number;
}

interface TerminationRule {
  code: ReasonCode;
  condition: Condition;
  warningsBeforeTermination: number;
  severanceWeeks?: number;
  messageKey: LocKey;
}
```

`JobOpening.positionsAvailable` (§2.2) already established the "optional, absent = unbounded"
rule this type's own `positionsAvailable?: number` follows — stated once there, applied
consistently here rather than re-derived.

### 7.3 Courses

```typescript
interface CourseDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  providerId: string;

  tuitionCents: Cents;
  durationWeeks: number;
  weeklyTimeCost: number;
  difficulty: number;

  seatsAvailable?: number;        // absent = uncapped
  requirements: Requirement[];    // §13.2, deferred (W30)
  rewards: Reward[];              // §7.1
  awardsCredential?: CredentialLevel;  // §6.7

  failureRules: CourseFailureRules;
  tags: string[];
}

interface CourseFailureRules {
  minimumAttendanceRatio: number;
  minimumStudyUnitsPerWeek: number;
  maximumMissedSessions: number;
  tuitionGraceWeeks: number;
  maximumStress?: number;
  progressRetainedOnFailure: number;   // 0–100
}
```

### 7.4 Housing

```typescript
interface HousingDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  upfrontCostCents: Cents;
  weeklyCostCents: Cents;
  depositCents?: Cents;

  capacity: number;
  comfort: number;
  safety: number;
  prestige: number;
  storage: number;

  commuteModifier: number;
  energyRecoveryModifier: number;
  happinessModifier: number;
  healthModifier: number;

  maintenanceRisk: number;
  unitsAvailable?: number;        // absent = uncapped

  requirements: Requirement[];    // §13.2, deferred (W30)
  tags: string[];
}
```

`comfort`/`safety`/`damage` feed `player.housing.quality` (§6.1, §6.9) — the derived, read-only
value this kind computes rather than stores.

### 7.5 Items

```typescript
interface ItemDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  category: string;

  purchasePriceCents: Cents;
  baseResaleValueCents: Cents;
  weeklyCostCents?: Cents;

  effects: Modifier[];             // §7.1
  stacking: "refresh" | "stack";

  durability?: number;
  maintenanceRules?: MaintenanceRule[];

  requirements: Requirement[];     // §13.2, deferred (W30)
  tags: string[];
}

interface MaintenanceRule {
  intervalWeeks: number;
  costCents: Cents;
  timeCost: number;
  skillCheck?: CheckDefinition;     // §7.6
  conditionLossIfSkipped: number;
  breakageChanceAtZeroCondition: number;
}
```

### 7.6 Events

```typescript
interface EventDefinition {
  id: string;
  category: string;
  titleKey: LocKey;
  descriptionKey: LocKey;

  weight: number;
  conditions: Condition;           // §8

  cooldownWeeks?: number;
  unique?: boolean;

  choices?: EventChoice[];
  automaticOutcome?: EventOutcome;

  chainId?: string;
  chainStep?: number;

  tags: string[];
}

interface EventChoice {
  id: string;
  labelKey: LocKey;

  timeCost?: number;
  moneyCostCents?: Cents;

  requirements?: Requirement[];    // §13.2, deferred (W30)
  check?: CheckDefinition;

  outcomes: ConditionalOutcome[];
}

interface ConditionalOutcome {
  condition?: Condition;           // §8
  onDegree?: ActionOutcome["degree"][];  // §9/§10, deferred (W30)
  weight?: number;
  outcome: EventOutcome;
}

interface EventOutcome {
  effects: Modifier[];             // §7.1
  rewards?: Reward[];              // §7.1
  messages: OutcomeMessage[];      // 04 §12

  generatedEvents?: string[];
  scheduledEvents?: Array<{ eventId: string; inWeeks: number }>;    // §2.3
  generatedOpportunities?: string[];                                // §2.3

  advancesChain?: boolean;
  endsChain?: boolean;             // §2.3
}

interface CheckDefinition {
  skill?: string;
  attribute?: keyof AttributeState;   // §6.6
  difficulty: number;

  modifiers?: CheckModifier[];
  criticalSuccessMargin?: number;
  criticalFailureMargin?: number;

  minimumChance?: number;         // default 5
  maximumChance?: number;         // default 95
}

interface CheckModifier {
  source: "skill" | "attribute" | "need" | "reputation" | "relationship" | "item";
  key: string;
  weight: number;
}
```

An event whose selected choice's outcome is non-empty (has choices at all) defers to the
following week via `PendingEventResponse` (§2.3); an event with only `automaticOutcome` resolves
immediately within end-of-week processing (§12.2, deferred, W30). `ConditionalOutcome.onDegree`
forward-references `ActionOutcome`'s own `degree` field — action resolution's shape, deferred to
the same unit that defines it.

### 7.7 NPCs

```typescript
interface NPCDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  defaultRole: string;
  initialRelationship: NPCRelationship;
  availability: AvailabilityRule[];

  tags: string[];
}

interface NPCState {
  id: string;
  definitionId: string;

  memories: NPCMemory[];

  currentRole: string;
  availability: AvailabilityRule[];

  flags: Record<string, boolean>;
}

/** The affective dimensions, structurally — held by actors (§6.11), not by NPCs. An NPC's own
 *  `initialRelationship` (above) is the seed an actor's own RelationshipState starts from, not
 *  a relationship the NPC itself carries. */
interface NPCRelationship {
  affinity: number;
  trust: number;
  respect: number;
  resentment: number;    // hidden — never appears in a projection
}

interface NPCMemory {
  id: string;
  aboutActorId: string;      // whom this memory concerns — §6.3's actorId
  eventId?: string;
  week: number;

  category: string;
  magnitude: number;

  descriptionKey: LocKey;
  expiresAtWeek?: number;
}

interface AvailabilityRule {
  locationId?: string;        // §7.9
  fromWeek?: number;
  toWeek?: number;
  condition?: Condition;      // §8
}
```

`WorldState.npcs: NPCState[]` (§2.2) forward-referenced this shape; it lands here. `NPCState`
holds only what genuinely belongs to the NPC — role, availability, memories — never the
affective dimensions, which `RelationshipState` (§6.11) already established live per-actor: the
same NPC can respect the player and resent a rival simultaneously.

### 7.8 Goals, Scenarios, and Difficulty

```typescript
interface GoalDefinition {
  id: string;
  labelKey: LocKey;
  descriptionKey: LocKey;
  category: string;

  conditions: Condition;              // §8
  requiredDurationWeeks?: number;
  failureConditions?: Condition;      // §8

  rewards?: Reward[];                 // §7.1
}

interface ScenarioDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  startingBackgroundIds: string[];    // §7.9
  startingCashCents: Cents;
  startingHousingId: string;          // §7.4
  startingLocationId: string;         // §7.9
  startingInventory: Array<{ definitionId: string; quantity: number }>;

  goalIds: string[];
  weekLimit?: number;
  mode: GameMode;

  goalFailurePrecedence: GoalFailurePrecedence;   // default "goals_win"
}

type GameMode = "classic" | "open_life" | "challenge";
type GoalFailurePrecedence = "goals_win" | "failure_wins";

interface DifficultyDefinition {
  id: string;
  labelKey: LocKey;

  economyModifiers: Modifier[];        // §7.1
  needDriftModifiers: Modifier[];      // §7.1
  checkDifficultyOffset: number;

  rivalInformationAccess: "standard" | "enhanced";
  rivalStartingAdvantages: Modifier[];  // §7.1
}
```

`GoalFailurePrecedence` and its default are already load-bearing in §12 (Terminal Identity) and
flagged there as provisional against `week_limit_reached`'s own precedence — restating the type
here does not resolve that; §12's own callout stands. Every rival advantage is declared on
`DifficultyDefinition` and nowhere else, which is what makes an "any advantage must be explicit"
audit possible at all: a rival that is simply better at something the definition doesn't name
would be undetectable drift, the same class of risk §6.2 raised for actor-state parity.

### 7.9 Supporting Definitions

```typescript
interface OpportunityDefinition {
  id: string;
  kind: OpportunityKind;           // §2.3
  targetId: string;                // jobId, courseId, housingId, npcId — by kind

  nameKey: LocKey;
  descriptionKey: LocKey;

  durationWeeks: number;           // how long the offer stands once made
  weight: number;                  // pool selection — hidden, never projected
  conditions?: Condition;          // §8 — eligibility to be offered at all
  requirements?: Requirement[];    // §13.2, deferred (W30) — what accepting demands

  terms?: Record<string, unknown>;
  acceptRewards?: Reward[];        // §7.1
  contested: boolean;              // may be revoked when the position is filled (§2.3)

  tags: string[];
}

interface AchievementDefinition {
  id: string;
  nameKey: LocKey;                // player-facing flavour, not a mechanical description
  descriptionKey: LocKey;

  condition: Condition;           // §8 — typically over counters, §6.2
  hidden: boolean;                // true = not listed until unlocked

  scope: "profile";                // v1: always profile-scoped
}

interface HeadlineDefinition {
  id: string;
  textKey: LocKey;

  minStrangeness?: number;         // §2.2
  maxStrangeness?: number;
  conditions?: Condition;          // §8

  tags: string[];
}

interface EmployerDefinition {
  id: string;
  nameKey: LocKey;
  sector: string;
  reputation: number;              // hidden
  jobIds: string[];                // §7.2
  npcIds: string[];                // §7.7
}

interface LocationDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  connections: string[];           // adjacent location ids — the map graph
  travelTimeUnits: number;         // cost to enter this location from an adjacent one
  actionTypes: ActionType[];       // §9, deferred (W30) — what can be done here

  unlockedBy?: Condition;          // §8
}

interface BackgroundDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  startingAttributes: AttributeState;    // §6.6
  startingSkills: Record<string, number>;
  startingCredentials: CredentialLevel[]; // §6.7
  startingTraits: string[];
  startingCashModifierCents: Cents;
}

interface TraitDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  effects: Modifier[];              // §7.1
  conflictsWith: string[];
}

interface SkillDefinition {
  id: string;
  nameKey: LocKey;
  category: string;
  decayPerWeek: number;
}
```

**`travel`'s map is an explicit adjacency graph, not pathfinding.** `travel` moves to an
*adjacent* location only — its `targetId` is a location id, its derived time cost is that
location's `travelTimeUnits`, and it is valid only when the target appears in the current
location's `connections`. A multi-hop journey costs multiple actions and multiple time units by
design: geography is a real budget line, not a solved-away convenience. An action whose type is
not in the current location's `actionTypes` fails with `wrong_location` (§10, once that reason
code has a real dispatcher to attach it to — W30).

### 7.10 Agents

```typescript
interface AgentStrategy {
  id: string;
  selectActions(view: PublicWorldState, agent: AgentState): GameAction[];  // §9, deferred (W30)
}

interface AgentState {
  id: string;
  strategyId: string;
  displayNameKey: LocKey;

  actor: ActorState;              // §6.2 — identical shape to the player
  goals: GoalState[];             // §2.4

  planningDepth: number;
  strategy: Record<string, unknown>;   // hidden — never projected
}
```

`WorldState.agents: AgentState[]` (§2.2) forward-referenced this shape; it lands here, closing
the last forward reference `plans/36`'s "actor state comes over whole" finding (§6.2) named. The
rival runs `ActorState` unmodified — the same code path the player's own actions resolve
through — so `strategy`/`planningDepth` are the *only* fields this type adds beyond an ordinary
actor, and both are hidden from every projection. `AgentStrategy.selectActions`'s own
`PublicWorldState` parameter is a projection type (§9, once fully specified) — an agent decides
from the same visible information a client would see, never from the hidden state a
`DerivedValueResolver` (§6.1) or a resolver itself can read.

---

## 8. Conditions and Requirements

Reused verbatim from the core's frozen operator set (04 §18), which originated here
(upstream §13.1). This kind adds no operators. `between`, arithmetic, and helper functions
are out unless a concrete campaign need justifies each individually — the bar 04 §18 sets
deliberately high, and this kind is the one most likely to test it.

**This section's scope is conditions only** (upstream §13.1). `Requirement`/`RequirementType`
(upstream §13.2) are deferred alongside `GameAction`'s own schema and end-of-week ordering —
§7's content types already reference `Requirement` by name; see §15. `Modifier` and `Reward`
(upstream §13.3–§13.4) are simulation mechanics, not condition operators, and are ported in
**§7.1**, not here.

---

## 9. Projection

`SimulationView` is the `kindView` inside the core's `PlayerView` (04 §9) and carries **only
what the generic surface does not** — the rule `StoryGraphView` follows (03 §9).

Hidden world state, unrevealed opportunities and NPC internals never cross the boundary. As
09 §6 puts it, the projection is what makes "the client cannot leak what the player should
not see" structural rather than a matter of client discipline.

---

## 10. Reason Codes

Codes this kind adds to the base set (`Kind.reasonCodes`, 04 §3, §12). Each needs a localized
message or registry validation fails:

| Code | When |
|---|---|
| `insufficient_time` | The plan exceeds available time units |
| `insufficient_funds` | The plan's cost exceeds available money |
| `action_not_planned` | `plan.remove` names an index the plan does not have |
| `plan_empty` | `end_week` with nothing planned, where the campaign forbids it |
| `week_limit_reached` | The scenario's week cap is exhausted |

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`.

Each code's `messageKey` lives under `simulation.reason.<code>` (04 §12), the
`<kindId>.reason.*` convention — not to be confused with 05 §9's `kind.<kindId>.*` *event*
namespace, §11 below.

---

## 11. Events

Namespaced `kind.simulation.*` (05 §9), declared as `Kind.eventNames`:

| Name (after `kind.simulation.`) | Severity | Emitted at |
|---|---|---|
| `plan.changed` | `debug` | Any `plan.*` action |
| `week.started` | `info` | After start-of-week systems (§3) |
| `system.ran` | `trace` | Once per system, in order |
| `action.resolved` | `debug` | Per planned action during `end_week` |
| `effect.expired` | `debug` | An `activeEffect` passed `expiresAtWeek` |
| `goal.achieved` | `info` | A goal's completion condition met |
| `goal.failed` | `info` | A goal's failure condition met |
| `week.ended` | `info` | End of resolution |

`system.ran` earns its place: the two-phase time ordering in §3 is the rule most likely to
regress silently, and a stream that names each system in order localizes such a regression to
the phase that moved.

---

## 12. Terminal Identity

`Kind.outcome` (04 §3) returns this kind's terminal identity for the replay oracle
(07 §3.3):

```typescript
outcome(state: SimulationKindState): {
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;  // null while active
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
}
```

This kind has **no ending concept** — nothing upstream resembles `story-graph`'s `Ending`
type — so unlike that kind's `{ endingId: string | null }`, terminal identity here is
`resolution` plus which goals landed on which side. `resolution` carries three non-null
values, not two: `week_limit_reached` is a genuine third terminal path this kind already
names as a reason code (§10), distinct from tripping a failure condition. `goalsFailed`
exists because `goalFailurePrecedence` (upstream §12.3) can default a game to `goals_met`
*while* other goals failed — without it, that playthrough and a clean sweep would produce
identical outcomes. `failureId` is deliberately absent: unlike `world-graph`, whose failure
conditions are independent of its objectives, this kind's failures hang off goals, so the
failing goal is already in `goalsFailed` — naming *which one* ended the game when several
fail in the same week would expose iteration order, not a fact about the game.

Published ids only — never money, needs, or week counts, all of which a balance pass changes
legitimately and none of which a regression oracle should treat as a defect (07 §3.4).

> **This shape fixes the three terminal *values*, not yet their precedence.** Upstream
> §12.2's `END_WEEK_SYSTEM_ORDER` runs `goals` before `failure` and names no week-limit
> check at all; §12.3's `goalFailurePrecedence` resolves only the goals-vs-failure tie.
> Whether a week that simultaneously exhausts `weekLimit` *and* resolves every goal reports
> `week_limit_reached` or `goals_met` is genuinely open — not merely undocumented here, but
> unresolved in the upstream source this section would port from. §15 already lists
> §12.2–§12.3 as not-yet-ported end-of-week material; this is the concrete reason that
> matters for `outcome()` specifically; treat `week_limit_reached`'s precedence against the
> other two as provisional until that lands, the same as `history`'s status in §2.

---

## 13. Determinism

Every random draw comes from `ctx.rng`, the handle derived for this resolution from
`(seed, streamId)` (04 §3.1, §8). Nothing is written back; the envelope stores the seed and
nothing else.

**Substreams matter more here than in `story-graph`.** A week's resolution draws in several
systems, and substreams mean adding a draw in one never renumbers another (04 §8, from
upstream §3.2). Without that, inserting one event roll would silently change every later
outcome in the game.

---

## 14. Validation

`Kind.validateCampaign(campaign, strings)` (04 §11) is where this is implemented — pure,
total, run once at registry construction, before the registry is frozen.

**Deferred, the way §2 defers `history`, rather than left unraised.** Concrete Tier 1/Tier
2 rules need the content types §7 defers to §15 — a job/course/housing id can't be checked
for referential integrity before the type naming those ids exists. Once it does, the shape
follows 03 §11 and 12 §15's precedent directly: Tier 1 (hard fail) for duplicate ids,
dangling references between content types (a job naming a `requiredCredentialId` that
doesn't exist), missing `LocKey`s, and out-of-range declared values; Tier 2 (warning) for
unreachable content (a goal no scenario's `goalIds` ever names) and non-fatal authoring
smells. **Revisit when** §15's content-type port lands.

---

## 15. What Remains Upstream, and Why

This is the seam, not the whole kind. Still to be brought over from
`games/04-engine-specification.md`, in the order that unblocks the most:

Everything left is one unit — `plans/36-simulation-kind-programme.md`'s **W30**, "Resolution and
systems":

| Upstream | Holds | Why not yet |
|---|---|---|
| §9 | `ActionType`, `GameAction` | The action schema `WeeklyActionPlan.actions` (§4.1) holds. Needs the resolver dispatch it's ported alongside, so a reader isn't handed a schema with nothing that executes it |
| §13.2 | `Requirement`, `RequirementType` | Referenced by name throughout §7's content types; ties to action/requirement validation, ported with resolution rather than standing alone |
| §12.2–§12.3 | End-of-week system order, goal precedence | Normative and short; needs `GameAction`/`Requirement` above, since the systems it orders dispatch on both |

**Every other row this table used to carry is closed.** `§5.1`, `§5.3–§5.6`, `§7`, `§8.1–§8.9`,
`§13.3–§13.4` and `§14.1–§14.9` are all ported (§2.1–§2.5, §4.1, §6.1–§6.11, §7.1–§7.10) — every
field `SimulationKindState` (§2) names now has a full shape specified in this repository, so
does the base/derived-value layer they read through, and so does every content definition type
a real campaign will need to declare.

Two findings came out of this pass rather than being plain transcription. `ActorState` comes
over whole, shared verbatim by the player and every rival (§6.2) — porting "player state" alone
and adding rival support later was considered and rejected
(`plans/36-simulation-kind-programme.md` Finding 1). And `plans/36`'s own Finding 2 needed
correcting, not just applying: it claimed upstream specifies no rounding rule for
`Modifier.operation: "multiply"` against this kind's integer-cents money, and upstream in fact
does — checked directly against the primary source while drafting §7.1, and the correction is
recorded in `plans/32` and `plans/36` themselves, not only here.

**Nothing above changes this contract's shape** — each is detail hanging off a seam this
document fixes. What it does mean is that the upstream sections stay authoritative for those
areas until ported, which is exactly what `04-core`'s *Reused, not re-derived* note says.
