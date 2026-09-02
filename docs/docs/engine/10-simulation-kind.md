---
sidebar_label: Simulation Kind
---

<!-- Generated from design/20-contract.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Simulation Kind — Contract

**Document status:** Revision 2 — **the contract is whole.** Every type `SimulationKindState`
(§2) names, the content definition types a real campaign will declare, and the resolution
mechanics that dispatch on them are all specified in this repository. §15 records what was
ported, in what order, and the findings each pass surfaced — no field-level detail remains
upstream as a gap in this contract's shape.

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
> owns and is cited, not re-derived, from here; the kind-specific half is restated in full
> below — see §15 for what was ported, in what order, and why.

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
  resolution: SimulationResolution | null;     // §12 — immutable once the `week_limit` system sets it
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
> that `StateChange` does not. Recorded in `90-decisions.md` §2.
>
> **`WeeklyActionPlan.totalTimeCost` / `totalMoneyCostCents`** — marked "engine-computed"
> upstream. Derived values do not belong in serialized state: they can disagree with the
> actions they summarise, and a disagreement is unresolvable. They are computed on read (§4.1).

**`resolution` is new against upstream, not carried from it, and mirrors a settled pattern
rather than inventing one.** `Kind.outcome(state: KState): unknown` (04 §3) takes only state
— no campaign, no `ScenarioDefinition` — so a scenario's `weekLimit` (§7.8) is invisible to
`outcome()` unless the fact of having crossed it is captured while campaign data is still in
scope, during `end_week`'s own resolution, and persisted onto state for `outcome()` to read
back. `12-world-graph-kind.md` §8 already carries the identical shape (`WorldGraphKindState
.resolution`, written once by its terminal system, read verbatim by `outcome()`) for the
identical reason. §12 below defines `SimulationResolution` and the `week_limit` system that
writes it.

The rest of this section restates every field type `SimulationKindState` names above.
`PlayerState` is the one exception, and only because it is large enough to own a section:
§6 restates it in full. This section's own port — `plans/36-simulation-kind-programme.md`
proposed it as W27 and it was cut as **W32** — is sized against upstream §5.1, §5.3–§5.6.
§15's table is the single place that maps every proposed number to the one actually cut.

Two primitives recur across several of these types and are introduced once, here, rather than
per-field: **money is integer cents**, and **rates are integer basis points**, matching
upstream §2.1 and already stated as this kind's own rule in §6 below.

```typescript
type Cents = number;         // integer; 1234 === $12.34
type BasisPoints = number;   // integer; 250 === 2.50%
```

Both are simulation-kind primitives — no other kind has a money concept — reused by every
later section that needs them, including §6 (Player State) and §7 (Content Definition Types).

**A second recurring rule: `Record<string, T>` iteration that affects state must use sorted
keys.** `Record` key order follows insertion order, which after a `serialize`/`deserialize`
round trip follows the order of keys in the JSON text — so an iteration whose *result* depends
on order (weighted selection, decay, a scan that stops at the first match) can diverge between
a fresh game and a loaded one even though the two states are logically identical. Read-only
iteration for display is exempt. This is a real, upstream-inherited requirement (§2.2) that
`04-core.md` does not yet state generically — flagged here because this kind is the first with
`Record`-typed state fields whose iteration order is load-bearing, not because it is settled
that the rule belongs only here. Applies below to `WorldState.eventCooldowns` and
`EconomyState.sectorDemand`/`marketPrices` (§2.5), and to `PlayerState.skills`/`reputation`/
`counters` (§6.2).

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
  npcs: NPCState[];                          // §7.7
  locations: LocationState[];

  jobMarket: JobMarketState;
  eventCooldowns: Record<string, number>;     // eventId → week last fired. Sorted-iteration rule applies (above)
  firedUniqueEvents: string[];
  chainStates: EventChainState[];

  strangenessBase: number;                   // 0–100; the derived value below adds modifiers
  headlinePool: HeadlinePoolState;

  agents: AgentState[];                      // rivals; empty in open_life mode. §7.10

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
unitsAvailable` (§7.3, §7.4) already use for an identical "uncapped" concept — `JobOpening` is
the one place upstream reached for a literal infinity instead of its own more common convention.

#### Contested-Resource Resolution (W101)

`JobOpening.contested`/`positionsAvailable`, `PromotionPath.contested`, and
`OpportunityDefinition.contested` (§7.9) each name a finite resource two or more actors can
claim in the same week — the player and, once `ScenarioDefinition.rivals` (§7.8) is non-empty,
one or more `AgentState`s (§7.10). Every one of them resolves through the same pure function,
so "who wins a tie" is one rule, not one per resource type:

```typescript
interface ContestClaim {
  actorId: string;      // "player" or an AgentState.id (§6.3)
  score: number;         // resource-specific: e.g. a job application's qualification score
}

/** Deterministic, total-order resolution of `positionsAvailable` slots among `claims`.
 *  Ties break on `actorId` ascending (`String.prototype.localeCompare` with the "en-US-POSIX"
 *  collation this kind already uses for the sorted-iteration rule, §2) — never on claim order,
 *  which is construction-order-dependent and exactly what the sorted-iteration rule forbids. */
function resolveContest(claims: readonly ContestClaim[], positionsAvailable: number):
  { won: readonly string[]; lost: readonly string[] };
```

**No random draw.** A contest is decided by `score` — itself computed by the resolver that
built each `ContestClaim` (a job application's qualification, a business opportunity's bid),
which may draw on `ctx.rng` while computing it — but `resolveContest` itself is pure
comparison, so replaying the same claims always produces the same winners without consuming a
stream. This is what makes W101.7's "one filled position decrements the count, the last
retires the opening" true independent of iteration order: `resolveContest` sorts by
`(score desc, actorId asc)` and takes the first `positionsAvailable` entries, full stop.

**A losing claim on a contested resource is `Revoked` (§2.3's opportunity-lifecycle table) or
its job/promotion equivalent — never a duplicate `Reward`.** The resolver that lost applies no
completion reward; only the resolver(s) in `won` do. This is the same rule §2.3 already states
for `Opportunity` revocation, generalized to every contested resource `resolveContest` now
governs rather than restated per resource type.

#### World Strangeness

Content gates events and headlines on a **derived** strangeness value, not the raw
`strangenessBase` above — so a `Modifier` (§7.1) can push it, and so the raw number never leaks
into a projection. The player is meant to notice the drift, not read the dial.
`strangenessBase` itself rises on a curve with elapsed weeks; the curve's shape is
content-balance material, out of scope here the same way §6.1's derived-value formulae are
content-balance material rather than part of the mechanism itself.

#### Chain Scope, and Where a Profile Chain Lives

Scope is declared per chain, not globally, because event chains are not all the same kind of
thing: a `"game"`-scoped chain cannot survive past this game (an eviction ladder should not
follow a new character into their next life), while a `"profile"`-scoped chain is meant to
outlive any single game.

**Scope is authored, not inferred.** `EventChainState.scope` had no source: the only chain
vocabulary a campaign could write was `EventDefinition.chainId`/`chainStep` (§7.6), which names
a chain without saying what kind of thing it is. `SimulationCampaign.eventChains` (§7.13) is
that source — one `EventChainDefinition` per chain, carrying its `id` and its `ChainScope`, and
nothing else, because the chain's membership and order are already fully determined by the
events that declare `chainId`/`chainStep` and duplicating them here is the envelope-duplication
defect one level down.

**The storage question is closed.** A `"profile"`-scoped `EventChainState` needs somewhere to
live that is *not* `GameState`/`SimulationKindState` — by definition, since it must survive the
game that is ending. `PlayerProfile.kindData` (04 §7.1) is that place: one kind-owned,
core-opaque slice per kind, written through the same mirror the achievement and terminal
upserts already use. This kind's slice:

```typescript
/** `Kind.profileData.version` 1. Sorted by `(campaignId, chainId)` ascending, so one
 *  profile has exactly one canonical serialization. */
interface SimulationProfileData {
  chains: readonly SimulationProfileChainRecord[];
}

interface SimulationProfileChainRecord {
  campaignId: string;    // a chainId is only unique within a campaign — as AchievementRecord's is
  chainId: string;
  furthestStep: number;  // the highest `EventChainState.currentStep` any game reached
}
```

**`furthestStep` is a maximum, and every field here is chosen so the fold is idempotent.**
`fold` reads the `profile_chain_advanced` audit records (§10) out of one action's `changes`,
takes `max(existing, value)` per `(campaignId, chainId)`, and returns the record set. Applying
the same records twice reaches the same value, so the store's canonical-equality check (04
§7.1) sees no change and writes nothing — which is what makes a reloaded, branched or
re-submitted transition create no duplicate entry, event, achievement or reward. A sum would
not have this property, and that constraint is what decides the shape rather than decorating
it.

**Seeding, at `createSession` and nowhere else.** `initialState` receives the migrated slice as
its `profileData` argument (04 §3, §5) and creates one `EventChainState` per declared
`"profile"`-scoped chain: `currentStep` from the matching record's `furthestStep`, or `0` when
the profile has none; `startedWeek: 0`; `active: false`. A seeded chain becomes active when its
next step fires, exactly as an unseeded one does. `"game"`-scoped chains are **not** seeded —
`chainStates` starts empty of them, unchanged, and the `events` system (§3) creates each when it
first fires. An anonymous session, a campaign declaring no `eventChains`, and a `profileData`
argument that is absent all produce the same thing: no seeded chains, and a `SimulationKindState`
byte-identical to what 0.10 produced.

**What a profile chain does *not* do.** It does not read back into resolution, does not reach
`project`, and is not part of terminal identity (§12) — it is an initialization input and an
audit mirror, nothing else. Two sessions under one profile therefore never observe each other
mid-game; each sees whatever the profile held when it was created.

> **Cumulative weeks across games is *not* resolved here, and is not part of this shape.**
> This section previously described a `"profile"`-scoped chain as advancing "on cumulative weeks
> played across every game under one profile". That phrase survives as intent and not as
> contract, because it demands an aggregate this design cannot make both idempotent and bounded:
> a sum is not idempotent under a refold, per-game keying is idempotent but unbounded, and a
> settle-on-game-change counter is bounded but races the two live sessions §7's own `profileId`
> lock domain exists because a profile legitimately has. `furthestStep` is the part that is
> well-defined, and it is the part W102.2 actually asks for. The remainder is recorded in
> `20-contract.md`'s own *Unresolved* section and in `90-decisions.md`'s open register.

### 2.3 Effects, Opportunities, and Scheduled Events

```typescript
interface StatusEffect {
  id: string;
  sourceId: string;
  sourceKind: "item" | "housing" | "trait" | "event" | "job" | "course" | "system";

