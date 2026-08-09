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
 *
 * W64's adventure-builder rewrite replaced the MVP campaign's `office_visits >= 3` loop
 * gate with three separate linear routes — no node in the current graph is revisited
 * within one playthrough, so there is no climbing count to read. What 03 §8.4 still
 * guarantees generically is that every `node.entered` event carries its own `visitCount`
 * (05-observability.md §8), so this suite reads that off a real node instead of a loop.
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

// Same seed the committed replay corpus uses — its first weighted pick at both
// registry_route_event_1 and registry_route_event_2 lands on the "a" branch.
const SEED = "bureaucracy-seed-1";

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

describe("jsonl sink at trace — a node's visit count and a random transition's pick are both readable", () => {
  it("plays the registry route to its ending and finds both in the parsed stream", async () => {
    const lines: string[] = [];
    const store = buildJsonlStore(lines);

    const created = await store.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    await store.submitAction(created.sessionId, "wait");
    await store.submitAction(created.sessionId, "registry_route_listen");
    await store.submitAction(created.sessionId, "registry_route_event_1a_proceed");
    await store.submitAction(created.sessionId, "registry_route_prepare");
    await store.submitAction(created.sessionId, "registry_route_event_2a_proceed");
    await store.submitAction(created.sessionId, "registry_route_steady");
    await store.submitAction(created.sessionId, "choose_document_obtained");

    expect(lines.length).toBeGreaterThan(0);
    // Every line is a real, independently JSON.parse-able record — the format a human
    // (or a log pipeline) would actually read, not an in-memory array of objects.
    const records: EmittedRecord[] = lines.map((line) => JSON.parse(line) as EmittedRecord);

    // Both random transitions' picks — this seed's weighted draw takes the "a" branch
    // each time, matching the committed replay fixture's own action sequence above.
    const picks = records.filter((r) => r.event.name === "kind.story-graph.random.picked");
    expect(picks.map((r) => (r.event as GameEvent).data)).toEqual([
      expect.objectContaining({ nodeId: "registry_route_event_1", goto: "registry_route_event_1a" }),
      expect.objectContaining({ nodeId: "registry_route_event_2", goto: "registry_route_event_2a" }),
    ]);

    // A node's own visit count, readable straight off its `node.entered` event — the
    // generic guarantee 03 §8.4 makes, independent of whether this particular campaign
    // revisits a node within one playthrough.
    const enteredFinalNode = records
      .map((r) => (r.event as GameEvent))
      .find((event) => event.name === "kind.story-graph.node.entered" && (event.data as { nodeId?: string }).nodeId === "ending_document_obtained");
    expect(enteredFinalNode).toBeDefined();
    expect((enteredFinalNode!.data as { visitCount: number }).visitCount).toBe(1);
  });
});
