import { describe, expect, it } from "vitest";
import { WORLD_GRAPH_REASON_CODES, WORLD_GRAPH_REASON_MESSAGES } from "./reasons.js";

// The two kind-owned alert families' title/message strings (12 §4.21/W85) merge into this
// same map — see reasons.ts's own doc comment — so "no key beyond the declared codes" no
// longer holds; this is the explicit, counted exception.
const WORLD_GRAPH_ALERT_KEYS = [
  "world-graph.alert.building-broken.title",
  "world-graph.alert.building-broken.message",
  "world-graph.alert.scenario-resolved.title",
  "world-graph.alert.scenario-resolved.message",
];

describe("WORLD_GRAPH_REASON_MESSAGES", () => {
  it("has a non-empty message for every declared code", () => {
    for (const code of WORLD_GRAPH_REASON_CODES) {
      const message = WORLD_GRAPH_REASON_MESSAGES.get(`world-graph.reason.${code}`);
      expect(message, code).toBeTypeOf("string");
      expect(message?.length, code).toBeGreaterThan(0);
    }
  });

  it("carries no key beyond the declared codes and the kind-owned alert strings", () => {
    expect(WORLD_GRAPH_REASON_MESSAGES.size).toBe(WORLD_GRAPH_REASON_CODES.length + WORLD_GRAPH_ALERT_KEYS.length);
  });

  it("has a non-empty message for every kind-owned alert key", () => {
    for (const key of WORLD_GRAPH_ALERT_KEYS) {
      const message = WORLD_GRAPH_REASON_MESSAGES.get(key);
      expect(message, key).toBeTypeOf("string");
      expect(message?.length, key).toBeGreaterThan(0);
    }
  });
});
