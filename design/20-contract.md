# Contract

> Canonical agent-kit contract for SubZeroDev.GameEngine. The marked blocks below are the single
> source for the generated core and kind-contract pages under `docs/docs/engine/`.

## Types

The game-agnostic public types and seam are owned by [Core Specification](#core-specification).
Kind-owned types are owned by the Story-Graph, Simulation, and World-Graph blocks.

## Persisted schemas

Owned by Core Specification and the persistence sections of each kind contract.

## Public signatures

Owned by Core Specification. Kind implementations cross the core only through the `Kind` seam;
kind-internal signatures remain in their respective blocks.

## Error semantics

Core reason codes and validation errors are owned by Core Specification. Each kind adds only its
registered reason-code vocabulary.

## Invariants

Statements that must hold at all times, each written so it could become an assertion. This
section states the **cross-cutting** set — the invariants no kind block owns, which Core
Specification's prose settles but no numbered list has carried. Section-scoped sets stay where
they are and are not restated here: the profile mechanism's is Core Specification §7.1,
*Invariants* (P1–P8); session lifecycle's is §7.4 (L1–L3, D1–D3, B1–B3, A1–A2). Kind-specific
turn and state invariants are owned by each kind block.

**Read the enforcement clause.** An invariant marked *enforced by code*, *by the type*, or *by
the guard* holds by construction and may be trusted without checking. One marked *by
instruction* is a rule with no gate — it holds only while every author remembers it, and C6
below is the one this repository has already watched fail five times.

**Determinism.** Maintained by the core kernel, the eslint determinism guard, and the harness
(Core Specification §14). C5 is the extensibility rule (06 §2) stated as an assertion.

- **C1.** A `{ config, actionLog }` fixture replayed twice produces byte-identical `serialize()`
  output. *Enforced by code — §14's golden files and property tests.*
- **C2.** No resolution path calls `Math.random`, `Date.now`, or a non-bit-stable `Math.*`.
  *Enforced by the guard in `src/engine/eslint.config.js`
  ([Engine Package](/docs/guide/engine-package)), which fails the `engine` job rather than a
  review.*
- **C3.** `{ seed, actionLog }` is the complete replay input. No generator state is persisted;
  every stream is a pure function of `(seed, streamId)` (§8). *Enforced by the type — `GameState`
  declares no RNG field, and adding one is a contract amendment.*
- **C4.** Removing every event changes nothing: a fixture replayed with `nullEmitter` and with
  `createRecordingEmitter()` yields byte-identical `serialize()` output, an identical
  `AdvanceResult`, and an identical action log. *Enforced by code — §14's sink-independence
  check — and by `emit` returning `void`, which leaves a kind nothing to branch on.*
- **C5.** A host-supplied port cannot change `serialize()` output. *Enforced by the harness —
  each port replays a fixture under its random default and under a controlled implementation
  (06 §6, step 6).*

**Envelope ownership.** Maintained by Core Specification §2. C6 is the highest-risk statement in
this section, because it is the only one here with no gate behind it.

- **C6.** Every field a game has regardless of kind — `formatVersion`, `gameId`, `kindId`,
  `campaignId`, `campaignVersion`, `seed`, `status`, `actionLog` — lives on `GameState` and is
  duplicated by no `kindState`, no `Campaign`, no registry entry, and no kind's view type.
  *Enforced by instruction only. No check exists; `CLAUDE.md`'s ledger records five instances of
  this being violated, three in state and content and two on the view side.*
- **C7.** No core module imports a kind. `kindState` is `unknown`, never a union of kind states,
  and a kind casts its own payload guarded by `kindId`. *Enforced by the type and by module
  structure.*
- **C8.** No wall-clock value reaches `GameState`. Timestamps live on the session-store record
  (§7), outside replayable state. *Enforced by the guard's `Date.now` ban together with the
  envelope's declared fields.*

**Projection.** Maintained by the kernel, in one place, so that a kind neither implements nor can
defeat it (§9.1).

- **C9.** Mutating anything reachable from an `Engine.view` or `Scene.view` result, to any depth,
  leaves `GameState`, every later projection, `serialize()` output, and the action log unchanged.
  *Enforced by code — a structural clone at the kernel boundary.*
- **C10.** Two projections of one state are equal and are never the same object. A client may not
  use a view as a cache key or compare views by reference. *Enforced by construction, as the
  consequence of C9; a caller relying on identity is relying on something never promised.*
- **C11.** No value a kind marks hidden appears in any projection. *Owner: each kind's projection
  section. Enforced by code per kind, not centrally — the core cannot inspect an opaque
  `kindState` to check it.*

**Migration.** Maintained by Core Specification §10.2.

- **C12.** A save records the `campaignVersion` it was made under, and loading it against a
  different version either migrates or fails with `save_requires_migration`. It never strands a
  save silently. *Enforced by code — `resolveSaveEnvelope`.*
- **C13.** A migration may re-address published ids and drop or default what no longer resolves,
  and may never invent play. *Enforced by instruction for the second clause; the first is
  constrained by Tier 1, which rejects a migration naming an id domain outside the engine-owned
  reference-site table.*
- **C14.** A migrated save is marked not-replay-compatible. *Enforced by code.*

**Validation.** Maintained by Core Specification §11, tier by tier.

- **C15.** Tier 1 fails the load; Tier 2 loads and flags; Tier 3 never runs at load time at all.
  *Enforced by the type — `errors` and `warnings` are separate fields, and Tier 3 is an
  out-of-band author-facing check with no load-time entry point.*
- **C16.** No Tier 2 warning changes `GameState`, `AdvanceResult`, or whether a submission
  succeeded. *Enforced by code — the same guarantee §7.1's P4 states for the profile store,
  generalised.*

**Identifiers.** Maintained by Core Specification §17 and the two id ports (06 §5.1, §5.7).

- **C17.** Every published id is ASCII `[a-z0-9_-]` in the shape §17's table fixes for its
  category, and is unique within its scope. *Enforced by code — Tier 1 checks both the character
  set and uniqueness.*
- **C18.** An id is stable once published; a rename is a migration, never an edit. *Enforced by
  instruction, with C12 as the backstop that makes a violation loud rather than silent.*
- **C19.** `gameId` and `seed` are opaque to the core: never parsed, compared, ordered, or
  derived from. *Enforced by instruction — `IdSource` returns `string`, and nothing stops a
  reader; the reason it holds is that no core path has cause to look inside one.*
- **C20.** A session id and a save id never enter `GameState`. They key host records and are
  never replay inputs. *Enforced by the type — neither is a declared envelope field, which is
  why `RecordIdSource` is a second port rather than a widening of `IdSource`.*

## Unresolved

Signatures this contract deliberately does not state, because the design does not determine them
and inventing one would be worse than naming the gap. Each shrinks only by being resolved; an
entry removed here never returns.

- **Cumulative weeks played across every game under one profile.** The simulation kind's §2.2
  describes a `"profile"`-scoped event chain as advancing on this, and the persisted shape it
  now has records `furthestStep` only. The aggregate has no formulation that is simultaneously
  idempotent (which `Kind.profileData.fold` requires, §3), bounded (which §7.1's size limit
  requires), and correct under two live sessions sharing one `profileId` (which §7's own
  `profileId` lock domain exists because hosts do): a sum fails the first, per-game keying fails
  the second, and a settle-on-game-change counter fails the third. Resolving it needs a design
  decision about which of the three to give up, and that decision is `/design`'s, not this
  document's. Tracked in [`90-decisions.md`](90-decisions.md)'s open register.

<!-- human-doc:start path="engine/04-core.md" -->
---
sidebar_label: Core Specification
---

# Core Specification

**Document status:** Revision 1 — the platform core, as types

**Reading order:** logically the core *underlies* the kinds; the filename is `04` only to
avoid renumbering. Read after [`02-architecture.md`](02-architecture.md), before or
alongside [`03-story-graph-kind.md`](03-story-graph-kind.md) — which is the order the
sidebar presents, stated in `docs/sidebar.ts` rather than taken from the filename prefix.

> **Scope of this document**
>
> The game-agnostic core, defined as types: the `GameState` envelope, the **Kind
> interface** (the seam every kind implements), the platform engine API, the session
> store, generic scenes/actions, projection, the content registry, tiered validation,
> reason codes, randomness, serialization/save/migration, the determinism harness, and
> the MCP tool schemas.
>
> `02-architecture` made the decisions; this turns each into a type. Named ≠ defined ≠
> buildable — that lesson, from `games/`, applied
> to the platform.

**Reused, not re-derived.** The seeded RNG (`RngState`, PCG32, `deriveStream`) and
canonical serialization are already built and verified in `src/engine/src/core/`
([Engine Package](/docs/guide/engine-package)), and were
first specified in `games/04-engine-specification.md` §3, §2.1. This document references
them and does not restate the algorithms.

> **What `games/04-engine-specification.md` is, and is not.** It is a 104 KB engine
> specification in the companion game project,
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) — the
> document **this one was derived from**. It is cited throughout these specs, and every such
> citation is **provenance, not authority**.
>
> For anything the core owns — the engine API, randomness, save and serialization, testing,
> package layout, conditions, projections — **this document supersedes it.** Where the two
> disagree, this one is correct, and the older text should be read as the draft that led
> here rather than as a second opinion.
>
> **It is no longer authoritative for anything.** It was, for one thing: the **`simulation`
> kind's own** content and resolution model (its §5, §7–§10, §12, §14), held upstream until a
> contract existed in *this* repository against the Kind seam (§3). That contract exists —
> [`10-simulation-kind.md`](10-simulation-kind.md), whole as of its Revision 2, expressed
> against §3 the way [`03-story-graph-kind.md`](03-story-graph-kind.md) is, with every type
> `SimulationKindState` names and every resolution mechanic that dispatches on them specified
> here. Its §15 records what was ported and what each pass found.
>
> What remains upstream is *provisional balance*, not contract: drift rates, scenario
> economics, `demandBand` thresholds, and the housing-quality formula, indexed in
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2 as needing a balancing pass. Numbers, not shape
> — and a number this repository has not yet chosen is not a rule living somewhere else.

---

## 1. The Two Layers of "Engine"

Two things get called "the engine." They are different, and the split is load-bearing.

- **The pure engine** — a set of pure functions. `f(state, action) → new state`. No
  I/O, no session, no clock. Testable, replayable, deterministic. This is what the Kind
  interface and the reducers live in.
- **The session store** — a thin stateful layer *above* the pure engine that holds
  serialized state blobs by id, so a client can `resume` (architecture §2). It does I/O;
  it holds no game logic.

The platform API (§7) is the session store's surface. Clients talk to it; it calls the
pure engine.

### 1.1 Internal Modules

The core is one public surface but several internal modules, each a single
responsibility. This is code organization, not new API — a peer-review recommendation to
keep the growing core maintainable. The `src/engine/src/core/` layout mirrors it.

| Module | Owns | Section |
|---|---|---|
| `kernel` | the `GameState` envelope, the `Engine`, `submitAction` | §2, §4 |
| `session` | the session store, save/load handles, the profile store | §7, §7.1 |
| `persistence` | canonical serialize/deserialize, `SaveEnvelope`, migration | §10 |
| `projection` | the `project` mechanism, audiences | §9 |
| `validation` | the tiered validator, `ValidationResult` | §11 |
| `registry` | the content registry, campaign resolution | §10.1 |
| `localization` | `LocKey` resolution against string tables | §12, §17 |
| `determinism` | the RNG handle, streams, the harness | §8, §14 |
| `observability` | the `Emitter`, `EngineEvent`, sinks | [`05-observability.md`](05-observability.md) |
| `composition` | the host roots and the port interfaces | [`06-extensibility.md`](06-extensibility.md) |

Kinds (`kinds/`) and clients (`clients/`, `mcp/`) sit above; the dependency arrow points
only downward — a core module never imports a kind or client.

---

## 2. The `GameState` Envelope

The core owns a **kind-agnostic envelope** and treats each kind's own state as an
opaque payload inside it. This is the single most important type in the platform: it is
what `advance`, `serialize`, and the session store operate on.

```typescript
type KindId = "story-graph" | "simulation" | "world-graph";

interface GameState {
  formatVersion: number;         // the shape of THIS envelope — see §10.2
  gameId: string;                // from the IdSource port (06 §5.1); opaque to the core

  kindId: KindId;
  campaignId: string;
  campaignVersion: string;       // the published version this game runs (§10)

  seed: string;                  // the only randomness state — streams derive from it (§8)

  status: GameStatus;            // active | ended | abandoned
  kindState: unknown;            // the kind's own state — opaque to the core

  actionLog: LoggedAction[];     // ordered player actions — the replay spine (§9)
}

type GameStatus = "active" | "ended" | "abandoned";

interface LoggedAction {
  seq: number;                   // 0-based, monotonic
  actionId: string;              // the action the player submitted
  params?: Readonly<Record<string, string | number | boolean>>;
}
```

**What lives here vs in `kindState`.** The envelope holds everything a game has
*regardless of kind*: identity, campaign reference, seed, status, and the action
log. A kind's own concepts — current node, variables, turn counter, week number,
needs — live in `kindState`, opaque to the core.

> **No persisted RNG state.** Randomness is *derived*, not carried: every stream is a
> pure function of `(seed, streamId)` (§8), so the envelope stores the seed and nothing
> else. A persisted generator state would be written every action and read by nothing —
> a serialized field free to drift from the derivable truth, taking byte-identical
> replay with it. `{ seed, actionLog }` is the complete replay input.

> **Why `kindState: unknown`.** The core must not depend on any kind. Typing the
> field as `unknown` (not a union of kind states) keeps the dependency arrow pointing
> the right way — kinds depend on the core, never the reverse. Each kind casts its
> own `kindState` internally, guarded by `kindId`. This is the platform equivalent of
> the simulation kind's "engine imports no client" rule (games/04-engine-specification.md §20.1).

> **Determinism note.** No wall-clock (`createdAt`/`updatedAt`) lives in `GameState` —
> that would make byte-identical replay impossible. Timestamps, if a host wants them,
> live in the session-store record (§7), outside the replayable state. The determinism
> guard in `src/engine/eslint.config.js` enforces no `Date.now`.

---

## 3. The Kind Interface — The Seam

A **kind** is engine-owned code that teaches the core how one category of game
plays. Every kind implements this interface; the core drives it without knowing
which kind it is.

```typescript
interface Kind<KState> {
  readonly id: KindId;
  readonly version: string;                      // manually maintained semver (§10.2, W31)
  readonly reasonCodes: readonly ReasonCode[];   // codes this kind adds to the base set (§12)
  /** The kind-owned half of the string table: registry assembly merges it alongside the
   *  core's protected `core.reason.*` set (§10.1), and validation checks it for completeness
   *  before assembly runs (§11, §12). A kind ships its own messages for the same reason the
   *  core ships the base set's — the codes are useless to a client that cannot render them.
   *
   *  It must carry a `${id}.reason.<code>` entry for **every** member of `reasonCodes`; the
   *  completeness check is `registered → has a message` and nothing more. It may carry
   *  others, and this is a channel rather than a leak: a kind's own engine-created content
   *  can reference a `LocKey` no campaign collection exists to author — `simulation`'s
   *  `simulation.finance.investment.label`, on the fixed investment account its `invest`
   *  resolver creates — and `reasonMessages` is a `Kind`'s only route into the merged
   *  registry. Such a key is namespaced under the kind like any other and is not a reason
   *  code; nothing resolves it as one. */
  readonly reasonMessages: ReadonlyMap<LocKey, string>;
  readonly eventNames: readonly EventName[];     // events this kind may emit (05 §9)

  /** Build the starting kind-state for a fresh game of this campaign. `profileData` is this
   *  kind's own cross-game slice, already resolved and migrated by the session store before
   *  the pure engine ran (§5, §7.1). It is absent for an anonymous session, for a kind that
   *  declares no `profileData` member, and for a replay whose `NewGameConfig` carries none —
   *  a kind that reads it must treat absence as "no cross-game history", never as an error. */
  initialState(campaign: Campaign, ctx: KindContext, profileData?: unknown): InitialStateResult<KState>;

  /** What the player can do right now — generic actions for the current scene (§6). */
  availableActions(state: KState, ctx: KindContext): AvailableAction[];

  /** Render the current situation into a generic scene body (§6). */
  scene(state: KState, ctx: KindContext): SceneBody;

  /** Resolve one player action. Pure: same (state, action, params, ctx) → same result. */
  advance(
    state: KState,
    actionId: string,
    params: ActionParams | undefined,
    ctx: KindContext,
  ): AdvanceResult<KState>;

  /** Narrow kind-state to the visible projection for an audience (§9). May return values
   *  that alias `state`; the core copies at the boundary (§9.1). The one requirement is
   *  that the result be plain, structurally cloneable data. */
  project(state: KState, audience: ProjectionAudience, ctx: KindContext): unknown;

  /**
   * Tiered content validation of a campaign of this kind (§11). `strings` is the
   * registry's built string table — checking a `LocKey` resolves, or that rendered text
   * interpolates only a declared, visible variable, needs the table itself, not just the
   * kind's opaque `content`.
   */
  validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult;

  /**
   * A minimal, cross-version-stable terminal identity — published ids only, never
   * values ([`07-replay.md`](07-replay.md) §3.3). Every kind returns at least
   * `KindOutcome` (§3.2) and may widen it with its own published ids.
   */
  outcome(state: KState): KindOutcome;

  /**
   * How many distinct `terminalId`s (§3.2) a campaign of this kind declares, for progress
   * display (§7.3). Optional: a kind whose terminal set is not a bounded, countable
   * property of its content omits it, and the core reports no total rather than a wrong
   * one. Pure over content — it reads `campaign`, never state, and never a profile.
   */
  terminalCount?(campaign: Campaign): number;

  /**
   * Migrates a `KState` produced under an older `version` forward, when this kind's own
   * state shape changed (§10.2). Optional — most version bumps don't change the shape a
   * save references. Invoked only at the save-load boundary (`SessionStore`), never by
   * `advance`; a missing function on a version mismatch fails the load rather than
   * silently handing this version a state it wasn't written to read.
   */
  migrateState?(oldState: unknown, fromVersion: string): CommandResult<KState>;

  /**
   * This kind's cross-game profile slice (§7.1). **Absent means the kind owns no profile
   * data at all** — no `KindProfileRecord` is ever written for it, `initialState` never
   * receives a `profileData` argument, and nothing about profiles reaches it. That is the
   * state every kind is in until it declares this member, and it is the reason the whole
   * mechanism is one optional property rather than three correlated ones: a kind cannot
   * declare a version without a fold, or a fold without a version.
   */
  readonly profileData?: KindProfileData;
}

/**
 * The kind-owned half of §7.1's cross-game data. Engine-owned code, never a host-supplied
 * port: it decides what a profile records and how a recorded value reads back, and 06 §2's
 * rule admits a host only where it cannot change `serialize()` output. A seeded slice reaches
 * `initialState`, so this one can.
 */
interface KindProfileData {
  /** The shape version of this kind's `KindProfileRecord.data`. A positive integer, moving
   *  only when that shape changes. **Deliberately not `Kind.version`**: a kind's code moves
   *  far more often than its profile slice's shape does, and sharing the stamp would demand a
   *  profile migration for every unrelated bump. */
  readonly version: number;

  /**
   * Fold one successful action's audit records into this kind's slice. Pure and total — same
   * `(current, campaign, changes)` gives the same result, it performs no I/O, and it must not
   * throw; the store treats a throw as a refused write (§7.1) rather than letting it reach the
   * player, exactly as `resolveSaveEnvelope` already treats a throwing `migrateState`.
   *
   * **It must be idempotent**: folding the same `changes` twice must equal folding them once.
   * That is what makes a transition survive a reload, a branch, or a re-submitted action
   * without a duplicate entry, and it is why the recorded shapes below are maxima and sets
   * rather than sums.
   *
   * `current` is `undefined` the first time this profile records anything for this kind.
   * Returning a value whose canonical serialization equals `current`'s means "nothing to
   * write", and the store skips the write — which is how idempotence becomes observable
   * rather than merely claimed.
   */
  fold(current: unknown, campaign: Campaign, changes: readonly StateChange[]): unknown;

  /**
   * Migrate a slice written under an older `version` (§7.1). Optional, and its absence is a
   * *degradation* rather than a failure: a version mismatch with no migration drops the slice
   * and warns, because a profile is a mirror of games already played and the game is the
   * system of record. This is the one place a migration may be missing without failing —
   * §10.2's save-side mismatch fails loudly, because there the payload *is* the record.
   */
  migrate?(data: unknown, fromVersion: number): CommandResult<unknown>;
}

interface AdvanceResult<KState> {
  state: KState;                 // the new kind-state
  status: "active" | "ended";    // advance never yields "abandoned" — that is session-only (§7)
  changes: StateChange[];        // audit records (§12) — for history and transparency
  messages: OutcomeMessage[];    // player-facing, localized (§12)
  error?: ValidationError;       // set iff the action was rejected; state is unchanged
}

interface InitialStateResult<KState> {
  state: KState;                 // the starting kind-state
  status: "active" | "ended";    // a kind that settles at start may already be ended
  changes: StateChange[];
  messages: OutcomeMessage[];
}
```

> **Why `initialState` returns a result, not a bare `KState`.** A kind that settles at
> start (story-graph, 03 §8.2) can land on an ending before the player acts — a valid
> campaign (§11, Tier 2 warns). The core cannot discover this by inspecting `kindState`,
> which is `unknown` to it by design (§2), so the kind must *say so*. `InitialStateResult`
> is deliberately `AdvanceResult` minus `error`: a campaign is pre-validated before the
> registry is frozen, so starting a game cannot fail the way an action can.

> **Why `advance` receives `params`.** `submitAction` writes `params` into the replay log
> (§2), so anything they affect must be reachable from the kind — otherwise the log
> carries data that provably cannot change replay. The story-graph kind declares no
> parameters (an action *is* a choice id) and returns a `ValidationError` if a non-empty
> `params` object arrives. Undocumented parameters are never silently ignored.

> **A rejection also returns a message.** `error` tells the core and client *that* the
> action failed and why (`ReasonCode`, `messageKey`); `messages` is what tells the
> *player* — a rejected `AdvanceResult` attaches one `OutcomeMessage` built from the same
> `messageKey` the error already carries (`{ key: messageKey, visible: true }`), so a
> rejection is never silently swallowed by a client that only renders `messages`. Every
> kind's rejection path follows this convention (world-graph's `actions/common.ts`
> `rejected` helper and the story-graph kind's own, §8.3).

`advance` is where a kind's whole ruleset lives. For the story-graph kind it is
`submitChoice → settle` ([`03-story-graph-kind.md`](03-story-graph-kind.md) §8.2); for
the simulation kind it is the weekly resolution (`games/04-engine-specification.md`). The core calls it and
never looks inside.

> **One action model, three kinds.** The core's action is a string `actionId` plus
> optional params. For the story-graph kind an action *is* a choice id, and it declares no
> params at all. For the simulation kind, actions map to its richer verbs (submit a plan,
> end the week). For the world-graph kind they are richer still — `build` carries a
> definition, a position and a rotation; `advance_ticks` carries a tick count
> ([`12-world-graph-kind.md`](12-world-graph-kind.md) §6). The core does not care — it
> forwards the `actionId` and the kind interprets it. This is what lets one API (§7) and
> one MCP surface (§13) serve all three, and the spread from *no params* to *four* is the
> evidence that the model scales rather than merely fitting the two it was drawn from.

### 3.1 KindContext

Everything a kind needs to resolve, supplied by the core:

```typescript
interface KindContext {
  readonly registry: ContentRegistry;   // §10 — the campaign and shared content
  readonly campaign: Campaign;           // this game's campaign, resolved
  readonly rng: RngHandle;               // handle on this resolution's own stream (§8)
  readonly derive: (streamId: StreamId) => RngHandle;   // any other stream, same seed (§8)
  readonly seq: number;                  // current action sequence number
  readonly emit: ResolutionEmitter;      // this resolution's event handle (05 §4)
}
```

The kind draws randomness only from `ctx.rng` — a handle on the stream derived for
*this* resolution from `(seed, streamId)` — or from `ctx.derive`, for the streams that are
keyed by something other than the action. Either way the handle is discarded when `advance`
returns; nothing is written back, because the next resolution derives its own stream
from the seed again (§8). The kind stays pure and every draw stays reproducible.

> **Why `derive` exists.** §8 defines four `StreamId` variants, but only a kind is ever in a
> position to use three of them — the core cannot know that a draw belongs to *this guest's
> fifth decision* rather than to the action in flight. Without `derive`, `ctx.rng` was the
> only reachable stream and those variants were unreachable by construction. `derive` closes
> over the game's `seed` and nothing else: it is pure, it persists nothing, and
> `{ seed, actionLog }` remains the complete replay input. The kind that forced this is
> `world-graph`, whose correctness depends on draws keyed by simulated time rather
> than by how a client batched its requests
> ([`12-world-graph-kind.md`](12-world-graph-kind.md) §5).

`ctx.emit` is the same shape for the same reasons: a handle scoped to this resolution,
used and discarded, carrying nothing back into state. It reports what the kind is doing to
whatever sink the host attached, and `emit` returns `void` precisely so that nothing about
the sink can reach the game ([`05-observability.md`](05-observability.md) §2). Removing
every event must leave `serialize()` byte-identical — the determinism harness asserts it
(§14).

### 3.2 `KindOutcome` — Terminal Identity a Host Can Read

`Kind.outcome` returned `unknown`, so a host holding a finished session could learn nothing
from it without knowing which kind produced it. That is the one place the seam leaked its own
purpose: terminal identity exists to be the **cross-version-stable vocabulary**
([`07-replay.md`](07-replay.md) §3.3), and a vocabulary only one reader can parse is not one.
The floor is now typed.

```typescript
interface KindOutcome {
  readonly terminal: boolean;           // false while the game is still active
  readonly terminalId: string | null;   // the published id naming how it ended; null while active
}
```

**`terminalId` is a published id, and `terminal` is not derivable from it being non-null** —
they are two facts, and a kind that ever ends without naming a terminal keeps them
distinguishable rather than forcing `null` to mean two things. `terminal` is the field a host
branches on; `terminalId` is the field it indexes, stores and compares.

**Each shipped kind widens this rather than replacing it**, so nothing already in a kind's
outcome moves or is lost:

| Kind | `terminalId` is | Widened with |
|---|---|---|
| `story-graph` | `endingId` (03 §8.5) | `endingId` |
| `simulation` | `resolution` — `goals_met` / `failed` / `week_limit_reached` (10 §12) | `resolution`, `goalsMet`, `goalsFailed` |
| `world-graph` | `resolution` — `objectives_met` / `failed` (12 §8) | `resolution`, `objectivesMet`, `failureId` |

**The two columns are not one vocabulary, deliberately.** A story-graph terminal is an
*authored* id drawn from campaign content; a simulation or world-graph terminal is a *declared*
id drawn from a closed set this contract fixes. Flattening them would mean either inventing
authored resolutions the two mechanical kinds do not have, or collapsing every ending a
campaign ships into three buckets. What a host actually needs is weaker and is what is
guaranteed here: **`terminalId` is stable across engine versions, unique within its campaign,
and safe to persist and compare** — which is enough to index a finished session, count distinct
terminals reached (§7.3), and detect a replay divergence, none of which require knowing what
the id *means*.

**A host still may not read a widened field without knowing the kind.** That is not a
concession; it is the same rule as `kindState` (§2). The base is a floor, not a lowest common
denominator that kinds are then discouraged from exceeding.

**Balance-sensitive values remain excluded, unchanged.** Nothing here loosens
[`07-replay.md`](07-replay.md) §3.4: no money, no needs, no tick or week counts, no satisfaction
score. `KindOutcome` adds a boolean and an id, both of which a rebalance leaves alone.

> **Why not a win/loss disposition on the base.** It is the field a host wants next and it was
> deliberately left out. `Kind.outcome` receives `KState` and no campaign — the same constraint
> 10 §12 already records for `weekLimit` — and story-graph's win/loss lives on `EndingNode`
> ([`03-story-graph-kind.md`](03-story-graph-kind.md) §3), in content the function cannot reach.
> Supplying it would mean persisting the disposition into `StoryGraphKindState`, which is a kind-
> state shape change: a `kindVersion` bump and a `Kind.migrateState` (§10.2) for every existing
> save. That is a defensible unit of work and it is not this one. Recorded rather than dropped —
> a host that needs win/loss today reads `StoryGraphView.ending.outcome` (03 §9), which has
> carried it all along.

---

## 4. Registration and the Pure Engine

Kinds are registered at engine construction — a fixed, engine-owned set (architecture
§1). A missing kind is a construction error, not a runtime surprise.

```typescript
type KindRegistry = Readonly<Record<KindId, Kind<unknown>>>;

function createEngine(host: EngineHost): Engine;   // EngineHost — 06 §4
```

> **What this replaced, and why the shape changed.** A three-positional-argument form —
> `createEngine(registry, kinds, emitter?)` — stood here until the `IdSource` port
> ([`06-extensibility.md`](06-extensibility.md) §5.1) closed a real gap it left open:
> `gameId` and `seed` were consumed by `createGame` below with no named source.
> `EngineHost { kinds, registry, ids?, emitter? }` (06 §4) supplies all four in one shape,
> and each optional port has a working default — `ids` a random source, `emitter` `nullEmitter`
> ([`05-observability.md`](05-observability.md) §4). The older form is recorded rather than
> deleted, the same "provenance, not authority" relationship this document has with
> `games/04-engine-specification.md` above, just one level down.

The **pure engine** exposes kind-agnostic operations over the envelope. It resolves the
kind by `state.kindId`, derives the RNG handle, delegates, and reassembles the envelope:

```typescript
interface Engine {
  /** The same `KindRegistry` this engine resolves `state.kindId` against, exposed so a
   *  caller needing kind metadata outside gameplay — `SessionStore`'s `SaveEnvelope`
   *  stamping and migration dispatch (§10.2) — reads it off the one engine it already
   *  holds rather than taking a second, independently-suppliable registry that could
   *  silently disagree with what this engine actually plays against. */
  readonly kinds: KindRegistry;
  createGame(config: NewGameConfig): CommandResult<GameState>;
  scene(state: GameState): Scene;                       // §6
  view(state: GameState, audience: ProjectionAudience): PlayerView;   // §9
  availableActions(state: GameState): AvailableAction[];
  submitAction(state: GameState, actionId: string, params?: ActionParams): ActionResult;
  previewAction(state: GameState, actionId: string, params?: ActionParams): ActionResult;
  serialize(state: GameState): string;                  // §10 (canonical)
  deserialize(data: string): CommandResult<GameState>;
  migrate(data: string): CommandResult<GameState>;      // §10

  /** The same engine, with every event stamped for one command
   *  ([`05-observability.md`](05-observability.md) §6.1). The session store builds a
   *  short-lived decorator per command and swaps it in here, rather than the pure engine
   *  ever holding a clock or per-command context of its own. Listed here because this is
   *  the canonical `Engine` block; 05 §6.1 owns the reasoning. */
  withEmitter(emitter: Emitter): Engine;
}
```

`submitAction` is the whole loop, in the core:

```text
submitAction(state, actionId, params):
  1. kind = kinds[state.kindId];  seq = state.actionLog.length   // 0-based, monotonic
  2. handle = rngHandleFor(state.seed, { kind:"action", seq })   // §8 — derived, not carried
  3. emit = resolutionEmitter(emitter, state.gameId, seq)        // 05 §4 — ordinal starts at 0
  4. result = kind.advance(state.kindState, actionId, params,
       { registry, campaign, rng: handle, derive, seq, emit })   // §3.1 — `derive` closes over the seed
  5. if result.error → return { ok:false, errors:[result.error] }, state unchanged  // ActionResult.errors is a list (§12)
  6. newState = {
       ...state,
       kindState: result.state,
       status: result.status,
       actionLog: [...state.actionLog, { seq, actionId, params }],
     }
  7. return { ok:true, value:newState, errors:[], warnings:[],
              changes:result.changes, messages:result.messages }
```

`previewAction` runs that same path against a null emitter. Its successful `value` is a
prospective state for rendering only: the caller must project it and discard it, never
persist it. The input state remains unchanged and preview emits no action lifecycle event,
so it cannot masquerade as a committed command.

> **A rejected action does not advance `seq`.** Step 5 returns without appending, so the
> next attempt computes the same `seq` from the same log length. That is deliberate — the
> log is the replay spine and a refused action is not part of it — but it means two rejected
> attempts emit events with identical `(gameId, seq, ordinal)`. Observability states that
> limit rather than papering over it, and disambiguates at the boundary
> ([`05-observability.md`](05-observability.md) §5, §6).

Immutability is unconditional (games/04-engine-specification.md §11.3): every operation returns a new envelope.

**`createGame`** assembles the envelope and delegates the start to the kind:

```text
createGame(config):
  0. gameId = ids.newGameId()                                // 06 §5.1 — the IdSource port
  1. campaign = registry.campaigns[config.campaignId]        // kind = campaign.kindId
  2. seed = config.seed ?? ids.newSeed()                     // 06 §5.1 — recorded in the envelope
  3. startHandle = rngHandleFor(seed, { kind:"system", system:"start", seq:0 })   // §8
  4. startEmit = resolutionEmitter(emitter, gameId, 0)            // 05 §4 — seq 0, ordinal 0
  5. init = kind.initialState(campaign, { registry, campaign, rng: startHandle, derive, seq: 0, emit: startEmit })
     // a kind that settles at start (story-graph, 03 §8.2) draws its initial
     // random transitions from startHandle, and reports "ended" if it settled to one
  6. return the envelope { kindId: campaign.kindId, campaignId: campaign.id,
       campaignVersion: campaign.version, seed,
       status: init.status, kindState: init.state, actionLog: [] }
     // init.changes / init.messages ride out on the CommandResult
```

The start resolution uses `seq: 0` for both the RNG stream and the emitter, matching the
first action's numbering; the two never collide because the *stream* is `system:"start"`
rather than `action` (below), and because the emitter's ordinal restarts per resolution.

The **start** stream (`system:"start"`) is deliberately distinct from the per-action
streams `submitAction` uses (`{ kind:"action", seq }`), so a start-of-game random draw
can never collide with an action's — the initial `settle` is reproducible on its own stream.

---

## 5. Configuration

```typescript
interface NewGameConfig {
  campaignId: string;
  seed?: string;                 // omitted → the store generates one and records it
  audience?: ProjectionAudience; // default "player"
  kindProfileData?: unknown;     // §7.1 — the resolved cross-game slice, not the profile
}
```

The kind is not named here — it is a property of the campaign (`Campaign.kindId`),
resolved from the registry. A client starts a game by campaign; whether that campaign
is a story graph or a simulation is invisible to it.

> **`kindProfileData` is an *input*, and that is the whole of why it sits here.** §7.1's
> standing rule is that nothing in resolution reads a profile, and §7's is that `profileId`
> never appears on this type or in `GameState`. Both survive: the session store reads the
> profile, extracts and migrates the slice for this campaign's kind, and writes the **resolved
> value** into the config it hands the pure engine. No identity travels, and no ambient read
> happens during resolution — by the time `advance` runs, whatever the kind kept from the slice
> is ordinary `kindState`.
>
> **Putting it anywhere else breaks the replay oracle.** `ReplayFixture.config` is a
> `NewGameConfig` (07 §2), so a value carried here is captured with the fixture and reproduces;
> a value reaching `initialState` through `KindContext` instead would not be, and a captured
> session that started from a profile would silently stop being reproducible — the oracle would
> still pass while asserting something weaker than it claims. That is the same objection
> `90-decisions.md` records against feeding a profile into `KindContext` for *projection*,
> applied to initialization, and it points the same way. `08-session-capture.md` §2's privacy
> rule is met by construction rather than by exception: what travels is kind-declared content
> ids and integers, the same category as `ActionParams`, and never `profileId`.
>
> **The type is `unknown` for the same reason `GameState.kindState` is** (§2): the core must
> not depend on a kind. It is opaque here, opaque on the profile record (§7.1), and typed only
> inside the kind that declared it.

---

## 6. Scenes and Actions (Generic)

The unified surface every client renders. A kind projects its current situation into
this shape; a story graph and a simulation both produce a `Scene`.

```typescript
interface Scene {
  gameId: string;
  status: GameStatus;
  body: SceneBody;               // kind-rendered
  actions: AvailableAction[];
  view: PlayerView;              // the projection (§9), bundled for convenience
}

interface SceneBody {
  textKey: LocKey;
  text: string;                  // rendered, with visible-state params substituted
}

interface AvailableAction {
  id: string;                    // the actionId to submit
  labelKey: LocKey;
  available: boolean;            // requirements met
  reasonKey?: LocKey;            // present iff not available — Transparent Consequences
}

type ActionParams = Readonly<Record<string, string | number | boolean>>;
```

**`AvailableAction` describes a *verb*, not its parameter space.** A kind uses it to expose
a gated choice list — one entry per thing the player may currently do, `available` and
`reasonKey` saying whether and why not. That is *a* pattern a kind may use, not the default
with exceptions: it is the right shape exactly when the set of distinct submissions is small
enough to enumerate, and the wrong one as soon as an action carries parameters, because
enumerating a verb × its parameter domain is combinatorial.

How each of the three kinds actually lands, since the spread is the point:

- **`story-graph`** uses it as a gated choice list — an `AvailableAction` *is* a node choice,
  `available`/`reasonKey` come straight from its requirement gate (03 §4), and it declares no
  params at all. This is the pattern at its cleanest, and it is why the type looks the way it
  does.
- **`simulation`** returns its four verbs (`plan.add`/`plan.remove`/`plan.clear`, `end_week`)
  and pushes the whole parameter domain — which `ActionType`s are offerable, and the plan
  itself, so a client can compute a valid `plan.remove` index — into `SimulationView.plan`
  (10 §9).
- **`world-graph`** does the same for spatial verbs, and is the kind that forced the rule to
  be stated: the build catalogue, staff roster and price bands are projection (12 §7, §10),
  because `build` × every definition × every cell × four rotations is not a list.

The invariant across all three is only this: whatever a client can submit, it can *discover*
— from `availableActions`, from the projection, or from both. `AvailableAction` is one of
the two places that discovery may live, not the place it must.

---

## 7. The Session Store and the Platform API

The pure engine is stateless. The **session store** is the thin stateful layer clients
actually call. It maps the architecture's §10 API onto the pure engine, keyed by
`sessionId`.

The surface splits cleanly into **queries** (read-only, no persisted state change) and
**commands** (advance or persist). This is a documentation convention for clarity — not
CQRS the pattern: there is one state model, no separate read store, no event bus. Just a
useful line between "look" and "change."

```typescript
interface SessionStore {
  // ── Queries (read-only) ──────────────────────────────
  listCampaigns(profileId?: string): Promise<CampaignCatalog>;   // session-free — §7.3
  getScene(sessionId: string): Promise<Scene>;
  getView(sessionId: string): Promise<PlayerView>;
  getStrings(sessionId: string): Promise<StringTable>;   // resolve LocKeys — below
  listSaves(profileId: string): Promise<readonly SaveSummary[]>; // player-keyed, totally ordered — §7.4
  previewAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult>; // resolves prospectively, then discards

  // ── Commands (advance or persist) ────────────────────
  createSession(config: CreateSessionConfig): Promise<SessionHandle>;   // profileId lives here
  resumeSession(sessionId: string): Promise<Scene>;
  submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult>;
  saveGame(sessionId: string): Promise<SaveHandle>;                  // named/manual save
  loadGame(saveId: string): Promise<SessionHandle>;
  deleteSave(profileId: string, saveId: string, expectedSavedAt: string): Promise<void>;  // §7.4
  branchSession(sessionId: string, atActionCount: number): Promise<SessionHandle>;        // §7.4
}

interface SessionHandle { sessionId: string; scene: Scene; }
interface SaveHandle { saveId: string; savedAt: string; savedAtSeq: number; }

/** §7.4. Save-list metadata only — never a blob, never an envelope, never kind content. */
interface SaveSummary {
  saveId: string;
  campaignId: string;
  savedAt: string;               // Clock-stamped (06 §5.4); the primary sort key
  savedAtSeq: number;            // actions logged at the moment the save was taken
}
/** §7.3. `strings` resolves every `LocKey` the summaries carry, and nothing else. */
interface CampaignCatalog {
  readonly campaigns: readonly CampaignSummary[];
  readonly strings: StringTable;
}

interface CampaignSummary {
  campaignId: string;
  kindId: KindId;
  titleKey: LocKey;
  progress?: CampaignProgress;   // present iff `listCampaigns` was given a `profileId` — §7.3
}

interface CampaignProgress {
  discovered: number;            // distinct `terminalId`s this profile has reached here
  total: number;                 // what `Kind.terminalCount` reports for this campaign
}

interface CreateSessionConfig extends NewGameConfig {
  profileId?: string;            // omitted → anonymous session; see §7.1
}

/** What a client gets back from an action. Never the envelope. */
interface SessionActionResult {
  ok: boolean;
  scene?: Scene;                 // the new scene, on success — a projection (§9)
  errors: ValidationError[];
  warnings: ValidationWarning[];
  changes: StateChange[];        // audit records, `visible`-gated (§12)
  messages: OutcomeMessage[];
}

type StringTable = Readonly<Record<LocKey, string>>;
```

> **`submitAction` returns `SessionActionResult`, not `ActionResult`.** `ActionResult`
> extends `CommandResult<GameState>` (§12) — its success value is **the envelope**, seed and
> action log and opaque `kindState` included. That type is correct for the *pure engine*
> (§4), whose caller is the store; handing it to a client would put raw state on the other
> side of the projection boundary and make §9 a convention rather than a guarantee. The
> store unwraps it and returns a `Scene`.

> **`createSession` takes `CreateSessionConfig`.** It previously took `NewGameConfig`, which
> carries no `profileId` — leaving `CreateSessionConfig` defined and unreachable, and no way
> for a client to start the profiled session MVP §5 requires for cross-session achievements.
> `profileId` stays off `NewGameConfig` and out of `GameState` (§7.1); it is a *session*
> input, which is exactly what this type is for.

> **Why `getStrings` is a store operation.** Every client-facing type carries `LocKey`s —
> `Scene.actions[].labelKey`, `CampaignSummary.titleKey`, `OutcomeMessage.key`,
> `ValidationError` — and a client that may call nothing but this store (09 §2) otherwise has
> no way to render any of them. Resolving them *inside* the DTOs was the alternative and is
> worse: it would bake a locale into the projection and lose the property that clients never
> string-match English (§12). The table is keyed by the campaign and locale the session was
> created with; a locale switch is a new session, which is all the MVP's single locale needs.

**The store persists the envelope (§2) and nothing else about play.** Wall-clock
timestamps, owner ids, and other host metadata live on the store's record, outside the
replayable `GameState`. This is the boundary that keeps determinism intact while still
supporting "resume on another device" (architecture §2).

`createSession` generates and records a seed when the config omits one, so a resumed or
replayed session is always reproducible.

**Two independent lock domains, and they are part of this contract.** The store holds a
serialized blob per session and mutates it in place, so "read the blob, resolve, write it
back" is a read-modify-write and needs saying who may run concurrently with whom:

- **Per `sessionId`** — every operation that touches one session's blob queues behind its
  predecessor for that session. Two submissions against the same session therefore resolve in
  the order they acquire the lock, never interleaved, so neither can read a blob the other is
  about to overwrite.
- **Per `profileId`** — the profile upsert (§7.1) is its own load-merge-save, and two
  *different* sessions may legitimately share one `profileId`; that is what a profile is for.
  Session locking alone does not serialize it, so profile upserts queue on a second,
  independent domain keyed by `profileId`.
- **Per `saveId`** — a save record is written by `saveGame` and removed by `deleteSave`
  (§7.4), and neither is reachable from the session lock: a save outlives the session that
  wrote it, and `deleteSave` is addressed by `saveId` alone. A third domain keyed by `saveId`
  is what makes §7.4's compare-and-delete a read-modify-write rather than a race.

**Different sessions interleave freely**, which is the property that matters for a host
serving many players: the domains are keyed, not global, and the two never couple. Nothing
here is visible in `serialize()` output — locking orders commands, it does not change what any
one command computes — so this is a store-layer concurrency contract, not a determinism one.

> **`previewAction` takes the session lock but is not a command.** It shares the per-session
> queue, so it cannot evaluate one version of a session while a neighbouring submission
> persists another. Everything else that makes an operation a command, it deliberately skips:
> it does not increment the attempt counter, does not write the blob, does not touch profile
> persistence, and emits no action lifecycle event (§4). That is the query/command split above
> taken literally — a preview is a read that happens to run the write path, so it must be
> ordered like a write and recorded like a read.

### 7.1 The Profile Store

Achievements must outlive a game (MVP §5, 03 §7), but nothing durable may sit inside
`GameState`. So the profile is a **second store beside the session store**, at the same
layer — stateful, I/O-doing, and invisible to the pure engine.

```typescript
interface PlayerProfile {
  formatVersion: 3;
  profileId: string;
  achievements: readonly AchievementRecord[];
  terminals: readonly TerminalRecord[];   // §7.3 — the cross-session half of campaign progress
  kindData: readonly KindProfileRecord[]; // below — the kind-owned cross-game slice
}

interface AchievementRecord {
  campaignId: string;            // achievement ids are only unique within a campaign
  achievementId: string;
}

interface TerminalRecord {
  campaignId: string;            // a terminalId is only unique within a campaign (§3.2, §17)
  terminalId: string;            // `KindOutcome.terminalId` — a published id, never a value
}

/** At most one per kind. Ordered by `kindId` ascending, so a profile has one serialization. */
interface KindProfileRecord {
  kindId: string;                // a `KindId` for every kind this build knows; see below
  dataVersion: number;           // the `Kind.profileData.version` this `data` was written under
  data: unknown;                 // opaque to the core, exactly as `GameState.kindState` is (§2)
}

type ProfileWarningCode =
  | "profile_missing" | "profile_corrupt" | "profile_write_failed"
  | "profile_kind_data_unreadable" | "profile_kind_data_rejected";
interface ProfileWarning {
  code: ProfileWarningCode;
  profileId: string;
  kindId?: string;               // present iff the warning is about one `KindProfileRecord`
}

interface ProfileLoadResult { profile: PlayerProfile; warnings: readonly ProfileWarning[]; }
interface ProfileSaveResult { ok: boolean; warnings: readonly ProfileWarning[]; }

interface ProfileStore {
  load(profileId: string): Promise<ProfileLoadResult>;
  save(profile: PlayerProfile): Promise<ProfileSaveResult>;
}
```

Rules, all of them determinism-preserving:

- **Profile identity is a session concern.** `profileId` lives on `CreateSessionConfig`
  and the store's record — never on `NewGameConfig`, never on `GameState`. The pure
  engine has no idea profiles exist. A manual save preserves that association the same
  way: `profileId` round-trips through the store's own save record, never through the
  serialized `SaveEnvelope`, so `loadGame` restores the same profile a `saveGame`'d
  session had.
- **Nothing in resolution reads a profile.** A kind unlocks into its own `kindState`
  (03 §7) and emits an `achievement_unlocked` `StateChange` (§12). *After* a successful
  action, the session store idempotently upserts those records through the
  `ProfileStore`. Profile contents and write outcomes never feed back into `advance`.
- **Anonymous by default.** No `profileId` → no read, no write; achievements persist only
  for that game. Cross-session persistence is opt-in.
- **Degradation is a warning, never a failure.** Missing or corrupt loads return an empty
  `formatVersion: 3` profile plus `profile_missing` / `profile_corrupt`. A failed write
  returns `profile_write_failed` and **does not** roll back the completed game action —
  the game is authoritative, the profile is a mirror.
- **Terminals mirror exactly as achievements do.** After an action whose `AdvanceResult.status`
  is `ended`, the session store reads `Kind.outcome` and idempotently upserts one
  `TerminalRecord` for the `terminalId` it names, on the same write as the achievement upsert.
  A `null` `terminalId` on a terminal outcome records nothing. Nothing in `advance` or
  `project` ever reads one back, so this cannot perturb determinism any more than the
  achievement mirror can.
- **Kind-owned data mirrors the same way, and reads back as an input.** A kind that declares
  `Kind.profileData` (§3) gets one `KindProfileRecord`; the store folds it forward after a
  successful action, and hands it back through `NewGameConfig.kindProfileData` (§5) when a new
  session for that profile starts. Both halves keep the two rules above intact — the write is
  after resolution, and the read is before it. *Kind-owned cross-game data*, below, is the
  whole of it.

**`formatVersion` has moved twice, and both migrations are total, which is why both are stated
here rather than seamed as functions.** A version-1 profile reads as
`{ ...profile, formatVersion: 3, terminals: [], kindData: [] }`; a version-2 profile reads as
`{ ...profile, formatVersion: 3, kindData: [] }`. No field is renamed, removed or re-typed at
either step, so neither can fail. **The `ProfileStore` implementation owns this migration** —
it is the one part a host adapter must reproduce, because the adapter is what reads the stored
document, and it needs no kind registry to do it. The per-kind `dataVersion` migration below is
the opposite, and is core-owned for the same reason inverted.

A player who finished games under version 1 starts at `discovered: 0` for those campaigns and
re-earns the count by finishing again. That loss is accepted deliberately: the alternative is
reconstructing terminals from stored session blobs, which would mean deserializing every save a
profile ever touched to recover a number that exists only to decorate a shelf. The 2 → 3 step
loses nothing, because no version-2 profile ever held kind data.

> **`formatVersion: 3` is a literal type, and the break is deliberate.** A host constructing a
> `PlayerProfile` fails to compile rather than writing a `2` document this build then migrates
> on every load. This is durable player data; a loud break at the one place that constructs it
> is cheaper than a silent per-load rewrite nobody notices.

#### Kind-owned cross-game data

A kind's own state cannot outlive a game — that is `GameState`'s whole shape (§2). Some of it
is *meant* to: `simulation`'s `"profile"`-scoped event chains
([`10-simulation-kind.md`](10-simulation-kind.md) §2.2) exist precisely to advance across games
a player has already finished. This is where that lives, and the core never learns what it is.

**Ownership.** `KindProfileRecord.data` is owned end to end by the kind whose `kindId` it names.
The core stores it, sizes it, versions it and hands it back; it never reads inside it, never
merges it, never validates its contents, and never declares a type for it. The only code that
interprets a slice is that kind's own `Kind.profileData` (§3), engine-owned per architecture N2
and [`06-extensibility.md`](06-extensibility.md) §7. **No kind's type appears in the core** as a
result — not `simulation`'s, and not any later kind's.

**Writing — the third mirror.** After a successful `submitAction` on a profiled session, and on
the same profile-keyed write as the achievement and terminal upserts (§7's `profileId` lock
domain), the store calls `kind.profileData.fold(current, campaign, changes)` with the record's
current `data` (or `undefined`) and that action's `AdvanceResult.changes`. The returned value
replaces `data`, and `dataVersion` is stamped to `kind.profileData.version`. Three outcomes,
and only the first writes:

- **A different value** — written, in `kindId` order, on the same `ProfileStore.save` as the
  other two mirrors.
- **A canonically equal value** — no write. This is what makes `fold`'s idempotence observable
  rather than merely claimed: reapplying a transition the profile already holds produces the
  same bytes, the store skips the save, and no duplicate entry, event, achievement or reward
  can follow from it.
- **A throw, or a result the canonical serializer rejects** (`canonicalStringify`,
  `src/engine/src/core/persistence/canonical.ts` — non-finite numbers, `bigint`, an `undefined`
  in a value position) — refused. The previous `data` is retained untouched and one
  `profile_kind_data_rejected` warning names the kind. `fold` is content-adjacent code and is
  invoked defensively for exactly the reason `resolveSaveEnvelope` already invokes
  `migrateState` defensively.

**Size is validated, and the limit is on the slice.** The canonical serialization of a folded
`data` must not exceed **65 536 bytes**. Over it, the write is refused exactly as a throw is:
prior `data` retained, `profile_kind_data_rejected` warned. The cap is per record rather than
per profile, so one kind cannot starve another; and it is checked on the *write* rather than the
read, so a profile can never become unloadable because a limit tightened. A kind whose slice
approaches this has designed an unbounded accumulator and needs a different shape, not a larger
number.

**Version is validated, and a mismatch degrades.** On load, for each record whose `kindId` is
registered:

- `dataVersion === kind.profileData.version` — used as-is.
- `dataVersion < …` — `kind.profileData.migrate` runs and its result is used. A missing
  `migrate`, a failed one, or one that throws drops the slice for this session and warns
  `profile_kind_data_unreadable`.
- `dataVersion > …` — an older build reading a newer profile. The slice is not read, and the
  same warning is raised.

**A dropped slice is not a deleted one.** The record stays in the profile byte for byte, so the
build that can read it still can; the kind simply starts that session with no cross-game
history, which is the same degradation a missing profile already gets.

**Migration order, and why it is this way round.** The profile's own `formatVersion` migration
runs first, then the per-record `dataVersion` migration. Same reasoning as §10.2's
kind-then-campaign order: the envelope's shape is a precondition for addressing the payload
inside it. The split of *who* runs each is the load-bearing part — `formatVersion` is the
adapter's, because the adapter is what reads the stored document and it needs nothing else;
`dataVersion` is the core session store's, because it needs the kind registry, and a host port
must never hold one.

**Unknown kinds are preserved, never dropped.** A `KindProfileRecord` whose `kindId` names no
kind in this build's registry is carried through load and save unchanged: not migrated, not
sized, not handed to any kind, not counted against anything. `kindId` is typed `string` rather
than `KindId` for exactly this reason — a closed union would make such a record fail shape
validation and condemn the whole profile as `profile_corrupt`. The case is real and
one-directional: a host running a subset of kinds, or an older build, must not erase a player's
progress in a kind it happens not to have.

**Reading — once, at `createSession`, and nowhere else.** When `createSession` is given a
`profileId` and the campaign's kind declares `profileData`, the store loads the profile,
resolves the record for that `kindId`, migrates it, and passes the result as
`NewGameConfig.kindProfileData` (§5) — before the pure engine runs. `resumeSession`, `loadGame`
and `branchSession` **do not** re-seed: the kind already put whatever it kept into `kindState`
at `initialState`, and re-reading a profile that has moved on since would make a resumed session
differ from the one that was saved. An anonymous session reads nothing, so it seeds nothing.

#### Invariants

Each is written to become an assertion. The **session store** maintains P1–P6; P7 and P8 are
obligations on a kind that declares `profileData`, and the store cannot enforce them for it —
which is why they are stated here rather than assumed, and why the kind conformance tests are
where they are checked.

- **P1.** Nothing a profile holds is readable from `advance`, `project`, `scene`,
  `availableActions` or `outcome`. The only route in is `initialState`'s third argument.
  *Enforced by the seam's own shape: no other member is given one.*
- **P2.** `serialize()` output for a session created with `profileId` set and `kindProfileData`
  absent is byte-identical to one created anonymously with the same `NewGameConfig`.
  *Enforced by code, and by the determinism harness (§14).*
- **P3.** A `KindProfileRecord` whose `kindId` is unregistered in this build survives a
  load-modify-save round trip byte-identically. *Enforced by code.*
- **P4.** No `ProfileStore` failure, refused fold, dropped slice, or size rejection changes
  `AdvanceResult`, `GameState`, or whether `submitAction` succeeded. Every one of them surfaces
  as a `ValidationWarning` and nothing else. *Enforced by code — the same guarantee
  `profile_write_failed` has held since W8.*
- **P5.** `PlayerProfile.kindData` holds at most one record per `kindId`, ordered by `kindId`
  ascending, so one profile has exactly one canonical serialization. *Enforced by code.*
- **P6.** A profile write happens only when the folded slice's canonical serialization differs
  from the stored one. *Enforced by code — this is what makes P8 observable.*
- **P7.** `fold` is pure: no I/O, no ambient clock, no randomness, and the same
  `(current, campaign, changes)` always returns the same value. *Enforced by
  `src/engine/eslint.config.js`'s determinism guard for the mechanical half, by instruction for
  the rest.*
- **P8.** `fold` is idempotent: `fold(fold(c, k, ch), k, ch)` is canonically equal to
  `fold(c, k, ch)`. *Enforced by a kind conformance test, and made observable in the store by
  P6 — a non-idempotent fold shows up as a second write with no second action.*

### 7.2 Host Persistence — The Record Store Beneath the Session Store

§7 says the store keeps host metadata "on the store's record" without naming that record as a
type. It is one now, because a host supplies it: the **session store is core-owned** —
locking, stamping, save-envelope assembly and profile upsert all live here — and what a host
may replace is the narrower job of reading and writing the records underneath.

```typescript
/** Host-owned. Deliberately outside GameState, and never replayed. */
interface StoredSessionRecord {
  sessionId: string;
  blob: string;                  // the canonical serialization (§2), never a live object
  audience: ProjectionAudience;
  attemptCounter: number;
  replayCompatible: boolean;
  createdAt: string;             // Clock (06 §5.4), never Date.now
  updatedAt: string;
  profileId?: string;            // §7.1 — round-trips here, never through SaveEnvelope
}

interface StoredSaveRecord {
  saveId: string;
  campaignId: string;            // host-side routing only; the authority is the embedded GameState
  blob: string;                  // a serialized SaveEnvelope (§10.2)
  savedAt: string;               // Clock (06 §5.4), never Date.now — §7.4's sort key and delete precondition
  savedAtSeq: number;
  audience: ProjectionAudience;
  profileId?: string;
}

interface SessionRecordStore {
  get(sessionId: string): Promise<StoredSessionRecord | undefined>;
  put(record: StoredSessionRecord): Promise<void>;
}

interface SaveRecordStore {
  get(saveId: string): Promise<StoredSaveRecord | undefined>;
  put(record: StoredSaveRecord): Promise<void>;
  /** §7.4. Every record this adapter holds for one profile, in any order — the store sorts. */
  listByProfile(profileId: string): Promise<readonly StoredSaveRecord[]>;
  /** §7.4. Conditional: remove `saveId` only while its stored `savedAt` still matches. */
  delete(saveId: string, expectedSavedAt: string): Promise<void>;
}

interface SessionPersistence {
  sessions: SessionRecordStore;
  saves: SaveRecordStore;
}
```

**Omitted → in-memory, which is the MVP default.** The store keeps its own maps either way and
consults `persistence` only on a miss, so a host adapter is a durability layer, not a
replacement for the store's bookkeeping.

**`campaignId` on the save record is host-side routing, nothing more.** A host that lists "your
saves for this campaign" needs it without deserializing every envelope. It is a *copy* of what
the embedded `GameState` already says, and §10.2's cross-checks at load read the embedded value,
not this one — so a divergent copy can misroute a listing but can never load the wrong game.

> **`saveId` is the lookup key on `SaveRecordStore`.** `get(saveId)` and `put(record)` address
> the same record, so an adapter that stores under any other key silently makes every save
> unretrievable — the write succeeds, the read misses, and nothing fails loudly. Stated because
> it is exactly the defect the first adapter shipped with.

**Where `sessionId` and `saveId` come from.** Both are minted by the session layer, and both are
seamed: `RecordIdSource` ([`06-extensibility.md`](06-extensibility.md) §5.7) is supplied on
`SessionHost` and, when present, replaces the layer's own `crypto.randomUUID()` at exactly the
three call sites that mint one — `createSession`, `loadGame`, and `saveGame`. It is a port
separate from `IdSource` (06 §5.1) because these two ids are the ones that never enter
`GameState`: they key the records above, which is host metadata by construction, whereas
`gameId` and `seed` are serialized replay inputs. Omitted, behaviour is byte-identical to the
unseamed minting it replaced — which is what makes it additive rather than a change to §7.

**Failures are `SessionStoreError`, not `CommandResult`.** None of `SessionStore`'s methods
carry an error channel — `SessionHandle`, `SaveHandle` and `Scene` have nowhere to put one — so
these stay exceptions. What they are not is opaque:

```typescript
type SessionStoreErrorCode =
  | "unknown_session" | "unknown_save" | "storage_failure"   // this section
  | "concurrent_modification"                                // this section, below
  | "unknown_campaign" | "invalid_state" | "unknown_kind"    // §12, the kernel's own
  | "save_requires_migration" | "migration_failed";          // §12, the save boundary's

class SessionStoreError extends Error {
  readonly operation: string;
  readonly code: SessionStoreErrorCode;
}
```

Every member is a registered `ReasonCode` (§12) with a shipped `core.reason.*` string, so a
client renders `code` through the string table like any other rejection and never reads
`message`. That is what makes these safe to surface: a demo showing "could not be saved
locally" is rendering `storage_failure`, not string-matching English (09 §3).

**An adapter throwing is `storage_failure`, with exactly one classified exception.** The store
catches whatever a host implementation raises and re-raises `storage_failure`, so a Postgres
timeout and a `localStorage` quota error stay indistinguishable to a client — a client can do
nothing different about either, and a host's own exception type leaking through the store would
put an unbounded vocabulary on the other side of the boundary.

The exception is **`concurrent_modification`**, and it exists because §7's two lock domains stop
at the process edge. Per-`sessionId` locking orders operations *within one store instance*; a
host running several instances over one database has sessions that no lock here serializes, and
that host is the only party positioned to detect the overwrite. It signals one by **branding**
an exception rather than by raising a type of its own:

```typescript
const SESSION_PERSISTENCE_CONFLICT = "SessionPersistenceConflict";

interface SessionPersistenceConflict extends Error {
  readonly name: typeof SESSION_PERSISTENCE_CONFLICT;
}
```

**The brand is a string on `name`, deliberately, and not an `instanceof` check** — a host may
resolve a duplicated copy of this package, across which class identity does not survive.

Two rules bound the carve-out, and they are what keep the paragraph above intact rather than
merely qualified. **The vocabulary stays closed**: one brand, one code, and every other adapter
exception still maps to `storage_failure` with no path by which a host adds a third outcome.
And **a classified failure must be one the caller can act on differently** —
`concurrent_modification` earns its place because "re-read the session and retry" is a real and
different response, which is exactly what a timeout and a quota error do not have. A later code
needs both arguments made here; a brand invented downstream is not a contract.

> **A rejected write must not leave the store ahead of its persistence.** This failure is
> actionable — the shipped `core.reason.concurrent_modification` string tells a player the
> session changed elsewhere and to refresh — so the store's in-memory record must not retain a
> mutation that persistence refused. An operation that mutates a cached record *before*
> persisting it has to restore or evict that record when the write throws. Otherwise the next
> read is served from the cache, returns the un-persisted state, and the retry the message asks
> for cannot succeed. `storage_failure` tolerated this divergence because its own message
> promises only that the game is still playable; `concurrent_modification` does not.

### 7.3 The Campaign Catalog

`listCampaigns` is the only operation a client calls **before a session exists**, and it was the
one operation written as though it could not fail and could not wait. Two consequences followed,
and this section settles both.

```typescript
listCampaigns(profileId?: string): Promise<CampaignCatalog>;
```

**It is asynchronous because a store is not required to hold its campaigns in memory.** The
synchronous signature made that a silent requirement: a `fetch`-backed `SessionStore` could not
satisfy it at all, so the first host to try prefetched every summary at composition time and
closed over them. That works and is not what the contract said — it said a store must already be
a registry before it is a store. Every other query on this interface is already `Promise`-
returning; this one was the outlier, not the norm.

**The result carries the strings, so a catalog is renderable without a session.** `titleKey`
stays a `LocKey` — it is not resolved into the summary — and `CampaignCatalog.strings` is the
table that resolves it. This is `getStrings` (§7) applied one layer earlier, for the same reason
and with the same property: no locale is baked into a returned DTO, and a client never
string-matches English.

**`strings` carries exactly the keys the summaries carry, and nothing else.** It is not the
registry's table. That bound is load-bearing rather than an optimization: the full table holds
every node's authored prose, so shipping it to a visitor choosing a campaign would hand out the
whole of every story before a session began — a spoiler leak dressed as a convenience, and
precisely the reach-past-the-boundary this section exists to close. A catalog that grows a new
`LocKey` grows its table by that key.

**The catalog is titles and progress. It is never content.** No node, no variable schema, no
choice, no achievement definition, no `Campaign.content` in any form. A client that needs those
starts a session.

**Order is the registry's own iteration order**, which registry assembly fixes when it freezes
(§10.1), and this section does not impose a sort on top of it. Two calls against one registry
return the same order; a client that wants a different one applies its own.

#### Progress, and the `profileId` that gates it

`progress` is present on a summary **iff** `listCampaigns` was given a `profileId`, and absent
otherwise — an anonymous catalog reports nothing, matching §7.1's *anonymous by default*. When
present:

- **`discovered`** is the number of distinct `TerminalRecord.terminalId`s the profile holds for
  that `campaignId` (§7.1).
- **`total`** is what `Kind.terminalCount` (§3.2) reports for that campaign. A kind that omits
  `terminalCount` yields **no `progress` object at all** for its campaigns, even with a
  `profileId` supplied — a `discovered` with no denominator is worse than silence, because it
  renders as progress toward an unknown target.

**Counts only. Never ids.** The catalog says *three of seven*, never *which three*, and never
*which seven*. Ending ids are authored content, and a list of them is a table of contents for
endings the player has not found — the projection boundary (§9) applied to a surface that sits
outside any projection. This is the whole of the "hidden ending" protection, and it is
structural: there is no field for an id to travel in.

**A profile is read here and nowhere near resolution.** This is a query on the store, which
already owns the `ProfileStore`; `advance`, `project` and `initialState` are untouched and still
cannot see a profile. That line matters more than it looks: a projection that varied by profile
would no longer be reproducible from `{ seed, actionLog }`, and the determinism harness (§14)
would be asserting something weaker than it claims to. Progress is store-assembled precisely so
that it cannot reach the kind.

**Degradation matches §7.1's.** A missing or corrupt profile yields `discovered: 0` with its
`ProfileWarning` raised through the same path, never a failed catalog. A player cannot be
stopped from browsing campaigns because a progress number could not be read.

#### Migrating callers

**This is a breaking change to the package root, and it is meant to be caught by the compiler.**
`listCampaigns(): CampaignSummary[]` and `listCampaigns(): Promise<CampaignCatalog>` share no
usable call site: an iteration over the old return value does not type-check against a
`Promise`, and awaiting it yields an object rather than an array. Every existing caller —
the text client, the MCP `list_campaigns` tool, and any host — fails to build until it is
updated, which is the intended outcome. A signature that silently accepted the old shape would
leave a caller reading `undefined` at runtime.

The migration is mechanical and is stated so no caller has to derive it:

```typescript
// before
const campaigns = store.listCampaigns();
render(campaigns);

// after
const { campaigns, strings } = await store.listCampaigns(profileId);
render(campaigns, strings);
```

**In-memory stores are unaffected in behaviour**, only in shape: a store that holds its
registry resolves the promise immediately and does no I/O. Asynchrony is what the signature
*permits*, not what it requires.

**The operation count does not change, and the API coverage checklist stays at ten rows.**
`listCampaigns` is still one operation and `list_campaigns` is still its one MCP tool
([`09-clients.md`](09-clients.md) §4). Resolving the catalog's strings *inside* the operation
rather than beside it is what keeps that one-to-one mapping intact — the count is checkable by
counting, and this change leaves the count alone. (§7.4 adds three operations and moves the
count to thirteen; what is stated here — that *this* change left it alone — is unaffected.)

### 7.4 Session Lifecycle — Listing, Branching, Deleting

Three operations a host needs and has had to counterfeit: **list a player's saves**, **branch a
session at a point in its log**, and **delete a save**. Both existing hosts maintain a private
shadow index of saves because `SaveRecordStore` could be addressed only by a `saveId` the host
had to have remembered — a per-host reimplementation of bookkeeping the store already owns,
which is the same argument 06 §5.2 makes for why `SessionStore` is core-owned in the first
place.

One rule decides all three: **a lifecycle operation manipulates records, never state.** None of
them resolves an action, none reaches a `Kind`, and none may perturb `serialize()` output for
any session it does not create. That is why they belong on the store rather than the engine, and
why none of them appears in the replay input `{ seed, actionLog }`.

#### Listing

```typescript
listSaves(profileId: string): Promise<readonly SaveSummary[]>;
```

**`profileId` is required here, unlike `listCampaigns(profileId?)` (§7.3).** An anonymous save
is reachable only by the `saveId` its maker kept (§7.1, *anonymous by default*); there is no
anonymous population to enumerate, so an optional parameter would have to invent one — either
"every save in the store", which is a cross-player leak, or "none", which is a signature that
lies. A caller with no profile does not call this operation.

**Records with no `profileId` are never returned**, and neither are another profile's. The
filter is on the stored `StoredSaveRecord.profileId` (§7.2), the same field `saveGame` writes.

**The order is total, deterministic, and player-meaningful: `savedAt` descending, then `saveId`
ascending.** Newest first is what a save list is for; `saveId` breaks a tie when a host's
`Clock` resolution puts two saves in the same instant. Both keys are on the record, so the store
sorts and the adapter does not — `listByProfile` (§7.2) may return any order at all.

> **`savedAt` is new on `StoredSaveRecord`, and the sort is why.** `savedAtSeq` was the only
> temporal field available and it could not serve: it counts *actions within one session*, so
> two saves from two sessions routinely share a value, and ordering by it is not a total order
> across a player's saves at all. Without a real stamp the tiebreak falls to a random UUID,
> which is deterministic and meaningless — an order no host could show a player, so no host
> could retire its shadow index, so the operation would not do the one job it exists for.
> `StoredSessionRecord` already carries `createdAt`/`updatedAt` on the same reasoning (§7.2);
> this closes an asymmetry rather than opening a new axis.
>
> **It is `Clock`-stamped (06 §5.4), never `Date.now`**, and it lives on the record rather than
> in `GameState` — the §2 rule, unchanged. It cannot reach a replay because nothing in
> resolution reads it.
>
> **Adapter cost, stated rather than discovered.** An adapter that persists the record as an
> opaque blob widens for free. One with an explicit column mapping — Adventures' Postgres store
> is the case in hand — needs a migration that backfills `savedAt` for existing rows. There is
> no correct value to invent for a save taken before the field existed; backfill them to the
> epoch so they sort last, which is honest about the fact that their real time was never
> recorded.

**A summary is metadata, never content.** No blob, no `SaveEnvelope`, no `GameState`, no
`kindState`, and no campaign title. Resolving `campaignId` to a display name is
`listCampaigns` (§7.3), which already carries the `LocKey` and the table that resolves it; a
second string table here would be the projection boundary crossed twice for one string.

**Degradation matches §7.1's.** An adapter that throws surfaces `storage_failure` like any
other (§7.2). A profile that does not exist is not an error — it lists nothing.

#### Deleting

```typescript
deleteSave(profileId: string, saveId: string, expectedSavedAt: string): Promise<void>;
```

**A wrong-profile delete is indistinguishable from a missing save.** Both raise
`unknown_save`, and this is deliberate rather than lazy: a distinct "not yours" code would
confirm that a `saveId` exists to a caller holding no claim on it, which is an existence oracle
over other players' records. One code, no oracle, and a host that wants to log the difference
can — it has both values.

**`expectedSavedAt` is a precondition, not a convenience.** The delete removes `saveId` only
while its stored `savedAt` still equals the value the caller observed; otherwise it removes
nothing and raises `concurrent_modification`. The failure it exists for is the one this unit
names: a player opens a save list, a second writer replaces a record, and the delete authorized
against what the player *saw* would otherwise erase a record they never looked at. The stamp is
returned by both `saveGame` (`SaveHandle.savedAt`) and `listSaves`, so every caller already holds
one and no extra round-trip is needed to obtain it.

**The compare and the delete are one step, not two.** `SaveRecordStore.delete` takes the
expected stamp so an adapter can express it as a conditional statement; the store's own
per-`saveId` lock domain (§7) covers the single-instance case. A host running several instances
over one database is again the only party positioned to detect the overwrite, and signals it the
way §7.2 already established — by branding `SessionPersistenceConflict`, which the store maps to
`concurrent_modification`. **No new brand and no new classified failure**: this reuses the one
carve-out §7.2 opened, and the argument that earned it holds here unchanged, because "re-read
the list and try again" is exactly the different, actionable response.

**A refused delete leaves every record untouched** — not merely the addressed one. An
implementation that removes the record and then discovers the mismatch has already failed the
criterion; the condition is evaluated before anything is removed.

#### Branching

```typescript
branchSession(sessionId: string, atActionCount: number): Promise<SessionHandle>;
```

`atActionCount` is **the number of logged actions the branch retains**, so `0` branches at
creation and `actionLog.length` branches at the present. Valid range is `[0, actionLog.length]`
inclusive; anything outside it raises `invalid_fork_point` and writes nothing. A count is used
rather than a `LoggedAction.seq` because the two coincide only while a log is gap-free, and a
count states the intended meaning — *how much of this game* — without depending on that.

> **There is a working reference implementation, and it is not quite this.**
> [Issue #266](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/266) records
> Adventures forking by replaying a stored log to an `atSeq` and writing a
> `StoredSessionRecord` **straight through `persistence.sessions.put`**, past the store — which
> leaves the store's own in-memory session cache unaware of the session it just created, and
> mints the new id with `randomUUID()` rather than through a port. Both are why this is a store
> operation rather than a documented recipe.
>
> Callers converting from it change one thing: `atSeq: n` becomes `atActionCount: n + 1` for a
> dense log, which every log this engine writes is. Stated because the two signatures accept the
> same type and differ by one — the failure mode is a fork one action short, which replays
> cleanly and is wrong.

**The branch is replayed, not copied.** The store creates a game from the source's
`{ gameId, seed, campaignId, campaignVersion }` and submits the retained prefix through the
ordinary path. Truncating the source's blob would leave `kindState` at the present while the log
claimed the fork point — a state no sequence of actions produces, and one that would serialize
to something replay could never reach.

> **The branch retains the source's `gameId` and mints only a new `sessionId`. This is the
> load-bearing decision of the operation.**
>
> `gameId` is an envelope field (§2) and therefore in `serialize()` output, so minting a new one
> would make "the branch serializes byte-identically through the fork point" false by
> construction — the assertion would have to compare a serialization with `gameId` normalized
> out, which is precisely the normalization 06 §5.1 records the `IdSource` port as having
> removed. Retaining it makes the claim literal, and a literal claim is one a golden file can
> hold.
>
> **What this costs, stated plainly: `gameId` identifies a lineage, not a playthrough.** Two
> live sessions can share one. Nothing in the core is affected — the engine never parses,
> compares, or derives from the value (06 §3) — and the two places that could have been are
> not: the §7.1 profile upsert is idempotent on `(campaignId, achievementId)` and
> `(campaignId, terminalId)`, so a branch re-earning an achievement its parent already recorded
> writes the same row twice and changes nothing; and a replay fixture (07 §2) holds
> `{ config, actionLog }`, which addresses the lineage's inputs and never a session at all.
>
> **The new `sessionId` comes from `RecordIdSource.newSessionId()` (06 §5.7), not `IdSource`.**
> That is the port whose values never enter `GameState`, which is exactly what a branch needs a
> fresh one of. The unit's own wording says `IdSource`; it means this, and the distinction
> matters because minting from `IdSource` is what would have produced the new `gameId` this
> decision rejects.

**The source session and every save it made are untouched** — not re-stamped, not re-serialized,
not re-locked beyond the read. A branch is a new record; it is never a mutation of an old one.

**`profileId` is inherited from the source record**, because a branch is the same player's game.
An anonymous session branches to an anonymous one.

**A session that is not replay-compatible cannot be branched.** A `StoredSessionRecord` with
`replayCompatible: false` has passed through a migrated load (§10.2), and its log is no longer
guaranteed to regenerate its state — which is the entire mechanism a branch depends on. It
raises `invalid_state` and writes nothing. Failing here is the sticky-forward rule doing its
job: the alternative is a branch that silently diverges from the game it claims to continue.

#### Reproducing a stored session from its log

**Reconstructing a session's blob from `{ seed, actionLog }` requires `IdSource.newGameId`
pinned to the original `gameId`.** This is stated because it is the one non-obvious step and
because it has been rediscovered once already: `gameId` is an *input* to the envelope, not a
derived value, so a reconstruction run under a fresh `IdSource` differs from the original in
that field and in nothing else — a difference small enough to be mistaken for a normalization
problem and large enough to fail a byte comparison. 07 §5 named the port for exactly this, and
the runner's counting `IdSource` is the same mechanism applied to fixtures.

The obligation is checkable in both directions, and both belong in the proof: reconstruction
under a pinned `newGameId` is byte-identical to the stored blob, and reconstruction under any
other id is observably different. A test that asserts only the first cannot tell a correct
pinning from an engine that ignores `gameId` altogether.

#### Authorization is host-owned, and `SessionStore` stays caller-agnostic

**`profileId` on these operations is a scoping key, not a credential.** The store treats it as
an assertion already established and never as one it verifies: it has no notion of a caller, no
session token, no tenancy, and no way to distinguish a host passing a profile it authenticated
from one passing a profile it read off a query string. Authenticating a caller and proving the
`profileId` is theirs is the host's job, entirely, on both existing hosts and any future one.

This is 06 §2's rule read the only way it can be. Authorization cannot change `serialize()`
output, so it is outside the determinism boundary and therefore outside the engine — and a
`SessionStore` that grew an identity model would be a store that could refuse a replay, which is
the one thing it must never be able to do.

> **The deferred trigger, named so it is not rediscovered as a gap.** This decision holds while
> every host owns its own front door. It reopens when the hosting/NEaaS layer
> (`SubZeroDev.Platform`) serves *multiple tenants from one store instance*, because at that
> point "the host authenticated this caller" stops being one statement and becomes a claim the
> store is the only party positioned to scope. That is a contract amendment when it arrives, not
> a defect now; it is
> [issue #281](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/281) in
> `90-decisions.md` §2, *Found by the first downstream host*.

#### Error semantics

Every code is a registered `ReasonCode` with a shipped `core.reason.*` string (§12), raised as
`SessionStoreError` (§7.2). One code is new; the rest are the existing vocabulary doing what it
already does.

| Raised by | Code | When | Retryable | Caller does |
|---|---|---|---|---|
| `listSaves` | `storage_failure` | the adapter threw | Yes | retry; the list is not authoritative state |
| `deleteSave` | `unknown_save` | no such `saveId`, **or** it belongs to another profile | No | drop it from the list; it is not the caller's |
| `deleteSave` | `concurrent_modification` | stored `savedAt` ≠ `expectedSavedAt` | Yes, after re-reading | re-run `listSaves` and re-confirm before deleting |
| `deleteSave` | `storage_failure` | the adapter threw | Yes | retry; nothing was removed |
| `branchSession` | `unknown_session` | no such `sessionId` | No | the session is gone |
| `branchSession` | `invalid_fork_point` | `atActionCount` outside `[0, actionLog.length]` | No | **new** — correct the count |
| `branchSession` | `invalid_state` | the source is `replayCompatible: false` | No | branching this lineage is impossible, not delayed |
| `branchSession` | `unknown_campaign` | the source's `campaignVersion` is no longer registered | No | the content was withdrawn (07 §6's `unrunnable`, one layer down) |

`invalid_fork_point` joins `SessionStoreErrorCode` and needs its `core.reason.invalid_fork_point`
string registered with the rest (§12); registry construction rejects an override of it like any
other protected core key.

#### Invariants

Each is written to become an assertion. The **session store** maintains all of them; none is
delegated to an adapter, which is the point of drawing the seam at `SessionPersistence`
(06 §5.2).

- **L1.** `listSaves(p)` returns every `StoredSaveRecord` whose `profileId === p`, and no other
  record. *Enforced by code.*
- **L2.** `listSaves` output is sorted by `savedAt` descending, then `saveId` ascending, and the
  order is total — no two distinct records compare equal. *Enforced by code.*
- **L3.** A `SaveSummary` carries no field that is not on `StoredSaveRecord`, and never `blob`.
  *Enforced by the type; a widening is a contract amendment.*
- **D1.** `deleteSave` removes exactly one record on success and exactly zero on any failure.
  *Enforced by code.*
- **D2.** A `deleteSave` whose `expectedSavedAt` does not match the stored value removes nothing
  and raises `concurrent_modification`. *Enforced by code, and by the persistence conformance
  suite deterministically reproducing the interleaving.*
- **D3.** A `deleteSave` for another profile's `saveId` is indistinguishable in its result from
  one for a `saveId` that does not exist. *Enforced by code.*
- **B1.** For a session `S` and any `n` in `[0, |S.actionLog|]`, the branch produced by
  `branchSession(S, n)` serializes byte-identically to `S` replayed to `n` — `gameId` included,
  because it is retained. At `n = |S.actionLog|` it equals `serialize(S)` exactly, which is the
  cheapest form of the assertion and the one a golden file should hold. *Enforced by code.*
- **B2.** `branchSession` performs no write against the source session's record, and no write of
  any kind on any failure path. *Enforced by code.*
- **B3.** A branch's `sessionId` is distinct from every other session's; its `gameId` equals its
  source's. *Enforced by code.*
- **A1.** No lifecycle operation reads or writes a `Kind`, and none appears in
  `{ seed, actionLog }`. *Enforced by instruction and by the determinism harness (§14) — a
  lifecycle operation that perturbed replay would fail an existing fixture.*
- **A2.** `SessionStore` never verifies a `profileId`. *Enforced by instruction: there is no
  credential parameter for it to verify with, which is the structural half of the guarantee.*

#### The coverage checklist moves to thirteen

`listSaves`, `branchSession` and `deleteSave` are three store operations, so 09 §4's checklist
gains three rows and three MCP tools — `list_saves`, `branch_session`, `delete_save` — and the
one-to-one mapping that makes *"no AI-specific path"* (§13) checkable by counting is preserved
at thirteen. 09 §4 states the rule this follows: a client never works around a missing
operation, and a row added there without an operation here is the signal that logic has leaked
upward. This is the sanctioned direction — the operation first, the row second.

**`@subzerodev/service-contract` is kept in step by a gate, not by discipline.** Its generation
step fails the build when a `SessionStore` method has no corresponding row, so these three
operations produce three rows there or the build stops. That gate is the reason this section can
state a count and be believed — the alternative, a checklist maintained by remembering to
maintain it, is the arrangement 09 §4 already calls checkable *by counting* precisely because
nothing is left to memory.

---

## 8. Randomness

Fully specified and built. The core owns the seeded PCG32 generator
(`src/engine/src/core/determinism/pcg32.ts`, verified bit-identical
to reference vectors) and hands each resolution a **scoped handle** derived from
`(seed, streamId)` via `deriveStream`.

**Randomness is derived, never carried.** `deriveStream(seed, streamId)` is a pure
function: the same pair always yields the same generator, and different `streamId`s are
independent. So a resolution takes a fresh handle, draws from it, and drops it — there
is no generator state to thread through the envelope (§2), and replay needs only
`{ seed, actionLog }`.

```typescript
type StreamId =
  | { kind: "action"; seq: number }
  | { kind: "system"; system: string; seq: number }
  | { kind: "agent"; agentId: string; seq: number }
  | { kind: "tick"; tick: number; system: string };

interface RngHandle {
  nextInt(minInclusive: number, maxInclusive: number): number;
  nextPercent(): number;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly { item: T; weight: number }[]): T;
}
```

`RngHandle` exposes no `toState()`: nothing reads it back. (`Pcg32.toState` remains on
the primitive, for tests and for reference-vector verification.)

**Stream-id encoding is part of the contract.** `deriveStream` hashes a *string*, so the
`StreamId` → string mapping is normative — change it and every seeded outcome changes.
It is exactly:

```text
{ kind:"action", seq }             → `action:${seq}`
{ kind:"system", system, seq }     → `system:${system}:${seq}`
{ kind:"agent",  agentId, seq }    → `agent:${agentId}:${seq}`
{ kind:"tick",   tick, system }    → `tick:${tick}:${system}`
```

Substreams (games/04-engine-specification.md §3.2) mean adding a draw in one place never renumbers another, and
a rival kind's draws never perturb the player's. The MVP uses the `action` stream for
play plus **two** `system` streams; the machinery for more is already there.

| Stream | Derived for | Why it is its own stream |
|---|---|---|
| `action:${seq}` | `submitAction` (§4) | The play spine — one stream per resolution |
| `system:start:0` | `createGame`'s initial `settle` (§4) | A start-of-game draw must not collide with the first action's, which shares `seq: 0` |
| `system:view:${seq}` | the read-only calls — `scene`, `availableActions`, `view` (§6, §9) | A kind that ever drew randomness while *rendering* would otherwise share a stream with the next `submitAction` at the same `seq`, and rendering twice would then change the game |

> **The `view` stream is normative even though nothing draws on it today.** No shipped kind
> takes a random draw during projection, and none should — projection is a narrowing of
> state, not a resolution. But `KindContext` is one type and a read path must supply an `rng`
> handle from somewhere; supplying the action stream's would let an accidental draw during
> rendering silently perturb the next action, which is exactly the class of bug substreams
> exist to make impossible. Giving reads their own stream costs one `StreamId` encoding and
> removes the failure mode by construction. The consequence is that the encoding above is as
> normative as the other two: changing it changes nothing observable today, and would change
> every seeded outcome the day a kind does draw while rendering.

> **What goes in `agent.seq` is normative, and it is not the action seq.** It is the
> *agent's own* draw counter, stored on that agent in `kindState` and incremented per draw.
> Keying it to the action would make an agent's randomness depend on how many actions
> preceded it, which is precisely what a per-agent stream exists to avoid.

> **The `tick` variant is for world-level draws in a kind whose turn advances simulated
> time** — guest spawning, incident rolls, weather. Keying them by `tick` rather than by
> `seq` is what makes a batch of ticks produce the same result as the same ticks taken
> singly; `12-world-graph-kind.md` §5 states the property and why it is
> load-bearing. `system` here names the drawing system, not a `StreamId` variant, so two
> systems drawing on the same tick stay independent.

> **`weightedPick` constrains content.** The built implementation requires every weight
> to be a **positive integer** and throws otherwise. That makes it a load-time content
> rule, not a runtime surprise — Tier 1 validation enforces it (03 §11).

---

## 9. Projection

Clients receive a **projection**, never raw state (architecture §7). The core runs
the mechanism; the kind supplies the narrowing.

```typescript
type ProjectionAudience = "player" | "ai";

interface PlayerView {
  gameId: string;
  status: GameStatus;
  kindView: unknown;             // kind-narrowed — e.g. StoryGraphView (03 §9)
}

// Engine.view(state, audience):
//   kind = kinds[state.kindId]
//   return { gameId, status, kindView: kind.project(state.kindState, audience, ctx) }
```

The core guarantees the envelope's own hidden fields (`seed`, `actionLog`,
`kindState` raw) never reach a client except through `kind.project`, which is
responsible for excluding the kind's hidden state (03 §9 lists the story-graph
exclusions). The `ai` audience is the rival/AI view; widening it is a difficulty
setting, declared and visible (games/04-engine-specification.md §6.1) — never granted by accident.

> **Why `ai` and not `agent`.** "Agent" was doing two incompatible jobs across these
> specs: an *AI player* here, and a *simulated entity* in `StreamId`
> (`{ kind: "agent"; agentId }`, §8) and throughout
> [`12-world-graph-kind.md`](12-world-graph-kind.md), where guests and staff are agents. A
> spatial kind full of autonomous entities made the collision unavoidable, so the audience
> took the new name and `agent` now means exactly one thing: an entity the simulation
> owns. Renamed before any code existed, which is the only cheap time to do it.

### 9.1 The Copy Boundary — the Kernel Owns It

`project` may return values that alias `kindState`, and every shipped kind does. The core
neutralizes that at the boundary rather than asking each kind to avoid it: **every core surface
that carries a `kind.project` result to a caller returns a structural clone of it.** The rule is
the kernel's, applied in one place, and a kind neither implements nor can defeat it.

Two surfaces carry a projection, and the rule binds both:

- `Engine.view(state, audience)`.
- `Scene.view` (§6), built by `Engine.scene(state)`. §6 declares that field to *be* the §9
  projection, so this is the same obligation rather than a parallel one.

Both are declared in `src/engine/src/core/kernel/engine.ts`.

What a caller may rely on: mutating anything reachable from a returned view — nested records and
arrays, to any depth — leaves `GameState`, every later `view()` or `scene()`, `serialize()`
output, and the action log unchanged. What a caller may **not** rely on is object identity. Two
projections of one state are equal and are never the same object, so a client must not use a view
as a cache key or compare views by reference.

**Immutable primitives are not copied, and need not be.** Strings, numbers, booleans, `null` and
`undefined` are values; a copy of one is indistinguishable from it. The rule governs reachable
containers only. `readonly` in a view type is a compile-time annotation this rule does not depend
on and is not enforced by: `WorldGraphView` marks its arrays `readonly` and `StoryGraphView` does
not, and both are equally protected, because neither annotation is what protects them.

**The one obligation this places on a kind:** a `project` result must be plain, structurally
cloneable data — no functions, no class instance whose prototype the view depends on, nothing
that cannot survive the boundary. A kind that returns such a value fails at its first `view()`
rather than silently handing out a live reference, which is the failure mode worth having.

`Engine.availableActions` is outside this rule and needs nothing from it: `AvailableAction` (§6)
is a flat record of primitives and carries no projection.

> **Why the kernel and not the kind.** A kind is the wrong owner for an invariant no kind can be
> checked against. All three alias state while projecting today, and each is locally reasonable —
> a projection legitimately reuses the value it is narrowing. Placing the rule on kinds turns it
> into an instruction every future kind must re-obey with nothing to catch a lapse, and this
> repository has already recorded that exact shape failing twice (`90-decisions.md` — the
> *emitted → registered* gap, and the end-of-week stub register: "a rule with no gate, checked
> only when someone compares the two sets by hand"). At the kernel it holds by construction, for
> kinds that do not exist yet.
>
> The cost is one copy per read, and it is affordable precisely because a projection is narrow by
> construction — this section and each kind's own projection section exist to keep it so.

---

## 10. Content, Saves, Migration

### 10.1 Content Registry

```typescript
interface ContentRegistry {
  readonly campaigns: ReadonlyMap<string, Campaign>;
  readonly strings: ReadonlyMap<LocKey, string>;     // built form — see the authoring boundary below
  readonly resolution?: ResolutionId;                // the pack set this was folded from (11 §4, §6)
}

interface Campaign {
  id: string;
  kindId: KindId;
  version: string;
  titleKey: LocKey;
  content: unknown;              // kind-specific — e.g. StoryGraphCampaign (03 §1)

  /**
   * Migrates a `kindState` forward when *this campaign's own* content ids or shape changed
   * between `fromVersion` and this `version` (§10.2) — a renamed node or achievement id.
   * Optional, for the same reason `Kind.migrateState` (§3) is: most version bumps rename
   * nothing a save references. Runs at the save-load boundary only, after any
   * `Kind.migrateState`, never during `advance`.
   */
  migrateState?(kindState: unknown, fromVersion: string): CommandResult<unknown>;
}
```

> **`resolution` is optional, and the optionality is the contract.** It is present only on a
> registry `resolvePacks` folded from an ordered pack set (11 §4) — `buildContentRegistry`
> knows no packs exist and has none to name. Making it required would mean inventing a digest
> over content that came from no pack, which under 11 §6 would change `campaignVersion` for
> every existing single-campaign registry and therefore the version every existing save
> records. The engine never reads it either way: it is inert identity, not an input.

> **Two `migrateState` functions, two axes.** `Kind.migrateState` (§3) is typed
> `CommandResult<KState>` because a kind knows its own state type; this one is typed
> `CommandResult<unknown>` because a campaign does not — it only remaps ids *inside* a
> state whose shape the kind already fixed. That is also why §10.2 runs them in that order.

> **Content excludes envelope identity.** A kind's `content` (e.g. `StoryGraphCampaign`,
> 03 §1) holds only kind-specific data — it does **not** repeat `id`, `kindId`, `version`,
> or `titleKey`, which live on `Campaign` here. Authored inline strings are lifted into
> `registry.strings` at build time (the authoring boundary below), so `content` carries no
> per-campaign string table at runtime. Same anti-drift rule as `kindState` (§15).

The registry is frozen and pre-validated (§11) before the engine sees it. The engine
performs no I/O; a loader package builds the registry from files (architecture §1).

#### The Authoring → Registry Boundary

"Built from files" is a *typed* step, not a hand-wave. Authors write player-facing text
inline (03 §12); the runtime sees only `LocKey`s. Two types and one pure function make
that a contract:

```typescript
interface AuthoredText { key: LocKey; text: string; }

interface BuiltCampaign {
  campaign: Campaign;                          // runtime form — LocKeys only
  strings: ReadonlyMap<LocKey, string>;        // lifted out of the source
}
```

Each kind declares a **source type** paired with its runtime type — for the flagship,
`StoryGraphCampaignSource` mirrors `StoryGraphCampaign` (03 §1) with every player-facing
field typed `AuthoredText` instead of `LocKey`. A **pure builder** validates the source,
replaces each `AuthoredText` with its key, and returns `BuiltCampaign`. Repeated identical
key/text pairs deduplicate; the same key with *different* text is a hard error.

Registry assembly then validates every built campaign (§11), merges the protected core
strings (§12) with kind and campaign strings, and freezes both maps.

> **Parsing and files live outside the engine.** YAML/JSON decoding and filesystem access
> belong to an outer adapter that feeds `unknown` into source-schema validation. The engine
> package never reads a file — that is what makes "the engine performs no I/O" checkable.
> **The MVP ships one locale, English**; additional locales are post-MVP and need no type
> change, only more string tables.

### 10.2 Save Envelope and Migration

Carried from games/04-engine-specification.md §16. A save wraps the `GameState` envelope with the metadata needed
to load it safely.

```typescript
interface SaveEnvelope {
  saveFormatVersion: number;     // shape of THIS envelope
  serializationVersion: number;  // version of the canonical serializer that wrote `state`
  engineVersion: string;
  kindId: KindId;
  kindVersion: string;           // a kind's code can change independently of the engine
  campaignId: string;
  campaignVersion: string;       // the published version this save was made under
  replayCompatible: boolean;
  checksum: string;
  state: GameState;
}
```

The four version fields exist because the four things they track change independently:
the save wrapper's shape, the serializer, the engine, and a kind's code can each move
without the others. **Compression and host-side metadata (playtime, title, thumbnail) are
deliberately absent** — compression has no consumer yet, and host metadata belongs on the
session-store record (§7), outside the replayable `GameState`, so it can never perturb
byte-identical replay.

**Built during W31** (`SessionStore.saveGame`/`loadGame`, `core/persistence/envelope.ts`),
closing what had been a specified-but-unbuilt mechanism since W3. Not every field gates a
load the same way:

- **`saveFormatVersion` / `serializationVersion` mismatch** fails loudly
  (`save_requires_migration`, §12) — this unit introduces both, so neither has a real
  prior value to migrate from yet; a future unit earns that logic only once one of them
  actually moves.
- **`engineVersion` mismatch** never gates a load by itself — recorded for provenance
  only, per this section's own reasoning that it changes independently of the others.
- **`kindVersion` / `campaignVersion` mismatch** is the actual migration: `Kind.migrateState`
  (§3) runs first for a kind-state shape change, then `Campaign.migrateState` for a
  content-id rename — a shape change is a precondition for content remapping to address
  the right fields. Either axis missing its migration function when a mismatch is present
  fails loudly the same way; a registered migration that itself fails does too
  (`migration_failed`, §12).
- **`checksum` covers `{ state, replayCompatible }`, not the whole envelope.** The scope is
  narrow by design and the remaining fields are protected differently — by cross-checks that
  a checksum could not perform anyway: `campaign.kindId` against the outer `kindId`, and both
  outer ids against the embedded (and therefore checksummed) `GameState`'s own. `state` is in
  scope because it is the thing being protected; `replayCompatible` is in scope because
  nothing else guards it, and flipping a migrated save's `false` back to `true` in the stored
  blob would otherwise silently defeat the sticky-forward rule below. `90-decisions.md`
  records why this is the accepted scope rather than a gap.
- **A successful migration** sets `replayCompatible: false`, sticky forward — once a
  lineage has passed through a migrated load, it never becomes replay-compatible again,
  even across further saves that need no further migration.
- **A migration is idempotent against its own output.** Migrating a save, saving it, and
  migrating again — which is what happens whenever a player loads, plays nothing, and saves,
  or whenever a fixture is regenerated — must reach a canonically identical `kindState`. The
  first pass restamps `campaignVersion` to the campaign's own (`resolveSaveEnvelope`), so the
  second pass finds no mismatch and runs no migration at all; that is *why* it holds, and
  stating the property rather than the mechanism is what makes it testable against a
  migration that mutates in place, accumulates, or appends. `replayCompatible` stays `false`
  through both, which is the sticky-forward rule above doing its work.

**What each axis may do to state, stated as a rule rather than per kind.** `Kind.migrateState`
may change the *shape* of `kindState` — add a field with a default, drop one, retype one. A
campaign migration may only re-address *published content ids* the state references, and drop
or default the references that no longer resolve. Neither may invent play: a migration that
awarded money, advanced a week, or unlocked an achievement would make the same save load
differently depending on which version it passed through, which is the class of defect
`replayCompatible: false` exists to *record* and not to license. A campaign migration that
finds a reference it can neither remap nor drop fails with `migration_failed` rather than
guessing — this is architecture §8's "map old ids forward or fail loudly", said from the
implementation side.

Migration functions are engine-or-content-owned, never a host-supplied port: a port may
supply anything that cannot change `serialize()` output
([`06-extensibility.md`](06-extensibility.md) §6), and remapping old ids is definitionally
a change to it. Proven in `core/persistence/envelope.test.ts` against a synthetic
kind/campaign, not a real campaign republish — every shipped campaign is still at
`1.0.0`, so there is nothing real to migrate from yet either (`plans/38-save-migration-programme.md`).

> **`saveFormatVersion` vs `GameState.formatVersion` — different things.**
> `saveFormatVersion` versions *this wrapper*; `GameState.formatVersion` (§2) versions the
> **envelope inside it**. They are separate because `Engine.serialize` / `deserialize`
> round-trip a bare `GameState` with no wrapper at all (§4) — the determinism harness
> (§14) and the golden files compare exactly that string. Without its own stamp, a
> standalone serialized envelope would carry no version information. Both move
> independently; a loader reading a `SaveEnvelope` checks both.

**The migration hazard, made concrete (architecture §8).** A save records the
`campaignVersion` it ran. Loading it against a *different* published version runs
migration, which must map old ids forward (a story-graph node id that was renamed) or
**fail loudly** — never strand the player on content that no longer exists. A migrated
save is `replayCompatible: false`: its action log can no longer be guaranteed to
regenerate its history, because the rules changed.

### 10.3 Why Not Event Sourcing

The design carries an action log, deterministic replay, and byte-identical state — the
ingredients of event sourcing. It stops deliberately short of adopting it as the
**persistence model**.

Pure event sourcing makes current state a *derived projection*: `state = replay(log)`,
and you persist the log, not the state. That collides head-on with the migration rule
above. A migrated save is **not** replay-compatible — its log can no longer regenerate
its state across a rule change — so under pure event sourcing a migrated save would be
unloadable. Instead the core persists *current state* (the envelope) **and** keeps
the log: you get event sourcing's benefits where they pay off — the determinism harness
(§14) and bug reproduction replay from `{ seed, actionLog }` within one version — without
its cost, which is loads that break the moment the rules move. This hybrid is a choice,
not a gap.

---

## 11. Tiered Validation

Every campaign is validated before the registry is frozen. The core runs the
tiers; the kind supplies the checks via `validateCampaign`.

```typescript
interface ValidationResult {
  ok: boolean;                   // false iff any Tier-1 error
  errors: ValidationError[];     // Tier 1 — hard fail
  warnings: ValidationWarning[]; // Tier 2 — load but flag
}

interface ValidationError {
  code: ReasonCode;
  messageKey: LocKey;
  path?: string;                 // where in the campaign
  details?: Readonly<Record<string, string | number>>;
}
interface ValidationWarning { code: ReasonCode; messageKey: LocKey; path?: string; }
```

- **Tier 1 — load-time, hard fail:** referential integrity, schema conformance, declared
  variables, path validity, duplicate ids, missing string keys. (Story-graph's Tier 1 is
  03 §11.)
- **Tier 2 — load-time, warning:** unreachable content, unexpected cycles, and
  `no_reachable_choice` — a campaign that settles straight to an ending with no choice
  node reachable from the start. It loads and plays (§3, `InitialStateResult.status` reports
  `"ended"` immediately); the warning tells an author their campaign is non-interactive
  without forbidding a deliberate vignette or a single-scene test fixture.
- **Tier 3 — simulation-time:** unwinnable campaigns, dead-end states — found by
  running, not reading. **Not part of load**, and not part of §14 either: the determinism
  harness compares a build against itself and cannot answer whether an ending is reachable.
  Tier 3 is an **author-facing check run out of band** — `npm run validate-campaign` in the
  engine package, tooling rather than shipped engine code (architecture §9.2).

  Its one contractual property is what a *clean* result means. The search is bounded by
  construction — an explored-state cap, a turn-depth cap, and the same settle-step cap the
  real engine enforces — so it reports `bounded` whenever any cap was reached anywhere. **A
  bounded result means "not proven", never "passed."** A caller that reads the two as the
  same thing gets a guarantee the checker never offered: it declines to credit an ending
  found exactly at a cap, precisely so it never claims to have explored more than it did.

Why tiered: "the engine validates AI-authored content" (architecture §9) is only a
safety property once you say *what validation is* and *what is decidable when*. AI output
is data; all data goes through the same tiers, whatever produced it.

#### Which string table validation checks against

Two of this section's requirements look like they need each other's output. Every campaign
must be validated *before* the registry is frozen (above), and §12 requires that a registered
reason code with no localized message fails validation — but the final merged string table on
`ContentRegistry` is a *product* of registry assembly (§10.1), which runs after validation
clears. Read literally, neither could go first.

They are not in conflict, because "a `LocKey` resolves" is scoped per campaign, not against
the merged table:

- **A campaign's own `LocKey`s** — `titleKey`, and everything `Kind.validateCampaign` reaches
  inside `content` — are checked against **that campaign's built string table**, the
  `BuiltCampaign.strings` the authoring builder lifted out of its source (§10.1). That table
  is complete for the campaign by construction: a key it authored but did not lift cannot
  exist. Merging adds other campaigns' keys, which this campaign has no business referencing
  anyway, so the merged table would not make the check stricter — only later.
- **Reason-code messages** are checked against **the declaring kind's own message table**,
  once per kind rather than once per campaign, and against the core's shipped
  `core.reason.*` set for the base codes. A kind therefore fails registry construction for a
  gap in its own vocabulary before its messages ever reach the merge.

So the ordering is: validate each campaign against its own strings and each used kind against
its own messages; only then assemble, merging core, kind and campaign strings and freezing
both maps. `buildValidatedContentRegistry`
(`src/engine/src/core/validation/tiered.ts`) is the sanctioned entry point that runs them in
that order, and it threads each used kind's messages into assembly so the frozen table
carries them.

For a pack set rather than a single campaign batch, `buildValidatedPackRegistry(packs:
readonly ContentPack[], kinds: KindRegistry): CommandResult<ContentRegistry>` (same file) is
the sanctioned entry point (11 §3, W76): it runs `resolvePacks` (§7 below) to fold the set,
then this same validate-and-assemble sequence against the folded campaigns and string table,
and reattaches the fold's `resolution` id — neither stage alone can produce a validated,
`resolution`-stamped registry. It is exported from the package root alongside
`buildValidatedContentRegistry`.

> **This is a clarification of scope, not a weakening.** Nothing here permits an unresolved
> key into a frozen registry. The merged table is a superset of every per-campaign table plus
> the core's and the kinds' own, so a key that resolves in the narrower table resolves in the
> wider one; checking early is strictly earlier, not looser. What it does rule out is a
> campaign silently depending on a *different* campaign's authored string — which the merged
> table would have let through, and which is a real drift surface, since pack resolution
> (11 §6) can change what else is in that table without this campaign changing at all.

---

## 12. Reason Codes, State Changes, Messages

Kind-agnostic base vocabulary; kinds extend it (`Kind.reasonCodes`). Clients never
string-match English (games/04-engine-specification.md §2.3).

```typescript
type LocKey = string;            // key into the string table; stable, additive, never renamed
type ReasonCode = string;        // stable, machine-readable; additive, never renamed

const BASE_REASON_CODES = [
  // the original seven — the kind-agnostic play vocabulary
  "action_not_available", "unknown_action", "requirement_unmet",
  "session_ended", "read_only_field", "check_succeeded", "check_failed",
  // the pure engine kernel: createGame / submitAction / deserialize rejections
  "unknown_campaign", "unknown_kind", "invalid_state",
  // registry assembly (§10.1)
  "string_conflict", "protected_string_key", "duplicate_campaign_id",
  // the core's own Tier-1 checks (§11, §17)
  "invalid_identifier", "invalid_loc_key", "missing_string_key",
  "missing_kind_reason_message",
  // the profile store (§7.1) — mirrors ProfileWarningCode
  "profile_missing", "profile_corrupt", "profile_write_failed",
  "profile_kind_data_unreadable", "profile_kind_data_rejected",
  // the save-load boundary (§10.2)
  "save_requires_migration", "migration_failed",
  // host persistence (§7.2)
  "unknown_session", "unknown_save", "storage_failure", "concurrent_modification",
  // session lifecycle (§7.4)
  "invalid_fork_point",
  // the audit vocabulary — a `StateChange.reason`, not a rejection (below)
  "achievement_unlocked",
  // content-pack resolution (11 §7) — `resolvePacks`, `registry/packs.ts`
  "pack_kind_mismatch", "duplicate_campaign_id_in_pack", "pack_dependency_missing",
  "pack_dependency_version_conflict", "pack_dependency_cycle", "pack_override_unexpected",
] as const;
```

> **The base set grows; it was never fixed at the MVP.** The original seven were the
> vocabulary one *turn* needs. Everything after them was added by a unit that found a
> cross-kind failure mode with no code that fitted — the kernel's three rejections, registry
> assembly's three, the core's own Tier-1 four, the profile store's five, the save
> boundary's two, host persistence's four, session lifecycle's one, the audit vocabulary's
> one, and content-pack resolution's six. That is the intended shape: a code is registered when a real caller
> produces it, not pre-declared from this list. Because `ReasonCode` is *additive, never
> renamed* (above), growth costs nothing — a client switching on a code it has never seen
> falls through to the localized message, which the core ships for every base code. Expect
> this list to keep growing, and keep it in step with
> `src/engine/src/core/kernel/reasons.ts`, which is where the shipped set and its messages
> actually live.

**The core ships their strings.** Every base code has a default-English message under a
**reserved `core.reason.*` namespace** (`core.reason.unknown_action`, …), shipped with the
engine. Registry construction (§10.1) merges core strings with kind and campaign strings
and **rejects any attempt to write into `core.reason.*`** — a campaign cannot restyle what
an engine-level error says, because clients and tooling depend on those meanings being
stable. Kinds own the strings for codes *they* add (`Kind.reasonCodes`); campaigns own
their narrative strings. **Validation fails if any registered reason code has no localized
message** — that is what makes "clients never string-match English" enforceable rather than
aspirational.

```typescript

interface StateChange {
  path: string;                  // audit record, not a write path (games/04-engine-specification.md §10.4)
  op: "set" | "increment" | "decrement";
  value: string | number | boolean;
  previous?: string | number | boolean;
  reason: ReasonCode;
  visible: boolean;
}

interface OutcomeMessage {
  key: LocKey;
  params?: Readonly<Record<string, string | number>>;
  tone?: "neutral" | "positive" | "negative" | "absurd";
  visible: boolean;
}

interface CommandResult<T> { ok: boolean; value?: T; errors: ValidationError[]; warnings: ValidationWarning[]; }
interface ActionResult extends CommandResult<GameState> { changes: StateChange[]; messages: OutcomeMessage[]; }
```

`StateChange` is an **audit record emitted by typed reducers**, never the mutation
mechanism — the discipline the simulation kind arrived at (games/04-engine-specification.md §10.4). It feeds
history and the transparency requirement; `visible` gates what a client may show.

> **`StateChange` is not logging.** It is a domain record: localized, returned in
> `AdvanceResult`, persisted by what the store keeps, and shown to players. Operational
> logging and tracing is a **separate channel** that is emitted to a sink, never returned,
> never localized, and free to be discarded entirely with no behavioural difference —
> [`05-observability.md`](05-observability.md) §1 draws the line and §2 explains why
> merging the two would break determinism.

**Two `StateChange` shapes are conventions this platform invented rather than derived from
the ancestor**, both real in code and load-bearing before either was written down here —
[`03-story-graph-kind.md`](03-story-graph-kind.md) §7's `achievement_unlocked` and §5's
`consequence_applied`. Restated exactly as the code emits them, kind-agnostic in structure
even though the two examples are both story-graph's:

```typescript
// An achievement unlock (03 §7). The path reuses the condition-field name (§18) an
// `achieved.<id>` check already reads, so unlocking and querying agree on one name.
{ path: `achieved.${achievementId}`, op: "set", value: true,
  reason: "achievement_unlocked", visible: true }

// A variable write from resolving consequences (03 §5). One coalesced change per
// touched variable per batch, not one per typed op — `op` is always "set" regardless of
// which increment/decrement/set operations actually ran, because 03 §5's clamp-after-
// all-effects rule means an intermediate op has no individually meaningful audit value.
// `previous` is the pre-batch value; `visible` mirrors the variable's own declaration.
{ path: `var.${name}`, op: "set", value: <final value>, previous: <pre-batch value>,
  reason: "consequence_applied", visible: <declaration's own `visible`> }
```

Both are conventions, not requirements — a future kind may need a different shape for an
analogous concept, provided it documents that shape here the same way. What they fix is the
*pattern*: an audit record's `path` names the thing that changed using the same string a
`Condition` would read to check it, and `reason` identifies *why* using a stable code a
kind-agnostic session store (or a client) can switch on without string-matching prose.

> **A `StateChange.reason` is a registered `ReasonCode` like any other, and both of these
> are registered.** `StateChange.reason` is typed `ReasonCode`, and `visible` gates client
> display — so an audit record can reach a client exactly the way a rejection can, and owes
> a resolvable message for the same reason. Neither of the two above had one until
> reconciliation registered them, which is why this is now stated rather than assumed:
> `achievement_unlocked` is **base** vocabulary (`core.reason.achievement_unlocked`) because
> the session store's profile upsert (§7.1) switches on it without knowing which kind
> emitted it, while `consequence_applied` is **kind-owned**
> (`story-graph.reason.consequence_applied`, `src/engine/src/kinds/story-graph/reasons.ts`) because only
> that kind has a consequence. A kind inventing a third audit reason registers it the same
> way; there is no separate audit namespace exempt from §12's completeness rule.

**Kind-owned reason codes carry their own `messageKey` namespace, distinct from event
names.** A kind's `Kind.reasonCodes` need a localized message the same way the base set
does (above), and the convention is `<kindId>.reason.<code>` — no `kind.` wrapper, unlike
[`05-observability.md`](05-observability.md) §9's *event* namespace,
`kind.<kindId>.<event>`. The two are easy to conflate because they differ only by one
segment, which is exactly why this needs stating rather than assuming: a reason-code
message key and an event name are different vocabularies serving different consumers
(one renders to a player, one traces a resolution), and neither is a namespace *for* the
other. `story-graph.reason.unknown_condition_field`
(`src/engine/src/kinds/story-graph/reasons.ts`) is the shipping example — a code this kind adds for a
condition-evaluation failure with no analogue in the base set, so it has no home but a
kind-owned namespace.

---

## 13. The MCP Surface

The tool table itself — args, returns, one tool per session-store operation — moved to
[`SubZeroDev.ServiceContract`](https://github.com/The-Running-Dev/SubZeroDev.ServiceContract)'s
[`mcp-tool-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.ServiceContract/blob/main/mcp-tool-contract.md):
it's a hosting-facing contract, not core engine material, even though `McpTools` (implemented
in `src/engine/src/mcp/server.ts`; see [Engine Package](/docs/guide/engine-package)) wraps this
repo's own session store (§7) with no runtime
dependency, tested end to end against it (`TODO.md` W17). Architecture §10 still holds:
no game logic in the adapter, no AI-specific path.

---

## 14. Determinism Harness

The acceptance test with teeth (MVP §5, games/04-engine-specification.md §18.4): a `{ config, actionLog }`
fixture replays to a **byte-identical** `serialize()`.

```typescript
interface PlaythroughFixture {
  name: string;
  config: NewGameConfig;         // includes a fixed seed
  actionLog: LoggedAction[];
}

// runner: createGame(config) → for each logged action, submitAction → serialize final state
```

- **Golden files** — committed fixtures with expected `serialize()` output; a one-byte
  diff catches an unintended behaviour change across the whole engine.
- **Property tests** — N random seeds, each run twice, outputs compared; catches
  non-determinism on paths no fixture touches.
- **Sink independence** — every fixture replays twice, once with `nullEmitter` and once
  with `createRecordingEmitter()`, and both `serialize()` outputs must be byte-identical. This is
  what makes observability ([`05-observability.md`](05-observability.md) §2) safe to have
  inside a deterministic core: it catches a kind that branches on emission, which no
  state-only golden file would notice.
- **Stream reproducibility** — the same fixture under `createRecordingEmitter()` twice yields the
  identical event sequence, so the event stream is itself a golden-fileable artifact
  (05 §5).

Canonical serialization (§10, built) and seeded RNG (§8, built and reference-verified)
are the two properties that make byte-identical achievable at all.

> **This harness compares a build against itself.** It cannot answer *did this change alter
> a game that already exists* — a change that alters every game identically is perfectly
> deterministic and runs green here. That question needs a different comparison, against a
> *previous* build, and a projection that survives an intended serialization change.
> [`07-replay.md`](07-replay.md) specifies it.

---

## 15. How the Story-Graph Kind Plugs In

Concrete mapping — and the reconciliation this document forces on
[`03-story-graph-kind.md`](03-story-graph-kind.md).

| Core concept | Story-graph realization |
|---|---|
| `GameState.kindState` | `StoryGraphKindState` — current node, variables, turn, visit counts, unlocked achievements, ending id |
| `Kind.advance(actionId)` | `submitChoice → settle` (03 §8.2); `actionId` is the choice id |
| `AvailableAction` | a node choice, gated by `showWhen` / `requirements` (03 §4) |
| `SceneBody` | the node's `textKey`, interpolated (03 §3.1) |
| `Kind.project` | `StoryGraphView` (03 §9) — turn, visible stats, unlocked achievements, ending; hides non-visible variables and visit counts. Scene text and choices are the generic `Scene`, not repeated here |
| `Kind.validateCampaign` | 03 §11 |
| `Kind.outcome` | 03 §8.5 — `terminalId` is the `endingId`; `terminal` is "settled onto an `EndingNode`" (§3.2) |
| `Kind.terminalCount` | 03 §8.5 — distinct `endingId`s across the campaign's `EndingNode`s; the denominator in `CampaignProgress` (§7.3) |
| `RngHandle.weightedPick` | random-transition node resolution (03 §3) |

> **Reconciliation (done in 03).** Writing this seam exposed that `03`'s state
> duplicated envelope-owned fields — `version`, `campaignId`, `campaignVersion`, `seed`,
> `status`, and the choice log. Those belong to the `GameState` envelope (§2),
> not the kind. `03` §8.1 now defines `StoryGraphKindState` as the kind-specific subset
> only:
>
> ```typescript
> interface StoryGraphKindState {
>   currentNodeId: string;
>   variables: Record<string, VarValue>;
>   turn: number;                        // kind-maintained (settle advances it)
>   visitedCounts: Record<string, number>;
>   unlockedAchievements: string[];
>   endingId?: string;
> }
> ```
>
> The choice log becomes the envelope's generic `actionLog`; `turn` stays on the kind
> because a "turn" is kind-specific (a node transition here, a week in the simulation
> kind).

---

## 16. What This Unblocks

With the seam typed and every MVP-blocking gap decided
([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §1), the build runs against real contracts:

1. The pure `Engine` (§4) — `createGame`, `submitAction`, `scene`, `view`, serialize.
2. The `SessionStore` (§7) and the `ProfileStore` beside it (§7.1).
3. The registry and its authoring builder (§10.1).
4. The story-graph `Kind` implementation (§3, §15) against
   [`03-story-graph-kind.md`](03-story-graph-kind.md).
5. The determinism harness (§14) — now that fixtures have a type.
6. The MCP server (§13) and text client — thin adapters over `SessionStore`.

Nothing above is speculative: every type here is exercised by the MVP
([`MVP.md`](MVP.md)). [`TODO.md`](TODO.md) sequences it as units of work W0–W19.

---

## 17. Identifier Conventions

One fixed shape for every id, so validation, tooling, debugging, and authoring can rely
on it. A peer-review recommendation, adopted before content scales.

| Kind of id | Shape | Example |
|---|---|---|
| Campaign | `kebab-case` | `bulgaria-bureaucracy` |
| Node | `snake_case` | `government_office` |
| Choice | `snake_case`, unique within its node | `begin_again` |
| Variable | `snake_case` | `office_visits` |
| Achievement | `snake_case` | `it_builds_character` |
| Ending | `snake_case` | `it_builds_character` |
| `LocKey` (localization) | dotted, `type.id[.field]` | `event.pipe_disaster.title`, `choice.wait`, `stat.money` |
| Reason code | `snake_case` verb/state | `requirement_unmet` |

Rules: ids are stable once published (a rename is a migration, §10.2); ids are ASCII
`[a-z0-9_-]` only; `LocKey`s namespace by content type so string tables stay navigable.
Tier-1 validation (§11) enforces the character set and uniqueness.

## 18. Frozen Primitives

Two shared primitives are held **deliberately small**, because these are the surfaces
that grow without bound if left open (a peer-review caution taken up-front).

**The Condition operator set is closed.** The comparison operators
(`equals`, `not_equals`, `less_than`, `less_or_equal`, `greater_than`, `greater_or_equal`,
`in`, `not_in`, `contains`, `has_tag`, `has_flag`) plus the tree combinators
(`all`/`any`/`not`) and quantifiers (`exists`/`count`) are the whole surface — shared with
the simulation kind (games/04-engine-specification.md §13.1). Tempting additions — `between`, `matches`,
arithmetic, `inventory()` / `relationship()` / `distance()` helpers, nested expressions —
are **out** unless a concrete campaign need justifies each one individually. Every
operator is permanent maintenance: a new one must be validated, evaluated, projected,
migrated, and taught to every tool. The bar to add is high on purpose.

The shape itself, as ported into this repository (`core/condition/types.ts`):

```typescript
type ComparisonOperator =
  "equals" | "not_equals" | "less_than" | "less_or_equal" |
  "greater_than" | "greater_or_equal" | "in" | "not_in" | "contains" |
  "has_tag" | "has_flag";

// `value` is optional: `not_equals` against an absent field is authored as `value: undefined`,
// and `JSON.stringify` drops an undefined-valued key, so the wire document never carries it.
interface ComparisonCondition { field: string; operator: ComparisonOperator; value?: unknown; }
interface AllCondition { all: Condition[]; }
interface AnyCondition { any: Condition[]; }
interface NotCondition { not: Condition; }
interface ExistsCondition { exists: { collection: string; where: Condition }; }

// count's own comparison is always two numbers (a match total against `value`) — only
// the six ordering/equality operators, never the array/string-shaped ones, which would
// type-check but always throw at evaluation.
type CountComparisonOperator =
  "equals" | "not_equals" | "less_than" | "less_or_equal" | "greater_than" | "greater_or_equal";
interface CountCondition {
  count: { collection: string; where: Condition };
  operator: CountComparisonOperator;
  value: number;
}

type Condition =
  ComparisonCondition | AllCondition | AnyCondition | NotCondition |
  ExistsCondition | CountCondition;

// What a caller supplies to the evaluator, which knows nothing itself about `var.*`,
// story nodes, or any other kind's field vocabulary.
interface ConditionResolver {
  field(path: string): unknown;
  collection(name: string): readonly ConditionResolver[];
}
```

**One field of the ancestor's shape did not port.** `games/04-engine-specification.md`
§13.1's `Condition` also carries a `CollectionSelector` — a closed union of
simulation-kind paths (`player.inventory`, `world.npcs`, …). None of those are
kind-agnostic, so `collection` here is a plain `string`, and which strings are legal is
entirely up to whichever kind resolves them (`kinds/story-graph/conditions.ts` for the one
kind that exists today). The ancestor citation above stays as provenance — per
`CLAUDE.md`, every `games/…` citation is provenance, not a second authority — but this
section, not that document, is now where the shape itself lives.

**Reason codes are additive, never renamed** (§12) — saves and replay logs reference
them, so a rename breaks old data.
## 19. Published Narrative Authoring

The package root is the runtime contract. `@the-running-dev/game-engine/authoring` is the
separate author-time contract for repositories that own campaign source. It exports the
generic campaign builder, the story-graph source builder, the simulation source builder with
its content-definition source types, the shared adventure builder with its source factory and
its migration helper, portable serialization and manifest digests, and replay-runner
types/functions. It is deliberately a subpath: a runtime host must not import authored
campaign source merely to play published portable JSON.

A kind's export split follows one rule regardless of which kind it is: the builder and its
source types are author-time and belong on `/authoring`; the campaign, state, view and outcome
types are what a runtime host compiles against and belong at the root
(design/30-slices.md, W88). `buildWorldGraphCampaign`'s root placement predates the subpath
and is an exception noted here rather than moved.

`SubZeroDev.Adventures.Content` owns the canonical source and publication of narrative
campaigns. GameEngine owns kinds, validation, portable hydration and authoring primitives.
GameEngine may retain a frozen campaign solely as a regression fixture; such a fixture is not
published and not listed in a manifest. Frozen fixtures left the package root in the breaking
0.9.0 release (design/30-slices.md, W74c), which has shipped — `src/engine/package.json` reads
`0.10.0`. That peg moved once before it landed: this section originally named 0.8.0 as the
breaking release, and 0.8.0 was then spent on an additive one. A version reserved by this
section is a name to check against `src/engine/package.json` before a bump, not after.

A third category is sanctioned and is neither of the two above: **a kind's own reference
campaign** — engine-owned content that exists to make the kind registrable and exercisable,
never authored by Content and never a frozen fixture — is a package-root export. The instance is
`buildWorldGraphMvpCampaign` / `WORLD_GRAPH_MVP_CAMPAIGN_ID`, the only content a host can
register the `world-graph` kind against. The line that keeps this from swallowing the rule: the
root publishes no *narrative* campaign, which is the claim `src/engine/src/authoring.test.ts`
enforces in both directions. A second kind adding a reference campaign to the root follows this
sentence; a second reference campaign for one kind does not, and wants its own decision.

Portable campaign documents remain format version 2. `toPortable` and
`digestManifestResolution` are public only through `/authoring`; `fromPortable` remains a
runtime-root export. `digestPortableCampaign` is exported from both surfaces: the root, for
hosts verifying fetched content, and `/authoring`, for authoring pipelines digesting campaign
source before publication.

**`PortableCampaignBody`'s simulation arm gains an optional `migration`, and the format version
does not move.** Until now `migration` existed only on the story-graph arm, which
`src/engine/src/portable/format.ts` documented as a structural fact rather than an omission —
correct while `migrateFromContent` was the only reattachable migration there was. It is not a
structural fact about the *format*; it was one about how many kinds had a declarative migration
written, and the simulation kind now has one
([`10-simulation-kind.md`](10-simulation-kind.md) §16). `toPortable`'s throw narrows
accordingly: it still refuses a migration for `world-graph`, which has none.

The version stays at `2` because the change is additive **and its silent-loss case cannot
happen**. A `2` reader handed a document carrying a simulation `migration` ignores the member
and attaches no `migrateState` — which matters only when `campaignVersion` actually moved, and
that is precisely when `resolveSaveEnvelope` rejects the load with `save_requires_migration`
(§10.2). The old reader fails loudly at the exact moment the dropped field would have mattered,
so bumping to `3` would buy a louder failure for documents that load correctly and nothing for
the ones that do not. `formatVersion` is a literal type, so a bump also breaks every reader
including the ones that would have been fine.

---

## 20. The Ordered System Pipeline

Two kinds resolve a turn by running an ordered list of systems: `simulation`'s end-of-week pass
([`10-simulation-kind.md`](10-simulation-kind.md) §3) and `world-graph`'s tick
([`12-world-graph-kind.md`](12-world-graph-kind.md) §4.1). **Those orders are normative and are
owned there, not here.** This section owns only the *substrate* they run on: what applying an
ordered list means, and what doing so must never do.

The substrate is engine-internal. It is exported from neither the package root nor `/authoring`,
and no host supplies, replaces, wraps, or observes one — a pipeline sits inside the determinism
boundary, which by [`06-extensibility.md`](06-extensibility.md) §2 is the same line as the trust
boundary.

**It is a fold over an explicit list, and nothing more.**

- **Order is the caller's, verbatim.** The substrate applies entries in exactly the order given.
  It never sorts, filters, deduplicates, reorders, or skips, and it holds no registry of systems
  and no opinion about which belong. A caller that supplies a list is the sole authority on its
  contents — which is what lets the two normative orders stay owned by their kinds while the
  mechanism is shared.
- **Every entry runs, every time.** There is no short-circuit and no early exit. A terminal or
  failed result is a value carried in the frame, never a control-flow signal; §4.1's rule that "a
  terminal result does not interrupt the tick" is a *consequence* of this, not an exception to
  it. Where a turn stops early it stops in the caller's own loop around the substrate, never
  inside it.
- **Each entry is a total function from frame to frame,** and the substrate threads each returned
  frame to the next entry. No entry observes a frame from anything but its immediate predecessor,
  and the substrate never inspects, merges, or reconstructs one. The frame type belongs to the
  caller; the substrate is generic over it and reads no field of it.
- **The substrate emits nothing.** It holds no `Emitter`, draws no randomness, and reads no
  clock. Every event a turn produces is emitted by a system — and per-system trace events are no
  exception. Where a kind wants one, the entry's own `run` closes over the system and the
  emission together, at the point the list is built. `simulation` does this for
  `kind.simulation.system.ran`, which its §11 keeps because a stream naming each system in order
  localizes an ordering regression to the phase that moved; `world-graph` declares no such event
  and wraps nothing. Both are the same substrate, with no flag distinguishing them.
- **It never catches.** A system that throws propagates to the caller, with no partial commit and
  no substitute frame. A throw is an engine defect rather than a game outcome — both existing
  pipelines already rely on this, in `world-graph`'s per-entry `processingTick` guard and its
  finalize-once assertion, and in the dangling-id lookups both kinds share — and catching one
  would convert a wrong state into a state that still serializes. No reason code covers it, and
  introducing one would be the mistake.

> **Why the substrate is emission-free rather than emitting per system.** The two callers
> disagree today, and both are right: `simulation`'s runner emits one trace event per system,
> `world-graph`'s loop emits none and lets each system speak for itself. A substrate that always
> emitted would add twenty events to every world-graph tick; one that never emitted would delete
> the `system.ran` stream its §11 relies on. Moving the emission into the list entry settles it
> without a flag — the substrate stays a pure fold, each kind's event stream stays byte-identical
> to what it produces now, and *which events a turn emits* remains a question about systems
> rather than about the machinery that runs them.

The substrate is declared in `src/engine/src/core/pipeline/systems.ts`: `SystemEntry<Frame>`, an
`id` the substrate never reads plus a frame-to-frame `run`, and `runSystems`, the fold itself.

**What this section does not settle.** Whether a given kind's systems are *shaped* to run on this
substrate is that kind's own internal matter, constrained by the rules above and by nothing else
here. Both shipped tick-driven kinds now are, by different routes. `world-graph` already had the
shape — one `(frame) => frame` type and a declared id list — and keeps its per-entry
`processingTick` guard by wrapping the list handed to it, since the substrate may read no field of
the frame. `simulation` had none of it — fifteen bespoke signatures, no frame type, and a
`missedCents` handoff from `housing` into `finance_reconcile` — and gained an `EndOfWeekFrame` that
carries that handoff explicitly, with each entry pre-wrapped to emit its own
`kind.simulation.system.ran`. Both reshapes were constrained to leave resolution behaviour,
ordering, and the event stream unchanged, which `src/engine/src/campaigns/pipeline-equivalence.test.ts`
holds against the committed replay corpus.
<!-- human-doc:end -->

<!-- human-doc:start path="engine/03-story-graph-kind.md" -->
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
     → return ValidationError with the reason (§8.3), no state change, and a
       player-facing `messages` entry built from the same messageKey (§3)
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
localized message or registry validation fails (04 §12). They divide by *when they are
checked*, and the division matters because the two halves reach different audiences:

**Resolution codes — checked at advance time, reported to the player.** These ride out on a
rejected `AdvanceResult.error` during a turn.

| Code | When |
|---|---|
| `not_a_choice_node` | an action arrived while the current node is not a `ChoiceNode` — should be unreachable after settle |
| `unexpected_params` | a non-empty `params` object; this kind declares none |
| `settle_guard_tripped` | `SETTLE_STEPS` exceeded — an auto/random cycle with no exit (§8.2) |

**Validation codes — checked at registry build time, reported to the author.** These are
this kind's own `validateCampaign` findings (§11), and a player never sees one: a campaign
carrying any Tier-1 code among them never reaches a frozen registry at all (04 §11). They
are registered on `Kind.reasonCodes` alongside the resolution codes because the completeness
rule is the same one — every registered code owes a localized message (04 §12).

| Code | Tier | When |
|---|---|---|
| `dangling_reference` | 1 | a `goto`, `transition.goto` or `startNodeId` names no such node |
| `undeclared_variable` | 1 | a consequence, condition or interpolation names an undeclared variable |
| `invalid_consequence_value` | 1 | a consequence op or `set` value does not suit the variable's type or range |
| `duplicate_id` | 1 | a node, choice, achievement or variable id is used twice |
| `missing_label_key` | 1 | a `visible: true` variable has no `labelKey` |
| `non_visible_variable_in_text` | 1 | text interpolates a hidden or undeclared variable |
| `invalid_transition_weight` | 1 | a `RandomTransition.weight` is not a positive integer, or a `random` node has no transitions |
| `unknown_condition_field` | 1 | a `Condition` reads a field this kind does not define (04 §18) |
| `unreachable_node` | 2 | no path from `startNodeId` reaches it |
| `unreachable_cycle` | 2 | a `choice`/`auto`/`random` cycle with no exit to a choice or ending |
| `no_reachable_choice` | 2 | no `ChoiceNode` is reachable from the start — valid but non-interactive (04 §11) |
| `no_reachable_ending` | 2 | no reachable ending |

**An audit code — carried on a `StateChange`, reported to nobody in particular.** It is
neither a rejection nor a validation finding, and it is registered here for the same single
reason both halves above are: `StateChange.reason` is typed `ReasonCode` and `visible` gates
client display (04 §12), so a code a client can be handed owes a resolvable message.

| Code | When |
|---|---|
| `consequence_applied` | the coalesced variable-write `StateChange` a resolved consequence emits (§5, 04 §12) — one per touched variable per batch, `visible` mirroring the variable's own declaration |

Its sibling `achievement_unlocked` (§7) is **not** here: it is base vocabulary (04 §12),
because the session store's profile upsert (04 §7.1) switches on it without knowing which
kind emitted it, whereas a consequence is this kind's own concept.

`unknown_condition_field` sits in the validation half because that is where it is *found* —
but it is also the one code here a resolution could in principle raise, if a condition
reached `advance` unvalidated. It cannot, on a frozen registry; the code is single, and which
half it is listed under is a statement about the checked path, not two different codes.

A `LocKey` that fails to resolve reuses the base `missing_string_key` (04 §12) rather than
adding a kind-owned code — it is the identical failure the core's own `titleKey` check
already names.

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

| Name (after `kind.story-graph.`) | Severity | Emitted at | `data` | Status |
|---|---|---|---|---|
| `settle.step` | `trace` | each iteration of the settle loop | `step`, `nodeId`, `nodeKind` | delivered |
| `node.entered` | `debug` | every `enter(nodeId)` — §8.2 | `nodeId`, `nodeKind`, `visitCount` | delivered |
| `random.picked` | `debug` | a `random` node chose a transition | `nodeId`, `goto`, `weight` | delivered |
| `settle.guard_tripped` | `error` | `SETTLE_STEPS` exceeded | `nodeId`; `reason` set | delivered |
| `choice.submitted` | `debug` | §8.2 step 1, on submission — before the id is resolved | `nodeId`, `choiceId` | delivered |
| `choice.rejected` | `info` | §8.2 step 2 | `choiceId`; `reason` set (§8.3) | delivered |
| `requirement.evaluated` | `trace` | §8.2 step 2, once per *evaluated* requirement leaf | `choiceId`, `satisfied` | delivered |
| `consequence.applied` | `debug` | §8.2 step 3, and every settle pass-through's own effects (§8.2's settle procedure) | `variable`, `op`, `clamped` | delivered |
| `achievement.unlocked` | `info` | §8.2 step 7 | `achievementId` | delivered |
| `ending.reached` | `info` | settle landed on an `EndingNode` | `endingId` | delivered |

> **All ten rows are delivered.** `Kind.eventNames` (04 §3) declares what a kind *may*
> emit, and the shipped `storyGraphKind` now declares and emits all ten. Adding an
> eleventh follows the same shape: declare it in `eventNames`, emit it at the step named
> above, and it needs no further redeciding — event names are a published identifier a
> sink filters on (05 §9), fixing the name before the emit site exists costs nothing, and
> this is safe precisely because of 05 §2: dropping every event changes nothing, so a
> not-yet-emitted event was never load-bearing.

Two of these carry most of the value, for the two audiences the events exist to serve:

- **`requirement.evaluated`** is the author's answer to *why was my choice greyed out*.
  It fires per requirement leaf rather than per choice, so a compound condition (§6) reports
  which clause failed — something the single `requirement_unmet` reason code (§8.3)
  deliberately cannot say, because the player is not owed the campaign's internals.

> **The walk short-circuits, and a leaf reports its effective contribution.** `all`/`any`
> stop exactly where `evaluateCondition` (04 §18) stops, so this walk decides the same trees
> the same way `showWhen` and `availableActions` decide them — and that parity is
> load-bearing rather than incidental. A comparison against a type-mismatched operand
> *throws*, so the guard-then-typed-compare idiom (`all: [x is set, x > 3]`) only stays a
> clean `requirement_unmet` rejection while the guard can stop the walk; evaluating every
> leaf eagerly would buy one extra `trace` event and turn that rejection into a thrown engine
> error on a campaign `availableActions` had already greyed out. Under `all`, the
> short-circuit lands on exactly the clause this event exists to name. Note this is the
> opposite of the world-graph's rule in [`12-world-graph-kind.md`](12-world-graph-kind.md)
> §9.1, deliberately: there the leaves are pure and an
> identical trace is the whole point, here they are not.
>
> **`satisfied` carries the parity of the enclosing `not`s**, not the leaf's raw result.
> `not: { achieved.bribed == true }` against a player who holds it is a requirement that
> *failed*; reporting `satisfied: true` because the leaf alone was true tells the author the
> opposite of what happened, and it is the only event that requirement produces. Only the
> reported value is negated — the tree still decides on raw results. Under `not: { all: […] }`
> De Morgan makes per-leaf negation a convention rather than a truth; emitting once for the
> whole `not` subtree would always be truthful but drops the one-event-per-leaf property this
> section leans on, so parity is the deliberate trade.

> **`choice.submitted` fires on submission, before the id has been resolved**, so it carries
> whatever `choiceId` the caller sent — including one naming no choice, or one whose
> `showWhen` fails. That is the point: an unknown or hidden id then shows as a
> `choice.submitted`/`choice.rejected` pair rather than as silence, and silence is the hardest
> thing to debug in a stream. It is a deliberate exception to 05 §8's rule that
> `core.action.rejected` omits an unresolved `actionId` — the core's rule protects a *hosted
> operator's* log from arbitrary caller text, and this event is namespaced to one kind and
> emitted at `debug`, where a host running `nullEmitter` (05 §2) never sees it at all. A host
> that does raise the level and does not want caller-supplied ids should filter this name.
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
outcome(state: StoryGraphKindState): { terminal: boolean; terminalId: string | null; endingId: string | null }

terminalCount(campaign: Campaign): number   // distinct `endingId`s across the campaign's EndingNodes
```

`endingId` when the game has settled onto an `EndingNode` (§8.2), `null` while it is still
active. Nothing else — not `turn`, not variable values, not `visitedCounts`.

**`terminalId` is `endingId`**, and the two fields are the same value under two names on
purpose: `terminalId` is the cross-kind floor ([`04-core.md`](04-core.md) §3.2) a host reads
without knowing which kind it holds, and `endingId` is this kind's own name for it, kept so
nothing that already reads it has to change. `terminal` is `status === "ended"`, which for this
kind is exactly "`endingId` is set" — stated as its own field because §3.2 requires the two
facts to stay separable for kinds where they are not the same.

**`terminalCount` counts distinct `endingId`s, not `EndingNode`s.** Two nodes may legitimately
publish one ending — the same conclusion reached by different routes — and a progress denominator
that counted nodes would tell a player there are more endings than the campaign can produce. It
is pure over `campaign.content`: it reads the node map, never state, never a profile. This is
the denominator in `CampaignProgress.total` ([`04-core.md`](04-core.md) §7.3); the numerator is
the profile's, and this kind never sees it.

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
  min?: number;                   // the declared clamp floor (§2), when the declaration has one
  max?: number;                   // the declared clamp ceiling (§2), when the declaration has one
}
```

**`min` and `max` mirror `VariableDecl` (§2) exactly, including its optionality.** They are
present when the declaration declares them and absent otherwise — which for the shipped
campaigns means every visible stat carries both, since every one is a bounded `int`. A `bool`
or `enum` stat carries neither, because §2 gives it neither.

They are here because without them a client rendering "3 / 12" had to reach into
`Campaign.content` for the bound, and `content` is `unknown` to everything above the kind
([`04-core.md`](04-core.md) §10.1). A downstream host did exactly that, structurally and
defensively. **That is this ledger's failure mode running in the other direction:
`CLAUDE.md`'s envelope-duplication entries track a kind carrying a field something else owns;
this was a projection *omitting* a field, which forces every client past the boundary to
recover it.** Both end with the boundary no longer load-bearing, and the fix for the omission
is the same as for the duplication — put the field in exactly one place, here, and let clients
read it there.

**Copying a declared bound into the view is not duplication.** The declaration in §2 is the
sole authority and nothing writes back to it; the view narrows content for a reader that has no
route to content, which is what a projection is for. The value copied is authored data a
rebalance may change freely — unlike a *terminal* id, it is never compared across engine
versions.

> **The enum analogue is a real gap and is deliberately not closed here.** A visible `enum`
> stat's `values` set is unreachable by the same argument that made `min`/`max` unreachable. No
> campaign declares a visible `enum` — every visible stat in the shipped set is a bounded `int`
> — so adding the field now would ship public surface with no consumer and no test that could
> fail. Registered rather than fixed; the day a campaign declares one, this is the paragraph
> that says what to do.

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
<!-- human-doc:end -->

<!-- human-doc:start path="engine/10-simulation-kind.md" -->
---
sidebar_label: Simulation Kind
---

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
> that `StateChange` does not. Recorded in `90-decisions.md` §2.
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

#### Contested-Resource Resolution (W101)

`JobOpening.contested`/`positionsAvailable`, `PromotionPath.contested`, and
`OpportunityDefinition.contested` (§7.9) each name a finite resource two or more actors can
claim in the same week — the player and, once `ScenarioDefinition.rivals` (§7.8) is non-empty,
one or more `AgentState`s (§7.10). Every one of them resolves through the same pure function,
so "who wins a tie" is one rule, not one per resource type:

```typescript
interface ContestClaim {
  actorId: string;      // "player" or an AgentState.id (§6.3)
  score: number;         // resource-specific: e.g. a job application's qualification score
}

/** Deterministic, total-order resolution of `positionsAvailable` slots among `claims`.
 *  Ties break on `actorId` ascending (`String.prototype.localeCompare` with the "en-US-POSIX"
 *  collation this kind already uses for the sorted-iteration rule, §2) — never on claim order,
 *  which is construction-order-dependent and exactly what the sorted-iteration rule forbids. */
function resolveContest(claims: readonly ContestClaim[], positionsAvailable: number):
  { won: readonly string[]; lost: readonly string[] };
```

**No random draw.** A contest is decided by `score` — itself computed by the resolver that
built each `ContestClaim` (a job application's qualification, a business opportunity's bid),
which may draw on `ctx.rng` while computing it — but `resolveContest` itself is pure
comparison, so replaying the same claims always produces the same winners without consuming a
stream. This is what makes W101.7's "one filled position decrements the count, the last
retires the opening" true independent of iteration order: `resolveContest` sorts by
`(score desc, actorId asc)` and takes the first `positionsAvailable` entries, full stop.

**A losing claim on a contested resource is `Revoked` (§2.3's opportunity-lifecycle table) or
its job/promotion equivalent — never a duplicate `Reward`.** The resolver that lost applies no
completion reward; only the resolver(s) in `won` do. This is the same rule §2.3 already states
for `Opportunity` revocation, generalized to every contested resource `resolveContest` now
governs rather than restated per resource type.

#### World Strangeness

Content gates events and headlines on a **derived** strangeness value, not the raw
`strangenessBase` above — so a `Modifier` (§7.1) can push it, and so the raw number never leaks
into a projection. The player is meant to notice the drift, not read the dial.
`strangenessBase` itself rises on a curve with elapsed weeks; the curve's shape is
content-balance material, out of scope here the same way §6.1's derived-value formulae are
content-balance material rather than part of the mechanism itself.

#### Chain Scope, and Where a Profile Chain Lives

Scope is declared per chain, not globally, because event chains are not all the same kind of
thing: a `"game"`-scoped chain cannot survive past this game (an eviction ladder should not
follow a new character into their next life), while a `"profile"`-scoped chain is meant to
outlive any single game.

**Scope is authored, not inferred.** `EventChainState.scope` had no source: the only chain
vocabulary a campaign could write was `EventDefinition.chainId`/`chainStep` (§7.6), which names
a chain without saying what kind of thing it is. `SimulationCampaign.eventChains` (§7.13) is
that source — one `EventChainDefinition` per chain, carrying its `id` and its `ChainScope`, and
nothing else, because the chain's membership and order are already fully determined by the
events that declare `chainId`/`chainStep` and duplicating them here is the envelope-duplication
defect one level down.

**The storage question is closed.** A `"profile"`-scoped `EventChainState` needs somewhere to
live that is *not* `GameState`/`SimulationKindState` — by definition, since it must survive the
game that is ending. `PlayerProfile.kindData` (04 §7.1) is that place: one kind-owned,
core-opaque slice per kind, written through the same mirror the achievement and terminal
upserts already use. This kind's slice:

```typescript
/** `Kind.profileData.version` 1. Sorted by `(campaignId, chainId)` ascending, so one
 *  profile has exactly one canonical serialization. */
interface SimulationProfileData {
  chains: readonly SimulationProfileChainRecord[];
}

interface SimulationProfileChainRecord {
  campaignId: string;    // a chainId is only unique within a campaign — as AchievementRecord's is
  chainId: string;
  furthestStep: number;  // the highest `EventChainState.currentStep` any game reached
}
```

**`furthestStep` is a maximum, and every field here is chosen so the fold is idempotent.**
`fold` reads the `profile_chain_advanced` audit records (§10) out of one action's `changes`,
takes `max(existing, value)` per `(campaignId, chainId)`, and returns the record set. Applying
the same records twice reaches the same value, so the store's canonical-equality check (04
§7.1) sees no change and writes nothing — which is what makes a reloaded, branched or
re-submitted transition create no duplicate entry, event, achievement or reward. A sum would
not have this property, and that constraint is what decides the shape rather than decorating
it.

**Seeding, at `createSession` and nowhere else.** `initialState` receives the migrated slice as
its `profileData` argument (04 §3, §5) and creates one `EventChainState` per declared
`"profile"`-scoped chain: `currentStep` from the matching record's `furthestStep`, or `0` when
the profile has none; `startedWeek: 0`; `active: false`. A seeded chain becomes active when its
next step fires, exactly as an unseeded one does. `"game"`-scoped chains are **not** seeded —
`chainStates` starts empty of them, unchanged, and the `events` system (§3) creates each when it
first fires. An anonymous session, a campaign declaring no `eventChains`, and a `profileData`
argument that is absent all produce the same thing: no seeded chains, and a `SimulationKindState`
byte-identical to what 0.10 produced.

**What a profile chain does *not* do.** It does not read back into resolution, does not reach
`project`, and is not part of terminal identity (§12) — it is an initialization input and an
audit mirror, nothing else. Two sessions under one profile therefore never observe each other
mid-game; each sees whatever the profile held when it was created.

> **Cumulative weeks across games is *not* resolved here, and is not part of this shape.**
> This section previously described a `"profile"`-scoped chain as advancing "on cumulative weeks
> played across every game under one profile". That phrase survives as intent and not as
> contract, because it demands an aggregate this design cannot make both idempotent and bounded:
> a sum is not idempotent under a refold, per-game keying is idempotent but unbounded, and a
> settle-on-game-change counter is bounded but races the two live sessions §7's own `profileId`
> lock domain exists because a profile legitimately has. `furthestStep` is the part that is
> well-defined, and it is the part W102.2 actually asks for. The remainder is recorded in
> `20-contract.md`'s own *Unresolved* section and in `90-decisions.md`'s open register.

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
fresh budget. `end_week`, and any `plan.add` other than `respond_to_event`, refuse while a
`PendingEventResponse` remains unaddressed by the current plan — `event_response_pending`
(§10, W94).

#### Status Effect Lifecycle

**Application.** A `StatusEffect` is inserted into `activeEffects` by whichever resolver grants
it — an item's own effects syncing with `activeEffects` on every resolution (`sourceKind:
"item"`), an event outcome (`sourceKind: "event"`), or any other source named by
`StatusEffect.sourceKind`. Insertion goes through one shared function regardless of source:
`stacking: "refresh"` drops any existing effect with the same `sourceId` before adding the new
one; `stacking: "stack"` adds alongside whatever is already active. `appliedWeek` is stamped from
the current week at insertion.

**Expiry.** The `effects` step of start-of-week (§12.1), run immediately after the week
increments and before any other system, removes every effect whose `expiresAtWeek` is strictly
before the new week — an effect expiring in week 12 still applies throughout week 12 and is
removed only once the new week moves past it, at the start of week 13. An effect with no
`expiresAtWeek` is permanent and is never removed by this step; it persists until its own source
is resynced or replaced (as item effects are, above). Expiry emits `effect.expired` (§11) per
effect and produces no `StateChange` — there is nothing for a client to undo when a timer
elapses.

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

#### Pending Event Response Lifecycle

**Creation** is stated above: firing a `ScheduledEvent` (or a random roll) that carries choices
queues a `PendingEventResponse` for presentation at the start of the following week.

**Resolution.** A `respond_to_event` action naming the pending entry's id is its only removal
path: the resolver removes that entry from `pendingEventResponses` as part of the same
`StateChange` set that records the chosen `choiceId` and applies the choice's costs. There is no
expiry — a `PendingEventResponse` has no `expiresAtWeek` field, and `end_week` and every other
`plan.add` refuse outright while one is unaddressed (`event_response_pending`, §10), so it
cannot be outlived by the calendar the way an `Opportunity` or `ScheduledEvent` can.

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

A `GoalState` is never removed once created: `status` transitions away from `"active"` on
completion or failure, but the entry stays in the set as a permanent record — matching how
retirement already works for `LoggedAction` and `StateChange`.

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
employment          education          finance_income     business
inventory            housing            finance_reconcile   needs
relationships         opportunities      events              headline
goals                 failure            week_limit          achievements
history
```

Order is stable and covered by test, the same as start-of-week. `headline` runs after `events`
so a week's headline can reference the strangeness level that week's own events just moved.
`achievements` runs second-to-last because an achievement condition may depend on anything
earlier in the pass, including a counter a `goals`/`failure` system just incremented.

**`business` (§7.12, W101) sits immediately after `finance_income`, before `inventory`/
`housing` — the same reasoning `finance_income` itself already states for running before
`housing`.** Business revenue/expenses (§7.12) must post before `housing` charges rent, so a
business's own income is spendable against this week's rent the same way wages already are;
it must post after `finance_income` rather than being folded into it, because
`finance_income` is specified (upstream, and this contract) as wages-and-scheduled-expenses
only — widening its own meaning to include business cashflow would be the kind of silent scope
creep this document's "one system, one concern" pattern (`employment` vs. `education` vs.
`inventory`, none of which absorb an adjacent concern either) exists to prevent. `business`
runs before `inventory`/`housing` rather than after `finance_income` alone, because
`BusinessRecord.status` closing insolvent (§7.12) is itself a cashflow fact this week's
`housing`/`finance_reconcile` passes should already see, the same "downstream systems see this
week's own upstream changes" property every other ordering choice in this list already
protects.

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

  projects: ProjectRuntimeState[];   // §6.12 (W101)
  businesses: BusinessRecord[];      // §6.12 (W101)

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

**`attendanceRatio`'s update rule, when a campaign opts in, is §7.11's
`AttendanceTrackingConfig`.** Absent that field, it stays exactly what `resolveApplications`
sets at hire and nothing since has maintained — the documented gap this section used to leave
open unconditionally.

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

**Weekly drift, when a campaign declares any, is §7.11's `RelationshipDriftRule[]`.** Absent
that field, the `relationships` end-of-week system (§3) stays the no-op it has always been;
`socialize` (§5) remains the only resolver that moves a `RelationshipState` on its own.

### 6.12 Projects and Businesses — Runtime State (W101)

Durable, per-actor progress against a `ProjectDefinition`/`BusinessDefinition` (§7.12) — the
same "content declares the shape, state declares the instance" split every other content/
runtime pair in this kind already follows (`JobDefinition`/`Employment`, §6.8;
`CourseDefinition`/`EducationState.enrollments`, §6.7).

```typescript
interface ProjectRuntimeState {
  instanceId: string;                // natural key for Modifier/Condition addressing (§7.1)
  definitionId: string;               // §7.12 — ProjectDefinition

  startedWeek: number;
  progressUnits: number;              // 0 .. ProjectDefinition.requiredUnits
  status: "in_progress" | "completed";
  completedWeek?: number;
}

interface BusinessRecord {
  instanceId: string;                 // natural key for Modifier/Condition addressing (§7.1)
  definitionId: string;               // §7.12 — BusinessDefinition

  startedWeek: number;
  cashOnHandCents: Cents;
  weeksOperated: number;
  status: "operating" | "closed";
  closedWeek?: number;
  closedReason?: ReasonCode;
}
```

**A project completes once and only once.** `status` transitions `"in_progress"` →
`"completed"` the week `progressUnits` reaches `ProjectDefinition.requiredUnits` (§7.12) —
irreversible, the same one-way transition `EducationState.enrollments[].status` (§6.7) already
uses for course completion. `work_on_project` (§4.2) on an already-`"completed"` instance is
rejected the same way `plan.add` already rejects an action against a resource that no longer
exists — `requirement_unmet` (base set) — rather than silently re-crediting progress, which is
what "completes once" (W101.2) rules out.

**A business closes once and only once**, the same shape: `status` transitions
`"operating"` → `"closed"` and never back. Closure is either player-initiated
(`operate_business` with a `parameters.close: true`, §4.2's own parameter domain) or
contract-forced — `BusinessDefinition.minimumCashCents` (§7.12) breached at the point weekly
expenses post, which is `closedReason: "business_insolvent"` (§10).

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

  rivals?: readonly RivalConfig[];    // §7.10 (W101). Absent or empty = today's behaviour.
}

type GameMode = "classic" | "open_life" | "challenge";
type GoalFailurePrecedence = "goals_win" | "failure_wins";

/** §7.10's own open gap, closed: the natural home it named, "decided against a concrete
 *  need" (W101). One entry per rival this scenario starts with. */
interface RivalConfig {
  agentId: string;               // AgentState.id (§7.10) — must be unique within this scenario
  strategyId: string;             // AgentStrategy.id (§7.10) — Tier 1: unknown_rival_strategy
  displayNameKey: LocKey;

  startingBackgroundId: string;   // §7.9 — same BackgroundDefinition mechanism the player uses
  initialConditions?: Modifier[]; // §7.1 — applied once, at initialState, on top of the background
}

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

**`RivalConfig` and `DifficultyDefinition.rivalStartingAdvantages` are two different axes, not
a duplication.** `rivalStartingAdvantages` is difficulty-wide — every rival in a scenario
played at that difficulty gets the same bonus, the mechanism an "any advantage must be
explicit" audit already covers. `RivalConfig.initialConditions` is per-rival and
scenario-authored — "this particular rival starts with a head start," the same relationship
`ScenarioDefinition.startingCashCents` has to the player. A rival's actual starting `ActorState`
is its `startingBackgroundId`'s `BackgroundDefinition` (§7.9), with `initialConditions` applied
on top the same way any other `Modifier[]` applies, then `rivalStartingAdvantages` on top of
that — difficulty is the outermost layer because it is the one axis a player, not a campaign
author, chooses.

**Zero rivals is the only value every 0.10 scenario has**, so `rivals` absent or `[]` must
build `WorldState.agents: []` exactly as `initialState` already does today (W101.4) — this
field adds a new source `initialState` reads, not a new default it can silently change.

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

**How a campaign actually selects a strategy was a real, open gap — closed by §7.8's
`ScenarioDefinition.rivals: RivalConfig[]` (W101), the exact field this section already named
as the natural home.** `AgentState.strategyId` stays *runtime* state, built at `initialState`
from `RivalConfig.strategyId` — a campaign author still never writes it directly, but now has
a real field to declare it through. `initialState` builds one `AgentState` per `RivalConfig`,
in `rivals` array order (deterministic — this is content, read once, not an iteration this
kind's own sorted-iteration rule governs), failing campaign validation rather than construction
when `strategyId` names no registered `AgentStrategy` (`unknown_rival_strategy`, §14).

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

  rngSeq: number;                  // §8's own `{ kind: "agent" }` StreamId draw counter (W101)
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

**Rival resolution runs inside `end_week`, after the player's own plan resolves, in
`WorldState.agents` order.** For each `AgentState`, `selectActions(publicView, agent)` draws —
if it draws at all — from `deriveStream({ kind: "agent", agentId: agent.id, seq: agent.rngSeq })`
(§8), incrementing `rngSeq` once per draw; the resulting `GameAction[]` resolves through the
same `ResolverTable` (§5.1) the player's plan already used, actor-addressed by `agent.id`
rather than `"player"`. This is what makes W101.5 true structurally — a rival is not a second
code path that happens to produce similar results, it is the *same* `apply`/`calculate`
functions given a different `actorId` — and what makes W101.6 true: a rival's stream key names
only its own `agentId`, so nothing about registry construction order or another agent's action
count can perturb it. `WorldState.agents` order is itself the campaign's own `rivals` array
order (above), fixed at `initialState` and never re-sorted at runtime, so "in agent order" is
as reproducible as the campaign content is.

### 7.11 The Campaign Envelope and Weekly Tuning

**`SimulationCampaign` is the campaign-root envelope** — `story-graph`'s `StoryGraphCampaign`
analogue — carrying every content collection §7.2–§7.10 declare plus the flat, per-campaign
fields (`scenarioId`, `goalFailurePrecedence`, `startingEffects`, …) this document had not yet
named. Declared in `src/engine/src/kinds/simulation/campaign.ts`; identity fields
(`id`/`version`/`titleKey`) stay on the core `Campaign` envelope, not here, the same
envelope-duplication rule `StoryGraphCampaign` already follows.

**This is the closed, validated home W100 needed** for the weekly tuning values §3's
end-of-week ordering names but never wires: the empty-plan policy, relationship drift, and
attendance tracking. All three are optional flat fields on `SimulationCampaign`, matching
`goalFailurePrecedence`'s own precedent rather than nesting under `ScenarioDefinition`
(§7.8) — a single campaign here plays exactly one scenario (`scenarioId`), so the two would
name the same value, and the flat placement is this file's own established convention. Every
field below is **absent by default**, and absence means exactly the behaviour every campaign
shipped before this section had — no 0.10 campaign, replay, or save fixture changes when
these fields are omitted.

```typescript
interface SimulationCampaign {
  // … §7.2–§7.10's collections, and campaign.ts's existing flat fields, unchanged …

  /** Whether `end_week` may resolve an empty plan. Absent, or `"permit"`, is every campaign's
   *  behaviour before this field existed: `end_week` always resolves, even with nothing
   *  planned. `"forbid"` rejects `end_week` with `plan_empty` (§10) whenever
   *  `plan.actions.length === 0`, leaving state and the plan unchanged. */
  emptyPlanPolicy?: "permit" | "forbid";

  /** Weekly relationship drift the `relationships` end-of-week system (§3, §6.11) applies.
   *  Absent leaves that system the no-op it has always been. */
  relationshipDrift?: readonly RelationshipDriftRule[];

  /** Rolling employment-attendance tracking (§6.8). Absent leaves `Employment.
   *  attendanceRatio` exactly as `resolveApplications` sets it at hire — unmaintained,
   *  the documented gap this field closes only when a campaign opts in. */
  attendanceTracking?: AttendanceTrackingConfig;
}

interface RelationshipDriftRule {
  /** Which `RelationshipState.category` (§6.11) values this rule applies to. Absent or
   *  empty applies to every category. */
  categories?: readonly RelationshipState["category"][];

  /** Per-week integer delta added to each named dimension before clamping to 0–100 (§6.2's
   *  declared integer range). Every field is optional; an omitted dimension does not drift. */
  affinityDelta?: number;
  trustDelta?: number;
  respectDelta?: number;
  resentmentDelta?: number;
}

interface AttendanceTrackingConfig {
  /** Weeks averaged into the rolling `attendanceRatio`. Must be a positive integer — Tier 1
   *  (§14) rejects zero or negative. */
  windowWeeks: number;
}
```

**`relationshipDrift` runs once per week, in array order, over every actor's relationships —
the player's and each `WorldState.agents[].actor`'s (§7.10) alike**, the same "one shape, one
code path" rule §6.2 states for every other actor-state system. For each `RelationshipState`
whose `category` a rule names (or every relationship, when `categories` is absent), the rule's
deltas apply and clamp to 0–100 before the next rule runs; a dimension left at the clamped
value it already held emits nothing, mirroring `needs`' own `if (after === before) continue`
(`endOfWeek.ts`). A changed dimension emits one `StateChange` per field, `reason:
"relationship_drift"` (§10), `visible: true` for `affinity`/`trust`/`respect` — `resentment`'s
change is emitted the same way `socialize` already emits it (`resolvers.ts`): `visible: false`
per §6.11's hidden-from-projection rule, never omitted from the audit trail entirely.
Applying to every actor rather than only the
player is forward compatible with rivals (§7.10) without changing shape once one exists;
today `WorldState.agents` is empty in every shipped scenario, so the rival half of this rule
is exercised by nothing yet, the same honest gap §7.10 already states for
`AgentStrategy.selectActions`.

**`attendanceTracking`, when present, updates `Employment.attendanceRatio` (§6.8) once per
week inside the `employment` system (§3) — the same system that already reads and resets
`player.flags.workedThisWeek`, so this cannot run twice for one `end_week`; the pipeline's own
fixed, tested end-of-week order (§3) guarantees `employment` fires exactly once.** The rule's
two inputs are the ones already on state: "planned" is having `currentEmployment` at all — an
employed actor is expected to work that week — and "worked" is `player.flags.workedThisWeek`,
already set by the `work`/`work_overtime` resolvers (§5) and already reset to `false` at the
end of `employment`'s own pass. The rolling update, evaluated before that reset:

```text
weeklyRatio    = workedThisWeek ? 100 : 0
attendanceRatio = clamp(
  round(((attendanceRatio × (windowWeeks − 1)) + weeklyRatio) / windowWeeks),
  0, 100
)
```

`round` is the same `Math.round` `education`'s own attendance ratio already uses (§6.8's
decision log, `endOfWeek.ts`'s course-side computation) — this is that same rounding rule
extended to the employment side it never reached, not a new one invented for it. A changed
`attendanceRatio` emits one visible `StateChange`, `reason: "attendance_updated"` (§10),
mirroring `need_drift`'s own emit-only-on-change rule; an unemployed actor, or one whose
ratio does not move after rounding, emits nothing. A future firing/probation/performance rule
that reads `attendanceRatio` is what "affects the existing attendance requirements" (W100.4)
refers to, and remains that rule's own unit to add, not this section's.

**Wisdom's consumer is the existing generic path, not a new mechanism.** `SimulationView.
attributes` (§9) already omits only `luck` — `wisdom` has always had a visible projection, the
"no consumer" gap was never about visibility. `Requirement.type: "attribute"` (§8.1) already
gates on any `AttributeState` key through a `Condition` (04 §18) over `player.attributes.
wisdom` (§6.1's own `DerivedPath`), exactly as it does for `intelligence`/`discipline`/every
other attribute. Content declaring an `EventChoice`/`OpportunityDefinition`/`JobDefinition`
`Requirement` against `player.attributes.wisdom` is wisdom's consumer — no new `Condition`
operator, `DerivedPath`, or content type is added for it, matching §8's stated bar against
adding either without a concrete need. Authoring that fixture content is a `/slice` matter
(W100.5), not a contract addition.

### 7.12 Projects and Businesses (W101)

Two new content-definition types, the same "definition declares the shape, `Requirement[]`/
`Reward[]` reuse the existing vocabulary" pattern §7.2–§7.5 already establish — neither adds a
`RequirementType`, `RewardType`, or `Condition` operator of its own.

```typescript
interface ProjectDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  requirements: Requirement[];       // §8.1 — gates start_project
  requiredUnits: number;              // total progressUnits (§6.12) to complete
  weeklyTimeCost: number;              // work_on_project's own time cost (§4.2, §5.2)
  startCostCents: Cents;

  rewards: Reward[];                  // §7.1 — granted once, on completion
  tags: string[];
}

interface BusinessDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  requirements: Requirement[];        // §8.1 — gates start_business
  startupCostCents: Cents;

  weeklyRevenueCents: Cents;           // before modifiers (§7.1)
  weeklyExpensesCents: Cents;          // before modifiers (§7.1)
  minimumCashCents: Cents;             // breached ⇒ closedReason: "business_insolvent" (§6.12)

  tags: string[];
}
```

**`start_project`/`start_business` (§4.2) each create exactly one `ProjectRuntimeState`/
`BusinessRecord` (§6.12) instance on the acting actor, `instanceId` freshly minted the same
way `InventoryItem.instanceId` (§6.10) already is.** `work_on_project`/`operate_business`
(§4.2) both take `targetId: instanceId` — never `definitionId` — because an actor may hold
several instances of the same definition (two courses of the same `CourseDefinition` cannot
coexist per §6.7's own rule, but nothing here forbids running two identical businesses, and a
contract that assumed one instance per definition would silently break the moment a campaign
tried it).

**`weeklyTimeCost`/`startCostCents`/`startupCostCents` are the *only* costs these definitions
name — `weeklyRevenueCents`/`weeklyExpensesCents` are not client-supplied and not per-action:
they post once per week, inside the `business` end-of-week system (§3), for every
`"operating"` `BusinessRecord`.** This is the same "engine-derived cost, never a client
figure" rule §4.2 already states for time/money cost — extended here to a recurring figure
rather than a one-time action cost, because a business's whole point is the weekly cadence.

```text
revenue  = round(weeklyRevenueCents × combined `multiply` factor) + Σ `add`/`subtract` (§7.1)
expenses = round(weeklyExpensesCents × combined `multiply` factor) + Σ `add`/`subtract` (§7.1)
cashOnHandCents += revenue − expenses
```

Rounding and modifier composition follow §7.1's own `multiply` rule exactly — combine every
`multiply` factor targeting this business's revenue/expense path into one product, round once,
never per modifier. A `BusinessRecord` whose `cashOnHandCents` drops below its definition's
`minimumCashCents` after this post closes immediately (§6.12), the same week — there is no
grace period distinct from `HousingState`'s own `evictionStage` ladder (§6.9), because nothing
in this unit's `Done when` (W101.3) asks for one, and inventing a second insolvency escalation
mechanism when housing already has one is exactly the kind of unrequested design §7's own
`Reward` section (§7.1) already declines to do speculatively.

### 7.13 Event Chains (W102)

The content half of §2.2's `EventChainState`. One entry per chain a campaign declares, and the
only place `ChainScope` is authored.

```typescript
interface EventChainDefinition {
  id: string;              // what an EventDefinition's `chainId` (§7.6) names
  scope: ChainScope;       // §2.2 — "game" or "profile"
  labelKey?: LocKey;       // for a client listing chains in progress; nothing requires it
}
```

Added to the campaign envelope (§7.11) as one more optional collection:

```typescript
interface SimulationCampaign {
  // … §7.2–§7.12's collections and flat fields, unchanged …

  /** Absent means `[]`, which is every campaign shipped before this field: no chain is
   *  declared, so none is `"profile"`-scoped and none is seeded (§2.2). */
  eventChains?: readonly EventChainDefinition[];
}
```

**It carries no step list, and that is the envelope-duplication rule applied one level down.**
A chain's membership and order are already fully determined by the events that declare
`chainId`/`chainStep` (§7.6). Restating them here would create a second source that can
disagree with the first, and the disagreement would be silent — the ledger in `CLAUDE.md`
records five instances of exactly this, and none of them was noticed by a gate.

**Tier 1 (§14) checks three things**, all of them the `dangling_reference`/`duplicate_id`
vocabulary already in §10:

- Two `EventChainDefinition`s sharing an `id` — `duplicate_id`.
- An `EventDefinition.chainId` naming no declared chain — `dangling_reference`. This is the
  check that makes `scope` reliably present for every chain that can actually fire, which is
  what §2.2's seeding rule depends on.
- A `"profile"`-scoped chain declared by a kind whose build has no `Kind.profileData` support —
  impossible by construction, since the member is declared alongside this section, and named
  here only so a reader does not go looking for a check that would have to exist if it were not.

A declared chain no `EventDefinition` ever references is `unreachable_content` at Tier 2, the
same as any other unreferenced definition.

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
| `plan_empty` | `end_week` with nothing planned, where the campaign forbids it (`SimulationCampaign.emptyPlanPolicy: "forbid"`, §7.11) | registered (W100) |
| `week_limit_reached` | The scenario's week cap is exhausted | specified, not yet dispatched |
| `event_response_pending` | `end_week`, or a `plan.add` for any `ActionType` other than `respond_to_event`, while a `PendingEventResponse` (§2.3) remains unaddressed by the current plan | registered (W94) |

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`,
`action_not_available` (a `"custom"` `GameAction` reaching resolution, §4.2).

**Campaign validation — what `validateCampaign` returns (§14):**

| Code | Tier | When |
|---|---|---|
| `duplicate_id` | 1 | Two definitions of the same content type share an `id` |
| `dangling_reference` | 1 | A definition references an `id` that resolves to nothing |
| `numeric_natural_key` | 1 | An addressing path segment is all digits where a natural key is required (§7.1) |
| `unknown_rival_strategy` | 1 | `RivalConfig.strategyId` (§7.8) names no registered `AgentStrategy` (§7.10) — W101 |
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
| `relationship_drift` | the `relationships` end-of-week system, only when `SimulationCampaign.relationshipDrift` (§7.11) is declared |
| `attendance_updated` | the `employment` end-of-week system, only when `SimulationCampaign.attendanceTracking` (§7.11) is declared |
| `action_start_project`, `action_work_on_project`, `action_start_business`, `action_operate_business` | the project/business resolvers (§5.1, W101) |
| `project_completed` | the `work_on_project` resolver, when `progressUnits` reaches `requiredUnits` (§6.12, W101) |
| `business_revenue`, `business_expense` | the `business` end-of-week system (§3, §7.12, W101) |
| `business_closed` | the `operate_business` resolver, voluntary close (§6.12, W101) |
| `business_insolvent` | the `business` end-of-week system, `cashOnHandCents` below `minimumCashCents` (§6.12, §7.12, W101) |
| `chain_advanced` | the `events` system, when a `"game"`-scoped chain's `currentStep` moves (§2.2, §7.13, W102) |
| `profile_chain_advanced` | the `events` system, when a `"profile"`-scoped chain's `currentStep` moves — the record `Kind.profileData.fold` reads (§2.2, 04 §7.1, W102) |

> **`profile_chain_advanced` is a separate code rather than a `path` prefix on
> `chain_advanced`, and the split is what keeps `fold` from string-matching.** 04 §12's own
> convention is that `path` names *what* changed and `reason` names *why*, with `reason` the
> field a consumer switches on; a fold that decided scope by inspecting the path would be
> parsing prose, and a fold that looked the scope up from `EventChainDefinition` would need
> content it is not given. Both codes carry the same `path` — `chain.<chainId>` — and both are
> `visible: true`, because a player who is told a thread moved forward is also owed the fact
> that this one carries into the next life.

> **This set grows as the dispatched systems land, and that is deliberate.** A code joins
> `Kind.reasonCodes` when the unit that actually produces it exists, not when this table
> first names it — the precedent `story-graph` set, whose own codes joined across W10, W11,
> W12 and W14 rather than being pre-declared. `week_limit_reached` is the one still
> outstanding. `plan_empty` was the other until W100: §7.11's `emptyPlanPolicy` field closed
> its additional gate, and `advance.ts`'s `end_week` now returns it whenever that field reads
> `"forbid"` and the plan is empty. The shipped set lives in
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
  terminal: boolean;                                                 // 04 §3.2
  terminalId: string | null;                                         // 04 §3.2 — the resolution token
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;  // null while active
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
} {
  const terminal = state.resolution;
  return {
    terminal: terminal !== null,
    terminalId: terminal?.resolution ?? null,
    resolution: terminal?.resolution ?? null,
    goalsMet: terminal?.goalsMet ?? [],
    goalsFailed: terminal?.goalsFailed ?? [],
  };
}
```

**`terminalId` is the `resolution` token**, satisfying the cross-kind floor
([`04-core.md`](04-core.md) §3.2) without inventing a fourth vocabulary. `resolution` stays as
its own field: it is the typed union this kind's own readers already switch on, and narrowing it
to the base's `string | null` would cost every one of them exhaustiveness checking to buy
nothing. The duplication is a widening, which §3.2 is explicit about permitting — the base is a
floor, not a ceiling.

**This kind implements no `terminalCount`.** Its terminal set is the three tokens above, fixed by
this contract rather than declared by a scenario, so a count of them is a fact about the engine
and not about the campaign a player is looking at. "One of three resolutions reached" is not
progress; it is a category label with a denominator glued on. Per
[`04-core.md`](04-core.md) §7.3 the omission means a simulation campaign carries no `progress`
object at all, which is the correct answer rather than a missing feature.

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
  `BackgroundDefinition`, `TraitDefinition`, `SkillDefinition`, `ProjectDefinition`,
  `BusinessDefinition` — §7.2–§7.10, §7.12, each independently).
- Every reference to another definition's `id` resolves: `PromotionPath.toJobId` →
  `JobDefinition`; `ScenarioDefinition.startingBackgroundIds`/`startingHousingId`/
  `startingLocationId`/`goalIds`/`startingInventory[].definitionId` → their respective
  definitions; `EmployerDefinition.jobIds`/`npcIds` → `JobDefinition`/`NPCDefinition`;
  `LocationDefinition.connections` → `LocationDefinition` (the adjacency graph, §7.9);
  `OpportunityDefinition.targetId` → whichever definition type its own `kind` names
  (`job_offer` → `JobDefinition`, `course_place` → `CourseDefinition`, and so on);
  `RivalConfig.startingBackgroundId` (§7.8) → `BackgroundDefinition` (§7.9), the same reference
  `ScenarioDefinition.startingBackgroundIds` already checks for the player.
- `RivalConfig.strategyId` (§7.8) names a registered `AgentStrategy` (§7.10) —
  `unknown_rival_strategy` (§10) when it does not. Unlike every other reference above, the
  target is not campaign content but the engine's own fixed strategy registry, so this check
  runs against that registry rather than against the campaign's own definition set.
- `RivalConfig.agentId` (§7.8) is unique within its own `ScenarioDefinition.rivals` array —
  `duplicate_id`, the same code the bulleted rule above uses, scoped to one scenario's rival
  list rather than to the whole campaign, because `AgentState.id` (§7.10) only needs to be
  unique within the one `WorldState.agents` array it populates.
- No two `EventChainDefinition`s (§7.13) share an `id` — `duplicate_id` — and every
  `EventDefinition.chainId` (§7.6) resolves to one — `dangling_reference`. The second is what
  makes `ChainScope` reliably present for every chain that can fire, which §2.2's seeding rule
  depends on; without it a `"profile"`-scoped chain could advance in a game and be seeded into
  none.
- Every `SimulationMigrationStep.domain` (§16) is covered by the engine-owned reference-site
  table — `dangling_reference`. A `default` step's `id` resolves against its domain's collection
  in **this** campaign, the version being migrated *to* — `dangling_reference` — because a
  default that cannot resolve is a migration guaranteed to fail at load rather than at
  publication, which is the wrong end to find it.
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
- `SimulationCampaign.attendanceTracking.windowWeeks` (§7.11), when present, is a positive
  integer — zero, negative, and non-integer values are rejected.

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
- `ChainScope`'s `"profile"` value (§2.2) had nowhere to persist — **closed by W102**, which
  gave the core `PlayerProfile.kindData` (04 §7.1) and this kind the `SimulationProfileData`
  slice that sits in it. The finding was right about the gap and right to refuse to invent the
  answer: what closed it is a core-side seam, not a simulation-side workaround. `Reward`'s own
  payload (§7.1) stays untyped exactly as upstream leaves it — still recorded as open rather
  than resolved, the same as `history`'s own status throughout this document.

**Nothing above changes what the seam looked like before this programme** — every finding is
detail hanging off it, or a genuine gap named rather than guessed at. What has changed is that
the upstream document is no longer where a reader has to go to find the shape of this kind's
own state and content; it is here, and upstream stays cited as provenance, exactly as
`04-core`'s own *Reused, not re-derived* note describes.

### 15.1 Companion Lifecycle Mirror (W103.1)

`SubZeroDev.GameOfLife` S6/S7 gave twelve upstream concepts an explicit `lifecycle-` region —
a creation paragraph and a retirement paragraph each. This mirrors all twelve against this
kind's own shape, concept by concept, rather than transcribing upstream prose: four map onto
core-owned envelope fields (§2's own table above) and are cited there rather than duplicated,
one is a still-open decision, and the remaining seven get the explicit creation/retirement
statement upstream's lifecycle region gives them, filling in where an existing section only
implied it.

**Mapped to the envelope, not restated here — duplicating them would be the envelope-
duplication defect §2 already names:**

- **`RngState`** — has no counterpart at all, deliberately (§2's table: "Nowhere"). A stream
  derives from `(seed, streamId)` (04-core §8); there is no persisted generator to create or
  retire.
- **`GameStatus`** — the envelope's own `status` (04-core §2), narrowed to
  `"active" | "ended" | "abandoned"` (§2's table). Its creation and mutation are the envelope's;
  this kind's own win/loss/week-limit distinction is `outcome()` (§12), not a second status.
- **`GameMetadata`** — the session-store record (04-core §7), outside replayable state
  entirely. Its lifecycle is 04-core's own contract.
- **`LoggedAction`** — the envelope's `actionLog`, the replay spine (04-core §2, §10.3;
  07-replay.md). Its append-only, never-pruned lifecycle is stated there, not per-kind.

`CalendarState` is *not* in this group despite upstream's naming: `04-core`'s envelope carries
no week or turn concept of its own, so there is nothing there for this kind to duplicate. It is
kind-owned (§2.1) and its lifecycle is stated below with the rest.

**Still an open decision, not a gap in this mirror:** **`HistoryEntry`** is not adopted into
`SimulationKindState`. §2 above states why — it overlaps `StateChange` and the event stream
closely enough that a third copy would be the same duplication defect, and adopting it needs
that overlap resolved first. Recorded as open in `90-decisions.md` §2; nothing here
contradicts shipped code, because the concept does not exist in this kind's state to have a
lifecycle.

**Kind-owned; creation and retirement stated explicitly:**

- **`CalendarState`** (§2.1). **Creation.** Constructed once by `initialState`, per-scenario:
  `currentWeek` begins at 1, `totalTimeUnits`/`committedTimeUnits`/`spentTimeUnits` at their
  starting values, satisfying §2.1's invariant from the first week. **Retirement.** No removal
  path — `end_week` (§3) mutates it every week, but the field itself is never replaced; it
  persists for the life of `SimulationKindState`.
- **`WorldState`** (§2.2), as a whole. **Creation.** Constructed once by `initialState`:
  `npcs` from content definitions (§7.7), `locations`/`jobMarket` from the scenario's starting
  location and job content (§7.4, §7.8), `chainStates` seeded per the Chain Scope rules already
  stated above — `"game"`-scoped empty, `"profile"`-scoped from `PlayerProfile.kindData`
  (W102) — `agents` from `ScenarioDefinition.rivals` (§7.8, W101), empty otherwise.
  **Retirement.** No removal path for the struct itself; it persists for the life of
  `SimulationKindState`. Each member's own removal is that member's lifecycle, already stated
  where it is declared — `StatusEffect` and `PendingEventResponse` immediately below,
  `Opportunity`/`ScheduledEvent` in §2.3, and a contested `JobOpening` slot's removal in the
  Contested-Resource Resolution note above.
- **`StatusEffect`** (§2.3) — already carries its own *Status Effect Lifecycle* subsection
  above; cited, not repeated.
- **`PendingEventResponse`** (§2.3) — already carries its own *Pending Event Response
  Lifecycle* subsection above; cited, not repeated.
- **`GoalState`** (§2.4). **Creation.** One `GoalState` per id in `ScenarioDefinition.goalIds`
  (§7.8), instantiated once by `initialState`; no other creation path, so a game's goal set is
  fixed at the start, matching upstream. **Retirement.** Already stated in §2.4: a `GoalState`
  is never removed once created — `status` transitions to `"completed"`/`"failed"`, and the
  entry stands afterward as a permanent record.
- **`EconomyState`** (§2.5). **Creation.** Constructed once by `initialState`, from a fixed
  baseline modified by `DifficultyDefinition.economyModifiers` (§7.8, §7.1). **Retirement.**
  No removal path, and — matching upstream's own finding, not diverging from it — §3's
  end-of-week system order names no dedicated economy system today, so nothing currently
  mutates `EconomyState` after creation; it persists unchanged for the life of the game.
- **`PlayerState`** (§6), as a whole. **Creation.** Constructed once by `initialState` as
  `SimulationKindState.player`, from the scenario's starting background, finances, location
  and inventory declarations (§7.8, §7.9) through the shared actor shape (§6.2) every rival
  also uses. **Retirement.** No removal path — it persists for the life of the game; at game
  end its `counters` fold into `PlayerProfile.lifetimeCounters`-equivalent profile data (§7.13,
  W102) through the same profile mirror `SimulationProfileData` already uses, which copies
  into a separate save artifact rather than retiring the field itself.

No contradiction with shipped simulation code surfaced while writing this mirror; where a
concept's mechanism turned out to need a decision rather than a citation (`HistoryEntry`,
`Reward`'s untyped payload), §2 and `90-decisions.md` already carried it before this pass.

---

## 16. Save Migration (W102)

04 §10.2 owns the two-axis mechanism — `Kind.migrateState` for a kind-state shape change, then
`Campaign.migrateState` for a content-id remap, with `replayCompatible: false` sticky forward
and idempotence against its own output. This section owns only what is specific to a
**published** simulation campaign: how the campaign axis is expressed as data, so it survives
the JSON round trip a portable document makes.

**Why data and not a function.** `Campaign.migrateState` is a function, and JSON carries no
functions — the same wall `story-graph` hit and answered by splitting the migration into a
generic engine-owned walk plus a per-campaign table (`src/engine/src/portable/format.ts`,
`migrateFromContent`). A life sim needs the same answer for a stronger reason: it is the kind
whose games are measured in years, so it is the kind where "a content revision cannot reach an
existing save" is a ceiling on the product rather than an inconvenience.

```typescript
/** Sits on the simulation arm of `PortableCampaignBody` (04 §19), beside the story-graph
 *  arm's own `PortableMigration`. Reattached as `Campaign.migrateState` by `fromPortable`. */
interface SimulationMigration {
  /** The only `fromVersion` this migration accepts; anything else fails the load with
   *  `migration_failed` (04 §12). Same single-version gate `PortableMigration` uses — a chain
   *  of versions is a chain of published documents, not a list inside one. */
  readonly fromVersion: string;
  /** Applied in array order, left to right. Order is the author's and is deterministic; a
   *  domain may appear in more than one step. */
  readonly steps: readonly SimulationMigrationStep[];
}

type SimulationMigrationStep =
  /** Every reference to a key of `map`, in the named domain, becomes that key's value. */
  | { readonly op: "remap"; readonly domain: SimulationIdDomain;
      readonly map: Readonly<Record<string, string>> }
  /** Every reference to one of `ids` is dropped: removed from a collection that holds many,
   *  left absent at a site that holds one. */
  | { readonly op: "remove"; readonly domain: SimulationIdDomain;
      readonly ids: readonly string[] }
  /** A single-valued reference site left absent by the steps before it takes `id`. Never
   *  overwrites a site that still holds a resolving reference. */
  | { readonly op: "default"; readonly domain: SimulationIdDomain; readonly id: string }
  /** Every surviving reference in the domain must resolve against the new campaign's
   *  collection. One that does not fails the load with `migration_failed`. */
  | { readonly op: "require"; readonly domain: SimulationIdDomain };
```

**`SimulationIdDomain` is derived, not enumerated here.** It is a closed union with exactly one
member per `SimulationCampaign` collection whose ids `SimulationKindState` (§2, §6) actually
holds a reference to — jobs a player is employed in, courses enrolled, the housing occupied, the
items owned, the events on cooldown, and so on. The union and the **reference-site table** that
gives each member its list of state paths are declared together in one engine-owned module, so
the two cannot disagree; a Tier 1 check (§14) rejects a `SimulationMigration` naming a domain
the table does not cover. Enumerating the members in this document instead would be the third
count in this file to outlive the units that changed it — §3's system list and §10's code table
are the first two, and both are recorded here as having drifted.

**Every step is data, and the walk is engine-owned code.** There is no host callback anywhere
on this path, and there cannot be: a migration definitionally changes `serialize()` output, and
06 §2 admits a host only where it cannot. That is the same rule 04 §10.2 already states, and it
is what makes a published campaign safe to fetch — a portable document can ask for a remap, it
cannot ship behaviour.

**What the four ops cover, and what they refuse.** Together they express the whole of a content
revision's reach into an existing save: an id was renamed (`remap`), an id was withdrawn
(`remove`), a slot the game requires must not be left empty (`default`), and nothing may survive
pointing at content that no longer exists (`require`). They cannot add state, move a week,
change a balance, or award anything — 04 §10.2's *neither may invent play* rule, made structural
here rather than merely asserted, because the vocabulary has no verb for it.

**Failure is the existing vocabulary, unchanged.** A `fromVersion` that does not match, a
`require` that finds a dangling reference, a `default` naming an id absent from the new campaign,
or a throw anywhere in the walk all produce `migration_failed`; a `campaignVersion` mismatch on a
document carrying no migration produces `save_requires_migration`. Both are 04 §12 base codes
that have existed since W31 and neither is widened. Nothing is partially written: the walk
produces a new `kindState` or it produces a rejection, and `SessionStore.loadGame` writes no
session record on a rejection.
<!-- human-doc:end -->

<!-- human-doc:start path="engine/12-world-graph-kind.md" -->
---
sidebar_label: World-Graph Kind
---

# World-Graph Kind — Contract

**Document status:** Revision 4 — **authoritative runtime-state, campaign-content, and
resolution contract.** Concrete content and balance live with the game; §17 says exactly
what and why.

**Kind:** `world-graph`

**Reading order:** after [`04-core.md`](04-core.md) §3 (the seam) and
[`10-simulation-kind.md`](10-simulation-kind.md), which this most closely resembles.

> **Scope of this document**
>
> The third engine-owned kind, expressed against the Kind seam. It reconciles a spatial,
> many-agent, tick-driven world with the `GameState` envelope, the
> one-action model, projection, reason codes, events and terminal identity.
>
> It is **not** a game design. The flagship game built on this kind — **Sun Trap** — lives
> in [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), the way
> Life in the Fast Lane lives in
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) — §17.

---

## 1. What This Kind Is

**A navigable world with autonomous inhabitants.** The player shapes the world — placing,
pricing, staffing — and never commands the inhabitants; they route themselves across it and
act on their own preferences. The world advances in fixed ticks through an ordered system
pipeline.

Where `story-graph`'s unit of play is *one choice* and `simulation`'s is *one week*, this
kind's is **a batch of ticks the caller chooses**.

> **`world-graph` and `story-graph` are not related, despite the names.** Both name the
> structure their `advance` walks, which is the naming convention — but a story graph is
> **authored**: its edges are choices a writer wrote, and traversal is the player picking
> one. A world graph is **navigated**: its edges are adjacency, and traversal is
> pathfinding by entities the player does not control. Sharing a suffix means they answer
> the same question about themselves, not that they share a mechanism. They share no code.

> **Why not `management-simulation`, the name the draft proposed.** It fails §1a twice.
> *Management* is a theme, and §1a says themes are campaigns — a colony sim, an ecosystem
> model or a transport network would run on this identical kind and none of them is
> management. And the `-simulation` suffix implies a specialization of the `simulation`
> kind, which it is not: they are siblings with entirely different `advance` bodies.

---

## 2. Why It Is a Kind

Applied against the test in [`02-architecture.md`](02-architecture.md) §1a, and it reaches
step 3 — but **not** for the reason the original draft gave.

The draft argued from state: spatial maps, hundreds of agents, queues, pathfinding,
construction. Every one of those is `kindState`, which is `unknown` to the core (04 §2), and
§1a's table disqualifies state richness explicitly. Had that argument been accepted, it
would equally have licensed a separate kind per resort theme.

What actually qualifies it is **code the campaign tier cannot carry**: A\* pathfinding and
guest utility scoring. Putting those behind a data-driven switch is the universal rules DSL
architecture N2 rejected. So one kind — and every hotel, theme park, nightclub district and
festival ground after it is a **campaign** of that kind.

> **Its closest relative is `simulation`, not `story-graph`.** Both are *mutate pending
> configuration, then resolve a block of simulated time through an ordered pipeline*. They
> differ by the size of the block, which §1a's table says is a parameter, not a model. That
> shared archetype is why every seam change this kind forced (§5) turned out to be one
> `simulation` needed too.

---

## 3. `KindState` — What Belongs Here

**The draft's `ResortGameState` is not this kind's state.** It was written as a standalone
engine's envelope and carries six fields the core owns, plus one the core bans. Reproducing
it would be the envelope-duplication defect `CLAUDE.md` names as this project's recurring
one — this is its **fifth** occurrence, after 03 §8.1, 04 §10.1, 03 §9 and 10 §2.
`CLAUDE.md` carries the full ledger.

| Draft field | Where it belongs now |
|---|---|
| `version` | `GameState.formatVersion` — the envelope (04 §2) |
| `gameId` | The envelope, from the `IdSource` port (06 §5.1) |
| `seed` | The envelope — the *only* randomness state |
| `status` | The envelope — and its union is wrong; see §8 |
| `commandLog` | `GameState.actionLog` — the replay spine |
| `metadata` | The session-store record, outside replayable state (04 §7) |
| **`rng: RngState`** | **Nowhere.** 04 §2 bans persisted generator state: streams derive from `(seed, streamId)`, so a stored `RngState` is written every action, read by nothing, and free to drift from the derivable truth |

What remains is the kind's own:

```typescript
interface WorldGraphKindState {
  tick: number;                                   // §4 — the only authoritative clock field

  map: WorldMap;                                  // terrain, zones, spawns, exits, revision
  finances: Finances;

  buildings: readonly Building[];
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];
  staff: readonly Staff[];

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  failures: readonly FailureProgress[];
  alerts: readonly Alert[];
  resolution: WorldResolution | null;              // immutable once system 18 sets it

  counters: WorldCounters;
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];
  unlockedAchievementIds: readonly string[];

  nextEntityOrdinal: number;                      // §9 — the deterministic id source
}
```

> **The draft's `ResortMap` is named `WorldMap` here.** §1 rejects the name
> `management-simulation` on the grounds that *a colony sim, an ecosystem model or a
> transport network would run on this identical kind* — and a type called `ResortMap` in
> engine-owned code contradicts that argument in the most visible place it could, the state
> interface. Both built kinds use structural names (`Node`, `Choice`; `ActorState`,
> `PlayerState`), never themed ones. `Guest`, `Staff` and `Building` **stay**: they name
> structural roles this kind models — an autonomous visitor that arrives with needs and
> departs, an employee the player pays and assigns, a placed structure with a footprint —
> and they read correctly for a colony or a transport network. `Resort` names a *theme*;
> the other three name *roles*.

> **The clock collapses to `tick`.** The draft's `ResortClock` carries
> `ticksPerMinute`, `minute`, `hour`, `day` and `paused`, then states that "only `tick` is
> authoritative. Other values may be derived." Derived values do not belong in serialized
> state — they can disagree with what they summarise, and the disagreement is unresolvable
> (the rule 10 §2 applied to `totalTimeCost`). `ticksPerDay` is campaign data; the rest
> are computed on read. **`paused` is a client concern** — the engine advances only when
> told to (§4), so there is nothing for the engine to pause.

> **`history` is not adopted**, for the reason 10 §2 gives: it overlaps `StateChange[]`
> (04 §12) and the event stream (05). Three records of the same events is what the
> duplication rule exists to prevent. Carried in
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) alongside the same question for `simulation`.

> **`alerts` is retained and is genuinely state**, because an alert persists until
> dismissed and dismissal is a player action. It is not a duplicate of `OutcomeMessage`,
> which is per-resolution and not persisted.

### 3.1 `initialState`

`Kind.initialState(campaign, ctx)` (04 §3) resolves `WorldGraphCampaign.startScenarioId`,
resolves that scenario's `mapId`, materializes the selected `MapDefinition` as `WorldMap`,
then applies starting cash, unlocks, active policies, pre-placed buildings/scenery, zeroed
counters, objective/failure progress, empty achievement unlocks, `map.revision: 0`,
`resolution: null`, and `tick: 0`. Queues start empty with no service clock, and no guest or
staff exists before later actions/systems create one. The conversion is deterministic:
terrain cells are emitted in row-major `(y, x)` order; derived grid edges use W44's fixed
neighbour order; scenario placements are allocated in their authored order.

Two rules the seam already implies, stated because a spatial kind is the first place they
bite:

- **Pre-placed buildings, their queues, and scenery take ids from `nextEntityOrdinal` like
  any other** (§9), assigned in authored order: building then queue for every
  `buildingPlacement`, followed by all `sceneryPlacements`. A scenario with three buildings
  and two scenery placements starts with `nextEntityOrdinal: 8`; ids are a pure function of
  the campaign, never load order or a host id source.
- **Any randomness in setup draws from `ctx.derive({ kind: "tick", tick: 0, system })`**, not
  from `ctx.rng`. `initialState` is not an action and has no `seq`; keying setup by tick 0
  keeps §5's rule — *this kind never touches the action stream* — true without exception.

`InitialStateResult.status` may be `"ended"` at creation, exactly as `story-graph` may settle
onto an ending before the player acts (04 §3). For this kind that means a scenario whose
objectives are already satisfied or whose failure condition already holds at tick 0 — a valid
campaign that Tier 2 should warn about (§15), not a crash. Setup evaluates both sets against
the same initialized state, applies `resolutionPrecedence`, and stores the same immutable
`WorldResolution` system 18 would; it does not run the tick pipeline.

### 3.2 Runtime-State Type Contract (engine-owned)

The types below are now the complete closure required by §3. **All identifiers are opaque
strings unless a dedicated namespace is stated — opaque in *meaning*, with exactly one
constraint on their *shape*: no identifier may contain a `.`.** §13's audit paths are
dot-separated, so a dot inside an id makes a path parse two ways; the rule is stated at
Tier 1 in §15 and argued in §13. Nothing else about an id is constrained, and no code may
infer anything from one.

Two reading conventions:

- **`// MVP-inert`** marks a field the flagship game's own MVP (Sun Trap's `mvp.md` §4, in
  its repository — not this repository's [`MVP.md`](MVP.md)) puts out of
  scope. It is specified anyway — the `simulation` precedent is unambiguous, since W32–W35
  ported the whole upstream contract far beyond what "Stable Life" ever used — and marked
  **at the field** so the build units know what may stay inert without it reading as an
  omission. A separate table would drift from the fields it describes.
- **Every `number` states its scale**, because a bare one is a scale a reader has to guess.
  Money is integer cents, time is ticks, and anything bounded names its bounds.

```typescript
interface WorldGraphKindState {
  tick: number;                                      // authoritative tick counter
  map: WorldMap;                                     // terrain, zones, spawns, exits, revision
  finances: Finances;

  buildings: readonly Building[];                    // includes nested Queue
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];                          // includes full guest path, need, and condition state
  staff: readonly Staff[];                           // includes nested StaffTask

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  failures: readonly FailureProgress[];
  alerts: readonly Alert[];
  resolution: WorldResolution | null;                // immutable once system 18 sets it

  counters: WorldCounters;
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];              // MVP-inert
  unlockedAchievementIds: readonly string[];       // MVP-inert; authoritative in-game mirror

  nextEntityOrdinal: number;                         // deterministic id source, never `IdSource`
}

type Position = {
  x: number;         // integer grid coordinate, same origin as map terrain
  y: number;         // integer grid coordinate, same origin as map terrain
};

type StaffStatus = "idle" | "to_work" | "working" | "off_duty";
type GuestLifecycle = "arriving" | "seeking" | "queued" | "served" | "departed" | "removed";
type BuildingStatus = "open" | "closed" | "broken";
type LoanStatus = "active" | "defaulted" | "repaid";
type IncidentSeverity = "info" | "minor" | "major" | "critical";
type AlertSeverity = "info" | "warning" | "critical";
type AlertType = "incident_active" | "building_broken" | "scenario_resolved";
type ObjectiveProgressState = "active" | "met" | "failed";
type FailureProgressState = "active" | "triggered";
type StaffTaskType = "service" | "clean" | "restock" | "build";
type StaffTaskStatus = "assigned" | "in_progress" | "completed" | "cancelled";
type Rotation = 0 | 90 | 180 | 270;
type GuestNeedValue = number;      // integer within the referenced NeedDefinition range
type PercentBasis = number;        // integer basis points, where 10000 = 100%
type GuestDepartureReason =
  | "stay_complete" | "unaffordable" | "unreachable" | "dissatisfied"
  | "unsafe" | "critical_need" | "ejected" | "scenario";

type GuestIntent =
  | {
      kind: "seek_service";
      buildingId: string;
      productId: string | null;              // null for a non-product service
      selectedAtTick: number;
    }
  | { kind: "leave"; exit: Position; reason: GuestDepartureReason; selectedAtTick: number }
  | { kind: "wait"; untilTick: number; selectedAtTick: number };

interface WorldMap {
  width: number;                             // positive integer, map width in tiles
  height: number;                            // positive integer, map height in tiles
  revision: number;                          // non-negative integer; changes whenever walkability changes
  terrain: readonly TerrainCell[];           // deterministic terrain graph
  paths: readonly PathCell[];                // explicit path graph edges, derived caches must be recomputed
  zones: readonly Zone[];                    // zones of operation and policy scope
  spawnPoints: readonly Position[];           // at least one guest-spawn point required
  exits: readonly Position[];                // at least one exit point required
  scenery: readonly Scenery[];               // scenario-authored placements, materialized at setup
}

interface TerrainCell {
  x: number;                                // integer [0, width)
  y: number;                                // integer [0, height)
  terrainId: string;                        // TerrainDefinition id; traits/cost stay in campaign content
}

interface PathCell {
  from: Position;
  to: Position;
  edgeCost: number;                         // non-negative integer; distance-only, no float metrics in state
  allowed: boolean;                         // if false, this edge is never traversed
}

interface Zone {
  id: string;
  nameKey: LocKey;                          // localization key for projection/debug
  cells: readonly Position[];               // canonical zone footprint, row-major by (y, x)
  serviceRadius: number;                    // integer tile radius from zone centroid
  maxOccupancy: number | null;              // null = unlimited
}

interface Scenery {
  id: string;                               // `<scenery>:<ordinal>` from `nextEntityOrdinal`
  definitionId: string;                     // SceneryDefinition id
  x: number;                                // integer tile x of anchored origin
  y: number;                                // integer tile y of anchored origin
  width: number;                            // positive integer tile width after rotation
  height: number;                           // positive integer tile height after rotation
  rotation: Rotation;
}

interface Building {
  id: string;                               // `<building>:<ordinal>` from `nextEntityOrdinal`
  definitionId: string;                     // campaign content contract
  x: number;                                // integer tile x of anchored origin
  y: number;                                // integer tile y of anchored origin
  width: number;                            // integer tile width from definition
  height: number;                           // integer tile height from definition
  rotation: Rotation;                       // all four declared; a scenario narrows it at Tier 1
  status: BuildingStatus;                    // sole open/closed/broken authority
  buildStartTick: number;                   // inclusive tick when building entered state
  wear: number;                             // integer 0..100, higher is healthier
  cleanliness: number;                      // integer 0..100, higher is cleaner
  queue: Queue;
  pricesCents: Readonly<Record<string, number>>;  // product id → integer cents; definition-closed keys
  inventory: Readonly<Record<string, number | null>>; // product id → units; null = unlimited
}

interface ConstructionSite {
  id: string;                               // `<construction-site>:<ordinal>`
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;                       // must match building rotation shape
  startedAtTick: number;
  workRemaining: number;                    // non-negative integer builder-effort units
  completedBuildingId: string;              // reserved when the site is created
  completedQueueId: string;                 // reserved with the building id
}

interface Queue {
  id: string;                               // `<queue>:<ordinal>` from `nextEntityOrdinal`
  guestIds: readonly string[];              // semantic FIFO arrival order; never globally sorted
  serviceStartedAtTick: number | null;       // clock for current head; null when no service runs
}

interface Guest {
  id: string;                               // `<guest>:<ordinal>`
  archetypeId: string;                      // content contract
  lifecycle: GuestLifecycle;
  tickEntered: number;                      // authoritative timeline event
  stayDurationTicks: number;                // positive sampled archetype stay duration
  x: number;
  y: number;
  path: readonly Position[];                // stateful route, excluding cached distance fields
  pathIndex: number;                        // index into `path`, non-negative integer
  drawCount: number;                        // next agent-stream sequence number
  cashCents: number;                        // non-negative integer cents
  intent: GuestIntent;                      // one authoritative destination/fallback choice
  needs: Readonly<Record<string, GuestNeedValue>>; // NeedDefinition id → declared-scale value
  conditions: Readonly<Record<string, number>>;    // GuestConditionDefinition id → declared-scale value
  opinions: Readonly<Record<string, number>>;      // OpinionDefinition id → declared-scale value
  preferences: Readonly<Record<string, number>>;   // PreferenceDefinition id → declared-scale value
  satisfaction: number;                     // integer 0..100
  patienceCapacityTicks: number;             // sampled non-negative per-queue patience
  patienceRemainingTicks: number;            // non-negative integer, decrements while queued/unserved
  lastServedTick: number | null;            // null until first served
  spentTicks: number;                       // non-negative integer, ticks alive in the world
}

interface Staff {
  id: string;                               // `<staff>:<ordinal>`
  roleId: string;                           // content contract
  x: number;
  y: number;
  status: StaffStatus;
  path: readonly Position[];                // committed route, same persistence rule as Guest.path
  pathIndex: number;                        // non-negative index into path
  moveProgressTicks: number;                // ticks accrued toward the next edge
  assignedBuildingId: string | null;
  assignedZoneId: string | null;            // MVP-inert — the only stored zone membership
  drawCount: number;                        // agent-level deterministic draw counter
  task: StaffTask | null;                   // singular active task
  tasksCompleted: number;                   // cumulative counter, monotonic
}

interface StaffTask {
  id: string;                               // `<staff-task>:<ordinal>` (nested entity id)
  type: StaffTaskType;
  status: StaffTaskStatus;
  guestId: string | null;
  queueId: string | null;
  buildingId: string | null;
  constructionSiteId: string | null;
  incidentId: string | null;
  targetProductId: string | null;
  startedAtTick: number;
  endedAtTick: number | null;
  priority: number;                         // deterministic tie-break source for dispatch
  effortRemaining: number | null;           // null = continuing service duty; otherwise work units
}

// Runtime invariant by type:
// service → buildingId + queueId, null effort
// clean   → incidentId, finite effort
// restock → buildingId + targetProductId, finite effort
// build   → constructionSiteId, finite effort

interface Finances {
  cashCents: number;                        // integer cents
  revenueTodayCents: number;                // integer cents, resets at each day boundary (§3.3)
  expensesTodayCents: number;               // integer cents, resets at each day boundary (§3.3)
  revenueTotalCents: number;                // integer cents
  expensesTotalCents: number;               // integer cents
  loan: Loan | null;                        // MVP-inert
}

interface Loan {
  id: string;
  principalCents: number;                   // integer cents
  balanceCents: number;                     // integer cents
  interestBasisPoints: PercentBasis;         // integer bps
  accruedInterestCents: number;             // integer cents
  status: LoanStatus;
  startedAtTick: number;
  durationTicks: number;                    // integer, total duration
  nextPaymentTick: number | null;           // null while settled
}

interface Incident {
  id: string;
  definitionId: string;                     // IncidentDefinition id
  buildingId: string | null;
  guestId: string | null;
  zoneId: string | null;
  position: Position | null;                // durable target when no surviving entity owns it
  amount: number;                           // positive integer occurrence units; litter uses this
  startedAtTick: number;
  expiresAtTick: number | null;
  resolvedAtTick: number | null;
}

interface ObjectiveProgress {
  id: string;                               // objective id (published)
  state: ObjectiveProgressState;
  value: number;                            // W44's canonical integer projection of progress
  target: number;                           // integer target threshold
  satisfiedSinceTick: number | null;         // null until the completion condition becomes true
  updatedAtTick: number;
}

interface FailureProgress {
  id: string;                               // failure-definition id (published)
  state: FailureProgressState;
  satisfiedSinceTick: number | null;         // null until the failure condition becomes true
  updatedAtTick: number;
}

interface Alert {
  id: string;                               // `<alert>:<ordinal>`
  type: AlertType;                          // closed system-19 family
  semanticKey: string;                      // engine-derived dedup key; never player/authored text
  severity: AlertSeverity;
  titleKey: LocKey;
  messageKey: LocKey;
  entityId: string | null;                  // owning entity when applicable
  issuedAtTick: number;
  dismissedAtTick: number | null;
  clearedAtTick: number | null;             // source condition no longer active
}

interface WorldResolution {
  resolution: "objectives_met" | "failed";
  objectiveIds: readonly string[];          // objectives met at terminal, definition-id order
  failureId: string | null;                 // non-null exactly for failed resolution
  resolvedAtTick: number;                   // processing tick that system 18 resolved
}

interface WorldCounters {
  guestsEntered: number;                     // non-negative monotonic count
  guestsDeparted: number;                    // non-negative monotonic count
  guestsDissatisfied: number;                // non-negative monotonic count
  servicesCompleted: number;                 // non-negative monotonic count
  buildingsCompleted: number;                // non-negative monotonic count
  incidentsRaised: number;                   // non-negative monotonic count
  litterCreated: number;                     // non-negative monotonic units
  litterCleaned: number;                     // non-negative monotonic units
}
```

### 3.3 Structural Answers, and What Remains the Game's

Five questions the draft left open, all settled here — because each turns out to be an
application of a rule this contract already owns rather than a question about what the game
contains — followed by two fields whose *absence* needs saying out loud.

The test that separates them: **would a different answer change what the engine is allowed
to store, or only what the game contains?** The first is this repository's; the second is
the game's. Three of these read as content-design questions and were the first kind.

**1 — `Building.entrances` is not runtime state.** An entrance position is *derived*:
`(x, y)` plus `rotation` plus the definition's authored offsets. §3's clock callout bans
derived values from serialized state — *they can disagree with what they summarise, and the
disagreement is unresolvable* — and an absolute `entrances` array is the same defect as the
persisted `rng` it sat four fields away from. Storing footprint-relative offsets on the
instance is the third option and is also declined: it copies the definition into every
placed building, so a definition edit and its instances can diverge.

The **rotation transform is stated here anyway**, even though the offsets themselves are
content (§14.3), because rotating an integer offset is a determinism concern and leaving it
to be re-derived per call site is how two call sites end up disagreeing. For a definition
of width `w` and height `h`, an authored offset `(ox, oy)` relative to the unrotated
footprint's origin maps to:

```text
  0°  → (ox,          oy)
 90°  → (h - 1 - oy,  ox)
180°  → (w - 1 - ox,  h - 1 - oy)
270°  → (oy,          w - 1 - ox)
```

and the absolute cell is the building's `(x, y)` plus that result. All integer, so the
transform is exact. §14.3 defines `EntranceOffset`, and `BuildingDefinition` owns the values.

**2 — Rotation declares all four values.** `0 | 90 | 180 | 270` costs nothing if a scenario
only ever authors `0`, and Tier 1 (§15) is where a scenario narrows it. This is the general
rule for a seam an answer cannot change: **specify permissively, and validate narrowly.**

**3 — Guest meters are content-declared records, not fixed engine vocabularies.** Sun Trap's
MVP needs `thirst` and `toilet`, while the W42 draft hard-coded neither; its wider design
also names conditions and opinions another campaign may never use. `Guest.needs`,
`conditions`, `opinions`, and `preferences` are therefore records whose keys are declared
by the four definition catalogs in §14. A guest archetype supplies every initial key/value;
Tier 1 rejects missing, extra, or out-of-range keys. The mechanical fields every campaign
shares — satisfaction, patience, service time, cash, targets — remain explicit fields on
`Guest`.

This does not turn evaluation into state. Staff behaviour, accessibility, noise, travel
cost, and queue length remain decision-time inputs W44 computes from the world. Only a meter
a system carries across ticks belongs in one of the four records. The membership test still
holds: a value no system writes, no condition reads, and no projection exposes does not earn
a serialized key merely because one game design names it.

**4 — Departed guests are pruned.** A guest reaching `"departed"` or `"removed"` is removed
from `guests` by system 20 of the tick that finalized that lifecycle state. API batch
boundaries are irrelevant (§5). Without this, state grows without bound across a scenario —
and every departed guest still carries
`path`, `needs`, `conditions`, `opinions` and `preferences`, so the per-guest cost is not
small. A serialized save *is* `serialize()` output, which makes unbounded growth a
correctness concern and not merely a performance one. Nothing is lost that matters:
objective accumulators live in `ObjectiveProgress`, and per-guest history is an **event**
(§12), where it is discardable by design.

**5 — The "today" boundary is a pure function of `tick`.** `revenueTodayCents` and
`expensesTodayCents` are genuine accumulators — today's revenue cannot be recovered from
cash — so unlike entrances they stay. They reset on **the first tick of a new day**, where
the day is `floor(tick / ticksPerDay)` and `ticksPerDay` is campaign data, validated
positive at Tier 1 (§15). No day field is stored, so §3's rule that the clock collapses to
`tick` alone holds. **The *value* of `ticksPerDay` is balance and belongs to the game; the
rule does not depend on it.**

**6 — Two fields are deliberately absent, and their absence is the point.** A `Staff.zoneId`
"current zone at read time" alias would be a derived value beside the stored
`assignedZoneId` it derives from — banned by the same rule as entrances. A
`Guest.arrivalTick` alias would restate `Guest.tickEntered`. Both are the
duplication defect one level down: *inside* `kindState` rather than against the envelope.

**What genuinely remains the game's** is the concrete content: which entrance offsets,
need/opinion vocabularies, prices, curves, and `ticksPerDay` value it authors. §14 owns the
shape and validation; §17 leaves the values and balance with the game.

`queue`, `staff task`, and nested entity collections are not top-level collections. Their ids are
still derived from `nextEntityOrdinal` at creation.

> **The open-keyed records, reconciled against N6.** `Building.pricesCents`/`inventory` and
> `Guest.needs`/`conditions`/`opinions`/`preferences` are `Readonly<Record<...>>`, which
> [`02-architecture.md`](02-architecture.md) N6
> bans as a loose bag. `10 §6.2` already answered this for `ActorState`'s
> `skills`/`reputation`/`flags`/`counters`, and the argument transfers unchanged: **a record
> whose keys are declared by validated content is not a loose bag, because Tier 1 closes the
> key set at load.** Building record keys are exactly the placed definition's service
> product ids (empty for non-service operations); guest record keys are exactly those in
> the archetype profiles, which must resolve in their definition
> catalogs. A key outside either set is Tier 1, not a runtime surprise. Written out rather
> than assumed, because an unexamined `Record<string, number>` is indistinguishable on the
> page from the thing N6 bans.

### 3.4 Canonical collection order

All serialized arrays are iterated in id order for contract behavior, not insertion order:

- `buildings`, `constructionSites`, `guests`, `staff`, `incidents`,
  `objectives`, `failures`, and `alerts` are all canonicalized by each element's `id`
  before any system touch.
- `map.scenery` is canonical by its derived entity id; `unlockedContent` is canonical by
  `(kind, id)`; `activePolicyIds` and `unlockedAchievementIds` are lexicographic by id.
- For each `Building`, `queue.guestIds` is semantic FIFO order. Same-tick arrivals append by
  guest entity id; removal preserves survivors and rejoining appends at the tail.
- For each `Staff`, `task` is singularly active in this unit, but if history snapshots are stored in
  a future extension, they must be canonical by `StaffTask.id`.

This rule keeps unrelated entities stable under insertion/removal while preserving the one
collection whose order is itself gameplay state.

**Id order is `(prefix, ordinal)` with the ordinal compared numerically, never
lexicographically.** `building:10` sorts *after* `building:2`, which a plain string
comparison gets backwards — and a comparator that gets it backwards is a determinism defect
that appears only once a scenario runs past nine entities of one prefix, which is precisely
the kind of bug this document exists to prevent.

**The reducers maintain the order rather than re-sorting for it.** Every entity collection
governed by `nextEntityOrdinal` appends in allocation order, so insertion order *is* id
order and removal preserves it. Content-reference and published-id arrays insert in their
declared canonical order; removing or toggling an entry preserves that order. Canonical
order is therefore an invariant to test rather than a sort to run on every system pass — a
500-guest sort per tick would be the dominant cost in a 360-tick batch.

---

## 4. The Turn Is a Tick Batch

Actions split into two groups, exactly as `simulation`'s do:

```text
build · demolish · hire_staff · fire_staff · assign_staff ·
set_price · open_building · close_building ·
dismiss_alert                                      → mutate the world, no time passes

advance_ticks { ticks }                            → run the tick pipeline `ticks` times
```

**Nine mutate without advancing time, not eight.** `dismiss_alert` is one of them: §3 makes
an alert state precisely because it persists until dismissed and dismissal is a player
action, and §6 has always listed it. An earlier revision of this split omitted it, and the
undercount spread to two other documents before it was caught.

### 4.1 One atomic tick

**The pipeline order is normative.** At the beginning of every loop iteration:

```typescript
const processingTick = state.tick;
```

Systems 1–19 read that immutable value. System 20 performs cleanup and sets
`state.tick = processingTick + 1` exactly once. No system reads the requested batch size,
`ctx.seq`, or whether a previous API call processed the preceding tick. A terminal result
does not interrupt the tick: systems 19 and 20 still run, then the outer loop stops before
starting another iteration.

Initial `tick: 0` therefore means zero completed ticks and tick 0 is next. Day `d` begins
when `floor(processingTick / ticksPerDay) === d` and
`processingTick % ticksPerDay === 0`; system 1 resets the daily accumulators before any
new-tick amount is recorded.

```text
 1  scenario             11  staff-work
 2  guest-spawn          12  construction
 3  guest-needs          13  buildings
 4  guest-service        14  cleanliness-wear
 5  queues               15  finance
 6  guest-intent         16  incidents
 7  guest-path           17  objectives
 8  guest-move           18  failure
 9  task-generate        19  alerts
10  task-assign          20  tick-finalize
```

### 4.2 Tick scratch and complete comparators

`TickScratch` is a disposable value initialized for one tick. It may carry validated
content indexes, path/distance caches keyed by `map.revision`, transient `TaskCandidate`s,
typed service/construction/finance/cleanliness deltas, and batch-change aggregation
metadata. It is never serialized, projected, or read by `outcome()`. Disabling every cache
must leave state, changes, messages, events, and outcome identical.

The following comparators are the only canonical orders systems may use:

| Domain | Complete comparator |
|---|---|
| Runtime entity | prefix lexicographic, then numeric ordinal |
| Definition | validated id, ordinal-code-unit lexicographic |
| Position | row-major `(y, x)` |
| Queue | persisted FIFO arrival position; same-tick admissions by runtime entity id |
| Utility candidate | utility descending, building entity id, product id (`null` first) |
| Task candidate | priority descending, path cost ascending, task-kind order, target entity id or position, source definition id, required role id (`null` first), slot ordinal |
| Path-search open node | accumulated cost `g` ascending, then position row-major (§9.3 — the search carries no heuristic, so there is no `f`/`h` to order by first) |
| Equal-cost path parent | predecessor position row-major |
| Scheduled effect | due tick, priority descending, source definition id, authored change index, authored effect index |

The task-kind order is `service`, `clean`, `restock`, `build`. A definition id is not an
entity id, and a coordinate has no id; “ties use entity id” is therefore not a complete
rule and is superseded by this registry.

### 4.3 System 1 — `scenario`

**Reads:** `processingTick`, the selected scenario's scheduled changes, active policies,
and their conditions. **Writes:** daily finance resets and typed effects. **Order:** reset
daily accumulators first at a day boundary; snapshot conditions against system-entry state;
then apply due changes by the scheduled-effect comparator. Finally apply active policies by
definition id, with `whileActive` effects in authored order. Effects never change another
condition snapshot in this system. **No-op:** no boundary, due change, or active-policy tick effect.
**Records:** `scenario.effect.applied`; scalar effects join the batch `StateChange`
aggregator under `scenario_effect`.

### 4.4 System 2 — `guest-spawn`

**Reads:** the scenario spawn rule, active guest count, spawn points, and archetype pool.
**Writes:** new guests, `guestsEntered`, and `nextEntityOrdinal`. **Order:** one spawn rule
per scenario; spawn points row-major and pool entries by archetype id before weighted
selection. The only RNG is `tick:${processingTick}:guest-spawn`. A successful spawn gets
the next entity id; cash, stay, patience, satisfaction, and ranged meters then draw in field
order from `agent:${guestId}:${drawCount}`, incrementing after each draw. It starts with a
`lifecycle: "arriving"` and a `wait` intent expiring now. Failed capacity/schedule checks
allocate nothing and draw
nothing. **No-op:** terminal state, non-spawn tick, or active cap reached. **Records:**
`guest.spawned`; membership change is hidden and batch-aggregated.

### 4.5 System 3 — `guest-needs`

**Reads:** active guests, meter definitions/profiles, and active typed effects. **Writes:**
meter values, `spentTicks`, satisfaction, queued patience, and a typed leave/wait intent
when a configured threshold is crossed. **Order:** guests by entity id; meter kinds in
`need`, `condition`, `opinion`, `preference` order; definition ids within each kind. Sum all
deltas for one meter, then clamp once. Queued patience decrements before system 4, never
below zero. Reaching `stayDurationTicks` selects leave with `stay_complete` unless the guest
is already in a service that completes in system 4; that completion wins, then system 5
materializes leave. An arriving guest becomes `seeking` after its first update. **No-op:**
no non-terminal guests. **Records:** trace-only
`guest.meter.changed`; no per-meter `StateChange`.

### 4.6 System 4 — `guest-service`

**Reads:** buildings, FIFO queue heads, `serviceStartedAtTick`, head intents, prices,
inventory, product/service definitions, and staff requirements. **Writes:** guest/building
cash and stock, finance totals, product effects, service/litter incidents, counters, and
guest lifecycle. **Order:** buildings by entity id. A positive-duration service started at
tick `s` completes on the first tick where
`processingTick - s >= serviceDurationTicks`; it cannot finish where it starts. At
completion revalidate the same guest, product, price, stock, and staff facts atomically. A
staff requirement counts only staff at the building with a valid `service` duty task; an
assignment alone is not labor. A
product sale subtracts price from guest cash, adds price minus unit cost to world cash,
adds price to revenue, adds unit cost to expenses, and decrements finite stock. Litter is a
durable incident occurrence at the guest position with the serving building id; its amount
increments `litterCreated` exactly once. **No-op:**
no due valid head. **Records:** `guest.served` and `incident.raised`; finance changes are
batch-aggregated, agent detail is event-only.

### 4.7 System 5 — `queues`

**Reads:** queues, guest intents/positions/patience, entrances, service eligibility, and
the pure utility evaluator from §9. **Writes:** FIFO membership, lifecycle, abandonment
intent, and `serviceStartedAtTick`. **Order:** buildings by entity id; preserve surviving
FIFO order; guests reaching one entrance in the same tick are admitted by entity id.
First remove the head completed by system 4 and every invalid member. Next abandon still-
queued guests whose patience is zero or whose best eligible alternative exceeds the current
candidate by `switchThresholdUtility`. Then admit arrivals up to capacity and start the
head clock only when the building can serve; clear an existing clock whenever its head or
service eligibility changes, so resumed service starts a full new duration. Completion on
the tick patience reaches zero wins because system 4 ran first. Admission resets
`patienceRemainingTicks` to the guest's sampled capacity. A served guest becomes `seeking`
with `wait.untilTick = processingTick` so system 6 must choose again, unless its
stay/threshold state requires leave. Abandonment uses the same immediate wait intent;
rejoining always appends. **No-op:** no queue mutation or start. **Records:**
`queue.joined`, `queue.abandoned`, `service.started`; membership detail is event-only.

### 4.8 System 6 — `guest-intent`

**Reads:** seeking guests, content, finances, buildings, queues, incidents, and canonical
path costs. **Writes:** the single `Guest.intent`; a changed destination clears the
committed path and resets its index. **Order:** guests by entity id; candidates use §9's
eligibility, component, and comparator rules. Queued and currently served guests are not
rescored. If no candidate survives, materialize the archetype's typed fallback. Any
content-declared random choice uses `agent:${guest.id}:${guest.drawCount}` and increments
the counter immediately; deterministic scoring consumes no draw. **No-op:** no guest needs
a decision. **Records:** `guest.intent.selected` with optional trace components; no audit
row.

### 4.9 System 7 — `guest-path`

**Reads:** service/leave intents, committed paths, map revision, dynamic footprints, and
definition entrances. **Writes:** `Guest.path` and `pathIndex`. **Order:** guests by id;
goals row-major; canonical replanning follows §9. A changed target has no old path to preserve. A path made
invalid by a map revision remains committed only until canonical replanning succeeds; on
failure it is cleared and the archetype fallback is materialized. **No-op:** waiting,
queued, served, already-at-goal, or still-valid path. **Records:**
`guest.path.committed` or `guest.path.failed` for an actual attempted commitment.

### 4.10 System 8 — `guest-move`

**Reads:** guest paths and lifecycle. **Writes:** position, path index, and departure
lifecycle. **Order:** guests by id. An eligible guest moves at most one directed edge per
tick; overlap is allowed in v1. Reaching a service entrance makes the guest eligible for
system 5 on the next tick—it does not enqueue here because queues already ran. Reaching an
exit under a leave intent marks `departed`, increments departure counters, and leaves
pruning to system 20. **No-op:** no movable guest. **Records:** `guest.moved` at trace and
`guest.departed` at debug; no per-edge audit row.

### 4.11 System 9 — `task-generate`

**Reads:** unresolved staff-resolvable incidents, finite inventory, queue demand,
construction sites, role capabilities, and path costs. **Writes:** canonical transient
`TaskCandidate`s in scratch only. A candidate has task kind, typed target, priority,
required effort (`null` for continuing service duty), path cost, source definition id,
required role id, and slot ordinal; it has no entity id. Service demand creates one
candidate for each missing `(roleId, slot)` from `StaffRequirement.count`. Priority comes
directly from the owning service operation, service
product, building definition, or incident definition—systems add no hidden weighting.
Finite effort is incident amount for clean, missing units to capacity for restock, and site
work remaining for build. `path cost` in the comparator is calculated from the currently
considered staff member; it is scratch, not candidate state shared across staff.
**Order:** generate by the task tuple with path omitted; system 10 inserts the current
staff's path cost and applies the complete comparator. **No-op:** no demand or compatible role.
**Records:** optional `task.candidate.generated` trace; no state, event at normal levels, or
`StateChange`.

### 4.12 System 10 — `task-assign`

**Reads:** staff, valid existing tasks, and scratch candidates. **Writes:** new persisted
tasks, staff paths/status, and `nextEntityOrdinal`. **Order:** preserve valid assignments;
when service demand shrinks, preserve the lowest staff ids up to each role count and cancel
the rest;
canonically replan a preserved task whose committed path was invalidated, cancelling it if
the target is now unreachable; then idle staff by id greedily take their highest compatible
candidate. Remove a candidate
after assignment. Only assignment allocates a task id. Plan the canonical staff path at
the same moment; unreachable candidates were ineligible in system 9. **No-op:** no
assignment, replan, or cancellation. **Records:** `staff.task.assigned`; hidden membership
audit only; invalid preserved work emits `staff.task.cancelled`.

### 4.13 System 11 — `staff-work`

**Reads:** assigned tasks, role work/movement rates, committed paths, and targets.
**Writes:** staff position/path/status, task effort/status, incident resolution, and typed
work deltas for systems 12–14. **Order:** staff by id. Away from target, increment
`moveProgressTicks`; when it reaches `moveTicksPerTile`, traverse one edge and reset it.
At target, subtract the role's positive `effortPerTick` once, clamped at zero. A `null`
effort is continuing service duty and remains valid while its queue demand exists. Missing
targets cancel deterministically. Cleaning first writes its incident's `resolvedAtTick`, then
applies `onResolve` effects; the occurrence is retained but no longer active during that list.
Only building-meter deltas defer to system 14; construction/restock deltas wait for their
owning systems.
**No-op:** off-duty or taskless staff. **Records:** task moved/completed/cancelled events;
no per-work-unit audit.

### 4.14 System 12 — `construction`

**Reads:** sites and builder deltas. **Writes:** remaining work, completed buildings/queues,
site removal, building counters, and `map.revision`. **Order:** sites by id; apply all
builder work, clamp once, then complete zero-effort sites in that order. Completion uses
the building and queue ids reserved when the site was created, so completion timing cannot
renumber later entities. The new building materializes definition defaults, and the site is
removed. Immediate-MVP construction bypasses sites in the `build` reducer. **No-op:** no
site receives work. **Records:** `construction.progressed`/`construction.completed` and
batch-grain entity/status changes.

### 4.15 System 13 — `buildings`

**Reads:** building operations and restock work. **Writes:** finite inventory
and non-wear operational status allowed by typed operation data. **Order:** buildings by id,
then product id. Restock moves units up to capacity; product unit cost is recognized exactly
once, atomically at service in system 4, not again here. Definitions with no restock source,
decorative and unsupported post-MVP operations are honest no-ops. This system never serves
guests or applies cleanliness/wear. **No-op:** no typed production/restock/status delta.
**Records:** `building.status.changed` and batch-grain scalar changes only when a public
status changes.

### 4.16 System 14 — `cleanliness-wear`

**Reads:** service, litter/incident, staff, policy, and typed effect deltas in scratch.
**Writes:** building cleanliness/wear, litter occurrence amounts, and broken/closure status.
**Order:** buildings by id; for each meter apply sources in `service`, `litter`, `incident`,
`staff`, `policy` order, sum, then clamp once to 0..100. Incident amounts are
updated by incident id. A zero amount resolves the occurrence; transition effects run once.
Cleaning increments `litterCleaned` by the amount removed, independently of definition
effects.
Wear reaching zero changes an open/closed building to `broken`; cleanliness alone never
inventively closes a building—the scenario may fail on it through content. **No-op:** no
delta. **Records:** `building.meter.changed` and `incident.resolved`; batch audit only
for status transitions, not noisy meter steps.

### 4.17 System 15 — `finance`

**Reads:** staff roles, open buildings, loan state, and `ticksPerDay`.
**Writes:** cash and expense totals plus enabled loan fields. **Order:** wages by staff id,
building operating costs by building id, then the one loan. Passive
rates use §9.4 cumulative proration. The MVP loan is `null`; no synthetic loan behavior is
invented. **No-op:** no due amount. **Records:** `finance.charged`; coalesced scalar audit
rows use first-before/final-after values.

### 4.18 System 16 — `incidents`

**Reads:** definitions, active/retained occurrences, trigger/resolution conditions, roll
scopes, and post-finance state. **Writes:** incident resolutions, new occurrences, grouped
effects, counters, and entity ids. **Order:** first resolve active occurrences by id when
`expiresAtTick <= processingTick` or their resolution condition is true. For each, write
`resolvedAtTick: processingTick` before applying its resolve effects once, so it is retained
but no longer active during that list. Then visit scopes in world, zone id, then building id
order; eligible definitions are by id.
An active occurrence, or a retained occurrence with
`processingTick < startedAtTick + cooldownTicks`, makes the same definition/scope
ineligible.
For each declared scope, draw chance and then weighted choice only from
`tick:${processingTick}:incidents`; no eligible scope consumes no draw. Allocate selected
occurrences in resolved scope order, then apply their grouped start effects before system 17.
Effect-started incidents from earlier systems are not rolled again. **No-op:** no eligible
resolution or successful roll. **Records:** `incident.resolved` and `incident.raised`.

### 4.19 System 17 — `objectives`

**Reads:** every objective and one immutable post-system-16 metric/condition snapshot shared
with system 18. **Writes:** progress value,
`satisfiedSinceTick`, state, completion effects, and timestamps. **Order:** evaluate every
objective against the snapshot first; then commit transitions/effects by definition id.
For a non-null `progressMetric`, the evaluator projects an integer value; exact rational
averages compare by cross multiplication and project by truncation toward zero. A null
metric preserves the value changed by ordered `objective_progress` effects. Tier 1 forbids
those effects from targeting metric-driven objectives. A duration of `n` is met on
the `n`th consecutive true tick, counting the current tick as one; false clears the start.
Completion effects run once. **No-op:** no changed value/condition/state. **Records:**
`objective.progressed`/`objective.met`; batch audit is coalesced per objective scalar.

### 4.20 System 18 — `failure`

**Reads:** all failure definitions/progress, objective states, scenario precedence, and the
same immutable post-system-16 snapshot as system 17. Objective completion effects do not
retroactively alter this tick's failure facts.
**Writes:** failure duration/state, unresolved objective terminal states, and immutable
`WorldResolution`. **Order:** failures by
definition id. Update all failure durations against the same system-entry state, then form
success (at least one objective and all met) and failure candidates. A scenario time limit
adds `timeLimitFailureId` when `processingTick + 1 >= timeLimitTicks`, so exactly the
declared number of ticks completes before the deadline fires; that referenced progress row
becomes `triggered` even when its own condition is false. If success and failure both
exist, apply `resolutionPrecedence`; multiple failures choose definition-id first. On a
failed result, mark every still-active objective `failed` after capturing the already-met
ids. Apply every newly triggered failure's `onTriggered` effects once in definition order,
even when `objectives_win` selects the terminal identity; then persist resolution once and
never rewrite it. Do not stop systems 19–20. **No-op:** no
progress or terminal change. **Records:** `failure.progressed`, `failure.triggered`, and
`scenario.resolved`; resolution identity is a visible batch audit.

### 4.21 System 19 — `alerts`

**Reads:** post-resolution incidents, finance, buildings, objectives, failures,
achievements, and current alerts. **Writes:** newly unlocked achievement ids, new alerts,
and `clearedAtTick`. **Order:** first evaluate still-locked achievements by definition id
against the post-resolution state and insert unlocks canonically; profile mirroring occurs
only after the whole action succeeds. Then process alert semantic keys and existing alert
ids. A semantic key is derived only from a closed alert family plus published ids; it
contains no player/authored text. Mark a source no longer active as cleared; create only a
newly active key not represented by an uncleared alert. Alert delivery never feeds another
system. **No-op:** no achievement or active-set transition. **Records:**
`achievement.unlocked`, `alert.raised`, and `alert.cleared`; alert creation/removal audits
are hidden.

The closed keys are `incident:<incidentId>`, `building-broken:<buildingId>`, and one
`scenario-resolved`. Incident alerts reuse the definition's name/description keys; the
other two use kind-owned `world-graph.alert.<type>.title|message` strings validated with
the kind's built-in content. No balance threshold is smuggled into alert derivation.

### 4.22 System 20 — `tick-finalize`

**Reads:** lifecycle, queues, tasks, resolved incidents, cleared/dismissed alerts, and
`processingTick`. **Writes:** referential cleanup and the sole tick increment. **Order:**
entity collections by id; queue survivors retain FIFO order. Remove departed/removed guests
now, not at API-batch end; clear their queue references; clear completed/cancelled nested
tasks. Retain a resolved incident until
`max(resolvedAtTick + 1, startedAtTick + cooldownTicks)`, then prune it; this preserves both
one following audit tick and cooldown memory without a second state table. Retain a cleared
or dismissed alert while its timestamp is greater than or equal to `processingTick`; prune
it once the timestamp is smaller. This makes both lifecycle fields observable across a save
boundary without retaining alert history. Assert no queue/task reference dangles, then
set `tick = processingTick + 1`. **No-op:** cleanup may be empty, but the tick increment is
unconditional. **Records:** `tick.finalized`; only the coalesced tick audit is returned.

### 4.23 Worked causal trace

The minimum W43 fixture takes several ticks; arrows are not permission to collapse phases:

```text
t0  guest-spawn creates guest → guest-needs drifts thirst → guest-intent selects stand
    → guest-path commits canonical path → guest-move advances one edge → tick-finalize commits t1
t1+ guest-move eventually reaches entrance
next queues admits FIFO and starts service
later guest-service transfers cents, applies drink effect, and creates litter incident
    → queues removes served head → task-generate derives clean task
    → task-assign gives it to cleaner → staff-work begins route
later staff-work resolves litter → cleanliness-wear applies recovery
    → objectives updates the shared post-incident facts → failure resolves if terminal
    → alerts reflects the result → tick-finalize commits and only then stops the batch
```

If the final objective and `bankrupt` both become true on the same tick, system 17 records
the objective, system 18 records the failure, and the scenario's
`resolutionPrecedence` selects exactly one immutable result. Under `objectives_win`, outcome
is `objectives_met` with all published objective ids and `failureId: null`; under
`failure_wins`, it is `failed` with the lexicographically first triggered failure id. Both
facts remain in progress state for audit; only terminal identity is singular.

---

## 5. Batch Invariance — and the Two Seam Changes It Forced

> **Batch invariance.** For any `a, b ≥ 0`, starting from identical kind state, campaign,
> and seed, `advance_ticks (a + b)` and `advance_ticks a` followed by `advance_ticks b`
> finish with deeply equal canonical `WorldGraphKindState`.

This is a kind-state property, not byte identity: the envelope action logs legitimately
differ. It is also stronger than `Outcome` equality—two worlds can share terminal ids while
cash, queues, paths, counters, or cleanup differ. W46 therefore compares the complete
canonical kind state after removing only the envelope action log; the replay oracle's
`Outcome` comparison remains an additional cross-version assertion.

Four rules make the property hold:

1. A batch is only the loop in §4.1; no system observes its requested length.
2. Cleanup occurs in `tick-finalize`, never after the outer loop.
3. This kind draws nothing from `ctx.rng` and never references `ctx.seq`.
4. World draws use `ctx.derive({ kind: "tick", tick: processingTick, system })`; agent
   draws use `ctx.derive({ kind: "agent", agentId, seq: drawCount })` and increment the
   stored counter immediately.

The last two rely on the already-built seam changes: `KindContext.derive` (04 §3.1) and
`StreamId`'s `tick` variant (04 §8). `derive` closes over the seed and persists nothing, so
`{ seed, actionLog }` remains the complete replay input.

Events are compared separately. Tick/entity events are identical across partitions;
`batch.started` and `batch.ended` legitimately differ because they diagnose API calls.
`StateChange[]` may also be partitioned differently because each call returns its own batch
audit. Neither difference may reach final kind state.

---

## 6. Actions — One Model, Spatial Verbs

04 §3's action is a string `actionId` plus optional `params`. The mapping:

| `actionId` | `params` | Effect |
|---|---|---|
| `build` | `{ definitionId, x, y, rotation }` | Place a building or open a construction site |
| `demolish` | `{ buildingId }` | Remove a building |
| `hire_staff` | `{ definitionId }` | Add a staff member |
| `fire_staff` | `{ staffId }` | Remove a staff member |
| `assign_staff` | `{ staffId, zoneId? , buildingId? }` | Change an assignment |
| `set_price` | `{ buildingId, productId, priceCents }` | Set one price |
| `open_building` / `close_building` | `{ buildingId }` | Toggle operation |
| `dismiss_alert` | `{ alertId }` | Clear a persisted alert (§3) |
| `advance_ticks` | `{ ticks }` | Run the pipeline (§4) |

Every one is a `submitAction` appending one `LoggedAction`. All parameters are **declared
ids, integers, or enumerated rotations** — none is free text, which keeps
[`08-session-capture.md`](08-session-capture.md) §3.2's refusal rule cheap to satisfy.

Allocation is part of action semantics. Immediate build reserves building then queue id;
timed build reserves site, future building, then future queue id in that order. Both build
paths increment `map.revision` when the footprint becomes blocked. Hiring creates one staff
entity at the row-major first exit with an empty committed path, zero movement progress, and
no task. Demolition/fire cancel dangling queue/task/assignment references in the same
reducer; they never wait for a tick to restore referential integrity.

**`ticks` is bounded.** `submitAction` is synchronous and pure, so an unbounded tick count
is an unbounded pure computation inside one call. The cap is campaign data, Tier 1
validated, and exceeding it is `tick_limit_reached` (§11) — a rejection, not a truncation,
because a silently shortened batch would break §5.

---

## 7. Scene, Available Actions, and the Parameter Problem

`AvailableAction` (04 §6) is `{ id, labelKey, available, reasonKey }`. **It carries no
parameter schema**, and for this kind that is load-bearing: enumerating `build` × every
definition × every map cell × four rotations is combinatorial.

So the seam splits cleanly:

- **`availableActions` returns the verbs** in §6, each with `available` and a `reasonKey` —
  `build` is unavailable with `insufficient_funds` when nothing is affordable.
- **The parameter domain is projection** (§10): the build catalogue with costs and unlock
  state, the staff roster, the price ranges. A client renders a build menu from the
  projection, not from `availableActions`.
- **`scene` renders a status summary** — tick, cash, guest count, objective progress — as
  a `SceneBody`, the generic surface every client can show without knowing this kind.

**One session operation is missing, and this kind is the first to need it.** A spatial
placement must be checkable before it is committed. Today the only check is to submit and
rely on rejection leaving state unchanged (04 §4 step 5) — correct, but it routes a read
through a write path, and clients hold projections rather than state (09 §1) so they cannot
call the pure engine themselves.

```typescript
previewAction(sessionId: string, actionId: string, params?: ActionParams)
  : Promise<SessionActionResult>;      // runs kind.advance, discards the state
```

It **cannot drift from the real rules** because it is literally the same `advance` call with
the result discarded — which is why a separate `validateCommand` of the sort the draft
proposed is rejected: that is a second copy of the ruleset.

> **Consequence, stated rather than smuggled in.** This makes the API coverage checklist
> ([`09-clients.md`](09-clients.md) §4) ten operations and ten MCP tools rather than nine
> and nine. The W48 client-parity unit adds that pairing to 09 and MVP together with this
> operation, so the public surface, its clients, and its proof remain one contract.

---

## 8. Status, Win, Loss, and Terminal Identity

The draft's `"active" | "completed" | "failed" | "abandoned"` conflicts with the envelope's
`GameStatus = "active" | "ended" | "abandoned"` (04 §2). `completed` and `failed` do not
exist at the envelope level, and should not: **the core has no concept of winning.**

Both map to `ended`. The win/loss distinction is **terminal identity**, which is what
`Kind.outcome` is for ([`07-replay.md`](07-replay.md) §3.3):

```typescript
interface WorldGraphOutcome extends KindOutcome {
  readonly resolution: "objectives_met" | "failed" | null;   // null while active
  readonly objectivesMet: readonly string[];                 // published objective ids
  readonly failureId: string | null;                         // published failure-condition id
}

outcome(state: WorldGraphKindState): WorldGraphOutcome {
  const terminal = state.resolution;
  return {
    terminal: terminal !== null,
    terminalId: terminal?.resolution ?? null,
    resolution: terminal?.resolution ?? null,
    objectivesMet: terminal?.objectiveIds ?? [],
    failureId: terminal?.failureId ?? null,
  };
}
```

**This is the one kind whose outcome type states the `extends` relationship in the tree**, for
the same reason it is the one kind whose outcome type has a name at all: `WorldGraphOutcome` is
exported from the package root, so the base it satisfies has to be visible on the declaration
rather than inferred from a literal. The other two kinds satisfy `KindOutcome`
([`04-core.md`](04-core.md) §3.2) structurally, through the return type of `outcome` itself.

**`terminalId` is the `resolution` token, not `failureId`.** `failureId` is present only on the
losing branch, so using it would leave a won game with a null terminal id and make `terminal`
and `terminalId` disagree on exactly the games a host most wants to index. `resolution` is total
across both branches, which is what the floor requires.

**This kind implements no `terminalCount`,** for the reason
[`10-simulation-kind.md`](10-simulation-kind.md) §12 gives for itself: the two resolution tokens
are fixed here rather than declared by a scenario, so counting them measures the contract and
not the content. A world-graph campaign therefore carries no `progress` object
([`04-core.md`](04-core.md) §7.3).

`WorldGraphOutcome` is named here because it is **exported from the package root**, so the
name is public whether or not anything imports it yet — nothing does today. `story-graph`
and `simulation` state their outcome shapes inline and export no equivalent, which is why
this is the one kind whose outcome type needs a declaration rather than a literal. If this
one is ever un-exported, it goes back to a literal too.

**A win requires at least one objective and every one must be `"met"`.** A triggered
`FailureProgress` produces `"failed"` and its published id; a scenario that declares no
objectives has nothing to win. Vacuous truth is the wrong reading—it would end a sandbox
before the player saw one tick—so §15 warns instead. System 18 applies the scenario's
`resolutionPrecedence` when success and failure become true together and stores one
`WorldResolution`. `outcome()` reads that immutable fact; it never reconstructs a possibly
different winner from progress arrays after the fact.

Published ids only. **Cash, guest counts, satisfaction and the tick it ended on are
deliberately excluded** — every one changes legitimately under a balance pass, and a
regression oracle that treated a balance change as a defect would be abandoned within a
month (07 §3.4).

---

## 9. Determinism Beyond the Seed

`story-graph` and `simulation` get determinism almost free: few draws, small state, no
geometry. This kind does not, and the rules below are the contract.

**Integer arithmetic only.** Utility scores, path costs, condition and cleanliness values,
and all money are integers — fixed-point where a fraction is needed, with the scaling
factor part of the content contract. The determinism guard in `src/engine/eslint.config.js`
([Engine Package](/docs/guide/engine-package)) already bans the non-bit-stable `Math.*`
functions; this states the positive rule those bans imply.

**No `Math.sqrt` in distance.** Comparisons use squared Euclidean, Manhattan or Chebyshev
distance — all integer, all order-preserving for the comparisons that matter.

**Every tie uses §4.2's complete comparator.** Entity id is only one domain; positions,
definitions, FIFO arrivals, canonical-path nodes, and transient task candidates have their own complete
tuples. Iteration order is likewise canonical except where FIFO/authored order is semantic.

**Entity ids are derived, never supplied.** Guests, staff, buildings, sites, queues and
tasks take ids from `nextEntityOrdinal` in `kindState`, formatted `<prefix>:<ordinal>`.
They may **not** come from the `IdSource` port — 06 §2's rule is that a host may supply
anything that *cannot change `serialize()` output*, and entity ids are serialized. `gameId`
and `seed` come from `IdSource` precisely because they are inputs; these are not.

**Derived caches are never serialized.** Path caches and distance fields keyed by
`map.revision` are recomputed, not persisted — a cache in serialized state is a field free
to drift, the same objection §3 makes to `rng`.

### 9.1 Utility eligibility and score

Eligibility is a filter before arithmetic. A candidate is absent—not assigned a very
negative score—when its content is locked, building is not `open`, queue is full, guest
cannot afford the price, product is not offered/in stock, a typed condition rejects it, or
no canonical path reaches an entrance. The path-cost query uses the same canonical-path rules as §9.3;
it may share scratch cache but not a second reachability rule.

For each survivor evaluate these signed integer components in order:

```text
need urgency
 preference match
 social relevance
 quality
 attractiveness
- price resistance
- travel cost
- queue penalty
- safety concern
```

- **Need urgency** is the greatest `NeedProfile.utilityByCurrentValue` output among need
  deltas the service can satisfy; a service satisfying none contributes zero.
- **Preference match** sums matching preference meter values for definitions whose
  `targetTags` intersect product/building tags, then multiplies once by
  `preferenceUtilityPerPoint`.
- **Social relevance** is exactly zero in v1 because groups are not represented; adding
  groups must add a typed input before this component can become non-zero.
- **Quality** is truncation-toward-zero of `(cleanliness + wear) / 2`, multiplied by
  `qualityUtilityPerPoint`.
- **Attractiveness** is the canonically summed applicable adjacency input multiplied by
  `attractivenessUtilityPerPoint`.
- **Price resistance** is the non-negative `priceResistance` curve output at the actual
  integer-cent price.
- **Travel cost** is canonical path cost multiplied by non-negative
  `travelPenaltyPerCost`.
- **Queue penalty** is estimated wait ticks multiplied by non-negative
  `queuePenaltyPerTick`. Estimated wait is the sum of remaining head service time and the
  declared duration for each guest ahead; unlimited capacity does not mean zero wait.
- **Safety concern** sums active incident severity points within the building footprint or
  entrance cells (`info: 0`, `minor: 1`, `major: 10`, `critical: 100`), then multiplies by
  `safetyPenaltyPerPoint`. The severity ladder is engine-mechanical and code-owned.

Each curve/multiplication boundary rounds once; the final sum is not normalized or rounded.
Checked safe-integer addition is mandatory. Tier 1 derives worst-case bounds from validated
meter ranges, curves, map path bounds, queue caps, prices, and incident severity points and
rejects a campaign whose candidate score can leave JavaScript's safe-integer range.

The highest score wins by the utility comparator. A queued guest switches only when
`alternativeUtility - currentUtility > switchThresholdUtility`; equality stays put. With
the current queued candidate, eligibility ignores queue capacity for that guest but still
checks closure, product, affordability, stock, and reachability.
With
no candidate, `fallback.kind: "leave"` selects the row-major nearest equal-cost exit, while
`"wait"` stores `untilTick = processingTick + ticks` and cannot create an implicit retry
inside the current tick. The optional decision trace reports components in the order above
and is trace event data, never state or projection.

### 9.2 Curves, multiplication, and rounding

Step curves select the point with greatest `input <= x`, clamping outside the authored
domain to the nearest endpoint. Linear interpolation between `(x0, y0)` and `(x1, y1)` is
evaluated as one exact rational:

```text
y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
```

and rounded once **half away from zero**. Signed fixed-point multiplication follows the
same rule after the complete product; intermediate rounding is forbidden. Implementations
may use `bigint` for scratch numerators/products, but the checked result returned to state
or scoring is a safe integer `number`. This is deterministic integer arithmetic, not
serialized BigInt state.

Conditions read one immutable system-entry snapshot. `all`/`any` children evaluate in
authored order without short-circuiting (useful for identical traces even though leaves are
pure); `not` evaluates its one child. Integer metrics compare directly. Rational averages
compare by cross multiplication, never division. An unavailable aggregate follows §14.2.
`tick` is `processingTick`; `day` is `floor(processingTick / ticksPerDay)`; entity counts
include persisted buildings/staff and guests not marked departed/removed; queue length is
persisted FIFO length; incident state uses the active/retained meanings in §14.10.

Effects apply in their owning system's declared order and select runtime targets by the
relevant canonical comparator. Ordered `unlock`/`lock` or policy writes to the same id use
last-write-wins. Each producing system groups numeric deltas by target/scalar, sums, then
clamps once before it exits; systems 1, 4, and 11 explicitly defer building-meter deltas to
system 14 so policy/service/litter/staff sources compose there. Systems after 14 apply their own
group locally—effects never wait for the next tick without persisted state. A `wear` delta is
therefore not authorable on a list one of those later systems owns (`objectives.onCompleted`,
`failures.onTriggered`, and `incidents.onResolve` on a duration-bearing incident): it would clamp
independently and could never reach §4.16's broken transition, so validation rejects it rather
than leaving the gap reachable by content. `cleanliness` carries no such transition and stays
legal there, clamped locally like any other late group.
Finance/counter/objective deltas use checked addition. An effect cannot emit another effect
or call a system recursively. If starting an incident must sample
a non-constant duration range, it draws from the owning system's
`tick:${processingTick}:<stable-system-id>` handle in effect/target order; a constant range
and `null` duration consume no draw.

### 9.3 Canonical shortest path

Nodes are `Position`s. Outgoing neighbours are allowed authored `PathCell`s whose `from`
matches the current node, ordered by destination row-major. The destination terrain must be
walkable. Building and construction-site footprint cells are blocked; entrance approach
cells remain outside footprints and are valid goals. Guest overlap does not block a cell.

```text
stepCost(current, next) = edge.edgeCost + terrain(next).moveCost
```

Both terms are non-negative and Tier 1 requires every traversable sum to be positive.

**The search is uniform-cost — Dijkstra, with no heuristic.** The open list is ordered by
accumulated cost `g`, ties broken row-major by position (§4.2), and the first goal popped is
returned. `canonicalPath` (`src/engine/src/kinds/world-graph/spatial.ts`) implements exactly
that.

> **This is a deliberate simplification of an earlier A\* prescription, not an oversight.**
> This section previously fixed a heuristic — Manhattan distance to the nearest goal times
> the campaign's minimum traversable step cost — and noted that a zero minimum degenerates to
> Dijkstra. Running with a zero heuristic *always* is that degenerate case, and it is
> behaviourally identical on every property this contract actually constrains: an admissible
> heuristic never changes which paths are optimal, and the tie-break here is the same
> row-major comparator either way, so the committed path is the same path. The difference is
> confined to how many nodes get expanded reaching it — a performance question, not a
> determinism one, and determinism is the only axis §9 exists to fix. Reintroducing the
> heuristic is therefore a pure optimization, available whenever expansion count is measured
> to matter, and it requires no change to anything below. What it must never do is *change
> the answer*: an inadmissible heuristic would, which is why the admissibility rule is
> restated here rather than dropped with the algorithm.

Open nodes and equal-cost parents use §4.2. A closed node reopens only for smaller `g`;
equal `g` replaces its parent only for a row-major-smaller predecessor. Multiple entrances
are goals and equal total cost chooses row-major. The returned committed path includes the
start at index 0 and chosen goal at the final index. Unreachable returns a typed failure,
not an empty successful path.

A cache key is `(map.revision, start, orderedGoals, movementProfile)`, where v1 profiles are
the literal `guest` and `staff` (speed never changes route cost). It may memoize the
canonical answer only; cache enabled/disabled must return the same path and events. A map
mutation increments `revision`, invalidating all old keys without serializing a cache.

### 9.4 Exact passive-rate proration

For non-negative integer `amountPerPeriod`, positive `ticksPerPeriod`, and zero-based
`processingTick`, the amount due is:

```text
floor(amountPerPeriod * (processingTick + 1) / ticksPerPeriod)
- floor(amountPerPeriod * processingTick / ticksPerPeriod)
```

This applies to wages and passive operating cost. It distributes remainder cents
deterministically and sums to exactly `amountPerPeriod` at every period boundary without a
persisted remainder. Implementations evaluate the cumulative products as exact scratch
integers (or by an algebraically equivalent quotient/remainder form), then safe-check the
per-tick result. Product sales and restock costs remain atomic integer-cent transfers.

---

## 10. Projection

`WorldGraphView` is the `kindView` inside the core's `PlayerView` (04 §9), and it carries only what
the generic surface does not. It does not include:

- seed or any RNG/stream state
- future incident weights or hidden scenario triggers
- undiscovered preferences/thresholds
- internal path caches
- per-candidate utility breakdowns

```typescript
interface WorldGraphView {
  tick: number;
  finances: {
    cashCents: number;
    revenueTodayCents: number;
    expensesTodayCents: number;
  };

  map: {
    width: number;
    height: number;
    revision: number;
    spawnPoints: readonly Position[];
    exits: readonly Position[];
    zones: readonly string[];
    buildingCount: number;
    guestCount: number;
    staffCount: number;
  };

  buildOptions: readonly {
    definitionId: string;
    canBuild: boolean;
    /** Every §11 code that would reject a build of this definition *regardless of where*
     *  it is placed: `building_locked`, `insufficient_funds`, `building_limit_reached`.
     *  Placement-dependent rejections — bounds, terrain, overlap, reachability — are not
     *  knowable without `(x, y, rotation)` and are what `previewAction` (§7) is for.
     *  Every entry is a §11 code; this list never invents one. */
    blockedBy: readonly ReasonCode[];
  }[];

  buildings: readonly {
    id: string;
    definitionId: string;
    status: BuildingStatus;
    queueLength: number;
    cleanliness: number;
    wear: number;
  }[];

  staff: readonly {
    id: string;
    roleId: string;
    status: StaffStatus;
    zoneId: string | null;        // from `Staff.assignedZoneId` — there is no second, derived one (§3.3)
    buildingId: string | null;    // from `Staff.assignedBuildingId`
  }[];

  objectives: readonly Pick<ObjectiveProgress, "id" | "state" | "value" | "target">[];
  alerts: readonly Pick<Alert, "id" | "type" | "severity" | "titleKey" | "messageKey" | "issuedAtTick">[];
  queuedGuests: number; // across all building queues
}
```

`outcome(state)` in §8 is reconciled with this view by using only published objective ids for
`objectivesMet` and `failureId`, and excluding all other runtime internals.

**The view repeats nothing the generic surface already carries.** Checked field by field
against 04 §6's `Scene` and 04 §9's `PlayerView`: `gameId`, `status`, the scene body and the
action list all live there and appear nowhere above — the sixth check against `CLAUDE.md`'s
envelope-duplication ledger and the second on the view side, after `StoryGraphView`
duplicated scene and status fields (03 §9). `tick` is *not* a repeat: the envelope has no
clock, and §4 makes `tick` this kind's own.

**`buildOptions`, `availableActions` and the reducer must agree.** A definition the reducer
would reject for a placement-independent reason must be `canBuild: false` here and must
carry the same code in `blockedBy`; `build` is `available: false` in §7 only when *no*
definition can be built at all. §7 makes clients render the build menu from this projection,
so a disagreement is a client showing an option the engine will refuse — the failure mode
"shown-but-disabled with a reason" exists to prevent.

---

## 11. Reason Codes

Codes this kind adds to the base set (`Kind.reasonCodes`, 04 §3, §12). Each needs a
localized message or registry validation fails. They divide by *when they are checked*, and
the division matters because the three groups reach different audiences — a player, a
campaign author, and a client rendering a history — the same split
[`03-story-graph-kind.md`](03-story-graph-kind.md) §8.3 and 10 §10 make.

**Resolution codes — checked at action time, reported to the player.** These ride out on a
rejected `AdvanceResult.error` (and its accompanying `OutcomeMessage`, 04 §3).

| Code | When |
|---|---|
| `insufficient_funds` | Cost exceeds available cash |
| `placement_overlaps` | Footprint intersects an existing building or site |
| `placement_terrain_unsuitable` | Terrain does not satisfy the definition's requirement |
| `placement_out_of_bounds` | Footprint leaves the map |
| `placement_unreachable` | No walkable path from any spawn to any entrance |
| `building_locked` | The scenario has not unlocked this definition |
| `unknown_entity` | A `params` id names no building, staff member, zone or alert |
| `building_not_open` | The operation requires an open building |
| `price_out_of_range` | Outside the definition's permitted band |
| `staff_limit_reached` | The scenario caps this role |
| `building_limit_reached` | The scenario caps this definition — the building-side twin of `staff_limit_reached`, and what `blockedBy` (§10) reports for a definition at its cap |
| `ticks_not_positive` | `advance_ticks` with `ticks` less than 1 |
| `tick_limit_reached` | `ticks` exceeds the campaign's per-call cap (§6) |

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`,
`action_not_available`.

**Validation codes — checked at registry build time, reported to the author.** These are
this kind's own `validateCampaign` findings (§15), and a player never sees one: a campaign
carrying any Tier-1 code among them never reaches a frozen registry at all (04 §11). They are
registered on `Kind.reasonCodes` alongside the resolution codes because the completeness rule
is the same one — every registered code owes a localized message (04 §12).

This kind's list is long because its content is: a map, a terrain graph, ten catalogues and a
scenario are all validated, and a single `invalid_definition` covering all of them would tell
an author nothing about which of twenty-odd shapes was wrong. That is a deliberate trade of
vocabulary size for author-facing precision, and it is the reason this half is enumerated
rather than summarized.

| Code | Tier | When |
|---|---|---|
| `invalid_world_graph_content` | 1 | `Campaign.content` is not shaped like world-graph content at all |
| `invalid_kind` | 1 | the campaign's declared kind is not `world-graph` |
| `invalid_id` | 1 | an id is missing, empty, or contains a `.` (§3.2's one shape constraint) |
| `duplicate_id` | 1 | the same id is used twice within one catalogue |
| `unknown_reference` | 1 | a reference names an id absent from its catalogue |
| `invalid_array` | 1 | a required catalogue array is missing |
| `invalid_definition` | 1 | a catalogue entry is not a valid definition |
| `invalid_definition_text` | 1 | a definition has no name or description key |
| `missing_string_key` | 1 | a referenced `LocKey` is not declared (reused from the base set's own meaning, 04 §12) |
| `invalid_integer` | 1 | a numeric field that must be a positive integer is not |
| `unsafe_integer` | 1 | a number falls outside the safe integer range |
| `invalid_cost` | 1 | a cost is negative |
| `invalid_condition` | 1 | a `Condition` is malformed |
| `condition_depth_exceeded` | 1 | a `Condition` nests deeper than the allowed limit |
| `invalid_effect` | 1 | an effect is malformed |
| `invalid_counter_increment` | 1 | a counter increment is not a non-negative integer |
| `position_out_of_bounds` | 1 | an authored position falls outside the map |
| `missing_spawn` | 1 | the map declares no guest spawn point (§3.2 requires at least one) |
| `missing_exit` | 1 | the map declares no exit (§3.2 requires at least one) |
| `spawn_not_traversable` | 1 | a spawn point sits on non-walkable terrain |
| `exit_not_traversable` | 1 | an exit sits on non-walkable terrain |
| `invalid_edge_cost` | 1 | an explicit `PathCell.edgeCost` is not positive |
| `invalid_footprint` | 1 | a building footprint is not a positive size |
| `invalid_building_geometry` | 1 | a building declares no entrances or no allowed rotations |
| `invalid_inventory` | 1 | inventory units or capacity are inconsistent |
| `invalid_work_rate` | 1 | a staff work rate is not positive effort per tick |
| `invalid_initial_wear` | 1 | a building's `initialWear` is not positive, so it could never reach the broken transition |
| `undeferrable_building_meter_effect` | 1 | a `wear` delta sits on an effect list owned by a system after 14 (§9.2) |
| `invalid_time_limit_pair` | 1 | a scenario declares a time limit without its failure, or the reverse |
| `disconnected_map` | 2 | the map has no traversable edges |
| `inert_scenario` | 2 | a scenario declares neither objectives nor failures |

`duplicate_id` and `missing_string_key` are the two names that also exist elsewhere —
`duplicate_id` in `story-graph` and `simulation`, `missing_string_key` in the base set. That
is deliberate reuse of a meaning, not a collision: `ReasonCode` is a flat string vocabulary
namespaced only by the *message* key (`world-graph.reason.duplicate_id`), so the same failure
reads the same way across kinds and a client switching on it needs no per-kind branch.

**Audit codes — `StateChange.reason` values (04 §12, §13 below).** All twelve ride on
`visible: true` records, so each owes a resolvable message exactly as a rejection does; there
is no audit namespace exempt from §12's completeness rule. They split by *how the reason
reaches the record*, which is not decoration — it is the distinction that let five of them go
unregistered through three units and one reconciliation pass. W83's `building_broken` was the
second occurrence, caught in review rather than by a gate, which is what the warning below
predicts and why the count above is stated rather than left to be inferred from the rows.
W84's `incident_raised` reaches a visible record the same indirect way and is the twelfth —
this table under-reported it by one until W95 reconciled the two, the same shape as
`building_broken`'s own miscount, and no gate would have caught it either.

| Code | Emitted by | Arrives as |
|---|---|---|
| `building_placed`, `construction_started` | the build actions | a literal at the `change()` call site |
| `staff_hired` | the staff actions | a literal at the `change()` call site |
| `price_set` | the building actions | a literal at the `change()` call site |
| `ticks_advanced` | `tick-finalize`, once per batch | a literal at the `record()` call site |
| `scenario_effect` | the `scenario` system's scheduled changes and active policies | `EffectContext.reason` |
| `guest_served` | the `guest-service` system | `EffectContext.reason` |
| `incident_resolved` | the `staff-work` and `incidents` systems | `EffectContext.reason` |
| `incident_raised` | the `incidents` system's roll, via a raised incident's own `onStart` effects (e.g. the MVP `storm` incident's `finance_delta`) | `EffectContext.reason` |
| `objective_met` | the `objectives` system | `EffectContext.reason` |
| `failure_triggered` | the `failure` system | `EffectContext.reason` |
| `building_broken` | the `cleanliness-wear` system, on the wear-hits-zero transition (§4.16) | a literal at the `record()` call site |

> **The indirect six are the ones to watch, and the reason this table exists.** A reason
> threaded through `EffectContext` is not visible at any call site that also names a
> `visible` flag: it becomes a visible record only where the effects module writes
> `finances.cashCents`. So the usual way of auditing this — scan for `reason:` beside
> `visible: true` — finds the direct five and none of the indirect ones. Adding an effect
> context with a new `reason` means registering it here in the same commit; nothing checks
> *emitted → registered*, and the omission is invisible to every gate. The same policy gap 10
> §10 records, with a second failure mode on top. Recorded in `90-decisions.md`.

Reasons recorded **only** with `visible: false` — `alert_dismissed`, `building_demolished`,
`staff_fired`, `staff_assigned`, `guest_spawned` — are deliberately unregistered: 04 §12 ties
the obligation to visibility, so an invisible record owes no message. Flipping one of those
flags to `true` re-arms the defect above with no gate to catch it, which is why the line is
recorded rather than merely observed. `incident_raised` and `incident_resolved` are *not*
among them despite each also appearing at a `visible: false` site (a `.exists` membership
record) — their `EffectContext` use above reaches a visible record too, which is why both are
registered rather than treated the same as the deliberately-invisible five.

The shipped set lives in `src/engine/src/kinds/world-graph/reasons.ts`. `validate.ts` is the
only producer of the validation half; the actions and the tick pipeline produce the audit
half.

---

## 12. Events

Namespaced `kind.world-graph.*` (05 §9), declared as `Kind.eventNames`:

| Name (after the namespace) | Severity | Emitted at | Status |
|---|---|---|---|
| `batch.started` / `batch.ended` | `debug` | Around `advance_ticks`, with requested and actually processed ticks | delivered |
| `building.placed` / `building.demolished` | `info` / `debug` | The `build` and `demolish` reducers | delivered |
| `building.status.changed` | `debug` | The immediate reducers (and system 13, once built) | delivered |
| `staff.hired` / `staff.fired` / `staff.assigned` | `info` / `debug` / `trace` | The staff reducers | delivered |
| `alert.dismissed` | `trace` | The `dismiss_alert` reducer | delivered |
| `scenario.effect.applied` | `debug` | System 1 applied one scheduled/policy effect | delivered |
| `guest.spawned` | `trace` | System 2 | delivered |
| `guest.served` | `trace` | System 4 | delivered |
| `incident.resolved` | `info` | Systems 11 and 16 own the transition today | delivered |
| `tick.finalized` | `trace` | System 20, after cleanup and increment | delivered |
| `guest.meter.changed` | `trace` | System 3, per need that actually drifted | delivered |
| `service.started` | `trace` | System 5, once the head guest becomes servable | delivered |
| `queue.joined` / `queue.abandoned` | `trace` | FIFO membership changes in system 5 | delivered |
| `guest.intent.selected` | `trace` | System 6, with optional ordered component trace | delivered |
| `guest.path.committed` / `guest.path.failed` | `trace` / `debug` | System 7 attempted a commitment | delivered |
| `guest.moved` / `guest.departed` | `trace` / `debug` | System 8 | delivered |
| `task.candidate.generated` | `trace` | Optional system-9 diagnostic; never state | delivered |
| `staff.task.assigned` | `trace` | System 10, when a candidate is matched to staff | delivered |
| `staff.task.completed` / `staff.task.cancelled` | `trace` | Wherever the owning system actually finishes the task — system 11 for `clean` and `service`, system 12 for `build`, system 13 for `restock` | delivered |
| `staff.moved` | `trace` | System 11 traversed one edge | delivered |
| `construction.progressed` / `construction.completed` | `trace` / `info` | System 12 | delivered |
| `building.meter.changed` | `trace` | Systems 13–14 | delivered |
| `finance.charged` | `debug` | System 15, one row per coalesced charge family (wages, operating) | delivered |
| `incident.raised` | `info` | Systems 4, 11, 14, or 16 own the transition | delivered |
| `objective.progressed` / `objective.met` | `debug` / `info` | System 17 | delivered |
| `failure.progressed` / `failure.triggered` | `debug` / `info` | System 18 | delivered |
| `scenario.resolved` | `info` | System 18, win or failure, with the `outcome` ids (§8) | delivered |
| `achievement.unlocked` | `info` | System 19, before alert derivation | delivered |
| `alert.raised` / `alert.cleared` | `debug` / `trace` | System 19 active-set transition | delivered |

> **The status column tracks emit sites, not decisions.** `Kind.eventNames` on the shipped
> `worldGraphKind` declares every row below; there is no longer a row this kind names but does
> not emit. As of W85, every tick system this table names was already real —
> `90-decisions.md`'s tick-system register closed with no rows remaining — and W87 closed the
> remaining gap between that and the event stream: the pipeline stages left unwired (queue
> membership, guest movement, per-system diagnostics, coalesced finance and
> objective/failure reporting, and the terminal `scenario.resolved`) were never blocked on a
> stub, only not yet built, and are now. Same treatment as `story-graph` §8.4, and safe the same
> way it always was: 05 §2 guarantees dropping every event changes nothing, so none of this was
> ever load-bearing while it waited.
>
> **Every row's severity is checked against the shipped emit site, not remembered.** Four of
> them had disagreed with the source since W46/W47 and survived four reconciliations, because
> the kind wrote its severity as a literal at each `emit` call rather than in one table the way
> `core/observability/events.ts` does (05 §7). W96 closed that gap: this kind now owns its own
> name-to-severity table (`src/engine/src/kinds/world-graph/events.ts`), every call site reads
> both the name and the severity off one entry there, and a mechanical gate
> (`src/engine/src/campaigns/eventSeverityGuard.test.ts`) compares the table against this row
> set, `Kind.eventNames`, and a live call site on every run. Re-derive this column from
> `events.ts`, not from memory, if it is ever edited by hand.

**`guest.path.failed` earns its place.** A resort where guests silently cannot reach a
building looks identical to one where they do not want to — the failure is invisible in the
projection and obvious in the stream.

Events emit in system order, then the owning comparator order. World draws use only the
stable system ids in §4. A system derives at most one tick handle per tick and threads that
handle through all its draws in declared order; deriving the same id twice would restart the
stream and is forbidden. Agent draws increment their stored counter immediately. A no-op or
rejected candidate consumes no draw unless its content type explicitly declares a trial. No
event feeds a later system.

> **Volume is real here and severity is how it is managed.** A 360-tick batch with 500
> guests emits on the order of 10⁵ `trace` events. That is acceptable only because 05 §2
> guarantees dropping every event changes nothing: a host runs `nullEmitter` normally and
> raises the level to diagnose. No event may be load-bearing.

---

## 13. `StateChange` at Batch Grain

`advance_ticks 360` cannot return a `StateChange` per guest transaction — `StateChange` is
a player-facing audit record whose `visible` flag gates client display (04 §12), and no
client renders 10⁵ rows.

**So `StateChange` carries batch-grain audit only**: money aggregated per category, building
status transitions, objective progress, scenario resolution. Per-guest and per-tick detail
is an **event** (§12), where it is discardable by design. This is the boundary 05 §1 draws,
applied to the first kind with the volume to test it.

Within one `advance_ticks` call, aggregate by resolved scalar path plus reason. `previous`
is the first value before the batch and `value` is the final value after it; omit the row
when they are equal and no membership transition occurred. Creation/removal `.exists`
records remain separate transitions. Sort returned rows by first causal system, then path,
then reason. Different batch partitions may therefore return different audit arrays; §5
requires their final kind state, not their per-call presentation records, to agree.

**Batch grain is about *which* records, not *whether*.** The nine no-time-passes actions
(§4) are single, player-initiated mutations with no volume problem at all, and each returns
its `StateChange`:

| Action | `path` | `value` (`previous`) | `reason` |
|---|---|---|---|
| `build` | `finances.cashCents` | cash after (cash before) | `building_placed` |
| — immediate | `buildings.<buildingId>.exists` | `true` | `building_placed` |
| — with build time | `constructionSites.<siteId>.exists` | `true` | `construction_started` |
| `demolish` | `buildings.<buildingId>.exists` | `false` (`true`) | `building_demolished` |
| `hire_staff` | `finances.cashCents` | cash after (cash before) | `staff_hired` |
| | `staff.<staffId>.exists` | `true` | `staff_hired` |
| `fire_staff` | `staff.<staffId>.exists` | `false` (`true`) | `staff_fired` |
| `assign_staff` | `staff.<id>.assignedBuildingId` / `.assignedZoneId` | the id, or `""` | `staff_assigned` |
| `set_price` | `buildings.<id>.pricesCents.<productId>` | integer cents (previous cents) | `price_set` |
| `open_building` / `close_building` | `buildings.<id>.status` | `"open"` / `"closed"` (previous) | `building_opened` / `building_closed` |
| `dismiss_alert` | `alerts.<id>.dismissedAtTick` | the tick | `alert_dismissed` |
| `advance_ticks` | `tick` | tick after (tick before) | `ticks_advanced` |
| — terminal | `resolution.resolution` | `"objectives_met"` / `"failed"` (`""`) | `scenario_resolved` |
| — achievement | `unlockedAchievementIds.<id>.exists` | `true` | `achievement_unlocked` |

**`build` writes one of two entity rows.** §6 lets it place a building *or* open a
construction site; which one depends on whether the definition carries required construction
work, and system 12 applies builder work to the site's `workRemaining`. Both rows are
listed so the second is not discovered later as a gap.

> **`op` is always `set`, and `value` is always the value after.** 04 §12 offers
> `increment`/`decrement`, but defines no meaning for `value` when they are used — is it the
> delta or the result? Its own worked examples only ever use `set` with `value` + `previous`,
> and 03 §5's variable write is explicit that `op` stays `set` "regardless of which
> increment/decrement/set operations actually ran". Following that: this kind emits `set`,
> `value` is the state after, `previous` is the state before, and a consumer wanting the
> delta subtracts. A `decrement` row whose `value` was the resulting balance would be read by
> half its consumers as the amount deducted.

> **Every path addresses one scalar field, and a collection is never a path.** That is
> forced rather than stylistic: 04 §12 types `StateChange.value` as
> `string | number | boolean`, so a row saying `path: "buildings"` has nothing legal to put
> in `value`, and "the array changed" is not an audit record a client could render anyway.
>
> **A path is the dotted traversal of `WorldGraphKindState` (§3.2) down to the scalar that
> changed** — which closes the valid set without a second list to maintain. Two shapes follow
> from the state's own shape, and only two:
>
> | Shape | Reaches | Examples |
> |---|---|---|
> | **Singleton** | a scalar not held in a collection | `tick`, `finances.cashCents`, `map.revision` |
> | **Member-scoped** | `<collection>.<memberId>.<field>` or `.exists` | `buildings.building:3.status`, `unlockedAchievementIds.first-sale.exists` |
>
> `<memberId>` is the entity's own id (§9), or the string value in a canonical id set such
> as `unlockedAchievementIds`; it is never an array index. An index is a property of how the
> collection is stored, and §3.4's whole point is that storage order is not addressable. A
> `null` assignment is `""` for the same reason the collection rule exists: the type has no
> null.
>
> **A dotted path is only unambiguous because no id may contain a dot.** §3.2 calls
> identifiers opaque, and opacity of *meaning* would otherwise imply freedom of *shape*.
> With a `productId` of `water.sparkling`:
>
> ```text
> buildings.building:3.pricesCents.water.sparkling
>                           └─ one segment, or two? The path resolves to a price, or to
>                              nothing, depending entirely on who parsed it.
> ```
>
> So **no path-addressable identifier may contain a `.`** — and that is all of them:
> authored content ids (building and product definitions, staff roles, objectives, zones),
> the keys of nested records like `pricesCents`, which *are* product ids, and entity ids.
> Entity ids satisfy it by construction, since §9 formats them `<prefix>:<ordinal>` and `:`
> is not a separator here; the rest are checked at Tier 1 (§15). With the rule, the same
> path is unambiguous:
>
> ```text
> buildings.building:3.pricesCents.sparkling-water   →  buildings[id=building:3].pricesCents["sparkling-water"]
> ```
>
> The alternative — a canonical escaping grammar for segments — buys nothing here: nothing
> needs a dot inside an id, and every producer and consumer would have to implement the
> unescaping identically or reintroduce the divergence this rule exists to remove.
>
> **`.exists` is the one synthetic leaf, and the only one.** Appearing and disappearing are
> not fields of any type in §3.2 — a removed entity or string-set member has no field left
> to carry the news. So `<collection>.<memberId>.exists` is a boolean assertion about
> membership: resolve an entity by its id or an id-set entry by its value, then report
> whether the collection holds it. Everything else in a path is a real field, and no second
> synthetic leaf may be added without amending this paragraph.
>
> **This is normative, and it is checkable.** 04 §12 types `path` as an unconstrained
> `string`, so nothing structural stops a producer inventing one; the rule above is what
> makes divergence a defect rather than a matter of taste. A path is valid iff it resolves
> against §3.2 — walk it segment by segment, taking `<entityId>` as a lookup by id, and it
> must land on a scalar. A path that does not resolve is a producer defect, not a consumer's
> to accommodate, and the check is cheap enough to assert in this kind's own tests. Adding a
> top-level scalar to `WorldGraphKindState` therefore extends the valid set automatically,
> which is the point of deriving it rather than listing it — a hand-maintained list of
> singleton paths would be one more thing to drift from the fields it describes.
>
> **One field is reachable by that rule and still never audited.** `nextEntityOrdinal` is
> an id source, not player-facing state — auditing it would emit a row on every creation
> saying a counter moved. Stated because "derivable from the state type" would otherwise
> imply it should appear. `map.revision` is different: build, completion, and demolition
> mutate dynamic blockage and audit that scalar when it changes.

`reason` is a descriptive code naming *why* the change happened, not a rejection code —
`simulation`'s `action_eat` and `story-graph`'s `achievement_unlocked` set that precedent,
and like those, these are `StateChange` vocabulary rather than additions to §11's
`Kind.reasonCodes`, which are what a *rejected* action returns.

`visible: true` for everything a player did deliberately and can see the result of; the
`.exists` records are `visible: false`, since the projection already carries the roster.

---

## 14. Content, Definitions, and Packs

Everything in this section is **campaign data**, loaded through the core content registry
(04 §10.1). It is the complete data language W45 implements; a campaign needs no
game-specific TypeScript and no extension object.

### 14.1 Source and runtime campaign roots

The source/runtime split is the one 04 §10.1 already owns. `AuthoredDefinitionText` carries
inline English at the authoring boundary; `RuntimeDefinitionText` carries only `LocKey`s.
Every `*DefinitionSource` below is the corresponding generic definition specialized with
the former, and every runtime `*Definition` specializes it with the latter.

```typescript
interface AuthoredDefinitionText {
  name: AuthoredText;
  description: AuthoredText;
}

interface RuntimeDefinitionText {
  nameKey: LocKey;
  descriptionKey: LocKey;
}

interface WorldGraphCampaignSource {
  startScenarioId: string;
  ticksPerDay: number;                         // positive integer; balance value
  maxTicksPerAction: number;                   // positive integer synchronous-work cap

  maps: readonly MapDefinitionSource[];        // MVP-required
  terrain: readonly TerrainDefinitionSource[]; // MVP-required
  scenery?: readonly SceneryDefinitionSource[]; // default [] — MVP-inert
  needs: readonly NeedDefinitionSource[];      // MVP-required
  guestConditions?: readonly GuestConditionDefinitionSource[]; // default [] — MVP-inert
  opinions: readonly OpinionDefinitionSource[]; // MVP-required (price in the MVP)
  preferences?: readonly PreferenceDefinitionSource[]; // default [] — MVP-inert
  products: readonly ProductDefinitionSource[]; // MVP-required
  buildings: readonly BuildingDefinitionSource[]; // MVP-required
  guestArchetypes: readonly GuestArchetypeDefinitionSource[]; // MVP-required
  staffRoles: readonly StaffRoleDefinitionSource[]; // MVP-required
  incidents: readonly IncidentDefinitionSource[]; // MVP-required (litter in the MVP)
  objectives: readonly ObjectiveDefinitionSource[]; // MVP-required
  failures: readonly FailureDefinitionSource[]; // MVP-required
  policies?: readonly PolicyDefinitionSource[]; // default [] — MVP-inert
  achievements?: readonly AchievementDefinitionSource[]; // default [] — MVP-inert
  scenarios: readonly ScenarioDefinitionSource[]; // MVP-required
}

interface WorldGraphCampaign {
  // Runtime form: every collection is present and contains LocKeys only.
  // Campaign.id/kindId/version/titleKey remain on the core Campaign envelope.
  startScenarioId: string;
  ticksPerDay: number;
  maxTicksPerAction: number;

  maps: readonly MapDefinition[];
  terrain: readonly TerrainDefinition[];
  scenery: readonly SceneryDefinition[];
  needs: readonly NeedDefinition[];
  guestConditions: readonly GuestConditionDefinition[];
  opinions: readonly OpinionDefinition[];
  preferences: readonly PreferenceDefinition[];
  products: readonly ProductDefinition[];
  buildings: readonly BuildingDefinition[];
  guestArchetypes: readonly GuestArchetypeDefinition[];
  staffRoles: readonly StaffRoleDefinition[];
  incidents: readonly IncidentDefinition[];
  objectives: readonly ObjectiveDefinition[];
  failures: readonly FailureDefinition[];
  policies: readonly PolicyDefinition[];
  achievements: readonly AchievementDefinition[];
  scenarios: readonly ScenarioDefinition[];
}
```

`WorldGraphCampaign` is the `content` inside the core `Campaign` envelope. Its lack of a
campaign id is deliberate; the ids on the nested definitions are equally deliberate. Each
is unique only within its own catalog and is what runtime state and other definitions use as
a foreign key.

### 14.2 Shared integer, reference, condition, and effect language

No type below addresses state with a free-form path. Numeric facts use the closed
`WorldMetric` union; booleans use the closed leaves of `WorldCondition`; writes use
`WorldEffect`. §§4 and 9 own evaluation order, aggregation, rounding, and competing-effect
precedence.

```typescript
interface IntegerRange {
  min: number;                                  // inclusive integer lower bound
  max: number;                                  // inclusive integer upper bound; max >= min
}

interface IntegerCurvePoint {
  input: number;
  output: number;
}

interface IntegerCurve {
  interpolation: "step" | "linear";
  points: readonly IntegerCurvePoint[];         // >= 1, strictly increasing input
}

type ComparisonOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
type AggregateOperation = "min" | "max" | "average" | "sum";
type GuestMeterKind = "need" | "condition" | "opinion" | "preference";
type WorldCounterKey = keyof WorldCounters;
type FinanceMetricField =
  | "cashCents" | "revenueTodayCents" | "expensesTodayCents"
  | "revenueTotalCents" | "expensesTotalCents";

type ContentReference =
  | { kind: "map"; id: string }
  | { kind: "terrain"; id: string }
  | { kind: "scenery"; id: string }
  | { kind: "need"; id: string }
  | { kind: "guest_condition"; id: string }
  | { kind: "opinion"; id: string }
  | { kind: "preference"; id: string }
  | { kind: "product"; id: string }
  | { kind: "building"; id: string }
  | { kind: "guest_archetype"; id: string }
  | { kind: "staff_role"; id: string }
  | { kind: "incident"; id: string }
  | { kind: "objective"; id: string }
  | { kind: "failure"; id: string }
  | { kind: "policy"; id: string }
  | { kind: "scenario"; id: string };

type WorldMetric =
  | { kind: "tick" }
  | { kind: "day" }
  | { kind: "finance"; field: FinanceMetricField }
  | { kind: "counter"; counter: WorldCounterKey }
  | { kind: "objective_progress"; objectiveId: string }
  | {
      kind: "entity_count";
      entity: "building" | "guest" | "staff";
      definitionId: string | null;              // null = every definition in that catalog
    }
  | {
      kind: "guest_meter";
      meter: GuestMeterKind;
      definitionId: string;
      aggregate: AggregateOperation;
      archetypeId: string | null;                // null = every active guest
    }
  | {
      kind: "building_metric";
      metric: "cleanliness" | "wear" | "queue_length" | "inventory";
      aggregate: AggregateOperation;
      buildingDefinitionId: string | null;       // null = every placed building
      productId: string | null;                  // required only for inventory
    }
  | {
      kind: "incident_count";
      incidentDefinitionId: string | null;
      state: "active" | "resolved";              // resolved = retained cooldown/audit window
    };

type WorldCondition =
  | { kind: "constant"; value: boolean }
  | { kind: "all"; conditions: readonly WorldCondition[] }
  | { kind: "any"; conditions: readonly WorldCondition[] }
  | { kind: "not"; condition: WorldCondition }
  | { kind: "compare"; metric: WorldMetric; op: ComparisonOperator; value: number }
  | { kind: "objective_state"; objectiveId: string; state: ObjectiveProgressState }
  | { kind: "content_unlocked"; content: ContentReference }
  | { kind: "policy_active"; policyId: string }
  | { kind: "incident_active"; incidentDefinitionId: string };

type GuestSelector =
  | { kind: "all" }
  | { kind: "archetype"; archetypeId: string }
  | { kind: "current_service_guest" }
  | { kind: "current_incident_guest" }
  | { kind: "building_queue"; buildingDefinitionId: string };

type BuildingSelector =
  | { kind: "all" }
  | { kind: "definition"; buildingDefinitionId: string }
  | { kind: "current_service_building" }
  | { kind: "current_incident_building" };

type IncidentTarget =
  | { kind: "none" }
  | { kind: "current_guest" }
  | { kind: "current_building" }
  | { kind: "zone"; zoneId: string };

type WorldEffect =
  | { kind: "finance_delta"; field: "cashCents"; cents: number }
  | { kind: "counter_increment"; counter: WorldCounterKey; amount: number } // non-negative integer
  | { kind: "unlock" | "lock"; content: ContentReference }
  | { kind: "objective_progress"; objectiveId: string; delta: number }
  | {
      kind: "guest_meter_delta";
      meter: GuestMeterKind;
      definitionId: string;
      delta: number;
      guests: GuestSelector;
    }
  | {
      kind: "building_meter_delta";
      meter: "cleanliness" | "wear";
      delta: number;
      buildings: BuildingSelector;
    }
  | {
      kind: "start_incident";
      incidentDefinitionId: string;
      target: IncidentTarget;
      amount: number;                             // positive occurrence units
    }
  | {
      kind: "resolve_incident";
      incidentDefinitionId: string;
      incidents: "current" | "all_active";
    }
  | { kind: "set_policy_active"; policyId: string; active: boolean };
```

Every `number` in §14 is an integer. `*Cents` fields are cents, `*Ticks` fields are ticks,
`*Tiles` fields are grid tiles, meter values use their referenced definition range, curve
inputs/outputs use the field that owns the curve, and utility/weight/delta fields are signed
integer scoring units unless a narrower comment says otherwise.

`counter_increment.amount` is a non-negative integer: it is the only effect that writes
`WorldCounters`, so counters never decrease or become negative. `resolve_incident` is
definition-targeted because campaign data cannot name a runtime occurrence id. It resolves
every matching active occurrence in lexicographic `Incident.id` order, applying the matched
definition's `onResolve` effects once per resolved occurrence; no match is a no-op. The
`incidents` selector limits that set to the current occurrence or all active occurrences.
An incident-owned `onStart` or `onResolve` effect evaluates with that occurrence's id as its
only `current` incident context. Every resolver writes `resolvedAtTick: processingTick`
before its `onResolve` list, so the retained occurrence is not active during that list.
In that context, `incidents: "current"` selects that one occurrence only if it is still active
and has the requested definition; thus it is a deterministic no-op in its own `onResolve`
list or when the definition differs.
`incidents: "current"` is Tier 1 invalid in every other effect owner (product, building,
scheduled scenario change, policy, objective, or failure), because none supplies an incident
occurrence. `incidents: "all_active"` needs no such context.

All meters use the range on their referenced definition. `average` is an exact rational
during comparison—§9.2 states the cross-multiplication/rounding rule—so no floating-point
value enters state. Empty `all`/`any`, an aggregate selector that cannot match any reachable
definition, or a metric whose dependent id does not resolve is Tier 1 rather than an
implicit identity value. §9.2 defines the result when a valid selector temporarily has no
runtime entities: `sum`/`entity_count` yield zero; `min`, `max`, and `average` are
unavailable, so a comparison using them is false and objective progress projects as zero.

### 14.3 Maps, terrain, scenery, placement, and adjacency

`WorldGraphCampaign.maps` is the sole authored-map catalog. A scenario stores `mapId`; it
does not embed a map. `initialState` expands the selected map's default terrain plus sparse
overrides into the complete `WorldMap.terrain`, materializes its topology, then applies the
scenario placements (§3.1).

```typescript
interface MapDefinitionBase<TText> {
  id: string;
  text: TText;
  width: number;                                  // positive integer tiles
  height: number;                                 // positive integer tiles
  defaultTerrainId: string;
  terrainOverrides: readonly TerrainOverride[];   // unique positions, row-major
  topology: MapTopology;
  zones: readonly ZoneDefinitionBase<TText>[];
  spawnPoints: readonly Position[];               // >= 1, row-major
  exits: readonly Position[];                     // >= 1, row-major
  tags: readonly string[];
}

interface TerrainOverride {
  position: Position;
  terrainId: string;
}

type MapTopology =
  | { kind: "orthogonal_grid" }
  | { kind: "explicit"; edges: readonly MapEdgeDefinition[] };

interface MapEdgeDefinition {
  from: Position;
  to: Position;
  edgeCost: number;                              // non-negative integer path-cost units
  allowed: boolean;
}

interface ZoneDefinitionBase<TText> {
  id: string;                                    // unique within this map
  text: TText;
  cells: readonly Position[];                    // non-empty, row-major
  serviceRadius: number;                         // non-negative integer tiles
  maxOccupancy: number | null;                   // null = unlimited; otherwise >= 0
}

interface TerrainDefinitionBase<TText> {
  id: string;
  text: TText;
  walkable: boolean;
  buildable: boolean;
  moveCost: number;                              // non-negative integer path-cost units
  tags: readonly string[];
}

interface FootprintDefinition {
  width: number;                                 // positive integer tiles, unrotated
  height: number;                                // positive integer tiles, unrotated
}

interface EntranceOffset {
  x: number;                                     // integer relative to unrotated origin
  y: number;                                     // immediately outside one footprint edge
}

type PlacementRule =
  | { kind: "terrain"; terrainIds: readonly string[] }
  | { kind: "adjacent_to_terrain"; terrainIds: readonly string[]; minimumEdges: number }
  | { kind: "zone"; zoneIds: readonly string[]; mode: "inside" | "outside" }
  | {
      kind: "distance_from_zone";
      zoneIds: readonly string[];
      minimumTiles: number;
      maximumTiles: number | null;               // null = no upper bound
    };

type AdjacencyTarget =
  | { kind: "building"; definitionIds: readonly string[] | null }
  | { kind: "guest"; archetypeIds: readonly string[] | null };

interface AdjacencyEffect {
  target: AdjacencyTarget;
  metric: "attractiveness" | "need_drift" | "incident_risk" | "service_demand" | "noise";
  radiusTiles: number;                            // positive integer Chebyshev radius
  delta: number;                                  // integer utility/basis-point input by metric
}

interface SceneryDefinitionBase<TText> {
  id: string;
  text: TText;
  footprint: FootprintDefinition;
  allowedRotations: readonly Rotation[];
  placementRules: readonly PlacementRule[];
  adjacencyEffects: readonly AdjacencyEffect[];
  tags: readonly string[];
}
```

Bounds and non-overlap are universal placement rules and are not repeated as authorable
switches. A `BuildingDefinition` additionally requires at least one entrance. Each entrance
is the walkable approach cell immediately outside the unrotated footprint (§3.3); the exact
integer rotation transform there is reused unchanged.

`orthogonal_grid` materializes a directed edge from each row-major origin to every in-bounds
orthogonal neighbour, destinations row-major, with `edgeCost: 0` and `allowed: true`.
Terrain supplies the positive traversable cost required by §9.3. An explicit topology owns
both directions separately; authoring `a → b` never implies `b → a`.

### 14.4 Products, buildings, queues, service, and litter

The `operation.kind` union is engine mechanical: systems branch on it. `tags` are content
classification only and may never select a resolver.

```typescript
interface PriceBand {
  minimumCents: number;                           // non-negative integer cents
  maximumCents: number;                           // >= minimumCents
  defaultCents: number;                           // inclusive within the band
}

interface ProductDefinitionBase<TText> {
  id: string;
  text: TText;
  unitCostCents: number;                           // non-negative integer cents
  price: PriceBand;
  effects: readonly WorldEffect[];
  litter: {
    incidentDefinitionId: string;
    unitsPerService: number;                       // non-negative integer litter units
  } | null;
  tags: readonly string[];
}

interface ServiceProduct {
  productId: string;
  serviceTicks: number | null;                     // null = operation base; otherwise positive
  initialUnits: number | null;                     // null = unlimited
  capacity: number | null;                         // null = unlimited; otherwise >= initialUnits
  restockTaskPriority: number;                     // signed integer candidate priority
}

interface StaffRequirement {
  roleId: string;
  count: number;                                   // positive integer
}

type BuildingOperation =
  | {
      kind: "service";
      products: readonly ServiceProduct[];         // empty permits non-product service (toilet)
      queueMaxLength: number | null;                // null = unlimited
      baseServiceTicks: number;                     // positive integer; product may override
      staffRequirements: readonly StaffRequirement[];
      staffingTaskPriority: number;                 // signed integer candidate priority
      effects: readonly WorldEffect[];              // applied on every completed service
    }
  | {
      kind: "waste";
      capacity: number | null;                      // null = unlimited
      acceptedIncidentDefinitionIds: readonly string[]; // IncidentDefinition ids
    }
  | { kind: "decorative" }
  | { kind: "support"; generatedTaskKinds: readonly StaffTaskType[] };

interface BuildingDefinitionBase<TText> {
  id: string;
  text: TText;
  footprint: FootprintDefinition;
  entrances: readonly EntranceOffset[];             // >= 1
  allowedRotations: readonly Rotation[];             // non-empty, unique
  constructionCostCents: number;                     // non-negative integer cents
  constructionWork: number;                          // effort units; 0 = immediate MVP construction
  constructionTaskPriority: number;                  // signed integer candidate priority
  operatingCostCentsPerDay: number;                  // non-negative integer cents
  initialWear: number;                               // integer 1..100 (0 could never break)
  initialCleanliness: number;                        // integer 0..100
  placementRules: readonly PlacementRule[];
  adjacencyEffects: readonly AdjacencyEffect[];
  operation: BuildingOperation;
  tags: readonly string[];
}
```

One placed building owns one stable shared queue; its head guest's `seek_service` intent says
what that guest will buy. That is why W43 removes W42's single `Queue.productId`: it
contradicted a building definition with several products. `pricesCents` and `inventory` are
materialized from `operation.products`; both key sets must equal the definition's product-id
set. Non-service buildings materialize those records empty; their structural queue can
never become a utility/service candidate.

### 14.5 Guest vocabularies, archetypes, and staff roles

Needs, conditions, opinions, and preferences are definitions because campaigns declare the
keys; their ranges are contract data because validation and clamping need them. A guest
archetype must supply exactly one initial profile entry for every key it uses.

```typescript
interface MeterDefinitionBase<TText> {
  id: string;
  text: TText;
  minimum: number;
  maximum: number;                                // integer, >= minimum
}

interface NeedDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  criticalBelow: number;                          // inclusive within range
  satisfiedAtOrAbove: number;                     // inclusive and >= criticalBelow
}

type GuestConditionDefinitionBase<TText> = MeterDefinitionBase<TText>;

interface OpinionDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  neutral: number;                                // inclusive within range
}

interface PreferenceDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  targetTags: readonly string[];                    // non-empty tags scored by §9.1
}

interface NeedProfile {
  needId: string;
  initial: IntegerRange;
  driftByCurrentValue: IntegerCurve;              // current value → integer delta per tick
  utilityByCurrentValue: IntegerCurve;            // current value → non-negative urgency
}

interface MeterProfile {
  definitionId: string;
  initial: IntegerRange;
}

interface GuestArchetypeDefinitionBase<TText> {
  id: string;
  text: TText;
  cashCents: IntegerRange;                         // non-negative integer cents
  stayTicks: IntegerRange;                         // positive integer ticks
  patienceTicks: IntegerRange;                     // non-negative integer ticks
  initialSatisfaction: IntegerRange;               // integers 0..100
  needs: readonly NeedProfile[];                   // MVP-required: thirst + toilet
  conditions: readonly MeterProfile[];
  opinions: readonly MeterProfile[];               // MVP-required: price
  preferences: readonly MeterProfile[];
  priceResistance: IntegerCurve;                   // actual price cents → non-negative penalty
  preferenceUtilityPerPoint: number;               // non-negative utility per meter point
  qualityUtilityPerPoint: number;                  // non-negative utility per quality point
  attractivenessUtilityPerPoint: number;           // integer utility units per point
  travelPenaltyPerCost: number;                    // non-negative penalty per path-cost unit
  queuePenaltyPerTick: number;                     // non-negative penalty per estimated wait tick
  safetyPenaltyPerPoint: number;                   // non-negative penalty per severity point
  switchThresholdUtility: number;                  // non-negative strict improvement required
  fallback: { kind: "leave" } | { kind: "wait"; ticks: number }; // wait ticks positive
  tags: readonly string[];
}

interface StaffWorkRate {
  taskType: StaffTaskType;
  effortPerTick: number;                           // positive integer effort units
}

interface StaffRoleDefinitionBase<TText> {
  id: string;
  text: TText;
  hireCostCents: number;                            // non-negative integer cents
  wageCentsPerDay: number;                          // non-negative integer cents
  moveTicksPerTile: number;                         // positive integer ticks
  supportedTaskKinds: readonly StaffTaskType[];
  workRates: readonly StaffWorkRate[];              // exactly one per supported task
  tags: readonly string[];
}
```

Scenario setup draws use the named tick-0 setup stream (§3.1). Guest archetype ranges are
materialized only after system 2 allocates a guest id, then draw from that guest's own stream
in the fixed order named by §4.4. `StaffTaskType` remains a closed engine union because
dispatch selects a resolver by it; campaigns extend roles and rates by id, not the resolver
vocabulary.

### 14.6 Scenarios, objectives, failures, incidents, policies, and achievements

Scenario placement arrays are the one catalog-adjacent collection whose authored order is
semantic: it allocates deterministic entity ids (§3.1). They therefore remain in authored
order rather than sorting by definition id.

```typescript
interface BuildingPlacement {
  definitionId: string;
  x: number;
  y: number;
  rotation: Rotation;
  open: boolean;
}

interface SceneryPlacement {
  definitionId: string;
  x: number;
  y: number;
  rotation: Rotation;
}

interface ScenarioGuestPoolEntry {
  archetypeId: string;
  weight: number;                                // positive integer relative weight
}

interface ScenarioGuestSpawning {
  everyTicks: number;                             // positive integer ticks
  maxActiveGuests: number;                        // positive integer
  pool: readonly ScenarioGuestPoolEntry[];        // non-empty, unique archetype ids
}

interface DefinitionLimit {
  definitionId: string;
  maximum: number;                                // non-negative integer
}

interface ScheduledScenarioChange {
  dueTick: number;                                  // non-negative processing tick
  priority: number;                                 // signed integer; higher applies first
  condition: WorldCondition;
  effects: readonly WorldEffect[];                  // authored order
}

type ResolutionPrecedence = "objectives_win" | "failure_wins";

interface ScenarioDefinitionBase<TText> {
  id: string;
  text: TText;
  mapId: string;
  startingCashCents: number;                       // integer cents
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];              // MVP-inert
  scheduledChanges: readonly ScheduledScenarioChange[];
  buildingPlacements: readonly BuildingPlacement[];
  sceneryPlacements: readonly SceneryPlacement[];  // MVP-inert
  guestSpawning: ScenarioGuestSpawning;
  objectiveIds: readonly string[];
  failureIds: readonly string[];
  timeLimitTicks: number | null;                   // null = no deadline
  timeLimitFailureId: string | null;               // paired with timeLimitTicks; targets failureIds
  resolutionPrecedence: ResolutionPrecedence;
  buildingLimits: readonly DefinitionLimit[];
  staffLimits: readonly DefinitionLimit[];
  tags: readonly string[];
}

interface ObjectiveDefinitionBase<TText> {
  id: string;
  text: TText;
  completion: WorldCondition;
  progressMetric: WorldMetric | null;              // null = effect-driven persisted progress
  target: number;
  requiredDurationTicks: number;                   // positive integer; 1 = immediate
  onCompleted: readonly WorldEffect[];
  tags: readonly string[];
}

interface FailureDefinitionBase<TText> {
  id: string;
  text: TText;
  condition: WorldCondition;
  requiredDurationTicks: number;                   // positive integer; 1 = immediate
  onTriggered: readonly WorldEffect[];
  tags: readonly string[];
}

type IncidentKind =
  | "litter" | "spill" | "breakdown" | "fire" | "security" | "weather" | "scripted";

type IncidentRollScope = "world" | "zone" | "building";

interface IncidentDefinitionBase<TText> {
  id: string;
  text: TText;
  kind: IncidentKind;                              // engine-mechanical resolver family
  severity: IncidentSeverity;
  triggerCondition: WorldCondition | null;         // null = started only by an effect
  rollScope: IncidentRollScope;
  rollChanceBasisPoints: number;                   // integer 0..10000 per scope/tick
  selectionWeight: number;                         // non-negative integer; 0 disables rolling
  cooldownTicks: number;                           // non-negative integer
  durationTicks: IntegerRange | null;               // null = no automatic expiry
  resolutionCondition: WorldCondition | null;
  resolverTaskType: StaffTaskType | null;
  resolverTaskPriority: number | null;               // null iff resolverTaskType is null
  onStart: readonly WorldEffect[];
  onResolve: readonly WorldEffect[];
  tags: readonly string[];
}

interface PolicyDefinitionBase<TText> {
  id: string;
  text: TText;
  availableWhen: WorldCondition;
  activationCostCents: number;                      // non-negative integer cents
  deactivationCostCents: number;                    // non-negative integer cents
  whileActive: readonly WorldEffect[];
  tags: readonly string[];
}

interface AchievementDefinitionBase<TText> {
  id: string;
  text: TText;
  condition: WorldCondition;
  hidden: boolean;
  scope: "profile";                                // v1; mirrored after a successful action
  tags: readonly string[];
}
```

Achievement unlocks land in `unlockedAchievementIds` first and are mirrored to the core
`ProfileStore` after the successful action, exactly as story-graph does (03 §7). Resolution
never reads the profile. Policies are fully typed but MVP-inert; a scenario may start one
active, while player policy actions remain a future unit. The named runtime consumers are:
scenery adjacency in guest-intent/incident inputs, active-policy effects in scheduled
scenario changes, and achievement conditions after objective/failure updates. W44 fixes
their exact position and precedence; empty MVP catalogs make those paths honest no-ops.

### 14.7 Source/runtime aliases

The aliases below are normative, not illustrative shorthand: they guarantee every nested
definition has one source shape and one runtime shape without duplicating the mechanical
fields between two declarations.

```typescript
type MapDefinitionSource = MapDefinitionBase<AuthoredDefinitionText>;
type MapDefinition = MapDefinitionBase<RuntimeDefinitionText>;
type TerrainDefinitionSource = TerrainDefinitionBase<AuthoredDefinitionText>;
type TerrainDefinition = TerrainDefinitionBase<RuntimeDefinitionText>;
type SceneryDefinitionSource = SceneryDefinitionBase<AuthoredDefinitionText>;
type SceneryDefinition = SceneryDefinitionBase<RuntimeDefinitionText>;
type NeedDefinitionSource = NeedDefinitionBase<AuthoredDefinitionText>;
type NeedDefinition = NeedDefinitionBase<RuntimeDefinitionText>;
type GuestConditionDefinitionSource = GuestConditionDefinitionBase<AuthoredDefinitionText>;
type GuestConditionDefinition = GuestConditionDefinitionBase<RuntimeDefinitionText>;
type OpinionDefinitionSource = OpinionDefinitionBase<AuthoredDefinitionText>;
type OpinionDefinition = OpinionDefinitionBase<RuntimeDefinitionText>;
type PreferenceDefinitionSource = PreferenceDefinitionBase<AuthoredDefinitionText>;
type PreferenceDefinition = PreferenceDefinitionBase<RuntimeDefinitionText>;
type ProductDefinitionSource = ProductDefinitionBase<AuthoredDefinitionText>;
type ProductDefinition = ProductDefinitionBase<RuntimeDefinitionText>;
type BuildingDefinitionSource = BuildingDefinitionBase<AuthoredDefinitionText>;
type BuildingDefinition = BuildingDefinitionBase<RuntimeDefinitionText>;
type GuestArchetypeDefinitionSource = GuestArchetypeDefinitionBase<AuthoredDefinitionText>;
type GuestArchetypeDefinition = GuestArchetypeDefinitionBase<RuntimeDefinitionText>;
type StaffRoleDefinitionSource = StaffRoleDefinitionBase<AuthoredDefinitionText>;
type StaffRoleDefinition = StaffRoleDefinitionBase<RuntimeDefinitionText>;
type ScenarioDefinitionSource = ScenarioDefinitionBase<AuthoredDefinitionText>;
type ScenarioDefinition = ScenarioDefinitionBase<RuntimeDefinitionText>;
type ObjectiveDefinitionSource = ObjectiveDefinitionBase<AuthoredDefinitionText>;
type ObjectiveDefinition = ObjectiveDefinitionBase<RuntimeDefinitionText>;
type FailureDefinitionSource = FailureDefinitionBase<AuthoredDefinitionText>;
type FailureDefinition = FailureDefinitionBase<RuntimeDefinitionText>;
type IncidentDefinitionSource = IncidentDefinitionBase<AuthoredDefinitionText>;
type IncidentDefinition = IncidentDefinitionBase<RuntimeDefinitionText>;
type PolicyDefinitionSource = PolicyDefinitionBase<AuthoredDefinitionText>;
type PolicyDefinition = PolicyDefinitionBase<RuntimeDefinitionText>;
type AchievementDefinitionSource = AchievementDefinitionBase<AuthoredDefinitionText>;
type AchievementDefinition = AchievementDefinitionBase<RuntimeDefinitionText>;
```

### 14.8 Build defaults and canonical order

The pure builder lifts every `AuthoredText`, rejects conflicting key/text pairs, and returns
`BuiltCampaign`. It applies exactly five defaults: omitted `scenery`, `guestConditions`,
`preferences`, `policies`, and `achievements` become explicit empty runtime arrays. There
are no other omitted-field conventions; absence elsewhere is represented by `null`.

Catalogs are sorted lexicographically by definition id. Duplicate nested definition-id
lists, tags, rotation lists, and scenario unlocks are rejected, then the accepted values are
sorted; map positions and terrain overrides are row-major `(y, x)`; explicit edges sort by
`(from.y, from.x, to.y, to.x)`; curve points sort by `input`; scheduled changes sort by
§4.2 while retaining authored indexes as final ties. Effects, `all`/`any` children, and
scenario placements preserve authored order: effects have §9.2 order semantics, condition
children are trace-stable, and placements allocate ids. Runtime content remains arrays and
plain objects—ephemeral indexes may be built by W45 but are neither campaign data nor saved
state.

### 14.9 W42 reconciliation

These are the only §3 changes W43 makes:

| W42 surface | W43 correction | Why content requires it |
|---|---|---|
| `TerrainCell.terrain/edge/moveCost` | `terrainId`; traits and base cost move to `TerrainDefinition` | Terrain is campaign vocabulary; three copied traits could drift from their definition |
| fixed guest need/opinion/preference shapes | four content-declared records; add guest cash and satisfaction | The MVP requires thirst, toilet, price opinion, and a spendable budget without recompiling the kind |
| `Incident.incidentType` plus copied text | `definitionId`; localized text and resolver kind live on `IncidentDefinition` | Runtime stores occurrence state, not a second definition |
| no scenery runtime consumer | `WorldMap.scenery` with derived ids | Adjacency-affecting scenario placements must reach tick systems and projection |
| no litter-cleanup task target | `StaffTask.incidentId` | The MVP cleaner must resolve the litter incident that generated its task |
| no inventory state; single-product queue | content-closed `Building.inventory`; one shared queue, product selected by the guest | Product definitions admit multiple products while the MVP may use unlimited stock |
| no progression/achievement/policy state | `unlockedContent`, `activePolicyIds`, `unlockedAchievementIds` | Effects and starting policy data need deterministic persisted consumers |
| departed guests are pruned with no cumulative facts | closed `WorldCounters` | Objective/failure conditions must retain published aggregates without retaining every guest |
| objectives lack duration state; failures have none | objective `satisfiedSinceTick` plus `FailureProgress[]` | Sustained objective/failure conditions must survive save/load and split tick batches |

Everything else in §3 remains W42's state contract.

### 14.10 W44 reconciliation

The executable system audit found these durable facts absent or duplicated after W43. They
are the only W44 state/content corrections; canonical-path open sets, task candidates, indexes, deltas,
and aggregation buffers remain scratch (§4.2).

| Pre-W44 surface | W44 correction | System proof |
|---|---|---|
| queue globally sorted by guest id; ambiguous `startedAtTick` plus queue patience | semantic FIFO and nullable `serviceStartedAtTick`; patience remains per guest | systems 4–5 must preserve arrival/rejoin order and resume one head service after save/load |
| three nullable guest target ids plus wait ticks | one closed `GuestIntent` union | systems 5–8 require exactly one service/leave/wait destination, not contradictory nullable combinations |
| staff has position but no route | persisted `path`, `pathIndex`, `moveProgressTicks` | system 11 must resume slow movement after save/load without teleporting or rerouting |
| task effort always numeric | `effortRemaining: number | null` | finite clean/restock/build work differs from continuing service duty |
| site completion may allocate later ids; tick-named construction effort | reserved building/queue ids and `workRemaining`; content uses `constructionWork` | system 12 completion order may not renumber entities; builders supply effort, not elapsed time |
| `Building.status` plus derived `isOpen` | `status` is sole authority; construction sites are not buildings | systems 4, 5, 13, and actions cannot disagree about openness |
| copied queue capacity, product-id list, incident severity, and site cost | resolve immutable definitions; runtime retains only mutable records/occurrence facts | no W44 system writes the copies, so they could only drift from their authoritative content/action result |
| litter occurrence has no durable position/amount | `Incident.position` and positive `amount` | systems 4, 9, 11, and 14 need one replayable spatial cleanup target |
| terminal identity reconstructed from mutable progress | immutable `WorldResolution` | system 18 must persist simultaneous precedence and published failure identity once |
| alerts cannot distinguish cleared from dismissed or deduplicate a recurrence | engine-derived `semanticKey` and `clearedAtTick` | system 19 needs a bounded, replayable active-set lifecycle |
| pipeline names scheduled effects, utility inputs, incident rolls, and simultaneous resolution without content fields | scheduled changes, resolution precedence, urgency/fallback/penalty inputs, roll scope/chance, and building-meter effects | systems 1, 6, 14, 16, and 18 otherwise invent campaign rules in code |

Resolved incidents remain through at least the following tick and through their declared
cooldown, which makes `incident_count(state: "resolved")` a retained recent/cooldown-window
metric; cumulative cross-scenario facts use `WorldCounters`. Cleared/dismissed alerts remain
through the first completed tick after their timestamp, then are removed at system 20. Those
retention meanings are engine mechanics, not hidden cache behavior.

**The draft's open question on packs is closed.** Its §10 says "the merge strategy is not
yet decided"; [`11-content-packs.md`](11-content-packs.md) decides it — campaigns replace
wholesale, strings replace per key, dependencies are exact-version and acyclic, and
`campaignVersion` becomes a digest of the resolution. This kind needs no pack mechanism of
its own.

---

## 15. Validation

`Kind.validateCampaign(campaign, strings)` (04 §3) is where all of this is implemented. It
runs at registry construction, before the registry is frozen, and it is pure and total —
no simulation, no search, no I/O.

Validation paths address source/runtime fields exactly as written in §14: catalog array
index, then nested field (for example `buildings[0].entrances[1].x`). A validator may add
details, but it may not replace a precise path with an unstructured message.

**Tier 1 — load-time hard failure:**

- The root narrows to `WorldGraphCampaign`; `ticksPerDay` and `maxTicksPerAction` are positive
  integers; `startScenarioId` resolves.
- Every authored id the kind reads is non-empty and contains no `.`. Definition ids are
  unique within their catalog; map-local zone ids are unique within their map. Tags and
  referenced-id lists contain no duplicates.
- Every `RuntimeDefinitionText` key resolves in the registry string table. At the source
  boundary, duplicate `AuthoredText.key` values must carry byte-identical text; a conflict
  is a hard builder error before kind validation.
- Every foreign key resolves in its declared namespace: maps → terrain; scenarios → map,
  placements, unlocks, policies, objectives, failures, and guest pool; buildings → terrain,
  products, roles, incidents, zones, and adjacency targets; archetypes → meter catalogs;
  conditions/effects/metrics → their typed target catalogs.
- Every number is an integer and within its documented range. Ranges are ordered; curve
  inputs are unique and strictly increasing; price defaults lie inside their bands; stock
  capacity contains finite initial stock; costs/capacities/weights are non-negative or
  positive exactly where §14 says.
- Map dimensions are positive; every coordinate is in bounds; terrain overrides are unique;
  every spawn and exit is walkable; zone cells are non-empty and unique; explicit edges have
  in-bounds endpoints and no duplicate directed `(from, to)` pair. Every traversable
  `edgeCost + destination.moveCost` is positive, and worst-case simple path cost is safe.
- Footprints are positive; rotations are unique and supported; every building has an
  entrance exactly one orthogonal cell outside one unrotated edge; placement rules have
  non-empty target ids and valid distance bounds.
- Scenario placements reference real definitions, fit the selected map after rotation,
  satisfy terrain/zone rules, do not overlap, and leave each building with at least one
  walkable approach cell. Building placements are checked by the same pure geometry used by
  `build`, never a scenario-only approximation.
- Building service product ids are unique; each runtime building's price/inventory key sets
  equal its definition's product-id set. A non-product service may have an empty product
  list; any other empty list or
  unresolved staff requirement is invalid. Task priorities are integers;
  `resolverTaskPriority` is null iff `resolverTaskType` is null.
- An archetype declares unique meter entries, every initial range fits its meter definition,
  and runtime guest records have exactly those keys. Urgency and price-resistance curves
  have non-negative outputs; penalty/threshold/fallback fields satisfy §14; the derived
  worst-case utility score is safe. A staff role has one positive work rate for every
  supported task and no extra rate.
- `WorldCondition`/`WorldEffect` discriminators and payloads match. `all`/`any` are non-empty;
  expression depth is at most 32; finance metrics select numeric fields; inventory metrics
  name a product; aggregate and selector references resolve. Context selectors occur only
  where that context exists—for example, `current_incident_building` and
  `resolve_incident.incidents: "current"` in an incident occurrence's effects. No arbitrary
  state path exists to validate or execute.
- Objectives/failures have positive duration; non-null objective progress metrics can be
  compared to their targets, and progress effects target only null-metric objectives;
  incident ranges, cooldowns, weights, roll scope/chance, target modes, task
  kinds, and policy costs satisfy their declared domains.
- A scenario's time limit is null or positive and `timeLimitFailureId` is null iff the limit
  is null; otherwise it resolves within that scenario's `failureIds`. Its guest pool is
  non-empty with unique archetypes and positive weights, and definition limits are unique
  and non-negative. Scheduled due ticks are non-negative, effects are non-empty, and
  `resolutionPrecedence` is recognized.

**Tier 2 — load-time warning:**

- A scenario already resolves at tick 0, or declares no objectives (a legal sandbox).
- A map region is disconnected from every spawn/exit, or a placed building has no reachable
  spawn even though a geometric approach cell exists.
- A definition is unreachable from every scenario through starting content, unlock effects,
  incident effects, objective/failure effects, or another reachable definition.
- A building service has no guest need/opinion demand; a staff role has no task source; an
  incident has neither expiry, resolution condition, nor supported resolver task.
- An achievement or policy condition references a counter/meter no reachable effect or
  system can change.

> **The draft's "Tier 3 simulation findings" is not validation.** Dominant buildings,
> infinite-money loops, queue deadlock and unavoidable bankruptcy are **content-balance**
> findings from a simulation harness, not load-time checks over a campaign. Calling them a
> validation tier would put a long-running search inside registry construction, which 04
> §10.1 requires to be pure and total. They belong to the balance harness, which is a game
> concern (§17).

### 15.1 Smallest valid Sun Trap-shaped source

This fixture is deliberately tiny and its numbers are illustrative, not recommended
balance. It proves the schema can author the flagship slice without `unknown`: one map,
thirst/toilet, price opinion, drink/toilet/waste buildings, a drink, a cleaner, litter, one
objective, and cash/cleanliness/deadline failure paths. The five omitted post-MVP catalogs
exercise the builder defaults in §14.8.

```typescript
const minimalMvpSource: WorldGraphCampaignSource = {
  startScenarioId: "beach-mvp",
  ticksPerDay: 360,
  maxTicksPerAction: 360,
  maps: [{
    id: "small-beach",
    text: {
      name: { key: "world.map.small-beach.name", text: "Small beach" },
      description: { key: "world.map.small-beach.description", text: "One quiet strip of sand." },
    },
    width: 8,
    height: 5,
    defaultTerrainId: "sand",
    terrainOverrides: [],
    topology: { kind: "orthogonal_grid" },
    zones: [],
    spawnPoints: [{ x: 0, y: 2 }],
    exits: [{ x: 7, y: 2 }],
    tags: ["mvp"],
  }],
  terrain: [{
    id: "sand",
    text: {
      name: { key: "world.terrain.sand.name", text: "Sand" },
      description: { key: "world.terrain.sand.description", text: "Walkable, buildable beach." },
    },
    walkable: true,
    buildable: true,
    moveCost: 10,
    tags: ["beach"],
  }],
  needs: [
    {
      id: "thirst",
      text: {
        name: { key: "world.need.thirst.name", text: "Thirst" },
        description: { key: "world.need.thirst.description", text: "Need for a drink." },
      },
      minimum: 0,
      maximum: 100,
      criticalBelow: 20,
      satisfiedAtOrAbove: 70,
    },
    {
      id: "toilet",
      text: {
        name: { key: "world.need.toilet.name", text: "Toilet" },
        description: { key: "world.need.toilet.description", text: "Need for facilities." },
      },
      minimum: 0,
      maximum: 100,
      criticalBelow: 20,
      satisfiedAtOrAbove: 70,
    },
  ],
  opinions: [{
    id: "price",
    text: {
      name: { key: "world.opinion.price.name", text: "Price" },
      description: { key: "world.opinion.price.description", text: "Perceived value for money." },
    },
    minimum: -100,
    maximum: 100,
    neutral: 0,
  }],
  products: [{
    id: "soft-drink",
    text: {
      name: { key: "world.product.soft-drink.name", text: "Soft drink" },
      description: { key: "world.product.soft-drink.description", text: "Cold and technically refreshing." },
    },
    unitCostCents: 100,
    price: { minimumCents: 100, maximumCents: 1000, defaultCents: 500 },
    effects: [{
      kind: "guest_meter_delta",
      meter: "need",
      definitionId: "thirst",
      delta: 25,
      guests: { kind: "current_service_guest" },
    }],
    litter: { incidentDefinitionId: "litter", unitsPerService: 1 },
    tags: ["drink"],
  }],
  buildings: [
    {
      id: "drink-stand",
      text: {
        name: { key: "world.building.drink-stand.name", text: "Drink stand" },
        description: { key: "world.building.drink-stand.description", text: "Sells one dependable drink." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 5000,
      constructionWork: 0,
      constructionTaskPriority: 0,
      operatingCostCentsPerDay: 100,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: {
        kind: "service",
        products: [{
          productId: "soft-drink",
          serviceTicks: 2,
          initialUnits: null,
          capacity: null,
          restockTaskPriority: 0,
        }],
        queueMaxLength: 8,
        baseServiceTicks: 2,
        staffRequirements: [],
        staffingTaskPriority: 0,
        effects: [],
      },
      tags: ["drink"],
    },
    {
      id: "toilet-block",
      text: {
        name: { key: "world.building.toilet-block.name", text: "Toilet block" },
        description: { key: "world.building.toilet-block.description", text: "A triumph of municipal plumbing." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 4000,
      constructionWork: 0,
      constructionTaskPriority: 0,
      operatingCostCentsPerDay: 50,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: {
        kind: "service",
        products: [],
        queueMaxLength: 8,
        baseServiceTicks: 2,
        staffRequirements: [],
        staffingTaskPriority: 0,
        effects: [{
          kind: "guest_meter_delta",
          meter: "need",
          definitionId: "toilet",
          delta: 25,
          guests: { kind: "current_service_guest" },
        }],
      },
      tags: ["toilet"],
    },
    {
      id: "waste-point",
      text: {
        name: { key: "world.building.waste-point.name", text: "Waste point" },
        description: { key: "world.building.waste-point.description", text: "Somewhere for the evidence." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 1000,
      constructionWork: 0,
      constructionTaskPriority: 0,
      operatingCostCentsPerDay: 0,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: { kind: "waste", capacity: null, acceptedIncidentDefinitionIds: ["litter"] },
      tags: ["waste"],
    },
  ],
  guestArchetypes: [{
    id: "day-guest",
    text: {
      name: { key: "world.guest.day-guest.name", text: "Day guest" },
      description: { key: "world.guest.day-guest.description", text: "Arrives optimistic and solvent." },
    },
    cashCents: { min: 1000, max: 2000 },
    stayTicks: { min: 120, max: 240 },
    patienceTicks: { min: 20, max: 40 },
    initialSatisfaction: { min: 50, max: 50 },
    needs: [
      {
        needId: "thirst",
        initial: { min: 40, max: 70 },
        driftByCurrentValue: {
          interpolation: "step",
          points: [{ input: 0, output: -1 }, { input: 100, output: -1 }],
        },
        utilityByCurrentValue: {
          interpolation: "linear",
          points: [{ input: 0, output: 100 }, { input: 100, output: 0 }],
        },
      },
      {
        needId: "toilet",
        initial: { min: 40, max: 70 },
        driftByCurrentValue: {
          interpolation: "step",
          points: [{ input: 0, output: -1 }, { input: 100, output: -1 }],
        },
        utilityByCurrentValue: {
          interpolation: "linear",
          points: [{ input: 0, output: 100 }, { input: 100, output: 0 }],
        },
      },
    ],
    conditions: [],
    opinions: [{ definitionId: "price", initial: { min: 0, max: 0 } }],
    preferences: [],
    priceResistance: {
      interpolation: "linear",
      points: [{ input: 0, output: 0 }, { input: 1000, output: 100 }],
    },
    preferenceUtilityPerPoint: 1,
    qualityUtilityPerPoint: 1,
    attractivenessUtilityPerPoint: 1,
    travelPenaltyPerCost: 1,
    queuePenaltyPerTick: 2,
    safetyPenaltyPerPoint: 10,
    switchThresholdUtility: 10,
    fallback: { kind: "leave" },
    tags: ["mvp"],
  }],
  staffRoles: [{
    id: "cleaner",
    text: {
      name: { key: "world.staff.cleaner.name", text: "Cleaner" },
      description: { key: "world.staff.cleaner.description", text: "Restores order one incident at a time." },
    },
    hireCostCents: 1000,
    wageCentsPerDay: 500,
    moveTicksPerTile: 1,
    supportedTaskKinds: ["clean"],
    workRates: [{ taskType: "clean", effortPerTick: 1 }],
    tags: ["mvp"],
  }],
  incidents: [{
    id: "litter",
    text: {
      name: { key: "world.incident.litter.name", text: "Litter" },
      description: { key: "world.incident.litter.description", text: "A cup has completed the easy part of its journey." },
    },
    kind: "litter",
    severity: "minor",
    triggerCondition: null,
    rollScope: "world",
    rollChanceBasisPoints: 0,
    selectionWeight: 0,
    cooldownTicks: 0,
    durationTicks: null,
    resolutionCondition: null,
    resolverTaskType: "clean",
    resolverTaskPriority: 100,
    onStart: [
      {
        kind: "building_meter_delta",
        meter: "cleanliness",
        delta: -5,
        buildings: { kind: "current_incident_building" },
      },
    ],
    onResolve: [
      {
        kind: "building_meter_delta",
        meter: "cleanliness",
        delta: 5,
        buildings: { kind: "current_incident_building" },
      },
    ],
    tags: ["mvp"],
  }],
  objectives: [{
    id: "revenue-and-clean",
    text: {
      name: { key: "world.objective.revenue-and-clean.name", text: "Profitable cleanliness" },
      description: { key: "world.objective.revenue-and-clean.description", text: "Earn revenue without losing the beach." },
    },
    completion: {
      kind: "all",
      conditions: [
        { kind: "compare", metric: { kind: "finance", field: "revenueTotalCents" }, op: "gte", value: 100000 },
        {
          kind: "compare",
          metric: {
            kind: "building_metric",
            metric: "cleanliness",
            aggregate: "average",
            buildingDefinitionId: null,
            productId: null,
          },
          op: "gte",
          value: 50,
        },
      ],
    },
    progressMetric: { kind: "finance", field: "revenueTotalCents" },
    target: 100000,
    requiredDurationTicks: 1,
    onCompleted: [],
    tags: ["mvp"],
  }],
  failures: [
    {
      id: "bankrupt",
      text: {
        name: { key: "world.failure.bankrupt.name", text: "Bankrupt" },
        description: { key: "world.failure.bankrupt.description", text: "Cash fell below the emergency threshold." },
      },
      condition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lt", value: 0 },
      requiredDurationTicks: 1,
      onTriggered: [],
      tags: ["mvp"],
    },
    {
      id: "filthy-beach",
      text: {
        name: { key: "world.failure.filthy-beach.name", text: "Beach closed" },
        description: { key: "world.failure.filthy-beach.description", text: "Cleanliness remained at zero." },
      },
      condition: {
        kind: "compare",
        metric: {
          kind: "building_metric",
          metric: "cleanliness",
          aggregate: "average",
          buildingDefinitionId: null,
          productId: null,
        },
        op: "lte",
        value: 0,
      },
      requiredDurationTicks: 20,
      onTriggered: [],
      tags: ["mvp"],
    },
    {
      id: "deadline-missed",
      text: {
        name: { key: "world.failure.deadline-missed.name", text: "Deadline missed" },
        description: { key: "world.failure.deadline-missed.description", text: "Day 2 ended before the objective was met." },
      },
      condition: { kind: "compare", metric: { kind: "tick" }, op: "gte", value: 720 },
      requiredDurationTicks: 1,
      onTriggered: [],
      tags: ["mvp"],
    },
  ],
  scenarios: [{
    id: "beach-mvp",
    text: {
      name: { key: "world.scenario.beach-mvp.name", text: "Opening day" },
      description: { key: "world.scenario.beach-mvp.description", text: "Build small, serve quickly, clean afterward." },
    },
    mapId: "small-beach",
    startingCashCents: 20000,
    unlockedContent: [
      { kind: "product", id: "soft-drink" },
      { kind: "building", id: "drink-stand" },
      { kind: "building", id: "toilet-block" },
      { kind: "building", id: "waste-point" },
      { kind: "staff_role", id: "cleaner" },
    ],
    activePolicyIds: [],
    scheduledChanges: [],
    buildingPlacements: [],
    sceneryPlacements: [],
    guestSpawning: {
      everyTicks: 10,
      maxActiveGuests: 20,
      pool: [{ archetypeId: "day-guest", weight: 1 }],
    },
    objectiveIds: ["revenue-and-clean"],
    failureIds: ["bankrupt", "deadline-missed", "filthy-beach"],
    timeLimitTicks: 720,
    timeLimitFailureId: "deadline-missed",
    resolutionPrecedence: "objectives_win",
    buildingLimits: [],
    staffLimits: [{ definitionId: "cleaner", maximum: 4 }],
    tags: ["mvp"],
  }],
};
```

### 15.2 Representative invalid source

Apply these replacements together to `minimalMvpSource`; the result remains JSON-shaped but
must fail before registry freeze. The exact paths make the fixture useful as a validator
test rather than merely an example of bad prose.

```typescript
const representativeInvalidReplacements = [
  { path: "maps[0].id", value: "small.beach" },
  { path: "scenarios[0].mapId", value: "missing-map" },
  { path: "buildings[0].entrances[0]", value: { x: 0, y: 0 } },
  { path: "products[0].price.maximumCents", value: 50 },
  { path: "guestArchetypes[0].cashCents", value: { min: 2000, max: 1000 } },
  { path: "buildings[0].text.name.key", value: "world.product.soft-drink.name" },
] as const;
```

Expected Tier-1 paths and findings:

| Path | Finding |
|---|---|
| `maps[0].id` | authored id contains `.`, which makes §13 paths ambiguous |
| `scenarios[0].mapId` | unresolved `MapDefinition` reference |
| `buildings[0].entrances[0]` | entrance is inside the 1×1 footprint, not an approach cell |
| `products[0].price.maximumCents` | maximum is below minimum/default |
| `guestArchetypes[0].cashCents` | inclusive integer range is reversed |
| `buildings[0].text.name.key` | same `AuthoredText.key` as the product name, different text |

### 15.3 Resolution verification matrix for W46/W47

- One focused test per system covers mutation, no-op, comparator order, events, and changes.
- Deep canonical state equality covers `advance(a + b)` against `advance(a)` then
  `advance(b)` across departure cleanup, day reset, service/construction completion,
  incident roll, and terminal boundaries.
- Cache-on/cache-off and `recordingEmitter`/`nullEmitter` runs produce identical state;
  tick/entity events also match across batch partitions while batch diagnostics may differ.
- Canonicalized content input may be shuffled without effect; FIFO queue arrays may not,
  because their order is state.
- Canonical-path fixtures cover equal paths/parents, multiple entrances, directed edges, blocked
  footprints, unreachable goals, and map-revision invalidation.
- Queue fixtures cover simultaneous arrival, abandonment, close/reopen, rejoin, capacity,
  and save/load during service.
- Utility fixtures cover every component, every eligibility exclusion, negative totals,
  exact ties, fallback, switch threshold, rational/curve rounding, and safe-integer bounds.
- Staff fixtures cover competing staff/tasks, persisted slow movement, target removal,
  continuing service duty, cancellation, and completion order.
- Finance fixtures prove cumulative proration sums exactly at period boundaries under every
  batch partition.
- Objective/failure fixtures cover both precedence values, the exact time-limit boundary,
  progress duration, and immutable terminal identity.
- Save/load fixtures cut between every adjacent system-owned durable handoff represented in
  state: queue service, staff movement/work, incident cleanup, and terminal finalize.

---

## 16. Replay

A `ReplayFixture` (07 §2) records `submissions` including every `advance_ticks` with its
`ticks` parameter, so replay reproduces the exact batching and is exact.

Batch invariance (§5) is the **stronger** property, and it is what makes captured sessions
portable: a fixture recorded from a client running at 4× compares equal to the same play at
1× by deep canonical kind-state equality. `Outcome` equality is asserted as well, but cannot
substitute for the state comparison because it intentionally omits balance-sensitive facts.

---

## 17. What Remains in the Game Repository

This is the kind contract, not the game. **Sun Trap** — its vision, concrete content,
client specification, MVP, roadmap and balance harness — lives in
[SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), exactly as Life
in the Fast Lane does for `simulation` (10 §15).

| Lives with the game | Why not here |
|---|---|
| Concrete guest archetypes, roles, buildings, products, maps, scenarios, objectives and incidents | Campaign instances authored against §14; another game supplies different values without changing the kind |
| `ticksPerDay`, prices, curve points, utility weights and elasticity | Balance, revisited every playtest |
| The visual client and its renderer choice | 09 already fixes the client contract; the renderer is a game decision |
| The balance harness (§15) | Searches for dominant strategies — a game tool, not an engine gate |

**The TypeScript shapes live here.** `Guest`, `Building`, `WorldMap`,
`WorldGraphCampaignSource`, and every definition in §14 compile inside the engine-owned kind
the same way `simulation`'s state and content types do (10 §7, §15). Sun Trap does not keep a
second interface copy. Its existing `content-and-systems.md` draft was primary design input;
where it now disagrees, this contract is authoritative by that draft's own stated rule.

What remains with the game is the data carried by the schema and the balance decisions
behind it. That is the same contract/content split as every other kind, not a special
ownership exception for spatial games.
<!-- human-doc:end -->
