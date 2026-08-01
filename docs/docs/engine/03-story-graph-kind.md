---
sidebar_label: Story-Graph Kind
---

# Story-Graph Kind — Content Model

**Document status:** Revision 1 — first build deliverable

**Kind:** `story-graph`

**Implementation language:** TypeScript (shared core with the simulation kind)

> **Scope of this document**
>
> The concrete content types for the flagship kind: the campaign, its typed variables,
> nodes, choices, requirements, consequences, endings, and achievements — plus the
> runtime state, how a turn resolves, and the projection. Ends with a worked example of
> the MVP's Bureaucracy arc.
>
> - The architecture this obeys: [`02-architecture.md`](02-architecture.md)
> - Reused verbatim from the core: the `Condition` tree, `LocKey` and `ReasonCode` are
>   **defined** in [`04-core.md`](04-core.md). `RngState` is the exception — 04 §8 states the
>   contract and deliberately does not restate the algorithm, which lives in
>   `src/engine/src/core/determinism/` ([Engine Package](/docs/guide/engine-package)) and
>   originated in `games/04-engine-specification.md` §3
> - The game this builds: `games/bulgaria-adventure.md`
> - What ships first: [`MVP.md`](MVP.md)

This kind reuses the core wherever it can. Types marked *(core)* are defined
in the engine specification and not re-derived here.

---

## 1. The Campaign

A story-graph campaign is **data** (§1 of the architecture). It declares everything the
engine needs to run it; the engine never recompiles to load one.

```typescript
interface StoryGraphCampaign {
  // The RUNTIME form: LocKeys only. Authors write `StoryGraphCampaignSource`, whose
  // player-facing fields are `AuthoredText`; a pure builder lifts the strings out and
  // produces this plus a string table (04 §10.1). §12 below is written in source form.
  //
  // This is the `content` inside the core's `Campaign` envelope (04 §10.1).
  // Envelope-owned identity — id, kindId, version, titleKey — lives on `Campaign`,
  // NOT here, so it cannot drift (the same rule as kindState, §8.1).
  descriptionKey: LocKey;

  variables: VariableSchema;    // §2 — every variable, typed, declared up front
  nodes: Record<string, Node>;  // §3 — keyed by node id
  startNodeId: string;

  achievements: AchievementDefinition[];   // §7
}
```

`id`, `version`, `kind`, and `titleKey` are **not** fields here — they belong to the
core `Campaign` envelope (04 §10.1), which wraps this content. Authors still write
strings inline in the authoring form; the build lifts them into the
registry's shared `strings` map (04 §10.1), so no per-campaign string table travels at
runtime.

Load-time validation (§11) checks that `startNodeId` exists, every `goto` resolves,
every variable referenced is declared, and every `LocKey` is present.

---

## 2. Variable Schema — Fully Typed (N6)

Every variable a campaign uses is declared here with a type and an initial value.
Reading or writing an undeclared variable is a **load-time error**. Writing a value of
the wrong type is a load-time error. This is the discipline decided in the
architecture's §3.2 — the loose bag is banned.

```typescript
type VarType = "bool" | "int" | "enum";

interface VariableDecl {
  type: VarType;
  initial: boolean | number | string;

  values?: string[];        // enum only — the allowed values
  min?: number;             // int only — clamp floor
  max?: number;             // int only — clamp ceiling

  visible?: boolean;        // surfaced to the player as a stat (§9)
  labelKey?: LocKey;        // required when visible
}

type VariableSchema = Record<string, VariableDecl>;

type VarValue = boolean | number | string;
```

> **⚑ Judgement call — no `string` free-type.** The architecture listed `string` as a
> variable type. Free strings are a determinism and validation hazard (unbounded, no
> load-time check on values) and no story-graph mechanic needs them — narrative text is
> `LocKey`s, not variables. `enum` covers "one of a fixed set." Dropped `string` for
> the MVP; add it back only if a campaign genuinely needs free text in state.

**Player statistics are not a separate system.** A variable marked `visible: true` is a
stat — it appears in the projection (§9) and the client's stats panel. That is the
whole of the "Player Stats" requirement.

