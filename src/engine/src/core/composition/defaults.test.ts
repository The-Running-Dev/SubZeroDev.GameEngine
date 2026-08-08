import { describe, it, expect } from "vitest";
import { defaultClock, defaultIdSource, defaultRecordIdSource } from "./defaults.js";

describe("defaultIdSource", () => {
  it("newGameId returns a non-empty string", () => {
    expect(typeof defaultIdSource.newGameId()).toBe("string");
    expect(defaultIdSource.newGameId().length).toBeGreaterThan(0);
  });

  it("newSeed returns a non-empty string", () => {
    expect(typeof defaultIdSource.newSeed()).toBe("string");
    expect(defaultIdSource.newSeed().length).toBeGreaterThan(0);
  });

  it("successive calls differ", () => {
    expect(defaultIdSource.newGameId()).not.toBe(defaultIdSource.newGameId());
    expect(defaultIdSource.newSeed()).not.toBe(defaultIdSource.newSeed());
  });
});

describe("defaultRecordIdSource", () => {
  it("newSessionId returns a non-empty string", () => {
    expect(typeof defaultRecordIdSource.newSessionId()).toBe("string");
    expect(defaultRecordIdSource.newSessionId().length).toBeGreaterThan(0);
  });

  it("newSaveId returns a non-empty string", () => {
    expect(typeof defaultRecordIdSource.newSaveId()).toBe("string");
    expect(defaultRecordIdSource.newSaveId().length).toBeGreaterThan(0);
  });

  it("successive calls differ", () => {
    expect(defaultRecordIdSource.newSessionId()).not.toBe(defaultRecordIdSource.newSessionId());
    expect(defaultRecordIdSource.newSaveId()).not.toBe(defaultRecordIdSource.newSaveId());
  });
});

describe("defaultClock", () => {
  it("now() returns a valid ISO-8601 string close to the real current time", () => {
    const before = Date.now();
    const now = defaultClock.now();
    const after = Date.now();

    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const parsed = Date.parse(now);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
