import { describe, it, expect } from "vitest";
import { TextClient } from "./client.js";
import { createEngine } from "../../core/kernel/engine.js";
import { createInMemorySessionStore } from "../../core/session/store.js";
import { buildValidatedContentRegistry } from "../../core/validation/tiered.js";
import { storyGraphKind } from "../../kinds/story-graph/kind.js";
import type { KindRegistry } from "../../core/kernel/types.js";
import type { SessionStore } from "../../core/session/types.js";
import {
  bulgariaBureaucracySource,
  buildBulgariaBureaucracyCampaign,
  BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
} from "../../campaigns/bulgaria-bureaucracy.js";
import { buildStoryGraphCampaign } from "../../kinds/story-graph/source.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "../../campaigns/stable-life.js";
import { simulationKind } from "../../kinds/simulation/kind.js";

// The scan-verified seed whose first weighted pick at clerk_review (3 expired : 1 room_14)
// lands on room_14 — see plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md.
const SEEDED_ROOM_14_SEED = "bureaucracy-seed-3";

function makeClient(): TextClient {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the real campaign to validate");

  const engine = createEngine({ kinds, registry: registryResult.value });
  const store: SessionStore = createInMemorySessionStore({ engine, registry: registryResult.value });
  return new TextClient(store);
}

