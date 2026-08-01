import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ENGINE_VERSION } from "./version.js";

describe("ENGINE_VERSION (07-replay.md §2)", () => {
  it("matches package.json's own version — not a separately hardcoded literal", () => {
    const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
    expect(ENGINE_VERSION).toBe(version);
  });

  it("is a real semver, not the pre-release placeholder", () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(ENGINE_VERSION).not.toBe("0.0.0");
  });
});
