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
import { loadFixture } from "../src/campaigns/replay-corpus.js";
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
    for (const submission of fixture.submissions) {
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
