import { describe, it, expect } from "vitest";
import { STORY_GRAPH_REASON_CODES, STORY_GRAPH_REASON_MESSAGES } from "./reasons.js";

describe("STORY_GRAPH_REASON_MESSAGES", () => {
  it("has a message for every declared code, under the story-graph.reason.* namespace", () => {
    for (const code of STORY_GRAPH_REASON_CODES) {
      const message = STORY_GRAPH_REASON_MESSAGES.get(`story-graph.reason.${code}`);
      expect(message).toBeTypeOf("string");
      expect(message!.length).toBeGreaterThan(0);
    }
  });

  it("has exactly as many entries as declared codes", () => {
    expect(STORY_GRAPH_REASON_MESSAGES.size).toBe(STORY_GRAPH_REASON_CODES.length);
  });

  it("declares the three codes 03 §8.3 names, plus W10's unknown_condition_field", () => {
    expect([...STORY_GRAPH_REASON_CODES]).toEqual([
      "not_a_choice_node",
      "unexpected_params",
      "settle_guard_tripped",
      "unknown_condition_field",
    ]);
  });
});
