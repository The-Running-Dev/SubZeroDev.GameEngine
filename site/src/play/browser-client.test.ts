import { describe, expect, it } from "vitest";
import { BrowserClient } from "./browser-client";
import { createBrowserDemo } from "./composition";

describe("BrowserClient", () => {
  it("uses the SessionStore for a non-committing preview and same-page checkpoint", async () => {
    const demo = createBrowserDemo();
    const client = new BrowserClient(demo.store);
    const started = await client.start(demo.config.campaignId);
    const action = started.actions.find((candidate) => candidate.available);
    expect(action).toBeDefined();
    if (action === undefined)
      throw new Error("expected an available starting action");

    const preview = await client.preview(started, action.id);
    expect(preview).toBeDefined();
    expect((await demo.store.getScene(started.sessionId)).body.text).toBe(
      started.scene.body.text,
    );

    const checkpoint = await client.save(started.sessionId);
    const committed = await client.submit(started, action.id);
    expect(committed.state.scene.body.text).toBe(preview?.body.text);

    const restored = await client.load(checkpoint.saveId);
    expect(restored.scene.body.text).toBe(started.scene.body.text);
  });
});
