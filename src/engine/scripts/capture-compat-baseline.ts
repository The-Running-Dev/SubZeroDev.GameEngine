/**
 * W104.2 — captures, per built-in campaign registry, the canonical runtime content an 0.11
 * candidate must still reproduce: the initial `Scene` (bundling projection, available
 * actions, and status) a fixed seed/`IdSource` produces, plus the registry's own Tier-1/2
 * validation findings.
 *
 * Run once per side of a compatibility comparison — at a baseline tag to freeze
 * `fixtures/compat/<label>.json`, and at HEAD by `compatBaseline.test.ts` to diff against
 * what was frozen. Not part of the published package (`scripts/` is dev-only tooling); the
 * frozen JSON it writes is the artifact that ships.
 *
 * `tsx scripts/capture-compat-baseline.ts <output-dir>`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createEngine } from "../src/core/kernel/engine.js";
import { createInMemorySessionStore } from "../src/core/session/store.js";
import { createInMemoryProfileStore } from "../src/core/session/profile-store.js";
import { createCountingIds } from "../src/core/determinism/counting-ids.js";
import { TextClient } from "../src/clients/text/client.js";
import { buildValidatedContentRegistry } from "../src/core/validation/tiered.js";
import { resolveStableLifeRegistry, stableLifeBasePack, bulgariaCulturePack } from "../src/campaigns/stable-life-packs.js";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildStableLifeCampaign } from "../src/campaigns/stable-life.js";
import { buildStableLifeEffectsCampaign } from "../src/campaigns/stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "../src/campaigns/stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "../src/campaigns/stable-life-possessions.js";
import { buildStableLifeEventsCampaign } from "../src/campaigns/stable-life-events.js";
import { buildLongHorizonWinCampaign, buildLongHorizonLossCampaign } from "../src/campaigns/long-horizon.js";
import { buildWorldGraphMvpCampaign } from "../src/campaigns/world-graph-mvp.js";
import { storyGraphKind } from "../src/kinds/story-graph/kind.js";
import { simulationKind } from "../src/kinds/simulation/kind.js";
import { worldGraphKind } from "../src/kinds/world-graph/kind.js";
import type { KindRegistry } from "../src/core/kernel/types.js";
import type { ContentRegistry } from "../src/core/registry/types.js";
import type { CommandResult } from "../src/core/kernel/reasons.js";

const FIXED_SEED = "w104-compat-baseline-seed";

interface Entry {
  readonly label: string;
  readonly campaignId: string;
  readonly kinds: KindRegistry;
  readonly buildRegistry: () => CommandResult<ContentRegistry>;
}

const STORY_GRAPH_KINDS = { "story-graph": storyGraphKind } as unknown as KindRegistry;
const SIMULATION_KINDS = { simulation: simulationKind } as unknown as KindRegistry;
const WORLD_GRAPH_KINDS = { "world-graph": worldGraphKind } as unknown as KindRegistry;

function ok<T>(result: CommandResult<T>, what: string): CommandResult<T> {
  if (!result.ok) throw new Error(`expected ${what} to build/validate — ${JSON.stringify(result.errors)}`);
  return result;
}

export const ENTRIES: readonly Entry[] = [
  {
    label: "bulgaria-bureaucracy",
    campaignId: "bulgaria-bureaucracy",
    kinds: STORY_GRAPH_KINDS,
    buildRegistry: () => {
      const built = ok(buildBulgariaBureaucracyCampaign(), "bulgaria-bureaucracy");
      return buildValidatedContentRegistry([built.value!], STORY_GRAPH_KINDS);
    },
  },
  {
    label: "stable-life",
    campaignId: "stable-life",
    kinds: SIMULATION_KINDS,
    buildRegistry: () => {
      const built = ok(buildStableLifeCampaign(), "stable-life");
      const effects = ok(buildStableLifeEffectsCampaign(), "stable-life-effects");
      const housing = ok(buildStableLifeHousingCampaign(), "stable-life-housing");
      const possessions = ok(buildStableLifePossessionsCampaign(), "stable-life-possessions");
      const events = ok(buildStableLifeEventsCampaign(), "stable-life-events");
      return buildValidatedContentRegistry(
        [built.value!, effects.value!, housing.value!, possessions.value!, events.value!],
        SIMULATION_KINDS,
      );
    },
  },
  {
    label: "long-horizon-win",
    campaignId: "long-horizon-win",
    kinds: SIMULATION_KINDS,
    buildRegistry: () => {
      const win = ok(buildLongHorizonWinCampaign(), "long-horizon-win");
      const loss = ok(buildLongHorizonLossCampaign(), "long-horizon-loss");
      return buildValidatedContentRegistry([win.value!, loss.value!], SIMULATION_KINDS);
    },
  },
  {
    label: "world-graph-mvp",
    campaignId: "world-graph-mvp",
    kinds: WORLD_GRAPH_KINDS,
    buildRegistry: () => {
      const built = ok(buildWorldGraphMvpCampaign(), "world-graph-mvp");
      return buildValidatedContentRegistry([built.value!], WORLD_GRAPH_KINDS);
    },
  },
  {
    label: "stable-life-bulgaria-pack",
    campaignId: "stable-life",
    kinds: SIMULATION_KINDS,
    buildRegistry: () => resolveStableLifeRegistry([stableLifeBasePack, bulgariaCulturePack], SIMULATION_KINDS),
  },
];

export async function captureEntry(entry: Entry): Promise<unknown> {
  const registryResult = entry.buildRegistry();
  if (!registryResult.ok || !registryResult.value) {
    throw new Error(`expected ${entry.label}'s registry to validate — ${JSON.stringify(registryResult.errors)}`);
  }
  const registry = registryResult.value;
  const engine = createEngine({ kinds: entry.kinds, registry, ids: createCountingIds() });
  const store = createInMemorySessionStore({ engine, registry, profiles: createInMemoryProfileStore() });
  const client = new TextClient(store);
  const { value } = await client.createSession({ campaignId: entry.campaignId, seed: FIXED_SEED });

  return {
    label: entry.label,
    campaignId: entry.campaignId,
    validation: { errors: registryResult.errors, warnings: registryResult.warnings },
    initialScene: value.scene,
  };
}

async function main() {
  const outputDir = process.argv[2];
  if (!outputDir) throw new Error("usage: tsx capture-compat-baseline.ts <output-dir>");
  mkdirSync(outputDir, { recursive: true });
  for (const entry of ENTRIES) {
    const captured = await captureEntry(entry);
    const path = `${outputDir}/${entry.label}.json`;
    writeFileSync(path, `${JSON.stringify(captured, null, 2)}\n`, "utf8");
    console.log(`wrote ${path}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
