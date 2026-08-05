import { describe, expect, it } from "vitest";
import {
  buildBulgariaBureaucracyCampaign,
  buildValidatedContentRegistry,
  createCountingIds,
  createEngine,
  createInMemorySessionStore,
  storyGraphKind,
  TextClient,
  type ActionParams,
  type ContentRegistry,
  type CreateSessionConfig,
  type Engine,
  type KindRegistry,
} from "@the-running-dev/game-engine";
import { BrowserClient } from "./browser-client";
import { createBrowserDemo } from "./composition";

const SEED = "bureaucracy-seed-3";
const ACTIONS = ["wait", "continue_cycle", "continue_cycle", "go_home"];

function makeBrowserClient(): BrowserClient {
  return new BrowserClient(createBrowserDemo().store);
}

function recordStoreCalls(
  store: ReturnType<typeof createBrowserDemo>["store"],
): {
  store: ReturnType<typeof createBrowserDemo>["store"];
  created: CreateSessionConfig[];
  submitted: ActionParams[];
  previewed: ActionParams[];
} {
  const created: CreateSessionConfig[] = [];
  const submitted: ActionParams[] = [];
  const previewed: ActionParams[] = [];
  return {
    store: {
      listCampaigns: () => store.listCampaigns(),
      getScene: (sessionId) => store.getScene(sessionId),
      getView: (sessionId) => store.getView(sessionId),
      getStrings: (sessionId) => store.getStrings(sessionId),
      createSession: (config) => {
        created.push(config);
        return store.createSession(config);
      },
      resumeSession: (sessionId) => store.resumeSession(sessionId),
      submitAction: (sessionId, actionId, params) => {
        if (params !== undefined) submitted.push(params);
        return store.submitAction(sessionId, actionId, params);
      },
      previewAction: (sessionId, actionId, params) => {
        if (params !== undefined) previewed.push(params);
        return store.previewAction(sessionId, actionId, params);
      },
      saveGame: (sessionId) => store.saveGame(sessionId),
      loadGame: (saveId) => store.loadGame(saveId),
    },
    created,
    submitted,
    previewed,
  };
}

function observeSerializations(engine: Engine): {
  engine: Engine;
  lastSerialized(): string | undefined;
} {
  const observer: { value?: string } = {};
  function wrap(current: Engine): Engine {
    return {
      kinds: current.kinds,
      createGame: (config) => current.createGame(config),
      scene: (state) => current.scene(state),
      view: (state, audience) => current.view(state, audience),
      availableActions: (state) => current.availableActions(state),
      submitAction: (state, actionId, params) =>
        current.submitAction(state, actionId, params),
      previewAction: (state, actionId, params) =>
        current.previewAction(state, actionId, params),
      serialize: (state) => {
        observer.value = current.serialize(state);
        return observer.value;
      },
      deserialize: (data) => current.deserialize(data),
      migrate: (data) => current.migrate(data),
      withEmitter: (emitter) => wrap(current.withEmitter(emitter)),
    };
  }
  return { engine: wrap(engine), lastSerialized: () => observer.value };
}

function makeParityFixture(): {
  client: TextClient;
  engine: Engine;
  registry: ContentRegistry;
  lastSerialized(): string | undefined;
} {
  const campaign = buildBulgariaBureaucracyCampaign();
  if (!campaign.ok || campaign.value === undefined) {
    throw new Error("expected the Bureaucracy campaign to build");
  }
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([campaign.value], kinds);
  if (!registryResult.ok || registryResult.value === undefined) {
    throw new Error("expected the Bureaucracy campaign to validate");
  }
  const registry: ContentRegistry = registryResult.value;
  const observed = observeSerializations(
    createEngine({ kinds, registry, ids: createCountingIds() }),
  );
  return {
    client: new TextClient(
      createInMemorySessionStore({ engine: observed.engine, registry }),
    ),
    engine: observed.engine,
    registry,
    lastSerialized: observed.lastSerialized,
  };
}

