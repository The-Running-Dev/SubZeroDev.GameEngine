/**
 * The in-memory `SessionStore` — the thin stateful layer above the pure engine.
 *
 * Contract: `04-core.md` §7, §7.1; `05-observability.md` §6, §6.1; `06-extensibility.md`
 * §5.2, §5.4. Design decisions: `plans/14-w7-session-store.md`.
 *
 * `ProfileStore` wiring is explicitly **not** this unit's job — TODO.md lists it as W8,
 * and no kind yet produces an `achievement_unlocked` `StateChange` for this layer to act
 * on. `CreateSessionConfig.profileId` is accepted by the type but inert here.
 */

import type {
  ActionParams,
  Engine,
  GameState,
  NewGameConfig,
  Scene,
} from "../kernel/types.js";
import type { ContentRegistry } from "../registry/types.js";
import type { PlayerView, ProjectionAudience } from "../projection/types.js";
import type { StringTable } from "../localization/types.js";
import type { Clock } from "../composition/types.js";
import type { Emitter, EmittedRecord, EmittedRecordSink } from "../observability/types.js";
import { defaultClock } from "../composition/defaults.js";
import type {
  CampaignSummary,
  CreateSessionConfig,
  SaveHandle,
  SessionActionResult,
  SessionHandle,
  SessionStore,
} from "./types.js";

const noopRecordSink: EmittedRecordSink = { write: () => {} };

interface SessionRecord {
  sessionId: string;
  /** Canonical serialization only — never a live `GameState` (06 §5.2). */
  blob: string;
  audience: ProjectionAudience;
  /** Per-session submission counter (05 §6, plan 14 Decision 4). Only `submitAction`
   *  increments it; every other command stamps the current value. */
  attemptCounter: number;
}

interface SaveRecord {
  saveId: string;
  blob: string;
  savedAtSeq: number;
}

export interface InMemorySessionStoreOptions {
  engine: Engine;
  registry: ContentRegistry;
  /** Defaults to `defaultClock` (the real wall clock) — see `composition/defaults.ts`. */
  clock?: Clock;
  /** Defaults to a no-op — no boundary sink is wired unless a caller asks for one. */
  recordSink?: EmittedRecordSink;
}

/**
 * A `sessionId`/`saveId` never enters `GameState` — it's store metadata, the same category
 * `traceId`/`spanId` fall into (plan 14 Decision 8). `crypto.randomUUID()` matches
 * `defaultIdSource`'s own choice for exactly the same reason: this is the one place
 * unpredictability is legitimate.
 */
function mintId(): string {
  return crypto.randomUUID();
}

/**
 * Builds the short-lived per-command decorator `Emitter` (05 §6.1) that turns every bare
 * `EngineEvent` the decorated engine emits into a stamped `EmittedRecord`, forwarded to the
 * store's configured boundary sink. Scoped to one command by construction — nothing here
 * outlives the call that builds it.
 */
function buildDecorator(
  clock: Clock,
  sink: EmittedRecordSink,
  ctx: { traceId: string; spanId: string; attempt: number; sessionId?: string },
): Emitter {
  return {
    emit(event) {
      const record: EmittedRecord = {
        event,
        emittedAt: clock.now(),
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        attempt: ctx.attempt,
        ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
      };
      sink.write(record);
    },
  };
}

/**
 * `deserialize` on a blob this store produced itself should always succeed. A failure here
 * is unreachable except through store corruption, and is treated the same defensive way
 * `kernel/engine.ts` treats its own "can only happen via a foreign state" checks.
 */
function mustDeserialize(engine: Engine, blob: string): GameState {
  const result = engine.deserialize(blob);
  if (!result.ok || !result.value) {
    throw new Error("session store: a stored blob failed to deserialize against its own engine");
  }
  return result.value;
}