  modifiers: Modifier[];         // §7.1

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
fresh budget. `end_week`, and any `plan.add` other than `respond_to_event`, refuse while a
`PendingEventResponse` remains unaddressed by the current plan — `event_response_pending`
(§10, W94).

#### Status Effect Lifecycle

**Application.** A `StatusEffect` is inserted into `activeEffects` by whichever resolver grants
it — an item's own effects syncing with `activeEffects` on every resolution (`sourceKind:
"item"`), an event outcome (`sourceKind: "event"`), or any other source named by
`StatusEffect.sourceKind`. Insertion goes through one shared function regardless of source:
`stacking: "refresh"` drops any existing effect with the same `sourceId` before adding the new
one; `stacking: "stack"` adds alongside whatever is already active. `appliedWeek` is stamped from
the current week at insertion.

**Expiry.** The `effects` step of start-of-week (§12.1), run immediately after the week
increments and before any other system, removes every effect whose `expiresAtWeek` is strictly
before the new week — an effect expiring in week 12 still applies throughout week 12 and is
removed only once the new week moves past it, at the start of week 13. An effect with no
`expiresAtWeek` is permanent and is never removed by this step; it persists until its own source
is resynced or replaced (as item effects are, above). Expiry emits `effect.expired` (§11) per
effect and produces no `StateChange` — there is nothing for a client to undo when a timer
elapses.

#### Opportunity Lifecycle

**Generation**, three paths, all producing an `Opportunity` from an `OpportunityDefinition`
(§7.9):

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

**"Just filled" means observed to be filled, and `world.jobMarket.openings` does not say
that.** That collection is written only by `search_for_work` (§5.2) — it holds the jobs *this
player has surfaced*, and is empty until they look. Absence from it is ignorance, not
evidence, and reading the two as the same thing revokes every unsolicited contested
`job_offer` on the first pass after it is made, whatever its `durationWeeks`, and makes a
contested `promotion` unsurvivable outright, since a promotion target is reached through
`JobDefinition.promotionPaths` (§7.3) and is never posted as an opening at all. Until rivals
exist (§7.10), the only filling this engine can observe is the player's own hire, so that is
what the predicate tests; it widens to rivals without changing shape.

**Why explicit decline exists.** Letting an offer lapse and refusing it to someone's face are
different acts once NPCs remember things (§7.7) — turning down a
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

#### Pending Event Response Lifecycle

**Creation** is stated above: firing a `ScheduledEvent` (or a random roll) that carries choices
queues a `PendingEventResponse` for presentation at the start of the following week.

**Resolution.** A `respond_to_event` action naming the pending entry's id is its only removal
path: the resolver removes that entry from `pendingEventResponses` as part of the same
`StateChange` set that records the chosen `choiceId` and applies the choice's costs. There is no
expiry — a `PendingEventResponse` has no `expiresAtWeek` field, and `end_week` and every other
`plan.add` refuse outright while one is unaddressed (`event_response_pending`, §10), so it
cannot be outlived by the calendar the way an `Opportunity` or `ScheduledEvent` can.

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

A `GoalState` is never removed once created: `status` transitions away from `"active"` on
completion or failure, but the entry stays in the set as a permanent record — matching how
retirement already works for `LoggedAction` and `StateChange`.

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

**End-of-week ordering is equally normative** (upstream §12.2), run once `end_week` has
resolved every planned action (§5):

```text
employment          education          finance_income     business
inventory            housing            finance_reconcile   needs
relationships         opportunities      events              headline
goals                 failure            week_limit          achievements
history
```

Order is stable and covered by test, the same as start-of-week. `headline` runs after `events`
so a week's headline can reference the strangeness level that week's own events just moved.
`achievements` runs second-to-last because an achievement condition may depend on anything
earlier in the pass, including a counter a `goals`/`failure` system just incremented.

**`business` (§7.12, W101) sits immediately after `finance_income`, before `inventory`/
`housing` — the same reasoning `finance_income` itself already states for running before
`housing`.** Business revenue/expenses (§7.12) must post before `housing` charges rent, so a
business's own income is spendable against this week's rent the same way wages already are;
it must post after `finance_income` rather than being folded into it, because
`finance_income` is specified (upstream, and this contract) as wages-and-scheduled-expenses
only — widening its own meaning to include business cashflow would be the kind of silent scope
creep this document's "one system, one concern" pattern (`employment` vs. `education` vs.
`inventory`, none of which absorb an adjacent concern either) exists to prevent. `business`
runs before `inventory`/`housing` rather than after `finance_income` alone, because
`BusinessRecord.status` closing insolvent (§7.12) is itself a cashflow fact this week's
`housing`/`finance_reconcile` passes should already see, the same "downstream systems see this
week's own upstream changes" property every other ordering choice in this list already
protects.

> **Why finance runs twice.** `finance_income` (wages in, scheduled expenses out) must run
> *before* `housing`, so rent is payable from this week's own wages; `finance_reconcile`
> (overdue balances, late fees, eviction advancement) must run *after* `housing`, so it can see
> rent that just went unpaid. A single combined `finance` pass satisfies only one of the two —
> rent charged before wages arrive produces false overdrafts for a solvent player, while
> reconciling before housing means eviction escalation lags its own trigger by a full week.
> Splitting the pass is the only ordering that satisfies both.

**`history` appears in this list as a system name, not as adopted state.** §2 already declines
`history: HistoryEntry[]` as a `SimulationKindState` field — the position in this ordering is
upstream's own, restated for completeness of the list, not evidence the field is coming.

**`week_limit` is added here, absent from upstream, and closes what was §12's open item.**
Upstream's `END_WEEK_SYSTEM_ORDER` never schedules a check of a scenario's `weekLimit` against
the current week at all — this contract's own addition, not a gap in transcription. It sits
after `failure` and before `achievements`: both `goals` and `failure` have had their turn
(and, per `goalFailurePrecedence` below, so has whichever of the two wins a same-week tie) by
the time it runs, and `achievements` (§12) must still see the final `resolution` before it
evaluates. `week_limit` writes `state.resolution = "week_limit_reached"` only when
`state.resolution` is still `null` and `scenario.weekLimit` is defined with
`state.calendar.currentWeek >= scenario.weekLimit` — so a week that both exhausts the limit
and lands a goal or a failure keeps that result; `week_limit_reached` is exclusively what a
week reports when neither `goals` nor `failure` had anything to say. §12 states the reasoning.

**Goals run before failure — a per-scenario tie-break, not a fixed rule.**
`ScenarioDefinition.goalFailurePrecedence: GoalFailurePrecedence` (§7.8, declared there
alongside the type it's shaped by) defaults to `"goals_win"`. When a completion condition and a
failure condition are both satisfied at the end of the same week, the default exists because
the alternative produces the worst available ending — reaching every goal while also being
evicted, reported as a loss — and punishes a player for a race they could not see coming.
`"failure_wins"` exists for a scenario that wants survival to matter more than achievement, an
authored difficulty choice rather than a global rule.

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
  readonly actions: readonly GameAction[];   // §4.2
}
```

Sized against upstream §9.1, minus the two fields §2's callout box already excludes —
`totalTimeCost`/`totalMoneyCostCents` are computed on read, never stored, for the same reason
every other derived value in this kind is (§2.5's `demandBand`, and §6.1's derived-value layer).

Upstream also carries a `finalized` flag with no setter and no defined effect — dropped here
entirely, not merely unstated. `plan.clear`/`plan.add`/`plan.remove` mutate nothing in place
(immutability, above); `end_week` consuming a plan already *is* the commit point, so a second
"are you sure" flag inside replayable state would duplicate a decision the action model already
makes. A client wanting a confirmation prompt owns that prompt as presentation, not state.

`GameAction`'s own shape (`ActionType`, `targetId`, `parameters`) is upstream §9, not §9.1 —
ported in §4.2, alongside action resolution.

### 4.2 Action Types

```typescript
type ActionType =
  | "work" | "work_overtime"
  | "search_for_work" | "apply_for_job" | "negotiate_job_terms"
  | "attend_class" | "study" | "enroll_course" | "withdraw_course"
  | "shop" | "eat" | "rest" | "exercise" | "socialize" | "travel"
  | "maintain_item" | "repair_item" | "sell_item"
  | "pay_bills" | "borrow_money" | "repay_debt" | "deposit_savings" | "invest"
  | "move_housing"
  | "start_project" | "work_on_project"
  | "start_business" | "operate_business"
  | "accept_opportunity" | "decline_opportunity"
  | "respond_to_event"
  | "custom";

interface GameAction {
  id: string;
  type: ActionType;
  actorId: string;               // §6.3 — "player" or a rival's agent id

  targetId?: string;
  parameters: Record<string, unknown>;
}
```

`ActionType` is a closed union, not `string` — the same reason `DerivedPath` (§6.1) is: an open
string type would make "is this action supported" a runtime question, and a `ResolverTable`
(§5.1) keyed by it could not be checked for completeness at compile time.

**`timeCost` and money cost are never fields here.** Both are always engine-derived (§5.2),
never client-supplied — trusting a client's own figure would mean a client (or a future natural-
language adapter translating intent into `"custom"`) chooses its own costs, which contradicts
the core principle that a client never manipulates authoritative state (04 §1). Fourteen
zero-cost job applications a week is exactly the failure mode a client-supplied cost would
allow.

**`"custom"` is the escape hatch for adapter-translated intent** (upstream §15.1, out of scope
for this contract) **and has no resolver** (§5.1) — a `GameAction` reaching resolution with
`type: "custom"` fails with `action_not_available`. An adapter must translate natural-language
intent into a concrete `ActionType` *before* submission; there is no route around the
`ResolverTable` for it to take, because there is no entry in the table to route to.

`plan.add`'s own `{ actionType, targetId?, … }` params (this section's table, above) map
directly onto `GameAction.type`/`targetId`/`parameters` — assembling a plan is choosing which
`GameAction`s it will hold, one `plan.add` at a time.

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

**What follows is internal to this kind's own `end_week` resolution — not part of the Kind
seam.** `Kind.advance` (04 §4) returns exactly one `AdvanceResult` per `submitAction` call; the
types below describe how *one* `end_week` call resolves the *several* `GameAction`s a plan can
hold before it produces that single result. `04-core.md`'s `StateChange`/`OutcomeMessage`
(§12) and `ValidationError`/`ValidationWarning` (§11) are reused throughout, unchanged — this
kind does not restate its own version of any of them, unlike upstream, whose own §10.2/§10.4
shapes predate and diverge from what the core later adopted (extra fields, extra `StateChange`
operations no reducer here uses). Porting upstream's versions verbatim would reintroduce
exactly the two-sources-of-truth problem the envelope-duplication rule exists to prevent, one
level down from state into result types.

### 5.1 Resolver Dispatch

```typescript
interface ActionResolver {
  readonly type: ActionType;                                          // §4.2

  canExecute(state: SimulationKindState, action: GameAction, ctx: KindContext): ActionValidation;
  calculate(state: SimulationKindState, action: GameAction, ctx: KindContext): ActionOutcome;
  apply(state: SimulationKindState, outcome: ActionOutcome): SimulationKindState;
}

type ResolverTable = Record<Exclude<ActionType, "custom">, ActionResolver>;
```

