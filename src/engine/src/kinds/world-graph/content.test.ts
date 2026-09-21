import { describe, expect, it } from "vitest";
import { worldGraphContent } from "./content.js";

describe("worldGraphContent", () => {
  it("preserves the registry's opaque runtime content without cloning or interpreting it", () => {
    const content = { arbitrary: { nested: ["content"] } };

    expect(worldGraphContent(content)).toBe(content);
  });
});
