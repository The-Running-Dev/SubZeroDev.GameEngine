import { describe, it, expect } from "vitest";
import { createEngine } from "../kernel/engine.js";
import { createCountingIds } from "../determinism/counting-ids.js";
import { createInMemorySessionStore, createSessionLayer, runExclusive } from "./store.js";
import { createContentArchive, type ContentChannel, type ContentScope } from "../registry/archive.js";
import type {
  AdvanceResult,
  AvailableAction,
  Engine,
  InitialStateResult,
  Kind,
  KindRegistry,
  SceneBody,
} from "../kernel/types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ValidationResult } from "../validation/types.js";
import type { EngineHost, RecordIdSource } from "../composition/types.js";
import { jsonlEmitter } from "../observability/emitter.js";
import type { EmittedRecord, EmittedRecordSink } from "../observability/types.js";
import { createInMemoryProfileStore } from "./profile-store.js";
import { buildSaveEnvelope, serializeSaveEnvelope } from "../persistence/envelope.js";
import {
  SESSION_PERSISTENCE_CONFLICT,
  type CampaignCatalog,
  type ProfileStore,
  type SessionPersistence,
  type SessionStore,
  type SessionStoreErrorCode,
  type StoredSaveRecord,
  type StoredSessionRecord,
} from "./types.js";
import { BASE_REASON_CODES, CORE_REASON_MESSAGES } from "../kernel/reasons.js";
import type { StateChange } from "../kernel/reasons.js";
import type { PlayerProfile } from "./types.js";

interface TestKindState {
  counter: number;
}

function makeTestKind(): Kind<TestKindState> {
  return {
    id: "story-graph",
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(),
    eventNames: [],
    initialState: (): InitialStateResult<TestKindState> => ({
      state: { counter: 0 },
      status: "active",
      changes: [],
      messages: [],
    }),
    availableActions: (): AvailableAction[] => [{ id: "increment", labelKey: "test.increment", available: true }],
    scene: (state): SceneBody => ({ textKey: "test.scene", text: `counter=${state.counter}` }),
    advance: (state, actionId): AdvanceResult<TestKindState> => {
      if (actionId === "increment") {
        return { state: { counter: state.counter + 1 }, status: "active", changes: [], messages: [] };
      }
      if (actionId === "end") {
        return { state, status: "ended", changes: [], messages: [] };
      }
      if (actionId === "unlock-first-count" || actionId === "unlock-second-thing") {
        const achievementId = actionId === "unlock-first-count" ? "first-count" : "second-thing";
        return {
          state,
          status: "active",
          changes: [
            {
              path: `achieved.${achievementId}`,
              op: "set",
              value: true,
              reason: "achievement_unlocked",
              visible: true,
            },
          ],
          messages: [],
        };
      }
      return {
        state,
        status: "active",
        changes: [],
        messages: [],
        error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
      };
    },
    project: (state, audience) => ({ counter: state.counter, audience }),
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    validateState: () => true,
    // `counter=0` reports no terminal — lets a test drive "end" both with and without a
    // terminalId, to exercise the terminal-mirror's null-records-nothing rule (04 §7.1).
    outcome: (state) => ({
      terminal: state.counter > 0,
      terminalId: state.counter > 0 ? `counter-${state.counter}` : null,
    }),
    terminalCount: () => 3,
  };
}

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {}, ...overrides };
}

function makeRegistry(campaigns: Campaign[] = [makeCampaign()]): ContentRegistry {
  return {
    campaigns: new Map(campaigns.map((c) => [c.id, c])),
    strings: new Map([
      ["test.title", "Test Campaign"],
      ["test.scene", "A scene."],
    ]),
  };
}

function makeKinds(): KindRegistry {
  return { "story-graph": makeTestKind() } as unknown as KindRegistry;
}

function makeEngine(overrides?: Partial<EngineHost>): Engine {
  return createEngine({ kinds: makeKinds(), registry: makeRegistry(), ...overrides });
}

function makeStore(overrides?: {
  engine?: Engine;
  recordSink?: EmittedRecordSink;
  experiments?: Readonly<Record<string, string>>;
  profiles?: ProfileStore;
  recordIds?: RecordIdSource;
  persistence?: SessionPersistence;
  clock?: { now(): string };
  sessionCacheLimit?: number;
}) {
  const registry = makeRegistry();
  return createInMemorySessionStore({
    engine: overrides?.engine ?? makeEngine({ registry }),
    registry,
    ...(overrides?.recordSink ? { recordSink: overrides.recordSink } : {}),
    ...(overrides?.experiments !== undefined ? { experiments: overrides.experiments } : {}),
    ...(overrides?.profiles ? { profiles: overrides.profiles } : {}),
    ...(overrides?.recordIds ? { recordIds: overrides.recordIds } : {}),
    ...(overrides?.persistence ? { persistence: overrides.persistence } : {}),
    ...(overrides?.clock ? { clock: overrides.clock } : {}),
    ...(overrides?.sessionCacheLimit !== undefined ? { sessionCacheLimit: overrides.sessionCacheLimit } : {}),
  });
}

/** A counting `RecordIdSource` — independent counters, each from zero, no argument,
 *  matching the engine's exported `createCountingIds()` convention (20-contract.md
 *  "The replay profile has no counting-`IdSource` start value"). */
function makeCountingRecordIds(): RecordIdSource {
  let sessions = 0;
  let saves = 0;
  return {
    newSessionId: () => `session-${sessions++}`,
    newSaveId: () => `save-${saves++}`,
  };
}

function persistenceWith(overrides?: {
  sessions?: Partial<SessionPersistence["sessions"]>;
  saves?: Partial<SessionPersistence["saves"]>;
}): SessionPersistence {
  return {
    sessions: {
      get: async () => undefined,
      put: async () => {},
      ...overrides?.sessions,
    },
    saves: {
      get: async () => undefined,
      put: async () => {},
      listByProfile: async () => [],
      delete: async () => {},
      ...overrides?.saves,
    },
  };
}

describe("persistence error translation (G2 S1)", () => {
  const sessionStoreCodes: Record<SessionStoreErrorCode, true> = {
    unknown_session: true,
    unknown_save: true,
    storage_failure: true,
    unknown_campaign: true,
    invalid_state: true,
    unknown_kind: true,
    save_requires_migration: true,
    migration_failed: true,
    concurrent_modification: true,
    invalid_fork_point: true,
  };

  it("S1.1 — maps the branded session-write conflict to concurrent_modification", async () => {
    const store = makeStore({
      persistence: persistenceWith({
        sessions: {
          get: async () => undefined,
          put: async () => {
            throw { name: SESSION_PERSISTENCE_CONFLICT };
          },
        },
      }),
    });

    await expect(store.createSession({ campaignId: "test-campaign" })).rejects.toMatchObject({
      name: "SessionStoreError",
      operation: "session",
      code: "concurrent_modification",
    });
    expect(Object.keys(sessionStoreCodes)).toHaveLength(10);
  });

  it("S1.2 — leaves ordinary and differently named session-write failures as storage_failure", async () => {
    for (const failure of [new Error("store unavailable"), { name: "SomeOtherStoreFailure" }]) {
      const store = makeStore({
        persistence: persistenceWith({
          sessions: {
            get: async () => undefined,
            put: async () => {
              throw failure;
            },
          },
        }),
      });

      await expect(store.createSession({ campaignId: "test-campaign" })).rejects.toMatchObject({
        code: "storage_failure",
      });
    }
  });

  it("S1.3 — registers concurrent_modification with a shipped core reason message", () => {
    expect(BASE_REASON_CODES).toContain("concurrent_modification");
    expect(CORE_REASON_MESSAGES.get("core.reason.concurrent_modification")).toBeTruthy();
  });

  it("S1.4 — only writeSession recognises the conflict brand", async () => {
    const conflict = { name: SESSION_PERSISTENCE_CONFLICT };
    const readSessionStore = makeStore({
      persistence: persistenceWith({ sessions: { get: async () => { throw conflict; }, put: async () => {} } }),
    });
    await expect(readSessionStore.getScene("missing")).rejects.toMatchObject({ code: "storage_failure" });

    const readSaveStore = makeStore({
      persistence: persistenceWith({ saves: { get: async () => { throw conflict; }, put: async () => {}, delete: async () => {} } }),
    });
    await expect(readSaveStore.loadGame("missing")).rejects.toMatchObject({ code: "storage_failure" });

    const writeSaveStore = makeStore({
      persistence: persistenceWith({ saves: { get: async () => undefined, put: async () => { throw conflict; }, delete: async () => {} } }),
    });
    const { sessionId } = await writeSaveStore.createSession({ campaignId: "test-campaign" });
    await expect(writeSaveStore.saveGame(sessionId)).rejects.toMatchObject({ code: "storage_failure" });
  });

  it("W75.4 — a conflict on submitAction leaves the cache no further ahead than persistence", async () => {
    const cas = makeCasPersistence();
    const store = makeStore({ persistence: cas.persistence });

    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    cas.failNextPut({ name: SESSION_PERSISTENCE_CONFLICT });
    await expect(store.submitAction(sessionId, "increment")).rejects.toMatchObject({
      code: "concurrent_modification",
    });

    // S122: the conflicted record is evicted, so this read goes back to persistence.
    const reads = cas.reads;
    const scene = await store.getScene(sessionId);
    expect(scene.body.text).toBe("counter=0");
    expect(cas.reads).toBe(reads + 1);

    const result = await store.submitAction(sessionId, "increment");
    expect(result.ok).toBe(true);
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1, attemptCounter: 1 });
  });
});

/**
 * An in-memory adapter that holds §7.2's compare-and-swap rule: a `put` for an existing
 * `sessionId` lands only when the stored `revision` is the incoming one minus one. Records
 * are copied in both directions, as a real database would, so the store's in-place mutation
 * of its cache can never reach a stored row — unless `returnStoredRows` hands back the row
 * object itself, as a naive in-memory adapter would.
 */
function makeCasPersistence(options?: { returnStoredRows?: boolean }): {
  persistence: SessionPersistence;
  rows: Map<string, StoredSessionRecord>;
  readonly reads: number;
  failNextPut(error: unknown): void;
} {
  const rows = new Map<string, StoredSessionRecord>();
  let reads = 0;
  let pendingFailure: { error: unknown } | undefined;
  return {
    rows,
    get reads() { return reads; },
    failNextPut(error) { pendingFailure = { error }; },
    persistence: persistenceWith({
      sessions: {
        get: async (sessionId) => {
          reads += 1;
          const row = rows.get(sessionId);
          if (options?.returnStoredRows) return row;
          return row ? { ...row } : undefined;
        },
        put: async (record) => {
          if (pendingFailure) {
            const { error } = pendingFailure;
            pendingFailure = undefined;
            throw error;
          }
          const stored = rows.get(record.sessionId);
          if (stored && stored.revision !== record.revision - 1) throw { name: SESSION_PERSISTENCE_CONFLICT };
          rows.set(record.sessionId, { ...record });
        },
      },
    }),
  };
}

describe("S122 — a committed revision, separate from the attempt counter", () => {
  it("S122.1 — a rejected action leaves the revision alone, so the next valid one commits", async () => {
    const cas = makeCasPersistence();
    const store = makeStore({ persistence: cas.persistence });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 0, attemptCounter: 0 });

    const rejected = await store.submitAction(sessionId, "not-an-action");
    expect(rejected.ok).toBe(false);

    const accepted = await store.submitAction(sessionId, "increment");
    expect(accepted.ok).toBe(true);
    expect(accepted.scene?.body.text).toBe("counter=1");
    // The attempt counter saw both submissions; the revision saw only the write.
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1, attemptCounter: 2 });
  });

  it("S122.2 — a preview leaves the revision alone, so the next valid action commits", async () => {
    const cas = makeCasPersistence();
    const store = makeStore({ persistence: cas.persistence });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    const preview = await store.previewAction(sessionId, "increment");
    expect(preview.ok).toBe(true);

    const accepted = await store.submitAction(sessionId, "increment");
    expect(accepted.ok).toBe(true);
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1, attemptCounter: 1 });
  });

  it("S122.3 — two store instances over one adapter: the loser gets concurrent_modification, and its retry sees the winner", async () => {
    const cas = makeCasPersistence();
    const first = makeStore({ persistence: cas.persistence });
    const second = makeStore({ persistence: cas.persistence });

    const { sessionId } = await first.createSession({ campaignId: "test-campaign" });
    // Both instances now hold revision 0 in their caches.
    expect((await second.getScene(sessionId)).body.text).toBe("counter=0");

    expect((await first.submitAction(sessionId, "increment")).ok).toBe(true);
    await expect(second.submitAction(sessionId, "increment")).rejects.toMatchObject({
      name: "SessionStoreError",
      code: "concurrent_modification",
    });

    // The retry re-reads persistence rather than replaying the stale cache, so it builds on
    // the winner's write instead of colliding with it again.
    const retried = await second.submitAction(sessionId, "increment");
    expect(retried.ok).toBe(true);
    expect(retried.scene?.body.text).toBe("counter=2");
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 2 });
  });

  it("S122.4 — storage_failure restores the cached record and keeps it, without re-reading persistence", async () => {
    const cas = makeCasPersistence();
    const store = makeStore({ persistence: cas.persistence });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    cas.failNextPut(new Error("disk full"));
    await expect(store.submitAction(sessionId, "increment")).rejects.toMatchObject({ code: "storage_failure" });

    const reads = cas.reads;
    expect((await store.getScene(sessionId)).body.text).toBe("counter=0");
    expect(cas.reads).toBe(reads);

    // Every field the refused `put` carried was rolled back, the counter included: had it
    // stayed raised, this write would carry attemptCounter 2 and the revision would skip.
    expect((await store.submitAction(sessionId, "increment")).ok).toBe(true);
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1, attemptCounter: 1 });
  });

  it("S122.5 — a command already queued behind a conflicted write is refused too, never committed on top of it", async () => {
    const cas = makeCasPersistence();
    const first = makeStore({ persistence: cas.persistence });
    const second = makeStore({ persistence: cas.persistence });

    const { sessionId } = await first.createSession({ campaignId: "test-campaign" });
    expect((await second.getScene(sessionId)).body.text).toBe("counter=0");
    expect((await first.submitAction(sessionId, "increment")).ok).toBe(true);

    // Both calls resolve the cached record before either takes the session lock.
    const racing = second.submitAction(sessionId, "increment");
    const queued = second.submitAction(sessionId, "increment");
    await expect(racing).rejects.toMatchObject({ code: "concurrent_modification" });
    await expect(queued).rejects.toMatchObject({ code: "concurrent_modification" });

    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1 });
    expect((await second.getScene(sessionId)).body.text).toBe("counter=1");
  });

  it("S122.6 — a record read back from persistence is the store's own copy, so an adapter returning its row still compares correctly", async () => {
    const cas = makeCasPersistence({ returnStoredRows: true });
    const first = makeStore({ persistence: cas.persistence });
    const { sessionId } = await first.createSession({ campaignId: "test-campaign" });

    // A second instance has to read the row from persistence, which hands back the row itself.
    const second = makeStore({ persistence: cas.persistence });
    const accepted = await second.submitAction(sessionId, "increment");
    expect(accepted.ok).toBe(true);
    expect(cas.rows.get(sessionId)).toMatchObject({ revision: 1 });
  });
});