`Record` over the closed union means **a missing resolver is a compile error, not a runtime
surprise** — adding a member to `ActionType` without writing its resolver fails the build,
which is the behavior a union content files reference by name should have. `"custom"` is
excluded deliberately and has no resolver (§4.2).

Reconciled against 04 §3.1's `KindContext` rather than upstream's own bespoke
`ResolutionContext { registry, week, rng, derived }` — `KindContext` already carries
`registry`/`rng`/`derive` (`ctx.rng` *is* this action's substream); `week` is
`state.calendar.currentWeek` (§2.1), not a value the context needs to carry separately; and
`derived` is the `DerivedValueResolver` (§6.1), reachable the same way this kind reaches
anything else it defined rather than through a second, parallel context object upstream
invented before the real one existed.

### 5.2 The Resolution Pipeline

```text
receive action
→ validate action schema
→ validate actor, target, prerequisites, location
→ calculate time cost                          ← engine-derived, never client-supplied (§4.2)
→ validate available time
→ calculate money cost                         ← engine-derived, never client-supplied (§4.2)
→ validate money, inventory
→ calculate modifiers (§7.1)
→ perform a seeded random roll if required      (ctx.rng, §13)
→ produce an outcome
→ apply state changes via typed reducers
→ emit StateChange audit records
→ trigger dependent effects
```

One step from upstream's own pipeline is dropped rather than restated: **"record history"** —
consistent with `history` staying unadopted (§2) for the same reason it's absent from the
end-of-week order (§3).

### 5.3 Per-Action Outcome

```typescript
/** This kind's own runtime-validation result — distinct from 04-core's `ValidationResult`
 *  (04 §11), which is load-time *campaign* validation. Named differently on purpose: the two
 *  are not the same concept, and upstream's identical name for both was never disambiguated
 *  because upstream has no load-time campaign-validation concept of its own to collide with. */
interface ActionValidation {
  valid: boolean;
  errors: ValidationError[];      // 04 §11, reused
  warnings: ValidationWarning[];  // 04 §11, reused

  calculatedTimeCost?: number;
  calculatedMoneyCostCents?: Cents;
}

interface ActionOutcome {
  actionId: string;
  success: boolean;

  degree: "critical_failure" | "failure" | "partial" | "success" | "critical";

  reason: ReasonCode;

  changes: StateChange[];             // 04 §12, reused
  generatedEvents: string[];
  generatedOpportunities: string[];
  messages: OutcomeMessage[];         // 04 §12, reused
}
```

`degree` is why `ConditionalOutcome.onDegree` (§7.6) can branch an event's outcome on more than
pass/fail — a `"partial"` success and a `"critical"` one are different results content can
react to differently, not merely different flavors of the same success.

**`ResolutionDebugInfo` (upstream §3.3) is not ported.** It exists upstream to answer "why did
this action turn out this way," gated on a `metadata.transparency` field — but `metadata` lives
on the session-store record in this repository (§2, "outside replayable state"), not in
`SimulationKindState`, so there is no field here for it to gate on. This platform already has a
mechanism for exactly upstream's stated purpose — development, testing, balancing — that upstream
didn't have: a `trace`-severity event on the observability channel (05-observability.md), which
this kind already uses for `system.ran` (§11) for the identical reason (localizing a regression
to the phase that moved). Superseded, not merely absent.

## 6. Player State

Nine areas: identity, finances, needs, attributes, education, career, housing, inventory,
relationships (upstream §8.1–§8.9), plus the base/derived-value layer they read through
(upstream §7). Both are ported below — the field-level port
`plans/36-simulation-kind-programme.md` proposed as W28 and cut as **W33**, sized against
upstream §7 and §8.1–§8.9.

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
  resolve(path: DerivedPath, base: number, effects: readonly StatusEffect[]): number;
  isReadOnly(path: string): boolean;
}
```

`DerivedPath` is a closed union — the same reason `ActionType` is (§4.2): it is what
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

**`isReadOnly` partitions `DerivedPath`; it does not cover it.** Being derived is not what
makes a path unwritable — having no stored counterpart is:

| Derived paths | Stored base? | A `Modifier` may target it? |
|---|---|---|
| `player.needs.*`, `player.attributes.*`, `player.skills.*` | Yes | **Yes** — this is what the layering above is *for* |
| `player.housing.quality`, `player.career.effectivePerformance`, `calendar.energyRecoveryRate`, `world.strangeness` | No — formula-only | **No** — Tier 1 `read_only_field` (§14) |

The first row is this section's own motivating example: *a modifier that sets a need to a fixed
value for three weeks*. `player.needs.*` is a `DerivedPath`, so a blanket "derived paths are
read-only" would make that example a validation error and leave the base/derived split with
nothing to layer. The second row has no writable field to name — a `Modifier` targeting
`career.effectivePerformance` is asking to write a formula's output, which is the defect
`read_only_field` exists to catch.

`isReadOnly` returns true for the second row only, and §14's Tier 1 check is written against
that partition rather than against the union.

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

  projects: ProjectRuntimeState[];   // §6.12 (W101)
  businesses: BusinessRecord[];      // §6.12 (W101)

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
`AgentState.actor: ActorState` (§7.10) — identical fields, run through
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
`"counter"`-type `Reward` (§7.1) for statistics that are not state changes in their
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
  backgroundId: string;     // §7.9 — BackgroundDefinition
}

type PlayerIdentity = ActorIdentity;
```

`actorId` is load-bearing, not decorative: relationships are held per actor (§6.11) and NPCs
remember things about specific actors (§7.7), so every actor must be
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
  courseId: string;               // §7.3 — CourseDefinition
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
  jobId: string;                 // §7.2 — JobDefinition
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
whatever `PerformanceFactor`s (§7.2) apply — never stored itself.

**`attendanceRatio`'s update rule, when a campaign opts in, is §7.11's
`AttendanceTrackingConfig`.** Absent that field, it stays exactly what `resolveApplications`
sets at hire and nothing since has maintained — the documented gap this section used to leave
open unconditionally.

### 6.9 Housing

