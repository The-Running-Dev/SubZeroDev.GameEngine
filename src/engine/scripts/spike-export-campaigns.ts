/**
 * SPIKE — exports built campaigns as portable JSON.
 *
 * Throwaway. See `plans/spike-notes.md`. Lives outside `src/`, same as `demo-cli.ts`, so
 * neither the determinism guard nor the dependency-arrow rule applies here — this is an
 * authoring-time tool, not shipped engine code.
 *
 * Run with `npm run spike:export` from `src/engine/`. Writes one JSON file per campaign to
 * `../../site/public/campaigns/`, plus a manifest listing them in catalog order.
 */

import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBulgariaBureaucracyCampaign, bulgariaBureaucracyCatalog, bulgariaBureaucracyMigration } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildSakiQuestCampaign, sakiQuestCatalog } from "../src/campaigns/saki-quest-for-redemption.js";
import { toPortable, type PortableCampaign } from "../src/spike/portable.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { PortableCatalog, PortableMigration } from "../src/spike/portable.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../../site/public/campaigns");

interface Entry {
  readonly build: () => { ok: boolean; value?: BuiltCampaign; errors: readonly unknown[] };
  readonly catalog: PortableCatalog;
  readonly migration?: PortableMigration;
}

const entries: readonly Entry[] = [
  { build: buildBulgariaBureaucracyCampaign, catalog: bulgariaBureaucracyCatalog, migration: bulgariaBureaucracyMigration },
  { build: buildSakiQuestCampaign, catalog: sakiQuestCatalog },
];

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const manifest: string[] = [];

  for (const entry of entries) {
    const result = entry.build();
    if (!result.ok || result.value === undefined) {
      console.error(`Build failed: ${JSON.stringify(result.errors)}`);
      process.exitCode = 1;
      continue;
    }
    const portable: PortableCampaign = toPortable(result.value, entry.catalog, entry.migration);
    const fileName = `${portable.campaign.id}.json`;
    await writeFile(path.join(outDir, fileName), `${JSON.stringify(portable, null, 2)}\n`, "utf8");
    manifest.push(fileName);
    console.log(`Wrote ${fileName} (${Object.keys(portable.strings).length} strings)`);
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify({ formatVersion: 1, campaigns: manifest }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote manifest.json (${manifest.length} campaigns)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