describe("S123 — a save exists only once it is durable", () => {
  /** Map-backed sessions and saves, with a one-shot failure on the next save write. */
  function makeDurablePersistence(): { persistence: SessionPersistence; savedRows: Map<string, StoredSaveRecord>; failNextSavePut(): void } {
    const sessionRows = new Map<string, StoredSessionRecord>();
    const savedRows = new Map<string, StoredSaveRecord>();
    let failSave = false;
    return {
      savedRows,
      failNextSavePut() { failSave = true; },
      persistence: {
        sessions: {
          get: async (sessionId) => { const row = sessionRows.get(sessionId); return row ? { ...row } : undefined; },
          put: async (record) => { sessionRows.set(record.sessionId, { ...record }); },
        },
        saves: {
          get: async (saveId) => { const row = savedRows.get(saveId); return row ? { ...row } : undefined; },
          put: async (record) => {
            if (failSave) { failSave = false; throw new Error("disk full"); }
            savedRows.set(record.saveId, { ...record });
          },
          listByProfile: async (profileId) => [...savedRows.values()].filter((row) => row.profileId === profileId).map((row) => ({ ...row })),
          delete: async (saveId) => { savedRows.delete(saveId); },
        },
      },
    };
  }

  it("S123.1–S123.3 — a save whose write fails is not listed, not loadable, and a fresh instance agrees", async () => {
    const durable = makeDurablePersistence();
    const store = makeStore({ persistence: durable.persistence, recordIds: makeCountingRecordIds() });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });

    durable.failNextSavePut();
    await expect(store.saveGame(sessionId)).rejects.toMatchObject({ code: "storage_failure" });
    // The counting RecordIdSource minted "save-0" for the refused write.
    expect(durable.savedRows.size).toBe(0);

    expect(await store.listSaves("p1")).toEqual([]);
    await expect(store.loadGame("save-0")).rejects.toMatchObject({ code: "unknown_save" });

    const fresh = makeStore({ persistence: durable.persistence });
    expect(await fresh.listSaves("p1")).toEqual([]);
    await expect(fresh.loadGame("save-0")).rejects.toMatchObject({ code: "unknown_save" });
  });

  it("S123.4 — the session survives the failed save, and the next save is durable and listed", async () => {
    const durable = makeDurablePersistence();
    const store = makeStore({ persistence: durable.persistence, recordIds: makeCountingRecordIds() });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });

    durable.failNextSavePut();
    await expect(store.saveGame(sessionId)).rejects.toMatchObject({ code: "storage_failure" });

    const saved = await store.saveGame(sessionId);
    expect([...durable.savedRows.keys()]).toEqual([saved.saveId]);
    expect((await store.listSaves("p1")).map((s) => s.saveId)).toEqual([saved.saveId]);
    const fresh = makeStore({ persistence: durable.persistence });
    expect((await fresh.loadGame(saved.saveId)).scene.body.text).toBe("counter=0");
  });
});

describe("S127 — the store's lock and cache maps are bounded", () => {
  /** A promise and the function that settles it. */
  function deferred(): { promise: Promise<void>; resolve(): void } {
    let resolve = () => {};
    const promise = new Promise<void>((r) => { resolve = r; });
    return { promise, resolve };
  }

  /** Lets every already-settled promise chain run to the end. */
  async function drain(): Promise<void> {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  }

  it("S127.1 — the lock map is empty after N sequential runs, rejected ones included", async () => {
    const locks = new Map<string, Promise<unknown>>();
    for (let i = 0; i < 25; i += 1) {
      const run = runExclusive(locks, "s", async () => {
        if (i % 5 === 0) throw new Error("refused");
        return i;
      });
      await run.catch(() => undefined);
    }
    await drain();
    expect(locks.size).toBe(0);
  });

  it("S127.2 — the lock map is empty after N concurrent runs, and they ran in call order", async () => {
    const locks = new Map<string, Promise<unknown>>();
    const order: number[] = [];
    await Promise.all(Array.from({ length: 25 }, (_, i) => runExclusive(locks, `s${i % 3}`, async () => { order.push(i); })));
    await drain();
    expect(locks.size).toBe(0);
    expect(order.filter((i) => i % 3 === 0)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
  });

  it("S127.3 — an operation queued behind a settling one keeps its place in the queue", async () => {
    const locks = new Map<string, Promise<unknown>>();
    const order: string[] = [];
    const first = deferred();
    const second = deferred();
    const a = runExclusive(locks, "s", async () => { await first.promise; order.push("a"); });
    const b = runExclusive(locks, "s", async () => { await second.promise; order.push("b"); });

    first.resolve();
    await a;
    await drain();
    // a's cleanup has run; b's entry, still the tail, must not have gone with it.
    expect(locks.has("s")).toBe(true);
    const c = runExclusive(locks, "s", async () => { order.push("c"); });

    second.resolve();
    await Promise.all([b, c]);
    await drain();
    expect(order).toEqual(["a", "b", "c"]);
    expect(locks.size).toBe(0);
  });

  /** Two sessions, five actions interleaved across them, then each one's stored rows. */
  async function play(sessionCacheLimit?: number) {
    const cas = makeCasPersistence();
    const store = makeStore({
      persistence: cas.persistence,
      engine: makeEngine({ ids: createCountingIds() }),
      recordIds: makeCountingRecordIds(),
      ...(sessionCacheLimit !== undefined ? { sessionCacheLimit } : {}),
    });
    const a = await store.createSession({ campaignId: "test-campaign", seed: "s127-a" });
    const b = await store.createSession({ campaignId: "test-campaign", seed: "s127-b" });
    await store.submitAction(a.sessionId, "increment");
    await store.submitAction(b.sessionId, "increment");
    await store.submitAction(a.sessionId, "increment");
    const scenes = [(await store.getScene(a.sessionId)).body.text, (await store.getScene(b.sessionId)).body.text];
    const rows = [...cas.rows.values()].map(({ sessionId, blob, revision, attemptCounter }) => ({ sessionId, blob, revision, attemptCounter }));
    return { scenes, rows, reads: cas.reads };
  }

  it("S127.4 — an evicted session reloads from persistence and continues identically", async () => {
    const unbounded = await play();
    const bounded = await play(1);
    expect(unbounded.reads).toBe(0);
    expect(bounded.reads).toBeGreaterThan(0);
    expect(bounded.scenes).toEqual(["counter=2", "counter=1"]);
    expect(bounded.scenes).toEqual(unbounded.scenes);
    expect(bounded.rows).toEqual(unbounded.rows);
  });

  it("S127.5 — a session a command holds is not evicted under it, so concurrent commands never conflict", async () => {
    const cas = makeCasPersistence();
    const store = makeStore({ persistence: cas.persistence, recordIds: makeCountingRecordIds(), sessionCacheLimit: 1 });
    const a = await store.createSession({ campaignId: "test-campaign" });
    const b = await store.createSession({ campaignId: "test-campaign" });

    const results = await Promise.all([
      store.submitAction(a.sessionId, "increment"),
      store.submitAction(b.sessionId, "increment"),
      store.submitAction(a.sessionId, "increment"),
      store.submitAction(b.sessionId, "increment"),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect((await store.getScene(a.sessionId)).body.text).toBe("counter=2");
    expect((await store.getScene(b.sessionId)).body.text).toBe("counter=2");
    expect([...cas.rows.values()].map((row) => row.revision)).toEqual([2, 2]);
  });

  it("S127.6 — a session a command is still writing is not evicted, so the next command builds on that write", async () => {
    const rows = new Map<string, StoredSessionRecord>();
    let gate: { entered: () => void; release: Promise<void> } | undefined;
    const persistence = persistenceWith({
      sessions: {
        get: async (sessionId) => { const row = rows.get(sessionId); return row ? { ...row } : undefined; },
        put: async (record) => {
          if (gate) { const held = gate; gate = undefined; held.entered(); await held.release; }
          const stored = rows.get(record.sessionId);
          if (stored && stored.revision !== record.revision - 1) throw { name: SESSION_PERSISTENCE_CONFLICT };
          rows.set(record.sessionId, { ...record });
        },
      },
    });
    const store = makeStore({ persistence, sessionCacheLimit: 1 });
    const a = await store.createSession({ campaignId: "test-campaign" });
    const b = await store.createSession({ campaignId: "test-campaign" });

    const entered = deferred();
    const release = deferred();
    gate = { entered: entered.resolve, release: release.promise };
    const first = store.submitAction(a.sessionId, "increment");
    await entered.promise; // the first command is inside its write
    await store.getScene(b.sessionId); // b becomes the most recently used — a is the eviction candidate
    const second = store.submitAction(a.sessionId, "increment");
    release.resolve();

    expect((await Promise.all([first, second])).every((result) => result.ok)).toBe(true);
    expect((await store.getScene(a.sessionId)).body.text).toBe("counter=2");
  });

  it("S127.7 — with persistence, a save is read from it every time, never from the store's memory", async () => {
    const rows = new Map<string, StoredSaveRecord>();
    const store = makeStore({
      persistence: persistenceWith({
        saves: {
          get: async (saveId) => rows.get(saveId),
          put: async (record) => { rows.set(record.saveId, { ...record }); },
          listByProfile: async (profileId) => [...rows.values()].filter((row) => row.profileId === profileId),
          delete: async (saveId) => { rows.delete(saveId); },
        },
      }),
    });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const saved = await store.saveGame(sessionId);
    expect((await store.listSaves("p1")).map((s) => s.saveId)).toEqual([saved.saveId]);

    rows.delete(saved.saveId); // removed behind the store's back, as another instance would
    expect(await store.listSaves("p1")).toEqual([]);
    await expect(store.loadGame(saved.saveId)).rejects.toMatchObject({ code: "unknown_save" });
  });

  it("S127.8 — sessionCacheLimit is a positive integer, and refused without persistence", () => {
    const persistence = persistenceWith();
    expect(() => makeStore({ persistence, sessionCacheLimit: 0 })).toThrow(RangeError);
    expect(() => makeStore({ persistence, sessionCacheLimit: 1.5 })).toThrow(RangeError);
    expect(() => makeStore({ sessionCacheLimit: 10 })).toThrow(RangeError);
    expect(() => makeStore({ persistence, sessionCacheLimit: 10 })).not.toThrow();
  });
});

describe("createSession / getScene / getView / getStrings / listCampaigns", () => {
  it("creates a session and returns its opening scene", async () => {
    const store = makeStore();
    const handle = await store.createSession({ campaignId: "test-campaign" });
    expect(typeof handle.sessionId).toBe("string");
    expect(handle.scene.body.text).toBe("counter=0");
  });

  it("getScene reflects the session's current state", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    await store.submitAction(sessionId, "increment");
    const scene = await store.getScene(sessionId);
    expect(scene.body.text).toBe("counter=1");
  });

  it("getView passes the session's audience through to the kind", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", audience: "ai" });
    const view = await store.getView(sessionId);
    expect(view.kindView).toEqual({ counter: 0, audience: "ai" });
  });

  it("getStrings resolves the registry's string table", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    const strings = await store.getStrings(sessionId);
    expect(strings["test.title"]).toBe("Test Campaign");
  });

  it("listCampaigns summarizes the registry, with no profile no progress is present", async () => {
    const store = makeStore();
    const catalog = await store.listCampaigns();
    expect(catalog.campaigns).toEqual([{ campaignId: "test-campaign", kindId: "story-graph", titleKey: "test.title" }]);
  });

  it("rejects a query against an unknown sessionId", async () => {
    const store = makeStore();
    await expect(store.getScene("does-not-exist")).rejects.toThrow();
  });
});

