import { describe, expect, it } from "vitest";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createEngine } from "../core/kernel/engine.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { buildSaveEnvelope, resolveSaveEnvelope, serializeSaveEnvelope } from "../core/persistence/envelope.js";
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
  return { built: built.value, engine: createEngine(host), kinds, registry: result.value };
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

  it("keeps batch partitions, saved sessions, and previews replay-equivalent", async () => {
    const direct = makeEngine();
    const start = direct.engine.createGame({ campaignId: direct.built.campaign.id, seed: "world-graph-parity" });
    if (!start.ok || !start.value) throw new Error("expected parity fixture to start");
    const oneBatch = direct.engine.submitAction(start.value, "advance_ticks", { ticks: 10 });
    const firstPartition = direct.engine.submitAction(start.value, "advance_ticks", { ticks: 3 });
    if (!firstPartition.ok || !firstPartition.value) throw new Error("expected first partition to advance");
    const splitBatch = direct.engine.submitAction(firstPartition.value, "advance_ticks", { ticks: 7 });
    if (!oneBatch.ok || !oneBatch.value || !splitBatch.ok || !splitBatch.value) throw new Error("expected parity batches to advance");
    expect(splitBatch.value.kindState).toEqual(oneBatch.value.kindState);

    const hiredDirect = direct.engine.submitAction(start.value, "hire_staff", { definitionId: "cleaner" });
    if (!hiredDirect.ok || !hiredDirect.value) throw new Error("expected save fixture cleaner hire to succeed");
    const saveBlob = serializeSaveEnvelope(buildSaveEnvelope({
      state: hiredDirect.value,
      kind: direct.kinds["world-graph"],
      campaign: direct.built.campaign,
      replayCompatible: true,
    }));
    const resolved = resolveSaveEnvelope(saveBlob, direct.kinds, direct.registry);
    if (!resolved.ok) throw new Error(`expected world-graph save to resolve: ${resolved.code}`);
    const restoredAdvance = direct.engine.submitAction(resolved.state, "advance_ticks", { ticks: 10 });
    const uninterruptedAdvance = direct.engine.submitAction(hiredDirect.value, "advance_ticks", { ticks: 10 });
    if (!restoredAdvance.ok || !restoredAdvance.value || !uninterruptedAdvance.ok || !uninterruptedAdvance.value) {
      throw new Error("expected restored and uninterrupted sessions to advance");
    }
    expect(direct.engine.serialize(restoredAdvance.value)).toBe(direct.engine.serialize(uninterruptedAdvance.value));

    const session = makeEngine();
    const store = createInMemorySessionStore({ engine: session.engine, registry: session.registry });
    const created = await store.createSession({ campaignId: session.built.campaign.id, seed: "world-graph-session-parity" });
    const beforePreview = await store.getView(created.sessionId);
    const preview = await store.previewAction(created.sessionId, "advance_ticks", { ticks: 1 });
    expect(preview.ok).toBe(true);
    expect(await store.getView(created.sessionId)).toEqual(beforePreview);
    expect((await store.saveGame(created.sessionId)).savedAtSeq).toBe(0);

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