export function createInMemorySessionStore(options: InMemorySessionStoreOptions): SessionStore {
  const { engine, registry } = options;
  const clock = options.clock ?? defaultClock;
  const recordSink = options.recordSink ?? noopRecordSink;

  const sessions = new Map<string, SessionRecord>();
  const saves = new Map<string, SaveRecord>();

  function getSession(sessionId: string): SessionRecord {
    const record = sessions.get(sessionId);
    if (!record) {
      // No ReasonCode fits "the session id itself doesn't exist" — that's a host-routing
      // error, not a game rejection, and none of SessionStore's methods carry a
      // CommandResult wrapper to report one through (plan 14, Design section item 1).
      throw new Error(`session store: unknown sessionId "${sessionId}"`);
    }
    return record;
  }

  function getSave(saveId: string): SaveRecord {
    const record = saves.get(saveId);
    if (!record) {
      throw new Error(`session store: unknown saveId "${saveId}"`);
    }
    return record;
  }

  /**
   * The five **commands** 05 §6.1 names get a span: `createSession`, `resumeSession`,
   * `submitAction`, `saveGame`, `loadGame`. Each mints a fresh `traceId`/`spanId`, yields
   * once (plan 14 Decision 9 — what makes the concurrency property test meaningful rather
   * than a restatement of JS's run-to-completion semantics), then hands the caller an
   * engine rebound to this command's stamping decorator.
   */
  async function withCommand<T>(
    sessionId: string | undefined,
    attempt: number,
    fn: (decoratedEngine: Engine) => T,
  ): Promise<T> {
    const traceId = mintId();
    const spanId = mintId();
    await Promise.resolve();
    const decorator = buildDecorator(clock, recordSink, { traceId, spanId, attempt, ...(sessionId !== undefined ? { sessionId } : {}) });
    return fn(engine.withEmitter(decorator));
  }

  return {
    // ── Queries — no span, no decorator (05 §6.1 names only the five commands below) ──
    listCampaigns(): CampaignSummary[] {
      return [...registry.campaigns.values()].map((campaign) => ({
        campaignId: campaign.id,
        kindId: campaign.kindId,
        titleKey: campaign.titleKey,
      }));
    },

    async getScene(sessionId: string): Promise<Scene> {
      const record = getSession(sessionId);
      const state = mustDeserialize(engine, record.blob);
      return engine.scene(state);
    },

    async getView(sessionId: string): Promise<PlayerView> {
      const record = getSession(sessionId);
      const state = mustDeserialize(engine, record.blob);
      return engine.view(state, record.audience);
    },

    async getStrings(sessionId: string): Promise<StringTable> {
      // Validates the session exists even though the returned table doesn't depend on
      // which one — plan 14 Decision 7: the registry has no per-campaign string
      // partition to narrow by, so the whole frozen table is returned.
      getSession(sessionId);
      const table: Record<string, string> = {};
      for (const [key, text] of registry.strings) {
        table[key] = text;
      }
      return table;
    },

    // ── Commands — spanned and stamped (05 §6.1) ──
    async createSession(config: CreateSessionConfig): Promise<SessionHandle> {
      const sessionId = mintId();
      const audience = config.audience ?? "player";
      const newGameConfig: NewGameConfig = { campaignId: config.campaignId, ...(config.seed !== undefined ? { seed: config.seed } : {}), audience };

      return withCommand(sessionId, 0, (decoratedEngine) => {
        const created = decoratedEngine.createGame(newGameConfig);
        if (!created.ok || !created.value) {
          // createSession's return type carries no error channel (session/types.ts) —
          // same reasoning as getSession's throw above.
          const code = created.errors[0]?.code ?? "unknown_campaign";
          throw new Error(`session store: createSession rejected — ${code}`);
        }
        const state = created.value;
        sessions.set(sessionId, { sessionId, blob: decoratedEngine.serialize(state), audience, attemptCounter: 0 });
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },

    async resumeSession(sessionId: string): Promise<Scene> {
      const record = getSession(sessionId);
      return withCommand(sessionId, record.attemptCounter, (decoratedEngine) => {
        const state = mustDeserialize(decoratedEngine, record.blob);
        return decoratedEngine.scene(state);
      });
    },

    async submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult> {
      const record = getSession(sessionId);
      // Increments before dispatch, including for a submission that goes on to be
      // rejected — plan 14 Decision 4. `attempt: 1` on the first submission, not `0`.
      record.attemptCounter += 1;
      const attempt = record.attemptCounter;

      return withCommand(sessionId, attempt, (decoratedEngine) => {
        const state = mustDeserialize(decoratedEngine, record.blob);
        const result = decoratedEngine.submitAction(state, actionId, params);

        if (result.ok && result.value) {
          record.blob = decoratedEngine.serialize(result.value);
          return {
            ok: true,
            scene: decoratedEngine.scene(result.value),
            errors: result.errors,
            warnings: result.warnings,
            changes: result.changes,
            messages: result.messages,
          };
        }

        return { ok: false, errors: result.errors, warnings: result.warnings, changes: result.changes, messages: result.messages };
      });
    },

    async saveGame(sessionId: string): Promise<SaveHandle> {
      const record = getSession(sessionId);
      return withCommand(sessionId, record.attemptCounter, (decoratedEngine) => {
        const state = mustDeserialize(decoratedEngine, record.blob);
        const saveId = mintId();
        saves.set(saveId, { saveId, blob: record.blob, savedAtSeq: state.actionLog.length });
        return { saveId, savedAtSeq: state.actionLog.length };
      });
    },

    async loadGame(saveId: string): Promise<SessionHandle> {
      const save = getSave(saveId);
      const sessionId = mintId();

      return withCommand(sessionId, 0, (decoratedEngine) => {
        const state = mustDeserialize(decoratedEngine, save.blob);
        // A loaded session has no NewGameConfig.audience to recover from GameState (it
        // was never part of the envelope) — defaults to "player", the same default
        // scene()'s own bundled view uses (kernel/engine.ts).
        sessions.set(sessionId, { sessionId, blob: save.blob, audience: "player", attemptCounter: 0 });
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },
  };
}