describe("session isolation", () => {
  it("two sessions never cross-mutate each other's state", async () => {
    const store = makeStore();
    const a = await store.createSession({ campaignId: "test-campaign" });
    const b = await store.createSession({ campaignId: "test-campaign" });

    await store.submitAction(a.sessionId, "increment");
    await store.submitAction(a.sessionId, "increment");
    await store.submitAction(b.sessionId, "increment");

    const sceneA = await store.getScene(a.sessionId);
    const sceneB = await store.getScene(b.sessionId);
    expect(sceneA.body.text).toBe("counter=2");
    expect(sceneB.body.text).toBe("counter=1");
  });
});

describe("listCampaigns catalog (W98)", () => {
  it("resolves the campaign's titleKey and includes nothing else in strings", async () => {
    const store = makeStore();
    const catalog = await store.listCampaigns();
    expect(catalog.strings).toEqual({ "test.title": "Test Campaign" });
  });

  it("with no profileId, no summary carries a progress field", async () => {
    const store = makeStore({ profiles: createInMemoryProfileStore() });
    const catalog = await store.listCampaigns();
    expect(catalog.campaigns[0]!.progress).toBeUndefined();
  });

  it("with a profileId and a kind that declares terminalCount, progress is discovered/total", async () => {
    const profiles = createInMemoryProfileStore({
      raw: new Map([
        [
          "p1",
          {
            formatVersion: 2,
            profileId: "p1",
            achievements: [],
            terminals: [{ campaignId: "test-campaign", terminalId: "counter-1" }],
          },
        ],
      ]),
    });
    const store = makeStore({ profiles });
    const catalog = await store.listCampaigns("p1");
    expect(catalog.campaigns[0]!.progress).toEqual({ discovered: 1, total: 3 });
  });

  it("degrades to discovered: 0 for a missing profile rather than failing the catalog", async () => {
    const store = makeStore({ profiles: createInMemoryProfileStore() });
    const catalog = await store.listCampaigns("never-seen-before");
    expect(catalog.campaigns[0]!.progress).toEqual({ discovered: 0, total: 3 });
  });

  it("distinct terminalIds count once each; a repeated terminalId across sessions does not double-count", async () => {
    const profiles = createInMemoryProfileStore({
      raw: new Map([
        [
          "p1",
          {
            formatVersion: 2,
            profileId: "p1",
            achievements: [],
            terminals: [
              { campaignId: "test-campaign", terminalId: "counter-1" },
              { campaignId: "test-campaign", terminalId: "counter-1" },
              { campaignId: "test-campaign", terminalId: "counter-2" },
            ],
          },
        ],
      ]),
    });
    const store = makeStore({ profiles });
    const catalog = await store.listCampaigns("p1");
    expect(catalog.campaigns[0]!.progress).toEqual({ discovered: 2, total: 3 });
  });

  // W98.1 — the async signature exists precisely so a store need not already be a
  // registry before it is a store (04 §7.3). This double proves the shape is genuinely
  // implementable that way: no campaign summary is held in memory ahead of a call, and
  // `listCampaigns` only "fetches" (an awaited microtask standing in for network I/O)
  // when actually invoked.
  it("the signature is satisfiable by a store that fetches on every call and preloads no registry", async () => {
    let fetchCalls = 0;
    async function fakeFetchCatalog(): Promise<CampaignCatalog> {
      fetchCalls += 1;
      await Promise.resolve(); // stands in for a real network round trip
      return {
        campaigns: [{ campaignId: "remote-campaign", kindId: "story-graph", titleKey: "remote.title" }],
        strings: { "remote.title": "Fetched From Elsewhere" },
      };
    }

    // Only `listCampaigns` is exercised — everything else on the interface throws,
    // which is itself part of the proof: nothing about this test double preloaded
    // campaign data anywhere else a real fetch-backed implementation would need to.
    const notImplemented = (): never => {
      throw new Error("not exercised by this test");
    };
    const fetchBackedStore: SessionStore = {
      listCampaigns: fakeFetchCatalog,
      getScene: notImplemented,
      getView: notImplemented,
      getStrings: notImplemented,
      previewAction: notImplemented,
      createSession: notImplemented,
      resumeSession: notImplemented,
      submitAction: notImplemented,
      saveGame: notImplemented,
      loadGame: notImplemented,
      listSaves: notImplemented,
      deleteSave: notImplemented,
      branchSession: notImplemented,
    };

    expect(fetchCalls).toBe(0); // nothing fetched at construction
    const catalog = await fetchBackedStore.listCampaigns();
    expect(fetchCalls).toBe(1);
    expect(catalog.campaigns).toEqual([{ campaignId: "remote-campaign", kindId: "story-graph", titleKey: "remote.title" }]);
    expect(catalog.strings).toEqual({ "remote.title": "Fetched From Elsewhere" });
  });
});

describe("terminal mirror (W98)", () => {
  it("an ending with a non-null terminalId upserts a TerminalRecord after the action that ends the game", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "increment"); // counter=1
    const result = await store.submitAction(sessionId, "end");

    expect(result.ok).toBe(true);
    expect(result.scene?.status).toBe("ended");
    const { profile } = await profiles.load("p1");
    expect(profile.terminals).toEqual([{ campaignId: "test-campaign", terminalId: "counter-1" }]);
  });

  it("a null terminalId records nothing, even though the game ended", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" }); // counter=0
    const result = await store.submitAction(sessionId, "end");

    expect(result.ok).toBe(true);
    expect(result.scene?.status).toBe("ended");
    const { profile } = await profiles.load("p1");
    expect(profile.terminals).toEqual([]);
  });

  it("the same terminal reached twice upserts idempotently — one record, not two", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });

    const a = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(a.sessionId, "increment");
    await store.submitAction(a.sessionId, "end");

    const b = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(b.sessionId, "increment"); // same counter value, same terminalId
    await store.submitAction(b.sessionId, "end");

    const { profile } = await profiles.load("p1");
    expect(profile.terminals).toEqual([{ campaignId: "test-campaign", terminalId: "counter-1" }]);
  });

  it("no profileId means the ProfileStore is never touched, even on an ending with a terminalId", async () => {
    let loadCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 3, profileId, achievements: [], terminals: [], kindData: [] }, warnings: [] };
      },
      save: async () => ({ ok: true, warnings: [] }),
    };
    const store = makeStore({ profiles: spyProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" }); // no profileId
    await store.submitAction(sessionId, "increment");
    const result = await store.submitAction(sessionId, "end");

    expect(result.ok).toBe(true);
    expect(loadCalls).toBe(0);
  });

  it("a non-ending action never touches the terminal mirror, even when a profile is attached", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "increment");

    const { profile } = await profiles.load("p1");
    expect(profile.terminals).toEqual([]);
  });
});

describe("RecordIdSource (S1)", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("S1.1 — with no RecordIdSource, two createSession calls and two saveGame calls each return two different, UUID-shaped ids", async () => {
    const store = makeStore();
    const a = await store.createSession({ campaignId: "test-campaign" });
    const b = await store.createSession({ campaignId: "test-campaign" });
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.sessionId).toMatch(UUID_RE);
    expect(b.sessionId).toMatch(UUID_RE);

    const saveA = await store.saveGame(a.sessionId);
    const saveB = await store.saveGame(b.sessionId);
    expect(saveA.saveId).not.toBe(saveB.saveId);
    expect(saveA.saveId).toMatch(UUID_RE);
    expect(saveB.saveId).toMatch(UUID_RE);
  });

  it("S1.2 — with a counting RecordIdSource, two runs of the identical call sequence return identical session and save ids in the identical order", async () => {
    async function runSequence(): Promise<{ sessionIds: string[]; saveIds: string[] }> {
      const store = makeStore({ recordIds: makeCountingRecordIds() });
      const a = await store.createSession({ campaignId: "test-campaign" });
      const b = await store.createSession({ campaignId: "test-campaign" });
      const saveA = await store.saveGame(a.sessionId);
      const saveB = await store.saveGame(b.sessionId);
      const loaded = await store.loadGame(saveA.saveId);
      return { sessionIds: [a.sessionId, b.sessionId, loaded.sessionId], saveIds: [saveA.saveId, saveB.saveId] };
    }

    const run1 = await runSequence();
    const run2 = await runSequence();
    expect(run1).toEqual(run2);
    expect(run1.sessionIds).toEqual(["session-0", "session-1", "session-2"]);
    expect(run1.saveIds).toEqual(["save-0", "save-1"]);
  });

  it("S1.3 — serialize() produces the same bytes whether a RecordIdSource was supplied or not", async () => {
    // A capturing SessionPersistence exposes the store's `StoredSessionRecord.blob` — the
    // engine's own `serialize()` output (session/store.ts's `writeSession`) — without
    // reaching into store internals.
    function makeCapturingPersistence() {
      const blobs: string[] = [];
      return {
        blobs,
        persistence: {
          sessions: {
            get: async () => undefined,
            put: async (record: { blob: string }) => {
              blobs.push(record.blob);
            },
          },
          saves: {
            get: async () => undefined,
            put: async () => {},
            listByProfile: async () => [],
            delete: async () => {},
          },
        },
      };
    }

    // `gameId` comes from the unrelated `IdSource` port (composition/types.ts) — fixed here
    // on both engines so the only variable under test is `RecordIdSource`.
    const fixedIds = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };
    const registry = makeRegistry();
    const withoutCapture = makeCapturingPersistence();
    const withCapture = makeCapturingPersistence();
    const storeWithout = createInMemorySessionStore({
      engine: makeEngine({ registry, ids: fixedIds }),
      registry,
      persistence: withoutCapture.persistence,
    });
    const storeWith = createInMemorySessionStore({
      engine: makeEngine({ registry, ids: fixedIds }),
      registry,
      persistence: withCapture.persistence,
      recordIds: makeCountingRecordIds(),
    });

    const without = await storeWithout.createSession({ campaignId: "test-campaign", seed: "fixed-seed" });
    const withSeam = await storeWith.createSession({ campaignId: "test-campaign", seed: "fixed-seed" });
    await storeWithout.submitAction(without.sessionId, "increment");
    await storeWith.submitAction(withSeam.sessionId, "increment");

    // Last write per store is the post-`increment` blob.
    expect(withoutCapture.blobs.at(-1)).toBe(withCapture.blobs.at(-1));
  });

  it("S1.4 — newSessionId is called exactly once per session created (createSession and loadGame) and newSaveId exactly once per save written, and no other path consumes the source", async () => {
    let sessionCalls = 0;
    let saveCalls = 0;
    const recordIds: RecordIdSource = {
      newSessionId: () => `session-${sessionCalls++}`,
      newSaveId: () => `save-${saveCalls++}`,
    };
    const store = makeStore({ recordIds });

    const created = await store.createSession({ campaignId: "test-campaign" });
    expect(sessionCalls).toBe(1);
    expect(saveCalls).toBe(0);

    await store.submitAction(created.sessionId, "increment");
    await store.getScene(created.sessionId);
    await store.getView(created.sessionId);
    await store.getStrings(created.sessionId);
    await store.resumeSession(created.sessionId);
    await store.previewAction(created.sessionId, "increment");
    // Queries, resumeSession, submitAction and previewAction touch neither counter.
    expect(sessionCalls).toBe(1);
    expect(saveCalls).toBe(0);

    const saved = await store.saveGame(created.sessionId);
    expect(saveCalls).toBe(1);
    expect(sessionCalls).toBe(1);

    await store.loadGame(saved.saveId);
    expect(sessionCalls).toBe(2);
    expect(saveCalls).toBe(1);
  });
});

describe("save / load round trip", () => {
  it("save mid-session, load, and continue loses no state", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    await store.submitAction(sessionId, "increment");
    const { saveId, savedAtSeq } = await store.saveGame(sessionId);
    expect(savedAtSeq).toBe(1);

    await store.submitAction(sessionId, "increment"); // continues on the original session too
    const loaded = await store.loadGame(saveId);
    expect(loaded.scene.body.text).toBe("counter=1");

    const afterContinue = await store.submitAction(loaded.sessionId, "increment");
    expect(afterContinue.scene?.body.text).toBe("counter=2");
    // The loaded session is independent of the one that kept playing past the save point.
    expect((await store.getScene(sessionId)).body.text).toBe("counter=2");
  });

  it("rejects loadGame against an unknown saveId", async () => {
    const store = makeStore();
    await expect(store.loadGame("does-not-exist")).rejects.toThrow();
  });

  it("a saved and loaded session keeps its original audience", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", audience: "ai" });
    const { saveId } = await store.saveGame(sessionId);
    const loaded = await store.loadGame(saveId);

    const view = await store.getView(loaded.sessionId);
    expect(view.kindView).toEqual({ counter: 0, audience: "ai" });
  });

  it("a saved and loaded session keeps its profileId — an unlock after reload still mirrors to the profile", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const { saveId } = await store.saveGame(sessionId);

    const loaded = await store.loadGame(saveId);
    await store.submitAction(loaded.sessionId, "unlock-first-count");

    const { profile } = await profiles.load("p1");
    expect(profile.achievements).toEqual([{ campaignId: "test-campaign", achievementId: "first-count" }]);
  });

  it("a saved anonymous session loads anonymous — loadGame never invents a profileId", async () => {
    let loadCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 3, profileId, achievements: [], terminals: [], kindData: [] }, warnings: [] };
      },
      save: async () => ({ ok: true, warnings: [] }),
    };
    const store = makeStore({ profiles: spyProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" }); // no profileId
    const { saveId } = await store.saveGame(sessionId);

    const loaded = await store.loadGame(saveId);
    await store.submitAction(loaded.sessionId, "unlock-first-count");

    expect(loadCalls).toBe(0);
  });
});