describe("BrowserClient — the API coverage checklist (09-clients.md §4, W61.8)", () => {
  it("1. listCampaigns — returns the configured Bureaucracy campaign", () => {
    expect(makeBrowserClient().listCampaigns()).toContainEqual(
      expect.objectContaining({ campaignId: "bulgaria-bureaucracy" }),
    );
  });

  it("2. createSession — starts the Bureaucracy arc through the adapter", async () => {
    const started = await makeBrowserClient().createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    expect(started.scene.body.text).toContain("handwritten");
  });

  it("createSession — fixes the demo audience to player", async () => {
    const calls = recordStoreCalls(createBrowserDemo().store);
    const client = new BrowserClient(calls.store);
    await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
      // Simulates an untyped JavaScript caller; BrowserSessionConfig rejects this in TypeScript.
      ...({ audience: "ai" } as object),
    });
    expect(calls.created).toEqual([
      { campaignId: "bulgaria-bureaucracy", seed: SEED, audience: "player" },
    ]);
  });

  it("3. resumeSession — returns the current scene without changing it", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    expect((await client.resumeSession(started.sessionId)).scene).toEqual(
      started.scene,
    );
  });

  it("4. getScene — returns the scene created for the same session", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    expect(await client.getScene(started.sessionId)).toEqual(started.scene);
  });

  it("5. getView — returns the real StoryGraph player projection", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    expect(await client.getView(started.sessionId)).toEqual(started.view);
  });

  it("6. getStrings — resolves the Bureaucracy action label", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    await expect(client.getStrings(started.sessionId)).resolves.toMatchObject({
      "bureaucracy.choice.wait.label": "Wait",
    });
  });

  it("7. submitAction — reaches the shown gated choice through the adapter", async () => {
    const client = makeBrowserClient();
    let state = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    for (const actionId of ACTIONS.slice(0, 3))
      state = (await client.submit(state, actionId)).state;
    expect(state.actions).toContainEqual(
      expect.objectContaining({ id: "go_home", available: true }),
    );
  });

  it("8. previewAction — returns a prospective scene without changing the session", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    const preview = await client.previewAction(started.sessionId, "wait");
    expect(preview.scene?.body.text).toContain("Room 6");
    expect(await client.getScene(started.sessionId)).toEqual(started.scene);
  });

  it("action helpers — forward declared parameters unchanged", async () => {
    const calls = recordStoreCalls(createBrowserDemo().store);
    const client = new BrowserClient(calls.store);
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    const params = { declared: "value" };
    await client.previewAction(started.sessionId, "wait", params);
    await client.submitAction(started.sessionId, "wait", params);
    expect(calls.previewed).toEqual([params]);
    expect(calls.submitted).toEqual([params]);
  });

  it("9. saveGame — creates a same-page checkpoint", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    await expect(client.saveGame(started.sessionId)).resolves.toMatchObject({
      savedAtSeq: 0,
    });
  });

  it("10. loadGame — restores a fresh session at the checkpoint scene", async () => {
    const client = makeBrowserClient();
    const started = await client.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    const checkpoint = await client.saveGame(started.sessionId);
    const restored = await client.loadGame(checkpoint.saveId);
    expect(restored.sessionId).not.toBe(started.sessionId);
    expect(restored.scene).toEqual(started.scene);
  });
});

describe("BrowserClient — Bureaucracy client parity (09-clients.md §1, §4; W61.8)", () => {
  it("the browser adapter and text client, with the same seed and counting IdSource, produce identical scene and view steps and final serialize() output", async () => {
    const browserFixture = makeParityFixture();
    const browser = new BrowserClient(
      createInMemorySessionStore({
        engine: browserFixture.engine,
        registry: browserFixture.registry,
      }),
    );
    const textFixture = makeParityFixture();
    const text = textFixture.client;

    const browserStarted = await browser.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    const textStarted = await text.createSession({
      campaignId: "bulgaria-bureaucracy",
      seed: SEED,
    });
    let browserState = browserStarted;
    const textSessionId = textStarted.value.sessionId;
    expect(browserState.scene).toEqual(textStarted.value.scene);
    expect(browserState.view).toEqual(
      await text.getView(textSessionId).then((value) => value.value),
    );

    for (const actionId of ACTIONS) {
      browserState = (await browser.submit(browserState, actionId)).state;
      const textResult = await text.submitAction(textSessionId, actionId);
      expect(browserState.scene).toEqual(textResult.value.scene);
      expect(browserState.view).toEqual(
        (await text.getView(textSessionId)).value,
      );
    }

    expect(browserState.scene.status).toBe("ended");
    expect(browserFixture.lastSerialized()).toBe(textFixture.lastSerialized());
  });
});
