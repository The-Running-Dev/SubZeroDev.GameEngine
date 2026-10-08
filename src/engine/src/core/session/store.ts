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
  Kind,
  NewGameConfig,
  Scene,
} from "../kernel/types.js";
import type { OutcomeMessage, StateChange } from "../kernel/reasons.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import { buildSaveEnvelope, resolveSaveEnvelope, serializeSaveEnvelope } from "../persistence/envelope.js";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";
import type { PlayerView, ProjectionAudience } from "../projection/types.js";
import type { StringTable } from "../localization/types.js";
import type { ValidationWarning } from "../validation/types.js";
import type { Clock, RecordIdSource } from "../composition/types.js";
import type { Emitter, EmittedRecord, EmittedRecordSink } from "../observability/types.js";
import { defaultClock } from "../composition/defaults.js";
import type {
  CampaignCatalog,
  CampaignProgress,
  CampaignSummary,
  CreateSessionConfig,
  KindProfileRecord,
  PlayerProfile,
  ProfileStore,
  ProfileWarning,
  SaveHandle,
  SaveSummary,
  SessionActionResult,
  SessionHandle,
  SessionStore,
  SessionPersistence,
  StoredSaveRecord,
  StoredSessionRecord,
  TerminalRecord,
} from "./types.js";
import {
  SESSION_PERSISTENCE_CONFLICT,
  SessionStoreError as SessionStoreErrorValue,
} from "./types.js";
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
  /** The committed-write counter a multi-writer adapter compares (20-contract.md §7.2) —
   *  `0` when the record is first written, `+1` on every accepted `submitAction` write, and
   *  never moved by a rejection or a preview. Distinct from `attemptCounter`, which a
   *  rejected submission also advances without any write. */
  revision: number;
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
 * exact shape, so it's fixed here and recorded as an open item in `TODO.md`. `story-graph`
 * writes the flat `achieved.<id>` shape; `world-graph` (12 §13/W85) writes its own
 * member-scoped `unlockedAchievementIds.<id>.exists`, following its own path-addressing
 * rule (20-contract.md §13) rather than the flat one — both are matched here since neither
 * kind's own contract is wrong, they simply chose different literal shapes.
 */
const ACHIEVEMENT_REASON = "achievement_unlocked";
const ACHIEVEMENT_PATH_PREFIX = "achieved.";
const ACHIEVEMENT_MEMBER_PATH_PREFIX = "unlockedAchievementIds.";
const ACHIEVEMENT_MEMBER_PATH_SUFFIX = ".exists";

function achievementIdFrom(change: StateChange): string | undefined {
  if (change.reason !== ACHIEVEMENT_REASON) return undefined;
  if (change.path.startsWith(ACHIEVEMENT_PATH_PREFIX)) return change.path.slice(ACHIEVEMENT_PATH_PREFIX.length);
  if (change.path.startsWith(ACHIEVEMENT_MEMBER_PATH_PREFIX) && change.path.endsWith(ACHIEVEMENT_MEMBER_PATH_SUFFIX)) {
    return change.path.slice(ACHIEVEMENT_MEMBER_PATH_PREFIX.length, -ACHIEVEMENT_MEMBER_PATH_SUFFIX.length);
  }
  return undefined;
}

function toValidationWarning(warning: ProfileWarning): ValidationWarning {
  const path = warning.kindId !== undefined ? `${warning.profileId}:${warning.kindId}` : warning.profileId;
  return { code: warning.code, messageKey: `core.reason.${warning.code}`, path };
}

/** The one player-response projection (20-contract.md §7): every exit of `submitAction` and
 *  `previewAction` passes through here, so a hidden `StateChange` or `OutcomeMessage` never
 *  leaves the store, for any audience. The engine's own `ActionResult` stays complete — it is
 *  the audit surface the profile fold, replay and observability read. */