describe("same-session concurrency", () => {
  it("previewAction shares the session queue but never persists state or consumes an attempt", async () => {
    const records: number[] = [];
    const sink: EmittedRecordSink = {
      write: (record) => {
        if (record.event.name === "core.action.accepted") records.push(record.attempt);
      },
    };
    const store = makeStore({ recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    const [submitted, preview] = await Promise.all([
      store.submitAction(sessionId, "increment"),
      store.previewAction(sessionId, "increment"),
    ]);

    expect(submitted.scene?.body.text).toBe("counter=1");
    expect(preview.scene?.body.text).toBe("counter=2");
    expect((await store.getScene(sessionId)).body.text).toBe("counter=1");
    expect(records).toEqual([1]);
  });

  it("two concurrent submitAction calls against the same session apply both actions — no lost update", async () => {
    const store = makeStore();
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    const [first, second] = await Promise.all([store.submitAction(sessionId, "increment"), store.submitAction(sessionId, "increment")]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const scene = await store.getScene(sessionId);
    expect(scene.body.text).toBe("counter=2");
  });

  it("attempt is still exactly {1, 2} across two concurrent same-session submissions, never {1, 1}", async () => {
    const records: number[] = [];
    const sink: EmittedRecordSink = {
      write: (record) => {
        if (record.event.name === "core.action.accepted") records.push(record.attempt);
      },
    };
    const store = makeStore({ recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    await Promise.all([store.submitAction(sessionId, "increment"), store.submitAction(sessionId, "increment")]);

    expect(records.sort()).toEqual([1, 2]);
  });
});

describe("no host-metadata leak", () => {
  it("no store return value ever mentions a host-only field name", async () => {
    const store = makeStore({ experiments: { "homepage-layout": "compact" } });
    const created = await store.createSession({ campaignId: "test-campaign" });
    const scene = await store.getScene(created.sessionId);
    const view = await store.getView(created.sessionId);
    const strings = await store.getStrings(created.sessionId);
    const actionResult = await store.submitAction(created.sessionId, "increment");
    const saveHandle = await store.saveGame(created.sessionId);
    const loaded = await store.loadGame(saveHandle.saveId);

    const blob = JSON.stringify([created, scene, view, strings, actionResult, saveHandle, loaded, await store.listCampaigns()]);
    // "savedAtSeq" (SaveHandle's own field) is legitimate and deliberately excluded from
    // this list — everything below would only appear via a host-metadata leak.
    for (const forbidden of ["ownerId", "createdAt", "emittedAt", "traceId", "spanId", "\"attempt\"", "experiments"]) {
      expect(blob).not.toContain(forbidden);
    }
  });
});

describe("observability stamping", () => {
  function collectingSink(): { sink: EmittedRecordSink; records: EmittedRecord[] } {
    const records: EmittedRecord[] = [];
    return { sink: { write: (record) => records.push(record) }, records };
  }

  it("every record from one command shares traceId and spanId; different commands mint different ones", async () => {
    const { sink, records } = collectingSink();
    const store = makeStore({ recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    const afterCreate = records.length;
    await store.submitAction(sessionId, "increment");
    const submitRecords = records.slice(afterCreate);

    expect(submitRecords.length).toBeGreaterThan(0);
    const traceIds = new Set(submitRecords.map((r) => r.traceId));
    const spanIds = new Set(submitRecords.map((r) => r.spanId));
    expect(traceIds.size).toBe(1);
    expect(spanIds.size).toBe(1);

    const createRecords = records.slice(0, afterCreate);
    expect(createRecords[0]?.traceId).not.toBe(submitRecords[0]?.traceId);
  });

  it("stamps sessionId, and stamps emittedAt from the clock", async () => {
    const { sink, records } = collectingSink();
    const fixedClock = { now: () => "2026-01-01T00:00:00.000Z" };
    const store = createInMemorySessionStore({ engine: makeEngine(), registry: makeRegistry(), clock: fixedClock, recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.sessionId).toBe(sessionId);
      expect(record.emittedAt).toBe("2026-01-01T00:00:00.000Z");
    }
  });

  it("stamps the same resolved experiment assignments onto every record across commands", async () => {
    const { sink, records } = collectingSink();
    const experiments = { "homepage-layout": "compact", "reward-curve": "control" } as const;
    const store = makeStore({ recordSink: sink, experiments });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    await store.submitAction(sessionId, "increment");

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.experiments).toBe(experiments);
    }
  });

  it("omits experiment attribution entirely when no assignment map is supplied", async () => {
    const { sink, records } = collectingSink();
    const store = makeStore({ recordSink: sink });
    await store.createSession({ campaignId: "test-campaign" });

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(Object.hasOwn(record, "experiments")).toBe(false);
    }
  });

  it("attempt is 1 on the first submitAction, unaffected by a getScene in between, and increments again on rejection", async () => {
    const { sink, records } = collectingSink();
    const store = makeStore({ recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    records.length = 0;

    await store.submitAction(sessionId, "increment");
    const firstAttempts = new Set(records.map((r) => r.attempt));
    expect(firstAttempts).toEqual(new Set([1]));

    await store.getScene(sessionId); // a query — no span, contributes no records
    records.length = 0;

    const rejected = await store.submitAction(sessionId, "not-a-real-action");
    expect(rejected.ok).toBe(false);
    const secondAttempts = new Set(records.map((r) => r.attempt));
    expect(secondAttempts).toEqual(new Set([2]));
  });

  it("a query (getScene) emits no records at all — only the five named commands are spanned", async () => {
    const { sink, records } = collectingSink();
    const store = makeStore({ recordSink: sink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    records.length = 0;

    await store.getScene(sessionId);
    await store.getView(sessionId);
    await store.getStrings(sessionId);

    expect(records).toEqual([]);
  });
});

describe("concurrency isolation", () => {
  it("two concurrent submitAction calls against different sessions never cross-attribute an emitted record's sessionId", async () => {
    const { sink, records } = collectingSinkFor();
    const store = makeStore({ recordSink: sink });
    const a = await store.createSession({ campaignId: "test-campaign" });
    const b = await store.createSession({ campaignId: "test-campaign" });
    records.length = 0;

    await Promise.all([store.submitAction(a.sessionId, "increment"), store.submitAction(b.sessionId, "increment")]);

    // Every record produced during a submitAction command carries that command's own
    // sessionId — proven by re-deriving each command's traceId→sessionId mapping and
    // checking it never disagrees with itself.
    const bySessionPerTrace = new Map<string, Set<string>>();
    for (const record of records) {
      const set = bySessionPerTrace.get(record.traceId) ?? new Set<string>();
      if (record.sessionId) set.add(record.sessionId);
      bySessionPerTrace.set(record.traceId, set);
    }
    for (const sessionIds of bySessionPerTrace.values()) {
      expect(sessionIds.size).toBe(1);
    }

    const sceneA = await store.getScene(a.sessionId);
    const sceneB = await store.getScene(b.sessionId);
    expect(sceneA.body.text).toBe("counter=1");
    expect(sceneB.body.text).toBe("counter=1");
  });

  function collectingSinkFor(): { sink: EmittedRecordSink; records: EmittedRecord[] } {
    const records: EmittedRecord[] = [];
    return { sink: { write: (record) => records.push(record) }, records };
  }
});

describe("jsonlEmitter integration", () => {
  it("the store's stamped records reach jsonlEmitter as one JSON line each", async () => {
    const lines: string[] = [];
    const sink = jsonlEmitter((line) => lines.push(line));
    const store = makeStore({ recordSink: sink });

    await store.createSession({ campaignId: "test-campaign" });

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("a throwing recordSink does not break a command", () => {
  it("createSession still succeeds when the sink's write() throws on every call", async () => {
    const throwingSink: EmittedRecordSink = {
      write: () => {
        throw new Error("sink is broken");
      },
    };
    const store = makeStore({ recordSink: throwingSink });
    const handle = await store.createSession({ campaignId: "test-campaign" });
    expect(handle.scene.body.text).toBe("counter=0");
  });

  it("submitAction still applies the action when the sink's write() throws on every call", async () => {
    const throwingSink: EmittedRecordSink = {
      write: () => {
        throw new Error("sink is broken");
      },
    };
    const store = makeStore({ recordSink: throwingSink });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    const result = await store.submitAction(sessionId, "increment");
    expect(result.ok).toBe(true);
    expect(result.scene?.body.text).toBe("counter=1");
  });
});

describe("profile store wiring (W8)", () => {
  it("an unlock survives a new session with the same profileId, read directly from the ProfileStore", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "unlock-first-count");

    const { profile } = await profiles.load("p1");
    expect(profile.achievements).toEqual([{ campaignId: "test-campaign", achievementId: "first-count" }]);

    // A brand new session, same profileId, same ProfileStore instance.
    const second = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    expect(second.sessionId).not.toBe(sessionId);
    const { profile: stillThere } = await profiles.load("p1");
    expect(stillThere.achievements).toEqual([{ campaignId: "test-campaign", achievementId: "first-count" }]);
  });

  it("no profileId means no read and no write — the ProfileStore is never called, and the session still plays to its ending (MVP.md §5, 'Persistent')", async () => {
    let loadCalls = 0;
    let saveCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 3, profileId, achievements: [], terminals: [], kindData: [] }, warnings: [] };
      },
      save: async () => {
        saveCalls += 1;
        return { ok: true, warnings: [] };
      },
    };
    const store = makeStore({ profiles: spyProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" }); // no profileId
    await store.submitAction(sessionId, "unlock-first-count");
    const result = await store.submitAction(sessionId, "end");

    expect(loadCalls).toBe(0);
    expect(saveCalls).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.scene?.status).toBe("ended");
  });

  it("an action with no achievement-unlock changes never touches the ProfileStore", async () => {
    let loadCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 3, profileId, achievements: [], terminals: [], kindData: [] }, warnings: [] };
      },
      save: async () => ({ ok: true, warnings: [] }),
    };
    const store = makeStore({ profiles: spyProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "increment");

    expect(loadCalls).toBe(0);
  });

  it("a missing profile surfaces profile_missing as a warning on the unlocking SessionActionResult", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "never-seen-before" });
    const result = await store.submitAction(sessionId, "unlock-first-count");

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([{ code: "profile_missing", messageKey: "core.reason.profile_missing", path: "never-seen-before" }]);
  });

  it("a corrupt profile surfaces profile_corrupt as a warning", async () => {
    const profiles = createInMemoryProfileStore({ raw: new Map([["p1", { nonsense: true }]]) });
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const result = await store.submitAction(sessionId, "unlock-first-count");

    expect(result.warnings).toEqual([{ code: "profile_corrupt", messageKey: "core.reason.profile_corrupt", path: "p1" }]);
  });

  it("a write failure warns without rolling back the game action", async () => {
    // No profile seeded, so the load half of the upsert also warns profile_missing —
    // both warnings surface, in load-then-save order.
    const profiles = createInMemoryProfileStore({ onSave: () => false });
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const result = await store.submitAction(sessionId, "unlock-first-count");

    expect(result.ok).toBe(true);
    expect(result.scene).toBeDefined();
    expect(result.warnings).toEqual([
      { code: "profile_missing", messageKey: "core.reason.profile_missing", path: "p1" },
      { code: "profile_write_failed", messageKey: "core.reason.profile_write_failed", path: "p1" },
    ]);
    // The game action itself is unaffected — the session advanced regardless.
    expect((await store.getScene(sessionId)).body.text).toBe("counter=0"); // "unlock-first-count" doesn't touch counter
  });

  it("the same achievement unlocked twice upserts idempotently — one record, not two", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });

    const a = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(a.sessionId, "unlock-first-count");
    const b = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(b.sessionId, "unlock-first-count"); // same achievement, different session

    const { profile } = await profiles.load("p1");
    expect(profile.achievements).toEqual([{ campaignId: "test-campaign", achievementId: "first-count" }]);
  });

  it("two different achievements both accumulate on the same profile", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "unlock-first-count");
    await store.submitAction(sessionId, "unlock-second-thing");

    const { profile } = await profiles.load("p1");
    expect(profile.achievements).toEqual(
      expect.arrayContaining([
        { campaignId: "test-campaign", achievementId: "first-count" },
        { campaignId: "test-campaign", achievementId: "second-thing" },
      ]),
    );
    expect(profile.achievements).toHaveLength(2);
  });

  it("a loaded profile's content never affects resolution — byte-identical state regardless of what's pre-seeded", async () => {
    const decoyProfiles = createInMemoryProfileStore({
      raw: new Map([["p1", { formatVersion: 1, profileId: "p1", achievements: [{ campaignId: "test-campaign", achievementId: "first-count" }] }]]),
    });
    const emptyProfiles = createInMemoryProfileStore();

    async function runSequence(profiles: ProfileStore): Promise<string> {
      // A fixed IdSource so gameId doesn't itself differ between the two runs — only the
      // profile content should be able to, and this test is asserting it doesn't.
      const registry = makeRegistry();
      const engine = makeEngine({ registry, ids: { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" } });
      const store = createInMemorySessionStore({ engine, registry, profiles });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1", seed: "fixed-seed" });
      await store.submitAction(sessionId, "increment");
      await store.submitAction(sessionId, "unlock-first-count");
      const scene = await store.getScene(sessionId);
      return JSON.stringify(scene);
    }

    const withDecoy = await runSequence(decoyProfiles);
    const withoutDecoy = await runSequence(emptyProfiles);
    expect(withDecoy).toBe(withoutDecoy);
  });

  it("a throwing/rejecting ProfileStore degrades to a warning — the already-advanced action is not rolled back or aborted", async () => {
    const throwingProfiles: ProfileStore = {
      load: async () => {
        throw new Error("network is down");
      },
      save: async () => ({ ok: true, warnings: [] }),
    };
    const store = makeStore({ profiles: throwingProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });

    const result = await store.submitAction(sessionId, "unlock-first-count");

    expect(result.ok).toBe(true);
    expect(result.scene).toBeDefined();
    expect(result.warnings).toEqual([{ code: "profile_write_failed", messageKey: "core.reason.profile_write_failed", path: "p1" }]);
    // The game action is unaffected — the session really did advance.
    expect((await store.getScene(sessionId)).body.text).toBe("counter=0");
  });

  it("two different sessions sharing one profileId, unlocking concurrently, both persist — no lost update", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeStore({ profiles });
    const a = await store.createSession({ campaignId: "test-campaign", profileId: "shared" });
    const b = await store.createSession({ campaignId: "test-campaign", profileId: "shared" });

    await Promise.all([store.submitAction(a.sessionId, "unlock-first-count"), store.submitAction(b.sessionId, "unlock-second-thing")]);

    const { profile } = await profiles.load("shared");
    expect(profile.achievements).toEqual(
      expect.arrayContaining([
        { campaignId: "test-campaign", achievementId: "first-count" },
        { campaignId: "test-campaign", achievementId: "second-thing" },
      ]),
    );
    expect(profile.achievements).toHaveLength(2);
  });
});