**Relationships and money are ordinary variables.** A campaign that tracks the
landlord's opinion declares `int` `landlord_affinity`; one that tracks cash declares
`int` `money`. The story-graph kind imposes no relationship or currency model
(architecture §6.3).

---

## 3. Nodes — The Single Content Type (N7)

A node is a scene: display text, plus what happens after it. The "what happens" is a
discriminated union — the only content type in this kind.

```typescript
type Node = ChoiceNode | RandomNode | AutoNode | EndingNode;

interface NodeBase {
  id: string;
  textKey: LocKey;              // may interpolate visible variables — see §3.1
}

interface ChoiceNode extends NodeBase {
  kind: "choice";
  choices: Choice[];           // the player picks one
}

interface RandomNode extends NodeBase {
  kind: "random";              // engine picks, seeded — the only place RNG enters
  transitions: RandomTransition[];
}

interface AutoNode extends NodeBase {
  kind: "auto";                // no player input; one transition, taken immediately
  effects?: Consequence[];
  goto: string;
}

interface EndingNode extends NodeBase {
  kind: "ending";              // terminal — the game ends here
  endingId: string;
  outcome?: "win" | "loss" | "neutral";   // default "neutral"
}
```

Random and auto nodes are **pass-through**: the player never sits on one. After any
transition the engine *settles* — resolving auto/random nodes in turn — until it lands
on a choice or an ending (§8). So "a random event" is a `random` node the engine
resolves and moves past; "an event not reached by a choice" is an `auto`/choice node a
`goto` sends you to.

### 3.1 Text Interpolation

A node's `textKey` string may reference **visible** variables: `"Your bank account
contains {money}."` The engine substitutes the current value at render time from the
visible-variable set (§9). Referencing a non-visible or undeclared variable in text is
a load-time error — a hidden variable must not leak through prose.

---

## 4. Choices and Transitions

```typescript
interface Choice {
  id: string;
  labelKey: LocKey;

  showWhen?: Condition;        // omit the choice entirely if unmet (secret paths)
  requirements?: Condition;    // show but disable, with a reason, if unmet
  requirementFailKey?: LocKey;

  effects?: Consequence[];     // §5 — typed operations, applied on selection
  goto: string;                // target node id — required, validated
}

interface RandomTransition {
  weight: number;              // relative; positive integer — seeded weightedPick (04 §8)
  effects?: Consequence[];
  goto: string;
}
```

Two gates, deliberately distinct:

- **`showWhen`** decides whether the choice *appears at all*. Use it for secrets — an
  option that shouldn't exist until the player has the key. Default: always shown.
- **`requirements`** decides whether a *shown* choice is *selectable*. If unmet, the
  client renders it disabled with `requirementFailKey` as the reason — the Transparent
  Consequences principle. This is the common case.

A `goto` may target the choice's own node — that is how the Bureaucracy loop works
(§12). Cycles are legal here and are a Tier 2 warning, not an error (architecture §9).

---

## 5. Consequences — Typed Effects

A choice or transition mutates state only through typed operations on **declared**
variables. There is no arbitrary path write — the audit-record discipline from the
simulation kind's §10.4, carried over.

```typescript
type Consequence =
  | { op: "set"; var: string; value: VarValue }
  | { op: "increment"; var: string; by: number }   // int only
  | { op: "decrement"; var: string; by: number };   // int only
```

Validation checks: `var` is declared; the op suits its type (`increment`/`decrement`
require `int`; `set` value matches the declared type / enum values). `int` writes clamp
to the variable's `min`/`max` after applying. Clamping happens once, after all of a
transition's consequences apply — the same rule as the simulation kind's needs (§3.3
there), so a `+5` then `-5` nets to zero rather than clipping.

> **Turn advance is automatic, not a consequence.** The **kind** increments the built-in
> `turn` by 1 on every transition, including settle pass-throughs (§8.2). It cannot be
> the core's job: `turn` lives inside `kindState`, which the core treats as opaque
> (`unknown`, [`04-core.md`](04-core.md) §2). A campaign wanting a time *skip* declares
> its own `int` and advances it — the built-in `turn` stays a faithful transition count.

