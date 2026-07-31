# W10 — Conditions and Requirements

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W10

**Scope:** The frozen `Condition` evaluator plus the story-graph kind's field namespace
(`var.*`, `turn`, `visited.*`, `achieved.*`, `ending`) (03 §6; 04 §18).

**Depends on:** W9 — done, merged (`plans/16-w9-variables-and-consequences.md`).

## What's Actually Left to Build

`04-core.md` §18 declares the `Condition` operator set frozen and shared with the
simulation kind, but — unlike every other type this project has ported from spec to
code — **it never restates the actual `Condition` TypeScript shape**. It cites
`games/04-engine-specification.md` §13.1 for the full surface and stops there. That file
lives in the companion repo ([SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife),
available locally at `../SubZeroDev.GameOfLife/docs/docs/games/04-engine-specification.md`)
— its §13.1 is the actual source this unit ports from:

```typescript
type Condition =
  | ComparisonCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | ExistsCondition
  | CountCondition;

interface ComparisonCondition {
  field: string;
  operator: ComparisonOperator;
  value: unknown;
}

type ComparisonOperator =
  | "equals" | "not_equals"
  | "less_than" | "less_or_equal" | "greater_than" | "greater_or_equal"
  | "in" | "not_in"
  | "contains" | "has_tag" | "has_flag";

interface ExistsCondition {
  exists: { collection: CollectionSelector; where: Condition };
}
interface CountCondition {
  count: { collection: CollectionSelector; where: Condition };
  operator: ComparisonOperator;
  value: number;
}
```

The ancestor's `CollectionSelector` is a closed string-literal union of **simulation-kind**
paths (`player.inventory`, `world.npcs`, `state.goals`, ...) — none of which exist in this
kind. Decision 1 below is about what changes, and what doesn't, when this ports to a
kind-agnostic core type plus a story-graph-specific field namespace.

Nothing here exists in `src/engine/src` yet — no `Condition` type, no evaluator, no
field-path validator. This unit builds all three:

1. **Core-owned, kind-agnostic:** `Condition`, `ComparisonOperator`, and a generic
   `evaluateCondition` that resolves fields and collections through a caller-supplied
   resolver — it knows nothing about `var.*` or story nodes.
2. **Story-graph-owned:** the field namespace (03 §6) — resolving `var.<name>`, `turn`,
   `visited.<nodeId>`, `achieved.<id>`, `ending` against runtime state, and the load-time
   field-path validator the done-criterion asks for.

## Decisions

### 1. `Condition`'s tree/operator shape is core; `CollectionSelector` is not — it doesn't port at all

04 §18 frames the *operator set* — the eleven comparisons, `all`/`any`/`not`,
`exists`/`count` — as the frozen, shared-with-simulation surface, and that's what the
dependency-arrow rule (04 §1.1: "a core module never imports a kind") actually requires
living in `core/`: the tree shape and evaluation *mechanism*, not any kind's field
vocabulary. The ancestor's `CollectionSelector` is exactly a field vocabulary —
`player.inventory`, `world.npcs`, `state.goals` are simulation-kind paths with no meaning
here — so it is simulation-kind's concern if and when that kind is ever built (not a
`TODO.md` unit yet), not the core's.

`core/condition/types.ts` therefore types `collection: string` generically (no
`CollectionSelector` import, because there is nothing kind-agnostic to import), and
`evaluateCondition` takes a `ConditionResolver` the caller supplies:

```typescript
interface ConditionResolver {
  field(path: string): unknown;
  collection(name: string): readonly ConditionResolver[];
}
```

`collection()` returns one resolver *per item*, each capable of resolving `where`'s
fields relative to that item — so `exists`/`count` recurse through `evaluateCondition`
without the evaluator ever needing kind-specific knowledge of what an "item" is.

**Consequence for this kind:** 03 §6's field namespace (§8.1) is entirely scalar — `var.*`,
`turn`, `visited.*`, `achieved.*`, `ending` — story-graph declares **no collections at
all**. `exists`/`count` are therefore structurally supported (the frozen operator set
"only... evaluates" holds, per the done-criterion) but never legally usable in this
kind's content: story-graph's own field-path validator (Decision 3) rejects every
`collection` reference outright, because there is no valid one to reference. This isn't a
gap — the ancestor doc itself frames `exists`/`count` as existing for tag/inventory-style
content ("owns any item tagged `formal_clothing`") that only the simulation kind has.

### 2. Comparison semantics for the six operators the worked example never exercises