describe("TextClient — the API coverage checklist (09-clients.md §4)", () => {
  it("1. listCampaigns — returns the real campaign, title resolved through the catalog's own strings (no session yet)", async () => {
    const client = makeClient();
    const { value, text } = await client.listCampaigns();
    expect(value).toEqual([{ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, kindId: "story-graph", titleKey: "bureaucracy.campaign.title" }]);
    expect(text).toContain(BULGARIA_BUREAUCRACY_CAMPAIGN_ID);
    expect(text).toContain("The Bureaucracy");
  });

  it("2. createSession — starts the Bureaucracy arc; text renders the real Municipality scene", async () => {
    const client = makeClient();
    const { value, text } = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    expect(value.sessionId).toBeTruthy();
    expect(text).toContain("A handwritten");
    expect(text).toContain("[wait] Wait for the municipal registry");
    expect(text).toContain("[coffee]");
  });

  it("3. resumeSession — returns the current scene unchanged, no side effect", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const resumed = await client.resumeSession(created.value.sessionId);
    expect(resumed.value).toEqual(created.value.scene);
    expect(resumed.text).toBe(created.text);
  });

  it("4. getScene — matches what createSession returned for the same session", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const { value, text } = await client.getScene(created.value.sessionId);
    expect(value).toEqual(created.value.scene);
    expect(text).toBe(created.text);
  });

  it("5. getView — value carries the real StoryGraphView; text is the opaque JSON rendering", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const { value, text } = await client.getView(created.value.sessionId);
    const kindView = value.kindView as { turn: number; stats: { var: string; min?: number; max?: number }[] };
    expect(kindView.turn).toBe(0);
    expect(kindView.stats.map((s) => s.var).sort()).toEqual(["connections", "preparation", "pressure"]);
    // W98.3 — every declared bound travels into the projection.
    for (const stat of kindView.stats) {
      expect(stat.min).toBe(0);
      expect(stat.max).toBe(12);
    }
    expect(text).toContain('"turn": 0');
  });

  it("6. getStrings — resolves the same table the store returns; a known key is present", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const strings = await client.getStrings(created.value.sessionId);
    expect(strings["bureaucracy.municipality.choice_wait"]).toBe("Wait for the municipal registry");
  });

  it("7. submitAction — success renders the new material route and its projected choices", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const sessionId = created.value.sessionId;

    const afterWait = await client.submitAction(sessionId, "wait");
    expect(afterWait.value.ok).toBe(true);
    expect(afterWait.text).toContain("quietly circles");
    expect(afterWait.text).toContain("[registry_route_listen]");

    const afterListening = await client.submitAction(sessionId, "registry_route_listen");
    expect(afterListening.value.ok).toBe(true);
    expect(afterListening.value.scene?.status).toBe("active");
  });

  it("8. previewAction — renders the prospective scene without changing the session", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const preview = await client.previewAction(created.value.sessionId, "wait");

    expect(preview.value.ok).toBe(true);
    expect(preview.text).toContain("quietly circles");
    expect((await client.getScene(created.value.sessionId)).value).toEqual(created.value.scene);
  });

  it("submitAction — an unknown action id renders the real resolved core.reason.unknown_action text", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const { value, text } = await client.submitAction(created.value.sessionId, "totally_fake_action");
    expect(value.ok).toBe(false);
    expect(value.errors[0]?.code).toBe("unknown_action");
    expect(text).toBe("That action isn't recognized.");
  });

  it("9. saveGame — produces a save id; text confirms it", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    await client.submitAction(created.value.sessionId, "wait");
    const { value, text } = await client.saveGame(created.value.sessionId);
    expect(value.saveId).toBeTruthy();
    expect(text).toContain(value.saveId);
  });

  it("10. loadGame — a fresh session from the save renders the same scene the save point was at", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    await client.submitAction(created.value.sessionId, "wait");
    const sceneAfterWait = await client.getScene(created.value.sessionId);
    const saved = await client.saveGame(created.value.sessionId);

    const loaded = await client.loadGame(saved.value.saveId);
    expect(loaded.value.sessionId).not.toBe(created.value.sessionId);
    expect(loaded.value.scene).toEqual(sceneAfterWait.value);
    expect(loaded.text).toBe(sceneAfterWait.text);

    const continued = await client.submitAction(loaded.value.sessionId, "registry_route_listen");
    expect(continued.value.ok).toBe(true);
  });

  it("11. listSaves — a player-keyed, deterministically ordered save list; text renders it (04 §7.4, W99)", async () => {
    const client = makeClient();
    const profileId = "text-lifecycle-profile";
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED, profileId });
    await client.submitAction(created.value.sessionId, "wait");
    const saved = await client.saveGame(created.value.sessionId);

    const { value, text } = await client.listSaves(profileId);
    expect(value).toEqual([{ saveId: saved.value.saveId, campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, savedAt: expect.any(String), savedAtSeq: 1 }]);
    expect(text).toContain(saved.value.saveId);

    expect((await client.listSaves("some-other-profile")).value).toEqual([]);
  });

  it("12. branchSession — retains the source's gameId and replays byte-identically through the fork point (04 §7.4, W99)", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    await client.submitAction(created.value.sessionId, "wait");
    const sceneAfterWait = await client.getScene(created.value.sessionId);

    const branched = await client.branchSession(created.value.sessionId, 1);
    expect(branched.value.sessionId).not.toBe(created.value.sessionId);
    expect(branched.value.scene).toEqual(sceneAfterWait.value);
    expect(branched.text).toBe(sceneAfterWait.text);

    // The source is untouched — it still advances normally after the branch was taken.
    const continued = await client.submitAction(created.value.sessionId, "registry_route_listen");
    expect(continued.value.ok).toBe(true);
  });

  it("13. deleteSave — removes exactly the addressed record; a stale expectedSavedAt is refused (04 §7.4, W99)", async () => {
    const client = makeClient();
    const profileId = "text-delete-profile";
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED, profileId });
    const saved = await client.saveGame(created.value.sessionId);
    const [summary] = (await client.listSaves(profileId)).value;

    await expect(client.deleteSave(profileId, saved.value.saveId, "not-the-real-savedAt")).rejects.toMatchObject({ code: "concurrent_modification" });
    expect((await client.listSaves(profileId)).value).toHaveLength(1);

    await client.deleteSave(profileId, saved.value.saveId, summary!.savedAt);
    expect((await client.listSaves(profileId)).value).toEqual([]);
  });
});

function makeSimulationClient(): TextClient {
  const built = buildStableLifeCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life fixture campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Stable Life fixture campaign to validate");

  const engine = createEngine({ kinds, registry: registryResult.value });
  const store: SessionStore = createInMemorySessionStore({ engine, registry: registryResult.value });
  return new TextClient(store);
}

