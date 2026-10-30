import { describe, it, expect } from "vitest";
import { aliasOf, createResponseAliases } from "./aliases.js";
import { createEngine } from "./engine.js";
import type { AdvanceResult, InitialStateResult, Kind, KindRegistry } from "./types.js";
import { createContentArchive, epochDigest, type ContentChannel, type EpochForm, type StoredEpoch } from "../registry/archive.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import { createInMemorySessionStore, createSessionLayer } from "../session/store.js";
import type { SessionPersistence, StoredSessionRecord } from "../session/types.js";

// C29 (20-contract §7, 10-design 06 §4 and 16 §5.7): engine-owned keys reach a response under
// an alias only where an authored key could shadow them, and never reach state.

describe("C29 — the alias form", () => {
  it("is ~k, else ~n~k for the smallest positive n whose form no authored key takes", () => {
    expect(aliasOf("k", new Set())).toBe("~k");
    expect(aliasOf("k", new Set(["k"]))).toBe("~k");
    expect(aliasOf("k", new Set(["~k"]))).toBe("~1~k");
    expect(aliasOf("k", new Set(["~k", "~1~k"]))).toBe("~2~k");
    expect(aliasOf("k", new Set(["~k", "~2~k"]))).toBe("~1~k");
  });

  it("aliases only a key the running catalog owns, in either mode", () => {
    const catalog = new Map([["engine.key", "Engine"]]);
    const all = createResponseAliases("all", catalog, () => new Set());
    expect(all.engineRef("engine.key")).toBe("~engine.key");
    expect(all.engineRef("content.key")).toBe("content.key");
    const colliding = createResponseAliases("colliding", catalog, () => new Set(["engine.key", "content.key"]));
    expect(colliding.engineRef("engine.key")).toBe("~engine.key");
    expect(colliding.engineRef("content.key")).toBe("content.key");
    expect(createResponseAliases("colliding", catalog, () => new Set()).engineRef("engine.key")).toBe("engine.key");
  });

});

// ── A restored epoch that authors a key the running engine owns ──

const ENGINE_KEY = "story-graph.reason.new";

interface Counter {
  counter: number;
}

/** Reports `ENGINE_KEY` as its blocked action's reason and its one outcome message. */
function testKind(catalog: [string, string][]): Kind<Counter> {
  return {
    id: "story-graph",
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(catalog),
    eventNames: [],
    initialState: (): InitialStateResult<Counter> => ({ state: { counter: 0 }, status: "active", changes: [], messages: [] }),
    availableActions: (_state, ctx) => [
      { id: "increment", labelKey: "test.increment", available: true },
      { id: "blocked", labelKey: "test.blocked", available: false, reasonKey: ctx.engineRef(ENGINE_KEY) },
    ],
    scene: () => ({ textKey: "test.scene", text: "scene" }),
    advance: (state): AdvanceResult<Counter> => ({
      state: { counter: state.counter + 1 },
      status: "active",
      changes: [],
      messages: [{ key: ENGINE_KEY, visible: true }],
    }),
    project: (state) => ({ counter: state.counter }),
    validateState: () => true,
    outcome: () => ({ terminal: false, terminalId: null }),
    validateCampaign: () => ({ ok: true, errors: [], warnings: [] }),
  };
}

const owning = { "story-graph": testKind([[ENGINE_KEY, "Engine text"]]) } as unknown as KindRegistry;
const older = { "story-graph": testKind([]) } as unknown as KindRegistry;

function campaign(version: string): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version, titleKey: "test.title", content: {} };
}

function registry(version: string, strings: [string, string][] = [["test.title", "Test"]]): ContentRegistry {
  const table = new Map(strings);
  return {
    campaigns: new Map([["test-campaign", campaign(version)]]),
    strings: table,
    provenance: new Map([["test-campaign", { strings: table, attachments: [] }]]),
  };
}

/** Version 2, published by an engine whose catalog did not yet own `ENGINE_KEY`. */
function publishedByOlderEngine(): StoredEpoch {
  const source = createContentArchive({ kinds: older, initial: registry("1") });
  expect(source.publish(registry("2", [["test.title", "Test"], [ENGINE_KEY, "Authored text"]])).ok).toBe(true);
  return source.stored("test-campaign", "2")!;
}

function withAuthored(stored: StoredEpoch, key: string, text: string): StoredEpoch {
  const form = structuredClone(stored.form) as EpochForm;
  form.strings = { ...form.strings, [key]: text };
  return { form, publication: stored.publication, digest: epochDigest(form) };
}

