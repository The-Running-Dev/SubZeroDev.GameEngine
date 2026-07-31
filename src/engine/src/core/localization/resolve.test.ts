import { describe, it, expect } from "vitest";
import { resolveLocKey } from "./resolve.js";
import { buildContentRegistry } from "../registry/build.js";
import type { Campaign } from "../registry/types.js";

describe("resolveLocKey", () => {
  it("returns the string for a present key", () => {
    const strings = new Map([["choice.go", "Go."]]);
    expect(resolveLocKey(strings, "choice.go")).toBe("Go.");
  });

  it("returns undefined for an absent key", () => {
    const strings = new Map([["choice.go", "Go."]]);
    expect(resolveLocKey(strings, "choice.missing")).toBeUndefined();
  });

  it("round-trips through a buildContentRegistry result", () => {
    const campaign: Campaign = {
      id: "test-campaign",
      kindId: "story-graph",
      version: "1",
      titleKey: "test.title",
      content: {},
    };
    const result = buildContentRegistry([{ campaign, strings: new Map([["choice.go", "Go."]]) }]);
    expect(result.ok).toBe(true);
    expect(resolveLocKey(result.value?.strings ?? new Map(), "choice.go")).toBe("Go.");
    expect(resolveLocKey(result.value?.strings ?? new Map(), "core.reason.unknown_action")).toBeTypeOf("string");
  });
});
