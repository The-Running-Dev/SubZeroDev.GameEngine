/**
 * W96.3 — the mechanical envelope-ownership gate.
 *
 * Contract: `04-core.md` §2 (`GameState`), §7.1's `Campaign`/`ContentRegistry` fields, §6/§9
 * (`Scene`/`PlayerView`). `AGENTS.md`'s *Where Drift Happens* ledger records five prior
 * defects where a kind's `kindState`, its campaign content, or its projection repeated a
 * field the envelope, `Campaign`, `ContentRegistry`, `Scene`, or `PlayerView` already owns.
 * Each fix was caught by hand; this is the mechanical version — it builds one real game per
 * shipped kind from that kind's own flagship campaign, and asserts none of the three
 * kind-owned surfaces (`kindState`, `campaign.content`, the projected `kindView`) declares a
 * *top-level* key an envelope type already owns. Nested entities (a `Guest.id`, a
 * `Building.status`) are unrelated — every ledger entry names a top-level collision.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import type { Engine, Kind, KindRegistry } from "../core/kernel/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "./stable-life.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign, WORLD_GRAPH_MVP_CAMPAIGN_ID } from "./world-graph-mvp.js";

// `GameState` (04 §2) — every field the envelope owns, including `kindState`/`actionLog`
// themselves, since neither belongs inside a kind's own state a second time.
const GAME_STATE_OWNED = new Set([
  "formatVersion", "gameId", "kindId", "campaignId", "campaignVersion", "seed", "status", "kindState", "actionLog",
]);

// `Campaign` (04 §10.1) plus `ContentRegistry`'s own top-level fields — a kind's `content`
// object must not repeat what the campaign envelope or the registry that resolves it own.
const CAMPAIGN_OWNED = new Set(["id", "kindId", "version", "titleKey", "content", "migrateState", "strings", "campaigns", "resolution"]);

// `Scene` (04 §6) and `PlayerView` (04 §9) — a kind's own projected view must not repeat
// the fields the envelope already bundles around it.
const VIEW_OWNED = new Set(["gameId", "status", "body", "actions", "view", "kindView"]);

function topLevelKeys(value: unknown): readonly string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected a plain object at the top level, got ${JSON.stringify(value)}`);
  }
  return Object.keys(value as Record<string, unknown>);
}

function assertNoOwnershipCollision(label: string, keys: readonly string[], owned: ReadonlySet<string>): void {
  const collisions = keys.filter((key) => owned.has(key));
  expect(collisions, `${label}: envelope-owned field(s) duplicated at the top level`).toEqual([]);
}

interface KindFixture {
  readonly label: string;
  readonly kindId: string;
  readonly kind: Kind<unknown>;
  readonly buildCampaign: () => CommandResult<BuiltCampaign>;
  readonly campaignId: string;
}

const FIXTURES: readonly KindFixture[] = [
  { label: "story-graph (bulgaria-bureaucracy)", kindId: "story-graph", kind: storyGraphKind, buildCampaign: buildBulgariaBureaucracyCampaign, campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID },
  { label: "simulation (stable-life)", kindId: "simulation", kind: simulationKind, buildCampaign: buildStableLifeCampaign, campaignId: STABLE_LIFE_CAMPAIGN_ID },
  { label: "world-graph (world-graph-mvp)", kindId: "world-graph", kind: worldGraphKind, buildCampaign: buildWorldGraphMvpCampaign, campaignId: WORLD_GRAPH_MVP_CAMPAIGN_ID },
];

function buildEngine(fixture: KindFixture): { engine: Engine; content: unknown } {
  const built = fixture.buildCampaign();
  if (!built.ok || !built.value) throw new Error(`${fixture.label}: expected the flagship campaign to build`);
  const kinds = { [fixture.kindId]: fixture.kind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error(`${fixture.label}: expected the flagship campaign to validate`);
  return { engine: createEngine({ kinds, registry: registryResult.value }), content: built.value.campaign.content };
}

describe("W96.3 mechanical envelope-ownership gate", () => {
  it.each(FIXTURES)("$label: kindState duplicates no GameState-owned field", (fixture) => {
    const { engine } = buildEngine(fixture);
    const created = engine.createGame({ campaignId: fixture.campaignId });
    if (!created.ok || !created.value) throw new Error(`${fixture.label}: expected createGame to succeed`);
    assertNoOwnershipCollision(fixture.label, topLevelKeys(created.value.kindState), GAME_STATE_OWNED);
  });

  it.each(FIXTURES)("$label: campaign content duplicates no Campaign/ContentRegistry-owned field", (fixture) => {
    const { content } = buildEngine(fixture);
    assertNoOwnershipCollision(fixture.label, topLevelKeys(content), CAMPAIGN_OWNED);
  });

  it.each(FIXTURES)("$label: the projected kindView duplicates no Scene/PlayerView-owned field", (fixture) => {
    const { engine } = buildEngine(fixture);
    const created = engine.createGame({ campaignId: fixture.campaignId });
    if (!created.ok || !created.value) throw new Error(`${fixture.label}: expected createGame to succeed`);
    const view = engine.view(created.value, "player");
    assertNoOwnershipCollision(fixture.label, topLevelKeys(view.kindView), VIEW_OWNED);
  });
});