> **Achievements have no `unlock` consequence.** They are conditions (§7), evaluated
> after every turn. To fire one at a narrative moment, set a variable there and let the
> achievement's condition read it. One mechanism, uniform with the simulation kind.
> *(⚑ If authors find this verbose, a direct `unlock` op can be added later — noted,
> not built.)*

---

## 6. Requirements and Conditions

Requirements reuse the core's **`Condition` tree verbatim** — `all` / `any` /
`not` / comparisons / `exists` / `count`
(`games/04-engine-specification.md` §13.1). That
operator set is **frozen** ([`04-core.md`](04-core.md) §18) — this kind adds no
operators, only a field namespace. A condition's `field` resolves against this kind's
state:

```text
var.<name>            a declared variable's current value
turn                  the built-in transition counter
visited.<nodeId>      how many times a node has become current — counts every entry,
                      including the start node and settle pass-throughs (0 if never; §8.2)
achieved.<id>         whether an achievement is unlocked (bool)
ending                the endingId once ended (else absent)
```

Every `field` is checked at load time against the schema and node set (§11). This is
the *only* stringly-typed surface left in the kind, so it is the one that gets rigorous
path validation — exactly as the simulation kind found (§4.3 there).

Example — the "certificate expired again" gate:

```yaml
requirements:
  all:
    - { field: var.documents_collected, operator: equals, value: true }
    - { field: var.certificate_fresh,   operator: equals, value: true }
```

---

## 7. Achievements

Ported from the simulation kind, scoped to conditions over this kind's state.

```typescript
interface AchievementDefinition {
  id: string;
  nameKey: LocKey;             // "It Builds Character", not "First Ending"
  descriptionKey: LocKey;
  condition: Condition;        // over var.* / achieved.* / ending
  hidden: boolean;             // if true, not listed until unlocked
}
```

Evaluated after every turn (§8). Each fires **exactly once**, and the unlock lands in
**two places with different jobs**:

- **In-game, authoritative:** `StoryGraphKindState.unlockedAchievements` (§8.1). This is
  deterministic state — it must be, because `achieved.<id>` is a readable condition field
  (§6), so an unlock can gate a later choice. It replays from seed + action log like
  everything else in `kindState`.
- **Cross-session, non-authoritative:** a durable `PlayerProfile` mirror in the core's
  `ProfileStore` ([`04-core.md`](04-core.md) §7.1), upserted by the session store *after*
  a successful action — never by `advance`, which is pure and does no I/O. Nothing in
  resolution ever reads it, so it cannot perturb determinism. A missing or corrupt profile
  degrades to "no achievements," never a broken game; a failed write is a warning that
  does not roll back the game action.

The kind's part of the bargain is small: unlock into `kindState` and emit an
`achievement_unlocked` `StateChange` (04 §12). The store does the rest. Records are keyed
`campaignId + achievementId`, because an achievement id is only unique within its campaign
(04 §17).

---

## 8. Runtime State and the Turn

### 8.1 State

The story-graph kind's state is the **kind-specific subset only** — it is the
`kindState` inside the core's `GameState` envelope
([`04-core.md`](04-core.md) §2). Everything kind-agnostic — `gameId`, `seed`,
`campaignId`, `campaignVersion`, `status`, and the action log — lives on the
envelope, not here. Duplicating them (as an earlier draft of this section did) would put
the same field in two places and drift.

```typescript
interface StoryGraphKindState {
  currentNodeId: string;
  variables: Record<string, VarValue>;
  turn: number;                            // kind-maintained; settle advances it (§8.2)
  visitedCounts: Record<string, number>;   // nodeId → times entered (every entry; §8.2)
  unlockedAchievements: string[];
  endingId?: string;                        // set when an EndingNode is reached
}
```

- **`status`** (`active` / `ended`) is the envelope's, reported by `advance`'s
  `AdvanceResult.status` (04 §3). The kind sets `endingId` here; the core flips
  status to `ended`.
