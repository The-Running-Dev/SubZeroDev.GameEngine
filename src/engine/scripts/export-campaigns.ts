/**
 * Exports built campaigns as portable JSON.
 *
 * Graduated from `scripts/spike-export-campaigns.ts` alongside the format it exports
 * (`src/portable/format.ts`). Still lives outside `src/`, same as `demo-cli.ts`, so neither
 * the determinism guard nor the dependency-arrow rule applies here — this is an
 * authoring-time tool, not shipped engine code.
 *
 * Run with `npm run export:campaigns` from `src/engine/`. Writes one JSON file per campaign
 * to `../../site/public/campaigns/`, plus a manifest listing them in catalog order.
 *
 * **Run `npx prettier --write public/campaigns/*.json` from `site/` afterward.** Plain
 * `JSON.stringify(x, null, 2)` always expands every array element onto its own line;
 * Prettier collapses one short enough to fit `printWidth` onto one line instead
 * (`site`'s own `format:check` gate caught this the first time this script's output changed
 * under CI). Not worth wiring as an automatic post-step here — this script has no dependency
 * on `site`'s tooling today, and one array-formatting rule does not justify adding one.
 *

 * Aborts hard on any campaign build failure and writes nothing — pre-graduation, a failed
 * campaign only logged and `continue`d, so a partial export still produced a valid-looking
 * manifest. Under fetch-at-runtime (`SubZeroDev.Adventures.Content` publishes this output),
 * that would be a silent content regression rather than a build failure: a manifest listing
 * a file this run never wrote, or a resolution digest computed over an incomplete set.
 */

import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWhatWouldLuciferDoCampaign,
  whatWouldLuciferDoCatalog,
  whatWouldLuciferDoMigration,
} from "../src/campaigns/what-would-lucifer-do.js";
import {
  buildWhatWouldLuciferDoEngineersCutCampaign,
  whatWouldLuciferDoEngineersCutCatalog,
} from "../src/campaigns/what-would-lucifer-do-engineers-cut.js";
import { buildLuciferChroniclesCampaign, luciferChroniclesCatalog, luciferChroniclesMigration } from "../src/campaigns/lucifer-chronicles.js";
import { buildBulgariaBureaucracyCampaign, bulgariaBureaucracyCatalog, bulgariaBureaucracyMigration } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildBulgariaReturnCampaign, bulgariaReturnCatalog, bulgariaReturnMigration } from "../src/campaigns/bulgaria-return.js";
import { buildBulgariaDrivingCampaign, bulgariaDrivingCatalog, bulgariaDrivingMigration } from "../src/campaigns/bulgaria-driving.js";
import { buildBulgariaInheritanceCampaign, bulgariaInheritanceCatalog, bulgariaInheritanceMigration } from "../src/campaigns/bulgaria-inheritance.js";
import { buildBulgariaEnterpriseCampaign, bulgariaEnterpriseCatalog, bulgariaEnterpriseMigration } from "../src/campaigns/bulgaria-enterprise.js";
import { buildSakiQuestCampaign, sakiQuestCatalog } from "../src/campaigns/saki-quest-for-redemption.js";
import { toPortable, type PortableCampaign, type PortableManifestEntry } from "../src/portable/format.js";
import { digestManifestResolution, digestPortableCampaign } from "../src/portable/digest.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { PortableCatalog, PortableMigration } from "../src/portable/format.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../../site/public/campaigns");

interface Entry {
  readonly build: () => { ok: boolean; value?: BuiltCampaign; errors: readonly unknown[] };
  readonly catalog: PortableCatalog;
  readonly migration?: PortableMigration;
}

const entries: readonly Entry[] = [
  { build: buildWhatWouldLuciferDoCampaign, catalog: whatWouldLuciferDoCatalog, migration: whatWouldLuciferDoMigration },
  { build: buildWhatWouldLuciferDoEngineersCutCampaign, catalog: whatWouldLuciferDoEngineersCutCatalog },
  { build: buildLuciferChroniclesCampaign, catalog: luciferChroniclesCatalog, migration: luciferChroniclesMigration },
  { build: buildBulgariaBureaucracyCampaign, catalog: bulgariaBureaucracyCatalog, migration: bulgariaBureaucracyMigration },
  { build: buildBulgariaReturnCampaign, catalog: bulgariaReturnCatalog, migration: bulgariaReturnMigration },
  { build: buildBulgariaDrivingCampaign, catalog: bulgariaDrivingCatalog, migration: bulgariaDrivingMigration },
  { build: buildBulgariaInheritanceCampaign, catalog: bulgariaInheritanceCatalog, migration: bulgariaInheritanceMigration },
  { build: buildBulgariaEnterpriseCampaign, catalog: bulgariaEnterpriseCatalog, migration: bulgariaEnterpriseMigration },
  { build: buildSakiQuestCampaign, catalog: sakiQuestCatalog },
];

/** Builds every entry first, writes nothing until every build has succeeded — the abort
 *  this graduation adds. Returns the built portables in source order. */
function buildAllOrAbort(): readonly PortableCampaign[] {
  const portables: PortableCampaign[] = [];
  const failures: string[] = [];

  for (const entry of entries) {
    const result = entry.build();
    if (!result.ok || result.value === undefined) {
      failures.push(`  - ${JSON.stringify(result.errors)}`);
      continue;
    }
    portables.push(toPortable(result.value, entry.catalog, entry.migration));
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} of ${entries.length} campaign build(s) failed, writing nothing:\n${failures.join("\n")}`);
  }

  return portables;
}

async function main(): Promise<void> {
  const portables = buildAllOrAbort();

  await mkdir(outDir, { recursive: true });

  const manifestEntries: PortableManifestEntry[] = [];
  for (const portable of portables) {
    const fileName = `${portable.campaign.id}.json`;
    await writeFile(path.join(outDir, fileName), `${JSON.stringify(portable, null, 2)}\n`, "utf8");
    manifestEntries.push({
      file: fileName,
      id: portable.campaign.id,
      version: portable.campaign.version,
      digest: digestPortableCampaign(portable),
    });
    console.log(`Wrote ${fileName} (${Object.keys(portable.strings).length} strings)`);
  }

  const manifest = {
    formatVersion: 2 as const,
    campaigns: manifestEntries,
    resolution: digestManifestResolution(manifestEntries),
  };
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote manifest.json (${manifestEntries.length} campaigns)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
