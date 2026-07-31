/**
 * The pure engine — `createEngine` and its `Engine` implementation.
 *
 * Contract: `04-core.md` §§2–5, §12; `06-extensibility.md` §4–§5.1 for `EngineHost` and
 * `IdSource`, which supersede `04-core.md` §4's three-positional-argument snippet (see
 * `plans/09-w3-pure-engine-kernel.md`, Decision 1); `05-observability.md` §§2, 4–5, 9–10
 * for the event emission wired in below (`plans/10-w3a-observability.md`).
 *
 * Scope note (plan 09, Decision 5): `migrate` is a pass-through to `deserialize`, since
 * migration is specified (04 §10.2) but explicitly unexercised by the MVP (`MVP.md` §4).
 */

import type {
  ActionParams,
  ActionResult,
  AvailableAction,
  Engine,
  GameState,
  Kind,
  KindContext,
  LoggedAction,
  NewGameConfig,
  Scene,
} from "./types.js";
import type { CommandResult } from "./reasons.js";
import type { RngHandle, StreamId } from "../determinism/types.js";
import { encodeStreamId, rngHandleFor } from "../determinism/rng.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { PlayerView, ProjectionAudience } from "../projection/types.js";
import type { ValidationError } from "../validation/types.js";
import type { EngineHost } from "../composition/types.js";
import { defaultIdSource } from "../composition/defaults.js";
import { canonicalStringify } from "../persistence/canonical.js";
import { makeResolutionEmitters, nullEmitter, emitSystemEvent, type ResolutionEmitters } from "../observability/emitter.js";
import { CORE_EVENTS } from "../observability/events.js";

// ---------------------------------------------------------------------------
// KindContext construction
// ---------------------------------------------------------------------------

/**
 * Every stream derivation — `ctx.rng` and every `ctx.derive(...)` call — traces through
 * `core.rng.stream.derived` (05 §8). Applies uniformly, including read paths: nothing in
 * the core event catalog is read-specific, so there is no reason to special-case them.
 */
function buildKindContext(
  registry: ContentRegistry,
  campaign: Campaign,
  kind: Kind<unknown>,
  seed: string,
  streamId: StreamId,
  seq: number,
  emitters: ResolutionEmitters,
): KindContext {
  const deriveAndTrace = (s: StreamId): RngHandle => {
    emitters.core.emit(CORE_EVENTS.rngStreamDerived.name, CORE_EVENTS.rngStreamDerived.severity, {
      data: { streamId: encodeStreamId(s) },
    });
    return rngHandleFor(seed, s);
  };

  return {
    registry,
    campaign,
    rng: deriveAndTrace(streamId),
    derive: deriveAndTrace,
    seq,
    emit: emitters.forKind(kind.id, kind.eventNames),
  };
}

/**
 * The context for a read-only projection call (`scene`, `availableActions`, `view`) —
 * none of which advance anything. Derived from a `system:"view"` stream, deliberately
 * distinct from the `action` stream so a kind that ever drew randomness while rendering
 * could not collide with the next `submitAction`'s draw at the same seq (plan 09,
 * Decision 3). Gets a real, sink-connected `ResolutionEmitters` like every other
 * resolution — no core *lifecycle* event fires for a read (none is named for one in 05
 * §8), but `core.rng.stream.derived` and any `kind.*` event still reach the sink.
 */
function buildReadContext(host: EngineHost, campaign: Campaign, kind: Kind<unknown>, state: GameState): KindContext {
  const seq = state.actionLog.length;
  const emitters = makeResolutionEmitters(host.emitter ?? nullEmitter, state.gameId, seq);
  return buildKindContext(host.registry, campaign, kind, state.seed, { kind: "system", system: "view", seq }, seq, emitters);
}

// ---------------------------------------------------------------------------
// createGame (04 §4)
// ---------------------------------------------------------------------------

