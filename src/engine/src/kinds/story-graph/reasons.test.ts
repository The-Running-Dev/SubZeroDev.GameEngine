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

  it("declares the runtime codes (03 §8.3, W10's unknown_condition_field), W14's Tier 1/2 validation codes, and the audit code", () => {
    expect([...STORY_GRAPH_REASON_CODES]).toEqual([
      "not_a_choice_node",
      "unexpected_params",
      "settle_guard_tripped",
      "unknown_condition_field",
      "dangling_reference",
      "undeclared_variable",
      "invalid_consequence_value",
      "duplicate_id",
      "missing_label_key",
      "non_visible_variable_in_text",
      "invalid_transition_weight",
      "unreachable_node",
      "unreachable_cycle",
      "no_reachable_choice",
      "no_reachable_ending",
      "consequence_applied",
    ]);
  });

  it("resolves the reason every consequence StateChange carries (04 §12)", () => {
    // `variables.ts` emits `reason: "consequence_applied"` with the variable's own
    // `visible`, so a visible change reaches a client that must be able to look it up.
    expect(STORY_GRAPH_REASON_CODES).toContain("consequence_applied");
    expect(STORY_GRAPH_REASON_MESSAGES.get("story-graph.reason.consequence_applied")).toBeTypeOf("string");
  });
});
