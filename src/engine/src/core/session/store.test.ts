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

function makeStore(overrides?: { engine?: Engine; recordSink?: EmittedRecordSink }) {
  const registry = makeRegistry();
  return createInMemorySessionStore({
    engine: overrides?.engine ?? makeEngine({ registry }),
    registry,
    ...(overrides?.recordSink ? { recordSink: overrides.recordSink } : {}),
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