function createGame(host: EngineHost, config: NewGameConfig): CommandResult<GameState> {
  const campaign = host.registry.campaigns.get(config.campaignId);
  if (!campaign) {
    const error: ValidationError = {
      code: "unknown_campaign",
      messageKey: "core.reason.unknown_campaign",
      path: config.campaignId,
    };
    return { ok: false, errors: [error], warnings: [] };
  }

  const kind = host.kinds[campaign.kindId];
  if (!kind) {
    const error: ValidationError = {
      code: "unknown_kind",
      messageKey: "core.reason.unknown_kind",
      path: campaign.kindId,
    };
    return { ok: false, errors: [error], warnings: [] };
  }

  const ids = host.ids ?? defaultIdSource;
  const gameId = ids.newGameId();
  const seed = config.seed ?? ids.newSeed();

  const emitters = makeResolutionEmitters(host.emitter ?? nullEmitter, gameId, 0);

  // The start stream (`system:"start"`) is distinct from the per-action `action` stream,
  // so a start-of-game random draw can never collide with an action's (04 §4).
  const ctx = buildKindContext(host.registry, campaign, kind, seed, { kind: "system", system: "start", seq: 0 }, 0, emitters);
  const init = kind.initialState(campaign, ctx);

  // init.changes / init.messages have nowhere to go on CommandResult<GameState> — see
  // plan 09's inline note under createGame. A kind that settles at start and wants its
  // opening messages seen is covered by the client calling scene() immediately after.
  const state: GameState = {
    formatVersion: CURRENT_FORMAT_VERSION,
    gameId,
    kindId: campaign.kindId,
    campaignId: campaign.id,
    campaignVersion: campaign.version,
    seed,
    status: init.status,
    kindState: init.state,
    actionLog: [],
  };

  emitters.core.emit(CORE_EVENTS.gameCreated.name, CORE_EVENTS.gameCreated.severity, {
    data: { campaignId: campaign.id, campaignVersion: campaign.version, kindId: campaign.kindId },
  });
  if (init.status === "ended") {
    emitters.core.emit(CORE_EVENTS.gameEnded.name, CORE_EVENTS.gameEnded.severity);
  }

  return { ok: true, value: state, errors: [], warnings: [] };
}

// ---------------------------------------------------------------------------
// submitAction (04 §4)
// ---------------------------------------------------------------------------

function submitAction(
  host: EngineHost,
  state: GameState,
  actionId: string,
  params?: ActionParams,
): ActionResult {
  const seq = state.actionLog.length;
  const emitters = makeResolutionEmitters(host.emitter ?? nullEmitter, state.gameId, seq);

  /**
   * Every rejection path emits `core.action.rejected` (05 §8). `includeActionId` is the
   * "only if it resolved" rule: `false` for the three core-level checks below, since none
   * of them ever asked the kind whether the id means anything; for the kind's own
   * rejection it is `true` unless the code is `unknown_action` — the one code that means
   * the kind didn't recognize the id either (05 §8's callout).
   */
  function reject(error: ValidationError, includeActionId: boolean): ActionResult {
    emitters.core.emit(CORE_EVENTS.actionRejected.name, CORE_EVENTS.actionRejected.severity, {
      reason: error.code,
      ...(includeActionId ? { data: { actionId } } : {}),
    });
    return { ok: false, errors: [error], warnings: [], changes: [], messages: [] };
  }

  if (state.status !== "active") {
    return reject({ code: "session_ended", messageKey: "core.reason.session_ended" }, false);
  }

  const kind = host.kinds[state.kindId];
  if (!kind) {
    // Defensive: a GameState produced by this engine's own createGame/submitAction/
    // deserialize always has a kindId present in `host.kinds` (each of those validates
    // it). Only reachable via a hand-built or cross-version state — exactly what a
    // foreign deserialize could hand back.
    return reject({ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: state.kindId }, false);
  }

  const campaign = host.registry.campaigns.get(state.campaignId);
  if (!campaign) {
    // Defensive, same reasoning as the kind check above: reachable only via a foreign or
    // hand-built state (deserialize now rejects this at the boundary too, but a state can
    // still be constructed directly in tests or by a future caller).
    return reject(
      { code: "unknown_campaign", messageKey: "core.reason.unknown_campaign", path: state.campaignId },
      false,
    );
  }

  const ctx = buildKindContext(host.registry, campaign, kind, state.seed, { kind: "action", seq }, seq, emitters);
  const result = kind.advance(state.kindState, actionId, params, ctx);

  if (result.error) {
    return reject(result.error, result.error.code !== "unknown_action");
  }

  emitters.core.emit(CORE_EVENTS.actionAccepted.name, CORE_EVENTS.actionAccepted.severity, { data: { actionId } });
  if (result.status === "ended") {
    emitters.core.emit(CORE_EVENTS.gameEnded.name, CORE_EVENTS.gameEnded.severity);
  }

  // exactOptionalPropertyTypes: omit `params` entirely rather than assign it `undefined`.
  const loggedAction: LoggedAction = params === undefined ? { seq, actionId } : { seq, actionId, params };

  const newState: GameState = {
    ...state,
    kindState: result.state,
    status: result.status,
    actionLog: [...state.actionLog, loggedAction],
  };

  return { ok: true, value: newState, errors: [], warnings: [], changes: result.changes, messages: result.messages };
}

