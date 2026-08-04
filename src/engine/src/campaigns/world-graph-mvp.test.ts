import { describe, expect, it } from "vitest";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { EngineHost } from "../core/composition/types.js";
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
    if (!result.ok || !result.value) throw new Error("expected world-graph fixture registry");

    const host: EngineHost = {
      registry: result.value,
      kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
      ids: { newGameId: () => "game:world-graph-mvp", newSeed: () => "seed:world-graph-mvp" },
    };
    const engine = createEngine(host);
    const created = engine.createGame({ campaignId: built.value.campaign.id });
    expect(created).toMatchObject({
      ok: true,
      value: { status: "active" },
    });
    if (!created.ok || !created.value) throw new Error("expected world-graph fixture to start");
    expect(engine.availableActions(created.value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "advance_ticks", available: true }),
      expect.objectContaining({ id: "build", available: true }),
    ]));
  });
});