describe("session lifecycle — listSaves / deleteSave / branchSession (04 §7.4, W99)", () => {
  describe("listSaves", () => {
    it("L1 — returns only the addressed profile's saves, and none of another's", async () => {
      const store = makeStore();
      const a = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const b = await store.createSession({ campaignId: "test-campaign", profileId: "p2" });
      const anon = await store.createSession({ campaignId: "test-campaign" });
      const savedA = await store.saveGame(a.sessionId);
      await store.saveGame(b.sessionId);
      await store.saveGame(anon.sessionId);

      const saves = await store.listSaves("p1");
      expect(saves).toEqual([{ saveId: savedA.saveId, campaignId: "test-campaign", savedAt: expect.any(String), savedAtSeq: 0 }]);
    });

    it("L2 — total order: savedAt descending, then saveId ascending on a tie", async () => {
      let now = "2026-01-01T00:00:00.000Z";
      const clock = { now: () => now };
      const store = makeStore({ clock });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });

      now = "2026-01-01T00:00:02.000Z";
      const later = await store.saveGame(sessionId);
      now = "2026-01-01T00:00:01.000Z";
      const earlier = await store.saveGame(sessionId);
      now = "2026-01-01T00:00:02.000Z";
      const tiedWithLater = await store.saveGame(sessionId);

      const saves = await store.listSaves("p1");
      const ordered = saves.map((s) => s.saveId);
      const tiedPair = [later.saveId, tiedWithLater.saveId].sort();
      expect(ordered).toEqual([...tiedPair, earlier.saveId]);
    });

    it("L3 — a SaveSummary carries no blob and no field StoredSaveRecord doesn't have", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const saved = await store.saveGame(sessionId);

      const [summary] = await store.listSaves("p1");
      expect(summary).toEqual({ saveId: saved.saveId, campaignId: "test-campaign", savedAt: expect.any(String), savedAtSeq: 0 });
      expect(summary).not.toHaveProperty("blob");
    });

    it("a profile with no saves lists nothing, rather than raising an error", async () => {
      const store = makeStore();
      expect(await store.listSaves("nobody")).toEqual([]);
    });

    it("surfaces an adapter failure as storage_failure", async () => {
      const store = makeStore({
        persistence: persistenceWith({ saves: { listByProfile: async () => { throw new Error("down"); } } }),
      });
      await expect(store.listSaves("p1")).rejects.toMatchObject({ code: "storage_failure" });
    });
  });

  describe("deleteSave", () => {
    it("D1 — removes exactly the addressed record on success", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const kept = await store.saveGame(sessionId);
      const removed = await store.saveGame(sessionId);
      const removedSummary = (await store.listSaves("p1")).find((s) => s.saveId === removed.saveId);

      await store.deleteSave("p1", removed.saveId, removedSummary!.savedAt);

      const remaining = await store.listSaves("p1");
      expect(remaining).toEqual([expect.objectContaining({ saveId: kept.saveId })]);
    });

    it("D2 — a stale expectedSavedAt is refused with concurrent_modification and removes nothing", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const saved = await store.saveGame(sessionId);

      await expect(store.deleteSave("p1", saved.saveId, "not-the-real-timestamp")).rejects.toMatchObject({
        operation: "deleteSave",
        code: "concurrent_modification",
      });
      expect(await store.listSaves("p1")).toHaveLength(1);
    });

    it("D3 — another profile's saveId is indistinguishable from an unknown one", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const saved = await store.saveGame(sessionId);
      const [summary] = await store.listSaves("p1");

      await expect(store.deleteSave("someone-else", saved.saveId, summary!.savedAt)).rejects.toMatchObject({
        code: "unknown_save",
      });
      await expect(store.deleteSave("someone-else", "does-not-exist", summary!.savedAt)).rejects.toMatchObject({
        code: "unknown_save",
      });
      expect(await store.listSaves("p1")).toHaveLength(1);
    });

    it("a multi-instance conflict branded by the adapter's own conditional delete surfaces as concurrent_modification", async () => {
      const conflict = { name: SESSION_PERSISTENCE_CONFLICT };
      const rows = new Map<string, StoredSaveRecord>();
      const store = makeStore({
        persistence: persistenceWith({
          saves: {
            get: async (saveId) => rows.get(saveId),
            put: async (record) => { rows.set(record.saveId, record); },
            listByProfile: async (profileId) => [...rows.values()].filter((row) => row.profileId === profileId),
            delete: async () => { throw conflict; },
          },
        }),
      });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      const saved = await store.saveGame(sessionId);
      const [summary] = await store.listSaves("p1");

      await expect(store.deleteSave("p1", saved.saveId, summary!.savedAt)).rejects.toMatchObject({
        code: "concurrent_modification",
      });
    });
  });

  describe("branchSession", () => {
    it("B1 — replays byte-identically through the fork point, gameId included", async () => {
      function makeCapturingPersistence(): { blobs: Map<string, string>; persistence: SessionPersistence } {
        const blobs = new Map<string, string>();
        return {
          blobs,
          persistence: {
            sessions: {
              get: async () => undefined,
              put: async (record) => {
                blobs.set(record.sessionId, record.blob);
              },
            },
            saves: { get: async () => undefined, put: async () => {}, listByProfile: async () => [], delete: async () => {} },
          },
        };
      }

      const registry = makeRegistry();
      const { blobs, persistence } = makeCapturingPersistence();
      const store = createInMemorySessionStore({ engine: makeEngine({ registry }), registry, persistence });

      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
      await store.submitAction(sessionId, "increment"); // fork point: n=1 stops here
      const blobAtForkPoint = blobs.get(sessionId);
      await store.submitAction(sessionId, "increment");
      await store.submitAction(sessionId, "increment");
      const blobAtEnd = blobs.get(sessionId);

      const branch = await store.branchSession(sessionId, 1);
      expect(blobs.get(branch.sessionId)).toBe(blobAtForkPoint);

      // At n = actionLog.length the branch equals the live session exactly.
      const fullBranch = await store.branchSession(sessionId, 3);
      expect(blobs.get(fullBranch.sessionId)).toBe(blobAtEnd);
    });

    it("B2 — no write on any failure path", async () => {
      let putCalls = 0;
      const store = makeStore({
        persistence: persistenceWith({ sessions: { put: async () => { putCalls += 1; } } }),
      });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
      putCalls = 0; // reset after createSession's own write

      await expect(store.branchSession(sessionId, 99)).rejects.toMatchObject({ code: "invalid_fork_point" });
      await expect(store.branchSession(sessionId, -1)).rejects.toMatchObject({ code: "invalid_fork_point" });
      await expect(store.branchSession("does-not-exist", 0)).rejects.toMatchObject({ code: "unknown_session" });
      expect(putCalls).toBe(0);
    });

    it("B3 — a branch's sessionId is distinct from its source, and its gameId equals the source's", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
      await store.submitAction(sessionId, "increment");

      const branch = await store.branchSession(sessionId, 1);
      expect(branch.sessionId).not.toBe(sessionId);

      const [sourceView, branchView] = await Promise.all([store.getView(sessionId), store.getView(branch.sessionId)]);
      expect(branchView.gameId).toBe(sourceView.gameId);
    });

    it("mints the new sessionId through RecordIdSource, not IdSource", async () => {
      const store = makeStore({ recordIds: makeCountingRecordIds() });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
      const branch = await store.branchSession(sessionId, 0);
      expect(branch.sessionId).toBe("session-1");
    });

    it("the source session and its saves are untouched by a branch", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
      await store.submitAction(sessionId, "increment");
      const saved = await store.saveGame(sessionId);
      const beforeScene = await store.getScene(sessionId);

      await store.branchSession(sessionId, 1);

      expect(await store.getScene(sessionId)).toEqual(beforeScene);
      expect(await store.listSaves("p1")).toEqual([expect.objectContaining({ saveId: saved.saveId })]);
    });

    it("invalid_fork_point — atActionCount outside [0, actionLog.length] writes nothing and is refused", async () => {
      const store = makeStore();
      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
      await store.submitAction(sessionId, "increment");
      await expect(store.branchSession(sessionId, 2)).rejects.toMatchObject({
        operation: "branchSession",
        code: "invalid_fork_point",
      });
    });

    it("invalid_state — a session that has passed through a migrated loadGame cannot be branched", async () => {
      const registry = makeRegistry();
      const engine = makeEngine({ registry });
      const kind = makeTestKind();
      const campaign = makeCampaign();

      const created = engine.createGame({ campaignId: campaign.id });
      if (!created.ok || !created.value) throw new Error("expected createGame to succeed");
      const migratedBlob = serializeSaveEnvelope(
        buildSaveEnvelope({ state: created.value, kind: kind as unknown as Kind<unknown>, campaign, replayCompatible: false }),
      );
      const migratedSave: StoredSaveRecord = { saveId: "migrated-save", campaignId: campaign.id, blob: migratedBlob, savedAt: "2026-01-01T00:00:00.000Z", savedAtSeq: 0, audience: "player" };

      const store = createInMemorySessionStore({
        engine,
        registry,
        persistence: persistenceWith({ saves: { get: async (saveId) => (saveId === "migrated-save" ? migratedSave : undefined) } }),
      });

      const loaded = await store.loadGame("migrated-save");
      await expect(store.branchSession(loaded.sessionId, 0)).rejects.toMatchObject({
        operation: "branchSession",
        code: "invalid_state",
      });
    });

  });

  describe("reproducing a stored session from its log (04 §7.4, W99.6)", () => {
    it("reconstruction under a pinned newGameId matches the stored blob exactly; an unrelated id is observably different", () => {
      const registry = makeRegistry();
      const kinds = makeKinds();
      const stored = createEngine({ kinds, registry }).createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
      if (!stored.ok || !stored.value) throw new Error("expected createGame to succeed");
      const original = createEngine({ kinds, registry }).serialize({ ...stored.value, gameId: "the-original-game-id" });

      // Reconstructing from `{ seed, actionLog }` alone, under an `IdSource` pinned to the
      // original `gameId` — the mechanism 04 §7.4 names — reproduces the stored blob
      // byte-for-byte.
      const pinnedEngine = createEngine({ kinds, registry, ids: { newGameId: () => "the-original-game-id", newSeed: () => "unused" } });
      const pinnedCreated = pinnedEngine.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
      if (!pinnedCreated.ok || !pinnedCreated.value) throw new Error("expected createGame to succeed");
      expect(pinnedEngine.serialize(pinnedCreated.value)).toBe(original);

      // The same reconstruction under any other id differs — and only there, since
      // `gameId` is the one field the pin controls and everything else is a function of
      // `{ campaignId, seed }`.
      const unrelatedEngine = createEngine({ kinds, registry, ids: { newGameId: () => "a-different-game-id", newSeed: () => "unused" } });
      const unrelatedCreated = unrelatedEngine.createGame({ campaignId: "test-campaign", seed: "fixed-seed" });
      if (!unrelatedCreated.ok || !unrelatedCreated.value) throw new Error("expected createGame to succeed");
      expect(unrelatedEngine.serialize(unrelatedCreated.value)).not.toBe(original);
      expect({ ...unrelatedCreated.value, gameId: "the-original-game-id" }).toEqual(pinnedCreated.value);
    });
  });
});

// ---------------------------------------------------------------------------
// W102 — the third profile mirror (`Kind.profileData`, 04 §7.1)
// ---------------------------------------------------------------------------

interface ProfileKindState {
  counter: number;
  /** Whatever `initialState` received as `profileData` — asserted directly, so a test can
   *  observe seeding without a second, parallel read path. */
  seeded: unknown;
}

const OVERSIZED_FOLD_MARKER = "oversized";
const THROWING_FOLD_MARKER = "throw";

/** A minimal `Kind` declaring `profileData`: `fold` takes `max(existing, value)` over a
 *  `counter_recorded` audit record — the same maximum-not-sum shape §2.2's own
 *  `SimulationProfileChainRecord.furthestStep` uses, so idempotence is observable the same
 *  way. Two actions are content-adjacent misbehaviour, exercised on purpose:
 *  `THROWING_FOLD_MARKER` makes `fold` throw, `OVERSIZED_FOLD_MARKER` makes it return a
 *  value bigger than the 65 536-byte cap. */