- **The choice log** is the envelope's generic `actionLog` (04 §2): each `LoggedAction`
  carries the `choiceId` as its `actionId`. There is no separate `LoggedChoice`.
- **`turn`** stays here because a "turn" is kind-specific — a node transition in this
  kind, a week in the simulation kind.

`variables` and `visitedCounts` are subject to the core's sorted-iteration rule
([`04-core.md`](04-core.md) §8 / games/04 §2.2) — a `Record` iterated in a
state-affecting way is sorted first, or a save/load round trip can diverge.

### 8.2 The Turn: `submitChoice` → Settle

The story-graph kind has exactly **one player action** — submit a choice — with no plan
and no multi-action week (the model that led the simulation kind to drop `executeAction`,
05 §6).

Throughout, **enter(nodeId)** sets `currentNodeId = nodeId` **and** does
`visitedCounts[nodeId] += 1` — so *every* entry counts, including settle pass-throughs
and the initial start node (§8.1).

```text
submitChoice(state, choiceId, params):
  0. reject if params is non-empty → unexpected_params (this kind takes none, 04 §3)
  1. resolve the current node (must be a ChoiceNode) and the named choice
  2. reject if the choice is unavailable: showWhen false, or requirements unmet
     → return ValidationError with the reason (§8.3), no state change
  3. apply the choice's effects (typed consequences, §5), then clamp
  4. the core appends `{ actionId: choiceId }` to the envelope's actionLog
  5. transition: turn += 1, enter(choice.goto)
  6. SETTLE (below)
  7. evaluate achievements; append any newly-satisfied to unlockedAchievements
     and emit a StateChange for each (durable profile writes happen outside
     `advance`, which is pure — §7)
  8. return the new scene (§9), or the ending if status === "ended"
```

**Settle** — the pass-through resolution of non-choice nodes:

```text
settle(state):
  loop (guard: max SETTLE_STEPS, default 64):
    node = current node
    if node.kind == "choice"  → stop; the player acts next
    if node.kind == "ending"  → status = "ended", endingId = node.endingId; stop
    if node.kind == "auto"     → apply effects, clamp; turn += 1; enter(node.goto)
    if node.kind == "random"   → weightedPick a transition from the current RNG handle
                                 (the triggering action's stream, or system:"start" at
                                 createGame — 04 §4/§8);
                                 apply its effects, clamp; turn += 1; enter(its goto)
  if the guard trips → engine error (a content cycle of auto/random nodes with no exit;
     Tier 2 validation warns on such cycles, the guard is the runtime backstop)
```

`createGame` **enters** `startNodeId` (so `visitedCounts[startNodeId]` becomes 1) and
runs `settle` once — drawing any start random transitions from the `system:"start"` RNG
stream (04 §4, §8) — so the first scene the player sees is already a choice or an ending.
`initialState` reports which: it returns an `InitialStateResult` (04 §3) whose `status` is
`"ended"` when the start settled onto an `EndingNode`. That is a **valid** campaign — a
vignette or a test fixture — and validation flags it `no_reachable_choice` at Tier 2 (§11),
not as an error.

### 8.3 Reason Codes

The codes this kind adds to the base set (`Kind.reasonCodes`, 04 §3, §12). Each needs a
localized message or registry validation fails (04 §12):

| Code | When |
|---|---|
| `not_a_choice_node` | an action arrived while the current node is not a `ChoiceNode` — should be unreachable after settle |
| `unexpected_params` | a non-empty `params` object; this kind declares none |
| `settle_guard_tripped` | `SETTLE_STEPS` exceeded — an auto/random cycle with no exit (§8.2) |

Reused from the base set: `unknown_action` (no such choice id on the current node),
`requirement_unmet` (shown but gated — carries `requirementFailKey` as its message),
`session_ended` (an action against an ended game).

> **A hidden choice is `unknown_action`, not `action_not_available`.** Submitting a choice
> whose `showWhen` fails returns exactly what a nonexistent choice id returns. The two
> cases are deliberately indistinguishable: a distinct code would let a client probe ids
> and confirm that a secret path exists, which is the one thing `showWhen` is for (§4, §9).