function toPlayerResult(result: {
  ok: boolean;
  scene?: Scene;
  errors: SessionActionResult["errors"];
  warnings: SessionActionResult["warnings"];
  changes: readonly StateChange[];
  messages: readonly OutcomeMessage[];
}): SessionActionResult {
  const projected: SessionActionResult = {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    changes: result.changes.filter((change) => change.visible),
    messages: result.messages.filter((message) => message.visible),
  };
  if (result.scene !== undefined) projected.scene = result.scene;
  return projected;
}

/** The canonical serialization of a folded `KindProfileRecord.data` must not exceed this
 *  many bytes (04 §7.1) — a per-record cap, not per-profile, so one kind cannot starve
 *  another. */
const KIND_PROFILE_DATA_MAX_BYTES = 65536;

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

/**
 * The terminal mirror (04 §7.1, §7.3) — same shape and same reasoning as
 * `upsertAchievements` above, run on the same write. A `null` `terminalId` records
 * nothing: not every ended game names a terminal (04 §3.2).
 */
export async function upsertTerminals(
  profiles: ProfileStore,
  profileId: string,
  campaignId: string,
  terminalId: string | null,
): Promise<ValidationWarning[]> {
  if (terminalId === null) return [];

  const { profile, warnings: loadWarnings } = await profiles.load(profileId);
  const alreadyRecorded = profile.terminals.some((t) => t.campaignId === campaignId && t.terminalId === terminalId);
  if (alreadyRecorded) {
    return loadWarnings.map(toValidationWarning);
  }

  const newRecord: TerminalRecord = { campaignId, terminalId };
  const updated: PlayerProfile = { ...profile, terminals: [...profile.terminals, newRecord] };
  const { warnings: saveWarnings } = await profiles.save(updated);
  return [...loadWarnings, ...saveWarnings].map(toValidationWarning);
}

/**
 * The third mirror (04 §7.1) — a kind's own cross-game slice, folded through
 * `Kind.profileData.fold` on the same profile-keyed write as the achievement and terminal
 * upserts. A no-op when `kind` declares no `profileData` at all: no record is ever created
 * for it, exactly as the contract states.
 *
 * `fold` is invoked defensively — content-adjacent code that may throw, the same treatment
 * `resolveSaveEnvelope` already gives `migrateState`. A throw, or a result the canonical
 * serializer rejects (non-finite numbers, `bigint`, an `undefined` in a value position), is
 * refused: the previous `data` is retained untouched and one `profile_kind_data_rejected`
 * warning names the kind. A folded value canonically equal to the current one is not
 * written at all — this is what makes `fold`'s idempotence observable (P6/P8, §7.1).
 */
export async function upsertKindProfileData(
  profiles: ProfileStore,
  profileId: string,
  kind: Kind<unknown>,
  campaign: Campaign,
  changes: readonly StateChange[],
): Promise<ValidationWarning[]> {
  const profileData = kind.profileData;
  if (!profileData) return [];

  const { profile, warnings: loadWarnings } = await profiles.load(profileId);
  const existingIndex = profile.kindData.findIndex((r) => r.kindId === kind.id);
  const current = existingIndex === -1 ? undefined : profile.kindData[existingIndex]!.data;
  const rejected: ProfileWarning = { code: "profile_kind_data_rejected", profileId, kindId: kind.id };

  let folded: unknown;
  try {
    folded = profileData.fold(current, campaign, changes);
  } catch {
    return [...loadWarnings, rejected].map(toValidationWarning);
  }

  let serialized: string | undefined;
  let currentSerialized: string | undefined;
  try {
    serialized = folded === undefined ? undefined : canonicalStringify(folded);
    currentSerialized = current === undefined ? undefined : canonicalStringify(current);
  } catch {
    return [...loadWarnings, rejected].map(toValidationWarning);
  }

  if (serialized === currentSerialized) {
    return loadWarnings.map(toValidationWarning);
  }
  if (serialized !== undefined && new TextEncoder().encode(serialized).length > KIND_PROFILE_DATA_MAX_BYTES) {
    return [...loadWarnings, rejected].map(toValidationWarning);
  }

  const newRecord: KindProfileRecord = { kindId: kind.id, dataVersion: profileData.version, data: folded };
  const kindData = existingIndex === -1
    ? [...profile.kindData, newRecord].sort((a, b) => (a.kindId < b.kindId ? -1 : a.kindId > b.kindId ? 1 : 0))
    : profile.kindData.map((r, i) => (i === existingIndex ? newRecord : r));

  const updated: PlayerProfile = { ...profile, kindData };
  const { warnings: saveWarnings } = await profiles.save(updated);
  return [...loadWarnings, ...saveWarnings].map(toValidationWarning);
}

