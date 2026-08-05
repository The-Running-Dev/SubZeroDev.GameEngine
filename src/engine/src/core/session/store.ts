/**
 * The in-memory `SessionStore` — the thin stateful layer above the pure engine.
 *
 * Contract: `04-core.md` §7, §7.1; `05-observability.md` §6, §6.1; `06-extensibility.md`
 * §5.2, §5.4. Design decisions: `plans/14-w7-session-store.md`, `plans/15-w8-profile-store.md`.
 *
 * Profile upserts (W8) run only around a successful `submitAction`, never at
 * `createSession` — nothing in resolution ever reads a profile (04 §7.1), and
 * `SessionHandle` has no warnings field to report a load problem through even if this
 * unit wanted to load one there. See plan 15, Decision 3.
 */

import type {
  ActionParams,
  Engine,
  GameState,
  NewGameConfig,
  Scene,
} from "../kernel/types.js";
import type { StateChange } from "../kernel/reasons.js";
import type { ContentRegistry } from "../registry/types.js";
import { buildSaveEnvelope, resolveSaveEnvelope, serializeSaveEnvelope } from "../persistence/envelope.js";
import type { PlayerView, ProjectionAudience } from "../projection/types.js";
import type { StringTable } from "../localization/types.js";
import type { ValidationWarning } from "../validation/types.js";
import type { Clock } from "../composition/types.js";
import type { Emitter, EmittedRecord, EmittedRecordSink } from "../observability/types.js";
import { defaultClock } from "../composition/defaults.js";
import type {
  CampaignSummary,
  CreateSessionConfig,
  PlayerProfile,
  ProfileStore,
  ProfileWarning,
  SaveHandle,
  SessionActionResult,
  SessionHandle,
  SessionStore,
  SessionPersistence,
  StoredSaveRecord,
  StoredSessionRecord,
} from "./types.js";
import { SessionStoreError as SessionStoreErrorValue } from "./types.js";
import type { SessionHost } from "../composition/types.js";

const noopRecordSink: EmittedRecordSink = { write: () => {} };

interface SessionRecord {
  sessionId: string;
  /** Canonical serialization only — never a live `GameState` (06 §5.2). */
  blob: string;
  audience: ProjectionAudience;
  /** Per-session submission counter (05 §6, plan 14 Decision 4). Only `submitAction`
   *  increments it; every other command stamps the current value. */
  attemptCounter: number;
  /** Set once at `createSession`, never swapped (06 §4's "supplied once" convention).
   *  Omitted → anonymous session: no profile read, no profile write (04 §7.1). */
  profileId?: string;
  /** False once this lineage has passed through a migrated `loadGame` — sticky forward,
   *  never reset (04 §10.2: a migrated save is no longer byte-replayable). Stamped into
   *  the next `SaveEnvelope` this session's `saveGame` produces. */
  replayCompatible: boolean;
  /** Wall-clock, ISO-8601, via `Clock` (04 §7) — outside the replayable `GameState`,
   *  never read by `advance`. Set once at `createSession`/`loadGame`, never swapped. */
  createdAt: string;
  /** Stamped on every command that mutates `blob` (`submitAction`); left as `createdAt`
   *  by commands that only read or copy state. */
  updatedAt: string;
}

/**
 * The cross-kind, session-store-facing convention for an achievement unlock (plan 15
 * Decision 1) — `04-core.md`/`03-story-graph-kind.md` name the mechanism but not this
 * exact shape, so it's fixed here and recorded as an open item in `TODO.md`.
 */
const ACHIEVEMENT_REASON = "achievement_unlocked";
const ACHIEVEMENT_PATH_PREFIX = "achieved.";

function achievementIdFrom(change: StateChange): string | undefined {
  if (change.reason !== ACHIEVEMENT_REASON) return undefined;
  if (!change.path.startsWith(ACHIEVEMENT_PATH_PREFIX)) return undefined;
  return change.path.slice(ACHIEVEMENT_PATH_PREFIX.length);
}

function toValidationWarning(warning: ProfileWarning): ValidationWarning {
  return { code: warning.code, messageKey: `core.reason.${warning.code}`, path: warning.profileId };
}

/**
 * Runs *after* `decoratedEngine.submitAction` has already returned — there is no code
 * path between "profile loaded" and "engine invoked" for the loaded profile to travel
 * through, which is what makes "a profile read never affects resolution" true by
 * construction rather than by convention (plan 15 Decision 3). Idempotent: an
 * already-present `{campaignId, achievementId}` is never re-added, whether it arrived via
 * an earlier action on this same profile or twice in one `changes` array.
 *
 * Exported for the replay regression oracle (`07-replay.md` §3.2), which drives the same
 * profile-upsert path directly against a raw `Engine` rather than through this
 * `SessionStore` — the oracle needs `finalStatus`/`terminal` off the raw `GameState`, which
 * `SessionStore`'s client-facing surface never exposes, but achievements must still go
 * through this exact tested path rather than a second, drifting reimplementation.
 */