**Determinism.** Every random transition draws from the seeded RNG (core §3).
Given the same seed and the same action log, `settle` makes the same picks — so the
whole game replays byte-for-byte (§10). This is the concrete meaning of "deterministic"
for this kind.

### 8.4 Events

The operational events this kind emits, declared as `Kind.eventNames`
([`04-core.md`](04-core.md) §3) and namespaced `kind.story-graph.*`
([`05-observability.md`](05-observability.md) §9). They are emitted through `ctx.emit`
(04 §3.1), never returned, and never localized — a `StateChange` (§5) is what the *player*
is owed, and these are what a developer or a content author needs instead.

| Name (after `kind.story-graph.`) | Severity | Emitted at | `data` |
|---|---|---|---|
| `choice.submitted` | `debug` | §8.2 step 1, after the choice resolves | `nodeId`, `choiceId` |
| `choice.rejected` | `info` | §8.2 step 2 | `choiceId`; `reason` set (§8.3) |
| `requirement.evaluated` | `trace` | §8.2 step 2, once per requirement | `choiceId`, `satisfied` |
| `consequence.applied` | `debug` | §8.2 steps 3 and 5, per typed effect | `variable`, `op`, `clamped` |
| `node.entered` | `debug` | every `enter(nodeId)` — §8.2 | `nodeId`, `nodeKind`, `visitCount` |
| `settle.step` | `trace` | each iteration of the settle loop | `step`, `nodeId`, `nodeKind` |
| `random.picked` | `debug` | a `random` node chose a transition | `nodeId`, `goto`, `weight` |
| `settle.guard_tripped` | `error` | `SETTLE_STEPS` exceeded | `nodeId`; `reason` set |
| `achievement.unlocked` | `info` | §8.2 step 7 | `achievementId` |
| `ending.reached` | `info` | settle landed on an `EndingNode` | `endingId` |

Two of these carry most of the value, for the two audiences the events exist to serve:

- **`requirement.evaluated`** is the author's answer to *why was my choice greyed out*.
  It fires per requirement rather than per choice, so a compound condition (§6) reports
  which clause failed — something the single `requirement_unmet` reason code (§8.3)
  deliberately cannot say, because the player is not owed the campaign's internals.
- **`random.picked`** is the developer's answer to *why did this replay diverge*. Paired
  with `node.entered` and `visitCount`, a stream diff localizes a determinism failure to
  one transition, instead of to a `serialize()` byte offset.

> **`visitCount` on `node.entered`, and why it is worth logging.** Every entry counts,
> including settle pass-throughs and the initial start node (§8.2) — a rule that is easy to
> state and easy to get subtly wrong, since the Bureaucracy loop's `office_visits ≥ 3` gate
> (§12) depends on it. Emitting the count at each entry makes an off-by-one visible at the
> step that caused it rather than several turns later, when a gate fails to open.

### 8.5 Terminal Identity

`Kind.outcome` ([`04-core.md`](04-core.md) §3) returns this kind's terminal identity for the
replay oracle ([`07-replay.md`](07-replay.md) §3.3):

```typescript
outcome(state: StoryGraphKindState): { endingId: string | null }
```

`endingId` when the game has settled onto an `EndingNode` (§8.2), `null` while it is still
active. Nothing else — not `turn`, not variable values, not `visitedCounts`.

> **Why so little.** The oracle compares games across engine versions, and anything that a
> content rebalance may legitimately change would report as a regression. An ending id is a
> published id, stable by the same rule that governs every other id (04 §17), so it survives
> a rebalance and a serialization change alike. `turn` and variables do not, which is why
> they are excluded here even though they are more informative in a debugger.

---

## 9. Projection — What a Client Sees

Clients receive a projection, never raw state (architecture §7). For the story-graph
kind:

`StoryGraphView` is the `kindView` inside the core's `PlayerView`
([`04-core.md`](04-core.md) §9), and it carries **only what the generic surface does not**.
The scene text is `Scene.body`, the choice list is `Scene.actions`, and `gameId`/`status`
are on `Scene` / `PlayerView` already (04 §6, §9) — repeating any of them here would put
one value in two places, the drift this kind has already been bitten by twice
(§8.1, §1).

