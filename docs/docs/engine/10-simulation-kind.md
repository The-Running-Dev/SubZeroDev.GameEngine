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
  calendar: CalendarState;                     // current week, time units spent/committed
  player: PlayerState;                         // §6
  economy: EconomyState;
  world: WorldState;

  activeEffects: StatusEffect[];
  activeOpportunities: Opportunity[];
  scheduledEvents: ScheduledEvent[];
  pendingEventResponses: PendingEventResponse[];

  goals: GoalState[];
  plan: WeeklyActionPlan | null;               // §4 — the week being assembled
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
> actions they summarise, and a disagreement is unresolvable. They are computed on read.

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
relationships (upstream §8.1–§8.9).

**Field detail is not restated here** (§15). What this contract fixes is where they live —
inside `SimulationKindState.player`, opaque to the core — and two engine-level rules:

- **Money is integer cents.** No floating point in state; the determinism guard bans the
  non-bit-stable `Math.*` functions for the same reason.
- **Derived values are computed, never stored** (upstream §7), for the reason in §2.

---

## 7. Content Definition Types

Jobs, courses, housing, items, events, NPCs, goals, scenarios, agents (upstream §14.1–§14.9).

These are **campaign data**, loaded through the content registry (04 §10.1) exactly as
story-graph campaigns are. A simulation campaign is `kindId: "simulation"` plus data
conforming to this kind's schema — the same core/kind/campaign split (architecture §1), with
no new loading mechanism.

Identity fields — `id`, `version`, `titleKey` — live on the core `Campaign` envelope and
**not** in the kind's content types, the correction already applied to
`StoryGraphCampaign` (04 §10.1).

---

## 8. Conditions and Requirements

Reused verbatim from the core's frozen operator set (04 §18), which originated here
(upstream §13.1). This kind adds no operators. `between`, arithmetic, and helper functions
are out unless a concrete campaign need justifies each individually — the bar 04 §18 sets
deliberately high, and this kind is the one most likely to test it.

**This section's scope is conditions and requirements only** (upstream §13.1–§13.2).
`Modifier` and `Reward` (upstream §13.3–§13.4) are simulation mechanics, not condition
operators, and are deferred to the content-type port along with the rest of §7 — see §15.

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

| Upstream | Holds | Why not yet |
|---|---|---|
| §8.1–§8.9 | Player-state field detail (`PlayerState`) | ~20 KB. Structural home is fixed (§6); the fields need reconciling against typed-variable discipline (03 §2) before restating |
| §5.1, §5.3–§5.6 | The other nine `SimulationKindState` fields' upstream shapes — `CalendarState`, `WorldState`, `StatusEffect`, `Opportunity`, `ScheduledEvent`, `PendingEventResponse`, `GoalState`, `EconomyState` | ~425 lines. Same status as player state: the structural home is fixed (§2's table); field detail needs the same reconciliation before restating |
| §9, §9.1 | `WeeklyActionPlan`'s own shape (`ActionType`, `GameAction`) | References content ids (jobs, courses, …) that have no home until the row below lands |
| §14.1–§14.9 | Content definition types | ~25 KB. Needs the authoring→registry split applying (04 §10.1), which for story-graph was its own piece of work |
| §13.3–§13.4 | `Modifier`, `Reward` | Simulation mechanics hanging off `Condition`, not condition operators (§8 is scoped to §13.1–§13.2 only). `Modifier.operation: "multiply"` against this kind's integer-cents money (§6) has no upstream rounding rule — a determinism hazard to resolve *before* porting, not after, flagged here rather than fixed here |
| §12.2–§12.3 | End-of-week system order, goal precedence | Normative and short; blocked only on this table's own content-type row above |
| §7 | Base and derived values | Rule adopted (§2, §6); the formulae are content-balance material |

**This table now accounts for every field `SimulationKindState` (§2) names** — nine of ten
were missing a row entirely in this document's first revision (only `PlayerState` had one);
completeness is what makes the claim below trustworthy rather than merely reassuring.

**Nothing above changes this contract's shape** — each is detail hanging off a seam this
document fixes. What it does mean is that the upstream sections stay authoritative for those
areas until ported, which is exactly what `04-core`'s *Reused, not re-derived* note says.
