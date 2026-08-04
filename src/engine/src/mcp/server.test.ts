import { describe, it, expect } from "vitest";
import { createMcpTools, type McpTools } from "./server.js";
import { TextClient } from "../clients/text/client.js";
import { createEngine } from "../core/kernel/engine.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { SessionStore } from "../core/session/types.js";
import type { IdSource } from "../core/composition/types.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "../campaigns/bulgaria-bureaucracy.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "../campaigns/stable-life.js";

// The scan-verified seed whose first weighted pick at clerk_review (3 expired : 1 room_14)
// lands on room_14 — see plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md.
const SEED = "bureaucracy-seed-3";

function buildStore(ids?: IdSource): SessionStore {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the real campaign to validate");

  const engine = createEngine({ kinds, registry: registryResult.value, ...(ids ? { ids } : {}) });
  return createInMemorySessionStore({ engine, registry: registryResult.value });
}

function makeTools(): McpTools {
  return createMcpTools(buildStore());
}

describe("McpTools — the API coverage checklist (09-clients.md §4)", () => {
  it("list_campaigns — returns the real campaign summary", () => {
    const tools = makeTools();
    const campaigns = tools.list_campaigns({});
    expect(campaigns).toEqual([{ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, kindId: "story-graph", titleKey: "bureaucracy.campaign.title" }]);
  });

  it("start_game — args { campaignId, seed?, profileId? }, returns { sessionId, scene }", async () => {
    const tools = makeTools();
    const result = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    expect(result.sessionId).toBeTruthy();
    expect(result.scene.body.text).toContain("A handwritten");
    expect(result.scene.actions.map((a) => a.id).sort()).toEqual(["ask_guard", "coffee", "try_another_entrance", "wait"]);
  });

  it("start_game — never forwards audience to the store, even if a caller bypasses the type system", async () => {
    // StartGameArgs has no `audience` field, so this can't be expressed through the
    // type — simulating an untyped MCP transport (real JSON-RPC args from an LLM aren't
    // type-checked) attempting the widening finding 1 flagged. A recording fake store
    // (not the real one) proves what config actually reaches createSession, since the
    // real story-graph kind's project() doesn't branch on audience and so can't show a
    // difference through get_state alone.
    let capturedConfig: unknown;
    const recordingStore = {
      listCampaigns: () => [],
      getScene: () => Promise.reject(new Error("unused")),
      getView: () => Promise.reject(new Error("unused")),
      getStrings: () => Promise.reject(new Error("unused")),
      createSession: (config: unknown) => {
        capturedConfig = config;
        return Promise.resolve({ sessionId: "s1", scene: { gameId: "g1", status: "active" as const, body: { textKey: "t", text: "t" }, actions: [], view: { gameId: "g1", status: "active" as const, kindView: {} } } });
      },
      resumeSession: () => Promise.reject(new Error("unused")),
      submitAction: () => Promise.reject(new Error("unused")),
      saveGame: () => Promise.reject(new Error("unused")),
      loadGame: () => Promise.reject(new Error("unused")),
    } as unknown as SessionStore;

    const tools = createMcpTools(recordingStore);
    const untypedArgs = { campaignId: "c", seed: "s", audience: "ai" } as unknown as Parameters<McpTools["start_game"]>[0];
    await tools.start_game(untypedArgs);

    expect(capturedConfig).toEqual({ campaignId: "c", seed: "s" });
    expect(capturedConfig).not.toHaveProperty("audience");
  });

  it("continue_game — returns the current scene unchanged, no side effect", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const resumed = await tools.continue_game({ sessionId: created.sessionId });
    expect(resumed).toEqual(created.scene);
  });

  it("get_scene — matches what start_game returned for the same session", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const scene = await tools.get_scene({ sessionId: created.sessionId });
    expect(scene).toEqual(created.scene);
  });

  it("get_state — returns the real StoryGraphView through PlayerView", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const view = await tools.get_state({ sessionId: created.sessionId });
    const kindView = view.kindView as { turn: number; stats: { var: string }[] };
    expect(kindView.turn).toBe(0);
    expect(kindView.stats.map((s) => s.var).sort()).toEqual(["certificate_age_months", "office_visits"]);
  });

  it("get_strings — resolves LocKeys through the registry", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const strings = await tools.get_strings({ sessionId: created.sessionId });
    expect(strings["bureaucracy.choice.wait.label"]).toBe("Wait");
  });

  it("choose — submitAction under the MCP name; carries the new Scene, never the envelope", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const result = await tools.choose({ sessionId: created.sessionId, actionId: "wait" });
    expect(result.ok).toBe(true);
    expect(result.scene?.body.text).toContain("Room 6 informs you");
    expect(result).not.toHaveProperty("kindState");
    expect(result).not.toHaveProperty("actionLog");
  });

  it("preview_action — returns the prospective scene without changing the session", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const preview = await tools.preview_action({ sessionId: created.sessionId, actionId: "wait" });

    expect(preview.ok).toBe(true);
    expect(preview.scene?.body.text).toContain("Room 6 informs you");
    expect(await tools.get_scene({ sessionId: created.sessionId })).toEqual(created.scene);
  });

  it("save_game — narrows the store's SaveHandle to { saveId } only", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const saved = await tools.save_game({ sessionId: created.sessionId });
    expect(Object.keys(saved)).toEqual(["saveId"]);
    expect(saved.saveId).toBeTruthy();
  });

  it("load_game — a fresh session from the save renders the same scene the save point was at", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    await tools.choose({ sessionId: created.sessionId, actionId: "wait" });
    const sceneAfterWait = await tools.get_scene({ sessionId: created.sessionId });
    const saved = await tools.save_game({ sessionId: created.sessionId });

    const loaded = await tools.load_game({ saveId: saved.saveId });
    expect(loaded.sessionId).not.toBe(created.sessionId);
    expect(loaded.scene).toEqual(sceneAfterWait);
  });
});

