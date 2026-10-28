import { describe, it, expect } from "vitest";
import { runningCatalog } from "../../core/kernel/aliases.js";
import { createEngine } from "../../core/kernel/engine.js";
import { CORE_REASON_MESSAGES } from "../../core/kernel/reasons.js";
import type { KindRegistry } from "../../core/kernel/types.js";
import type { ContentRegistry } from "../../core/registry/types.js";
import { createSessionLayer } from "../../core/session/store.js";
import type { StoryGraphCampaign } from "./campaign.js";
import { storyGraphKind } from "./kind.js";

// C29 (20-contract §7): the one authored carrier — a choice's `requirementFailKey` can equal an
// engine key, and the response builder must not alias it.

// ── An authored reason key that equals an engine key (story-graph `requirementFailKey`) ──

const storyCampaign: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: { money: { type: "int", initial: 0, min: 0, max: 10 } },
  startNodeId: "start",
  achievements: [],
  nodes: {
    start: {
      id: "start",
      kind: "choice",
      textKey: "t",
      choices: [
        {
          id: "authored",
          labelKey: "choice.authored",
          requirements: { field: "var.money", operator: "greater_or_equal", value: 5 },
          requirementFailKey: "core.reason.requirement_unmet",
          goto: "start",
        },
        {
          id: "fallback",
          labelKey: "choice.fallback",
          requirements: { field: "var.money", operator: "greater_or_equal", value: 5 },
          goto: "start",
        },
      ],
    },
  },
};

describe("C29 — aliasEngineKeys: \"all\" aliases every engine-owned reference and nothing authored", () => {
  function storyStore() {
    const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
    const story: ContentRegistry = {
      campaigns: new Map([["story", { id: "story", kindId: "story-graph", version: "1", titleKey: "t", content: storyCampaign }]]),
      strings: new Map([...runningCatalog(kinds), ["t", "T"], ["d", "D"], ["choice.authored", "A"], ["choice.fallback", "F"]]),
    };
    const engine = createEngine({ kinds, registry: story, aliasEngineKeys: "all", ids: { newGameId: () => "g", newSeed: () => "s" } });
    return createSessionLayer({ engine, registry: story });
  }

  it("an authored requirementFailKey keeps its key; the engine fallback takes its alias", async () => {
    const store = storyStore();
    const { sessionId, scene } = await store.createSession({ campaignId: "story" });

    expect(scene.actions.map((action) => [action.id, action.reasonKey])).toEqual([
      ["authored", "core.reason.requirement_unmet"],
      ["fallback", "~core.reason.requirement_unmet"],
    ]);
    expect((await store.submitAction(sessionId, "authored")).errors.map((error) => error.messageKey)).toEqual(["core.reason.requirement_unmet"]);
    expect((await store.submitAction(sessionId, "fallback")).errors.map((error) => error.messageKey)).toEqual(["~core.reason.requirement_unmet"]);
    expect((await store.submitAction(sessionId, "no-such-action")).errors.map((error) => error.messageKey)).toEqual(["~core.reason.unknown_action"]);
  });

  it("getStrings carries each engine key's text at its alias, and not at the bare key", async () => {
    const store = storyStore();
    const { sessionId } = await store.createSession({ campaignId: "story" });
    const strings = await store.getStrings(sessionId);
    expect(strings["~core.reason.requirement_unmet"]).toBe(CORE_REASON_MESSAGES.get("core.reason.requirement_unmet"));
    expect(strings["core.reason.requirement_unmet"]).toBeUndefined();
    expect(strings["choice.authored"]).toBe("A");
  });
});