```typescript
interface HousingState {
  definitionId: string;           // §7.4 — HousingDefinition
  movedInWeek: number;

  ownership: "renting" | "owned" | "mortgaged" | "staying_with_someone";

  damage: number;                // 0–100, mutable
  weeklyCostCents: Cents;
  depositPaidCents: Cents;

  rentDueWeek: number;
  overdueRentCents: Cents;
  missedPayments: number;
  evictionStage: EvictionStage;

  landlordNpcId?: string;        // §7.7 — NPCState
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
`HousingDefinition`'s `comfort`/`safety` fields (§7.4) — is carried from upstream as provisional
content-balance material, the same status `TODO.md`'s *Known Open Items* already gives it.

### 6.10 Inventory

```typescript
interface InventoryItem {
  instanceId: string;
  definitionId: string;          // §7.5 — ItemDefinition

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
  npcId: string;                  // §7.7 — NPCState
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
`NPCState` (§7.7) holds only what genuinely belongs to the NPC itself: its role,
availability and memories, none of which differ per observer.

**Weekly drift, when a campaign declares any, is §7.11's `RelationshipDriftRule[]`.** Absent
that field, the `relationships` end-of-week system (§3) stays the no-op it has always been;
`socialize` (§5) remains the only resolver that moves a `RelationshipState` on its own.

### 6.12 Projects and Businesses — Runtime State (W101)

Durable, per-actor progress against a `ProjectDefinition`/`BusinessDefinition` (§7.12) — the
same "content declares the shape, state declares the instance" split every other content/
runtime pair in this kind already follows (`JobDefinition`/`Employment`, §6.8;
`CourseDefinition`/`EducationState.enrollments`, §6.7).

```typescript
interface ProjectRuntimeState {
  instanceId: string;                // natural key for Modifier/Condition addressing (§7.1)
  definitionId: string;               // §7.12 — ProjectDefinition

  startedWeek: number;
  progressUnits: number;              // 0 .. ProjectDefinition.requiredUnits
  status: "in_progress" | "completed";
  completedWeek?: number;
}

interface BusinessRecord {
  instanceId: string;                 // natural key for Modifier/Condition addressing (§7.1)
  definitionId: string;               // §7.12 — BusinessDefinition

  startedWeek: number;
  cashOnHandCents: Cents;
  weeksOperated: number;
  status: "operating" | "closed";
  closedWeek?: number;
  closedReason?: ReasonCode;
}
```

**A project completes once and only once.** `status` transitions `"in_progress"` →
`"completed"` the week `progressUnits` reaches `ProjectDefinition.requiredUnits` (§7.12) —
irreversible, the same one-way transition `EducationState.enrollments[].status` (§6.7) already
uses for course completion. `work_on_project` (§4.2) on an already-`"completed"` instance is
rejected the same way `plan.add` already rejects an action against a resource that no longer
exists — `requirement_unmet` (base set) — rather than silently re-crediting progress, which is
what "completes once" (W101.2) rules out.

**A business closes once and only once**, the same shape: `status` transitions
`"operating"` → `"closed"` and never back. Closure is either player-initiated
(`operate_business` with a `parameters.close: true`, §4.2's own parameter domain) or
contract-forced — `BusinessDefinition.minimumCashCents` (§7.12) breached at the point weekly
expenses post, which is `closedReason: "business_insolvent"` (§10).

---

## 7. Content Definition Types

Jobs, courses, housing, items, events, NPCs, goals, scenarios, agents (upstream §14.1–§14.9),
plus `Modifier` and `Reward` (upstream §13.3–§13.4) — simulation mechanics hanging off
`Condition`, not condition operators, so they belong here rather than in §8. Ported below —
the field-level port `plans/36-simulation-kind-programme.md` proposed as W29 and cut as
**W34**, sized against upstream §13.3–§13.4 and §14.1–§14.9.

These are **campaign data**, loaded through the content registry (04 §10.1) exactly as
story-graph campaigns are. A simulation campaign is `kindId: "simulation"` plus data
conforming to this kind's schema — the same core/kind/campaign split (architecture §1), with
no new loading mechanism.

**Two subsections (§7.7, §7.10) are the exception, by design, not drift.** `NPCState` is
runtime state (already forward-referenced from `WorldState`, §2.2), not campaign data — placed
beside its content-side counterpart (`NPCDefinition`) because the two are read together
constantly, the same reason `JobOpening` (§2.2, runtime) and `JobDefinition` (§7.2, content) are
described near each other in prose even though they live in different top-level sections. §7.10
has a *third* category alongside them: `AgentStrategy` is engine-owned code (a function member
cannot be campaign JSON at all) and never appears in content — though how a campaign actually
selects one is itself an open gap, not yet settled by any field this contract declares; §7.10
records it rather than assuming an answer. Every other subsection here is campaign data
throughout.

**This is about the campaign wrapper's own identity, not every individual definition's `id`.**
A campaign-level `id`/`version`/`titleKey` — the simulation-kind analogue of
`StoryGraphCampaign` — lives on the core `Campaign` envelope and would be the envelope-
duplication defect (04 §10.1) to restate here. Each *individual* content definition below
still needs its own `id`, the same way `03-story-graph-kind.md`'s own `Choice`,
`AchievementDefinition` and every node do: a campaign declares many jobs, many events, many
goals, and each needs to be addressable on its own terms. `JobDefinition.id` names one job
among many a campaign declares; it is not the campaign's own identity.

Every type below references `Requirement`/`RequirementType` (§8.1) and `GameAction`'s own
schema (§4.2) by name.

### 7.1 Modifiers and Rewards

```typescript
interface Modifier {
  target: string;                 // must resolve to a writable *stored* field — never one of §6.1's four formula-only paths (§14: read_only_field)
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
corrupt a save. Tier 1 validation (§14) rejects a numeric path segment — which is why an id
used as one of these natural keys may not be all-digits: `04-core.md` §17's identifier
character set (`[a-z0-9_-]`) permits one, but an id of `"123"` would then be indistinguishable
from the rejected index `123`. Content declaring `npcId`/`instanceId`/`courseId`/`id` for an
entity ever addressed this way needs at least one non-digit character; Tier 1 validation checks
this specifically for ids used as a natural key, not as a blanket rule over every id in the
kind.

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

**`Reward`'s own payload is provisional, ported as upstream declares it, not resolved here.**
`target`/`value` are optional and untyped (`unknown`) across every `RewardType` — upstream never
narrows what a `"money"` reward's `value` is versus what a `"modifier"` reward's is, and this
port does not invent that narrowing on upstream's behalf. A discriminated union keyed by `type`
(`{ type: "money"; cents: Cents }`, `{ type: "item"; definitionId: string; quantity: number }`,
and so on) is the more precise shape and was considered — declined here because designing
thirteen concrete payload shapes with no resolver implementation to validate them against risks
inventing a contract this port has no way to check, the same reasoning `Modifier`'s multiply
semantics (above) were resolved by *checking the primary source* rather than guessing. **Revisit
when** `Reward` gains a real dispatcher — naturally the final contract unit (§15), alongside
`GameAction`'s own resolution.

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

  requirements: Requirement[];  // §8.1
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
  requirements: Requirement[];    // §8.1
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
  requirements: Requirement[];    // §8.1
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

  requirements: Requirement[];    // §8.1
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

  requirements: Requirement[];     // §8.1
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

  requirements?: Requirement[];    // §8.1
  check?: CheckDefinition;

  outcomes: ConditionalOutcome[];
}

interface ConditionalOutcome {
  condition?: Condition;           // §8
  onDegree?: ActionOutcome["degree"][];  // §5.3
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
immediately within end-of-week processing (§3's end-of-week order). `ConditionalOutcome.onDegree`
references `ActionOutcome`'s own `degree` field (§5.3).

### 7.7 NPCs — Definition and Runtime State

**Two of the three types below are not campaign data.** `NPCDefinition` is; `NPCState` and
`NPCMemory` are runtime state (`WorldState.npcs`, §2.2) that a `Kind.advance` reducer creates
and mutates as a game plays — the same content/state split every other section of this contract
draws (`JobDefinition` vs. `JobOpening`, §2.2 vs. §7.2, is the same pair). Placed together here
rather than split across §2 and §7 because the two are read together constantly (an NPC's
current role and memories are meaningless without its definition's `defaultRole`/tags to compare
against), and `WorldState.npcs: NPCState[]` (§2.2) already forward-referenced this exact section
before either type existed in this repository.

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

  rivals?: readonly RivalConfig[];    // §7.10 (W101). Absent or empty = today's behaviour.
}

type GameMode = "classic" | "open_life" | "challenge";
type GoalFailurePrecedence = "goals_win" | "failure_wins";

/** §7.10's own open gap, closed: the natural home it named, "decided against a concrete
 *  need" (W101). One entry per rival this scenario starts with. */
interface RivalConfig {
  agentId: string;               // AgentState.id (§7.10) — must be unique within this scenario
  strategyId: string;             // AgentStrategy.id (§7.10) — Tier 1: unknown_rival_strategy
  displayNameKey: LocKey;

  startingBackgroundId: string;   // §7.9 — same BackgroundDefinition mechanism the player uses
  initialConditions?: Modifier[]; // §7.1 — applied once, at initialState, on top of the background
}

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

`GoalFailurePrecedence` and its default are already load-bearing in §12 (Terminal Identity),
which now also states `week_limit_reached`'s precedence against the two — restating the type
here does not repeat that reasoning; §12 carries it. Every rival advantage is declared on
`DifficultyDefinition` and nowhere else, which is what makes an "any advantage must be explicit"
audit possible at all: a rival that is simply better at something the definition doesn't name
would be undetectable drift, the same class of risk §6.2 raised for actor-state parity.

**`RivalConfig` and `DifficultyDefinition.rivalStartingAdvantages` are two different axes, not
a duplication.** `rivalStartingAdvantages` is difficulty-wide — every rival in a scenario
played at that difficulty gets the same bonus, the mechanism an "any advantage must be
explicit" audit already covers. `RivalConfig.initialConditions` is per-rival and
scenario-authored — "this particular rival starts with a head start," the same relationship
`ScenarioDefinition.startingCashCents` has to the player. A rival's actual starting `ActorState`
is its `startingBackgroundId`'s `BackgroundDefinition` (§7.9), with `initialConditions` applied
on top the same way any other `Modifier[]` applies, then `rivalStartingAdvantages` on top of
that — difficulty is the outermost layer because it is the one axis a player, not a campaign
author, chooses.

**Zero rivals is the only value every 0.10 scenario has**, so `rivals` absent or `[]` must
build `WorldState.agents: []` exactly as `initialState` already does today (W101.4) — this
field adds a new source `initialState` reads, not a new default it can silently change.

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
  requirements?: Requirement[];    // §8.1 — what accepting demands

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
  actionTypes: ActionType[];       // §4.2 — what can be done here

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
not in the current location's `actionTypes` fails with `wrong_location` (§10).

### 7.10 Agents — Engine-Owned Strategy, Definition, and Runtime State

**A third category, not the same pairing as §7.7.** `AgentStrategy.selectActions` is a
function — it cannot be represented in campaign JSON/YAML at all, so despite upstream listing
it alongside the other content-definition types (§14.9), it is not campaign data and was never
going to become some. It is **engine-owned code**, the same category `Kind` itself is
(`06-extensibility.md` §7, "Kinds Stay Engine-Owned"): a fixed, in-repository registry of named
behaviors (`"aggressive"`, `"cautious"`, …), keyed by `id`.

**How a campaign actually selects a strategy was a real, open gap — closed by §7.8's
`ScenarioDefinition.rivals: RivalConfig[]` (W101), the exact field this section already named
as the natural home.** `AgentState.strategyId` stays *runtime* state, built at `initialState`
from `RivalConfig.strategyId` — a campaign author still never writes it directly, but now has
a real field to declare it through. `initialState` builds one `AgentState` per `RivalConfig`,
in `rivals` array order (deterministic — this is content, read once, not an iteration this
kind's own sorted-iteration rule governs), failing campaign validation rather than construction
when `strategyId` names no registered `AgentStrategy` (`unknown_rival_strategy`, §14).

```typescript
/** Engine-owned, never campaign content — the rival-behavior analogue of `KindRegistry`. */
interface AgentStrategy {
  id: string;
  selectActions(view: PublicWorldState, agent: AgentState): GameAction[];  // §4.2
}

interface AgentState {
  id: string;
  strategyId: string;
  displayNameKey: LocKey;

  actor: ActorState;              // §6.2 — identical shape to the player
  goals: GoalState[];             // §2.4

  planningDepth: number;
  strategy: Record<string, unknown>;   // hidden — never projected

  rngSeq: number;                  // §8's own `{ kind: "agent" }` StreamId draw counter (W101)
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

**Rival resolution runs inside `end_week`, after the player's own plan resolves, in
`WorldState.agents` order.** For each `AgentState`, `selectActions(publicView, agent)` draws —
if it draws at all — from `deriveStream({ kind: "agent", agentId: agent.id, seq: agent.rngSeq })`
(§8), incrementing `rngSeq` once per draw; the resulting `GameAction[]` resolves through the
same `ResolverTable` (§5.1) the player's plan already used, actor-addressed by `agent.id`
rather than `"player"`. This is what makes W101.5 true structurally — a rival is not a second
code path that happens to produce similar results, it is the *same* `apply`/`calculate`
functions given a different `actorId` — and what makes W101.6 true: a rival's stream key names
only its own `agentId`, so nothing about registry construction order or another agent's action
count can perturb it. `WorldState.agents` order is itself the campaign's own `rivals` array
order (above), fixed at `initialState` and never re-sorted at runtime, so "in agent order" is
as reproducible as the campaign content is.

### 7.11 The Campaign Envelope and Weekly Tuning

**`SimulationCampaign` is the campaign-root envelope** — `story-graph`'s `StoryGraphCampaign`
analogue — carrying every content collection §7.2–§7.10 declare plus the flat, per-campaign
fields (`scenarioId`, `goalFailurePrecedence`, `startingEffects`, …) this document had not yet
named. Declared in `src/engine/src/kinds/simulation/campaign.ts`; identity fields
(`id`/`version`/`titleKey`) stay on the core `Campaign` envelope, not here, the same
envelope-duplication rule `StoryGraphCampaign` already follows.

**This is the closed, validated home W100 needed** for the weekly tuning values §3's
end-of-week ordering names but never wires: the empty-plan policy, relationship drift, and
attendance tracking. All three are optional flat fields on `SimulationCampaign`, matching
`goalFailurePrecedence`'s own precedent rather than nesting under `ScenarioDefinition`
(§7.8) — a single campaign here plays exactly one scenario (`scenarioId`), so the two would
name the same value, and the flat placement is this file's own established convention. Every
field below is **absent by default**, and absence means exactly the behaviour every campaign
shipped before this section had — no 0.10 campaign, replay, or save fixture changes when
these fields are omitted.

```typescript
interface SimulationCampaign {
  // … §7.2–§7.10's collections, and campaign.ts's existing flat fields, unchanged …

  /** Whether `end_week` may resolve an empty plan. Absent, or `"permit"`, is every campaign's
   *  behaviour before this field existed: `end_week` always resolves, even with nothing
   *  planned. `"forbid"` rejects `end_week` with `plan_empty` (§10) whenever
   *  `plan.actions.length === 0`, leaving state and the plan unchanged. */
  emptyPlanPolicy?: "permit" | "forbid";

  /** Weekly relationship drift the `relationships` end-of-week system (§3, §6.11) applies.
   *  Absent leaves that system the no-op it has always been. */
  relationshipDrift?: readonly RelationshipDriftRule[];

  /** Rolling employment-attendance tracking (§6.8). Absent leaves `Employment.
   *  attendanceRatio` exactly as `resolveApplications` sets it at hire — unmaintained,
   *  the documented gap this field closes only when a campaign opts in. */
  attendanceTracking?: AttendanceTrackingConfig;
}

interface RelationshipDriftRule {
  /** Which `RelationshipState.category` (§6.11) values this rule applies to. Absent or
   *  empty applies to every category. */
  categories?: readonly RelationshipState["category"][];

  /** Per-week integer delta added to each named dimension before clamping to 0–100 (§6.2's
   *  declared integer range). Every field is optional; an omitted dimension does not drift. */
  affinityDelta?: number;
  trustDelta?: number;
  respectDelta?: number;
  resentmentDelta?: number;
}

interface AttendanceTrackingConfig {
  /** Weeks averaged into the rolling `attendanceRatio`. Must be a positive integer — Tier 1
   *  (§14) rejects zero or negative. */
  windowWeeks: number;
}
```

**`relationshipDrift` runs once per week, in array order, over every actor's relationships —
the player's and each `WorldState.agents[].actor`'s (§7.10) alike**, the same "one shape, one
code path" rule §6.2 states for every other actor-state system. For each `RelationshipState`
whose `category` a rule names (or every relationship, when `categories` is absent), the rule's
deltas apply and clamp to 0–100 before the next rule runs; a dimension left at the clamped
value it already held emits nothing, mirroring `needs`' own `if (after === before) continue`
(`endOfWeek.ts`). A changed dimension emits one `StateChange` per field, `reason:
"relationship_drift"` (§10), `visible: true` for `affinity`/`trust`/`respect` — `resentment`'s
change is emitted the same way `socialize` already emits it (`resolvers.ts`): `visible: false`
per §6.11's hidden-from-projection rule, never omitted from the audit trail entirely.
Applying to every actor rather than only the
player is forward compatible with rivals (§7.10) without changing shape once one exists;
today `WorldState.agents` is empty in every shipped scenario, so the rival half of this rule
is exercised by nothing yet, the same honest gap §7.10 already states for
`AgentStrategy.selectActions`.

**`attendanceTracking`, when present, updates `Employment.attendanceRatio` (§6.8) once per
week inside the `employment` system (§3) — the same system that already reads and resets
`player.flags.workedThisWeek`, so this cannot run twice for one `end_week`; the pipeline's own
fixed, tested end-of-week order (§3) guarantees `employment` fires exactly once.** The rule's
two inputs are the ones already on state: "planned" is having `currentEmployment` at all — an
employed actor is expected to work that week — and "worked" is `player.flags.workedThisWeek`,
already set by the `work`/`work_overtime` resolvers (§5) and already reset to `false` at the
end of `employment`'s own pass. The rolling update, evaluated before that reset:

```text
weeklyRatio    = workedThisWeek ? 100 : 0
attendanceRatio = clamp(
  round(((attendanceRatio × (windowWeeks − 1)) + weeklyRatio) / windowWeeks),
  0, 100
)
```

`round` is the same `Math.round` `education`'s own attendance ratio already uses (§6.8's
decision log, `endOfWeek.ts`'s course-side computation) — this is that same rounding rule
extended to the employment side it never reached, not a new one invented for it. A changed
`attendanceRatio` emits one visible `StateChange`, `reason: "attendance_updated"` (§10),
mirroring `need_drift`'s own emit-only-on-change rule; an unemployed actor, or one whose
ratio does not move after rounding, emits nothing. A future firing/probation/performance rule
that reads `attendanceRatio` is what "affects the existing attendance requirements" (W100.4)
refers to, and remains that rule's own unit to add, not this section's.

**Wisdom's consumer is the existing generic path, not a new mechanism.** `SimulationView.
attributes` (§9) already omits only `luck` — `wisdom` has always had a visible projection, the
"no consumer" gap was never about visibility. `Requirement.type: "attribute"` (§8.1) already
gates on any `AttributeState` key through a `Condition` (04 §18) over `player.attributes.
wisdom` (§6.1's own `DerivedPath`), exactly as it does for `intelligence`/`discipline`/every
other attribute. Content declaring an `EventChoice`/`OpportunityDefinition`/`JobDefinition`
`Requirement` against `player.attributes.wisdom` is wisdom's consumer — no new `Condition`
operator, `DerivedPath`, or content type is added for it, matching §8's stated bar against
adding either without a concrete need. Authoring that fixture content is a `/slice` matter
(W100.5), not a contract addition.

### 7.12 Projects and Businesses (W101)

Two new content-definition types, the same "definition declares the shape, `Requirement[]`/
`Reward[]` reuse the existing vocabulary" pattern §7.2–§7.5 already establish — neither adds a
`RequirementType`, `RewardType`, or `Condition` operator of its own.

```typescript
interface ProjectDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  requirements: Requirement[];       // §8.1 — gates start_project
  requiredUnits: number;              // total progressUnits (§6.12) to complete
  weeklyTimeCost: number;              // work_on_project's own time cost (§4.2, §5.2)
  startCostCents: Cents;

  rewards: Reward[];                  // §7.1 — granted once, on completion
  tags: string[];
}

interface BusinessDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  requirements: Requirement[];        // §8.1 — gates start_business
  startupCostCents: Cents;

  weeklyRevenueCents: Cents;           // before modifiers (§7.1)
  weeklyExpensesCents: Cents;          // before modifiers (§7.1)
  minimumCashCents: Cents;             // breached ⇒ closedReason: "business_insolvent" (§6.12)

  tags: string[];
}
```

**`start_project`/`start_business` (§4.2) each create exactly one `ProjectRuntimeState`/
`BusinessRecord` (§6.12) instance on the acting actor, `instanceId` freshly minted the same
way `InventoryItem.instanceId` (§6.10) already is.** `work_on_project`/`operate_business`
(§4.2) both take `targetId: instanceId` — never `definitionId` — because an actor may hold
several instances of the same definition (two courses of the same `CourseDefinition` cannot
coexist per §6.7's own rule, but nothing here forbids running two identical businesses, and a
contract that assumed one instance per definition would silently break the moment a campaign
tried it).

**`weeklyTimeCost`/`startCostCents`/`startupCostCents` are the *only* costs these definitions
name — `weeklyRevenueCents`/`weeklyExpensesCents` are not client-supplied and not per-action:
they post once per week, inside the `business` end-of-week system (§3), for every
`"operating"` `BusinessRecord`.** This is the same "engine-derived cost, never a client
figure" rule §4.2 already states for time/money cost — extended here to a recurring figure
rather than a one-time action cost, because a business's whole point is the weekly cadence.

```text
revenue  = round(weeklyRevenueCents × combined `multiply` factor) + Σ `add`/`subtract` (§7.1)
expenses = round(weeklyExpensesCents × combined `multiply` factor) + Σ `add`/`subtract` (§7.1)
cashOnHandCents += revenue − expenses
```

Rounding and modifier composition follow §7.1's own `multiply` rule exactly — combine every
`multiply` factor targeting this business's revenue/expense path into one product, round once,
never per modifier. A `BusinessRecord` whose `cashOnHandCents` drops below its definition's
`minimumCashCents` after this post closes immediately (§6.12), the same week — there is no
grace period distinct from `HousingState`'s own `evictionStage` ladder (§6.9), because nothing
in this unit's `Done when` (W101.3) asks for one, and inventing a second insolvency escalation
mechanism when housing already has one is exactly the kind of unrequested design §7's own
`Reward` section (§7.1) already declines to do speculatively.

### 7.13 Event Chains (W102)

The content half of §2.2's `EventChainState`. One entry per chain a campaign declares, and the
only place `ChainScope` is authored.

```typescript
interface EventChainDefinition {
  id: string;              // what an EventDefinition's `chainId` (§7.6) names
  scope: ChainScope;       // §2.2 — "game" or "profile"
  labelKey?: LocKey;       // for a client listing chains in progress; nothing requires it
}
```

Added to the campaign envelope (§7.11) as one more optional collection:

```typescript
interface SimulationCampaign {
  // … §7.2–§7.12's collections and flat fields, unchanged …

