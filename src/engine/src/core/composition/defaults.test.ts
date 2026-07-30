import { describe, it, expect } from "vitest";
import { defaultIdSource } from "./defaults.js";

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
