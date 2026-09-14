/**
 * W104.1 / W104.3 — builds the representative active/ended `SaveEnvelope` per kind that the
 * compatibility sweep's manifest names (`30-slices.md` § W104). Each is a real save: the
 * committed replay fixture named below is run to the point its own name implies (a
 * non-terminal fixture stops wherever its submissions end; a terminal one runs to its own
 * recorded ending), then wrapped with `buildSaveEnvelope` exactly as `SessionStore.saveGame`
 * would.
 *
 * `tsx scripts/capture-save-fixtures.ts <output-dir>`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createEngine } from "../src/core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../src/core/validation/tiered.js";
import { buildSaveEnvelope, serializeSaveEnvelope } from "../src/core/persistence/envelope.js";
import { loadFixture } from "../src/campaigns/replay-corpus.js";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildStableLifeCampaign } from "../src/campaigns/stable-life.js";
import { buildStableLifeEffectsCampaign } from "../src/campaigns/stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "../src/campaigns/stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "../src/campaigns/stable-life-possessions.js";
import { buildStableLifeEventsCampaign } from "../src/campaigns/stable-life-events.js";
import { buildWorldGraphMvpCampaign } from "../src/campaigns/world-graph-mvp.js";
import { storyGraphKind } from "../src/kinds/story-graph/kind.js";
import { simulationKind } from "../src/kinds/simulation/kind.js";
import { worldGraphKind } from "../src/kinds/world-graph/kind.js";
import type { Engine, GameState, KindRegistry } from "../src/core/kernel/types.js";
import type { ContentRegistry } from "../src/core/registry/types.js";

const STORY_GRAPH_KINDS = { "story-graph": storyGraphKind } as unknown as KindRegistry;
const SIMULATION_KINDS = { simulation: simulationKind } as unknown as KindRegistry;
const WORLD_GRAPH_KINDS = { "world-graph": worldGraphKind } as unknown as KindRegistry;

export function buildRegistry(kindId: "story-graph" | "simulation" | "world-graph"): { kinds: KindRegistry; registry: ContentRegistry } {
  if (kindId === "story-graph") {
    const built = buildBulgariaBureaucracyCampaign();
    if (!built.ok || !built.value) throw new Error("expected bulgaria-bureaucracy to build");
    const result = buildValidatedContentRegistry([built.value], STORY_GRAPH_KINDS);
    if (!result.ok || !result.value) throw new Error("expected bulgaria-bureaucracy to validate");
    return { kinds: STORY_GRAPH_KINDS, registry: result.value };
  }
  if (kindId === "simulation") {
    const built = buildStableLifeCampaign();
    const effects = buildStableLifeEffectsCampaign();
    const housing = buildStableLifeHousingCampaign();
    const possessions = buildStableLifePossessionsCampaign();
    const events = buildStableLifeEventsCampaign();
    if (!built.ok || !built.value) throw new Error("expected stable-life to build");
    if (!effects.ok || !effects.value) throw new Error("expected stable-life-effects to build");
    if (!housing.ok || !housing.value) throw new Error("expected stable-life-housing to build");
    if (!possessions.ok || !possessions.value) throw new Error("expected stable-life-possessions to build");
    if (!events.ok || !events.value) throw new Error("expected stable-life-events to build");
    const result = buildValidatedContentRegistry(
      [built.value, effects.value, housing.value, possessions.value, events.value],
      SIMULATION_KINDS,
    );
    if (!result.ok || !result.value) throw new Error("expected the Stable Life family to validate");
    return { kinds: SIMULATION_KINDS, registry: result.value };
  }
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("expected world-graph-mvp to build");
  const result = buildValidatedContentRegistry([built.value], WORLD_GRAPH_KINDS);
  if (!result.ok || !result.value) throw new Error("expected world-graph-mvp to validate");
  return { kinds: WORLD_GRAPH_KINDS, registry: result.value };
}

function runFixtureToState(engine: Engine, fixtureName: string): GameState {
  const fixture = loadFixture(fixtureName);
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`"${fixtureName}": createGame rejected`);
  let state = created.value;
  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (result.ok && result.value) state = result.value;
  }
  return state;
}

export interface SaveFixtureEntry {
  readonly name: string;
  readonly kindId: "story-graph" | "simulation" | "world-graph";
  readonly fixtureName: string;
  /** Whether the source fixture's own submissions reach a terminal state (07-replay.md's
   *  own `Outcome.terminal`) — determines `replayCompatible`: an ended save was never
   *  migrated, so its lineage is still replay-compatible; W104.3 only exercises the
   *  no-migration load path either way (20-contract.md — no shipped campaign has moved
   *  version yet). */
  readonly terminal: boolean;
}

export const SAVE_FIXTURES: readonly SaveFixtureEntry[] = [
  { name: "story-graph-active", kindId: "story-graph", fixtureName: "bureaucracy-mid-arc", terminal: false },
  { name: "story-graph-ended", kindId: "story-graph", fixtureName: "bureaucracy-full-arc", terminal: true },
  { name: "simulation-active", kindId: "simulation", fixtureName: "stable-life-education", terminal: false },
  { name: "simulation-ended", kindId: "simulation", fixtureName: "stable-life-win", terminal: true },
  { name: "world-graph-active", kindId: "world-graph", fixtureName: "world-graph-mvp-restock", terminal: false },
  { name: "world-graph-ended", kindId: "world-graph", fixtureName: "world-graph-mvp-win", terminal: true },
];

async function main() {
  const outputDir = process.argv[2];
  if (!outputDir) throw new Error("usage: tsx capture-save-fixtures.ts <output-dir>");
  mkdirSync(outputDir, { recursive: true });

  for (const entry of SAVE_FIXTURES) {
    const { kinds, registry } = buildRegistry(entry.kindId);
    const engine = createEngine({ kinds, registry, ids: { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" } });
    const state = runFixtureToState(engine, entry.fixtureName);
    const kind = kinds[entry.kindId]!;
    const campaign = registry.campaigns.get(state.campaignId);
    if (!campaign) throw new Error(`"${entry.name}": campaign ${state.campaignId} missing from registry`);
    const envelope = buildSaveEnvelope({ state, kind, campaign, replayCompatible: true });
    const path = `${outputDir}/${entry.name}.json`;
    writeFileSync(path, `${serializeSaveEnvelope(envelope)}\n`, "utf8");
    console.log(`wrote ${path}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