```typescript
interface StoryGraphView {
  turn: number;
  stats: VisibleStat[];            // visible: true variables, with their labels
  unlockedAchievements: string[];  // unlocked — including hidden ones, from the moment they unlock (§7)
  ending?: { endingId: string; outcome: "win" | "loss" | "neutral" };
}

interface VisibleStat {
  var: string;                    // the declared variable name
  labelKey: LocKey;               // required by §2 when visible
  value: VarValue;
}
```

The choices a player may pick are the core's `AvailableAction[]` (04 §6), produced by
this kind's `availableActions`: `showWhen`-failing choices are **omitted entirely**, and
a shown-but-ungated choice carries `available: false` with `reasonKey` =
`requirementFailKey` (§4). There is no separate story-graph choice type.

**Excluded from the projection:** non-visible variables, `visitedCounts`, the action log,
achievement conditions, and any hidden achievement not yet unlocked. A `showWhen`-hidden
choice is omitted entirely — the client cannot know a secret path exists. This is what
stops a client (or an AI agent over MCP) from seeing state the player shouldn't.

---

## 10. Determinism, Save, Versioning

All three are core mechanisms; the story-graph kind only supplies its state shape.

- **Save** = the serialized core `GameState` envelope (which carries
  `campaignVersion`, `seed`, `actionLog`, and this kind's `kindState`), in a
  `SaveEnvelope` ([`04-core.md`](04-core.md) §10.2).
- **Determinism harness** — a `{ config, actionLog }` fixture
  ([`04-core.md`](04-core.md) §14) replays to a
  byte-identical `serialize()`, via the golden-file + property tests of §18.4 there.
- **Versioning / migration** — a save records the `campaignVersion` it was made under.
  Loading against a *different* published version runs migration, which must map old
  node ids forward or fail loudly rather than strand the player on a node that no longer
  exists (architecture §8). A migrated save is marked not-replay-compatible.

---

## 11. Validation, Story-Graph-Specific

Tiered as in the architecture §9.

**Tier 1 — load-time, hard fail:**

- `startNodeId` exists; every `goto` and every random `transition.goto` resolves to a
  real node.
- Every variable in a consequence, condition, or text interpolation is declared.
- Every consequence op suits its variable's type; every `set` value is in range / a
  valid enum member.
- Every `LocKey` is present in `strings`.
- No node id, choice id, achievement id, or variable name is duplicated.
- A `visible: true` variable has a `labelKey`; text interpolates only visible variables.
- Every `RandomTransition.weight` is a **positive integer**, and every `random` node has
  at least one transition — `weightedPick` throws otherwise (04 §8), so this is a
  load-time rule, not a runtime crash.

**Tier 2 — load-time, warning:**

- Unreachable nodes — no path from `startNodeId` reaches them (the source's "detect dead
  branches").
- A `choice`/`auto`/`random` cycle with no exit to a choice or ending (would trip the
  settle guard at runtime).
- A campaign with no reachable ending.
- `no_reachable_choice` — no `ChoiceNode` is reachable from `startNodeId`, so the campaign
  settles straight to an ending and the player never acts (§8.2). Valid but
  non-interactive (04 §11).

**Tier 3 — simulation-time (§18.5 there):** a choice whose `requirements` no reachable
state can satisfy; an ending no path reaches.

---

## 12. Worked Example — The MVP Bureaucracy Arc

This is the concrete MVP content ([`MVP.md`](MVP.md)): ~6 nodes, typed variables, a
requirement-gated retry, a loop with visit counts, a seeded random node, and the
"It Builds Character" achievement. Authoring form (the build step derives the string
table — [`04-core.md`](04-core.md) §10.1).

```yaml
id: bulgaria-bureaucracy
version: "0.1.0"
kind: story-graph
title: "Bulgaria — The Bureaucracy Arc"
startNodeId: municipality

variables:
  documents_collected: { type: bool, initial: false }
  certificate_fresh:   { type: bool, initial: true }
  patience:            { type: int,  initial: 10, min: 0, max: 10, visible: true, labelKey: stat.patience }
  office_visits:       { type: int,  initial: 0,  min: 0 }
  builds_character:    { type: bool, initial: false }

achievements:
  - id: it_builds_character
    nameKey: ach.builds_character.name        # "It Builds Character"
    descriptionKey: ach.builds_character.desc
    condition: { field: var.builds_character, operator: equals, value: true }
    hidden: true

nodes:
  municipality:
    kind: choice
    textKey: node.municipality.text            # arrive 08:03; "Closed until 11:30"
    choices:
      - id: wait
        labelKey: choice.wait
        effects: [ { op: decrement, var: patience, by: 2 } ]
        goto: clerk_review
      - id: coffee
        labelKey: choice.coffee                # meet the mayor's cousin
        effects: [ { op: set, var: documents_collected, value: true } ]
        goto: clerk_review

  clerk_review:
    kind: random                               # she smiles... or she doesn't
    textKey: node.clerk_review.text
    transitions:
      - weight: 3
        effects: [ { op: set, var: certificate_fresh, value: false } ]
        goto: expired                          # a certificate is now over three months old
      - weight: 1
        goto: room_14                          # you are sent onward

  expired:
    kind: choice
    textKey: node.expired.text
    choices:
      - id: begin_again
        labelKey: choice.begin_again
        effects: [ { op: decrement, var: patience, by: 3 } ]
        goto: municipality                     # the loop
      - id: question_reality
        labelKey: choice.question_reality
        requirements: { field: var.patience, operator: less_or_equal, value: 3 }
        requirementFailKey: req.too_much_patience
        goto: reward                           # only the truly worn-down may pass

  room_14:
    kind: auto
    textKey: node.room_14.text                 # Room 14 sends you to Room 6
    effects: [ { op: increment, var: office_visits, by: 1 } ]
    goto: room_6

  room_6:
    kind: choice
    textKey: node.room_6.text                  # everything happens in Room 14
    choices:
      - id: continue_cycle
        labelKey: choice.continue_cycle
        effects: [ { op: increment, var: office_visits, by: 1 } ]
        goto: room_14                          # the other loop
      - id: go_home
        labelKey: choice.go_home
        requirements: { field: var.office_visits, operator: greater_or_equal, value: 3 }
        requirementFailKey: req.not_yet_broken
        goto: reward

  reward:
    kind: auto
    textKey: node.reward.text                  # €300 and 28 years of legal responsibility
    effects: [ { op: set, var: builds_character, value: true } ]
    goto: ending_character

  ending_character:
    kind: ending
    textKey: node.ending.text
    endingId: it_builds_character
    outcome: neutral
```

What this exercises, one-to-one against the MVP Definition of Done:

- **Typed variables** (bool/int), visible stat (`patience`), clamping (`min`/`max`).
- **Requirement-gated choices** with reasons (`question_reality`, `go_home`).
- **A loop** via self-referential `goto` and **visit counts** (`office_visits >= 3`).
- **A seeded random node** (`clerk_review`) — reproducible from the seed.
- **An achievement** firing once from a variable set at the reward.
- **Two clients** run this identically; **projection** hides `certificate_fresh`,
  `office_visits`, `builds_character`, the visit counts, and the seed.

---

## 13. Judgement Calls

| § | Call | Revisit when |
|---|---|---|
| §2 | Dropped `string` variable type; `enum` covers fixed sets | A campaign needs free text in state |
| §5 | No `unlock` consequence; achievements are conditions over a set variable | Authoring proves it verbose |
| §5 | Built-in `turn` is a pure transition count; time skips are author variables | A kind-level clock is wanted |
| §8.2 | `SETTLE_STEPS` guard default 64 | Profiling or a legitimately deep auto-chain |
| §3 | Four node kinds (choice/random/auto/ending); `auto` is arguably a one-transition `random` | Simplification pass finds `auto` redundant |
| §6/§8.2 | `visited` counts *every* entry (settle pass-throughs + start node), so it works on auto/random nodes | Authors want "times rested here" only |
