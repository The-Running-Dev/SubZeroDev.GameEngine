---
sidebar_label: Core Specification
---

<!-- Generated from design/20-contract.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

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

  /** Build the starting kind-state for a fresh game of this campaign. */
  initialState(campaign: Campaign, ctx: KindContext): InitialStateResult<KState>;

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

  /** Narrow kind-state to the visible projection for an audience (§9). */
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
   * values ([`07-replay.md`](07-replay.md) §3.3).
   */
  outcome(state: KState): unknown;

  /**
   * Migrates a `KState` produced under an older `version` forward, when this kind's own
   * state shape changed (§10.2). Optional — most version bumps don't change the shape a
   * save references. Invoked only at the save-load boundary (`SessionStore`), never by
   * `advance`; a missing function on a version mismatch fails the load rather than
   * silently handing this version a state it wasn't written to read.
   */
  migrateState?(oldState: unknown, fromVersion: string): CommandResult<KState>;
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
}
```

The kind is not named here — it is a property of the campaign (`Campaign.kindId`),
resolved from the registry. A client starts a game by campaign; whether that campaign
is a story graph or a simulation is invisible to it.

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
  listCampaigns(): CampaignSummary[];
  getScene(sessionId: string): Promise<Scene>;
  getView(sessionId: string): Promise<PlayerView>;
  getStrings(sessionId: string): Promise<StringTable>;   // resolve LocKeys — below
  previewAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult>; // resolves prospectively, then discards

  // ── Commands (advance or persist) ────────────────────
  createSession(config: CreateSessionConfig): Promise<SessionHandle>;   // profileId lives here
  resumeSession(sessionId: string): Promise<Scene>;
  submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult>;
  saveGame(sessionId: string): Promise<SaveHandle>;                  // named/manual save
  loadGame(saveId: string): Promise<SessionHandle>;
}

interface SessionHandle { sessionId: string; scene: Scene; }
interface SaveHandle { saveId: string; savedAtSeq: number; }
interface CampaignSummary { campaignId: string; kindId: KindId; titleKey: LocKey; }

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
  formatVersion: 1;
  profileId: string;
  achievements: readonly AchievementRecord[];
}

interface AchievementRecord {
  campaignId: string;            // achievement ids are only unique within a campaign
  achievementId: string;
}

type ProfileWarningCode = "profile_missing" | "profile_corrupt" | "profile_write_failed";
interface ProfileWarning { code: ProfileWarningCode; profileId: string; }

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
  `formatVersion: 1` profile plus `profile_missing` / `profile_corrupt`. A failed write
  returns `profile_write_failed` and **does not** roll back the completed game action —
  the game is authoritative, the profile is a mirror.

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
  delete(saveId: string): Promise<void>;
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
  // the save-load boundary (§10.2)
  "save_requires_migration", "migration_failed",
  // host persistence (§7.2)
  "unknown_session", "unknown_save", "storage_failure", "concurrent_modification",
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
> assembly's three, the core's own Tier-1 four, the profile store's three, the save
> boundary's two, host persistence's four, the audit vocabulary's one, and content-pack
> resolution's six. That is the intended shape: a code is registered when a real caller
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
generic campaign builder, the story-graph source builder, the shared adventure builder with
its source factory and its migration helper, portable serialization and manifest digests, and
replay-runner types/functions. It is deliberately a
subpath: a runtime host must not import authored campaign source merely to play published
portable JSON.

`SubZeroDev.Adventures.Content` owns the canonical source and publication of narrative
campaigns. GameEngine owns kinds, validation, portable hydration and authoring primitives.
GameEngine may retain a frozen campaign solely as a regression fixture; such a fixture is not
published and not listed in a manifest. Existing frozen campaigns stay package-root exports
through 0.8.0 for compatibility; the breaking 0.9.0 release removes them from the root
(design/30-slices.md, W74c). The peg moved once already: 0.8.0 was originally named here
and was then spent on an additive release, so a version reserved by this section is a name
to check against `src/engine/package.json` before a bump, not after.

Portable campaign documents remain format version 2. `toPortable` and
`digestManifestResolution` are public only through `/authoring`; `fromPortable` remains a
runtime-root export. `digestPortableCampaign` is exported from both surfaces: the root, for
hosts verifying fetched content, and `/authoring`, for authoring pipelines digesting campaign
source before publication.
