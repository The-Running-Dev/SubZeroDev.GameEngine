# W9 — Variables and Consequences

**Status:** Draft — implementing immediately after this document (user directive: "get
the next milestone, create branch, work, create PR, watch comments").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W9

**Scope:** `VariableSchema`, typed `set` / `increment` / `decrement`, clamp-after-all-
effects, sorted iteration of state-affecting records (03 §2, §5, §8.1).

**Depends on:** W1 — done, merged (`f7d8f59`).

## What's Actually Left to Build

This is the first unit under "The Story-Graph Kind" — nothing kind-specific exists yet.
`grep`ing `src/engine/src` for `VariableSchema`/`Consequence`/`VarValue` returns nothing;
W1 scaffolded only the core's kind-agnostic types. `src/engine/eslint.config.js` already
anticipates a `src/kinds/` tree (its dependency-arrow rule bans `**/kinds/*` imports from
`src/core/**`), so that's the directory this unit opens: `src/engine/src/kinds/story-graph/`.

Everything here is new:

1. The typed vocabulary from 03 §2 (`VarType`, `VariableDecl`, `VariableSchema`,
   `VarValue`) and §5 (`Consequence`).
2. `buildInitialVariables(schema)` — turns a schema's declared `initial` values into the
   runtime `variables: Record<string, VarValue>` that seeds `StoryGraphKindState` (§8.1),
   built later in W11's `initialState`.
3. `applyConsequences(schema, variables, consequences)` — the one place a story-graph
   game is allowed to mutate a variable. Runs a batch of typed effects (a choice's,
   auto-node's, or random-transition's `effects` array) against declared variables,
   clamping `int`s once at the end, and returns both the new `variables` and an audit
   trail of `StateChange`s for the caller to attach to `AdvanceResult.changes` (W11).

## Decisions

### 1. Undeclared/mistyped writes throw — they don't produce a `ValidationError`

03 §5's "validation checks" (var declared; op suits type; `set` value matches type/enum)
read, at first glance, like something that should return the engine's existing
`ValidationError`/`ReasonCode` vocabulary (`kernel/reasons.ts`), the way a rejected choice
does (03 §8.2 step 2).

They're not the same kind of rejection, and 03 §11 confirms it: "every variable in a
consequence... is declared" and "every consequence op suits its variable's type" are
listed as **Tier 1, load-time** checks (W14's `validateCampaign`, which depends on W5 and
W11 — not W9). In a campaign that has passed Tier 1, this function's guard is
structurally unreachable; it exists as the runtime backstop for a bug (bad content that
slipped past validation, or a caller misusing the typed API), not a gameplay outcome a
well-formed campaign can trigger. 03 §11 sets exactly this precedent already:
`weightedPick` "throws... so this is a load-time rule, not a runtime crash" for the same
reason (an all-zero-weight `random` node is a Tier 1 error; the runtime function still
guards it defensively). `applyConsequences` follows the same pattern — `throw new
Error("story-graph variables: ...")`, matching the plain-`Error`, module-prefixed style
already used for this class of guard (`persistence/canonical.ts`, `determinism/pcg32.ts`,
`session/store.ts`).

Reserving `ValidationError`/`ReasonCode` for rejections a *validated* campaign can still
produce during play (`unknown_action`, `requirement_unmet`, and 03 §8.3's kind-specific
three, all added in W11/W12) keeps that vocabulary meaning "the player did something the
content legitimately disallows," not "the content is broken."

This is exactly why W9's done-criterion ("undeclared and mistyped writes are rejected")
is tested directly against this module in isolation — W14 doesn't exist yet, has no
dependency on W9, and checks the whole node graph statically rather than by exercising
this function.

### 2. Clamp once, after the whole batch — raw accumulation in between

"`+5` then `-5` on a clamped int nets to zero rather than clipping" only holds if the
value is *not* clamped between the two ops. Worked example: `money: int, min: 0, max: 3`,
current value `2`, effects `[increment by 5, decrement by 5]`.

- **Wrong (clamp-per-op):** `2 + 5 = 7 → clamp → 3`; `3 - 5 = -2 → clamp → 0`. Net: `2 → 0`
  — a `+5/-5` pair that should cancel instead *loses* 2, purely from where the ceiling sat.
- **Right (clamp-once):** raw accumulation `2 + 5 = 7`; `7 - 5 = 2`; clamp the final `2`
  once → `2` (no clamping needed). Net: unchanged, as `+5/-5` should be.

So `applyConsequences` accumulates a raw (unclamped) running value per touched variable
across the whole input array — `set` replaces the running value outright,
`increment`/`decrement` add/subtract from it — and clamps exactly once per variable,
after every consequence in the call has been folded in. Clamping only ever applies to
`int` (03 §5); `bool`/`enum` writes pass through unclamped (there is nothing to clamp).

### 3. `StateChange`s are coalesced per variable, not emitted per consequence

A `StateChange` is 04 §12's audit record of what actually landed in state, not a log of
operations attempted (`kernel/reasons.ts`'s header: "emitted by a typed reducer — never
the mutation mechanism"). Emitting one raw `StateChange` per input `Consequence` would
mean showing the unclamped intermediate from Decision 2's `+5` step even though it never
actually took effect — misleading, and it duplicates what
`kind.story-graph.consequence.applied` (03 §8.4, a separate operational event, out of
scope here — that's W11/W12's `ctx.emit` wiring) already exists to log per-op.

Instead, `applyConsequences` returns exactly one `StateChange` per variable **touched by
at least one consequence in the batch**, carrying the final (post-clamp) value and the
value the variable held before the batch started:

```typescript
{ path: `var.${name}`, op: "set", value: <final>, previous: <before>, reason: "consequence_applied", visible: <decl.visible ?? false> }
```

- `path: var.<name>` reuses 03 §6's condition-field namespace verbatim — the same string
  a `Condition` would read back, rather than inventing a second name for the same thing.
- `op: "set"` regardless of which ops ran — the record describes the net landing value,
  not the arithmetic that produced it (03 §5's "no arbitrary path write" framing is about
  the write being typed and audited, not about preserving op history here).
- `reason: "consequence_applied"` follows the literal-string convention W8 established
  for `achievement_unlocked` (`plans/15-w8-profile-store.md` Decision 1) — a stable,
  descriptive reason a session store or client can match on, not a `BASE_REASON_CODES`
  entry (it isn't kind-agnostic, and it isn't a rejection).
- `visible` mirrors the variable's own `visible` declaration — an audit record for a
  hidden variable must stay hidden, same as the variable itself never leaking into
  projection or text interpolation (03 §3.1, §9).

A variable whose net change is zero (this unit's own `+5`/`-5` example) still emits a
`StateChange` — it was touched, even though `previous === value`. Whether a zero-delta
change is worth suppressing is a projection/UX concern for later units, not this one.

### 4. Sorted iteration, applied at the two points this unit actually has a `Record` to iterate

The kind's Record fields are "subject to the core's sorted-iteration rule... a `Record`
iterated in a state-affecting way is sorted first, or a save/load round trip can
diverge" (03 §8.1, citing the core). `persistence/canonical.ts` already sorts object keys
on every `serialize()`, so a save/load round trip through the engine's own persistence
is covered regardless of insertion order. What canonical serialization does *not* cover
is any code in this unit that walks a `Record`'s keys directly and lets that order affect
its own output — insertion order is language-guaranteed for string keys, but two
call sites building structurally-equal `variables` objects in different key orders should
still be indistinguishable to anything downstream that isn't `canonicalStringify`.

Two places this unit touches a `Record` in a state-affecting way, both made to iterate
`Object.keys(...).sort()` rather than declaration/insertion order:

- `buildInitialVariables(schema)` — builds `variables` by walking the schema's keys
  sorted, not in authoring order.
- `applyConsequences`'s returned `changes` — coalesced per Decision 3 from a `Map` keyed
  by variable name, emitted sorted by name rather than by first-touch order in the input
  `consequences` array.

`consequences` itself is a plain array (a transition's effects, authored in the order
they should apply — Decision 2 depends on that order) — sorting does not apply there;
only `Record` iteration is in scope for this rule.

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/variables.ts` **(new)** | `VarType`, `VariableDecl`, `VariableSchema`, `VarValue`, `Consequence`; `buildInitialVariables`; `applyConsequences`. |
| `kinds/story-graph/variables.test.ts` **(new)** | Coverage below. |

No existing file changes — this unit adds a self-contained module with no wiring into
`kernel/engine.ts` yet (that's W11/W12, once `Kind.advance` for `story-graph` exists to
call it).

### Signatures

```typescript
export type VarType = "bool" | "int" | "enum";
export type VarValue = boolean | number | string;

export interface VariableDecl {
  type: VarType;
  initial: VarValue;
  values?: string[];   // enum only
  min?: number;         // int only
  max?: number;         // int only
  visible?: boolean;
  labelKey?: LocKey;
}

export type VariableSchema = Record<string, VariableDecl>;

export type Consequence =
  | { op: "set"; var: string; value: VarValue }
  | { op: "increment"; var: string; by: number }
  | { op: "decrement"; var: string; by: number };

export function buildInitialVariables(schema: VariableSchema): Record<string, VarValue>;

export function applyConsequences(
  schema: VariableSchema,
  variables: Readonly<Record<string, VarValue>>,
  consequences: readonly Consequence[],
): { variables: Record<string, VarValue>; changes: StateChange[] };
```

`applyConsequences` never mutates its `variables` input — returns a new object (matching
the codebase's existing pure-reducer style, e.g. `AdvanceResult.state`).

### Guard conditions (throw, per Decision 1)

Checked per consequence, in input order, before any accumulation:

- `schema[c.var]` missing → undeclared variable.
- `op` is `increment`/`decrement` but `decl.type !== "int"` → op/type mismatch.
- `op` is `set` and:
  - `decl.type === "bool"` but `typeof value !== "boolean"`,
  - `decl.type === "int"` but `typeof value !== "number"` or `!Number.isInteger(value)`,
  - `decl.type === "enum"` but `typeof value !== "string"` or `!decl.values?.includes(value)`
    → mistyped/invalid write.

### Test Plan

Against TODO's W9 done-criteria directly:

- [ ] Writing to a variable name absent from the schema throws, for `set`, `increment`,
      and `decrement`.
- [ ] `set` with a value of the wrong JS type for the declared `VarType` throws (bool
      given a number, int given a string, enum given a non-member string, int given a
      non-integer number).
- [ ] `increment`/`decrement` against a `bool` or `enum` variable throws.
- [ ] `[increment by 5, decrement by 5]` on an `int` with `min: 0, max: 3` starting at `2`
      nets to `2` (unchanged) — proving clamp-once, not clamp-per-op (Decision 2's worked
      example, asserted directly).
- [ ] A single `increment` past `max` (or `decrement` past `min`) clamps to the bound.
- [ ] `buildInitialVariables` reproduces every schema's declared `initial` value, and
      produces key-identical (via `canonicalStringify`) output regardless of the order
      keys appear in the source `VariableSchema` object literal — the sorted-iteration
      claim, tested by constructing two schemas with the same entries in different
      declaration order.
- [ ] `applyConsequences`'s `changes` are sorted by variable name regardless of the input
      `consequences` array's touch order (multiple variables, deliberately out-of-order
      effects).
- [ ] A touched variable's `StateChange` carries the correct `previous`/final `value`,
      `path: var.<name>`, and `visible` mirroring the declaration — including a `visible:
      false` (or omitted) variable producing `visible: false`.
- [ ] `applyConsequences` does not mutate its `variables` input (reference/identity check
      plus a value check after the call).

### Explicit Non-Goals

- No `Condition` evaluator or requirement/gating logic — that's W10.
- No node graph, `enter`, settle loop, or `turn` counter — that's W11. This unit has no
  concept of a "transition" beyond "one array of consequences passed in one call."
- No wiring into `Kind.advance`, `kernel/engine.ts`, or `ctx.emit` — nothing calls this
  module yet; W11/W12 do.
- No achievements (W13) or Tier 1/2 `validateCampaign` (W14) — Decision 1 explains why
  this unit's guard is deliberately not that check.
- No text interpolation (03 §3.1) — reads `visible` off a `VariableDecl` but does not
  touch node text.
