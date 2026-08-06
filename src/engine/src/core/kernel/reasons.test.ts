import { describe, it, expect } from "vitest";
import { BASE_REASON_CODES, CORE_REASON_MESSAGES } from "./reasons.js";

describe("CORE_REASON_MESSAGES", () => {
  it("has a core.reason.<code> entry for every base code", () => {
    for (const code of BASE_REASON_CODES) {
      expect(CORE_REASON_MESSAGES.get(`core.reason.${code}`)).toBeTypeOf("string");
    }
  });

  it("has no empty message", () => {
    for (const text of CORE_REASON_MESSAGES.values()) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("has exactly one entry per base code — no extras, no gaps", () => {
    expect(CORE_REASON_MESSAGES.size).toBe(BASE_REASON_CODES.length);
  });

  it("resolves the reason the achievement-unlock StateChange carries (04 §12)", () => {
    // `kinds/story-graph/achievements.ts` emits `reason: "achievement_unlocked"` with
    // `visible: true`, and `session/store.ts` switches on it kind-agnostically — so it is
    // base vocabulary, and a client must be able to look its message up.
    expect(BASE_REASON_CODES).toContain("achievement_unlocked");
    expect(CORE_REASON_MESSAGES.get("core.reason.achievement_unlocked")).toBeTypeOf("string");
  });
});
