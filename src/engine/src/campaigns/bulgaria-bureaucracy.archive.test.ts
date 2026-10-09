import { describe, it, expect } from "vitest";
import { createContentArchive } from "../core/registry/archive.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { buildBulgariaBureaucracyCampaign } from "./bulgaria-bureaucracy.js";

// S131.1 against real content: the archive validates, digests and freezes a full campaign.
describe("S131.1 — the content archive holds the real campaign", () => {
  it("accepts its validated registry, resolves it at its version, and republishes it as a no-op", () => {
    const built = buildBulgariaBureaucracyCampaign();
    if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
    const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
    const validated = buildValidatedContentRegistry([built.value], kinds);
    if (!validated.ok || !validated.value) throw new Error("expected the real campaign to validate");

    const archive = createContentArchive({ kinds, initial: validated.value });
    const { id, version } = built.value.campaign;

    expect(archive.resolve(id, version)?.campaigns.get(id)?.content).toEqual(built.value.campaign.content);
    expect(archive.publish(validated.value)).toMatchObject({ ok: true, value: [] });
  });
});