  /** Absent means `[]`, which is every campaign shipped before this field: no chain is
   *  declared, so none is `"profile"`-scoped and none is seeded (§2.2). */
  eventChains?: readonly EventChainDefinition[];
}
```

**It carries no step list, and that is the envelope-duplication rule applied one level down.**
A chain's membership and order are already fully determined by the events that declare
`chainId`/`chainStep` (§7.6). Restating them here would create a second source that can
disagree with the first, and the disagreement would be silent — the ledger in `CLAUDE.md`
records five instances of exactly this, and none of them was noticed by a gate.

**Tier 1 (§14) checks three things**, all of them the `dangling_reference`/`duplicate_id`
vocabulary already in §10:

- Two `EventChainDefinition`s sharing an `id` — `duplicate_id`.
- An `EventDefinition.chainId` naming no declared chain — `dangling_reference`. This is the
  check that makes `scope` reliably present for every chain that can actually fire, which is
  what §2.2's seeding rule depends on.
- A `"profile"`-scoped chain declared by a kind whose build has no `Kind.profileData` support —
  impossible by construction, since the member is declared alongside this section, and named
  here only so a reader does not go looking for a check that would have to exist if it were not.

A declared chain no `EventDefinition` ever references is `unreachable_content` at Tier 2, the
same as any other unreferenced definition.

---

## 8. Conditions and Requirements

Reused verbatim from the core's frozen operator set (04 §18), which originated here
(upstream §13.1). This kind adds no operators. `between`, arithmetic, and helper functions
are out unless a concrete campaign need justifies each individually — the bar 04 §18 sets
deliberately high, and this kind is the one most likely to test it.

`Modifier` and `Reward` (upstream §13.3–§13.4) are simulation mechanics, not condition
operators, and are ported in **§7.1**, not here.

### 8.1 Requirements

```typescript
interface Requirement {
  type: RequirementType;
  condition: Condition;         // 04 §18
  failureCode: ReasonCode;
  messageKey: LocKey;
}

type RequirementType =
  | "skill" | "attribute" | "credential" | "item" | "money"
  | "relationship" | "location" | "event_completed" | "need"
  | "job_tier" | "age" | "flag";
```

Every content type §7 references `Requirement[]` from (`JobDefinition`, `CourseDefinition`,
`HousingDefinition`, `ItemDefinition`, `EventChoice`, `PromotionPath`, `OpportunityDefinition`)
was forward-referencing this exact shape. `RequirementType` names *what kind* of check a
requirement is — the condition tree itself (`04 §18`) already expresses the comparison; this
enum is what lets a validator or a client render "you need Attribute: Discipline 60" as a
labeled category rather than a bare expression.

---

## 9. Projection

`SimulationView` is the `kindView` inside the core's `PlayerView` (04 §9) and carries **only
what the generic surface does not** — the rule `StoryGraphView` follows (03 §9). Identity,
`gameId` and `status` live on `Scene`/`PlayerView` already (04 §6, §9); repeating any of them
here is exactly the drift the envelope-duplication ledger (`CLAUDE.md`) tracks.

Hidden world state, unrevealed opportunities and NPC internals never cross the boundary. As
09 §6 puts it, the projection is what makes "the client cannot leak what the player should
not see" structural rather than a matter of client discipline. Never emitted, for either
`ProjectionAudience`: `seed`, `actionLog`, raw `kindState`, `AgentState.strategy`,
`RelationshipState.resentment`, `AttributeState.luck`, `ActorState.counters`, or an
unrevealed `Opportunity`. `ai` is never wider than `player` — this kind draws no distinction
between the two audiences yet, the same choice `story-graph`'s own `project` made (03 §9).

**`AvailableAction` (04 §6) carries no parameter schema** — the same reason `world-graph`
splits the seam this way (12 §7): `availableActions` returns the four verbs §4 names, each
with `available`/`reasonKey`; the *domain* those verbs' `params` (§4's own table) draw from —
which `ActionType`s are currently offerable, and the plan itself, so a client can compute a
valid `plan.remove` index — is projection, in `SimulationView.plan` below.

```typescript
interface SimulationView {
  calendar: {
    currentWeek: number;
    currentYear: number;
    season?: "spring" | "summer" | "autumn" | "winter";
    totalTimeUnits: number;
    committedTimeUnits: number;
    availableTimeUnits: number;    // derived: total − committed − spent (§2.1) — never stored
  };

