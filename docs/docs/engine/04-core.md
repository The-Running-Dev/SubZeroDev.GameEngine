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
canonical serialization are already built and verified in
`src/engine/src/core/`, and specified in
`games/04-engine-specification.md` §3, §2.1.
This document references them and does not restate the algorithms.

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

Kinds (`kinds/`) and clients (`clients/`, `mcp/`) sit above; the dependency arrow points
only downward — a core module never imports a kind or client.

---

## 2. The `GameState` Envelope

The core owns a **kind-agnostic envelope** and treats each kind's own state as an
opaque payload inside it. This is the single most important type in the platform: it is
what `advance`, `serialize`, and the session store operate on.

```typescript
type KindId = "story-graph" | "simulation";

interface GameState {
  formatVersion: number;         // the shape of THIS envelope — see §10.2
  gameId: string;

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
  readonly reasonCodes: readonly ReasonCode[];   // codes this kind adds to the base set (§12)

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

  /** Tiered content validation of a campaign of this kind (§11). */
  validateCampaign(campaign: Campaign): ValidationResult;
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

`advance` is where a kind's whole ruleset lives. For the story-graph kind it is
`submitChoice → settle` ([`03-story-graph-kind.md`](03-story-graph-kind.md) §8.2); for
the simulation kind it is the weekly resolution (`games/04-engine-specification.md`). The core calls it and
never looks inside.

> **One action model, two kinds.** The core's action is a string `actionId` plus
> optional params. For the story-graph kind an action *is* a choice id. For the
> simulation kind, actions map to its richer verbs (submit a plan, end the week). The
> core does not care — it forwards the `actionId` and the kind interprets it. This
> is what lets one API (§7) and one MCP surface (§13) serve both.

### 3.1 KindContext

Everything a kind needs to resolve, supplied by the core:

```typescript
interface KindContext {
  readonly registry: ContentRegistry;   // §10 — the campaign and shared content
  readonly campaign: Campaign;           // this game's campaign, resolved
  readonly rng: RngHandle;               // handle on this resolution's own stream (§8)
  readonly seq: number;                  // current action sequence number
}
```

The kind draws randomness only from `ctx.rng` — a handle on the stream derived for
*this* resolution from `(seed, streamId)`. The handle is discarded when `advance`
returns; nothing is written back, because the next resolution derives its own stream
from the seed again (§8). The kind stays pure and every draw stays reproducible.

---

## 4. Registration and the Pure Engine

Kinds are registered at engine construction — a fixed, engine-owned set (architecture
§1). A missing kind is a construction error, not a runtime surprise.

```typescript
type KindRegistry = Readonly<Record<KindId, Kind<unknown>>>;

function createEngine(registry: ContentRegistry, kinds: KindRegistry): Engine;
```

The **pure engine** exposes kind-agnostic operations over the envelope. It resolves the
kind by `state.kindId`, derives the RNG handle, delegates, and reassembles the envelope:

```typescript
interface Engine {
  createGame(config: NewGameConfig): CommandResult<GameState>;
  scene(state: GameState): Scene;                       // §6
  view(state: GameState, audience: ProjectionAudience): PlayerView;   // §9
  availableActions(state: GameState): AvailableAction[];
  submitAction(state: GameState, actionId: string, params?: ActionParams): ActionResult;
  serialize(state: GameState): string;                  // §10 (canonical)
  deserialize(data: string): CommandResult<GameState>;
  migrate(data: string): CommandResult<GameState>;      // §10
}
```

`submitAction` is the whole loop, in the core:

```text
submitAction(state, actionId, params):
  1. kind = kinds[state.kindId];  seq = state.actionLog.length   // 0-based, monotonic
  2. handle = rngHandleFor(state.seed, { kind:"action", seq })   // §8 — derived, not carried
  3. result = kind.advance(state.kindState, actionId, params, { registry, campaign, rng: handle, seq })
  4. if result.error → return { ok:false, errors:[result.error] }, state unchanged  // ActionResult.errors is a list (§12)
  5. newState = {
       ...state,
       kindState: result.state,
       status: result.status,
       actionLog: [...state.actionLog, { seq, actionId, params }],
     }
  6. return { ok:true, value:newState, errors:[], warnings:[],
              changes:result.changes, messages:result.messages }
```

Immutability is unconditional (games/04-engine-specification.md §11.3): every operation returns a new envelope.

**`createGame`** assembles the envelope and delegates the start to the kind:

```text
createGame(config):
  1. campaign = registry.campaigns[config.campaignId]        // kind = campaign.kindId
  2. seed = config.seed ?? store-generated (and recorded)
  3. startHandle = rngHandleFor(seed, { kind:"system", system:"start", seq:0 })   // §8
  4. init = kind.initialState(campaign, { registry, campaign, rng: startHandle, seq: 0 })
     // a kind that settles at start (story-graph, 03 §8.2) draws its initial
     // random transitions from startHandle, and reports "ended" if it settled to one
  5. return the envelope { kindId: campaign.kindId, campaignId: campaign.id,
       campaignVersion: campaign.version, seed,
       status: init.status, kindState: init.state, actionLog: [] }
     // init.changes / init.messages ride out on the CommandResult
```

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

For the story-graph kind, an `AvailableAction` is a node choice; `available`/`reasonKey`
come from its requirement gate (03 §4). The generic shape is a superset — a kind with
richer actions carries params.

---

## 7. The Session Store and the Platform API

The pure engine is stateless. The **session store** is the thin stateful layer clients
actually call. It maps the architecture's §10 API onto the pure engine, keyed by
`sessionId`.

The surface splits cleanly into **queries** (read-only, no state change) and
**commands** (advance or persist). This is a documentation convention for clarity — not
CQRS the pattern: there is one state model, no separate read store, no event bus. Just a
useful line between "look" and "change."

```typescript
interface SessionStore {
  // ── Queries (read-only) ──────────────────────────────
  listCampaigns(): CampaignSummary[];
  getScene(sessionId: string): Promise<Scene>;
  getView(sessionId: string): Promise<PlayerView>;

