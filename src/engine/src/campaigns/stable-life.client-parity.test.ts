/**
 * "Stable Life" through both clients — 09-clients.md §1/§4's own invariant, exercised for
 * the first time for a kind whose actions carry declared `params` (10-simulation-kind.md
 * §4's own callout).
 *
 * Contract: `09-clients.md` §1, §4; `10-simulation-kind.md` §9 (W50.6).
 *
 * Two independent (engine, store) pairs, same registry-building inputs, same seed, same
 * counting `IdSource` — one driven through `TextClient`, one through `McpTools`, the same
 * six submissions the committed `stable-life-win` replay fixture uses (`plan.add
 * { actionType: "rest" }`, `end_week`, ×3). Neither client can hand a test raw `GameState`
 * (09 §6 — "projection is not optional"), so this proves parity the way a client-level test
 * can: the two clients' own `Scene`/`PlayerView` outputs are asserted identical at every
 * step (`gameId` aside, which the fixed `IdSource` also pins), and a third, client-free
 * replay of the identical action log through the bare engine reaches the identical,
 * golden-filed `serialize()` output on repeat — the same discipline
 * `bulgaria-bureaucracy.determinism.test.ts` already uses, here specifically exercising
 * `plan.add`'s own declared `actionType` param end to end.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { TextClient } from "../clients/text/client.js";
import { createMcpTools } from "../mcp/server.js";
import type { Engine, KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import type { IdSource } from "../core/composition/types.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "./stable-life.js";

const SEED = "stable-life-win-seed";
const FIXED_IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

const WIN_ACTIONS: ReadonlyArray<{ actionId: string; params?: Record<string, string> }> = [
  { actionId: "plan.add", params: { actionType: "rest" } },
  { actionId: "end_week" },
  { actionId: "plan.add", params: { actionType: "rest" } },
  { actionId: "end_week" },
  { actionId: "plan.add", params: { actionType: "rest" } },
  { actionId: "end_week" },
];

function buildEngineAndRegistry(): { engine: Engine; registry: ContentRegistry } {
  const built = buildStableLifeCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life fixture campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Stable Life fixture campaign to validate");
  const registry = registryResult.value;
  return { engine: createEngine({ kinds, registry, ids: FIXED_IDS }), registry };
}

describe("Stable Life — client parity (09-clients.md §1, §4; W50.6)", () => {
  it("the text client and MCP, same seed and IdSource, produce identical scenes and views at every step of the committed win", async () => {
    const text = buildEngineAndRegistry();
    const textClient = new TextClient(createInMemorySessionStore({ engine: text.engine, registry: text.registry }));

    const mcp = buildEngineAndRegistry();
    const mcpTools = createMcpTools(createInMemorySessionStore({ engine: mcp.engine, registry: mcp.registry }));

    // `sessionId` is store-generated (`crypto.randomUUID()`, unrelated to `FIXED_IDS`), so
    // the two independent stores mint different ones — expected, and not part of the
    // parity claim. `gameId` (inside `scene`/`view`), which `FIXED_IDS` does pin, is.
    const started = await textClient.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED });
    const { sessionId: mcpSessionId, scene: startScene } = await mcpTools.start_game({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED });
    const textSessionId = started.value.sessionId;

    expect(started.value.scene).toEqual(startScene);

    for (const action of WIN_ACTIONS) {
      const textResult = await textClient.submitAction(textSessionId, action.actionId, action.params);
      const mcpResult = await mcpTools.choose({ sessionId: mcpSessionId, actionId: action.actionId, ...(action.params ? { params: action.params } : {}) });
      expect(textResult.value).toEqual(mcpResult);
    }

    const textScene = await textClient.getScene(textSessionId);
    const mcpScene = await mcpTools.get_scene({ sessionId: mcpSessionId });
    expect(textScene.value).toEqual(mcpScene);
    expect(textScene.value.status).toBe("ended");

    const textView = await textClient.getView(textSessionId);
    const mcpView = await mcpTools.get_state({ sessionId: mcpSessionId });
    expect(textView.value).toEqual(mcpView);
  });

  it("a client-free replay of the identical action log reaches the identical, golden-filed serialize() output on repeat", () => {
    function replay(): string {
      const { engine, registry } = buildEngineAndRegistry();
      void registry;
      const created = engine.createGame({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED });
      if (!created.ok || !created.value) throw new Error("expected createGame to succeed");
      let state = created.value;
      for (const action of WIN_ACTIONS) {
        const result = engine.submitAction(state, action.actionId, action.params);
        if (!result.ok || !result.value) throw new Error(`expected ${action.actionId} to succeed`);
        state = result.value;
      }
      return engine.serialize(state);
    }

    const first = replay();
    const second = replay();
    expect(first).toBe(second);
    expect(first).toMatchSnapshot();

    const parsed = JSON.parse(first) as { status: string };
    expect(parsed.status).toBe("ended");
  });
});
