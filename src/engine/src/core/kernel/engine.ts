/**
 * The pure engine — `createEngine` and its `Engine` implementation.
 *
 * Contract: `04-core.md` §§2–5, §12; `06-extensibility.md` §4–§5.1 for `EngineHost` and
 * `IdSource`, which supersede `04-core.md` §4's three-positional-argument snippet (see
 * `plans/09-w3-pure-engine-kernel.md`, Decision 1).
 *
 * Scope note (same plan, Decisions 4–5): `ctx.emit` is a local no-op stub — the real
 * `Emitter`/ordinals/sinks are W3a's scope — and `migrate` is a pass-through to
 * `deserialize`, since migration is specified (04 §10.2) but explicitly unexercised by
 * the MVP (`MVP.md` §4).
 */

import type {
  ActionParams,
  ActionResult,
  AvailableAction,
  Engine,
  GameState,
  KindContext,
  LoggedAction,
  NewGameConfig,
  Scene,
} from "./types.js";
import type { CommandResult } from "./reasons.js";
import type { StreamId } from "../determinism/types.js";
import { rngHandleFor } from "../determinism/rng.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ResolutionEmitter } from "../observability/types.js";
import type { PlayerView, ProjectionAudience } from "../projection/types.js";
import type { ValidationError } from "../validation/types.js";
import type { EngineHost } from "../composition/types.js";
import { defaultIdSource } from "../composition/defaults.js";
import { canonicalStringify } from "../persistence/canonical.js";

// ---------------------------------------------------------------------------
// KindContext construction
// ---------------------------------------------------------------------------

/**
 * `emit` returns `void` and does nothing — see the module doc's scope note. Every call
 * site is marked `// TODO(W3a)` so the eventual swap for the real
 * `resolutionEmitter(emitter, gameId, seq)` wrapper (05-observability.md) is a
 * find-and-replace, not a redesign.
 */
const noopResolutionEmitter: ResolutionEmitter = {
  emit: () => {
    // TODO(W3a): wire the real Emitter/ordinals/core event set here.
  },
};

function buildKindContext(
  registry: ContentRegistry,
  campaign: Campaign,
  seed: string,
  streamId: StreamId,
  seq: number,
): KindContext {
  return {
    registry,
    campaign,
    rng: rngHandleFor(seed, streamId),
    derive: (s) => rngHandleFor(seed, s),
    seq,
    emit: noopResolutionEmitter,
  };
}

/**
 * The context for a read-only projection call (`scene`, `availableActions`, `view`) —
 * none of which advance anything. Derived from a `system:"view"` stream, deliberately
 * distinct from the `action` stream so a kind that ever drew randomness while rendering
 * could not collide with the next `submitAction`'s draw at the same seq (plan 09,
 * Decision 3).
 */
function buildReadContext(registry: ContentRegistry, campaign: Campaign, state: GameState): KindContext {
  const seq = state.actionLog.length;
  return buildKindContext(registry, campaign, state.seed, { kind: "system", system: "view", seq }, seq);
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

  // The start stream (`system:"start"`) is distinct from the per-action `action` stream,
  // so a start-of-game random draw can never collide with an action's (04 §4).
  const ctx = buildKindContext(host.registry, campaign, seed, { kind: "system", system: "start", seq: 0 }, 0);
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
  if (state.status !== "active") {
    const error: ValidationError = { code: "session_ended", messageKey: "core.reason.session_ended" };
    return { ok: false, errors: [error], warnings: [], changes: [], messages: [] };
  }

  const kind = host.kinds[state.kindId];
  if (!kind) {
    // Defensive: a GameState produced by this engine's own createGame/submitAction/
    // deserialize always has a kindId present in `host.kinds` (each of those validates
    // it). Only reachable via a hand-built or cross-version state — exactly what a
    // foreign deserialize could hand back.
    const error: ValidationError = { code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: state.kindId };
    return { ok: false, errors: [error], warnings: [], changes: [], messages: [] };
  }

  const campaign = host.registry.campaigns.get(state.campaignId);
  if (!campaign) {
    // Defensive, same reasoning as the kind check above: reachable only via a foreign or
    // hand-built state (deserialize now rejects this at the boundary too, but a state can
    // still be constructed directly in tests or by a future caller).
    const error: ValidationError = {
      code: "unknown_campaign",
      messageKey: "core.reason.unknown_campaign",
      path: state.campaignId,
    };
    return { ok: false, errors: [error], warnings: [], changes: [], messages: [] };
  }

  const seq = state.actionLog.length;
  const ctx = buildKindContext(host.registry, campaign, state.seed, { kind: "action", seq }, seq);
  const result = kind.advance(state.kindState, actionId, params, ctx);

  if (result.error) {
    return { ok: false, errors: [result.error], warnings: [], changes: [], messages: [] };
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
// now checks resolvability too (not just shape) before returning ok:true. None of these
// three methods can report an error — Engine.scene/availableActions/view return bare
// values, not a CommandResult — so the guarantee has to live at the boundary instead.

function view(host: EngineHost, state: GameState, audience: ProjectionAudience): PlayerView {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  const ctx = buildReadContext(host.registry, campaign, state);
  return {
    gameId: state.gameId,
    status: state.status,
    kindView: kind.project(state.kindState, audience, ctx),
  };
}

function availableActions(host: EngineHost, state: GameState): AvailableAction[] {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  const ctx = buildReadContext(host.registry, campaign, state);
  return kind.availableActions(state.kindState, ctx);
}

function scene(host: EngineHost, state: GameState): Scene {
  const campaign = host.registry.campaigns.get(state.campaignId)!;
  const kind = host.kinds[state.kindId]!;
  const ctx = buildReadContext(host.registry, campaign, state);
  return {
    gameId: state.gameId,
    status: state.status,
    body: kind.scene(state.kindState, ctx),
    actions: kind.availableActions(state.kindState, ctx),
    // Scene.view has no audience parameter — hardcoded to "player", matching
    // NewGameConfig.audience's own default.
    view: view(host, state, "player"),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = undefined;
  }

  if (!isValidGameStateShape(parsed)) {
    const error: ValidationError = { code: "invalid_state", messageKey: "core.reason.invalid_state" };
    return { ok: false, errors: [error], warnings: [] };
  }

  if (!host.registry.campaigns.has(parsed.campaignId)) {
    const error: ValidationError = {
      code: "unknown_campaign",
      messageKey: "core.reason.unknown_campaign",
      path: parsed.campaignId,
    };
    return { ok: false, errors: [error], warnings: [] };
  }

  if (!host.kinds[parsed.kindId]) {
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
