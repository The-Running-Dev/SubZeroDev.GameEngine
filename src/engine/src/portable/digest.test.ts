import { describe, expect, it } from "vitest";
import { digestManifestResolution } from "./digest.js";
import type { PortableManifestEntry } from "./format.js";

const campaign = (overrides: Partial<PortableManifestEntry> = {}): PortableManifestEntry => ({
  file: "campaigns/example.json",
  id: "example",
  version: "1.0.0",
  digest: "sha-256:1111",
  ...overrides,
});

describe("digestManifestResolution", () => {
  it("identifies the verified campaign digests, not their file paths", () => {
    const published = [campaign()];
    const relocated = [campaign({ file: "campaigns/renamed.json" })];
    const changedContent = [campaign({ digest: "sha-256:2222" })];

    expect(digestManifestResolution(relocated)).toBe(digestManifestResolution(published));
    expect(digestManifestResolution(changedContent)).not.toBe(digestManifestResolution(published));
  });
});