  identity: ActorIdentity;          // §6.3 — luck-free; ActorIdentity itself carries no hidden field
  currentLocationId: string;
  finances: FinancialState;         // §6.4 — no field of this type is hidden
  needs: NeedState;                 // §6.5
  attributes: Omit<AttributeState, "luck">;   // §6.6 — luck is hidden
  education: EducationState;        // §6.7
  career: CareerState;              // §6.8
  housing: HousingState;            // §6.9
  inventory: InventoryItem[];       // §6.10
  relationships: VisibleRelationship[];   // §6.11, resentment stripped

  skills: Record<string, number>;
  traits: string[];
  reputation: Record<string, number>;
  // `flags`/`counters` withheld — `counters` is explicitly hidden (§6.2); `flags` is an
  // internal scripting bag with no declared player-facing meaning, the same default this
  // kind gives `world.flags`/`economy.flags` below. Revisit if a real campaign needs one
  // read back.

  activeEffects: VisibleStatusEffect[];        // §2.3 — only `visible: true` effects, modifiers stripped
  activeOpportunities: VisibleOpportunity[];   // §2.3 — offered-and-unexpired only; `terms` stripped
  pendingEventResponses: PendingEventResponse[]; // §2.3 — no field of this type is hidden

  goals: VisibleGoal[];             // §2.4 — every field but nothing beyond it; no hidden field exists

  plan: {
    week: number;
    actions: readonly GameAction[];             // §4.2 — the parameter domain for `plan.remove`'s index
    availableActionTypes: readonly ActionType[]; // §4.2 minus "custom" — the domain for `plan.add`'s actionType
  };

