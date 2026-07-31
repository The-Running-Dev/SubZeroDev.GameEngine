# W12 — Scene, Actions, Projection, Reason Codes

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W12

**Scope:** `availableActions` (omit on `showWhen`, disable with a reason on
`requirements`), `scene`, the slim `StoryGraphView`, and the kind's reason codes
(03 §4, §8.3, §8.4, §9; 04 §6).

**Depends on:** W6, W11 — both done, merged.

## What's Actually Left to Build

Nothing here exists yet. The scope line names four things, but the done-criteria force a
fifth: "a `showWhen`-hidden choice ... returns `unknown_action` **when submitted**" can
only be tested by actually submitting — i.e. by `Kind.advance` (03 §8.2's
`submitChoice`). No `TODO.md` unit ever names `submitChoice`/`advance` as its own scope
line (confirmed by grep), so it has always been implicit assembly across W9
(consequences), W10 (conditions), W11 (settle/turn) and this unit (gating, reason codes).
This unit is where that assembly actually has to happen, because it's the first one whose
own done-criteria requires it.

After this unit, every `Kind<StoryGraphKindState>` method exists except `outcome` (trivial,
03 §8.5, not asked for by any unit's done-criteria — skipped, see Non-Goals) and
`validateCampaign` (W14, genuinely substantial).

## Decisions

### 1. `advance` (`submitChoice`) is built here, not deferred again

03 §8.2's full pseudocode (steps 0–8) needed a home. Steps 3/5/6 (apply effects, transition,
settle) already exist (W9/W11); this unit adds steps 0–2 (params/gating) and wires them
together. `not_a_choice_node`/`unexpected_params` are returned as graceful
`ValidationError`s (`state` unchanged, nothing has mutated yet when either check runs) —
unlike W11's `settle_guard_tripped`, which throws because state has *already* changed by
the time it can trip (plan 18, Decision 3). `not_a_choice_node` is framed as "should be
unreachable after settle" (03 §8.3) precisely because `kernel/engine.ts`'s `submitAction`
already rejects with `session_ended` before ever calling `kind.advance` on a non-`"active"`
state (built in W3) — the check here is the same defensive backstop, at no extra cost.

A hidden (`showWhen`-failing) choice and a genuinely unknown choice id both return
`unknown_action` — 03 §8.3's own callout: "the two cases are deliberately
indistinguishable... the one thing `showWhen` is for."

### 2. `settle`'s result gains `changes` — a real gap W11 didn't need to close

`AdvanceResult.changes` must carry every `StateChange` from the whole resolution, not just
the choice's own effects — an `auto`/`random` pass-through's effects are typed
consequences too, and the "Transparent Consequences" principle this spec keeps invoking
doesn't stop at the first transition. W11's `settle` already calls `applyConsequences` for
every pass-through but discarded the resulting `StateChange[]`, because nothing before this
unit ever needed them. `SettleResult` gains a `changes: StateChange[]` field, accumulated
across the whole loop; `advance` concatenates the choice's own effects' changes with
settle's. This is a genuine, minimal extension of W11's return shape, not a redesign —
`state`/`status` are unchanged, and existing W11 tests (which only assert those two) still
pass unmodified.

**Explicitly not fixed here:** the `kind.story-graph.consequence.applied` *event* (03
§8.4) — distinct from the `StateChange` audit trail above; no unit's done-criteria has ever
asked for it (W11's own list names only `settle.step`/`node.entered`/`random.picked`), and
building it needs a "was this clamped" signal `applyConsequences` doesn't currently expose.
Left for whichever unit actually needs it.

### 3. Reason-code messages get a real home — `kinds/story-graph/reasons.ts`

03 §8.3 names three kind-added codes (`not_a_choice_node`, `unexpected_params`,
`settle_guard_tripped`); W10 already had to invent a provisional messageKey namespace
(`story-graph.reason.<code>`) for `unknown_condition_field`, recorded as a `TODO.md` Known
Open Item pending "a real caller." This unit *is* that caller — `reasons.ts` mirrors
`kernel/reasons.ts`'s own pattern exactly (`STORY_GRAPH_REASON_CODES` as a const array,
a `Record<Code,string>` message table the compiler forces complete, a
`ReadonlyMap<LocKey,string>` built from both) so the two don't drift. `unknown_condition_field`
joins the same array — W10's provisional convention is now load-bearing, not speculative.
`unknown_action`/`requirement_unmet` are **not** here — 03 §8.3 says they're "reused from
the base set," so `advance` references `core.reason.*` for those two directly.

