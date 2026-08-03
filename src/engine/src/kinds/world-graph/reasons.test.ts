import { describe, expect, it } from "vitest";
import { WORLD_GRAPH_REASON_CODES, WORLD_GRAPH_REASON_MESSAGES } from "./reasons.js";

describe("WORLD_GRAPH_REASON_MESSAGES", () => {
  it("has a non-empty message for every declared code", () => {
    for (const code of WORLD_GRAPH_REASON_CODES) {
      const message = WORLD_GRAPH_REASON_MESSAGES.get(`world-graph.reason.${code}`);
      expect(message, code).toBeTypeOf("string");
      expect(message?.length, code).toBeGreaterThan(0);
    }
  });

  it("carries no key beyond the declared codes", () => {
    expect(WORLD_GRAPH_REASON_MESSAGES.size).toBe(WORLD_GRAPH_REASON_CODES.length);
  });
});