function makeProfileTestKind(): Kind<ProfileKindState> {
  return {
    id: "story-graph",
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(),
    eventNames: [],
    initialState: (_campaign, _ctx, profileData): InitialStateResult<ProfileKindState> => ({
      state: { counter: 0, seeded: profileData },
      status: "active",
      changes: [],
      messages: [],
    }),
    availableActions: (): AvailableAction[] => [],
    scene: (state): SceneBody => ({ textKey: "test.scene", text: `counter=${state.counter}` }),
    advance: (state, actionId): AdvanceResult<ProfileKindState> => {
      if (actionId === "bump" || actionId === THROWING_FOLD_MARKER || actionId === OVERSIZED_FOLD_MARKER) {
        const next = state.counter + 1;
        const changes: StateChange[] = [{ path: "counter", op: "set", value: next, reason: actionId, visible: true }];
        return { state: { ...state, counter: next }, status: "active", changes, messages: [] };
      }
      if (actionId === "end") {
        return { state, status: "ended", changes: [], messages: [] };
      }
      return { state, status: "active", changes: [], messages: [], error: { code: "unknown_action", messageKey: "core.reason.unknown_action" } };
    },
    project: (state) => state,
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    validateState: () => true,
    outcome: () => ({ terminal: false, terminalId: null }),
    profileData: {
      version: 1,
      fold: (current, _campaign, changes): unknown => {
        if (changes.some((c) => c.reason === THROWING_FOLD_MARKER)) throw new Error("fold: deliberately broken");
        if (changes.some((c) => c.reason === OVERSIZED_FOLD_MARKER)) return { blob: "x".repeat(100_000) };
        const bump = changes.find((c) => c.reason === "bump");
        if (!bump) return current;
        const previousMax = typeof current === "object" && current !== null && "max" in current ? (current as { max: number }).max : 0;
        return { max: Math.max(previousMax, bump.value as number) };
      },
    },
  };
}

function makeProfileKinds(): KindRegistry {
  return { "story-graph": makeProfileTestKind() } as unknown as KindRegistry;
}

function makeProfileStore(overrides?: { engine?: Engine; profiles?: ProfileStore }) {
  const registry = makeRegistry();
  return createInMemorySessionStore({
    engine: overrides?.engine ?? createEngine({ kinds: makeProfileKinds(), registry }),
    registry,
    ...(overrides?.profiles ? { profiles: overrides.profiles } : {}),
  });
}

/** Wraps a real in-memory `ProfileStore` and counts `save` calls, so a test can assert
 *  "no write happened" (idempotence, §7.1's P6) rather than only inspecting the end state. */
function countingProfileStore(): { profiles: ProfileStore; saveCalls: () => number } {
  const inner = createInMemoryProfileStore();
  let saves = 0;
  const profiles: ProfileStore = {
    load: (id) => inner.load(id),
    save: (profile) => {
      saves += 1;
      return inner.save(profile);
    },
  };
  return { profiles, saveCalls: () => saves };
}

