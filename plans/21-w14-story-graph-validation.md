# W14 — Story-Graph Validation

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W14

**Scope:** The kind's Tier 1 and Tier 2 checks via `validateCampaign` (03 §11).

**Depends on:** W5, W11 — both done, merged.

## What's Actually Left to Build

Everything W9–W13 built as "a standalone piece W14 will eventually wire in" is exactly
the wiring this unit does — `applyConsequences`'s type guards, `validateConditionFields`
(W10, already `ValidationError`-shaped and unused until now), the node graph (W11), and
`text.ts`'s interpolation regex all get reused here rather than re-derived. What's new is
the actual `validateCampaign` implementation, the graph-topology analysis Tier 2 needs,
and — discovered while building this — a real gap in `Kind.validateCampaign`'s own
signature.

## Decisions

### 1. `Kind.validateCampaign` needed a `strings` parameter it never had — extended, not worked around

Two of this unit's own Tier 1 done-criteria — "missing `LocKey`" and "non-visible
variable in text" — can only be checked against the registry's *string table*, because a
`LocKey` is only ever a *reference*; whether it resolves, and what a node's `textKey`
actually interpolates, both live in `strings`, not in `Campaign.content`. But
`Kind<KState>.validateCampaign(campaign: Campaign): ValidationResult` (`kernel/types.ts`,
W1) never received it — structurally, no kind could ever implement either check.

Extended to `validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>):
ValidationResult`. This is safe and low-blast-radius: `validation/tiered.ts`'s
`buildValidatedContentRegistry` is the **only** call site
(`grep -rn "\.validateCampaign(" src/engine/src` confirms it), and it already has
`BuiltCampaign.strings` on hand — the value existed one call frame away the whole time.
Every existing `Kind`-shaped test stub across the codebase (`engine.test.ts`,
`projection.test.ts`, `session/store.test.ts`, `validation/tiered.test.ts`, W11/W12/W13's
integration stubs) keeps compiling untouched — TypeScript allows an implementer to accept
*fewer* parameters than an interface declares, so every stub's zero-arg
`validateCampaign: () => ({ ok: true, ... })` still satisfies the widened signature.

### 2. Consequence type-checking is validation's own logic, not W9's throwing guards reused

