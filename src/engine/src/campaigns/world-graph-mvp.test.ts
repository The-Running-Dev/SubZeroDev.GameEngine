import { describe, expect, it } from "vitest";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import type { EngineHost } from "../core/composition/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { WorldGraphCampaign } from "../kinds/world-graph/content.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";

function makeEngine() {
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("expected world-graph fixture to build");
  const kinds = { "world-graph": worldGraphKind } as unknown as KindRegistry;
  const result = buildValidatedContentRegistry([built.value], kinds);
  if (!result.ok || !result.value) throw new Error("expected world-graph fixture registry");
  const host: EngineHost = {
    registry: result.value,
    kinds,
    ids: { newGameId: () => "game:world-graph-mvp", newSeed: () => "seed:world-graph-mvp" },
  };
  return { built: built.value, engine: createEngine(host) };
}

describe("world-graph MVP campaign", () => {
  it("builds and passes both validation tiers without warnings", () => {
    const { built, engine } = makeEngine();
    expect([...built.strings.keys()].every((key) => {
      const segments = key.split(".");
      return segments.length >= 2 && segments.length <= 3;
    })).toBe(true);
    const result = buildValidatedContentRegistry([built], { "world-graph": worldGraphKind } as unknown as KindRegistry);
    expect(result).toMatchObject({ ok: true, errors: [], warnings: [] });
    const created = engine.createGame({ campaignId: built.campaign.id });
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

  it("has deterministic win and loss paths through the real tick pipeline", () => {
    const win = makeEngine();
    const startedWin = win.engine.createGame({ campaignId: win.built.campaign.id, seed: "world-graph-win" });
    if (!startedWin.ok || !startedWin.value) throw new Error("expected win fixture to start");
    const hired = win.engine.submitAction(startedWin.value, "hire_staff", { definitionId: "cleaner" });
    if (!hired.ok || !hired.value) throw new Error("expected cleaner hire to succeed");
    const won = win.engine.submitAction(hired.value, "advance_ticks", { ticks: 10 });
    expect(won.value).toMatchObject({ status: "ended" });
    expect(won.value!.kindState).toMatchObject({ resolution: { resolution: "objectives_met", objectiveIds: ["clean-litter"], failureId: null } });

    const loss = makeEngine();
    const startedLoss = loss.engine.createGame({ campaignId: loss.built.campaign.id, seed: "world-graph-loss" });
    if (!startedLoss.ok || !startedLoss.value) throw new Error("expected loss fixture to start");
    const advancedLoss = loss.engine.submitAction(startedLoss.value, "advance_ticks", { ticks: 10 });
    if (!advancedLoss.ok || !advancedLoss.value) throw new Error("expected loss fixture to advance");
    const lost = loss.engine.submitAction(advancedLoss.value, "advance_ticks", { ticks: 1 });
    expect(lost.value).toMatchObject({ status: "ended" });
    expect(lost.value!.kindState).toMatchObject({ resolution: { resolution: "failed", objectiveIds: [], failureId: "bankrupt" } });
  });

  it("keeps malformed authored data blocking while semantic warnings remain loadable", () => {
    const { built } = makeEngine();
    const content = built.campaign.content as WorldGraphCampaign;
    const malformed = {
      ...built.campaign,
      content: {
        ...content,
        scenarios: content.scenarios.map((scenario) => ({ ...scenario, mapId: "missing-map" })),
      },
    };
    expect(worldGraphKind.validateCampaign(malformed, built.strings)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: "unknown_reference" })]),
    });

    const warningOnly = {
      ...built.campaign,
      content: {
        ...content,
        maps: content.maps.map((map) => ({ ...map, topology: { kind: "explicit" as const, edges: [] } })),
        scenarios: content.scenarios.map((scenario) => ({ ...scenario, objectiveIds: [], failureIds: [] })),
      },
    };
    expect(worldGraphKind.validateCampaign(warningOnly, built.strings)).toMatchObject({
      ok: true,
      errors: [],
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "disconnected_map" }),
        expect.objectContaining({ code: "inert_scenario" }),
      ]),
    });
  });
});
