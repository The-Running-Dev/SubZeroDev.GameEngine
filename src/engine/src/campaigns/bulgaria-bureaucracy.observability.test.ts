/**
 * The `jsonl` sink played against the real campaign (`MVP.md` §5, "Observable" —
 * "Playing the arc with the `jsonl` sink at `trace` yields a stream in which the
 * Bureaucracy gate's visit counts and the random transition's pick are both readable").
 *
 * Distinct from `bulgaria-bureaucracy.determinism.test.ts`'s event-stream golden file:
 * that proves the stream doesn't *change* unexpectedly; this proves a human reading the
 * stream can actually *diagnose* the two things 03 §8.4 names the events for — nothing
 * here is severity-filtered, so `jsonlEmitter` (unlike `recordingEmitter` in the other
 * suite) is the sink a real deployment would point at a log file.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { jsonlEmitter } from "../core/observability/emitter.js";
import type { EmittedRecord, GameEvent } from "../core/observability/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { SessionStore } from "../core/session/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";

// The scan-verified seed whose first weighted pick at clerk_review (3 expired : 1 room_14)
// lands on room_14 — see plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md.
const SEED = "bureaucracy-seed-3";

/** Every emitted record, as `jsonlEmitter` would actually write it: one JSON line each,
 *  nothing severity-filtered — `trace`-level `settle.step` events included. */
function buildJsonlStore(lines: string[]): SessionStore {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the real campaign to validate");

  const engine = createEngine({ kinds, registry: registryResult.value });
  return createInMemorySessionStore({
    engine,
    registry: registryResult.value,
    recordSink: jsonlEmitter((line) => lines.push(line)),
  });
}

describe("jsonl sink at trace — the Bureaucracy gate's visit counts and the random pick are both readable", () => {
  it("plays wait, continue_cycle x2, go_home and finds both in the parsed stream", async () => {
    const lines: string[] = [];
    const store = buildJsonlStore(lines);

    const created = await store.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    await store.submitAction(created.sessionId, "wait");
    await store.submitAction(created.sessionId, "continue_cycle");
    await store.submitAction(created.sessionId, "continue_cycle");
    await store.submitAction(created.sessionId, "go_home");

    expect(lines.length).toBeGreaterThan(0);
    // Every line is a real, independently JSON.parse-able record — the format a human
    // (or a log pipeline) would actually read, not an in-memory array of objects.
    const records: EmittedRecord[] = lines.map((line) => JSON.parse(line) as EmittedRecord);

    // The random transition's pick.
    const pick = records.find((r) => r.event.name === "kind.story-graph.random.picked");
    expect(pick).toBeDefined();
    expect((pick!.event as GameEvent).data).toMatchObject({ nodeId: "clerk_review", goto: "room_14" });

    // The gate's visit counts: room_14's own visitCount is what office_visits tracks 1:1
    // in this campaign (room_14's effect increments it once per entry), so its climb to 3
    // across the arc is the readable signal a diagnosing developer would look for.
    const room14VisitCounts = records
      .filter((r) => r.event.name === "kind.story-graph.node.entered")
      .map((r) => (r.event as GameEvent).data as { nodeId: string; visitCount: number } | undefined)
      .filter((data): data is { nodeId: string; visitCount: number } => data?.nodeId === "room_14")
      .map((data) => data.visitCount);
    expect(room14VisitCounts).toEqual([1, 2, 3]);
  });
});
