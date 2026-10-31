/**
 * W104.1 / W104.3 — the compatibility sweep's representative active/ended save per kind
 * (`fixtures/saves/*.json`, captured by `capture-save-fixtures.ts`) still `loadGame`s through
 * a real `SessionStore`, reaching the same projection an independent re-run of the same
 * fixture's own action log reaches — and does so with no migration (20-contract.md:
 * no shipped campaign has moved version yet, so every one of these loads on the no-migration
 * branch; `envelope.test.ts` already proves the migration branch itself against a synthetic
 * kind/campaign).
 *
 * The negative half — a tampered blob is rejected and never reaches the session cache —
 * is exercised once, against a real fixture rather than a synthetic one, for "no partial
 * write on failure" (W104.3).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createEngine } from "../src/core/kernel/engine.js";
import { createInMemorySessionStore } from "../src/core/session/store.js";
import { TextClient } from "../src/clients/text/client.js";
import { actionSubmissions, loadFixture } from "../src/campaigns/replay-corpus.js";
import { SessionStoreError } from "../src/core/session/types.js";
import type { SaveRecordStore, SessionRecordStore, StoredSaveRecord, StoredSessionRecord } from "../src/core/session/types.js";
import { SAVE_FIXTURES, buildRegistry } from "./capture-save-fixtures.js";

const FIXED_IDS = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));

function loadSaveBlob(name: string): string {
  return readFileSync(`${FIXTURES_DIR}${name}.json`, "utf8").trim();
}

function saveRecordStoreWith(blob: string, campaignId: string): SaveRecordStore {
  const record: StoredSaveRecord = { saveId: "w104", campaignId, blob, savedAt: "2026-01-01T00:00:00.000Z", savedAtSeq: 0, audience: "player" };
  const map = new Map([[record.saveId, record]]);
  return {
    async get(saveId) { return map.get(saveId); },
    async put(next) { map.set(next.saveId, next); },
    async listByProfile() { return [...map.values()]; },
    async delete(saveId) { map.delete(saveId); },
  };
}

function emptySessionRecordStore(): SessionRecordStore {
  const map = new Map<string, StoredSessionRecord>();
  return {
    async get(sessionId) { return map.get(sessionId); },
    async put(record) { map.set(record.sessionId, record); },
  };
}

describe("W104.3 — representative saves load through a real SessionStore", () => {
  it.each(SAVE_FIXTURES)("$name: loadGame reaches the same scene an independent re-run of its own fixture reaches", async (entry) => {
    const blob = loadSaveBlob(entry.name);
    const { kinds, registry } = buildRegistry(entry.kindId);

    // Independent re-run: same registry, a fresh engine/store, driven through the fixture's
    // own submissions from scratch — not the save at all.
    const fixture = loadFixture(entry.fixtureName);
    const independentStore = createInMemorySessionStore({
      engine: createEngine({ kinds, registry, ids: FIXED_IDS }),
      registry,
    });
    const independentClient = new TextClient(independentStore);
    const started = await independentClient.createSession(fixture.config);
    const sessionId = started.value.sessionId;
    for (const submission of actionSubmissions(fixture)) {
      await independentClient.submitAction(sessionId, submission.actionId, submission.params);
    }
    const expectedScene = (await independentClient.getScene(sessionId)).value;

    // The save path: loadGame against the committed blob, through a second, independent store.
    const parsed = JSON.parse(blob) as { campaignId: string; replayCompatible: boolean };
    const loadStore = createInMemorySessionStore({
      engine: createEngine({ kinds, registry, ids: FIXED_IDS }),
      registry,
      persistence: { sessions: emptySessionRecordStore(), saves: saveRecordStoreWith(blob, parsed.campaignId) },
    });
    const loadClient = new TextClient(loadStore);
    const loaded = await loadClient.loadGame("w104");

    expect(loaded.value.scene).toEqual(expectedScene);
    // No shipped campaign has moved version (20-contract.md), so every one of these loads
    // on the no-migration branch: the blob's own `replayCompatible` (always `true` — these
    // fixtures were captured fresh, never migrated) must survive unchanged.
    expect(parsed.replayCompatible).toBe(true);
  });

  it("a tampered checksum is rejected, and the session cache holds nothing afterward (no partial write)", async () => {
    const entry = SAVE_FIXTURES[0]!;
    const blob = loadSaveBlob(entry.name);
    const tampered = blob.replace(/"checksum":"[0-9a-f]+"/, '"checksum":"0000000000000000000000000000000000000000000000000000000000000000"');
    expect(tampered).not.toBe(blob);

    const { kinds, registry } = buildRegistry(entry.kindId);
    const parsed = JSON.parse(blob) as { campaignId: string };
    const store = createInMemorySessionStore({
      engine: createEngine({ kinds, registry, ids: FIXED_IDS }),
      registry,
      persistence: { sessions: emptySessionRecordStore(), saves: saveRecordStoreWith(tampered, parsed.campaignId) },
    });
    const client = new TextClient(store);

    await expect(client.loadGame("w104")).rejects.toBeInstanceOf(SessionStoreError);

    // No partial write: no session was ever created from the rejected load, so every
    // sessionId is still unknown.
    await expect(store.getScene("any-session-id")).rejects.toBeInstanceOf(SessionStoreError);
  });
});

/**
 * S136 — simulation's `advance` now refuses a `params` key 10 §4 does not declare. That narrows
 * what the kind accepts without touching state shape, so `kindVersion` stays `1.1.0` and a save
 * written before the change must still load, stay `replayCompatible`, re-run, and play on
 * (S136.7). The one log it cannot re-run is one that already carries an undeclared key, and
 * `branchSession` must say so with a typed `invalid_state`, writing nothing (S136.8).
 */