W9's `checkSetValue`/`requireInt` (`variables.ts`, private) already encode "op suits
type, `set` value matches type/enum" — but they *throw*, and validation must *collect*
every error rather than fail on the first one (`buildContentRegistry`'s"if any Tier-1
error exists anywhere in the batch" framing, `validation/tiered.ts`). Reusing them via
try/catch-per-consequence would work but reads backwards — a defensive runtime guard
repurposed as a scanning tool. A small, separate, non-throwing check (same three-way
`bool`/`int`/`enum` switch, same conditions) lives in this unit instead. The duplication
is a handful of lines with fundamentally different control flow on each side (fail-fast
vs collect-all), not a shared abstraction fighting to get out.

"Every `set` value is in range" (03 §11) is **not** implemented as a range check — W9's
own `applyConsequences` never rejects an out-of-range `set`, it clamps after applying
(03 §5, Decision 2 of `plans/16-…`). Validation rejecting what runtime gracefully clamps
would break a legitimate, common authoring pattern ("`set money 999999`" relying on the
clamp to mean "max out"). Read as shorthand for "a valid enum member" (the very next
clause) rather than a literal numeric-range check for `int`.

### 3. Node/variable-name "duplicate" checks are vacuous by construction; choice-id and achievement-id checks are real

`content.nodes: Record<string, Node>` and `content.variables: VariableSchema` are both
`Record`s — a JS object cannot carry two entries under the same key, so "no node id / no
variable name is duplicated" already holds by the type system alone, by the time this
kind ever sees the content (post-`BuiltCampaign`, W4). Nothing to check; not implemented,
rather than adding a check that can never fire.

**Choice ids** and **achievement ids** are different — nothing stops two `Choice`s in the
*same* `ChoiceNode.choices` array sharing an id (`advance.ts`'s `.find(c => c.id ===
actionId)` would silently resolve to the first match, hiding the second), and nothing
stops two entries in `content.achievements` sharing an id (`unlockedAchievements` and the
`achieved.<id>` `StateChange` path are both keyed by it). Both are real, checked
per-scope: choice ids within each node independently, achievement ids across the whole
campaign.

### 4. Tier 2 reachability is one graph pass, not four separate traversals

"Unreachable nodes," "`no_reachable_choice`," and "no campaign has a reachable ending"
(03 §11) all fall out of one forward BFS from `startNodeId` over `goto` edges — the
`reachable` set. "Unreachable" nodes are the complement; the other two are one-line
existence checks over the same set (`some(id => nodes[id].kind === "choice"/"ending")`).
A dangling `goto` (already a Tier 1 error, Decision-independent) is skipped rather than
followed, so the traversal itself never throws on the content that's already flagged
elsewhere.

**"A cycle with no exit"** is a second pass over the same graph: backward reachability
from every `choice`/`ending` node (nodes that are trivially "escaped" by definition) —
any node in the forward-`reachable` set that cannot reach one of those is warned
individually, the same one-warning-per-node convention "unreachable nodes" already uses.
Precise cycle-grouping (naming which nodes form *one* cycle vs. several) isn't attempted
— the done-criterion only asks that such content warns, not that the warning explains
the cycle's shape.

### 5. Every check runs independently and collects; nothing short-circuits

Matching `validateCoreOwnedFields`'s existing style (`tiered.ts`), every Tier 1 check
runs regardless of whether an earlier one already failed, and Tier 2 checks run
regardless of Tier 1's outcome — `ValidationResult.warnings` stays informative even for
content that will never load, and a single bad campaign gets one full report instead of
one error per fix-and-rerun cycle.

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/validate.ts` **(new)** | `validateCampaign(campaign, strings): ValidationResult` and its internal checks. |
| `kinds/story-graph/validate.test.ts` **(new)** | Coverage below. |

### Changed files

| File | Change |
|---|---|
| `core/kernel/types.ts` | `Kind.validateCampaign` gains a `strings: ReadonlyMap<LocKey, string>` parameter (Decision 1). |
| `core/validation/tiered.ts` | Passes `strings` through at its one call site. |
| `kinds/story-graph/reasons.ts` | New Tier 1/2 codes (below). |
| `kinds/story-graph/text.ts` | Exports `placeholderNames` (not the raw regex — a fresh `RegExp` per call, so a stateful shared `g`-flag instance can't leak `lastIndex` between interleaved callers) — reused by validation so the interpolation pattern and the "only visible variables" check can never drift apart. |
| `docs/docs/engine/04-core.md` §3 | `Kind.validateCampaign`'s documented signature updated to match — a spec/code sync, not a gap (03 ↔ 04 drift is this project's most-tracked defect class, `CLAUDE.md`). |

### New reason codes

Tier 1: `dangling_reference`, `undeclared_variable`, `invalid_consequence_value`,
`duplicate_id`, `missing_label_key`, `non_visible_variable_in_text`,
`invalid_transition_weight`. Reused, not reinvented: `unknown_condition_field` (W10, for
`showWhen`/`requirements`/achievement `condition`s) and the base `missing_string_key`
(W5) for every `LocKey`-not-in-`strings` case — a kind-content `LocKey` failing to
resolve is the same failure the core's own `titleKey` check already names.

Tier 2: `unreachable_node`, `unreachable_cycle`, `no_reachable_choice`,
`no_reachable_ending`.

### Test Plan

Against TODO's W14 done-criteria directly, each with a path:

- [ ] Dangling `goto` (from a `Choice`, an `AutoNode`, and a `RandomTransition`) and a
      dangling `startNodeId` each fail Tier 1.
- [ ] An undeclared variable in a `Consequence` fails Tier 1 (`undeclared_variable`); the
      same in a `Condition` fails via `unknown_condition_field` (W10, reused).
- [ ] Two choices sharing an id within one node, and two achievements sharing an id
      campaign-wide, each fail Tier 1.
- [ ] A missing `LocKey` fails Tier 1 — tested for a node `textKey`, a choice `labelKey`,
      and an achievement `nameKey`, not just one position.
- [ ] A non-visible or undeclared variable referenced in interpolated text fails Tier 1;
      a visible one does not.
- [ ] A non-positive-integer `RandomTransition.weight`, and a `random` node with zero
      transitions, each fail Tier 1.
- [ ] `set`/`increment`/`decrement` type mismatches (wrong primitive type, non-`int` op
      target, invalid enum member) each fail Tier 1; an out-of-range but type-correct
      `set` value does **not** fail (Decision 2).
- [ ] An unreachable node, an exitless auto/random cycle, and `no_reachable_choice` each
      warn at Tier 2 without appearing in `errors` or blocking `ok`.
- [ ] A fully valid campaign (03 §12's worked Bureaucracy arc, hand-built as a fixture)
      passes with zero errors and zero warnings.
- [ ] One test through `buildValidatedContentRegistry` (`validation/tiered.ts`), proving
      a Tier 1 failure actually blocks registry construction end to end — not just that
      this unit's own function returns the right shape in isolation.

### Explicit Non-Goals

- No Tier 3 (03 §11: "simulation-time... a choice whose requirements no reachable state
  can satisfy") — a different validation *kind* entirely (04 §11's simulation harness),
  not named by this unit's done-criteria.
- No node-id/variable-name duplicate checks — Decision 3, vacuous by construction.
- No change to `applyConsequences`'s own runtime guards — this unit adds a parallel
  static check, not a replacement (Decision 2).