/**
 * §7.1: reads the profile once, at `createSession`, and resolves/migrates the one
 * `KindProfileRecord` matching this campaign's kind — never at `resumeSession`, `loadGame`
 * or `branchSession`, which must not re-seed from a profile that has moved on since. A
 * missing record, an unregistered kind declaring no `profileData`, or an anonymous session
 * (no `profileId`) all resolve to `undefined`, exactly as an absent `NewGameConfig.
 * kindProfileData` already means "no cross-game history" to `initialState`.
 *
 * `SessionHandle` has no warnings channel (same limitation `createSession`'s own header
 * states for achievements), so a version mismatch with no migration, or a migration that
 * fails or throws, degrades silently to "no cross-game history" rather than surfacing
 * `profile_kind_data_unreadable` — the same degradation §7.1 states for the general case.
 */
async function resolveKindProfileData(
  profiles: ProfileStore | undefined,
  profileId: string | undefined,
  kind: Kind<unknown> | undefined,
): Promise<unknown> {
  if (!profiles || profileId === undefined || !kind?.profileData) return undefined;

  const { profile } = await profiles.load(profileId);
  const record = profile.kindData.find((r) => r.kindId === kind.id);
  if (!record) return undefined;

  if (record.dataVersion === kind.profileData.version) return record.data;
  if (record.dataVersion < kind.profileData.version && kind.profileData.migrate) {
    try {
      const migrated = kind.profileData.migrate(record.data, record.dataVersion);
      return migrated.ok ? migrated.value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

interface SaveRecord {
  saveId: string;
  campaignId: string;
  blob: string;
  /** Clock-stamped (06 §5.4), never `Date.now` — §7.4's `listSaves` sort key and
   *  `deleteSave`'s compare-and-delete precondition. */
  savedAt: string;
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
  /** Resolved, enrolled assignments stamped unchanged onto every emitted record.
   *  Omitted → no experiment attribution (05 §6, 06 §5.5). */
  experiments?: Readonly<Record<string, string>>;
  /** Omitted → every session is anonymous: no profile is ever loaded or saved (04 §7.1). */
  profiles?: ProfileStore;
  /** Optional host persistence. The in-memory maps remain the default implementation. */
  persistence?: SessionPersistence;
  /** Omitted → session and save ids are minted as they are today (`mintId`, unseamed). */
  recordIds?: RecordIdSource;
  /** 06 §5.2. With `persistence`, the most sessions held in memory; the least recently used
   *  idle one is dropped and re-read from persistence on its next use. Omitted → unbounded.
   *  A positive integer, and only with `persistence` — without it the map is the storage. */
  sessionCacheLimit?: number;
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

/** Session id for `createSession`/`loadGame` — `recordIds`, when supplied, replaces
 *  only this call site and the one in `newSaveId` below; `traceId`/`spanId` keep minting
 *  through `mintId()` unconditionally (06 §5.7's `RecordIdSource` governs session and save
 *  ids only — trace and span ids are per-command correlation, not host-addressed records). */
function newSessionId(recordIds: RecordIdSource | undefined): string {
  return recordIds ? recordIds.newSessionId() : mintId();
}

function newSaveId(recordIds: RecordIdSource | undefined): string {
  return recordIds ? recordIds.newSaveId() : mintId();
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
  ctx: {
    traceId: string;
    spanId: string;
    attempt: number;
    sessionId?: string;
    experiments?: Readonly<Record<string, string>>;
  },
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
        ...(ctx.experiments !== undefined ? { experiments: ctx.experiments } : {}),
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

/**
 * Runs `fn` after every operation already queued on `key` has settled, and returns its result.
 * The queue entry is removed once its last run settles — only while it is still the map's
 * current tail, so an operation queued behind it in the meantime keeps its place (S127).
 */
export function runExclusive<T>(locks: Map<string, Promise<unknown>>, key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
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
  const recordIds = options.recordIds;
  const experiments = options.experiments;
  const sessionCacheLimit = options.sessionCacheLimit;
  if (sessionCacheLimit !== undefined) {
    if (!Number.isSafeInteger(sessionCacheLimit) || sessionCacheLimit < 1) {
      throw new RangeError("session store: sessionCacheLimit must be a positive integer");
    }
    if (!options.persistence) {
      throw new RangeError("session store: sessionCacheLimit requires persistence — without it the cache is the storage");
    }
  }

  // With `persistence`, `sessions` is a cache — bounded when `sessionCacheLimit` is set, in
  // least-recently-used order (the Map's insertion order, refreshed on every use) — and
  // `saves` stays empty: a save is read from persistence each time (S127). Without it, both
  // maps are the storage and are never trimmed.
  const sessions = new Map<string, SessionRecord>();
  const saves = new Map<string, SaveRecord>();
  // Sessions a command is holding a record for, from its `getSession` to its settling. Never
  // evicted: a second command would re-read the row into a second object, and the two would
  // write over each other with no adapter conflict to catch it on a single-writer host.
  const pinnedSessions = new Map<string, number>();
  // A persistence read in flight, shared by every caller that misses the cache for the same
  // session meanwhile — for the same reason: two reads would make two objects.
  const sessionReads = new Map<string, Promise<SessionRecord>>();
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
  // A third, independent lock domain (04 §7): a save outlives the session that wrote it,
  // and `deleteSave` is addressed by `saveId` alone, so its compare-and-delete needs its
  // own queue rather than either of the two above.
  const saveLocks = new Map<string, Promise<unknown>>();

  /** Caches `record` as the most recently used session, then trims to `sessionCacheLimit`. */
  function cacheSession(sessionId: string, record: SessionRecord): void {
    sessions.delete(sessionId);
    sessions.set(sessionId, record);
    trimSessions();
  }

  /** Drops the least recently used unpinned sessions until the cache is within its limit. A
   *  cache full of pinned sessions stays over it until one is released. */
  function trimSessions(): void {
    if (sessionCacheLimit === undefined) return;
    for (const sessionId of sessions.keys()) {
      if (sessions.size <= sessionCacheLimit) return;
      if (!pinnedSessions.has(sessionId)) sessions.delete(sessionId);
    }
  }

  /** `fn` with `sessionId`'s record, pinned in the cache until `fn` settles. */
  async function holdSession<T>(sessionId: string, fn: (record: SessionRecord) => Promise<T>): Promise<T> {
    pinnedSessions.set(sessionId, (pinnedSessions.get(sessionId) ?? 0) + 1);
    try {
      return await fn(await getSession(sessionId));
    } finally {
      const pins = (pinnedSessions.get(sessionId) ?? 1) - 1;
      if (pins === 0) pinnedSessions.delete(sessionId);
      else pinnedSessions.set(sessionId, pins);
      trimSessions();
    }
  }

  async function getSession(sessionId: string): Promise<SessionRecord> {
    const record = sessions.get(sessionId);
    if (record) {
      if (sessionCacheLimit !== undefined) cacheSession(sessionId, record);
      return record;
    }
    const pending = sessionReads.get(sessionId);
    if (pending) return pending;
    const read = readSession(sessionId);
    sessionReads.set(sessionId, read);
    try {
      return await read;
    } finally {
      sessionReads.delete(sessionId);
    }
  }

  async function readSession(sessionId: string): Promise<SessionRecord> {
    try {
      const stored = await options.persistence?.sessions.get(sessionId);
      if (stored) {
        // Copied: the store mutates its cached record in place before a write, and an
        // adapter that hands back its own object would see that mutation before the
        // `put` it is meant to compare against.
        const restored: SessionRecord = { ...stored };
        cacheSession(sessionId, restored);
        return restored;
      }
    } catch {
      throw new SessionStoreErrorValue("session", "storage_failure");
    }
    throw new SessionStoreErrorValue("session", "unknown_session", `session store: unknown sessionId "${sessionId}"`);
  }

  async function getSave(saveId: string, operation = "loadGame"): Promise<SaveRecord> {
    if (!options.persistence) {
      const record = saves.get(saveId);
      if (record) return record;
      throw new SessionStoreErrorValue(operation, "unknown_save", `session store: unknown saveId "${saveId}"`);
    }
    try {
      const stored = await options.persistence.saves.get(saveId);
      if (stored) return { ...stored };
    } catch {
      throw new SessionStoreErrorValue(operation, "storage_failure");
    }
    throw new SessionStoreErrorValue(operation, "unknown_save", `session store: unknown saveId "${saveId}"`);
  }

  /** The one persistence failure the store classifies rather than flattening (§7.2) —
   *  shared by `writeSession`'s inline check and `deleteSave`'s conditional remove. */
  function isPersistenceConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "name" in error && error.name === SESSION_PERSISTENCE_CONFLICT;
  }

  async function writeSession(record: SessionRecord): Promise<void> {
    if (!options.persistence) return;
    try {
      await options.persistence.sessions.put(record as StoredSessionRecord);
    } catch (error) {
      if (
        typeof error === "object"
        && error !== null
        && "name" in error
        && error.name === SESSION_PERSISTENCE_CONFLICT
      ) {
        throw new SessionStoreErrorValue("session", "concurrent_modification");
      }
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
    const decorator = buildDecorator(clock, recordSink, {
      traceId,
      spanId,
      attempt,
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(experiments !== undefined ? { experiments } : {}),
    });
    return await fn(engine.withEmitter(decorator));
  }

  return {
    // ── Queries — no span, no decorator (05 §6.1 names only the five commands below) ──
    async listCampaigns(profileId?: string): Promise<CampaignCatalog> {
      // Session-free (04 §7.3) — no session lock, no engine call. Progress is read here,
      // through the store's own ProfileStore, and nowhere near resolution — `advance`
      // and `project` never see a profile.
      const profile = profileId !== undefined && options.profiles ? (await options.profiles.load(profileId)).profile : undefined;

      const strings: Record<string, string> = {};
      const campaigns: CampaignSummary[] = [...registry.campaigns.values()].map((campaign) => {
        const titleText = registry.strings.get(campaign.titleKey);
        if (titleText !== undefined) strings[campaign.titleKey] = titleText;

        let progress: CampaignProgress | undefined;
        const terminalCount = kinds[campaign.kindId]?.terminalCount;
        if (profile && terminalCount) {
          const discovered = new Set(
            profile.terminals.filter((t) => t.campaignId === campaign.id).map((t) => t.terminalId),
          ).size;
          progress = { discovered, total: terminalCount(campaign) };
        }

        return {
          campaignId: campaign.id,
          kindId: campaign.kindId,
          titleKey: campaign.titleKey,
          ...(progress !== undefined ? { progress } : {}),
        };
      });

      return { campaigns, strings };
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

    /** §7.4. Session-free, like `listCampaigns` — no session to lock or resolve. Reads
     *  `persistence.saves.listByProfile` when there is one, and the store's own map when
     *  there is not; never both, since with persistence the store holds no saves (S127). */
    async listSaves(profileId: string): Promise<readonly SaveSummary[]> {
      const byId = new Map<string, SaveRecord>();
      if (options.persistence) {
        try {
          for (const record of await options.persistence.saves.listByProfile(profileId)) {
            if (record.profileId === profileId) byId.set(record.saveId, record);
          }
        } catch {
          throw new SessionStoreErrorValue("listSaves", "storage_failure");
        }
      } else {
        for (const [saveId, record] of saves) {
          if (record.profileId === profileId) byId.set(saveId, record);
        }
      }

      return [...byId.values()]
        .sort((a, b) => {
          if (a.savedAt !== b.savedAt) return a.savedAt < b.savedAt ? 1 : -1;
          return a.saveId < b.saveId ? -1 : a.saveId > b.saveId ? 1 : 0;
        })
        .map((record) => ({
          saveId: record.saveId,
          campaignId: record.campaignId,
          savedAt: record.savedAt,
          savedAtSeq: record.savedAtSeq,
        }));
    },

    // ── Commands — spanned and stamped (05 §6.1) ──
    async createSession(config: CreateSessionConfig): Promise<SessionHandle> {
      const sessionId = newSessionId(recordIds);
      const audience = config.audience ?? "player";
      const campaign = registry.campaigns.get(config.campaignId);
      const kind = campaign ? kinds[campaign.kindId] : undefined;
      const kindProfileData = await resolveKindProfileData(options.profiles, config.profileId, kind);
      const newGameConfig: NewGameConfig = {
        campaignId: config.campaignId,
        ...(config.seed !== undefined ? { seed: config.seed } : {}),
        audience,
        ...(kindProfileData !== undefined ? { kindProfileData } : {}),
      };

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
          revision: 0,
          replayCompatible: true,
          createdAt: now,
          updatedAt: now,
          ...(config.profileId !== undefined ? { profileId: config.profileId } : {}),
        };
        await writeSession(record);
        cacheSession(sessionId, record);
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },

    async resumeSession(sessionId: string): Promise<Scene> {
      return holdSession(sessionId, async (record) => {
        return runExclusive(sessionLocks, sessionId, () =>
          withCommand(sessionId, record.attemptCounter, async (decoratedEngine) => {
            const state = mustDeserialize(decoratedEngine, record.blob);
            return decoratedEngine.scene(state);
          }),
        );
      });
    },

    async submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult> {
      return holdSession(sessionId, async (record) => {

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
              const newState = result.value;
              const previousBlob = record.blob;
              const previousUpdatedAt = record.updatedAt;
              const previousRevision = record.revision;
              record.blob = decoratedEngine.serialize(newState);
              record.updatedAt = clock.now();
              record.revision = previousRevision + 1;
              try {
                await writeSession(record);
              } catch (error) {
                // A rejected write must not leave the cache ahead of persistence (20-contract.md
                // §7.2's blockquote) — restore what was here before this mutation so the next
                // read serves the pre-conflict state, not the refused one. Every field the
                // refused `put` carried, including the counter incremented above: it is part of
                // `StoredSessionRecord`, so leaving it raised keeps the cache one attempt ahead
                // of a record persistence never took, and `getSession` is cache-first.
                record.blob = previousBlob;
                record.updatedAt = previousUpdatedAt;
                record.revision = previousRevision;
                record.attemptCounter = attempt - 1;
                // On a conflict the restored record is itself stale — another writer committed
                // — so it is evicted too, and the retry the shipped message asks for re-reads
                // persistence. A `storage_failure` keeps it: there the cache was right and only
                // the write failed. The restore above still matters after eviction: a command
                // already queued on this lock holds this object, and must offer the stale
                // revision so the adapter refuses it rather than accepting a successor of the
                // refused write.
                if (error instanceof SessionStoreErrorValue && error.code === "concurrent_modification" && sessions.get(sessionId) === record) {
                  sessions.delete(sessionId);
                }
                throw error;
              }

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
                  profileWarnings = await runExclusive(profileLocks, profileId, async () => {
                    const achievementWarnings = await upsertAchievements(profiles, profileId, state.campaignId, result.changes);
                    const kind = kinds[state.kindId];
                    const campaign = registry.campaigns.get(state.campaignId)!;
                    const kindDataWarnings = await upsertKindProfileData(profiles, profileId, kind, campaign, result.changes);
                    // "After an action whose AdvanceResult.status is ended" (04 §7.1) — the
                    // same write as the achievement and kind-data upserts, on the same lock.
                    if (newState.status !== "ended") return [...achievementWarnings, ...kindDataWarnings];
                    const terminalId = kind.outcome(newState.kindState).terminalId;
                    const terminalWarnings = await upsertTerminals(profiles, profileId, state.campaignId, terminalId);
                    return [...achievementWarnings, ...kindDataWarnings, ...terminalWarnings];
                  });
                } catch {
                  profileWarnings = [{ code: "profile_write_failed", messageKey: "core.reason.profile_write_failed", path: profileId }];
                }
              }

              return toPlayerResult({
                ok: true,
                scene: decoratedEngine.scene(result.value),
                errors: result.errors,
                warnings: [...result.warnings, ...profileWarnings],
                changes: result.changes,
                messages: result.messages,
              });
            }

            return toPlayerResult({ ok: false, errors: result.errors, warnings: result.warnings, changes: result.changes, messages: result.messages });
          });
        });
      });
    },

    async previewAction(sessionId: string, actionId: string, params?: ActionParams): Promise<SessionActionResult> {
      return holdSession(sessionId, async (record) => {

        // Shares the session queue with submissions so the preview cannot evaluate one version
        // while a neighbouring command persists another. It deliberately does not increment
        // attemptCounter, write record.blob, or touch profile persistence.
        return runExclusive(sessionLocks, sessionId, async () => {
          const state = mustDeserialize(engine, record.blob);
          const result = engine.previewAction(state, actionId, params);

          if (result.ok && result.value) {
            return toPlayerResult({
              ok: true,
              scene: engine.scene(result.value),
              errors: result.errors,
              warnings: result.warnings,
              changes: result.changes,
              messages: result.messages,
            });
          }

          return toPlayerResult({ ok: false, errors: result.errors, warnings: result.warnings, changes: result.changes, messages: result.messages });
        });
      });
    },

    async saveGame(sessionId: string): Promise<SaveHandle> {
      return holdSession(sessionId, async (record) => {
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
            const saveId = newSaveId(recordIds);
            const save: SaveRecord = {
              saveId,
              campaignId: state.campaignId,
              blob: serializeSaveEnvelope(envelope),
              savedAt: clock.now(),
              savedAtSeq: state.actionLog.length,
              audience: record.audience,
              ...(record.profileId !== undefined ? { profileId: record.profileId } : {}),
            };
            // Durable first, then published (20-contract.md §7.2): a save whose write throws
            // must never be listed or loadable from this instance's cache, since no other
            // instance, and no restart of this one, would ever find it.
            await writeSave(save);
            if (!options.persistence) saves.set(saveId, save);
            return { saveId, savedAtSeq: state.actionLog.length };
          }),
        );
      });
    },

    async loadGame(saveId: string): Promise<SessionHandle> {
      const save = await getSave(saveId);
      const sessionId = newSessionId(recordIds);

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
          revision: 0,
          replayCompatible: resolution.replayCompatible,
          createdAt: now,
          updatedAt: now,
          ...(save.profileId !== undefined ? { profileId: save.profileId } : {}),
        };
        await writeSession(record);
        cacheSession(sessionId, record);
        return { sessionId, scene: decoratedEngine.scene(state) };
      });
    },

    /**
     * §7.4. A wrong-profile delete is indistinguishable from a missing save (D3) — both
     * raise `unknown_save` before the compare-and-delete is ever reached, so this never
     * confirms a `saveId`'s existence to a caller holding no claim on it. Locked per
     * `saveId` (D2): the local equality check covers the single-instance case, and a
     * conflict branded by a multi-instance adapter's own conditional delete covers the
     * rest — both routes leave every record untouched on failure (D1).
     */
    async deleteSave(profileId: string, saveId: string, expectedSavedAt: string): Promise<void> {
      return runExclusive(saveLocks, saveId, async () => {
        const record = await getSave(saveId, "deleteSave");
        if (record.profileId !== profileId) {
          throw new SessionStoreErrorValue("deleteSave", "unknown_save", `session store: unknown saveId "${saveId}"`);
        }
        if (record.savedAt !== expectedSavedAt) {
          throw new SessionStoreErrorValue("deleteSave", "concurrent_modification");
        }
        try {
          await options.persistence?.saves.delete(saveId, expectedSavedAt);
        } catch (error) {
          throw new SessionStoreErrorValue("deleteSave", isPersistenceConflict(error) ? "concurrent_modification" : "storage_failure");
        }
        saves.delete(saveId);
      });
    },

    /**
     * §7.4. A lifecycle operation, not a resolution — it never reaches a `Kind` and never
     * appears in `{ seed, actionLog }` (A1). The branch is replayed, not copied: a fresh
     * game is created from the source's `{ campaignId, seed }` and its `gameId` is then
     * pinned to the source's own, because `gameId` is opaque, serialized data the engine
     * never parses, compares, or derives from (§2) — overwriting it after creation is
     * exactly what a pinned `IdSource.newGameId` would have produced (§7.4, "Reproducing a
     * stored session from its log"). The new `sessionId` comes from `RecordIdSource`, not
     * `IdSource` — the port whose values never enter `GameState` (§7.4).
     */
    async branchSession(sessionId: string, atActionCount: number): Promise<SessionHandle> {
      const source = await getSession(sessionId);
      if (!source.replayCompatible) {
        throw new SessionStoreErrorValue("branchSession", "invalid_state");
      }
      const sourceState = mustDeserialize(engine, source.blob);
      if (!Number.isInteger(atActionCount) || atActionCount < 0 || atActionCount > sourceState.actionLog.length) {
        throw new SessionStoreErrorValue("branchSession", "invalid_fork_point");
      }
      const campaign = registry.campaigns.get(sourceState.campaignId);
      if (!campaign || campaign.version !== sourceState.campaignVersion) {
        throw new SessionStoreErrorValue("branchSession", "unknown_campaign");
      }

      const branchSessionId = newSessionId(recordIds);
      const retained = sourceState.actionLog.slice(0, atActionCount);

      return withCommand(branchSessionId, 0, async (decoratedEngine) => {
        const created = decoratedEngine.createGame({ campaignId: sourceState.campaignId, seed: sourceState.seed });
        if (!created.ok || !created.value) {
          // Defensive, same class as mustDeserialize's own throw above: the campaign was
          // just resolved from the registry by the same id/version above.
          throw new Error("session store: branchSession — createGame rejected for an already-validated campaign");
        }
        let state: GameState = { ...created.value, gameId: sourceState.gameId };
        for (const logged of retained) {
          const result = decoratedEngine.submitAction(state, logged.actionId, logged.params);
          if (!result.ok || !result.value) {
            // Defensive: every entry in actionLog was accepted once already (04 §4 only
            // logs an action that advanced the state), so replaying it deterministically
            // against the same seed and prefix cannot be rejected.
            throw new Error(`session store: branchSession — replaying logged action "${logged.actionId}" was rejected`);
          }
          state = result.value;
        }

        const now = clock.now();
        const record: SessionRecord = {
          sessionId: branchSessionId,
          blob: decoratedEngine.serialize(state),
          audience: source.audience,
          attemptCounter: 0,
          revision: 0,
          replayCompatible: true,
          createdAt: now,
          updatedAt: now,
          ...(source.profileId !== undefined ? { profileId: source.profileId } : {}),
        };
        await writeSession(record);
        cacheSession(branchSessionId, record);
        return { sessionId: branchSessionId, scene: decoratedEngine.scene(state) };
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
