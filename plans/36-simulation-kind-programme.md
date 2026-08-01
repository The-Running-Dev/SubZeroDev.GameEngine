# The `simulation` Kind — Programme

**Units:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Life in the Fast
Lane*. Proposed as **W27–W33**, numbers assigned when each is cut.

**Scope:** Umbrella plan for the second engine-owned kind: finishing its contract in this
repository, then building it against that contract. Records how the work splits and why, sized
against the real upstream source rather than against `10-simulation-kind.md` §14's summary of
it. Planning only.

**Depends on:** **W25** ([`plans/32`](32-w25-simulation-kind-seam-reconciliation.md)) — the seam
must be complete and self-consistent before field detail hangs off it.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md), Tranche B.

**Precedent:** [`plans/27-replay-oracle-programme.md`](27-replay-oracle-programme.md) — same
structure: the programme records the split and the decisions; each unit gets its own plan when
executed.

---

## The Source, and Why Sizing Had to Be Redone

`10-simulation-kind.md` §14 lists what remains upstream in a four-row table. That table is
incomplete — [`plans/32`](32-w25-simulation-kind-seam-reconciliation.md) Findings E and H
establish that it omits eight of the ten types `SimulationKindState` names, plus `Modifier` and
`Reward` entirely. Sizing this programme from that table would have understated the work by
roughly half.

The upstream document is readable locally
(`D:\Dropbox\Projects\SubZeroDev.GameOfLife\docs\docs\games\04-engine-specification.md`,
102 KB / ~2900 lines), so the sizing below is measured from it directly.

### What actually has to come across

| Upstream § | Lines | Holds | In 10 §14's table? |
|---|---|---|---|
| §5.1, §5.3–§5.6 | ~350 | `CalendarState`, `WorldState`, `StatusEffect`, `Opportunity`, `ScheduledEvent`, `PendingEventResponse`, `GoalState`, `EconomyState` + two lifecycles | **No** |
| §7 | ~63 | Base vs derived values | Yes (rule only) |
| §8.1–§8.9 | ~368 | `ActorState` and its nine areas | Yes |
| §9, §9.1 | ~82 | `ActionType`, `GameAction`, `WeeklyActionPlan` | **No** |
| §10.0–§10.4 | ~173 | Resolver dispatch, pipeline, outcomes | Partly (§5 adopted the rules) |
| §12.2–§12.3 | ~65 | End-of-week order, goal/failure precedence | Yes |
| §13.2–§13.4 | ~67 | Requirements, `Modifier`, `Reward` | **No** |
| §14.1–§14.9 | ~501 | Jobs, courses, housing, items, events, NPCs, goals/scenarios, supporting defs, agents | Yes |
| | **~1670** | | |

**Explicitly not coming across** — core material `04-core.md` already owns, per `CLAUDE.md`'s
*Reused, not re-derived*: §1–§3 (principles, conventions, randomness), §4 (content registry),
§6 (projections), §11 (engine API), §13.1 (the frozen `Condition` set), §16–§18, §20. That is
roughly the other half of the document, and re-porting any of it would be the
envelope-duplication defect a sixth time.

---

## Findings That Shape the Split

### 1. `ActorState` is shared by the player and every rival — so it cannot be ported "for the player" first

Upstream §8 (line 1145): "The player and every rival share this shape — design §14.2 requires
the rival to obey identical mechanics, and the only way to guarantee that structurally is for
both to run the same state through the same systems." `PlayerState` is a type alias for
`ActorState`, and rivals live in `WorldState.agents: AgentState[]`.

The obvious-looking split — *port player state, build the loop, add rivals later* — is
therefore wrong. Rivals are not a feature layered on top; they are the same state running
through the same systems, and a "player-only" port would produce a shape that has to be
re-derived when rivals arrive. **Actor state comes over whole, once.**

### 2. `Modifier.operation: "multiply"` collides with integer-cents money, and upstream does not say how

