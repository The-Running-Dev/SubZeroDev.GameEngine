# W46 - The Deterministic World-Graph Tick Pipeline

**Scope:** Plan the second `world-graph` implementation unit: replace W45's deliberate
`advance_ticks` rejection with a bounded batch runner around one atomic tick, call all 20
contract systems in fixed order, establish disposable tick scratch and deterministic stream
helpers, aggregate batch-grain changes, implement scenario scheduling and tick-finalization,
and leave W47-owned mechanics as explicit tested no-ops. No playable Sun Trap slice yet.

**Depends on:** the complete W43/W44 contract chain
([PR #119](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/119),
[PR #120](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/120),
[PR #121](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/121), and
[PR #122](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/122)), W45's plan
([PR #124](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/124)), and the
subsequent merged W45 implementation. Execute only after `main` contains the final W42-W45
state, content, spatial, validation, initial-state, immediate-action, and public-export code.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
W46. This reaches T2: a tick batch resolves honestly. W47 owns the playable
spawn-to-resolution vertical slice.

**Status:** Planning only. This file records the measured starting point, real/stub boundary,
module ownership, tick frame, stream and audit rules, verification matrix, and execution
handoff. It changes no engine source or delivery status.

---

## Handoff - Start Here

### The prompt

> Execute W46 from `plans/46-w46-world-graph-tick-pipeline.md` only after W45 has merged.
> Cut a new `feature/w46-world-graph-tick-pipeline` branch from the then-current `main`.
> Replace W45's deliberate `advance_ticks` rejection with the bounded outer loop and the
> exact 20-system order in `12-world-graph-kind.md` §4. Implement system 1's scheduled,
> policy, and day-boundary mechanics and system 20's cleanup/tick commit; keep systems 2-19
> as individually named, tested, event-free no-ops until W47 supplies the MVP causal slice.
> Add deterministic tick/agent stream helpers, disposable scratch, batch-grain change
> aggregation, and split-batch tests with real cleanup and scheduled-effect boundaries. Do
> not restore the counter-only shortcut, invent a generic core pipeline, or smuggle W47
> guest/service/staff mechanics into this unit.

### Where to work

- **Authoritative contract:** `docs/docs/engine/12-world-graph-kind.md`, especially §§4-6,
  9, 11-13, and 15.3.
- **W45 result:** the merged `src/engine/src/kinds/world-graph/` modules and their minimum
  campaign fixture. Re-audit actual names after merge; this plan does not assume the current
  preserved draft survives unchanged.
- **Core seam:** `src/engine/src/core/kernel/types.ts` and
  `src/engine/src/core/determinism/types.ts`; `KindContext.derive` and the `tick`/`agent`
  stream variants already exist and need no core change.
- **Precedent, not an abstraction source:** `src/engine/src/kinds/simulation/advance.ts`,
  `endOfWeek.ts`, and `startOfWeek.ts`. Their useful discipline is an ordered pipeline with
  explicit stubs; their weekly mechanics and generic shape are not portable.
- **Programme ledgers:** `plans/39-world-graph-kind-programme.md` and
  `docs/docs/engine/TODO.md`.

### Working rules that are easy to violate here

1. A batch repeats one tick. No system receives requested tick count, action sequence, batch
   index, or knowledge of a preceding API call.
2. `processingTick` is captured once. Systems 1-19 read it; only system 20 writes
   `processingTick + 1`.
3. A terminal result never aborts a tick. Systems 19 and 20 still run; only the outer loop
   stops before the next tick.
4. System order is code-owned as one internal ordered tuple. Do not reproduce the list in
   `advance.ts`, tests, event code, and a second registry.
5. Scratch, indexes, path caches, RNG handles, candidate lists, and change-aggregation state
   never enter `WorldGraphKindState`, projection, outcome, save data, or root exports.
6. A stub is named, documented, identity-preserving, draw-free, allocation-free, event-free,
   and tested. A blank heading or omitted call is not an honest stub.
7. Never emit a generic `system.ran` event just to test order. The world-graph event contract
   has no such name; test the internal runner through injected system functions.
8. Tick/entity events may be compared across partitions. `batch.started`, `batch.ended`, and
   returned change arrays are call-grain and legitimately differ.
9. `ctx.rng` and `ctx.seq` are forbidden in the pipeline. World draws use a memoized tick
   handle; agent draws use the stored agent draw counter.
10. Do not extract a core `SystemPipeline`. W46 is the second real tick-driven
    implementation and the evidence for a later decision, not permission to pre-decide it.

---

## Measured Starting Point

The unit is being planned before its dependencies merge, so the measurements are evidence,
not an implementation base:

- `main` contains no production `world-graph` kind yet.
- The preserved W45 branch has 13 world-graph files and 2,842 inserted lines against its old
  base. Its `advance.ts` is 834 lines and implements `advance_ticks` as `tick + ticks` with
  none of the 20 systems.
- The W45 plan explicitly deletes that shortcut and keeps the verb unavailable until this
  unit. It also reserves `spatial.ts`, `conditions.ts`, and final state/content ownership for
  reuse here.
- The W44 execution branch expands the contract to 2,929 lines, including a complete
  system-by-system read/write/order/no-op/event specification and a W46/W47 verification
  matrix.
- The core already exposes `ctx.derive({ kind: "tick", tick, system })` and
  `ctx.derive({ kind: "agent", agentId, seq })`; there is no missing core seam to build.
- The simulation precedent calls every ordered phase and labels deferred mechanics as
  stubs. It does not offer a reusable pipeline type, batch-change aggregator, per-tick
  scratch boundary, or spatial cache.

The execution plan begins with a fresh post-W45 measurement: file/test counts, final module
names, minimum-fixture content, event registry, and the exact guard W45 used for unavailable
`advance_ticks`. If W45's merge differs from its plan, the merged code wins.

---

## Findings That Shape the Implementation

### 1. W46 is orchestration with two real bookends, not W47 in disguise

The programme deliberately separates the pipeline from the playable causal slice. W47 owns
guest spawn, need evolution, utility, path commitment, movement, queues, service, litter,
cleaning, construction/economy hooks, objectives, and win/loss. Implementing those here would
collapse two review units and make the pipeline's determinism infrastructure impossible to
review independently.

W46 nevertheless cannot be another fake clock. Two systems are fully real:

- system 1 handles day-boundary finance resets, due scheduled changes, active-policy effects,
  snapshot conditions, and canonical effect order;
- system 20 handles per-tick pruning/retention, referential cleanup, assertions, and the sole
  tick increment.

Those bookends create meaningful day, effect, cleanup, retention, and terminal-stop
boundaries for batch-invariance tests. Systems 2-19 remain explicit no-ops until W47 replaces
the subset needed for the MVP. Their calls and ordering are real even when their mutations
are not.

### 2. The system list needs one executable owner

The contract lists 20 names in one order. Copying that order into the dispatcher, tests,
event registration, and phase modules creates four opportunities to drift. One internal
`WORLD_GRAPH_SYSTEMS` tuple owns both stable ids and functions. `runWorldGraphTick` iterates
that tuple; tests inject an instrumented tuple through the same internal runner rather than
asking production events to prove implementation structure.

The tuple is not exported from the package root. It is a kind-internal implementation
contract whose ids are compile-time checked against a closed `WorldGraphSystemId` union.

### 3. Tick scratch and batch aggregation are different lifetimes

`TickScratch` is created fresh for each `processingTick`. It owns content indexes, the
map-revision path cache, one memoized RNG handle per tick/system id, transient task/delta
buffers, and system-local facts. No later tick may observe it.

`BatchChangeAggregator` lives for one `advance_ticks` call. Systems receive only a write-only
recording interface, never readable prior-tick values. It owns the first-before/final-after
coalescing rule and first-causal-system sort metadata. Keeping the lifetimes separate prevents
the requested batch partition from becoming accidental input to a system.

### 4. Stream derivation needs a local guardrail, not new core API

Calling `ctx.derive` twice with the same tick stream restarts it. A tick-local helper therefore
memoizes one mutable `RngHandle` per stable system id. A system requesting its handle twice
gets the same object at its current position, not a restarted stream.

Agent draws use a separate helper that takes `{ id, drawCount }`, derives exactly
`agent:<id>:<drawCount>`, performs one declared draw, and returns the value plus incremented
counter. The caller commits the increment in the same state transition as the sampled field.
Neither helper touches `ctx.rng` or `ctx.seq`, and a no-op never requests a handle.

### 5. Batch audit is not a flattened event log

The first spatial kind can produce orders of magnitude more internal activity than a client
can render. `StateChange` remains batch-grain:

- scalar rows coalesce by resolved path plus reason;
- `previous` is the first value, `value` the final value;
- a row disappears when final equals previous;
- `.exists` creation/removal transitions remain separate causal rows;
- output sorts by first system index, then path, then reason.

Per-guest, per-edge, per-task, and per-tick detail belongs in events. W46's implemented
systems emit only their declared events; a stub emits nothing and the kind registry does not
claim its future event names yet.

### 6. Tick finalization is the first batch-invariance test with teeth

The counter shortcut could pass a split test while doing nothing. Full system-20 behavior
cannot. Partition fixtures cross:

- departure pruning and FIFO survivor preservation;
- completed/cancelled task cleanup;
- incident `resolvedAtTick + 1` and cooldown retention;
- cleared/dismissed alert retention;
- a scheduled effect and day-boundary accumulator reset;
- an injected system-18 terminal transition, after which systems 19-20 still finish and the
  next tick does not begin.

Deep canonical kind-state equality over those boundaries is meaningful even before W47 adds
the guest-service causal chain.

### 7. The W44 test matrix is shared deliberately between W46 and W47

W46 proves runner order, frame isolation, scratch disposal, stream derivation, effect order,
change aggregation, finalization, emitter isolation, save boundaries, and split batches. W47
replaces stubs and adds mutation/order/event tests for systems 2-19 plus A*, utility, queue,
service, staff, finance, incident, objective, and failure fixtures.

Claiming the whole §15.3 matrix in W46 would either pull W47 forward or produce tests that
exercise no behavior. The plan records the allocation explicitly so neither unit can later
declare the other responsible for the same missing test.

---

## Decisions

### 1. Keep `advance.ts` as parsing/dispatch; move time to `tick/`

W45 should leave action parsing and immediate reducers outside the time pipeline. W46 adds:

| Owner | Responsibility |
|---|---|
| `tick/batch.ts` | Bounded outer loop, batch diagnostics, terminal stop, final status, and returned changes |
| `tick/pipeline.ts` | `processingTick`, fresh scratch, one-tick runner, injected/internal system tuple |
| `tick/scratch.ts` | Disposable indexes, path cache, typed deltas, candidates, and memoized tick RNG handles |
| `tick/random.ts` | Tick-system handle memoization and one-draw agent helper |
| `tick/changes.ts` | Batch-grain scalar coalescing, membership transitions, stable sort, path/reason checks |
| `tick/effects.ts` | Pure grouped effect application used by system 1 now and later systems without recursion |
| `tick/order.ts` | Closed system ids and shared complete comparator functions not already owned by W45 `spatial.ts` |
| `systems/scenario.ts` | Real system 1: boundary reset, snapshot conditions, scheduled changes, policies |
| `systems/guests.ts` | Named systems 2-8, explicit W47 no-ops in this unit |
| `systems/staff.ts` | Named systems 9-11, explicit W47 no-ops in this unit |
| `systems/world.ts` | Named systems 12-16, explicit W47 no-ops in this unit |
| `systems/resolution.ts` | Named systems 17-19, explicit W47 no-ops in this unit |
| `systems/finalize.ts` | Real system 20: cleanup, retention, assertions, tick commit |
| `systems/index.ts` | The sole ordered tuple, with no root-package export |

If W45 already establishes equivalent focused modules, merge responsibilities rather than
creating aliases. Do not put the 20 functions back into a new thousand-line `advance.ts`.

### 2. One frame type hides batch size structurally

Every system accepts and returns an internal frame equivalent to:

```typescript
interface WorldGraphTickFrame {
  readonly processingTick: number;
  readonly content: WorldGraphCampaign;
  readonly emit: ResolutionEmitter;
  readonly random: TickRandom;
  readonly scratch: TickScratch;
  readonly changes: TickChangeRecorder;
  readonly state: WorldGraphKindState;
}
```

There is deliberately no raw `KindContext`, requested tick count, batch ordinal, action
sequence, action RNG, or raw batch aggregator on the frame. `TickRandom` exposes only the
derived helpers in Decision 7. A returned frame may replace `state` and scratch buffers but
must retain the exact `processingTick`.

`runWorldGraphTick` captures `state.tick`, creates scratch, runs the tuple, verifies system
20 committed exactly one tick, and returns the state. It does not decide whether another
tick runs.

### 3. `advance_ticks` validates once, then delegates

The action parser requires an integer `ticks` parameter. Missing/non-integer values use the
existing malformed-action behavior; `ticks < 1` is `ticks_not_positive`; values above the
validated campaign cap are `tick_limit_reached`. The call rejects rather than truncates and
emits nothing on rejection.

For an accepted call:

1. emit `batch.started` with requested ticks and starting tick;
2. repeat `runWorldGraphTick` until requested ticks are processed or the returned state has
   immutable resolution;
3. emit `batch.ended` with requested ticks, processed ticks, and final tick;
4. return status from the final resolution and the batch aggregator's rows.

The engine appends one `LoggedAction`, irrespective of processed ticks. A terminal result
does not begin another tick, so `processedTicks` may be less than requested without being the
cap truncation §6 forbids.

### 4. System 1 is complete enough to be an authority

System 1 is not a half-stub. It implements the complete W44 contract against merged W45
types:

- detect a day boundary from `processingTick` and `ticksPerDay`;
- reset daily finance accumulators before any due effect;
- snapshot every condition against system-entry state;
- select due scheduled changes and sort by due tick, priority descending, source definition
  id, authored change index, then effect index;
- apply due effects in that order;
- apply active policies by definition id and authored `whileActive` effect order;
- group numeric writes by owning scalar, safe-add, and clamp once;
- emit `scenario.effect.applied` per applied effect and record only batch-grain scalar rows.

Conditions do not observe earlier effects from the same system. Effects cannot recursively
emit effects or invoke a system. Random non-constant incident durations, if admitted by the
merged contract, use the one `scenario` tick handle in effect/target order.

### 5. Systems 2-19 are explicit, individually replaceable W47 stubs

Each function carries its stable id and contract section, returns the frame unchanged, and
does not request RNG, allocate ids, emit events, or record changes. A table-driven test calls
each function with non-empty representative state and proves reference identity and zero
side channels.

The production tuple still calls every function in contract order. W47 replaces function
bodies in place and adds their declared event names only when a producer exists. No generic
stub helper hides which systems remain deferred.

### 6. System 20 owns cleanup and the tick commit

`tick-finalize` performs, in canonical entity order:

1. remove guests finalized as departed/removed this tick;
2. remove their queue references while preserving survivor FIFO order;
3. clear completed/cancelled nested tasks and restore the contract's idle/off-duty status;
4. prune resolved incidents only after both the following audit tick and cooldown boundary;
5. prune cleared/dismissed alerts only after their timestamp is earlier than
   `processingTick`;
6. assert every queue guest, task target, assignment, incident owner, and other W45-proven
   runtime reference still resolves;
7. set `tick = processingTick + 1` once;
8. emit `tick.finalized` and record the coalesced tick change.

Invariant assertion failure is a defensive programming error, not a player rejection with a
new reason code. W45 immediate reducers and validated initial state must make the assertion
unreachable through supported actions.

### 7. Random helpers enforce the existing seam

`tickRng(systemId)` memoizes
`ctx.derive({ kind: "tick", tick: processingTick, system: systemId })`
inside scratch and returns the same handle on repeated access. It derives lazily, so a no-op
consumes and traces nothing.

`drawAgent(agent, draw)` derives the current `agent:<id>:<drawCount>` handle, executes one
declared high-level draw, and returns `{ value, drawCount: old + 1 }`. It never exposes a
generator state or increments after an exception/rejection. W47 callers commit the new
counter with the sampled field immediately.

Tests use a recording `derive` function to prove stream ids are independent of batch
partition and that neither `ctx.rng` nor `ctx.seq` participates.

### 8. Change aggregation is a typed write-only service

Systems record candidate rows with their system id and causal ordinal. The aggregator:

- validates the W45 scalar/member path grammar;
- coalesces scalar `set` rows by path plus reason;
- retains the first `previous` and last `value`/visibility;
- drops no-net-change scalar rows;
- appends membership `.exists` transitions separately;
- sorts by system tuple index, path, reason, then causal ordinal for otherwise identical
  membership transitions.

The tick row is one visible `ticks_advanced` change from batch start to batch end. It is not
one row per tick. Different batch partitions may return different row arrays and still pass
batch invariance.

### 9. Event permission grows only with real producers

W46 adds these names to `Kind.eventNames` if W45 did not already reserve them:

- `kind.world-graph.batch.started`;
- `kind.world-graph.batch.ended`;
- `kind.world-graph.scenario.effect.applied`;
- `kind.world-graph.tick.finalized`.

Systems 2-19 emit nothing and do not add their future names. Tick events use system and
comparator order. `batch.started`/`batch.ended` are filtered when comparing partitioned
event streams; every other W46 event must agree.

### 10. No public surface or core abstraction is added

W46 changes the behavior behind the already-public `worldGraphKind`; it does not export
pipeline functions, scratch, system ids, caches, random helpers, or aggregators from
`src/engine/src/index.ts`. Packed-artifact smoke proves those remain inaccessible.

After W46 merges, record the implementation comparison with `simulation` in the relevant
open-question entry. That evidence may support a future core-substrate design. It does not
authorize extracting one in this PR.

---

## Verification Matrix

### Batch parsing and orchestration

- Missing, non-integer, zero, negative, cap-exceeding, and valid `ticks` parameters map to
  the exact existing reason behavior and reject without state/event/draw changes.
- One tick calls all 20 ids once in exact order. Multiple ticks repeat the entire tuple.
- Every system sees one immutable `processingTick`; only finalize changes state tick.
- A terminal transition still calls systems 19-20 and prevents the next iteration.
- Batch diagnostics report requested/processed counts and start/end ticks in causal order.
- Direct kind tests and a real `createGame`/`submitAction` integration test agree.

### Scratch, streams, and caches

- Scratch is fresh per tick and cannot appear in canonical serialization or projection.
- Repeated tick-handle requests return one continuing handle, not a restarted derivation.
- World stream ids depend only on processing tick and stable system id.
- Agent stream ids use the stored counter; one draw increments it exactly once.
- No-op systems derive nothing; recording/null emitters return identical state.
- Cache enabled/disabled produces identical scenario/finalize state now; W47 adds the A*
  answer/event comparison when system 7 becomes real.

### Scenario system

- Day-zero and later boundary resets happen before due effects; non-boundary ticks preserve
  daily accumulators.
- Conditions are immutable snapshots; one effect cannot make a later condition newly true in
  the same system pass.
- Scheduled and policy effects follow the complete W44 comparators and authored inner order.
- Grouped numeric effects clamp once, use safe integer arithmetic, and do not recurse.
- Empty schedules/policies are identity no-ops; real applications emit exactly their declared
  events and batch changes.

### Stub frontier and system order

- Systems 2-19 each have a focused identity/no-side-channel test and an explicit W47 marker.
- The tuple is compile-time checked against the closed id union; a focused test rejects a
  missing or duplicate phase entry.
- Injected test systems prove actual call order without a production `system.ran` event.
- The event registry contains no event whose only possible producer is still a stub.

### Tick finalization and integrity

- Departure pruning occurs on the finalizing tick, not at API-batch end.
- Queue survivors retain FIFO order after guest removal.
- Completed/cancelled tasks clear at the exact boundary without dangling targets.
- Incident retention respects both one following audit tick and cooldown.
- Alert retention preserves the clearing/dismissal tick and prunes on the later tick.
- Foreign dangling state triggers the defensive assertion; supported W45 reducers never do.
- Finalize always increments once and emits one `tick.finalized` event.

### Changes, events, and invariance

- Scalar changes preserve first-before/final-after and disappear on net zero.
- Membership transitions remain separate and all output ordering is stable.
- Tick/entity events match across partitions after filtering only batch diagnostics.
- Deep canonical kind-state equality covers `a+b` against `a` then `b` for several
  partitions over day reset, scheduled effect, departure, task, incident, alert, and terminal
  boundaries.
- Save/deserialize between the two calls produces the same final kind state.
- Envelope action logs are intentionally different and are not the batch-invariance oracle;
  `outcome()` equality is asserted in addition to, not instead of, kind-state equality.

### Package and repository gates

- World-graph internals remain absent from root exports and the packed artifact surface.
- Existing W45 immediate-action success/rejection/no-time-passes tests remain green.
- Engine typecheck, lint, full tests, build, packed-consumer smoke, documentation gate,
  `git diff --check`, and all three required PR checks pass.

---

## Sequence

1. Wait for W43-W45 to merge; sync `main`; cut the W46 execution branch; record the complete
   engine baseline and final W45 module inventory.
2. Move W45's `advance_ticks` unavailable guard to the bounded parser/delegation path; do not
   temporarily restore counter-only behavior.
3. Add the closed system-id/order registry and injectable one-tick runner with table-driven
   order/frame tests.
4. Add fresh tick scratch, deterministic stream helpers, cache boundary, and batch change
   aggregator with focused tests.
5. Implement system 1 and its effect interpreter against the merged W43/W45 content and
   condition types.
6. Add explicit named system 2-19 stubs grouped by ownership and prove their identity/no-side-
   channel behavior.
7. Implement system 20 cleanup, retention, reference assertions, tick event, and tick change.
8. Assemble the bounded outer loop, terminal stop, batch diagnostics, and final status.
9. Add split-batch, emitter/cache isolation, save-boundary, and real-engine integration tests.
10. Reconcile the event registry and packed-artifact boundary; update programme/TODO review
    status only after the execution PR exists. Do not mark W46 delivered until merge.

---

## Done-When

- [ ] W46 starts from merged W45 on a fresh branch, with no rewritten W43-W45 history.
- [ ] `advance_ticks` validates positive bounded integer ticks and never truncates the cap.
- [ ] The outer loop repeats one atomic tick and stops only between ticks after resolution.
- [ ] One internal tuple calls all 20 stable system ids in normative order exactly once per
      processed tick.
- [ ] Systems cannot observe requested batch size, action sequence, or previous API calls.
- [ ] Tick scratch, caches, stream handles, candidates, and delta buffers are disposable and
      absent from state, projection, saves, outcome, and public exports.
- [ ] Tick/world and agent randomness use only the existing derived-stream seam; `ctx.rng`
      and `ctx.seq` are unused by the pipeline.
- [ ] System 1 implements boundary reset, condition snapshots, scheduled changes, policies,
      effect order, grouped arithmetic, events, and changes.
- [ ] Systems 2-19 are individually named, invoked, documented, tested no-ops with no false
      events, changes, draws, or allocations.
- [ ] System 20 performs per-tick cleanup/retention, asserts reference integrity, and is the
      only tick writer.
- [ ] Batch diagnostics distinguish requested from processed ticks and never affect state.
- [ ] Batch changes follow first-before/final-after coalescing and stable causal sorting.
- [ ] Deep canonical kind-state equality passes over meaningful day/effect/cleanup/terminal
      partitions; Outcome equality is an additional assertion only.
- [ ] Recording and null emitters, cache modes, and save boundaries produce identical state.
- [ ] W45 immediate actions and minimum campaign continue to work through the real engine.
- [ ] Pipeline internals remain absent from the supported root/package surface.
- [ ] Programme/TODO ledgers describe W46 accurately, while public roadmap delivery remains
      unchanged until the implementation merges.
- [ ] Typecheck, lint, tests, build, packed smoke, documentation, diff, and required PR gates
      all pass.

---

## Explicitly Not In Scope

- **No W47 playable slice.** Guest spawn/needs/intent/path/move, queues/service, litter,
  staff task behavior, construction/economy mechanics, objectives, and failure remain W47.
- **No full post-MVP mechanics.** Groups, weather, congestion, advanced inventory, loans, and
  complex incidents may remain contract-declared no-ops beyond W47 where the programme says.
- **No `previewAction`.** Engine/session/text/MCP parity remains W48.
- **No W49 scenario or replay corpus.** The canonical MVP campaign, winning/losing fixtures,
  release-tag comparison, and published world-graph package remain W49.
- **No core `SystemPipeline`.** W46 records evidence for the revisit; it does not perform it.
- **No persisted RNG state or cache.** Derived scratch remains outside replayable state.
- **No second event catalog.** Stable system ids are implementation order, not generic
  observability events.
- **No Sun Trap repository or balance edits.** The engine owns mechanics and types; the game
  owns concrete values and client design.
- **No roadmap completion claim.** A plan PR and even an open execution PR are not delivery.