export async function upsertAchievements(
  profiles: ProfileStore,
  profileId: string,
  campaignId: string,
  changes: readonly StateChange[],
): Promise<ValidationWarning[]> {
  const achievementIds = [...new Set(changes.map(achievementIdFrom).filter((id): id is string => id !== undefined))];
  if (achievementIds.length === 0) return [];

  const { profile, warnings: loadWarnings } = await profiles.load(profileId);
  const existing = new Set(profile.achievements.filter((a) => a.campaignId === campaignId).map((a) => a.achievementId));
  const newRecords = achievementIds.filter((id) => !existing.has(id)).map((achievementId) => ({ campaignId, achievementId }));

  if (newRecords.length === 0) {
    return loadWarnings.map(toValidationWarning);
  }

  const updated: PlayerProfile = { ...profile, achievements: [...profile.achievements, ...newRecords] };
  const { warnings: saveWarnings } = await profiles.save(updated);
  return [...loadWarnings, ...saveWarnings].map(toValidationWarning);
}

interface SaveRecord {
  saveId: string;
  campaignId: string;
  blob: string;
  savedAtSeq: number;
  audience: ProjectionAudience;
  /** Round-tripped the same way `audience` is — store-record metadata, never written into
   *  the serialized envelope/blob (08-session-capture.md §3.1: identity "live[s] on the
   *  session store's own record ... and stay[s] there"). Omitted → the saved session was
   *  anonymous; `loadGame` must not resurrect a profile association that never existed. */
  profileId?: string;
}