Upstream §13.3 defines `operation: "add" | "subtract" | "multiply" | "set"` with a
`value: number`, against a `target` that "must resolve to a writable base path" — which
includes money paths. `10-simulation-kind.md` §6 states **money is integer cents, no floating
point in state**, and `src/engine/eslint.config.js` bans the non-bit-stable `Math.*` functions
outright.

A `multiply` by a non-integer against integer cents produces a non-integer, and **upstream
specifies no rounding rule**. Two runs that round differently diverge, which is precisely the
class of defect the determinism harness exists to catch — except that here it would be baked
into the content model rather than introduced by a bug.

This needs deciding *before* `Modifier` is ported, not during. Options: basis points with
explicit integer division (upstream already defines `BasisPoints` at line 173, which suggests
this was the intent and `multiply` is vestigial), or dropping `multiply` from the operation set.
**Recommendation:** basis points with a stated rounding rule, since the type already exists.

### 3. The kind cannot be built incrementally against a half-ported contract

`03-story-graph-kind.md` was fully written before W9 started, and W9–W14 built against a stable
target. This programme keeps that property: **all contract work finishes before any code
starts.** The alternative — port a section, build it, port the next — means every later port
can invalidate earlier code, and the type surface here is an order of magnitude larger than
story-graph's.

### 4. `KindContext.derive` and the `agent` stream are already built

[`plans/33`](33-post-mvp-programme.md) Finding 1. TODO.md lists them as gaps this kind shares;
they were built in W1/W2 and all four `StreamId` variants are encoded. The rival's draws
(`{ kind: "agent", agentId, seq }`) have a working home today. **No seam work is needed before
this programme starts** beyond W25.

---

## The Split

### Contract (doc-only, must complete before any code)

| W | Unit | Source | Size |
|---|---|---|---|
| **W27** | Simulation state types | §5.1, §5.3–§5.6, §9.1 | ~430 lines |
| **W28** | Actor state | §7, §8.1–§8.9 | ~430 lines |
| **W29** | Content definition types | §14.1–§14.9, §13.3–§13.4 | ~570 lines |
| **W30** | Resolution and systems | §9, §10, §12.2–§12.3, §13.2 | ~320 lines |

Split by **type cluster with a natural review boundary**, not by even size. Each is reviewable
on its own: W27 is the state envelope's contents, W28 is one shared actor shape, W29 is content
data, W30 is behaviour over the three.

W29 carries the `Modifier` decision (Finding 2). W30 carries the goal/failure precedence that
W25 already found `outcome()` cannot currently express (`plans/32` Finding F) — the two need to
agree, and W30 is where that is settled in detail.

### Build (code, against the completed contract)

| W | Unit | Mirrors |
|---|---|---|
| **W31** | State, variables, and the plan | W9 |
| **W32** | The week: start-of-week, resolution, end-of-week | W11 + W12 |
| **W33** | Validation, the "Stable Life" scenario, corpus | W14 + W15 + W22 |

Deliberately mirrors the story-graph build order (W9→W14), which worked. The differences are
that W32 is larger than any single story-graph unit (a whole ordered system pipeline rather
than a settle loop) and W33 folds content and corpus together because the scenario *is* the
test subject.

**W33 ends with replay-corpus fixtures**, not just tests. `07-replay.md`'s oracle covers any
kind, and the two-phase time-ordering rule (10 §3) is called out in the contract itself as
"the kind of rule the determinism harness cannot catch and the replay oracle (07) can." Adding
simulation fixtures to `fixtures/replay/` is the payoff for that claim.

---

## Decisions

### 1. Contract fully before code — no interleaving

Finding 3. This is the single most consequential decision in the programme and it is the one
most likely to be argued with, because four doc-only units in a row is unglamorous and produces
nothing runnable. The counter-case is real: contracts written far ahead of code are where this
project's drift ledger comes from, and `10-simulation-kind.md` itself is Exhibit A — written in
PR #16, five findings' worth of stale by W25.