function buildSimulationStore(): SessionStore {
  const built = buildStableLifeCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life fixture campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Stable Life fixture campaign to validate");

  const engine = createEngine({ kinds, registry: registryResult.value });
  return createInMemorySessionStore({ engine, registry: registryResult.value });
}

function makeSimulationTools(): McpTools {
  return createMcpTools(buildSimulationStore());
}

// A simulation column (W50) — the same ten operations, proven against a kind whose
// actions carry declared `params`, mirroring the text-client suite's own "sim.N" numbering.
describe("McpTools — the API coverage checklist, simulation kind (09-clients.md §4, W50)", () => {
  it("sim.1. list_campaigns — includes the Stable Life campaign summary", () => {
    const tools = makeSimulationTools();
    const campaigns = tools.list_campaigns({});
    expect(campaigns).toContainEqual({ campaignId: STABLE_LIFE_CAMPAIGN_ID, kindId: "simulation", titleKey: "stable-life.campaign.title" });
  });

  it("sim.2. start_game — returns { sessionId, scene } for Stable Life", async () => {
    const tools = makeSimulationTools();
    const result = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    expect(result.sessionId).toBeTruthy();
    expect(result.scene.actions.map((a) => a.id).sort()).toEqual(["end_week", "plan.add", "plan.clear", "plan.remove"]);
  });

  it("sim.3. continue_game — returns the current scene unchanged, no side effect", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const resumed = await tools.continue_game({ sessionId: created.sessionId });
    expect(resumed).toEqual(created.scene);
  });

  it("sim.4. get_scene — matches what start_game returned for the same session", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const scene = await tools.get_scene({ sessionId: created.sessionId });
    expect(scene).toEqual(created.scene);
  });

  it("sim.5. get_state — returns the real SimulationView through PlayerView", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const view = await tools.get_state({ sessionId: created.sessionId });
    const kindView = view.kindView as { calendar: { currentWeek: number } };
    expect(kindView.calendar.currentWeek).toBe(1);
  });

  it("sim.6. get_strings — resolves LocKeys through the registry", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const strings = await tools.get_strings({ sessionId: created.sessionId });
    expect(strings["stable-life.scene.status"]).toContain("Week {week}");
  });

  it("sim.7. choose — plan.add's declared actionType param reaches the kind through the MCP name", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const result = await tools.choose({ sessionId: created.sessionId, actionId: "plan.add", params: { actionType: "rest" } });
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("kindState");
  });

  it("sim.8. preview_action — returns the prospective result without committing it", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const preview = await tools.preview_action({ sessionId: created.sessionId, actionId: "plan.add", params: { actionType: "rest" } });
    expect(preview.ok).toBe(true);
    expect(await tools.get_scene({ sessionId: created.sessionId })).toEqual(created.scene);
  });

  it("sim.9. save_game — narrows the store's SaveHandle to { saveId } only", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    const saved = await tools.save_game({ sessionId: created.sessionId });
    expect(Object.keys(saved)).toEqual(["saveId"]);
  });

  it("sim.10. load_game — a fresh session from the save renders the same scene the save point was at", async () => {
    const tools = makeSimulationTools();
    const created = await tools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: "sim-mcp-seed" });
    await tools.choose({ sessionId: created.sessionId, actionId: "plan.add", params: { actionType: "rest" } });
    const sceneAfterAdd = await tools.get_scene({ sessionId: created.sessionId });
    const saved = await tools.save_game({ sessionId: created.sessionId });

    const loaded = await tools.load_game({ saveId: saved.saveId });
    expect(loaded.scene).toEqual(sceneAfterAdd);
  });
});