/** Offers `version` to every new session; a test moves it once that version is held. */
const onVersion = (version: string): ContentChannel & { version: string } => {
  const channel = { version, current: () => channel.version };
  return channel;
};

/** Session rows held in a map, so a test can read what the store persisted. */
function rowsPersistence(rows: Map<string, StoredSessionRecord>): SessionPersistence {
  return {
    sessions: { get: async (id) => rows.get(id), put: async (record) => void rows.set(record.sessionId, record) },
    saves: { get: async () => undefined, put: async () => {}, listByProfile: async () => [], delete: async () => {} },
  };
}

function compose(channel?: ContentChannel) {
  const initial = registry("1");
  const rows = new Map<string, StoredSessionRecord>();
  const archive = createContentArchive({ kinds: owning, initial });
  const engine = createEngine({ kinds: owning, registry: initial, archive, ids: { newGameId: () => "g", newSeed: () => "s" } });
  const store = createSessionLayer({ engine, registry: initial, persistence: rowsPersistence(rows), ...(channel ? { content: channel } : {}) });
  return { archive, engine, store, rows };
}

const blockedReason = (actions: readonly { id: string; reasonKey?: string }[]) => actions.find((action) => action.id === "blocked")?.reasonKey;

describe("C29 — a colliding engine key answers under its alias", () => {
  it("is unaliased while no authored key equals it, and ~k once a restore brings one in", async () => {
    const channel = onVersion("1");
    const { archive, store } = compose(channel);
    const before = await store.createSession({ campaignId: "test-campaign" });
    expect(blockedReason(before.scene.actions)).toBe(ENGINE_KEY);

    expect(archive.restore(publishedByOlderEngine())).toMatchObject({ outcome: "restored", warnings: [{ code: "historical_string_collision" }] });
    channel.version = "2";

    const { sessionId, scene } = await store.createSession({ campaignId: "test-campaign" });
    expect(blockedReason(scene.actions)).toBe(`~${ENGINE_KEY}`);
    expect((await store.submitAction(sessionId, "increment")).messages.map((message) => message.key)).toEqual([`~${ENGINE_KEY}`]);
    // The session that started before the restore answers with the same, archive-wide map.
    expect(blockedReason((await store.getScene(before.sessionId)).actions)).toBe(`~${ENGINE_KEY}`);

    const strings = await store.getStrings(sessionId);
    expect(strings[ENGINE_KEY]).toBe("Authored text");
    expect(strings[`~${ENGINE_KEY}`]).toBe("Engine text");
  });

  it("takes ~1~k when an authored key already holds ~k", async () => {
    const { archive, store } = compose(onVersion("2"));
    expect(archive.restore(withAuthored(publishedByOlderEngine(), `~${ENGINE_KEY}`, "Authored tilde")).outcome).toBe("restored");

    const { sessionId, scene } = await store.createSession({ campaignId: "test-campaign" });
    expect(blockedReason(scene.actions)).toBe(`~1~${ENGINE_KEY}`);
    const strings = await store.getStrings(sessionId);
    expect(strings[ENGINE_KEY]).toBe("Authored text");
    expect(strings[`~${ENGINE_KEY}`]).toBe("Authored tilde");
    expect(strings[`~1~${ENGINE_KEY}`]).toBe("Engine text");
  });

  it("leaves the stored state unaliased: the persisted blob is the same with and without the collision", async () => {
    const run = async (restore: boolean) => {
      const { archive, store, rows } = compose();
      if (restore) archive.restore(publishedByOlderEngine());
      const { sessionId } = await store.createSession({ campaignId: "test-campaign", seed: "c29" });
      await store.submitAction(sessionId, "increment");
      return rows.get(sessionId)!.blob;
    };
    expect(await run(true)).toBe(await run(false));
  });
});

describe("C29 — the session layer answers with its engine's own map (06 §4)", () => {
  it("refuses an engine createEngine did not return", () => {
    const { engine } = compose();
    expect(() => createSessionLayer({ engine: { ...engine }, registry: registry("1") })).toThrow(/06 §4/);
  });

  it("refuses one through the in-memory store too, rather than answering without aliases", () => {
    const { engine } = compose();
    expect(() => createInMemorySessionStore({ engine: { ...engine }, registry: registry("1") })).toThrow(/06 §4/);
    expect(() => createInMemorySessionStore({ engine, registry: registry("1") })).not.toThrow();
  });
});
