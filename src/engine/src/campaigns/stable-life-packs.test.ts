/**
 * W71 — the first real culture pack exercises the W58 resolver against a simulation
 * campaign rather than its synthetic pack fixtures.  The campaign stays `stable-life` in
 * both resolutions; `Campaign.version` names the ordered pack resolution instead.
 */

import { describe, expect, it } from "vitest";
import { TextClient } from "../clients/text/client.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createEngine } from "../core/kernel/engine.js";
import { CORE_REASON_MESSAGES } from "../core/kernel/reasons.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { ReplayFixture } from "../core/replay/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { resolvePacks, type ContentPack } from "../core/registry/packs.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { bulgariaCulturePack, stableLifeBasePack } from "./stable-life-packs.js";
import { STABLE_LIFE_CAMPAIGN_ID } from "./stable-life.js";

const kinds = { simulation: simulationKind } as unknown as KindRegistry;
const SEED = "bulgaria-culture-pack-seed";
const WEEK_ACTIONS = [
  { actionId: "plan.add", params: { actionType: "rest" } },
  { actionId: "end_week" },
] as const;

/**
 * The whole path a host takes, in the order 20-contract.md §11 fixes it: fold the ordered
 * pack set, then run the folded result through `buildValidatedContentRegistry` — the
 * sanctioned entry point, and the only one that merges the core's `core.reason.*` and the
 * used kind's own `simulation.reason.*` messages into the frozen table. `resolvePacks`
 * knows only what the packs themselves ship, so a registry taken straight from the fold and
 * handed to `createEngine` renders every rejection as a bare `core.reason.*` key.
 *
 * `resolution` is carried across by hand because `buildContentRegistry` cannot carry it:
 * it takes `BuiltCampaign`s and "knows no packs exist" (04 §10.1), so the validated
 * registry it returns has none. Dropping it would leave the registry actually played
 * unable to name the mix it was folded from — the identity 11 §6 exists for, and the thing
 * `Campaign.version` is stamped with two tests below. **Known and retained:** no single
 * call produces both today, and closing that would mean changing a core signature, which
 * W71.2 puts out of this unit's scope.
 */
function resolve(packs: readonly ContentPack[]): ContentRegistry {
  const folded = resolvePacks(packs);
  if (!folded.ok || !folded.value) throw new Error("expected packs to resolve");
  const { campaigns, strings, resolution } = folded.value;
  // Optional on the type, but never absent on a folded registry (04 §10.1) — asserted
  // rather than spread away, so the carry-across below cannot silently become a no-op.
  if (resolution === undefined) throw new Error("expected the fold to name its resolution");

  const validated = buildValidatedContentRegistry(
    [...campaigns.values()].map((campaign) => ({ campaign, strings })),
    kinds,
  );
  if (!validated.ok || !validated.value) throw new Error("expected the folded registry to validate");

  return { ...validated.value, resolution };
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

    // Neither table is the packs' own strings alone. The fold ships 24 keys and no reason
    // messages at all; assembly is what merges the core's and the kind's in (20 §11), and a
    // registry missing them renders every rejection as a bare key to the player.
    for (const registry of [base, bulgaria]) {
      expect(registry.strings.has("core.reason.unknown_action")).toBe(true);
      expect([...registry.strings.keys()].some((key) => key.startsWith("simulation.reason."))).toBe(true);
    }

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

  /**
   * The other half of 11 §3 — campaigns replace *wholesale by id*, not field by field.
   * Checked by reference rather than by value on purpose: until W72 authors the Bulgarian
   * setting the two campaigns are deep-equal, so a value comparison would pass just as
   * happily against the base pack's campaign, or against a Bulgaria pack shipping no
   * campaign at all. `resolvePacks` shallow-spreads the winning campaign to stamp its
   * `version`, which leaves `content` the very object the pack supplied.
   */
  it("replaces the campaign wholesale, keeping the later pack's own campaign object", () => {
    const baseContent = stableLifeBasePack.campaigns[0]?.campaign.content;
    const bulgarianContent = bulgariaCulturePack.campaigns[0]?.campaign.content;
    expect(bulgarianContent).toBeDefined();
    expect(bulgarianContent).not.toBe(baseContent);

    expect(resolve([stableLifeBasePack]).campaigns.get(STABLE_LIFE_CAMPAIGN_ID)?.content).toBe(baseContent);
    expect(resolve([stableLifeBasePack, bulgariaCulturePack]).campaigns.get(STABLE_LIFE_CAMPAIGN_ID)?.content)
      .toBe(bulgarianContent);
  });

  /**
   * `computeResolutionId` digests `{id, version}` and nothing else, so a pack whose version
   * did not move with its content would hand a stale `ResolutionId` to every save and
   * fixture captured against it. Neither pack authors its campaign here — both build it
   * from `stable-life.ts` — so both versions are derived from a digest of what they ship.
   * Two packs shipping different strings must therefore carry different versions.
   */
  it("derives each pack's version from the content it ships", () => {
    expect(stableLifeBasePack.version).toMatch(/^1\.0\.0\+[0-9a-f]{12}$/);
    expect(bulgariaCulturePack.version).toMatch(/^1\.0\.0\+[0-9a-f]{12}$/);
    expect(stableLifeBasePack.version).not.toBe(bulgariaCulturePack.version);
    // The declared dependency tracks the derived version rather than restating it; a stale
    // literal would fail the fold with `pack_dependency_missing`, which `resolve` throws on.
    expect(bulgariaCulturePack.dependsOn).toEqual([
      { id: stableLifeBasePack.id, version: stableLifeBasePack.version },
    ]);
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

    // A rejection is the surface that catches a registry assembled the wrong way: the text
    // client resolves a reason code against the session's own string table and falls back to
    // the raw key when it is absent (`clients/text/render.ts`), so a registry taken straight
    // from `resolvePacks` shows the player the literal string "core.reason.unknown_action".
    const rejected = await client.submitAction(started.value.sessionId, "no_such_action");
    expect(rejected.value.ok).toBe(false);
    expect(rejected.text).toBe(CORE_REASON_MESSAGES.get("core.reason.unknown_action"));
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