It is still right here, for a reason specific to this kind: ~1670 lines of interlocking types
where `ActorState` is referenced by content definitions, which are referenced by resolvers,
which are referenced by systems. There is no prefix of that graph that can be built against
safely. Story-graph could have been interleaved and was not; this one cannot be.

The mitigation for the drift risk is that W27–W30 are **transcription against a settled seam**,
not design — the design decisions are enumerated (Findings 2, and `plans/32` Findings C and F)
and each is resolved in a named unit rather than left to discover.

### 2. Port `ActorState` whole, rivals included

Finding 1. A player-only port produces a shape that must be re-derived.

### 3. Decide `Modifier`'s arithmetic before porting it, in W29

Finding 2. Porting `multiply` as written imports a determinism hazard into the content model,
where it is far more expensive to remove than to decline now.

### 4. Do not extract a shared tick-pipeline substrate in this programme

`OPEN-QUESTIONS.md` §2 declines it with a stated *revisit when*: the second tick-driven kind is
implemented. This programme builds the **first**. Building the pipeline generically here would
draw an abstraction from one case — the same anti-pattern `plans/27` Decision 2 declined for
`createSessionLayer`, and the same one `OPEN-QUESTIONS.md` uses the phrase *one built instance
is not a pattern* for. W32 hand-rolls its pipeline. `world-graph` is when the question opens.

### 5. `history` stays out, per the existing deferral

`OPEN-QUESTIONS.md` §2 defers it for `simulation` and `world-graph` together — "resolve both
together or not at all" — and `10-simulation-kind.md` §2 declines it pending evidence it holds
something `StateChange` does not. W27 is where that evidence would appear if it exists; if it
does not, the item closes rather than lingering.

### 6. No culture pack in this programme

The Bulgaria culture pack needs content packs (`11-content-packs.md`), which are separately
deferred, and needs this kind to exist first. It is Tranche C in
[`plans/33`](33-post-mvp-programme.md), and `life-in-the-fast-lane.md`'s own DoD lists it last
and marks it optional for the base game.

---

## Milestones

| # | Reached when | Meaning |
|---|---|---|
| **S1 — The contract is whole** | W30 merged | Every type `SimulationKindState` names is specified in this repository. `10-simulation-kind.md` stops being "the seam only" |
| **S2 — A week resolves** | W32 merged | The loop runs: plan, `end_week`, systems, next week. Determinism harness passes on it |
| **S3 — Stable Life plays** | W33 merged | Win and loss both reachable through the text client and MCP identically. Programme milestone **M7** |
| **S4 — Guarded** | W33's fixtures in the corpus | The replay oracle covers a second kind; the two-phase time-ordering rule has a regression test with teeth |

`life-in-the-fast-lane.md`'s DoD adds one criterion this programme does **not** deliver — "at
least one culture pack loads and swaps content without an engine change." That is content
packs, Tranche C. The game's DoD is therefore not fully closed by this programme, and saying so
here is better than discovering it at S3.

---

## Explicit Non-Goals

- **No core changes.** Everything this kind needs from the seam exists (Finding 4). If a unit
  finds otherwise, that is a core unit with its own plan, not a change smuggled into a kind.
- **No shared tick substrate.** Decision 4.
- **No content packs, no culture pack, no hosted anything.** Decisions 6 and Tranche C.
- **No re-porting of core material** — §1–§4, §6, §11, §13.1, §16–§18, §20 stay upstream as
  provenance. Re-deriving them would be the envelope-duplication defect a sixth time, and the
  ledger in `CLAUDE.md` is to be *added to and re-counted*, not incremented from memory.
- **No W-numbers treated as fixed.** W27–W33 are proposed. They are assigned when each unit is
  cut, per `TODO.md`'s positional-numbering note.