  // ── Commands (advance or persist) ────────────────────
  createSession(config: NewGameConfig): Promise<SessionHandle>;      // → sessionId
  resumeSession(sessionId: string): Promise<Scene>;
  submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<ActionResult>;
  saveGame(sessionId: string): Promise<SaveHandle>;                  // named/manual save
  loadGame(saveId: string): Promise<SessionHandle>;
}

interface SessionHandle { sessionId: string; scene: Scene; }
interface SaveHandle { saveId: string; savedAtSeq: number; }
interface CampaignSummary { campaignId: string; kindId: KindId; titleKey: LocKey; }

interface CreateSessionConfig extends NewGameConfig {
  profileId?: string;            // omitted → anonymous session; see §7.1
}
```

**The store persists the envelope (§2) and nothing else about play.** Wall-clock
timestamps, owner ids, and other host metadata live on the store's record, outside the
replayable `GameState`. This is the boundary that keeps determinism intact while still
supporting "resume on another device" (architecture §2).

`createSession` generates and records a seed when the config omits one, so a resumed or
replayed session is always reproducible.

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
  engine has no idea profiles exist.
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

---

## 8. Randomness

Fully specified and built. The core owns the seeded PCG32 generator
(`src/engine/src/core/rng/pcg32.ts`, verified bit-identical
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
  | { kind: "agent"; agentId: string; seq: number };

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
```

Substreams (games/04-engine-specification.md §3.2) mean adding a draw in one place never renumbers another, and
a rival kind's draws never perturb the player's. The MVP uses the `action` stream for
play plus one `system` stream, `system:"start"`, for `createGame`'s initial `settle`
(§4); the machinery for more is already there.

> **`weightedPick` constrains content.** The built implementation requires every weight
> to be a **positive integer** and throws otherwise. That makes it a load-time content
> rule, not a runtime surprise — Tier 1 validation enforces it (03 §11).

---

## 9. Projection

Clients receive a **projection**, never raw state (architecture §7). The core runs
the mechanism; the kind supplies the narrowing.

```typescript
type ProjectionAudience = "player" | "agent";

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
exclusions). The `agent` audience is the rival/AI view; widening it is a difficulty
setting, declared and visible (games/04-engine-specification.md §6.1) — never granted by accident.

---

## 10. Content, Saves, Migration

### 10.1 Content Registry

```typescript
interface ContentRegistry {
  readonly campaigns: ReadonlyMap<string, Campaign>;
  readonly strings: ReadonlyMap<LocKey, string>;     // built form — see the authoring boundary below
}

interface Campaign {
  id: string;
  kindId: KindId;
  version: string;
  titleKey: LocKey;
  content: unknown;              // kind-specific — e.g. StoryGraphCampaign (03 §1)
}
```

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
without the others. A loader checks all four before trusting a save. **Compression and
host-side metadata (playtime, title, thumbnail) are deliberately absent** — compression
has no consumer yet, and host metadata belongs on the session-store record (§7), outside
the replayable `GameState`, so it can never perturb byte-identical replay.

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
- **Tier 3 — simulation-time (§14):** unwinnable campaigns, dead-end states — found by
  running, not reading. Not part of load.

Why tiered: "the engine validates AI-authored content" (architecture §9) is only a
safety property once you say *what validation is* and *what is decidable when*. AI output
is data; all data goes through the same tiers, whatever produced it.

---

## 12. Reason Codes, State Changes, Messages

Kind-agnostic base vocabulary; kinds extend it (`Kind.reasonCodes`). Clients never
string-match English (games/04-engine-specification.md §2.3).

```typescript
type ReasonCode = string;        // stable, machine-readable; additive, never renamed

const BASE_REASON_CODES = [
  "action_not_available", "unknown_action", "requirement_unmet",
  "session_ended", "read_only_field", "check_succeeded", "check_failed",
] as const;
```

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

---

## 13. The MCP Surface

The MCP server is a **client**, a sibling of the text client — a thin adapter over the
same session store (§7), holding no game logic (architecture §10). Each tool is one
store operation. There is no AI-specific game path.

| Tool | Args | Returns |
|---|---|---|
| `list_campaigns` | `{}` | `CampaignSummary[]` |
| `start_game` | `{ campaignId, seed? }` | `{ sessionId, scene: Scene }` |
| `continue_game` | `{ sessionId }` | `Scene` |
| `get_scene` | `{ sessionId }` | `Scene` |
| `get_state` | `{ sessionId }` | `PlayerView` |
| `choose` | `{ sessionId, actionId, params? }` | `ActionResult` (with the new `Scene`) |
| `save_game` | `{ sessionId }` | `{ saveId }` |
| `load_game` | `{ saveId }` | `{ sessionId, scene: Scene }` |

`choose` is `submitAction` — "choose" is the MCP-facing name for submitting an action,
whatever the kind. Returns and args are the platform types above; no schema is
AI-specific. An agent that can call these tools plays the identical game a browser does.

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

Canonical serialization (§10, built) and seeded RNG (§8, built and reference-verified)
are the two properties that make byte-identical achievable at all.

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

**Reason codes are additive, never renamed** (§12) — saves and replay logs reference
them, so a rename breaks old data.