describe("S136 — simulation saves under acceptance-is-declaration", () => {
  const entry = SAVE_FIXTURES.find((candidate) => candidate.name === "simulation-active")!;

  /** Stores over one set of rows; `open()` is a later process reading what an earlier one wrote. */
  function rowsOverSimulationSave(): { open: () => ReturnType<typeof createInMemorySessionStore>; rows: Map<string, StoredSessionRecord>; puts: () => number; engine: ReturnType<typeof createEngine> } {
    const blob = loadSaveBlob(entry.name);
    const { kinds, registry } = buildRegistry(entry.kindId);
    const rows = new Map<string, StoredSessionRecord>();
    const saves = saveRecordStoreWith(blob, (JSON.parse(blob) as { campaignId: string }).campaignId);
    let puts = 0;
    const engine = createEngine({ kinds, registry, ids: FIXED_IDS });
    const open = () => createInMemorySessionStore({
      engine,
      registry,
      persistence: {
        sessions: {
          async get(sessionId) { return rows.get(sessionId); },
          async put(record) { puts += 1; rows.set(record.sessionId, record); },
        },
        saves,
      },
    });
    return { open, rows, puts: () => puts, engine };
  }

  it("S136.7 — a 1.1.0 save from before the change loads replayCompatible, re-runs whole, and plays on", async () => {
    const parsed = JSON.parse(loadSaveBlob(entry.name)) as { kindVersion: string; state: { actionLog: unknown[] } };
    expect(parsed.kindVersion).toBe("1.1.0");
    const { open, rows } = rowsOverSimulationSave();
    const store = open();

    const loaded = await store.loadGame("w104");
    expect(rows.get(loaded.sessionId)!.replayCompatible).toBe(true);
    await expect(store.branchSession(loaded.sessionId, parsed.state.actionLog.length)).resolves.toBeDefined();
    expect((await store.submitAction(loaded.sessionId, "plan.add", { actionType: "rest" })).ok).toBe(true);
  });

  it("S136.8 — branchSession over a retained action the kind now refuses throws invalid_state, writing nothing", async () => {
    const { open, rows, puts, engine } = rowsOverSimulationSave();
    const loaded = await open().loadGame("w104");

    // Hand-build the log a pre-S136 client could have left: the first planned action carries a
    // key `enroll_course` never declared. Written straight into the row, as an older build would have.
    const row = rows.get(loaded.sessionId)!;
    const state = engine.deserialize(row.blob);
    if (!state.ok || !state.value) throw new Error("expected the loaded row to deserialize");
    const tampered = structuredClone(state.value);
    const first = tampered.actionLog[0] as { params?: Record<string, unknown> };
    first.params = { ...first.params, amountCents: 5000 };
    rows.set(loaded.sessionId, { ...row, blob: engine.serialize(tampered) });
    const before = puts();
    const store = open();

    await expect(store.branchSession(loaded.sessionId, 2)).rejects.toMatchObject({ operation: "branchSession", code: "invalid_state" });
    expect(puts()).toBe(before);
    // A fork before the refused entry retains none of it, and still branches.
    await expect(store.branchSession(loaded.sessionId, 0)).resolves.toBeDefined();
  });
});
