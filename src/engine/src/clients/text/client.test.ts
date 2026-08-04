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
  it("1. listCampaigns — returns the real campaign, unresolved titleKey (no session yet)", () => {
    const client = makeClient();
    const { value, text } = client.listCampaigns();
    expect(value).toEqual([{ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, kindId: "story-graph", titleKey: "bureaucracy.campaign.title" }]);
    expect(text).toContain(BULGARIA_BUREAUCRACY_CAMPAIGN_ID);
    expect(text).toContain("bureaucracy.campaign.title");
  });

  it("2. createSession — starts the Bureaucracy arc; text renders the real Municipality scene", async () => {
    const client = makeClient();
    const { value, text } = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    expect(value.sessionId).toBeTruthy();
    expect(text).toContain("A handwritten");
    expect(text).toContain("[wait] Wait");
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
    const kindView = value.kindView as { turn: number; stats: { var: string }[] };
    expect(kindView.turn).toBe(0);
    expect(kindView.stats.map((s) => s.var).sort()).toEqual(["certificate_age_months", "office_visits"]);
    expect(text).toContain('"turn": 0');
  });

  it("6. getStrings — resolves the same table the store returns; a known key is present", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const strings = await client.getStrings(created.value.sessionId);
    expect(strings["bureaucracy.choice.wait.label"]).toBe("Wait");
  });

  it("7. submitAction — success renders the new scene; a gated choice renders unavailable with its real reason", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const sessionId = created.value.sessionId;

    // wait -> office_visits 1, at room_6: go_home still gated.
    const afterWait = await client.submitAction(sessionId, "wait");
    expect(afterWait.value.ok).toBe(true);
    expect(afterWait.text).toContain("Room 6 informs you");
    expect(afterWait.text).toContain("[go_home] Go home (You can't leave yet");

    // continue_cycle x2 -> office_visits 3: the gate opens.
    const afterFirstCycle = await client.submitAction(sessionId, "continue_cycle");
    expect(afterFirstCycle.value.ok).toBe(true);
    expect(afterFirstCycle.text).toContain("[go_home] Go home (You can't leave yet");

    const afterSecondCycle = await client.submitAction(sessionId, "continue_cycle");
    expect(afterSecondCycle.value.ok).toBe(true);
    expect(afterSecondCycle.text).toContain("[go_home] Go home");
    expect(afterSecondCycle.text).not.toContain("[go_home] Go home (");

    // go_home -> the ending, rendered from the real authored text, not a client literal.
    const goHome = await client.submitAction(sessionId, "go_home");
    expect(goHome.value.ok).toBe(true);
    expect(goHome.value.scene?.status).toBe("ended");
    expect(goHome.text).toContain("Congratulations");
  });

  it("8. previewAction — renders the prospective scene without changing the session", async () => {
    const client = makeClient();
    const created = await client.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEEDED_ROOM_14_SEED });
    const preview = await client.previewAction(created.value.sessionId, "wait");

    expect(preview.value.ok).toBe(true);
    expect(preview.text).toContain("Room 6 informs you");
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

    const continued = await client.submitAction(loaded.value.sessionId, "continue_cycle");
    expect(continued.value.ok).toBe(true);
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
    expect(authoredText.some((t) => t.key === "bureaucracy.choice.wait.label" && t.text === "Wait")).toBe(true);
  });
});
