/**
 * A second locale, end to end (W60, `design/30-slices.md`).
 *
 * Proves `04-core.md` §10.1's own claim — "additional locales are post-MVP and need no
 * type change, only more string tables" — against a real shipped campaign rather than a
 * synthetic fixture. `bulgaria-bureaucracy.ts` (English) and `bulgaria-bureaucracy.bg.ts`
 * (Bulgarian) share the same campaign id, namespace, and node/route/ending ids; only the
 * authored text differs.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { buildCampaign } from "../core/registry/build.js";
import { resolveLocKey } from "../core/localization/resolve.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { TextClient } from "../clients/text/client.js";
import { createMcpTools } from "../mcp/server.js";
import type { Engine, KindRegistry } from "../core/kernel/types.js";
import type { AuthoredText, BuiltCampaign, ContentRegistry } from "../core/registry/types.js";
import type { IdSource } from "../core/composition/types.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";
import { buildBulgariaBureaucracyCampaignBG } from "./bulgaria-bureaucracy.bg.js";

const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
const SEED = "w60-locale-seed";
const FIXED_IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

function builtEN(): BuiltCampaign {
  const result = buildBulgariaBureaucracyCampaign();
  if (!result.ok || !result.value) throw new Error("expected the English Bureaucracy campaign to build");
  return result.value;
}

function builtBG(): BuiltCampaign {
  const result = buildBulgariaBureaucracyCampaignBG();
  if (!result.ok || !result.value) throw new Error("expected the Bulgarian Bureaucracy campaign to build");
  return result.value;
}

function registryFor(built: BuiltCampaign): ContentRegistry {
  const result = buildValidatedContentRegistry([built], kinds);
  if (!result.ok || !result.value) throw new Error(`expected the registry to build: ${JSON.stringify(result.errors)}`);
  return result.value;
}

describe("W60 — a second locale, end to end", () => {
  it("W60.1 — the Bulgarian source builds a registry with no type change, and the two locales share identical content", () => {
    const en = builtEN();
    const bg = builtBG();

    // Same campaign identity, same structure — only `strings` differs, because
    // `StoryGraphCampaign` content carries LocKeys only (never raw text).
    expect(bg.campaign.id).toBe(en.campaign.id);
    expect(bg.campaign.content).toEqual(en.campaign.content);
    expect(bg.strings).not.toEqual(en.strings);
    expect(new Set(bg.strings.keys())).toEqual(new Set(en.strings.keys()));

    const registry = registryFor(bg);
    expect(registry.campaigns.get(BULGARIA_BUREAUCRACY_CAMPAIGN_ID)).toBeDefined();
    expect(registry.strings.get("bureaucracy.campaign.title")).toBe("Бюрокрацията");
  });

  it("W60.2 — a key present in English and absent in Bulgarian fails Tier 1 with the key's path", () => {
    const bg = builtBG();
    const missingKey = "bureaucracy.campaign.title";
    expect(bg.strings.has(missingKey)).toBe(true);

    const trimmedStrings = new Map(bg.strings);
    trimmedStrings.delete(missingKey);
    const trimmed: BuiltCampaign = { campaign: bg.campaign, strings: trimmedStrings };

    const result = buildValidatedContentRegistry([trimmed], kinds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_string_key" && e.path === missingKey)).toBe(true);
  });

  it("W60.3 — core.reason.* messages resolve in the Bulgarian registry, and a campaign override attempt is still rejected", () => {
    const registry = registryFor(builtBG());
    expect(resolveLocKey(registry.strings, "core.reason.unknown_action")).toBeDefined();

    const bg = builtBG();
    const overrideAttempt: AuthoredText[] = [{ key: "core.reason.unknown_action", text: "Опит за презапис" }];
    const withOverride = buildCampaign(bg.campaign, overrideAttempt);
    expect(withOverride.ok).toBe(true); // buildCampaign itself doesn't police the namespace
    const merged = buildValidatedContentRegistry(
      [{ campaign: bg.campaign, strings: new Map([...bg.strings, ...withOverride.value!.strings]) }],
      kinds,
    );
    expect(merged.ok).toBe(false);
    expect(merged.errors.some((e) => e.code === "protected_string_key")).toBe(true);
  });

  it("W60.4 — the same seed and the same choices under either locale produce byte-identical serialize() output", () => {
    const enEngine = createEngine({ kinds, registry: registryFor(builtEN()), ids: FIXED_IDS });
    const bgEngine = createEngine({ kinds, registry: registryFor(builtBG()), ids: FIXED_IDS });

    const STEPS = 5;

    // Always submits the first available action — content and structure are locale-
    // independent (identical LocKeys, identical graph), so the same seed drives both
    // engines down the same path regardless of which locale's registry backs them.
    function play(engine: Engine): string {
      let state = engine.createGame({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED }).value!;
      for (let i = 0; i < STEPS; i++) {
        const actionId = engine.scene(state).actions[0]?.id;
        if (!actionId) break;
        const result = engine.submitAction(state, actionId);
        if (!result.ok || !result.value) throw new Error(`expected "${actionId}" to succeed: ${JSON.stringify(result.errors)}`);
        state = result.value;
      }
      return engine.serialize(state);
    }

    expect(play(bgEngine)).toBe(play(enEngine));
  });

  it("W60.5 — the text client and the MCP surface both render Bulgarian from the registry", async () => {
    const registry = registryFor(builtBG());
    const engine = createEngine({ kinds, registry, ids: FIXED_IDS });
    const store = createInMemorySessionStore({ engine, registry });
    const textClient = new TextClient(store);
    const mcpTools = createMcpTools(store);

    const started = await textClient.createSession({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED });
    expect(started.value.scene.body.text).toBe("Пристигате в общината в 08:03. Офисът отвори в 08:00. Ръкописна бележка казва, че срещата свършва в 11:30; три съседни врати не са съгласни за годината.");
    expect(started.text).toContain("Изчакайте общинския регистър");

    const strings = await mcpTools.get_strings({ sessionId: started.value.sessionId });
    expect(strings["bureaucracy.campaign.title"]).toBe("Бюрокрацията");
    expect(strings["bureaucracy.municipality.choice_wait"]).toBe("Изчакайте общинския регистър");
  });
});
