# W11 — Nodes, Turn, and Settle

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W11

**Scope:** The four node kinds, `enter(nodeId)`, the settle loop, the `SETTLE_STEPS`
guard, and `initialState` returning `InitialStateResult` (03 §3, §8.1, §8.2, §8.4).

**Depends on:** W2, W3a, W9, W10 — all done, merged.

## What's Actually Left to Build

Nothing here exists yet. This is the first unit whose `initialState` is a literal member
of the core's `Kind<KState>` interface (`kernel/types.ts`) rather than a standalone helper
W12+ will later wire in — W9's `applyConsequences` and W10's `evaluateStoryGraphCondition`
were both deliberately *not* part of that interface. `enter` and `settle` are internal
helpers with no interface obligation, so their signatures take exactly what they need,
matching W9/W10's pattern.

`initialState(campaign: Campaign, ctx: KindContext)` is enough, on its own, to run through
the **real, already-built** `kernel/engine.ts createGame` — that function already calls
`kind.initialState(campaign, ctx)` per 04 §4's pseudocode (built in W3). This unit proves
that seam works end-to-end, not just in isolation.

## Decisions

### 1. `enter`/`settle` are narrow helpers; `initialState` matches the real `Kind` signature

`enter(state, nodeId)` and `settle(nodes, schema, state, rng, emit)` take the specific
values they need — a node map, a `VariableSchema`, the current state, an `RngHandle`, a
`ResolutionEmitter` — rather than a full `KindContext`. Neither is a `Kind<KState>` method,
so there's no interface to match; a full `KindContext` would force fake `registry`/
`campaign`/`seq` fields into every direct unit test for no reason (the W9/W10 precedent).

`initialState`, by contrast, **is** one of `Kind<KState>`'s five methods
(`kernel/types.ts`), with a fixed signature the core already calls exactly this way. It
narrows `campaign.content` to `StoryGraphCampaign` — the one place in this kind allowed to
know that concrete shape, since the core treats `Campaign.content` as `unknown` by design.

### 2. `node.entered` fires for the start-node entry too, not just settle pass-throughs