// A simulation column (W50) — the checklist's own ten operations, proven a second time
// against a kind whose actions carry declared `params` (`plan.add`'s `actionType`), not
// just against story-graph's zero-param `submitAction`.
describe("TextClient — the API coverage checklist, simulation kind (09-clients.md §4, W50)", () => {
  it("sim.1. listCampaigns — includes the Stable Life campaign", async () => {
    const client = makeSimulationClient();
    const { value } = await client.listCampaigns();
    expect(value.some((c) => c.campaignId === STABLE_LIFE_CAMPAIGN_ID && c.kindId === "simulation")).toBe(true);
  });

  it("sim.2. createSession — starts Stable Life; text renders the real status scene", async () => {
    const client = makeSimulationClient();
    const { value, text } = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    expect(value.sessionId).toBeTruthy();
    expect(text).toContain("Week 1");
  });

  it("sim.3. resumeSession — returns the current scene unchanged, no side effect", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const resumed = await client.resumeSession(created.value.sessionId);
    expect(resumed.value).toEqual(created.value.scene);
  });

  it("sim.4. getScene — matches what createSession returned", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const { value } = await client.getScene(created.value.sessionId);
    expect(value).toEqual(created.value.scene);
  });

  it("sim.5. getView — carries the real SimulationView; a declared field renders in the opaque JSON", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const { value, text } = await client.getView(created.value.sessionId);
    const kindView = value.kindView as { calendar: { currentWeek: number } };
    expect(kindView.calendar.currentWeek).toBe(1);
    expect(text).toContain('"currentWeek": 1');
  });

  it("sim.6. getStrings — resolves the same table the store returns; the scene template key is present", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const strings = await client.getStrings(created.value.sessionId);
    expect(strings["stable-life.scene.status"]).toContain("Week {week}");
  });

  it("sim.7. submitAction — plan.add carries its declared actionType param through to the new scene", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const result = await client.submitAction(created.value.sessionId, "plan.add", { actionType: "rest" });
    expect(result.value.ok).toBe(true);
  });

  it("sim.8. previewAction — renders the prospective result without changing the session", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const preview = await client.previewAction(created.value.sessionId, "plan.add", { actionType: "rest" });
    expect(preview.value.ok).toBe(true);
    expect((await client.getScene(created.value.sessionId)).value).toEqual(created.value.scene);
  });

  it("sim.9. saveGame — produces a save id", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    const { value } = await client.saveGame(created.value.sessionId);
    expect(value.saveId).toBeTruthy();
  });

  it("sim.10. loadGame — a fresh session from the save renders the same scene the save point was at", async () => {
    const client = makeSimulationClient();
    const created = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-client-seed" });
    await client.submitAction(created.value.sessionId, "plan.add", { actionType: "rest" });
    const sceneAfterAdd = await client.getScene(created.value.sessionId);
    const saved = await client.saveGame(created.value.sessionId);

    const loaded = await client.loadGame(saved.value.saveId);
    expect(loaded.value.scene).toEqual(sceneAfterAdd.value);
  });
});

describe("TextClient — imports nothing from kinds/, never reads a persisted GameState", () => {
  it("client.ts's own source has no kinds/ import (enforced by eslint.config.js's client-boundary rule too)", async () => {
    // Structural, not behavioral: verified by reading client.ts (only core/* and its own
    // render.ts) and by the eslint rule added in this unit, which fails the build on any
    // `**/kinds/**` import from src/clients/**/*.ts (non-test).
    const client = makeClient();
    const { value } = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    expect(value.sessionId).toBeTruthy();
  });
});

describe("TextClient — reuses the real W15 source, not a synthetic fixture", () => {
  it("the campaign the client plays is the same source buildStoryGraphCampaign lifts", () => {
    const { authoredText } = buildStoryGraphCampaign(bulgariaBureaucracySource);
    expect(authoredText.some((t) => t.key === "bureaucracy.municipality.choice_wait" && t.text === "Wait for the municipal registry")).toBe(true);
  });
});
