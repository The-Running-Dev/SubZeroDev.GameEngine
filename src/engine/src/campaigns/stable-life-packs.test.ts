/**
 * W71 — the first real culture pack exercises the W58 resolver against a simulation
 * campaign rather than its synthetic pack fixtures.  The campaign stays `stable-life` in
 * both resolutions; `Campaign.version` names the ordered pack resolution instead.
 */

import { describe, expect, it } from "vitest";
import { TextClient } from "../clients/text/client.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createEngine } from "../core/kernel/engine.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { ReplayFixture } from "../core/replay/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { resolvePacks } from "../core/registry/packs.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { bulgariaCulturePack, stableLifeBasePack } from "./stable-life-packs.js";
import { STABLE_LIFE_CAMPAIGN_ID } from "./stable-life.js";

const kinds = { simulation: simulationKind } as unknown as KindRegistry;
const SEED = "bulgaria-culture-pack-seed";
const WEEK_ACTIONS = [
  { actionId: "plan.add", params: { actionType: "rest" } },
  { actionId: "end_week" },
] as const;

function resolve(...packs: Parameters<typeof resolvePacks>): ContentRegistry {
  const result = resolvePacks(...packs);
  if (!result.ok || !result.value) throw new Error("expected packs to resolve");
  return result.value;
}

function validate(registry: ContentRegistry): void {
  const result = buildValidatedContentRegistry(
    [...registry.campaigns.values()].map((campaign) => ({ campaign, strings: registry.strings })),
    kinds,
  );
  expect(result.ok).toBe(true);
}

function replayContext(registry: ContentRegistry): ReplayRunnerContext {
  return {
    engine: createEngine({ kinds, registry }),
    kinds,
    registry,
    profiles: createInMemoryProfileStore(),
    profileId: "w71-replay-profile",
  };
}

function serializeWeek(registry: ContentRegistry): string {
  const engine = createEngine({ kinds, registry, ids: createCountingIds() });
  const created = engine.createGame({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED });
  if (!created.ok || !created.value) throw new Error("expected Bulgarian game to start");
  let state = created.value;
  for (const action of WEEK_ACTIONS) {
    const result = engine.submitAction(state, action.actionId, "params" in action ? action.params : undefined);
    if (!result.ok || !result.value) throw new Error(`expected ${action.actionId} to succeed`);
    state = result.value;
  }
  return engine.serialize(state);
}

describe("W71 — Stable Life Bulgaria culture pack", () => {
  it("folds the base and Bulgaria packs into valid registries, changing exactly the declared strings", () => {
    const base = resolve([stableLifeBasePack]);
    const bulgaria = resolve([stableLifeBasePack, bulgariaCulturePack]);
    validate(base);
    validate(bulgaria);

    const overridden = new Set(bulgariaCulturePack.strings.keys());
    for (const [key, baseText] of base.strings) {
      const bulgarianText = bulgaria.strings.get(key);
      expect(bulgarianText).toBeDefined();
      expect(bulgarianText === baseText).toBe(!overridden.has(key));
    }
    expect([...bulgaria.strings.keys()].sort()).toEqual([...base.strings.keys()].sort());
  });

  it("uses distinct resolution ids as the campaign version", () => {
    const base = resolve([stableLifeBasePack]);
    const bulgaria = resolve([stableLifeBasePack, bulgariaCulturePack]);
    expect(base.resolution).not.toBe(bulgaria.resolution);
    expect(base.campaigns.get(STABLE_LIFE_CAMPAIGN_ID)?.version).toBe(base.resolution);
    expect(bulgaria.campaigns.get(STABLE_LIFE_CAMPAIGN_ID)?.version).toBe(bulgaria.resolution);
  });

  it("plays a Bulgarian week through the text client without rendering base Stable Life text", async () => {
    const registry = resolve([stableLifeBasePack, bulgariaCulturePack]);
    const engine = createEngine({ kinds, registry });
    const client = new TextClient(createInMemorySessionStore({ engine, registry }));
    const started = await client.createSession({ campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED });
    const planned = await client.submitAction(started.value.sessionId, "plan.add", { actionType: "rest" });
    const ended = await client.submitAction(started.value.sessionId, "end_week");
    const view = await client.getView(started.value.sessionId);

    expect(planned.text).toContain("Добави към плана");
    expect(ended.text).toContain("Приключи седмицата");
    expect(view.value.kindView).toBeDefined();
    expect(`${started.text}\n${planned.text}\n${ended.text}`).not.toContain("Stable Life");
  });

  it("marks a replay captured under the Bulgarian resolution as campaign_version_missing under base", async () => {
    const base = resolve([stableLifeBasePack]);
    const bulgaria = resolve([stableLifeBasePack, bulgariaCulturePack]);
    const fixture: ReplayFixture = {
      name: "bulgaria-stable-life-week",
      capturedUnder: "W71",
      config: { campaignId: STABLE_LIFE_CAMPAIGN_ID, seed: SEED },
      campaignVersion: bulgaria.resolution!,
      submissions: [...WEEK_ACTIONS],
    };
    const expected = { finalStatus: "active", acceptedActions: 2, decisions: [], achievements: [], terminal: null } as const;

    expect(await runReplayFixture(replayContext(base), fixture, expected)).toEqual({
      kind: "unrunnable",
      reason: "campaign_version_missing",
    });
  });

  it("replays the same Bulgarian seed and actions byte-identically", () => {
    const registry = resolve([stableLifeBasePack, bulgariaCulturePack]);
    expect(serializeWeek(registry)).toBe(serializeWeek(registry));
  });
});