  world: {
    locations: PublicLocationState[];      // §2.2 — `LocationState` as-is; nothing hidden
    jobMarket: { openings: PublicJobOpening[] };  // §2.2's `JobOpening`, `postedWeek` stripped (internal bookkeeping)
    economy: PublicEconomyView;            // §2.5
  };
}

interface VisibleRelationship {
  npcId: string;
  category: "professional" | "personal" | "transactional" | "adversarial";
  affinity: number;
  trust: number;
  respect: number;                // resentment excluded (§6.11 — hidden)
  knownSinceWeek: number;
  lastInteractionWeek?: number;
  interactionCount: number;
}

interface VisibleStatusEffect {
  id: string;
  sourceKind: "item" | "housing" | "trait" | "event" | "job" | "course" | "system";
  descriptionKey: LocKey;
  expiresAtWeek?: number;          // modifiers, sourceId, stacking withheld — mechanism, not narration
}

interface VisibleOpportunity {
  id: string;
  kind: OpportunityKind;
  targetId: string;
  offeredWeek: number;
  expiresAtWeek: number;           // `terms` withheld — undocumented, resolver-internal payload (§2.3)
}

interface VisibleGoal {
  definitionId: string;
  status: "active" | "completed" | "failed";
  satisfiedThisWeek: boolean;
  consecutiveWeeksSatisfied: number;
  requiredDurationWeeks?: number;
  progressNotes: GoalProgressNote[];   // §2.4 — the Transparent Consequences field, unfiltered
}

interface PublicLocationState {
  definitionId: string;
  discovered: boolean;
  accessible: boolean;
}

interface PublicJobOpening {
  jobId: string;
  contested: boolean;
  positionsAvailable?: number;
  expiresAtWeek?: number;
}

/** Sector demand is **banded, never the raw value** (§2.5 — exposing the exact number would
 *  let a player optimise against the job-availability formula directly). Inflation,
 *  unemployment and interest are each present only when their key is in
 *  `EconomyState.publishedIndicators` — withheld by default is wrong; §2.5 states the
 *  opposite default ("ordinary published facts by default; a scenario may withhold them"),
 *  so a scenario declaring no `publishedIndicators` gets none, not all three. */
interface PublicEconomyView {
  sectorDemand: Record<string, DemandBand>;
  marketPrices: Record<string, Cents>;
  indicators: Partial<Record<"inflation" | "unemploymentRate" | "interestRate", BasisPoints>>;
}
```

**§7.10's forward reference resolves here.** `AgentStrategy.selectActions(view: PublicWorldState,
agent: AgentState)` takes the shape below — the same information any client's `SimulationView`
carries about the *world*, never an actor's own private state (an agent decides "from the same
visible information a client would see," §7.10):

```typescript
interface PublicWorldState {
  calendar: SimulationView["calendar"];
  locations: PublicLocationState[];
  jobMarket: { openings: PublicJobOpening[] };
  economy: PublicEconomyView;
}
```

Deliberately smaller than `SimulationView` — it carries no actor's finances, needs, or plan
(a rival's own state is `AgentState.actor`, read directly by whatever calls
`selectActions`, not re-derived from this type). **Not yet exercised at runtime**: no unit
before this one wires a rival agent into `end_week`'s resolution (§7.10's own callout —
"how a campaign actually selects a strategy is a real, open gap"), so `PublicWorldState` is
declared to close the undeclared-name gap `AgentStrategy` left, not because a caller
constructs one yet.

---

## 10. Reason Codes

Codes this kind adds to the base set (`Kind.reasonCodes`, 04 §3, §12). Each needs a localized
message or registry validation fails. Split into three tables — resolution, campaign
validation, and audit — the same shape [`03-story-graph-kind.md`](03-story-graph-kind.md)
§8.3 and 12 §11 already use, because the three serve different readers: a player, a campaign
author, and a client rendering a history.

**Resolution — rejections `advance` returns:**

| Code | When | Status |
|---|---|---|
| `action_not_planned` | `plan.remove` names an index the plan does not have | registered |
| `insufficient_time` | A planned action exceeds available time units | registered (W53) |
| `insufficient_funds` | A planned action's cost exceeds available money | registered (W54) |
| `wrong_location` | An action's type is not in the current location's `actionTypes` (§7.9), or a `travel` target is not in `connections` | registered (W53) |
| `plan_empty` | `end_week` with nothing planned, where the campaign forbids it | specified, not yet dispatched |
| `week_limit_reached` | The scenario's week cap is exhausted | specified, not yet dispatched |
| `event_response_pending` | `end_week`, or a `plan.add` for any `ActionType` other than `respond_to_event`, while a `PendingEventResponse` (§2.3) remains unaddressed by the current plan | registered (W94) |

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`,
`action_not_available` (a `"custom"` `GameAction` reaching resolution, §4.2).

**Campaign validation — what `validateCampaign` returns (§14):**

| Code | Tier | When |
|---|---|---|
| `duplicate_id` | 1 | Two definitions of the same content type share an `id` |
| `dangling_reference` | 1 | A definition references an `id` that resolves to nothing |
| `numeric_natural_key` | 1 | An addressing path segment is all digits where a natural key is required (§7.1) |
| `unknown_rival_strategy` | 1 | `RivalConfig.strategyId` (§7.8) names no registered `AgentStrategy` (§7.10) — W101 |
| `unreachable_content` | 2 | A definition nothing in the campaign ever references |
| `unsatisfiable_achievement` | 2 | An `AchievementDefinition.condition` reads a counter or flag nothing writes |

Reused from the base set: `read_only_field` (a `Modifier` targeting a formula-only
`DerivedPath`), `missing_string_key` — the same two `story-graph`'s own validator reuses.

**Audit — `StateChange.reason` values (04 §12).** All are emitted on `visible: true`
records, so each owes a resolvable message exactly as a rejection does; there is no audit
namespace exempt from §12's completeness rule.

| Code | Emitted by |
|---|---|
| `action_work`, `action_work_overtime`, `action_search_for_work`, `action_apply_for_job`, `action_negotiate_job_terms` | the employment resolvers (§5.1, W53) |
| `action_enroll_course`, `action_attend_class`, `action_study`, `action_withdraw_course` | the education resolvers (W54) |
| `action_eat`, `action_rest`, `action_move_housing` | the needs and housing resolvers |
| `action_pay_bills`, `action_borrow_money`, `action_repay_debt`, `action_deposit_savings`, `action_invest` | the finance resolvers (W55) |
| `action_shop`, `action_maintain_item`, `action_repair_item`, `action_sell_item`, `action_travel`, `action_socialize`, `action_exercise` | the possessions, places and people resolvers (W56) |
| `action_respond_to_event`, `action_accept_opportunity`, `action_decline_opportunity` | the events and opportunities resolvers (W57) |
| `need_drift` | the `needs` end-of-week system (§3) |
| `wage_payment` | `finance_income` |
| `rent_charged` | `housing` |
| `rent_overdue`, `eviction_advanced` | `finance_reconcile` (W55) |
| `education_course_completed`, `education_course_failed`, `education_skill_awarded`, `education_credential_awarded` | the `education` system (W54) |
| `item_condition_decayed` | the `inventory` system (W56) |
| `event_fired` | the `events` system (W57) |
| `opportunity_offered`, `opportunity_expired`, `opportunity_revoked` | the `opportunities` system (W57) |
| `headline_shown`, `world_strangeness_shifted` | the `headline` and `events` systems (W57) |
| `relationship_drift` | the `relationships` end-of-week system, only when `SimulationCampaign.relationshipDrift` (§7.11) is declared |
| `attendance_updated` | the `employment` end-of-week system, only when `SimulationCampaign.attendanceTracking` (§7.11) is declared |
| `action_start_project`, `action_work_on_project`, `action_start_business`, `action_operate_business` | the project/business resolvers (§5.1, W101) |
| `project_completed` | the `work_on_project` resolver, when `progressUnits` reaches `requiredUnits` (§6.12, W101) |
| `business_revenue`, `business_expense` | the `business` end-of-week system (§3, §7.12, W101) |
| `business_closed` | the `operate_business` resolver, voluntary close (§6.12, W101) |
| `business_insolvent` | the `business` end-of-week system, `cashOnHandCents` below `minimumCashCents` (§6.12, §7.12, W101) |
| `chain_advanced` | the `events` system, when a `"game"`-scoped chain's `currentStep` moves (§2.2, §7.13, W102) |
| `profile_chain_advanced` | the `events` system, when a `"profile"`-scoped chain's `currentStep` moves — the record `Kind.profileData.fold` reads (§2.2, 04 §7.1, W102) |

> **`profile_chain_advanced` is a separate code rather than a `path` prefix on
> `chain_advanced`, and the split is what keeps `fold` from string-matching.** 04 §12's own
> convention is that `path` names *what* changed and `reason` names *why*, with `reason` the
> field a consumer switches on; a fold that decided scope by inspecting the path would be
> parsing prose, and a fold that looked the scope up from `EventChainDefinition` would need
> content it is not given. Both codes carry the same `path` — `chain.<chainId>` — and both are
> `visible: true`, because a player who is told a thread moved forward is also owed the fact
> that this one carries into the next life.

> **This set grows as the dispatched systems land, and that is deliberate.** A code joins
> `Kind.reasonCodes` when the unit that actually produces it exists, not when this table
> first names it — the precedent `story-graph` set, whose own codes joined across W10, W11,
> W12 and W14 rather than being pre-declared. `plan_empty` and `week_limit_reached` are the
> two still outstanding; `plan_empty`'s additional gate is now closed by §7.11's
> `emptyPlanPolicy` field, recorded in `90-decisions.md` — dispatching it is a `/slice`
> matter, not a further contract change. The shipped set lives in
> `src/engine/src/kinds/simulation/reasons.ts`.
>
> **The policy has no gate, and that cost eighteen codes.** Registry validation checks
> *registered → has a message*; nothing checks *emitted → registered*, so W53 and W55
> emitted eighteen visible audit codes that no client could resolve, and every gate stayed
> green until a reconciliation compared the two sets by hand. Adding an audit `reason`
> means registering it in the same commit — the completeness check will not catch the
> omission. Recorded in `90-decisions.md`.
>
> **The second lapse was this table, not the code.** W56 and W57 registered their seventeen
> audit codes at the point of emission — exactly the discipline the paragraph above asks for
> — and neither added a row here, so the table under-reported the shipped set by seventeen
> until reconciliation compared the two again. That failure has the same shape and the
> opposite direction, and no gate covers it either: nothing checks *registered → tabulated*.
> The shipped set is `src/engine/src/kinds/simulation/reasons.ts`; when the two disagree,
> that file is right and this table is what moves.

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
| `employment.application_lost` | `warn` | A `pendingApplications` entry was dropped because its `jobId` no longer resolves against campaign content (W53) |

`system.ran` earns its place: the two-phase time ordering in §3 is the rule most likely to
regress silently, and a stream that names each system in order localizes such a regression to
the phase that moved.

`employment.application_lost` is the only `warn` here and the only one that is not part of the
normal weekly rhythm: `resolveApplications` (§3's `employment` system) silently drops an
application whose job was removed or renamed between submission and resolution, and this event
is the sole trace it ever existed. It is `warn` rather than `info` because reaching it means
campaign content changed under a live game, not that the player did anything.

---

## 12. Terminal Identity

`Kind.outcome` (04 §3) returns this kind's terminal identity for the replay oracle
(07 §3.3):

```typescript
interface SimulationResolution {
  resolution: "goals_met" | "failed" | "week_limit_reached";
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
  resolvedAtWeek: number;
}

outcome(state: SimulationKindState): {
  terminal: boolean;                                                 // 04 §3.2
  terminalId: string | null;                                         // 04 §3.2 — the resolution token
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;  // null while active
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
} {
  const terminal = state.resolution;
  return {
    terminal: terminal !== null,
    terminalId: terminal?.resolution ?? null,
    resolution: terminal?.resolution ?? null,
    goalsMet: terminal?.goalsMet ?? [],
    goalsFailed: terminal?.goalsFailed ?? [],
  };
}
```

**`terminalId` is the `resolution` token**, satisfying the cross-kind floor
([`04-core.md`](04-core.md) §3.2) without inventing a fourth vocabulary. `resolution` stays as
its own field: it is the typed union this kind's own readers already switch on, and narrowing it
to the base's `string | null` would cost every one of them exhaustiveness checking to buy
nothing. The duplication is a widening, which §3.2 is explicit about permitting — the base is a
floor, not a ceiling.

**This kind implements no `terminalCount`.** Its terminal set is the three tokens above, fixed by
this contract rather than declared by a scenario, so a count of them is a fact about the engine
and not about the campaign a player is looking at. "One of three resolutions reached" is not
progress; it is a category label with a denominator glued on. Per
[`04-core.md`](04-core.md) §7.3 the omission means a simulation campaign carries no `progress`
object at all, which is the correct answer rather than a missing feature.

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

`outcome()` does not compute any of this itself — it cannot. `Kind.outcome(state: KState)`
(04 §3) receives no campaign, so `ScenarioDefinition.weekLimit` (§7.8) is not reachable from
here. §2's `SimulationKindState.resolution: SimulationResolution | null` carries the already-
decided fact instead, exactly as `12-world-graph-kind.md` §8's `WorldGraphKindState
.resolution` does for the same structural reason. `outcome()` reads it back; it never
reconstructs a possibly different winner from `goals`/`world` state after the fact.

Published ids only — never money, needs, or week counts, all of which a balance pass changes
legitimately and none of which a regression oracle should treat as a defect (07 §3.4).

**`week_limit_reached`'s precedence against `goals_met`/`failed` is settled: goals and
failure always win.** Upstream never resolves this — §12.2's `END_WEEK_SYSTEM_ORDER` runs
`goals` before `failure` and names no week-limit check at all, and §12.3's
`goalFailurePrecedence` resolves only the goals-vs-failure tie, leaving the third axis
genuinely open in the source this section ports from. This contract settles it rather than
carrying the gap into an implementation that would have had to guess: the `week_limit` system
(§3) runs after `goals` and `failure` have applied `goalFailurePrecedence` between themselves,
and writes `state.resolution` only when it is still `null`. A week that simultaneously
exhausts `weekLimit` and lands every goal reports `goals_met`, not `week_limit_reached` — the
same reasoning §3 already gives for defaulting `goalFailurePrecedence` to `"goals_win"`: the
alternative reports the worst available ending for a player who did everything asked of them,
over a race against a clock they had no way to see the edge of. The same holds against
`failed`: a week that both fails a goal and exhausts the limit reports `failed`, the more
specific fact. `week_limit_reached` is therefore never a tie-break result — it is what a week
reports only when neither `goals` nor `failure` had anything to say, i.e. play simply ran out
of scenario before it resolved either way.

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
total, run once at registry construction, before the registry is frozen. Tiered the way
03 §11 and 12 §15 already are.

**Tier 1 — load-time, hard fail:**

- No two definitions of the same content type share an `id` (`JobDefinition`, `CourseDefinition`,
  `HousingDefinition`, `ItemDefinition`, `EventDefinition`, `NPCDefinition`, `GoalDefinition`,
  `ScenarioDefinition`, `DifficultyDefinition`, `OpportunityDefinition`,
  `AchievementDefinition`, `HeadlineDefinition`, `EmployerDefinition`, `LocationDefinition`,
  `BackgroundDefinition`, `TraitDefinition`, `SkillDefinition`, `ProjectDefinition`,
  `BusinessDefinition` — §7.2–§7.10, §7.12, each independently).
- Every reference to another definition's `id` resolves: `PromotionPath.toJobId` →
  `JobDefinition`; `ScenarioDefinition.startingBackgroundIds`/`startingHousingId`/
  `startingLocationId`/`goalIds`/`startingInventory[].definitionId` → their respective
  definitions; `EmployerDefinition.jobIds`/`npcIds` → `JobDefinition`/`NPCDefinition`;
  `LocationDefinition.connections` → `LocationDefinition` (the adjacency graph, §7.9);
  `OpportunityDefinition.targetId` → whichever definition type its own `kind` names
  (`job_offer` → `JobDefinition`, `course_place` → `CourseDefinition`, and so on);
  `RivalConfig.startingBackgroundId` (§7.8) → `BackgroundDefinition` (§7.9), the same reference
  `ScenarioDefinition.startingBackgroundIds` already checks for the player.
- `RivalConfig.strategyId` (§7.8) names a registered `AgentStrategy` (§7.10) —
  `unknown_rival_strategy` (§10) when it does not. Unlike every other reference above, the
  target is not campaign content but the engine's own fixed strategy registry, so this check
  runs against that registry rather than against the campaign's own definition set.
- `RivalConfig.agentId` (§7.8) is unique within its own `ScenarioDefinition.rivals` array —
  `duplicate_id`, the same code the bulleted rule above uses, scoped to one scenario's rival
  list rather than to the whole campaign, because `AgentState.id` (§7.10) only needs to be
  unique within the one `WorldState.agents` array it populates.
- No two `EventChainDefinition`s (§7.13) share an `id` — `duplicate_id` — and every
  `EventDefinition.chainId` (§7.6) resolves to one — `dangling_reference`. The second is what
  makes `ChainScope` reliably present for every chain that can fire, which §2.2's seeding rule
  depends on; without it a `"profile"`-scoped chain could advance in a game and be seeded into
  none.
- Every `SimulationMigrationStep.domain` (§16) is covered by the engine-owned reference-site
  table — `dangling_reference`. A `default` step's `id` resolves against its domain's collection
  in **this** campaign, the version being migrated *to* — `dangling_reference` — because a
  default that cannot resolve is a migration guaranteed to fail at load rather than at
  publication, which is the wrong end to find it.
- Every field typed `LocKey`, anywhere in a content definition — not an enumerated list of field
  *names*, which this section's own types alone already use eight of (`titleKey`,
  `descriptionKey`, `nameKey`, `labelKey`, `textKey`, `messageKey`, `displayNameKey`, `label`) —
  resolves in the registry's string table (04 §10.1).
- A `Modifier.target`/addressing path naming an array collection uses the collection's natural
  key, never a numeric index (§7.1) — a numeric path segment is rejected outright.
- A `Modifier` targeting one of §6.1's four **formula-only** paths — `player.housing.quality`,
  `player.career.effectivePerformance`, `calendar.energyRecoveryRate`, `world.strangeness` —
  fails with `read_only_field`. That is `isReadOnly`'s partition, not the whole `DerivedPath`
  union: `player.needs.*`, `player.attributes.*` and `player.skills.*` are derived *and*
  writable, and are the targets the layering in §6.1 exists to serve. Checked here because this
  is where a concrete `target` string first exists to check.
- `SimulationCampaign.attendanceTracking.windowWeeks` (§7.11), when present, is a positive
  integer — zero, negative, and non-integer values are rejected.

**Tier 2 — load-time, warning:**

- Unreachable content: a `GoalDefinition` no `ScenarioDefinition.goalIds` ever names; a
  `JobDefinition`/`HousingDefinition`/`ItemDefinition` no scenario's starting state, no
  `EmployerDefinition`, and no `Reward`/opportunity ever references.
- An `AchievementDefinition.condition` (§7.9) referencing a counter or flag key nothing in the
  campaign's content ever writes — satisfiable only by chance, not by design.

**Concrete Tier 1/2 rules for `Requirement` (§8.1) and `GameAction`/`ActionType` (§4.2)
themselves are not enumerated here.** Both are now specified, closing the reason this list
used to defer them — what's left is writing the actual checks (a `Requirement.type` matching
what its `condition` targets; a `plan.add`'s declared `ActionType` resolving in the
`ResolverTable`, §5.1) against real `Kind.validateCampaign` code, which belongs to the build
phase this contract precedes, not to another doc-only pass.

---

## 15. What Was Ported, and What Was Found Along the Way

**Nothing remains upstream as a gap in this contract's *shape*.** This section used to be
"What Remains Upstream" — a table of sections still to bring over.

> **"The shape is whole" is not "the systems are built" — read this claim narrowly.** What
> closed is the *specification*: every field `SimulationKindState` names has a type, every
> content definition a campaign needs is declared, and the dispatch mechanics that run
> against both are written down. What is emphatically **not** claimed is that the code
> behind them exists. Some of §3's end-of-week systems ship as deliberate, individually
> documented no-op stubs — real functions in the pipeline, running in the normative order and
> emitting `system.ran`, doing nothing else — because the "Stable Life" vertical slice needed
> only enough logic to prove a goal can be won and lost. §10's resolution table says the same
> thing from the other side, marking each code registered or not-yet-dispatched.
>
> **The count that used to sit in that sentence is gone, and its removal is the point.** It
> read "fourteen" and had been wrong since W57 inserted `week_limit` into §3's order — the
> third time a count in this section outlived the units that changed it. §3's list is the one
> place the systems are enumerated; count them there or not at all.
>
> **How many, and which, is not stated here — deliberately.** `90-decisions.md` carries the
> current list of which systems are stubs and what each still owes; §10's own table carries
> the per-code status. Neither is restated here, because a second copy drifts and the version
> that drifts is always the one in the document nobody updates when the code lands. This
> paragraph used to give both as counts, and both counts were wrong within two units of being
> written. Consult those two for "is this built?"; consult this section for "what is it
> supposed to do?" `plans/36-simulation-kind-
programme.md`'s four contract units (proposed there as W27–W30, assigned real numbers as each
was cut: **W32, W33, W34, and this one**) closed it a piece at a time:

| Unit | Upstream | Ported as |
|---|---|---|
| W32 | §5.1, §5.3–§5.6, §9.1 | §2.1–§2.5 (`CalendarState`, `WorldState`, effects/opportunities/scheduled events, `GoalState`, `EconomyState`), §4.1 (`WeeklyActionPlan`'s own shape) |
| W33 | §7, §8.1–§8.9 | §6.1–§6.11 (base/derived values, `ActorState` and its nine areas) |
| W34 | §13.3–§13.4, §14.1–§14.9 | §7.1–§7.10 (`Modifier`/`Reward`, every content definition type) |
| This unit | §9, §10, §12.2–§12.3, §13.2 | §4.2 (`ActionType`, `GameAction`), §5.1–§5.3 (resolver dispatch, the pipeline, per-action outcome), §3 (end-of-week order, goal/failure precedence), §8.1 (`Requirement`) |

Every field `SimulationKindState` (§2) names has a full shape. Every content definition type a
real campaign will need to declare is specified (§7). The mechanics that dispatch actions
against both are specified (§5). What remains genuinely upstream — §1–§4, §6, §11, §13.1,
§16–§18, §20 — is core material `04-core` already owns, cited here rather than re-derived,
exactly as it was before this programme started.

**Findings this pass surfaced, not merely transcription:**

- `ActorState` comes over whole, shared verbatim by the player and every rival (§6.2) — porting
  "player state" alone and adding rival support later was considered and rejected
  (`plans/36-simulation-kind-programme.md` Finding 1).
- `plans/36`'s own Finding 2 needed correcting, not just applying: it claimed upstream specifies
  no rounding rule for `Modifier.operation: "multiply"` against this kind's integer-cents money,
  and upstream in fact does — checked directly against the primary source while drafting §7.1,
  and the correction is recorded in `plans/32` and `plans/36` themselves, not only here.
- `AgentStrategy` (§7.10) is engine-owned code, not campaign data, despite upstream listing it
  alongside the content-definition types — a function member cannot be campaign JSON. How a
  campaign actually selects a rival's strategy is a genuine open gap, upstream included, not
  settled here.
- This kind's own runtime-validation result needed a name distinct from 04-core's
  `ValidationResult` (§5.3) — the two are different concepts upstream never had to
  disambiguate, having no load-time campaign-validation concept of its own.
- `ResolutionDebugInfo` (upstream §3.3) is superseded, not ported: this platform's
  `trace`-severity observability channel (05-observability.md) already serves the purpose it
  existed for, and `metadata.transparency` — the field it would gate on — lives outside
  `SimulationKindState` entirely (§2).
- `ChainScope`'s `"profile"` value (§2.2) had nowhere to persist — **closed by W102**, which
  gave the core `PlayerProfile.kindData` (04 §7.1) and this kind the `SimulationProfileData`
  slice that sits in it. The finding was right about the gap and right to refuse to invent the
  answer: what closed it is a core-side seam, not a simulation-side workaround. `Reward`'s own
  payload (§7.1) stays untyped exactly as upstream leaves it — still recorded as open rather
  than resolved, the same as `history`'s own status throughout this document.

**Nothing above changes what the seam looked like before this programme** — every finding is
detail hanging off it, or a genuine gap named rather than guessed at. What has changed is that
the upstream document is no longer where a reader has to go to find the shape of this kind's
own state and content; it is here, and upstream stays cited as provenance, exactly as
`04-core`'s own *Reused, not re-derived* note describes.

---

## 16. Save Migration (W102)

04 §10.2 owns the two-axis mechanism — `Kind.migrateState` for a kind-state shape change, then
`Campaign.migrateState` for a content-id remap, with `replayCompatible: false` sticky forward
and idempotence against its own output. This section owns only what is specific to a
**published** simulation campaign: how the campaign axis is expressed as data, so it survives
the JSON round trip a portable document makes.

**Why data and not a function.** `Campaign.migrateState` is a function, and JSON carries no
functions — the same wall `story-graph` hit and answered by splitting the migration into a
generic engine-owned walk plus a per-campaign table (`src/engine/src/portable/format.ts`,
`migrateFromContent`). A life sim needs the same answer for a stronger reason: it is the kind
whose games are measured in years, so it is the kind where "a content revision cannot reach an
existing save" is a ceiling on the product rather than an inconvenience.

```typescript
/** Sits on the simulation arm of `PortableCampaignBody` (04 §19), beside the story-graph
 *  arm's own `PortableMigration`. Reattached as `Campaign.migrateState` by `fromPortable`. */
interface SimulationMigration {
  /** The only `fromVersion` this migration accepts; anything else fails the load with
   *  `migration_failed` (04 §12). Same single-version gate `PortableMigration` uses — a chain
   *  of versions is a chain of published documents, not a list inside one. */
  readonly fromVersion: string;
  /** Applied in array order, left to right. Order is the author's and is deterministic; a
   *  domain may appear in more than one step. */
  readonly steps: readonly SimulationMigrationStep[];
}

type SimulationMigrationStep =
  /** Every reference to a key of `map`, in the named domain, becomes that key's value. */
  | { readonly op: "remap"; readonly domain: SimulationIdDomain;
      readonly map: Readonly<Record<string, string>> }
  /** Every reference to one of `ids` is dropped: removed from a collection that holds many,
   *  left absent at a site that holds one. */
  | { readonly op: "remove"; readonly domain: SimulationIdDomain;
      readonly ids: readonly string[] }
  /** A single-valued reference site left absent by the steps before it takes `id`. Never
   *  overwrites a site that still holds a resolving reference. */
  | { readonly op: "default"; readonly domain: SimulationIdDomain; readonly id: string }
  /** Every surviving reference in the domain must resolve against the new campaign's
   *  collection. One that does not fails the load with `migration_failed`. */
  | { readonly op: "require"; readonly domain: SimulationIdDomain };
```

**`SimulationIdDomain` is derived, not enumerated here.** It is a closed union with exactly one
member per `SimulationCampaign` collection whose ids `SimulationKindState` (§2, §6) actually
holds a reference to — jobs a player is employed in, courses enrolled, the housing occupied, the
items owned, the events on cooldown, and so on. The union and the **reference-site table** that
gives each member its list of state paths are declared together in one engine-owned module, so
the two cannot disagree; a Tier 1 check (§14) rejects a `SimulationMigration` naming a domain
the table does not cover. Enumerating the members in this document instead would be the third
count in this file to outlive the units that changed it — §3's system list and §10's code table
are the first two, and both are recorded here as having drifted.

**Every step is data, and the walk is engine-owned code.** There is no host callback anywhere
on this path, and there cannot be: a migration definitionally changes `serialize()` output, and
06 §2 admits a host only where it cannot. That is the same rule 04 §10.2 already states, and it
is what makes a published campaign safe to fetch — a portable document can ask for a remap, it
cannot ship behaviour.

**What the four ops cover, and what they refuse.** Together they express the whole of a content
revision's reach into an existing save: an id was renamed (`remap`), an id was withdrawn
(`remove`), a slot the game requires must not be left empty (`default`), and nothing may survive
pointing at content that no longer exists (`require`). They cannot add state, move a week,
change a balance, or award anything — 04 §10.2's *neither may invent play* rule, made structural
here rather than merely asserted, because the vocabulary has no verb for it.

**Failure is the existing vocabulary, unchanged.** A `fromVersion` that does not match, a
`require` that finds a dangling reference, a `default` naming an id absent from the new campaign,
or a throw anywhere in the walk all produce `migration_failed`; a `campaignVersion` mismatch on a
document carrying no migration produces `save_requires_migration`. Both are 04 §12 base codes
that have existed since W31 and neither is widened. Nothing is partially written: the walk
produces a new `kindState` or it produces a rejection, and `SessionStore.loadGame` writes no
session record on a rejection.