03 §8.2's own callout is explicit: "every entry counts, including settle pass-throughs
**and the initial start node**." `initialState` enters `startNodeId` once, *before* the
settle loop even begins (03 §8.2's `createGame` pseudocode: "enters `startNodeId`... and
runs `settle` once") — so if `settle` were the only place that emitted `node.entered`, the
start entry would never fire it. A shared `enterAndEmit(nodes, state, nodeId, emit)`
helper — `enter` plus the event, looking up the node's `kind` for the event's `nodeKind`
field — is called once by `initialState` for the start node and once per pass-through
inside `settle`'s `auto`/`random` branches. `enter` itself stays pure and event-free, so
the done-criterion ("every entry increments its visit count") is testable against it
directly with no emitter in the way.

### 3. A guard trip emits the event, then throws — `InitialStateResult` has no error slot to fill

03 §8.2's pseudocode says "if the guard trips → **engine error**," language this project
otherwise reserves for defensive backstops (`weightedPick`, W9's undeclared-variable
guard) rather than for `ValidationError`-shaped rejections. Two structural facts confirm
that reading here specifically:

- `InitialStateResult` (`kernel/types.ts`) is `AdvanceResult` **minus** `error` — 04 §3's
  own comment says a pre-validated campaign "cannot fail to start the way an action can."
  There is no field to report a trip through if `initialState`'s own opening `settle`
  call is what trips it.
- By the time `settle` is mid-loop, state has already changed (turn advanced, nodes
  entered) — "rejected, state unchanged" (`AdvanceResult.error`'s own contract) does not
  describe what happened.

`settle` therefore always throws a plain `Error` on a guard trip, after emitting
`kind.story-graph.settle.guard_tripped` (severity `error`, `reason: "settle_guard_tripped"`
— the code 03 §8.3 already names, so unlike W10's `unknown_condition_field` this isn't a
new convention needing to be invented). `settle` is a shared primitive `initialState`
*and* a future `submitChoice` (W12) both call; whether a mid-`advance` trip should instead
be caught and surfaced as `AdvanceResult.error` is a decision for whichever unit builds
`submitChoice`, not this one — `settle`'s own contract is the same regardless of caller.

### 4. `StoryGraphCampaign.achievements` is a typed placeholder

03 §1's `StoryGraphCampaign` includes `achievements: AchievementDefinition[]` (03 §7),
which doesn't exist until W13. Nothing in `enter`/`settle`/`initialState` reads
achievements, so inventing that type now would be doing W13's job early for no benefit.
`achievements: readonly unknown[]` is the field's honest shape until then — present (so
the type is a faithful campaign-content shape other code can start building against) but
untyped (so nothing here pretends to know its structure).

### 5. `Choice`/`RandomTransition` (03 §4) had to be defined now — `ChoiceNode`/`RandomNode` need them

03 §4 isn't in this unit's cited spec sections, but `ChoiceNode.choices: Choice[]` and
`RandomNode.transitions: RandomTransition[]` can't compile without them. Defined in full
(including `showWhen`/`requirements`/`requirementFailKey` on `Choice`), but nothing in
this unit evaluates them — gating a choice by `showWhen`/`requirements` is W12's
`availableActions`, not the settle loop. `RandomTransition.weight` validation (positive
integer, at-least-one-transition) is enforced by `RngHandle.weightedPick` itself
(already built, W2) — 03 §11 calls this out explicitly ("`weightedPick` throws otherwise
... so this is a load-time rule, not a runtime crash"), so `settle` adds no extra guard.

### 6. Both content-controlled lookups are hardened against `Object.prototype` collisions (PR #44 review)

`visitedCounts[nodeId]` (`state.ts`'s `enter`) and `nodes[nodeId]` (`settle.ts`'s
`requireNode`) both read a plain-object bracket lookup keyed by content-authored ids —
`"toString"` or `"__proto__"` would otherwise resolve an inherited `Object.prototype`
value instead of `undefined`/a missing-node error, the same class of gap W9's
`requireDecl`/null-prototype `variables` guard against. `enter` now rebuilds
`visitedCounts` null-prototype (`Object.create(null)`) on every call — the same fix
W9 applies to `variables` — and `requireNode` gained the `Object.hasOwn` check
`requireDecl` already uses. `nodes` itself doesn't need to become null-prototype, since
nothing ever writes to it (content, read-only).

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/nodes.ts` **(new)** | `Choice`, `RandomTransition`, `ChoiceNode`/`RandomNode`/`AutoNode`/`EndingNode`, `Node`. Types only. |
| `kinds/story-graph/campaign.ts` **(new)** | `StoryGraphCampaign` (03 §1). |
| `kinds/story-graph/state.ts` **(new)** | `StoryGraphKindState` (03 §8.1); `enter`. |
| `kinds/story-graph/state.test.ts` **(new)** | `enter`'s visit-count and current-node behavior. |
| `kinds/story-graph/settle.ts` **(new)** | `SETTLE_STEPS`; `enterAndEmit`; `settle`; `initialState`. |
| `kinds/story-graph/settle.test.ts` **(new)** | Everything below, plus one `createEngine`/`createGame` integration test. |

`nodes.ts`/`campaign.ts` get no `.test.ts` sibling — pure type declarations, the same,
already-established exception the co-located-test rule has had since PR #17 (declined
again in PR #43 for `condition/types.ts`).

### Test Plan

Against TODO's W11 done-criteria directly:

- [ ] An auto→auto→choice chain and an auto→random→ending chain both settle correctly —
      the loop stops exactly at the choice/ending node.
- [ ] Every entry increments `visitedCounts`, proven for: the start node (via
      `initialState`, before any settle pass-through), a settle pass-through, and a
      node entered twice (a loop back to an earlier auto node).
- [ ] A 64-step non-terminating auto→auto→...→auto cycle throws, and the thrown call
      first emits `kind.story-graph.settle.guard_tripped` with `reason:
      "settle_guard_tripped"` and the tripping `nodeId`.
- [ ] `initialState` on a campaign whose start settles straight through to an
      `EndingNode` returns `status: "ended"` with `state.endingId` set — and does **not**
      report `active`.
- [ ] Two `initialState` calls against the same campaign, same seed (via `rngHandleFor`,
      independently constructed each time) but a `random` node in the settle chain,
      produce byte-identical resulting `state` — proving reproducibility from seed alone.
- [ ] `settle.step` fires once per loop iteration (including the first, for whatever node
      `initialState` already entered); `node.entered` carries the correct `nodeKind` and
      the just-incremented `visitCount`; `random.picked` carries the chosen transition's
      `goto`/`weight` and fires only for `random` nodes, never `auto`.
- [ ] An `auto`/`random` node's `effects` apply through W9's `applyConsequences` (clamp
      included) before `turn` advances — proven with a node whose effect pushes a
      variable past its declared bound.
- [ ] One integration test: a hand-built `Kind<StoryGraphKindState>` (other members
      stubbed, matching `kernel/engine.test.ts`'s `makeTestKind` pattern) whose
      `initialState` is this unit's real function and whose `eventNames` declares all
      four emitted names, run through the real `createEngine(...).createGame(...)` —
      proving the seam 04 §4 describes actually holds, not just this unit's own direct
      calls.

### Explicit Non-Goals

- No `showWhen`/`requirements` gating, `availableActions`, `scene`, or `StoryGraphView` —
  W12.
- No `submitChoice`/`advance` itself, and no decision about whether a mid-`advance`
  guard trip becomes an `AdvanceResult.error` — W12 (Decision 3).
- No achievement evaluation — W13; `StoryGraphCampaign.achievements` is a placeholder
  (Decision 4).
- No Tier 1/2 `validateCampaign` wiring — W14. This unit's node/goto/weight shapes are
  exactly what W14 will check; nothing here performs that check itself, matching W9/W10's
  relationship to it.
- No text interpolation (03 §3.1) — reads nothing about a node's `textKey` beyond
  treating it as an opaque `LocKey`; rendering is W12's `scene`.
