import { describe, expect, test } from "vitest";

describe("W0 red-path proof — deliberate, reverted before merge", () => {
  test("intentionally fails to prove CI goes red", () => {
    expect(true).toBe(false);
  });
});
