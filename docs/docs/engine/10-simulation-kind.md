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
> that `StateChange` does not. Recorded in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).
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

#### World Strangeness

Content gates events and headlines on a **derived** strangeness value, not the raw
`strangenessBase` above — so a `Modifier` (§7.1) can push it, and so the raw number never leaks
into a projection. The player is meant to notice the drift, not read the dial.
`strangenessBase` itself rises on a curve with elapsed weeks; the curve's shape is
content-balance material, out of scope here the same way §6.1's derived-value formulae are
content-balance material rather than part of the mechanism itself.

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
fresh budget. `end_week` (§4) refuses to resolve while `pendingEventResponses` is non-empty —
the concrete reason code is named once §10 (Reason Codes) has a real caller to attach it to.

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

**End-of-week ordering is equally normative** (upstream §12.2), run once `end_week` has
resolved every planned action (§5):

```text
employment          education          finance_income     inventory
housing              finance_reconcile  needs               relationships
opportunities        events             headline            goals
failure              week_limit         achievements        history
```

Order is stable and covered by test, the same as start-of-week. `headline` runs after `events`
so a week's headline can reference the strangeness level that week's own events just moved.
`achievements` runs second-to-last because an achievement condition may depend on anything
earlier in the pass, including a counter a `goals`/`failure` system just incremented.

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

`GoalFailurePrecedence` and its default are already load-bearing in §12 (Terminal Identity),
which now also states `week_limit_reached`'s precedence against the two — restating the type
here does not repeat that reasoning; §12 carries it. Every rival advantage is declared on
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

**How a campaign actually selects a strategy is a real, open gap, not settled by this port.**
`AgentState.strategyId` is *runtime* state, built at `initialState` — not something a campaign
author writes. Neither `ScenarioDefinition` (§7.8) nor anything else in this contract declares
how many rivals a scenario has or which strategy each one initializes with; checked directly
against upstream, and it doesn't specify this either — no `ScenarioDefinition` field, no
separate agent-configuration type, anywhere in the ~3300-line source. An earlier revision of
this section claimed `AgentState.strategyId` was "the actual campaign-facing surface," which
overstated it: a runtime field a campaign never writes cannot be the surface a campaign uses to
configure anything. **Revisit when** a real scenario needs a rival — the natural home is a new
`ScenarioDefinition` field (e.g. `rivals: Array<{ strategyId: string }>`), decided against a
concrete need rather than guessed at here.

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

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`,
`action_not_available` (a `"custom"` `GameAction` reaching resolution, §4.2).

**Campaign validation — what `validateCampaign` returns (§14):**

| Code | Tier | When |
|---|---|---|
| `duplicate_id` | 1 | Two definitions of the same content type share an `id` |
| `dangling_reference` | 1 | A definition references an `id` that resolves to nothing |
| `numeric_natural_key` | 1 | An addressing path segment is all digits where a natural key is required (§7.1) |
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

> **This set grows as the dispatched systems land, and that is deliberate.** A code joins
> `Kind.reasonCodes` when the unit that actually produces it exists, not when this table
> first names it — the precedent `story-graph` set, whose own codes joined across W10, W11,
> W12 and W14 rather than being pre-declared. `plan_empty` and `week_limit_reached` are the
> two still outstanding; `plan_empty` has an additional gate of its own, recorded in
> `90-decisions.md`: no `SimulationCampaign` field exists yet for a campaign to forbid an
> empty plan with. The shipped set lives in
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
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;  // null while active
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
} {
  const terminal = state.resolution;
  return {
    resolution: terminal?.resolution ?? null,
    goalsMet: terminal?.goalsMet ?? [],
    goalsFailed: terminal?.goalsFailed ?? [],
  };
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
  `BackgroundDefinition`, `TraitDefinition`, `SkillDefinition` — §7.2–§7.10, each independently).
- Every reference to another definition's `id` resolves: `PromotionPath.toJobId` →
  `JobDefinition`; `ScenarioDefinition.startingBackgroundIds`/`startingHousingId`/
  `startingLocationId`/`goalIds`/`startingInventory[].definitionId` → their respective
  definitions; `EmployerDefinition.jobIds`/`npcIds` → `JobDefinition`/`NPCDefinition`;
  `LocationDefinition.connections` → `LocationDefinition` (the adjacency graph, §7.9);
  `OpportunityDefinition.targetId` → whichever definition type its own `kind` names
  (`job_offer` → `JobDefinition`, `course_place` → `CourseDefinition`, and so on).
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
- `ChainScope`'s `"profile"` value (§2.2) has nowhere to persist yet, and `Reward`'s own payload
  (§7.1) stays untyped exactly as upstream leaves it — both recorded as open rather than
  resolved, the same as `history`'s own status throughout this document.

**Nothing above changes what the seam looked like before this programme** — every finding is
detail hanging off it, or a genuine gap named rather than guessed at. What has changed is that
the upstream document is no longer where a reader has to go to find the shape of this kind's
own state and content; it is here, and upstream stays cited as provenance, exactly as
`04-core`'s own *Reused, not re-derived* note describes.