describe("McpTools — an agent is a player (09-clients.md §7)", () => {
  it("completes the Bureaucracy arc through choose alone, reaching the ending and the achievement", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const sessionId = created.sessionId;

    await tools.choose({ sessionId, actionId: "wait" });
    await tools.choose({ sessionId, actionId: "continue_cycle" });
    await tools.choose({ sessionId, actionId: "continue_cycle" });
    const result = await tools.choose({ sessionId, actionId: "go_home" });

    expect(result.ok).toBe(true);
    expect(result.scene?.status).toBe("ended");
    expect(result.scene?.body.text).toContain("Congratulations");

    const view = await tools.get_state({ sessionId });
    const kindView = view.kindView as { unlockedAchievements: string[]; ending?: { endingId: string } };
    expect(kindView.unlockedAchievements).toEqual(["it_builds_character"]);
    expect(kindView.ending?.endingId).toBe("ultimate_reward");
  });

  it("sees no more than a human client does — a hidden choice returns unknown_action, not a richer error", async () => {
    const tools = makeTools();
    const created = await tools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    const result = await tools.choose({ sessionId: created.sessionId, actionId: "totally_fake_action" });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([{ code: "unknown_action", messageKey: "core.reason.unknown_action" }]);
  });
});

describe("the client contract's proof (09-clients.md §1)", () => {
  it("the same seed and choices, under the same counting IdSource, produce identical scene/view sequences through TextClient and McpTools", async () => {
    const textClient = new TextClient(buildStore(createCountingIds()));
    const mcpTools = createMcpTools(buildStore(createCountingIds()));

    async function runViaTextClient(): Promise<unknown[]> {
      const snapshots: unknown[] = [];
      const created = await textClient.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
      const sessionId = created.value.sessionId;
      snapshots.push(created.value.scene, (await textClient.getView(sessionId)).value);

      for (const actionId of ["wait", "continue_cycle", "continue_cycle", "go_home"]) {
        const result = await textClient.submitAction(sessionId, actionId);
        snapshots.push(result.value.scene, (await textClient.getView(sessionId)).value);
      }
      return snapshots;
    }

    async function runViaMcpTools(): Promise<unknown[]> {
      const snapshots: unknown[] = [];
      const created = await mcpTools.start_game({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
      const sessionId = created.sessionId;
      snapshots.push(created.scene, await mcpTools.get_state({ sessionId }));

      for (const actionId of ["wait", "continue_cycle", "continue_cycle", "go_home"]) {
        const result = await mcpTools.choose({ sessionId, actionId });
        snapshots.push(result.scene, await mcpTools.get_state({ sessionId }));
      }
      return snapshots;
    }

    const textClientSnapshots = await runViaTextClient();
    const mcpSnapshots = await runViaMcpTools();

    expect(mcpSnapshots).toEqual(textClientSnapshots);
    // Not vacuous: the two runs actually reached the ending, not just failed identically.
    const finalScene = textClientSnapshots.at(-2) as { status: string };
    expect(finalScene.status).toBe("ended");
  });
});
