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
import type { EngineHost } from "../composition/types.js";
import { jsonlEmitter } from "../observability/emitter.js";
import type { EmittedRecord, EmittedRecordSink } from "../observability/types.js";
import { createInMemoryProfileStore } from "./profile-store.js";
import type { ProfileStore } from "./types.js";

interface TestKindState {
  counter: number;
}

function makeTestKind(): Kind<TestKindState> {
  return {
    id: "story-graph",
    reasonCodes: [],
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
    outcome: (state) => ({ counter: state.counter }),
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

function makeStore(overrides?: { engine?: Engine; recordSink?: EmittedRecordSink; profiles?: ProfileStore }) {
  const registry = makeRegistry();
  return createInMemorySessionStore({
    engine: overrides?.engine ?? makeEngine({ registry }),
    registry,
    ...(overrides?.recordSink ? { recordSink: overrides.recordSink } : {}),
    ...(overrides?.profiles ? { profiles: overrides.profiles } : {}),
  });
}

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

  it("listCampaigns summarizes the registry", () => {
    const store = makeStore();
    expect(store.listCampaigns()).toEqual([{ campaignId: "test-campaign", kindId: "story-graph", titleKey: "test.title" }]);
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
});

describe("same-session concurrency", () => {
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
    const store = makeStore();
    const created = await store.createSession({ campaignId: "test-campaign" });
    const scene = await store.getScene(created.sessionId);
    const view = await store.getView(created.sessionId);
    const strings = await store.getStrings(created.sessionId);
    const actionResult = await store.submitAction(created.sessionId, "increment");
    const saveHandle = await store.saveGame(created.sessionId);
    const loaded = await store.loadGame(saveHandle.saveId);

    const blob = JSON.stringify([created, scene, view, strings, actionResult, saveHandle, loaded, store.listCampaigns()]);
    // "savedAtSeq" (SaveHandle's own field) is legitimate and deliberately excluded from
    // this list — everything below would only appear via a host-metadata leak.
    for (const forbidden of ["ownerId", "createdAt", "emittedAt", "traceId", "spanId", "\"attempt\""]) {
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

  it("no profileId means no read and no write — the ProfileStore is never called", async () => {
    let loadCalls = 0;
    let saveCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 1, profileId, achievements: [] }, warnings: [] };
      },
      save: async () => {
        saveCalls += 1;
        return { ok: true, warnings: [] };
      },
    };
    const store = makeStore({ profiles: spyProfiles });
    const { sessionId } = await store.createSession({ campaignId: "test-campaign" }); // no profileId
    await store.submitAction(sessionId, "unlock-first-count");

    expect(loadCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it("an action with no achievement-unlock changes never touches the ProfileStore", async () => {
    let loadCalls = 0;
    const spyProfiles: ProfileStore = {
      load: async (profileId) => {
        loadCalls += 1;
        return { profile: { formatVersion: 1, profileId, achievements: [] }, warnings: [] };
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
