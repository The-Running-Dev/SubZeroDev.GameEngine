/**
 * Kernel — the `GameState` envelope, the Kind seam, the pure engine, and the generic
 * scene/action surface.
 *
 * Contract: `04-core.md` §2–§6.
 */

import type { LocKey } from "../localization/types.js";
import type { RngHandle, StreamId } from "../determinism/types.js";
import type { ProjectionAudience, PlayerView } from "../projection/types.js";
import type { ValidationError, ValidationResult } from "../validation/types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { Emitter, EventName, ResolutionEmitter } from "../observability/types.js";
import type {
  CommandResult,
  OutcomeMessage,
  ReasonCode,
  StateChange,
} from "./reasons.js";

export type KindId = "story-graph" | "simulation" | "world-graph";

export type GameStatus = "active" | "ended" | "abandoned";

/**
 * The kind-agnostic envelope — the single most important type in the platform, and what
 * `advance`, `serialize` and the session store all operate on.
 *
 * Two rules this shape enforces structurally:
 *
 * - **No persisted RNG state.** Streams derive from `(seed, streamId)`, so the envelope
 *   stores the seed and nothing else. A stored generator state would be written every
 *   action, read by nothing, and free to drift from the derivable truth.
 * - **No wall-clock.** Timestamps live in the session-store record, outside replayable
 *   state; the eslint determinism guard bans `Date.now` in source for the same reason.
 */
export interface GameState {
  /** The shape of THIS envelope (04 §10.2) — distinct from `SaveEnvelope`'s own stamp. */
  formatVersion: number;
  /** From the `IdSource` port (06 §5.1); opaque to the core. */
  gameId: string;

  kindId: KindId;
  campaignId: string;
  /** The published version this game runs. Under content packs this is a digest of the
   *  resolved pack set, not the pack's own version (11 §6). */
  campaignVersion: string;

  /** The only randomness state. */
  seed: string;

  status: GameStatus;
  /** The kind's own state — opaque to the core, and deliberately not a union, so the
   *  dependency arrow keeps pointing from kinds to the core and never back. */
  kindState: unknown;

  /** Ordered player actions — the replay spine. */
  actionLog: LoggedAction[];
}

export interface LoggedAction {
  /** 0-based, monotonic. A rejected action does not advance it. */
  seq: number;
  actionId: string;
  params?: Readonly<Record<string, string | number | boolean>>;
}

export type ActionParams = Readonly<Record<string, string | number | boolean>>;

// ---------------------------------------------------------------------------
// The Kind seam (§3)
// ---------------------------------------------------------------------------

/** Everything a kind needs to resolve, supplied by the core. */
export interface KindContext {
  readonly registry: ContentRegistry;
  readonly campaign: Campaign;
  /** This resolution's own stream, `action:${seq}`. Discarded when `advance` returns. */
  readonly rng: RngHandle;
  /** Any other stream from the same seed — the `agent`, `system` and `tick` variants
   *  that `ctx.rng` alone cannot reach (04 §3.1). Pure; persists nothing. */
  readonly derive: (streamId: StreamId) => RngHandle;
  readonly seq: number;
  /** This resolution's event handle. `emit` returns `void` by design, so nothing about
   *  a sink can reach the game (05 §2). */
  readonly emit: ResolutionEmitter;
}

export interface AdvanceResult<KState> {
  state: KState;
  /** `advance` never yields "abandoned" — that is session-only (§7). */
  status: "active" | "ended";
  changes: StateChange[];
  messages: OutcomeMessage[];
  /** Set iff the action was rejected; `state` is then unchanged. */
  error?: ValidationError;
}

/** `AdvanceResult` minus `error`: a pre-validated campaign cannot fail to start. */
export interface InitialStateResult<KState> {
  state: KState;
  /** A kind that settles at start may already be ended. */
  status: "active" | "ended";
  changes: StateChange[];
  messages: OutcomeMessage[];
}

/**
 * Engine-owned code teaching the core how one category of game plays. The core drives
 * it without knowing which kind it is.
 */
export interface Kind<KState> {
  readonly id: KindId;
  /** A kind's code can change independently of the engine (04 §10.2) — manually
   *  maintained semver, the same convention `Campaign.version` already uses. Read by
   *  `SaveEnvelope.kindVersion` (10 §10.2) at the save boundary, nowhere inside `advance`. */
  readonly version: string;
  /** Codes this kind adds to the base set. Each needs a localized message or registry
   *  validation fails. */
  readonly reasonCodes: readonly ReasonCode[];
  /** Events this kind may emit, all under `kind.<id>.*` (05 §9). */
  readonly eventNames: readonly EventName[];

