import { describe, expect, it } from "vitest";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";

describe("world-graph MVP campaign", () => {
  it("builds and passes both validation tiers without warnings", () => {
    const built = buildWorldGraphMvpCampaign();
    expect(built.ok).toBe(true);
    if (!built.ok || !built.value) throw new Error("expected world-graph fixture to build");
    const result = buildValidatedContentRegistry([built.value], { "world-graph": worldGraphKind } as unknown as KindRegistry);
    expect(result).toMatchObject({ ok: true, errors: [], warnings: [] });
  });
});