export interface InMemorySessionStoreOptions {
  engine: Engine;
  registry: ContentRegistry;
  /** Defaults to `defaultClock` (the real wall clock) — see `composition/defaults.ts`. */
  clock?: Clock;
  /** Defaults to a no-op — no boundary sink is wired unless a caller asks for one. */
  recordSink?: EmittedRecordSink;
  /** Omitted → every session is anonymous: no profile is ever loaded or saved (04 §7.1). */
  profiles?: ProfileStore;
  /** Optional host persistence. The in-memory maps remain the default implementation. */
  persistence?: SessionPersistence;
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
      // Same "must not throw, and the core defends anyway" contract as safeEmit
      // (observability/emitter.ts, 05 §10) — a faulty EmittedRecordSink must not be able
      // to abort a session-store command.
      try {
        sink.write(record);
      } catch {
        // Discarded — see safeEmit's doc comment; the same reasoning applies here.
      }
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

function createStore(options: InMemorySessionStoreOptions): SessionStore {
  const { engine, registry } = options;
  // Read off `engine` rather than taken as a second, independently-suppliable option
  // (Qodo review, PR #92) — this is the same `KindRegistry` every gameplay call already
  // resolves `state.kindId` against, so `saveGame`/`loadGame`'s stamping and migration
  // dispatch structurally cannot disagree with it.
  const kinds = engine.kinds;
  const clock = options.clock ?? defaultClock;
  const recordSink = options.recordSink ?? noopRecordSink;

  const sessions = new Map<string, SessionRecord>();
  const saves = new Map<string, SaveRecord>();
  // Per-session serialization. `withCommand`'s `await Promise.resolve()` (Decision 9) is
  // what makes cross-session concurrency genuinely interleave for the isolation test — but
  // the same yield point would let two commands against the *same* session both read
  // `record.blob` before either writes it back, losing an update. Queuing same-session
  // commands behind their predecessor closes that without affecting cross-session
  // concurrency at all, since each sessionId gets its own independent queue.
  const sessionLocks = new Map<string, Promise<unknown>>();
  // Same reasoning, one lock domain over: `upsertAchievements`'s load→merge→save is
  // itself a read-modify-write, and two *different* sessions can share the same
  // `profileId` (that's the whole point of a profile) — `sessionLocks` alone doesn't
  // serialize that. A second, independent lock domain keyed by `profileId` closes it
  // without coupling to session locking at all.
  const profileLocks = new Map<string, Promise<unknown>>();

  function runExclusive<T>(locks: Map<string, Promise<unknown>>, key: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  async function getSession(sessionId: string): Promise<SessionRecord> {
    const record = sessions.get(sessionId);
    if (record) return record;
    try {
      const stored = await options.persistence?.sessions.get(sessionId);
      if (stored) {
        sessions.set(sessionId, stored);
        return stored;
      }
    } catch {
      throw new SessionStoreErrorValue("session", "storage_failure");
    }
    throw new SessionStoreErrorValue("session", "unknown_session", `session store: unknown sessionId "${sessionId}"`);
  }

  async function getSave(saveId: string): Promise<SaveRecord> {
    const record = saves.get(saveId);
    if (record) return record;
    try {
      const stored = await options.persistence?.saves.get(saveId);
      if (stored) {
        const restored: SaveRecord = stored;
        saves.set(saveId, restored);
        return restored;
      }
    } catch {
      throw new SessionStoreErrorValue("loadGame", "storage_failure");
    }
    throw new SessionStoreErrorValue("loadGame", "unknown_save", `session store: unknown saveId "${saveId}"`);
  }

  async function writeSession(record: SessionRecord): Promise<void> {
    if (!options.persistence) return;
    try {
      await options.persistence.sessions.put(record as StoredSessionRecord);
    } catch {
      throw new SessionStoreErrorValue("session", "storage_failure");
    }
  }

  async function writeSave(record: SaveRecord): Promise<void> {
    if (!options.persistence) return;
    try {
      await options.persistence.saves.put(record as StoredSaveRecord);
    } catch {
      throw new SessionStoreErrorValue("saveGame", "storage_failure");
    }
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
    fn: (decoratedEngine: Engine) => T | Promise<T>,
  ): Promise<T> {
    const traceId = mintId();
    const spanId = mintId();
    await Promise.resolve();
    const decorator = buildDecorator(clock, recordSink, { traceId, spanId, attempt, ...(sessionId !== undefined ? { sessionId } : {}) });
    return await fn(engine.withEmitter(decorator));
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
      const record = await getSession(sessionId);
      const state = mustDeserialize(engine, record.blob);
      return engine.scene(state);
    },

    async getView(sessionId: string): Promise<PlayerView> {
      const record = await getSession(sessionId);
      const state = mustDeserialize(engine, record.blob);
      return engine.view(state, record.audience);
    },

    async getStrings(sessionId: string): Promise<StringTable> {
      // Validates the session exists even though the returned table doesn't depend on
      // which one — plan 14 Decision 7: the registry has no per-campaign string
      // partition to narrow by, so the whole frozen table is returned.
      await getSession(sessionId);
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

      return withCommand(sessionId, 0, async (decoratedEngine) => {
        const created = decoratedEngine.createGame(newGameConfig);
        if (!created.ok || !created.value) {
          // createSession's return type carries no error channel (session/types.ts) —
          // same reasoning as getSession's throw above.
          const code = created.errors[0]?.code ?? "unknown_campaign";
          throw new SessionStoreErrorValue("createSession", code === "unknown_campaign" ? code : "invalid_state");
        }
        const state = created.value;
        const now = clock.now();
        const record: SessionRecord = {
          sessionId,
          blob: decoratedEngine.serialize(state),
          audience,
          attemptCounter: 0,
          replayCompatible: true,
          createdAt: now,
          updatedAt: now,
          ...(config.profileId !== undefined ? { profileId: config.profileId } : {}),
        };
        await writeSession(record);
        sessions.set(sessionId, record);
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },

    async resumeSession(sessionId: string): Promise<Scene> {
      const record = await getSession(sessionId);
      return runExclusive(sessionLocks, sessionId, () =>
        withCommand(sessionId, record.attemptCounter, async (decoratedEngine) => {
          const state = mustDeserialize(decoratedEngine, record.blob);
          return decoratedEngine.scene(state);
        }),
      );
    },

    async submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult> {
      const record = await getSession(sessionId);

      return runExclusive(sessionLocks, sessionId, () => {
        // Increments before dispatch, including for a submission that goes on to be
        // rejected — plan 14 Decision 4. `attempt: 1` on the first submission, not `0`.
        // Deferred to inside the lock so two same-session submissions still attempt in
        // the order they acquire it, not the order they were called.
        record.attemptCounter += 1;
        const attempt = record.attemptCounter;

        return withCommand(sessionId, attempt, async (decoratedEngine) => {
          const state = mustDeserialize(decoratedEngine, record.blob);
          const result = decoratedEngine.submitAction(state, actionId, params);

          if (result.ok && result.value) {
            record.blob = decoratedEngine.serialize(result.value);
            record.updatedAt = clock.now();
            await writeSession(record);

            // "After a successful action" (04 §7.1) — never on rejection, and never
            // before the engine call above has already returned (plan 15 Decision 3).
            // Locked per-profileId (not just per-session): two different sessions can
            // share a profileId, and the upsert itself is a load-modify-save that would
            // otherwise race across them. Caught, not propagated: a throwing/rejecting
            // ProfileStore must degrade to a warning, the same as an explicit
            // profile_write_failed — it must never abort a command whose game action has
            // already advanced and been persisted.
            const { profiles } = options;
            let profileWarnings: ValidationWarning[] = [];
            if (profiles && record.profileId) {
              const profileId = record.profileId;
              try {
                profileWarnings = await runExclusive(profileLocks, profileId, () =>
                  upsertAchievements(profiles, profileId, state.campaignId, result.changes),
                );
              } catch {
                profileWarnings = [{ code: "profile_write_failed", messageKey: "core.reason.profile_write_failed", path: profileId }];
              }
            }

            return {
              ok: true,
              scene: decoratedEngine.scene(result.value),
              errors: result.errors,
              warnings: [...result.warnings, ...profileWarnings],
              changes: result.changes,
              messages: result.messages,
            };
          }

          return { ok: false, errors: result.errors, warnings: result.warnings, changes: result.changes, messages: result.messages };
        });
      });
    },

    async previewAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult> {
      const record = await getSession(sessionId);

      // Shares the session queue with submissions so the preview cannot evaluate one version
      // while a neighbouring command persists another. It deliberately does not increment
      // attemptCounter, write record.blob, or touch profile persistence.
      return runExclusive(sessionLocks, sessionId, async () => {
        const state = mustDeserialize(engine, record.blob);
        const result = engine.previewAction(state, actionId, params);

        if (result.ok && result.value) {
          return {
            ok: true,
            scene: engine.scene(result.value),
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
      const record = await getSession(sessionId);
      return runExclusive(sessionLocks, sessionId, () =>
        withCommand(sessionId, record.attemptCounter, async (decoratedEngine) => {
          const state = mustDeserialize(decoratedEngine, record.blob);
          const campaign = registry.campaigns.get(state.campaignId);
          const kind = kinds[state.kindId];
          if (!campaign || !kind) {
            // Defensive, same class as mustDeserialize's own throw above: a state this
            // engine just resolved (deserializeState checks both campaignId and kindId)
            // cannot fail either lookup except through store corruption.
            throw new Error("session store: saveGame — resolved state's campaign or kind is missing from the registry");
          }
          const envelope = buildSaveEnvelope({ state, kind, campaign, replayCompatible: record.replayCompatible });
          const saveId = mintId();
          const save: SaveRecord = {
            saveId,
            campaignId: state.campaignId,
            blob: serializeSaveEnvelope(envelope),
            savedAtSeq: state.actionLog.length,
            audience: record.audience,
            ...(record.profileId !== undefined ? { profileId: record.profileId } : {}),
          };
          saves.set(saveId, save);
          await writeSave(save);
          return { saveId, savedAtSeq: state.actionLog.length };
        }),
      );
    },

    async loadGame(saveId: string): Promise<SessionHandle> {
      const save = await getSave(saveId);
      const sessionId = mintId();

      return withCommand(sessionId, 0, async (decoratedEngine) => {
        const resolution = resolveSaveEnvelope(save.blob, kinds, registry);
        if (!resolution.ok) {
          // No CommandResult channel on SaveHandle/SessionHandle to report this through —
          // same reasoning as createSession's throw above (plan 14, Design item 1).
          throw new SessionStoreErrorValue("loadGame", resolution.code);
        }
        // Re-validated through the engine's own deserialize — the same boundary check and
        // event emission every other state entering a session goes through, rather than
        // envelope.ts's own checks (necessarily narrower: they only need enough to compare
        // versions) standing in as a second, parallel guarantee.
        const state = mustDeserialize(decoratedEngine, decoratedEngine.serialize(resolution.state));
        // The saved audience and profileId both round-trip through SaveRecord (set in
        // saveGame above), never through the serialized envelope — a session created with
        // audience: "ai" must still be "ai" after save/load, and a profiled session must
        // not silently become anonymous (achievements would stop mirroring to the profile).
        const now = clock.now();
        const record: SessionRecord = {
          sessionId,
          blob: decoratedEngine.serialize(state),
          audience: save.audience,
          attemptCounter: 0,
          replayCompatible: resolution.replayCompatible,
          createdAt: now,
          updatedAt: now,
          ...(save.profileId !== undefined ? { profileId: save.profileId } : {}),
        };
        await writeSession(record);
        sessions.set(sessionId, record);
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },
  };
}

/** The canonical session-layer composition root. */
export function createSessionLayer(host: SessionHost): SessionStore {
  return createStore(host);
}

/** Compatibility convenience for the default in-memory host. */
export function createInMemorySessionStore(options: InMemorySessionStoreOptions): SessionStore {
  return createStore(options);
}