// ---------------------------------------------------------------------------
// Read-only projections: scene, availableActions, view (04 §6, §9)
// ---------------------------------------------------------------------------

// The non-null assertions below are safe: createGame and submitAction only ever produce
// a GameState whose campaignId/kindId resolve against this same host, and deserializeState
// checks resolvability too (not just shape) before returning ok:true. None of these three
// methods can report an error — Engine.scene/availableActions/view return bare values, not
// a CommandResult — so the guarantee has to live at the boundary instead.

function view(host: EngineHost, state: GameState, audience: ProjectionAudience): PlayerView {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  const ctx = buildReadContext(host, campaign, kind, state);
  return {
    gameId: state.gameId,
    status: state.status,
    kindView: kind.project(state.kindState, audience, ctx),
  };
}

function availableActions(host: EngineHost, state: GameState): AvailableAction[] {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  const ctx = buildReadContext(host, campaign, kind, state);
  return kind.availableActions(state.kindState, ctx);
}

function scene(host: EngineHost, state: GameState): Scene {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  // One read context for the whole call — body, actions, and the bundled view all share
  // it, so there is exactly one ordinal sequence (and one core.rng.stream.derived) per
  // scene() call rather than a second one sneaking in via a nested view() call.
  const ctx = buildReadContext(host, campaign, kind, state);
  return {
    gameId: state.gameId,
    status: state.status,
    body: kind.scene(state.kindState, ctx),
    actions: kind.availableActions(state.kindState, ctx),
    // Scene.view has no audience parameter — hardcoded to "player", matching
    // NewGameConfig.audience's own default. Built inline from the same ctx rather than
    // via view(host, state, "player"), which would build a second, independent one.
    view: {
      gameId: state.gameId,
      status: state.status,
      kindView: kind.project(state.kindState, "player", ctx),
    },
  };
}

// ---------------------------------------------------------------------------
// Serialize, deserialize, migrate (04 §10, §10.2)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The only envelope shape that has ever existed (04 §2, §10.2). */
const CURRENT_FORMAT_VERSION = 1;

const VALID_KIND_IDS: readonly string[] = ["story-graph", "simulation", "world-graph"];
const VALID_STATUSES: readonly string[] = ["active", "ended", "abandoned"];

function isValidLoggedAction(v: unknown): v is LoggedAction {
  if (!isPlainObject(v)) return false;
  // "0-based, monotonic" (kernel/types.ts) rules out negatives and fractions here; the
  // 0-based-monotonic-across-the-whole-log check lives in isValidActionLog below, since
  // it needs the array, not just one entry.
  if (typeof v["seq"] !== "number" || !Number.isInteger(v["seq"]) || v["seq"] < 0) return false;
  if (typeof v["actionId"] !== "string") return false;
  if ("params" in v) {
    const params = v["params"];
    if (!isPlainObject(params)) return false;
    for (const value of Object.values(params)) {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return false;
    }
  }
  return true;
}

/**
 * `submitAction` always appends at `state.actionLog.length` (04 §4), so a log it produced
 * is always exactly `[0, 1, 2, ..., length-1]`. Enforcing that shape on the way in is what
 * keeps a deserialized log from handing a later `submitAction` a duplicate or gapped `seq`.
 */
function isValidActionLog(v: unknown): v is LoggedAction[] {
  if (!Array.isArray(v)) return false;
  return v.every((entry, index) => isValidLoggedAction(entry) && entry.seq === index);
}

/**
 * Hand-written structural check — no schema library; the package has zero runtime
 * dependencies (`TODO.md`, dev-dependency-advisories note) and this unit doesn't add one.
 * `kindState` is checked only for presence: it is `unknown` to the core by design (04 §2).
 */
function isValidGameStateShape(v: unknown): v is GameState {
  if (!isPlainObject(v)) return false;
  if (v["formatVersion"] !== CURRENT_FORMAT_VERSION) return false;
  if (typeof v["gameId"] !== "string") return false;
  if (typeof v["kindId"] !== "string" || !VALID_KIND_IDS.includes(v["kindId"])) return false;
  if (typeof v["campaignId"] !== "string") return false;
  if (typeof v["campaignVersion"] !== "string") return false;
  if (typeof v["seed"] !== "string") return false;
  if (typeof v["status"] !== "string" || !VALID_STATUSES.includes(v["status"])) return false;
  if (!("kindState" in v)) return false;
  if (!isValidActionLog(v["actionLog"])) return false;
  return true;
}