describe("W102 — Kind.profileData, the third profile mirror", () => {
  it("an anonymous session receives no kindProfileData — initialState sees undefined", async () => {
    const store = makeProfileStore({ profiles: createInMemoryProfileStore() });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    const view = await store.getView(sessionId);
    expect((view.kindView as ProfileKindState).seeded).toBeUndefined();
  });

  it("a profiled session with no prior kind data also seeds undefined", async () => {
    const store = makeProfileStore({ profiles: createInMemoryProfileStore() });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const view = await store.getView(sessionId);
    expect((view.kindView as ProfileKindState).seeded).toBeUndefined();
  });

  it("after a successful action, the folded slice is written and a later session for the same profile is seeded with it", async () => {
    const store = makeProfileStore({ profiles: createInMemoryProfileStore() });
    const first = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(first.sessionId, "bump");

    const second = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const view = await store.getView(second.sessionId);
    expect((view.kindView as ProfileKindState).seeded).toEqual({ max: 1 });
  });

  it("a different profile never sees another profile's kind data", async () => {
    const store = makeProfileStore({ profiles: createInMemoryProfileStore() });
    const first = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(first.sessionId, "bump");

    const other = await store.createSession({ campaignId: "test-campaign", profileId: "p2" });
    const view = await store.getView(other.sessionId);
    expect((view.kindView as ProfileKindState).seeded).toBeUndefined();
  });

  it("reapplying a transition that folds to the same canonical value writes nothing (idempotence, P6)", async () => {
    const { profiles, saveCalls } = countingProfileStore();
    const store = makeProfileStore({ profiles });

    const first = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(first.sessionId, "bump"); // max: 0 -> 1, writes once
    const savesAfterFirst = saveCalls();
    expect(savesAfterFirst).toBeGreaterThan(0);

    // A fresh session under the same profile, reaching the same counter value (1) again —
    // fold's own max(1, 1) canonically equals what's already stored, so no further write.
    const second = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(second.sessionId, "bump");
    expect(saveCalls()).toBe(savesAfterFirst);
  });

  it("a throwing fold is refused: the previous slice is retained and profile_kind_data_rejected is warned", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeProfileStore({ profiles });

    const first = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(first.sessionId, "bump"); // records { max: 1 }

    const result = await store.submitAction(first.sessionId, THROWING_FOLD_MARKER);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "profile_kind_data_rejected")).toBe(true);

    const { profile } = await profiles.load("p1");
    expect(profile.kindData).toEqual([{ kindId: "story-graph", dataVersion: 1, data: { max: 1 } }]);
  });

  it("a fold result over the 65 536-byte cap is refused the same way", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeProfileStore({ profiles });

    const first = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const result = await store.submitAction(first.sessionId, OVERSIZED_FOLD_MARKER);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "profile_kind_data_rejected")).toBe(true);

    const { profile } = await profiles.load("p1");
    expect(profile.kindData).toEqual([]);
  });

  it("a KindProfileRecord this build's kind does not recognise round-trips through the store unchanged", async () => {
    const seeded: PlayerProfile = {
      formatVersion: 3,
      profileId: "p1",
      achievements: [],
      terminals: [],
      kindData: [{ kindId: "some-other-kind", dataVersion: 9, data: { anything: true } }],
    };
    const profiles = createInMemoryProfileStore({ raw: new Map([["p1", seeded]]) });
    const store = makeProfileStore({ profiles });

    const session = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(session.sessionId, "bump");

    const { profile } = await profiles.load("p1");
    expect(profile.kindData).toEqual([
      { kindId: "some-other-kind", dataVersion: 9, data: { anything: true } },
      { kindId: "story-graph", dataVersion: 1, data: { max: 1 } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// S121 — one player-response projection at the session boundary (20-contract.md §7)
// ---------------------------------------------------------------------------

const S121_SECRET = "s121-secret-8675309";

function makeHiddenOutputKind(): Kind<TestKindState> {
  const base = makeTestKind();
  return {
    ...base,
    advance: (state, actionId): AdvanceResult<TestKindState> => {
      const messages = [
        { key: "test.hidden", params: { code: S121_SECRET }, visible: false },
        { key: "test.shown", visible: true },
      ];
      if (actionId === "reveal") {
        return {
          state: { counter: state.counter + 1 },
          status: "active",
          changes: [
            { path: "secret", op: "set", value: S121_SECRET, reason: "test_hidden", visible: false },
            // A hidden-path unlock: the profile fold must still see it.
            { path: "achieved.hidden-path", op: "set", value: true, reason: "achievement_unlocked", visible: false },
            { path: "counter", op: "set", value: state.counter + 1, reason: "test_shown", visible: true },
          ],
          messages,
        };
      }
      return {
        state,
        status: "active",
        changes: [],
        messages,
        error: { code: "test_refused", messageKey: "test.refused" },
      };
    },
  };
}

function makeHiddenOutputStore(profiles?: ProfileStore): SessionStore {
  const kinds = { "story-graph": makeHiddenOutputKind() } as unknown as KindRegistry;
  const registry = makeRegistry();
  return createInMemorySessionStore({
    engine: createEngine({ kinds, registry }),
    registry,
    ...(profiles ? { profiles } : {}),
  });
}

describe("S121 — the store returns only visible changes and messages", () => {
  for (const operation of ["previewAction", "submitAction"] as const) {
    for (const actionId of ["reveal", "refuse"]) {
      it(`${operation} ${actionId === "reveal" ? "accept" : "reject"}: the whole serialized result carries no hidden record`, async () => {
        const store = makeHiddenOutputStore();
        const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
        const result = await store[operation](sessionId, actionId);

        expect(result.ok).toBe(actionId === "reveal");
        // The review's shape: scan everything the caller receives, not just scene or view.
        expect(JSON.stringify(result)).not.toContain(S121_SECRET);
        expect(result.changes.every((change) => change.visible)).toBe(true);
        expect(result.messages).toEqual([{ key: "test.shown", visible: true }]);
        if (actionId === "reveal") {
          expect(result.changes.map((change) => change.path)).toEqual(["counter"]);
        }
      });
    }
  }

  it("the profile fold still reads the full result: a hidden-path achievement unlocks", async () => {
    const profiles = createInMemoryProfileStore();
    const store = makeHiddenOutputStore(profiles);
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    const result = await store.submitAction(sessionId, "reveal");

    expect(result.changes.some((change) => change.reason === "achievement_unlocked")).toBe(false);
    const { profile } = await profiles.load("p1");
    expect(profile.achievements).toEqual([{ campaignId: "test-campaign", achievementId: "hidden-path" }]);
  });
});


// ── S133 — running sessions pick up new content (16 §5.2, §5.3, §5.7) ──

interface EpochContent {
  sceneKey: string;
  messageKey: string;
  /** The test kind refuses to adopt onto content that sets this. */
  refuse?: boolean;
}

/** One campaign across epochs. The scene and each action's message are drawn from the epoch the
 *  state is on, so a result shows which epoch built each half of it. */
function makeEpochKind(): Kind<TestKindState> {
  const content = (campaign: Campaign) => campaign.content as EpochContent;
  return {
    ...makeTestKind(),
    scene: (state, ctx): SceneBody => ({ textKey: content(ctx.campaign).sceneKey, text: `counter=${state.counter}` }),
    advance: (state, actionId, _params, ctx): AdvanceResult<TestKindState> => {
      if (actionId === "increment") {
        return {
          state: { counter: state.counter + 1 },
          status: "active",
          changes: [],
          messages: [{ key: content(ctx.campaign).messageKey, visible: true }],
        };
      }
      if (actionId === "end") return { state, status: "ended", changes: [], messages: [] };
      return {
        state,
        status: "active",
        changes: [],
        messages: [],
        error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
      };
    },
    adoptContent: (state, _from, to) =>
      content(to).refuse ? { adopt: false, reason: "content_incompatible" } : { adopt: true, state },
    profileData: { version: 1, fold: (_current, campaign) => ({ foldedOn: campaign.version }) },
  };
}

function epochRegistry(version: string, strings: Record<string, string>, extra?: Partial<EpochContent>): ContentRegistry {
  const content: EpochContent = { sceneKey: `scene.v${version}`, messageKey: `message.v${version}`, ...extra };
  return {
    campaigns: new Map([["test-campaign", makeCampaign({ version, content })]]),
    strings: new Map(Object.entries({ "test.title": "Test Campaign", ...strings })),
  };
}

const EPOCH_V1 = epochRegistry("1", {
  "scene.v1": "The old hall.",
  "message.v1": "The old clerk nods.",
  shared: "Old wording.",
  dropped: "Only the first epoch has this.",
});
const EPOCH_V2 = epochRegistry("2", {
  "scene.v2": "The new hall.",
  "message.v2": "The new clerk nods.",
  shared: "New wording.",
});
const EPOCH_V3_REFUSED = epochRegistry("3", { "scene.v3": "Nowhere to stand." }, { refuse: true });

/** A channel that records every scope it is asked about and answers `offer` — or throws, when
 *  `offer` is the string "throw". */
function recordingChannel(initial?: string): ContentChannel & { calls: ContentScope[]; offer: string | undefined } {
  const channel = {
    calls: [] as ContentScope[],
    offer: initial,
    current(scope: ContentScope): string | undefined {
      channel.calls.push(scope);
      if (channel.offer === "throw") throw new Error("channel defect");
      return channel.offer;
    },
  };
  return channel;
}

function makeEpochStore(options: {
  channel?: ContentChannel;
  persistence?: SessionPersistence;
  profiles?: ProfileStore;
  recordSink?: EmittedRecordSink;
  /** The host's own content: its registry, the archive's other epochs, and its kind. */
  kind?: Kind<TestKindState>;
  initial?: ContentRegistry;
  publish?: ContentRegistry[];
  recordIds?: RecordIdSource;
}): { store: SessionStore; engine: Engine } {
  const kinds = { "story-graph": options.kind ?? makeEpochKind() } as unknown as KindRegistry;
  const initial = options.initial ?? EPOCH_V1;
  const archive = createContentArchive({ kinds, initial });
  for (const registry of options.publish ?? [EPOCH_V2, EPOCH_V3_REFUSED]) {
    if (!archive.publish(registry).ok) throw new Error("expected the test epoch to publish");
  }
  const engine = createEngine({ kinds, registry: initial, archive, ids: createCountingIds() });
  const store = createSessionLayer({
    engine,
    registry: initial,
    recordIds: options.recordIds ?? makeCountingRecordIds(),
    ...(options.channel ? { content: options.channel } : {}),
    ...(options.persistence ? { persistence: options.persistence } : {}),
    ...(options.profiles ? { profiles: options.profiles } : {}),
    ...(options.recordSink ? { recordSink: options.recordSink } : {}),
  });
  return { store, engine };
}

interface StoredState {
  campaignVersion: string;
  formatVersion: number;
  actionLog: { seq: number; actionId?: string; system?: string; from?: string; to?: string }[];
}

const storedState = (row: StoredSessionRecord | undefined): StoredState => JSON.parse(row!.blob) as StoredState;

describe("S133.1 — createSession starts on the channel's version", () => {
  it("asks the channel once, for this session's scope, and starts on its answer with no content entry", async () => {
    const channel = recordingChannel("2");
    const cas = makeCasPersistence();
    const { store } = makeEpochStore({ channel, persistence: cas.persistence });
    const { sessionId, scene } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });

    expect(channel.calls).toEqual([{ campaignId: "test-campaign", sessionId, profileId: "p1" }]);
    expect(scene.body.textKey).toBe("scene.v2");
    const state = storedState(cas.rows.get(sessionId));
    expect(state.campaignVersion).toBe("2");
    expect(state.formatVersion).toBe(1);
    expect(state.actionLog).toEqual([]);
  });

  it("starts on the registry's version with no channel, no answer, or a channel that throws", async () => {
    for (const channel of [undefined, recordingChannel(undefined), recordingChannel("throw")]) {
      const { store } = makeEpochStore(channel ? { channel } : {});
      const { scene } = await store.createSession({ campaignId: "test-campaign" });
      expect(scene.body.textKey).toBe("scene.v1");
    }
  });

  it("omits profileId from the scope of an anonymous session", async () => {
    const channel = recordingChannel(undefined);
    const { store } = makeEpochStore({ channel });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    expect(channel.calls).toEqual([{ campaignId: "test-campaign", sessionId }]);
  });
});

describe("S133.2 — an accepted action adopts after it commits, in its own write", () => {
  it("persists the action and the adoption in one write; messages are the old epoch's, the scene the new one's", async () => {
    const channel = recordingChannel(undefined);
    const cas = makeCasPersistence();
    let puts = 0;
    const counted: SessionPersistence = {
      ...cas.persistence,
      sessions: { ...cas.persistence.sessions, put: async (record) => { puts += 1; await cas.persistence.sessions.put(record); } },
    };
    const { store } = makeEpochStore({ channel, persistence: counted });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    puts = 0;
    channel.calls.length = 0;

    channel.offer = "2";
    const result = await store.submitAction(sessionId, "increment");

    expect(result.ok).toBe(true);
    expect(result.messages).toEqual([{ key: "message.v1", visible: true }]);
    expect(result.scene?.body.textKey).toBe("scene.v2");
    expect(channel.calls).toEqual([{ campaignId: "test-campaign", sessionId }]);
    expect(puts).toBe(1);
    const row = cas.rows.get(sessionId)!;
    expect(row.revision).toBe(1);
    expect(storedState(row)).toMatchObject({
      campaignVersion: "2",
      formatVersion: 2,
      actionLog: [
        { seq: 0, actionId: "increment" },
        { seq: 1, system: "content", from: "1", to: "2" },
      ],
    });
  });

  it("folds the profile against the epoch the action resolved on", async () => {
    const profiles = createInMemoryProfileStore();
    const channel = recordingChannel("2");
    const { store } = makeEpochStore({ channel, profiles });
    // Created on 2 by the channel, so the registry's campaign is not the one this action played.
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    await store.submitAction(sessionId, "increment");

    const { profile } = await profiles.load("p1");
    expect(profile.kindData.find((r) => r.kindId === "story-graph")?.data).toEqual({ foldedOn: "2" });
  });
});

describe("S133.3 — resumeSession adopts in its own write", () => {
  async function sessionOnV1(cas: ReturnType<typeof makeCasPersistence>, channel: ReturnType<typeof recordingChannel>) {
    const { store } = makeEpochStore({ channel, persistence: cas.persistence });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    return { store, sessionId };
  }

  it("writes the adoption at revision + 1 and returns the adopted scene", async () => {
    const cas = makeCasPersistence();
    const channel = recordingChannel(undefined);
    const { store, sessionId } = await sessionOnV1(cas, channel);

    channel.offer = "2";
    const scene = await store.resumeSession(sessionId);

    expect(scene.body.textKey).toBe("scene.v2");
    const row = cas.rows.get(sessionId)!;
    expect(row.revision).toBe(1);
    expect(row.attemptCounter).toBe(0);
    expect(storedState(row)).toMatchObject({ campaignVersion: "2", actionLog: [{ seq: 0, system: "content", from: "1", to: "2" }] });
    expect((await store.getScene(sessionId)).body.textKey).toBe("scene.v2");
  });

  it("writes nothing when the offer is the version the session is on", async () => {
    const cas = makeCasPersistence();
    const channel = recordingChannel("1");
    const { store, sessionId } = await sessionOnV1(cas, channel);
    await store.resumeSession(sessionId);
    expect(cas.rows.get(sessionId)!.revision).toBe(0);
  });

  for (const [code, error] of [
    ["storage_failure", new Error("disk full")],
    ["concurrent_modification", { name: SESSION_PERSISTENCE_CONFLICT }],
  ] as const) {
    it(`restores the unadopted state when the write fails with ${code}, and the next adoption point offers again`, async () => {
      const cas = makeCasPersistence();
      const channel = recordingChannel(undefined);
      const { store, sessionId } = await sessionOnV1(cas, channel);

      channel.offer = "2";
      cas.failNextPut(error);
      const scene = await store.resumeSession(sessionId);

      expect(scene.body.textKey).toBe("scene.v1");
      expect(cas.rows.get(sessionId)!.revision).toBe(0);
      expect(storedState(cas.rows.get(sessionId)).campaignVersion).toBe("1");
      // A conflict evicts the cached record, as submitAction's does; a storage failure keeps it.
      const reads = cas.reads;
      expect((await store.getScene(sessionId)).body.textKey).toBe("scene.v1");
      expect(cas.reads).toBe(code === "concurrent_modification" ? reads + 1 : reads);

      const callsBefore = channel.calls.length;
      const retried = await store.resumeSession(sessionId);
      expect(channel.calls.length).toBe(callsBefore + 1);
      expect(retried.body.textKey).toBe("scene.v2");
      expect(cas.rows.get(sessionId)!.revision).toBe(1);
    });
  }
});

describe("S133.4 — a refusal or a failing channel never fails the command", () => {
  it("a refusal at submitAction leaves the session pinned, the action committed, and emits core.content.pinned", async () => {
    const records: EmittedRecord[] = [];
    const channel = recordingChannel(undefined);
    const cas = makeCasPersistence();
    const { store } = makeEpochStore({ channel, persistence: cas.persistence, recordSink: { write: (r) => records.push(r) } });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    channel.offer = "3";
    const result = await store.submitAction(sessionId, "increment");

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.scene?.body.textKey).toBe("scene.v1");
    expect(storedState(cas.rows.get(sessionId))).toMatchObject({ campaignVersion: "1", actionLog: [{ seq: 0, actionId: "increment" }] });
    const pinned = records.filter((r) => r.event.name === "core.content.pinned");
    expect(pinned.map((r) => r.event.reason)).toEqual(["content_incompatible"]);
  });

  it("a refusal at resumeSession returns the pinned scene and writes nothing", async () => {
    const channel = recordingChannel(undefined);
    const cas = makeCasPersistence();
    const { store } = makeEpochStore({ channel, persistence: cas.persistence });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    channel.offer = "3";
    expect((await store.resumeSession(sessionId)).body.textKey).toBe("scene.v1");
    expect(cas.rows.get(sessionId)!.revision).toBe(0);
  });

  it("an offer the archive does not hold pins with unknown_campaign rather than failing", async () => {
    const channel = recordingChannel(undefined);
    const { store } = makeEpochStore({ channel });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    channel.offer = "9";
    expect((await store.submitAction(sessionId, "increment")).ok).toBe(true);
    expect((await store.resumeSession(sessionId)).body.textKey).toBe("scene.v1");
  });

  it("a throwing channel is read as no offer at submitAction and resumeSession", async () => {
    const channel = recordingChannel(undefined);
    const { store } = makeEpochStore({ channel });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

    channel.offer = "throw";
    const result = await store.submitAction(sessionId, "increment");
    expect(result.ok).toBe(true);
    expect(result.scene?.body.textKey).toBe("scene.v1");
    expect((await store.resumeSession(sessionId)).body.textKey).toBe("scene.v1");
    expect(channel.calls.length).toBe(3);
  });
});

describe("S133.5 — queries, previews and rejected actions never consult the channel", () => {
  it("records zero calls across every query, a preview, a rejected action and a save", async () => {
    const channel = recordingChannel("2");
    const cas = makeCasPersistence();
    const { store } = makeEpochStore({ channel, persistence: cas.persistence });
    channel.offer = undefined;
    const { sessionId } = await store.createSession({ campaignId: "test-campaign", profileId: "p1" });
    channel.offer = "2";
    channel.calls.length = 0;

    await store.getScene(sessionId);
    await store.getView(sessionId);
    await store.getStrings(sessionId);
    await store.listCampaigns("p1");
    await store.listSaves("p1");
    expect((await store.previewAction(sessionId, "increment")).ok).toBe(true);
    expect((await store.submitAction(sessionId, "no-such-action")).ok).toBe(false);

    expect(channel.calls).toEqual([]);
    expect(storedState(cas.rows.get(sessionId)).campaignVersion).toBe("1");
    expect(cas.rows.get(sessionId)!.revision).toBe(0);
  });
});

describe("S133.6 — getStrings spans every live epoch", () => {
  const tableOf = (registry: ContentRegistry) => Object.fromEntries(registry.strings);

  it("a session that never adopted gets exactly its one epoch's table", async () => {
    const { store } = makeEpochStore({});
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    expect(await store.getStrings(sessionId)).toEqual(tableOf(EPOCH_V1));

    const { store: startedOnTwo } = makeEpochStore({ channel: recordingChannel("2") });
    const created = await startedOnTwo.createSession({ campaignId: "test-campaign" });
    expect(await startedOnTwo.getStrings(created.sessionId)).toEqual(tableOf(EPOCH_V2));
  });

  it("after an adoption, a dropped key still resolves and a key both define resolves to the newer text", async () => {
    const channel = recordingChannel(undefined);
    const { store } = makeEpochStore({ channel });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    channel.offer = "2";
    const result = await store.submitAction(sessionId, "increment");

    const strings = await store.getStrings(sessionId);
    expect(strings).toEqual({ ...tableOf(EPOCH_V1), ...tableOf(EPOCH_V2) });
    expect(strings.dropped).toBe("Only the first epoch has this.");
    expect(strings.shared).toBe("New wording.");
    // Both halves of the adopting result resolve in one table (C27).
    expect(strings[result.messages[0]!.key]).toBe("The old clerk nods.");
    expect(strings[result.scene!.body.textKey]).toBe("The new hall.");
  });

  it("starts from the last migration entry's to, not the log's first epoch", async () => {
    const { engine } = makeEpochStore({});
    const created = engine.createGame({ campaignId: "test-campaign", seed: "s" }, "2");
    const migrated = {
      ...created.value!,
      formatVersion: 2,
      actionLog: [{ seq: 0, system: "migration" as const, from: "1", to: "2" }],
    };
    const blob = engine.serialize(migrated);
    expect(engine.deserialize(blob).ok).toBe(true);
    const row: StoredSessionRecord = {
      sessionId: "migrated",
      blob,
      audience: "player",
      attemptCounter: 0,
      revision: 0,
      replayCompatible: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const store = createSessionLayer({
      engine,
      registry: EPOCH_V1,
      persistence: persistenceWith({ sessions: { get: async (id) => (id === "migrated" ? row : undefined) } }),
    });
    expect(await store.getStrings("migrated")).toEqual(tableOf(EPOCH_V2));
  });
});

/** One set of session and save rows several stores share — a later process reading what an
 *  earlier one wrote — with each store minting its own ids, and every session write counted. */
function makeSharedRows(): {
  persistence: SessionPersistence;
  rows: Map<string, StoredSessionRecord>;
  readonly sessionPuts: number;
} {
  const cas = makeCasPersistence();
  const saves = new Map<string, StoredSaveRecord>();
  let sessionPuts = 0;
  return {
    rows: cas.rows,
    get sessionPuts() { return sessionPuts; },
    persistence: persistenceWith({
      sessions: {
        get: cas.persistence.sessions.get,
        put: async (record) => {
          sessionPuts += 1;
          await cas.persistence.sessions.put(record);
        },
      },
      saves: {
        get: async (saveId) => saves.get(saveId),
        put: async (record) => { saves.set(record.saveId, { ...record }); },
      },
    }),
  };
}

function prefixedRecordIds(prefix: string): RecordIdSource {
  let sessions = 0;
  let saves = 0;
  return {
    newSessionId: () => `${prefix}-session-${sessions++}`,
    newSaveId: () => `${prefix}-save-${saves++}`,
  };
}

/** A fourth epoch that can be migrated onto: a host that dropped every earlier version. */
const EPOCH_V4_MIGRATING: ContentRegistry = (() => {
  const base = epochRegistry("4", { "scene.v4": "The rebuilt hall.", "message.v4": "The rebuilt clerk nods." });
  const campaign: Campaign = {
    ...base.campaigns.get("test-campaign")!,
    migrateState: (kindState) => ({ ok: true, value: kindState, errors: [], warnings: [] }),
  };
  return { campaigns: new Map([["test-campaign", campaign]]), strings: base.strings };
})();

/** A save on v1 (`[a0]`) and a save on v2 that crossed an adoption (`[a0, c1 1→2]`). */
async function savesOnOldEpochs(shared: ReturnType<typeof makeSharedRows>): Promise<{ uncrossed: string; crossed: string }> {
  const channel = recordingChannel(undefined);
  const { store } = makeEpochStore({ channel, persistence: shared.persistence, recordIds: prefixedRecordIds("source") });
  const plain = await store.createSession({ campaignId: "test-campaign" });
  await store.submitAction(plain.sessionId, "increment");
  const uncrossed = (await store.saveGame(plain.sessionId)).saveId;

  const moved = await store.createSession({ campaignId: "test-campaign" });
  channel.offer = "2";
  await store.submitAction(moved.sessionId, "increment");
  const crossed = (await store.saveGame(moved.sessionId)).saveId;
  return { uncrossed, crossed };
}

describe("S134.1 — a save on a held epoch loads as it was made", () => {
  it("loads on its own epoch with no migration, keeps replayCompatible, and branches", async () => {
    const shared = makeSharedRows();
    const { uncrossed } = await savesOnOldEpochs(shared);
    const { store } = makeEpochStore({
      persistence: shared.persistence,
      initial: EPOCH_V2,
      publish: [EPOCH_V1],
      recordIds: prefixedRecordIds("later"),
    });

    const loaded = await store.loadGame(uncrossed);
    expect(loaded.scene.body.textKey).toBe("scene.v1");
    const row = shared.rows.get(loaded.sessionId);
    expect(row!.replayCompatible).toBe(true);
    const state = storedState(row);
    expect(state.campaignVersion).toBe("1");
    expect(state.formatVersion).toBe(1);
    expect(state.actionLog).toEqual([{ seq: 0, actionId: "increment" }]);
    await expect(store.branchSession(loaded.sessionId, 1)).resolves.toMatchObject({ scene: { body: { textKey: "scene.v1" } } });
  });

  it("then reaches its adoption point, persisted in the new session's first write", async () => {
    const shared = makeSharedRows();
    const { uncrossed } = await savesOnOldEpochs(shared);
    const channel = recordingChannel("2");
    const { store } = makeEpochStore({
      channel,
      persistence: shared.persistence,
      initial: EPOCH_V2,
      publish: [EPOCH_V1],
      recordIds: prefixedRecordIds("later"),
    });
    const before = shared.sessionPuts;

    const loaded = await store.loadGame(uncrossed);
    expect(shared.sessionPuts - before).toBe(1);
    expect(channel.calls).toEqual([{ campaignId: "test-campaign", sessionId: loaded.sessionId }]);
    expect(loaded.scene.body.textKey).toBe("scene.v2");
    const row = shared.rows.get(loaded.sessionId);
    expect(row!.revision).toBe(0);
    expect(row!.replayCompatible).toBe(true);
    const state = storedState(row);
    expect(state.campaignVersion).toBe("2");
    expect(state.formatVersion).toBe(2);
    expect(state.actionLog).toEqual([
      { seq: 0, actionId: "increment" },
      { seq: 1, system: "content", from: "1", to: "2" },
    ]);
  });

  it("an offer the kind refuses leaves the loaded session pinned on its own epoch", async () => {
    const shared = makeSharedRows();
    const { uncrossed } = await savesOnOldEpochs(shared);
    const { store } = makeEpochStore({
      channel: recordingChannel("3"),
      persistence: shared.persistence,
      initial: EPOCH_V2,
      publish: [EPOCH_V1, EPOCH_V3_REFUSED],
      recordIds: prefixedRecordIds("later"),
    });

    const loaded = await store.loadGame(uncrossed);
    expect(loaded.scene.body.textKey).toBe("scene.v1");
    const state = storedState(shared.rows.get(loaded.sessionId));
    expect(state.campaignVersion).toBe("1");
    expect(state.actionLog).toHaveLength(1);
  });
});

describe("S134.2 — every other save migrates, and a restamp over a crossed log is logged", () => {
  const migratingStore = (shared: ReturnType<typeof makeSharedRows>) =>
    makeEpochStore({ persistence: shared.persistence, initial: EPOCH_V4_MIGRATING, publish: [], recordIds: prefixedRecordIds("later") });

  it("a crossed save onto a version it never held appends one migration entry, keeps formatVersion 2, and deserializes", async () => {
    const shared = makeSharedRows();
    const { crossed } = await savesOnOldEpochs(shared);
    const { store, engine } = migratingStore(shared);

    const loaded = await store.loadGame(crossed);
    expect(loaded.scene.body.textKey).toBe("scene.v4");
    const row = shared.rows.get(loaded.sessionId);
    expect(row!.replayCompatible).toBe(false);
    expect(engine.deserialize(row!.blob).ok).toBe(true);
    const state = storedState(row);
    expect(state.campaignVersion).toBe("4");
    expect(state.formatVersion).toBe(2);
    expect(state.actionLog).toEqual([
      { seq: 0, actionId: "increment" },
      { seq: 1, system: "content", from: "1", to: "2" },
      { seq: 2, system: "migration", from: "2", to: "4" },
    ]);

    // Saved and loaded again, it is already on the registry's version: no second entry.
    const again = await store.loadGame((await store.saveGame(loaded.sessionId)).saveId);
    const reloaded = storedState(shared.rows.get(again.sessionId));
    expect(reloaded.actionLog.filter((entry) => entry.system === "migration")).toHaveLength(1);
    expect(reloaded.actionLog).toEqual(state.actionLog);
    expect(shared.rows.get(again.sessionId)!.replayCompatible).toBe(false);
  });

  it("an uncrossed save migrates with no entry and stays formatVersion 1", async () => {
    const shared = makeSharedRows();
    const { uncrossed } = await savesOnOldEpochs(shared);
    const { store } = migratingStore(shared);

    const loaded = await store.loadGame(uncrossed);
    const state = storedState(shared.rows.get(loaded.sessionId));
    expect(state.campaignVersion).toBe("4");
    expect(state.formatVersion).toBe(1);
    expect(state.actionLog).toEqual([{ seq: 0, actionId: "increment" }]);
  });

  it("a migration that changes only kindVersion appends nothing", async () => {
    const shared = makeSharedRows();
    const { crossed } = await savesOnOldEpochs(shared);
    const kind: Kind<TestKindState> = {
      ...makeEpochKind(),
      version: "2.0.0",
      migrateState: (oldState) => ({ ok: true, value: oldState as TestKindState, errors: [], warnings: [] }),
    };
    const { store } = makeEpochStore({
      kind,
      persistence: shared.persistence,
      initial: EPOCH_V2,
      publish: [EPOCH_V1],
      recordIds: prefixedRecordIds("later"),
    });

    const loaded = await store.loadGame(crossed);
    const row = shared.rows.get(loaded.sessionId);
    expect(row!.replayCompatible).toBe(false);
    const state = storedState(row);
    expect(state.campaignVersion).toBe("2");
    expect(state.formatVersion).toBe(2);
    expect(state.actionLog).toEqual([
      { seq: 0, actionId: "increment" },
      { seq: 1, system: "content", from: "1", to: "2" },
    ]);
  });
});

/** A session that moved onto v2 between two actions: `[a0, c1 1→2, a2]`, with the stored blob
 *  after the adoption and after the last action. */
async function crossedSource(shared: ReturnType<typeof makeSharedRows>) {
  const channel = recordingChannel(undefined);
  const { store } = makeEpochStore({ channel, persistence: shared.persistence, recordIds: prefixedRecordIds("source") });
  const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
  channel.offer = "2";
  await store.submitAction(sessionId, "increment");
  const adoptedBlob = shared.rows.get(sessionId)!.blob;
  channel.offer = undefined;
  await store.submitAction(sessionId, "increment");
  const finalBlob = shared.rows.get(sessionId)!.blob;
  return { store, channel, sessionId, adoptedBlob, finalBlob };
}

/** What a session that never adopted stores after `increments` actions — on v1, from the same
 *  counting ids, so the same gameId and seed. */
async function neverAdoptedBlob(increments: number): Promise<string> {
  const shared = makeSharedRows();
  const { store } = makeEpochStore({ persistence: shared.persistence });
  const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
  for (let i = 0; i < increments; i += 1) await store.submitAction(sessionId, "increment");
  return shared.rows.get(sessionId)!.blob;
}

describe("S134.3 / S134.5 — a branch replays across an adoption, byte-identically", () => {
  it("every fork point reproduces the source's prefix exactly, either side of the content entry", async () => {
    const shared = makeSharedRows();
    const { store, sessionId, adoptedBlob, finalBlob } = await crossedSource(shared);
    const blobAt = async (n: number) => shared.rows.get((await store.branchSession(sessionId, n)).sessionId)!.blob;

    expect(await blobAt(3)).toBe(finalBlob);
    expect(await blobAt(2)).toBe(adoptedBlob);
    // A fork before the adoption starts, and stays, on the old epoch.
    expect(await blobAt(1)).toBe(await neverAdoptedBlob(1));
    expect(await blobAt(0)).toBe(await neverAdoptedBlob(0));
  });

  it("a branch reaches its own adoption point in its first write", async () => {
    const shared = makeSharedRows();
    const { store, channel, sessionId, adoptedBlob } = await crossedSource(shared);
    channel.offer = "2";
    const before = shared.sessionPuts;

    const branch = await store.branchSession(sessionId, 1);
    expect(shared.sessionPuts - before).toBe(1);
    expect(branch.scene.body.textKey).toBe("scene.v2");
    expect(shared.rows.get(branch.sessionId)!.blob).toBe(adoptedBlob);
  });

  it("atActionCount counts entries of every type", async () => {
    const shared = makeSharedRows();
    const { store, sessionId } = await crossedSource(shared);
    await expect(store.branchSession(sessionId, 4)).rejects.toMatchObject({ operation: "branchSession", code: "invalid_fork_point" });
  });
});

describe("S134.4 — a branch that cannot be reproduced refuses, with nothing written", () => {
  it("invalid_state for a log carrying a migration entry, whatever the record says", async () => {
    const shared = makeSharedRows();
    const { store, engine } = makeEpochStore({ persistence: shared.persistence });
    const created = engine.createGame({ campaignId: "test-campaign", seed: "s" }, "2");
    const migrated = {
      ...created.value!,
      formatVersion: 2,
      actionLog: [{ seq: 0, system: "migration" as const, from: "1", to: "2" }],
    };
    shared.rows.set("migrated", {
      sessionId: "migrated",
      blob: engine.serialize(migrated),
      audience: "player",
      attemptCounter: 0,
      revision: 0,
      replayCompatible: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(store.branchSession("migrated", 0)).rejects.toMatchObject({ operation: "branchSession", code: "invalid_state" });
    expect(shared.sessionPuts).toBe(0);
  });

  it("invalid_state for a recorded adoption the kind now refuses; a fork before it still branches", async () => {
    const shared = makeSharedRows();
    const { sessionId } = await crossedSource(shared);
    const refusing: Kind<TestKindState> = { ...makeEpochKind(), adoptContent: () => ({ adopt: false, reason: "content_incompatible" }) };
    const { store } = makeEpochStore({ kind: refusing, persistence: shared.persistence, recordIds: prefixedRecordIds("later") });
    const before = shared.sessionPuts;

    await expect(store.branchSession(sessionId, 2)).rejects.toMatchObject({ operation: "branchSession", code: "invalid_state" });
    expect(shared.sessionPuts).toBe(before);
    await expect(store.branchSession(sessionId, 1)).resolves.toMatchObject({ scene: { body: { textKey: "scene.v1" } } });
  });

  it("unknown_campaign when the starting version is no longer held", async () => {
    const shared = makeSharedRows();
    const { sessionId } = await crossedSource(shared);
    const { store } = makeEpochStore({ persistence: shared.persistence, initial: EPOCH_V2, publish: [], recordIds: prefixedRecordIds("later") });
    const before = shared.sessionPuts;

    await expect(store.branchSession(sessionId, 3)).rejects.toMatchObject({ operation: "branchSession", code: "unknown_campaign" });
    await expect(store.branchSession(sessionId, 0)).rejects.toMatchObject({ operation: "branchSession", code: "unknown_campaign" });
    expect(shared.sessionPuts).toBe(before);
  });

  it("unknown_campaign when a retained adoption's version is no longer held; a fork before it still branches", async () => {
    const shared = makeSharedRows();
    const channel = recordingChannel(undefined);
    const source = makeEpochStore({ channel, persistence: shared.persistence, recordIds: prefixedRecordIds("source") });
    const { sessionId } = await source.store.createSession({ campaignId: "test-campaign" });
    channel.offer = "2";
    await source.store.submitAction(sessionId, "increment");
    channel.offer = "1";
    await source.store.submitAction(sessionId, "increment");
    expect(storedState(shared.rows.get(sessionId)).actionLog.map((entry) => entry.to ?? entry.actionId)).toEqual([
      "increment",
      "2",
      "increment",
      "1",
    ]);

    const { store } = makeEpochStore({ persistence: shared.persistence, initial: EPOCH_V1, publish: [], recordIds: prefixedRecordIds("later") });
    const before = shared.sessionPuts;
    await expect(store.branchSession(sessionId, 4)).rejects.toMatchObject({ operation: "branchSession", code: "unknown_campaign" });
    await expect(store.branchSession(sessionId, 2)).rejects.toMatchObject({ operation: "branchSession", code: "unknown_campaign" });
    expect(shared.sessionPuts).toBe(before);
    await expect(store.branchSession(sessionId, 1)).resolves.toMatchObject({ scene: { body: { textKey: "scene.v1" } } });
  });
});