  initialState(campaign: Campaign, ctx: KindContext): InitialStateResult<KState>;
  availableActions(state: KState, ctx: KindContext): AvailableAction[];
  scene(state: KState, ctx: KindContext): SceneBody;

  /** Pure: same `(state, actionId, params, ctx)` → same result. */
  advance(
    state: KState,
    actionId: string,
    params: ActionParams | undefined,
    ctx: KindContext,
  ): AdvanceResult<KState>;

  project(state: KState, audience: ProjectionAudience, ctx: KindContext): unknown;
  /**
   * `strings` is the registry's built string table — a `LocKey` is only ever a
   * reference, so checking one resolves (or that a node's rendered text only
   * interpolates a declared, visible variable) needs the table itself, not just the
   * opaque `Campaign.content` (`plans/21-w14-story-graph-validation.md`, Decision 1).
   */
  validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult;

  /** Cross-version-stable terminal identity — published ids only, never values, so a
   *  balance pass cannot read as a regression (07 §3.3–§3.4). */
  outcome(state: KState): unknown;

  /**
   * Migrates a `KState` produced under an older `version` forward to this one, when the
   * state's own shape changed (10 §10.2). Optional — most version bumps don't change the
   * shape a save references. Invoked only by the save-load boundary (`SessionStore`),
   * never by `advance`; a missing function on a version mismatch fails the load loudly
   * rather than silently proceeding with a state this version wasn't written to read.
   */
  migrateState?(oldState: unknown, fromVersion: string): CommandResult<KState>;
}

/** A fixed, engine-owned set. A missing kind is a construction error. */
export type KindRegistry = Readonly<Record<KindId, Kind<unknown>>>;

// ---------------------------------------------------------------------------
// Generic scene and action surface (§6)
// ---------------------------------------------------------------------------

export interface SceneBody {
  textKey: LocKey;
  /** Rendered, with visible-state params substituted. */
  text: string;
}

/**
 * Describes a *verb*, not its parameter space. A kind whose actions carry parameters
 * exposes the domain of those parameters through the projection instead — enumerating
 * them here would be combinatorial for a spatial kind (12 §7).
 */
export interface AvailableAction {
  id: string;
  labelKey: LocKey;
  available: boolean;
  /** Present iff not available. Requirements are shown-but-disabled with a reason, never
   *  hidden — a client that hides them has reimplemented the requirement. */
  reasonKey?: LocKey;
}

export interface Scene {
  gameId: string;
  status: GameStatus;
  body: SceneBody;
  actions: AvailableAction[];
  /** The projection (§9), bundled for convenience. */
  view: PlayerView;
}

// ---------------------------------------------------------------------------
// The pure engine (§4)
// ---------------------------------------------------------------------------

/**
 * What `submitAction` returns. Defined here rather than in `reasons.ts` because it is
 * parameterised on `GameState`; keeping it there would make the two files import each
 * other.
 */
export interface ActionResult extends CommandResult<GameState> {
  changes: StateChange[];
  messages: OutcomeMessage[];
}

export interface NewGameConfig {
  campaignId: string;
  /** Omitted → the store generates one and records it. */
  seed?: string;
  audience?: ProjectionAudience;
}

/** Kind-agnostic operations over the envelope. Resolves the kind by `state.kindId`,
 *  derives the RNG handle, delegates, and reassembles. */
export interface Engine {
  /** The same `KindRegistry` this engine resolves `state.kindId` against — exposed so a
   *  caller needing kind metadata outside gameplay (`SessionStore`'s `SaveEnvelope`
   *  stamping/migration, W31) reads it off the one `Engine` it already holds, rather than
   *  taking a second, independently-suppliable `kinds` option that could silently
   *  disagree with what this engine actually plays against. */
  readonly kinds: KindRegistry;
  createGame(config: NewGameConfig): CommandResult<GameState>;
  scene(state: GameState): Scene;
  view(state: GameState, audience: ProjectionAudience): PlayerView;
  availableActions(state: GameState): AvailableAction[];
  submitAction(state: GameState, actionId: string, params?: ActionParams): ActionResult;
  /** Runs the authoritative action path without emitting an externally observable commit. */
  previewAction(state: GameState, actionId: string, params?: ActionParams): ActionResult;
  serialize(state: GameState): string;
  deserialize(data: string): CommandResult<GameState>;
  migrate(data: string): CommandResult<GameState>;
  /** The same engine, with every event stamped for one command (05-observability.md
   *  §6.1). The session store builds a short-lived decorator per command and swaps it in
   *  here rather than the pure engine ever holding a clock or per-command context itself. */
  withEmitter(emitter: Emitter): Engine;
}
