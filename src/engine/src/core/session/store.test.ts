import { describe, it, expect } from "vitest";
import { createEngine } from "../kernel/engine.js";
import { createInMemorySessionStore } from "./store.js";
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
    let writeCount = 0;
    // Snapshotted, not captured by reference: the store mutates its cached record in place,
    // so holding the object would show later state rather than what this write carried.
    const written: StoredSessionRecord[] = [];
    const store = makeStore({
      persistence: persistenceWith({
        sessions: {
          get: async () => undefined,
          put: async (record) => {
            writeCount += 1;
            // createSession's write (1) succeeds; submitAction's write (2) is the conflict.
            if (writeCount === 2) throw { name: SESSION_PERSISTENCE_CONFLICT };
            written.push({ ...record });
          },
        },
      }),
    });

    const { sessionId } = await store.createSession({ campaignId: "test-campaign" });
    await expect(store.submitAction(sessionId, "increment")).rejects.toMatchObject({
      code: "concurrent_modification",
    });

    const scene = await store.getScene(sessionId);
    expect(scene.body.text).toBe("counter=0");

    // Every field the refused `put` carried is rolled back, not just the blob. The counter
    // is the one that is only observable on the next accepted write: had the conflict left
    // it raised, this submission would persist `2` for its first surviving attempt.
    const result = await store.submitAction(sessionId, "increment");
    expect(result.ok).toBe(true);
    expect(written.at(-1)).toMatchObject({ attemptCounter: 1 });
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
      const store = makeStore({
        persistence: persistenceWith({ saves: { delete: async () => { throw conflict; } } }),
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

    it("unknown_campaign — the source's campaignVersion is no longer registered", async () => {
      const campaigns = new Map([["test-campaign", makeCampaign({ version: "1" })]]);
      const mutableRegistry: ContentRegistry = { campaigns, strings: makeRegistry().strings };
      const store = createInMemorySessionStore({ engine: makeEngine({ registry: mutableRegistry }), registry: mutableRegistry });
      const { sessionId } = await store.createSession({ campaignId: "test-campaign" });

      campaigns.set("test-campaign", makeCampaign({ version: "2" }));

      await expect(store.branchSession(sessionId, 0)).rejects.toMatchObject({
        operation: "branchSession",
        code: "unknown_campaign",
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
