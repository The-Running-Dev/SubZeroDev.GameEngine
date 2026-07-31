import { describe, it, expect } from "vitest";
import { interpolateText } from "./text.js";

describe("interpolateText", () => {
  it("substitutes a single placeholder", () => {
    expect(interpolateText("You have {money} coins.", { money: 5 })).toBe("You have 5 coins.");
  });

  it("substitutes multiple placeholders, including repeats", () => {
    expect(interpolateText("{a} and {b} and {a} again", { a: 1, b: "x" })).toBe("1 and x and 1 again");
  });

  it("stringifies boolean and string values", () => {
    expect(interpolateText("{flag}", { flag: true })).toBe("true");
    expect(interpolateText("{name}", { name: "Bulgaria" })).toBe("Bulgaria");
  });

  it("returns the template unchanged when it has no placeholders", () => {
    expect(interpolateText("Nothing to see here.", {})).toBe("Nothing to see here.");
  });

  it("throws when a placeholder references a name absent from the visible-variables map", () => {
    expect(() => interpolateText("{nope}", {})).toThrow();
  });

  it("throws when a placeholder collides with an Object.prototype member name", () => {
    expect(() => interpolateText("{toString}", {})).toThrow();
  });

  it("does not throw for a name present via a null-prototype map's own property", () => {
    const visible: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    visible.money = 3;
    expect(interpolateText("{money}", visible as Record<string, number>)).toBe("3");
  });
});