/**
 * No `host`, no emission — deliberately. `Engine.serialize(state): string` is the one
 * place 04 §4 commits to a bare `f(state): string`, and 04 §1's "no I/O" for the pure
 * engine is the same reasoning that keeps a clock and an `IdSource` out of it. Consulting
 * `host.emitter` here would be a host-port dependency this function was never given, even
 * though the emitted event couldn't have changed the returned string. `core.serialize.
 * completed` stays defined in `CORE_EVENTS` with no call site — see the comment there.
 */
function serializeState(state: GameState): string {
  return canonicalStringify(state);
}

/**
 * Shape-valid is not enough: a foreign or stale save can name a `campaignId`/`kindId`
 * this host doesn't have, and every other engine method assumes a `GameState` it's
 * handed already resolves against `host` (see the comment above `view`/`scene`/
 * `availableActions`). Checked here, once, at the boundary, rather than defended against
 * on every later call.
 */
function deserializeState(host: EngineHost, data: string): CommandResult<GameState> {
  const sink = host.emitter ?? nullEmitter;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = undefined;
  }

  if (!isValidGameStateShape(parsed)) {
    emitSystemEvent(sink, CORE_EVENTS.deserializeRejected.name, CORE_EVENTS.deserializeRejected.severity, {
      reason: "invalid_state",
    });
    const error: ValidationError = { code: "invalid_state", messageKey: "core.reason.invalid_state" };
    return { ok: false, errors: [error], warnings: [] };
  }

  if (!host.registry.campaigns.has(parsed.campaignId)) {
    emitSystemEvent(sink, CORE_EVENTS.deserializeRejected.name, CORE_EVENTS.deserializeRejected.severity, {
      reason: "unknown_campaign",
    });
    const error: ValidationError = {
      code: "unknown_campaign",
      messageKey: "core.reason.unknown_campaign",
      path: parsed.campaignId,
    };
    return { ok: false, errors: [error], warnings: [] };
  }

  if (!host.kinds[parsed.kindId]) {
    emitSystemEvent(sink, CORE_EVENTS.deserializeRejected.name, CORE_EVENTS.deserializeRejected.severity, {
      reason: "unknown_kind",
    });
    const error: ValidationError = { code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: parsed.kindId };
    return { ok: false, errors: [error], warnings: [] };
  }

  return { ok: true, value: parsed, errors: [], warnings: [] };
}

function migrateState(host: EngineHost, data: string): CommandResult<GameState> {
  // Migration mechanism is specified (04-core.md §10.2) but unexercised by the MVP
  // (MVP.md §4): exactly one formatVersion exists, so there is nothing to migrate from
  // yet. See plans/09-w3-pure-engine-kernel.md, Decision 5.
  return deserializeState(host, data);
}

// ---------------------------------------------------------------------------
// createEngine (06 §4)
// ---------------------------------------------------------------------------

export function createEngine(host: EngineHost): Engine {
  // 05 §9: engine construction rejects a kind declaring an event name outside its own
  // `kind.<kindId>.*` namespace. Only whichever kinds are actually present at runtime are
  // checked — `host.kinds`'s type is a closed Record over all three KindIds, but the MVP
  // legitimately registers only `story-graph` (plan 09's engine.test.ts note).
  for (const kind of Object.values(host.kinds)) {
    const prefix = `kind.${kind.id}.`;
    for (const name of kind.eventNames) {
      if (!name.startsWith(prefix)) {
        throw new Error(
          `createEngine: kind "${kind.id}" declares event name "${name}" outside its own ` +
            `"${prefix}" namespace (05-observability.md §9)`,
        );
      }
    }
  }

  return {
    createGame: (config) => createGame(host, config),
    scene: (state) => scene(host, state),
    view: (state, audience) => view(host, state, audience),
    availableActions: (state) => availableActions(host, state),
    submitAction: (state, actionId, params) => submitAction(host, state, actionId, params),
    serialize: (state) => serializeState(state),
    deserialize: (data) => deserializeState(host, data),
    migrate: (data) => migrateState(host, data),
  };
}