03 §12's Bureaucracy arc uses exactly three operators — `equals`, `less_or_equal`,
`greater_or_equal` — all against scalar `number`/`boolean` fields. The other eight
(`not_equals`, `less_than`, `greater_than`, `in`, `not_in`, `contains`, `has_tag`,
`has_flag`) have no worked example and no further specification beyond their names in
04 §18's list, so `evaluateCondition` fixes one reasonable semantics for each and this
unit tests it directly rather than through story-graph content that doesn't exist:

- `equals`/`not_equals`: `===`/`!==`.
- `less_than`/`less_or_equal`/`greater_than`/`greater_or_equal`: both the resolved field
  value and `value` must be `number`; anything else throws (03 §11's Tier 1 list checks
  that a condition's *variable* is declared, not that an operator suits the variable's
  *type* — that gap is this evaluator's own runtime guard, the same class of backstop
  W9's Decision 1 uses).
- `in`/`not_in`: `value` must be an array; membership-tests the field value against it.
- `contains`: the field value must be a `string` or array; substring/membership test
  against `value`.
- `has_tag`/`has_flag`: no ancestor text distinguishes these from `contains` beyond
  naming (tags vs. flags is a simulation-kind vocabulary distinction, not an operator
  semantics one) — implemented identically to `contains`'s array-membership case. Since
  no story-graph field is ever array-valued (`VarValue = boolean | number | string`),
  these two operators are, like `exists`/`count`, structurally complete but practically
  unreachable from this kind's own content — tested directly against the generic
  evaluator with a synthetic array field, not through story-graph.

### 3. Story-graph's field-path validator returns `ValidationError[]`, not a thrown guard

Unlike W9's undeclared-variable guard (which throws, because Tier 1 validation was
explicitly *not* this unit's job), W10's own done-criterion says the opposite outright:
"every `field` path is checked at load against the schema and node set; an unknown path
is a Tier 1 error." This *is* Tier 1 territory — 03 §11 lists "every variable in a
condition... is declared" as a Tier 1 check — so `validateConditionFields` returns
`ValidationError[]` (`validation/types.ts`, unchanged shape), for `Kind.validateCampaign`
(W14) to fold in once it exists. W10 ships it standalone and tested directly, the same
relationship W9's `applyConsequences` has to W14 — a building block a later unit wires in,
not something that waits for that unit to exist first.

Field-shape rules, walking every comparison leaf in the tree (including inside
`exists`/`count`'s `where` — though see below):

| Pattern | Valid when |
|---|---|
| `var.<name>` | `<name>` is a key in the supplied `VariableSchema` |
| `turn` | always (exact match) |
| `visited.<nodeId>` | `<nodeId>` is in the supplied node-id set |
| `achieved.<id>` | always, structurally (`<id>` non-empty) — no declared-achievement set exists yet to check against; achievements aren't authored content until W13, and the done-criterion's own wording ("against the schema and node set") names only those two, not an achievement list |
| `ending` | always (exact match) |
| anything else | **Tier 1 error** — `unknown_condition_field`, `path` set to the field string |

`exists`/`count` are rejected outright (Decision 1) — their `collection` reference is
already unknown-by-construction for this kind, so the validator reports that and does
**not** additionally walk into `where`: a field name meaningful only relative to a
collection item (`"tags"`, say) would spuriously fail the state-level check otherwise,
and the whole node is already invalid on the `collection` alone.

`unknown_condition_field` is a kind-local reason code, not yet in `BASE_REASON_CODES` or
registered as a message — the same status 03 §8.3's three story-graph codes have until
W12 wires `Kind.reasonCodes` (`kernel/reasons.ts`'s `ReasonCode` is a bare `string`, so
nothing stops using it ahead of registration; W5's `validateCampaign` plumbing that would
reject an unmessaged code is Tier 1 infrastructure this standalone function doesn't run
through).

Its `messageKey` needs a namespace, and no document states one for kind-owned reason-code
messages — `04-core.md` §12 only fixes `core.reason.*` for the **base** set, explicitly
reserved (campaigns are rejected for writing into it), so reusing it here would be wrong
twice over. `kind.<kindId>.*` (05 §9) is event-name namespacing, a different vocabulary.
Used `story-graph.reason.unknown_condition_field` — kind id, no `kind.` wrapper — as the
minimal-invention parallel to `core.reason.<code>`. Not registered anywhere yet (no unit
before W12 wires real messages), so this is provisional; added to Known Open Items.

### 4. The runtime resolver context is narrower than `StoryGraphKindState` — deliberately

`StoryGraphKindState` (03 §8.1: `currentNodeId`, `variables`, `turn`, `visitedCounts`,
`unlockedAchievements`, `endingId`) isn't formally typed anywhere yet — that's W11's
`initialState`/settle-loop unit, not this one. Evaluating a condition never needs
`currentNodeId` (nothing in 03 §6's field namespace reads it), so
`kinds/story-graph/conditions.ts` defines its own minimal
`ConditionContext { variables, turn, visitedCounts, unlockedAchievements, endingId }` —
the subset it actually resolves against. W11 folding this into the full kind state is a
structural superset, not a rename, so nothing here should need to change shape later.

## Design

### New files

| File | Contents |
|---|---|
| `core/condition/types.ts` **(new)** | `Condition`, `ComparisonOperator`, `ComparisonCondition`, `AllCondition`/`AnyCondition`/`NotCondition`, `ExistsCondition`/`CountCondition`, `ConditionResolver`. |
| `core/condition/evaluate.ts` **(new)** | `evaluateCondition(condition, resolver): boolean`; the eleven-operator `compare` helper. |
| `core/condition/evaluate.test.ts` **(new)** | Direct operator coverage, including the six the story-graph worked example never uses, and a synthetic-collection `exists`/`count` test. |
| `kinds/story-graph/conditions.ts` **(new)** | `ConditionContext`; `resolveField(context, path): unknown`; `evaluateStoryGraphCondition(condition, context): boolean` (wires `evaluateCondition` with a resolver whose `collection()` always reports unknown); `validateConditionFields(condition, schema, nodeIds): ValidationError[]`. |
| `kinds/story-graph/conditions.test.ts` **(new)** | Field resolution for all five namespace members (including `visited.<nodeId>` defaulting to 0, `ending` absent while active); the Bureaucracy arc's three real conditions evaluated end-to-end; every field-path validation rule, positive and negative; `exists`/`count` rejected by the validator. |

No existing file changes — same as W9, this ships as a self-contained, tested building
block with no wiring into `kernel/engine.ts` or `Kind.advance` yet (W11/W12/W14 do that).

### Test Plan

Against TODO's W10 done-criteria directly:

- [ ] Every one of the eleven `ComparisonOperator`s evaluates correctly against direct
      `evaluateCondition` calls (Decision 2's fixed semantics), including the six the
      worked example doesn't exercise.
- [ ] `all`/`any`/`not` compose correctly, including empty `all`/`any` (vacuous
      true/false) and nesting three levels deep.
- [ ] A synthetic `ConditionResolver` with a fake `collection()` proves `exists`/`count`
      recurse `where` per item and `count` compares the match total correctly.
- [ ] 03 §12's three real conditions (`var.patience <= 3`, `var.office_visits >= 3`,
      `var.builds_character == true`) evaluate correctly through
      `evaluateStoryGraphCondition` against a hand-built `ConditionContext`.
- [ ] `visited.<nodeId>` resolves to `0` for a node never entered, and to the stored count
      otherwise; `achieved.<id>` resolves `false`/`true`; `ending` resolves `undefined`
      while active and the id once ended; `turn` resolves the counter directly.
- [ ] `validateConditionFields`: `var.<declared>` passes, `var.<undeclared>` fails with
      `unknown_condition_field` and the field as `path`; `visited.<real-node-id>` passes,
      `visited.<fake-id>` fails; `turn`/`ending` always pass; `achieved.<anything>`
      passes (Decision 3's scoped judgment call); a garbage field (`foo.bar`) fails; the
      check recurses through `all`/`any`/`not`; any `exists`/`count` fails on its
      `collection` regardless of contents.
- [ ] Only the frozen eleven-operator/six-shape set type-checks as a `Condition` at all —
      proven by the type system (no runtime test needed beyond what's above), so no
      unlisted operator can even be constructed.

### Explicit Non-Goals

- No wiring into `Choice.requirements`/`showWhen` gating, `submitChoice`, or
  `availableActions` — that's W11 (settle/turn) and W12 (scene/actions). This unit
  produces the evaluator and validator those call.
- No `Kind.validateCampaign`/Tier 1-2 framework wiring — W14, same relationship as W9's
  `applyConsequences` has to it.
- No achievement-id validation against a declared achievement list (Decision 3) — no
  achievement content type exists until W13.
- No simulation-kind `CollectionSelector` or any real `exists`/`count` consumer — not a
  `TODO.md` unit; the core evaluator supports the shape, nothing here needs it to be used.