`requirement_unmet`'s `messageKey` is `choice.requirementFailKey` when authored — 03 §8.3:
"carries `requirementFailKey` as its message" — falling back to
`core.reason.requirement_unmet` when a campaign omits it (optional per 03 §4). Same fallback
in `availableActions`' `reasonKey`, so the gated-choice message and the rejection message
never disagree.

### 4. `scene`'s text interpolation is a new, small module — `kinds/story-graph/text.ts`

03 §3.1 describes `{money}`-style substitution against **visible** variables only,
resolved from `ctx.registry.strings` (the real string table `Kind.scene` receives through
`KindContext`). `interpolateText` takes an already-resolved template and a pre-filtered
visible-variables map — filtering happens once, in a new `visibleVariables(schema,
variables)` export on `variables.ts` (additive; W9's existing exports are untouched),
reused by both `scene` (interpolation) and `project` (`VisibleStat[]`) so "only visible
variables ever reach a client" is enforced in exactly one place. Referencing a
non-visible/undeclared name throws (`Object.hasOwn`-guarded, the same backstop class as
every other content-controlled lookup in this kind) — Tier 1 (W14) is what's supposed to
make this unreachable in valid content; 03 §11 lists it explicitly.

### 5. `project`'s `ending.outcome` reads the ending node directly — no new state field needed

`StoryGraphView.ending?.outcome` needs the `EndingNode.outcome` a plain `state.endingId`
string can't carry — but `state.currentNodeId` is already exactly that ending node's own
`id` when `status === "ended"` (settle's `enterAndEmit` sets `currentNodeId` on the way in;
the `"ending"` branch never re-enters, it only stamps `endingId`), confirmed against W11's
own `settle.ts`. `project` looks up `content.nodes[state.currentNodeId]` rather than adding
an `outcome` field to `StoryGraphKindState` that would just duplicate content already
reachable through the id already on hand.

`unlockedAchievements` is passed through as-is, unfiltered — 03 §9's field comment says
"non-hidden, unlocked," but `AchievementDefinition.hidden` (03 §7) doesn't exist until W13,
and `state.unlockedAchievements` is always `[]` until then regardless (nothing populates
it). Filtering against a type that doesn't exist yet isn't buildable; W13 revisits this
field when it adds the first thing that can ever be in the array.

`ProjectionAudience` (`"player" | "ai"`) is accepted (the `Kind.project` signature requires
it) but not branched on — nothing in 03 §9 describes an `ai`-specific narrowing for this
kind, unlike the "rival/AI view" framing 04 §9 gives the concept generally. Story-graph is
single-player; there's no rival to widen a view for.

### 6. `requireNode` moves from `settle.ts` to `nodes.ts`

`scene`, `advance`, and `project` all need the same `Object.hasOwn`-guarded node lookup
`settle.ts` already built (plan 18, PR #44's hardening fix). Duplicating it three more
times would be the third or fourth copy of the same guard; moved to `nodes.ts` (the module
that owns `Node`) as a shared export, `settle.ts` imports it from there instead of defining
it locally. `enterAndEmit` is exported from `settle.ts` too, for `advance`'s own
choice-transition step (03 §8.2 step 5 is the exact same "enter, count, emit" primitive
settle's pass-throughs already use).

### 7. PR #47 review: `text.ts`/`nodes.ts` needed real tests; two missing defensive guards; `buildContentRegistry` couldn't reach kind messages at all

Two co-located-test findings were **not** instances of the declined types-only precedent
(PR #17, #43, #44) — `text.ts` (`interpolateText`) and `nodes.ts` (`requireNode`, added by
this PR) are genuine logic, not type declarations, so both got `.test.ts` files.

`visibleVariables` read `variables[name]` without checking the key exists — deserialize
validates `kindState`'s *presence* only, not its declared shape (04 §2 treats it as
`unknown`), so corrupted/foreign state could silently surface `undefined` as a stat value
or an interpolated `"undefined"`. `project`'s stat-building similarly assumed
`VariableDecl.labelKey` (optional in the type) is always present for a visible variable —
true only once Tier 1 (W14) enforces 03 §2's "a `visible: true` variable has a `labelKey`"
rule, which doesn't exist yet. Both now throw — the same runtime-backstop class as every
other content-controlled lookup in this kind.

`buildContentRegistry` (`core/registry/build.ts`, W4) only ever merged `CORE_REASON_MESSAGES`
plus campaign strings — `STORY_GRAPH_REASON_MESSAGES` had no path into a real registry at
all. The core can't import a kind directly (dependency-arrow rule), so the fix is an
optional `kindMessages` parameter a composition root would supply — defaults to `[]`,
so every existing caller (including `validation/tiered.ts`) is unaffected. No composition
root exists yet to actually pass story-graph's messages through it; that wiring, and
whether kind namespaces need `PROTECTED_PREFIX`-style protection from campaign overwrite
(today they'd surface as an ordinary `string_conflict`, not a named
`protected_string_key`), is left open rather than force-fit into this PR.

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/text.ts` **(new)** | `interpolateText(template, visibleVariables)`. |
| `kinds/story-graph/reasons.ts` **(new)** | `STORY_GRAPH_REASON_CODES`, `STORY_GRAPH_REASON_MESSAGES`. |
| `kinds/story-graph/reasons.test.ts` **(new)** | Every code has a message; the map is keyed `story-graph.reason.<code>`. |
| `kinds/story-graph/scene.ts` **(new)** | `availableActions`, `scene` — the real `Kind` methods. |
| `kinds/story-graph/scene.test.ts` **(new)** | Coverage below. |
| `kinds/story-graph/view.ts` **(new)** | `StoryGraphView`, `VisibleStat`, `project`. |
| `kinds/story-graph/view.test.ts` **(new)** | Coverage below. |
| `kinds/story-graph/advance.ts` **(new)** | `advance` — `submitChoice → settle`. |
| `kinds/story-graph/advance.test.ts` **(new)** | Coverage below, plus one `createEngine`/`submitAction` integration test. |

### Changed files

| File | Change |
|---|---|
| `kinds/story-graph/variables.ts` | Add `visibleVariables(schema, variables)`. Additive. |
| `kinds/story-graph/nodes.ts` | Add `requireNode` (moved from `settle.ts`). |
| `kinds/story-graph/settle.ts` | Import `requireNode` from `nodes.ts` instead of defining it; export `enterAndEmit`; `SettleResult` gains `changes: StateChange[]`. |
| `kinds/story-graph/conditions.ts` | Add `toConditionContext(state): ConditionContext` — the `StoryGraphKindState → ConditionContext` adapter `advance`/`scene`'s gating both need. |
| `docs/docs/engine/TODO.md` | Update the W9 and W10 Known Open Items — both said "once a real caller attaches/emits one"; this unit is that caller. Formal codification in `04-core.md` §12 itself is still a follow-up, not done here. |

### Test Plan

Against TODO's W12 done-criteria directly:

- [ ] A `showWhen`-hidden choice is absent from `availableActions`' output.
- [ ] Submitting that same hidden choice's id returns `unknown_action` — identical to
      submitting a genuinely nonexistent id (same code, same message key).
- [ ] A shown-but-gated choice appears with `available: false` and `reasonKey` equal to
      its `requirementFailKey`; submitting it returns `requirement_unmet` with the same
      `requirementFailKey` as the message.
- [ ] A gated choice with no `requirementFailKey` authored falls back to
      `core.reason.requirement_unmet` in both `availableActions` and the rejection.
- [ ] `scene` interpolates a visible variable into rendered text; referencing a
      non-visible or undeclared name throws.
- [ ] `project` excludes non-visible variables and `visitedCounts`; `stats` matches
      exactly the declared `visible: true` variables with their `labelKey`s and current
      values; `ending` is absent while active and `{endingId, outcome}` once ended,
      `outcome` defaulting to `"neutral"` when the node omits it.
- [ ] `StoryGraphView` carries no field the generic `Scene`/`PlayerView` already does
      (structural check against the type, not a runtime assertion).
- [ ] A successful `advance` returns `changes` covering *both* the choice's own effects
      and any settle pass-through's effects, in that order.
- [ ] `unexpected_params` and `not_a_choice_node` each reject with `state` unchanged.
- [ ] One integration test: extends W11's `createEngine`/`createGame` stub `Kind` with
      this unit's real `availableActions`/`scene`/`advance`/`project`, submits a choice
      through `engine.submitAction`, and checks the resulting `Scene`/`PlayerView`.

### Explicit Non-Goals

- No `outcome`/`validateCampaign` — trivial and substantial respectively, neither named by
  any unit's done-criteria; left alone rather than built speculatively.
- No achievement evaluation (03 §8.2 step 7) — W13; `advance` skips straight from settle
  to returning, same as `initialState` already does.
- No `kind.story-graph.consequence.applied` event — Decision 2's explicit deferral.
- No Tier 1/2 validation wiring — W14, same relationship every prior unit has to it.
- No formal `04-core.md` §12 codification of the `StateChange`/messageKey conventions this
  unit finally exercises — Decision 3's note; a documentation follow-up, not blocking.
