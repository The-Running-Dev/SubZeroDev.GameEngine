/**
 * W104.1 — the compatibility-sweep manifest's remaining entries: every 0.10 built-in
 * campaign and its recorded version, and the representative-save/compat-baseline fixtures
 * `capture-save-fixtures.ts`/`capture-compat-baseline.ts` produce. Hosts and the packed
 * consumer surface are already named in `core/validation/regressionManifest.test.ts`
 * (W104.1's first half, landed by #447) — this is the second half, kept in `scripts/`
 * alongside the two producers rather than duplicated there, since both already import
 * every builder this file would otherwise re-import.
 *
 * Each `it.each` fails the moment a named file disappears or a campaign's version moves
 * without this list being updated to match — the same "an entry disappears without an
 * explicit replacement/evidence note" failure mode W104.1 names.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildStableLifeCampaign } from "../src/campaigns/stable-life.js";
import { buildStableLifeEffectsCampaign } from "../src/campaigns/stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "../src/campaigns/stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "../src/campaigns/stable-life-possessions.js";
import { buildStableLifeEventsCampaign } from "../src/campaigns/stable-life-events.js";
import { buildLongHorizonWinCampaign, buildLongHorizonLossCampaign } from "../src/campaigns/long-horizon.js";
import { buildWorldGraphMvpCampaign } from "../src/campaigns/world-graph-mvp.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { CommandResult } from "../src/core/kernel/reasons.js";
import { ENTRIES as COMPAT_BASELINE_ENTRIES } from "./capture-compat-baseline.js";
import { SAVE_FIXTURES } from "./capture-save-fixtures.js";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const COMPAT_BASELINE_DIR = fileURLToPath(new URL("../fixtures/compat/v0.10.0/", import.meta.url));
const SAVES_DIR = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));

/** Every 0.10 built-in campaign this compatibility sweep tracks, and the version it shipped
 *  at — the manifest half W104.1 names. A version bump here without a corresponding,
 *  separately-approved compatibility decision is exactly the silent drift the sweep exists
 *  to catch. */
const BUILT_IN_CAMPAIGNS: ReadonlyArray<{ name: string; version: string; build: () => CommandResult<BuiltCampaign> }> = [
  { name: "bulgaria-bureaucracy", version: "2.0.0", build: buildBulgariaBureaucracyCampaign },
  { name: "stable-life", version: "1.0.0", build: buildStableLifeCampaign },
  { name: "stable-life-effects", version: "1.0.0", build: buildStableLifeEffectsCampaign },
  { name: "stable-life-housing", version: "1.0.0", build: buildStableLifeHousingCampaign },
  { name: "stable-life-possessions", version: "1.0.0", build: buildStableLifePossessionsCampaign },
  { name: "stable-life-events", version: "1.0.0", build: buildStableLifeEventsCampaign },
  { name: "long-horizon-win", version: "1.0.0", build: buildLongHorizonWinCampaign },
  { name: "long-horizon-loss", version: "1.0.0", build: buildLongHorizonLossCampaign },
  { name: "world-graph-mvp", version: "1.0.0", build: buildWorldGraphMvpCampaign },
];

describe("W104.1 compatibility-sweep manifest — built-in campaigns and versions", () => {
  it.each(BUILT_IN_CAMPAIGNS)("$name is still recorded at $version", ({ build, version, name }) => {
    const built = build();
    expect(built.ok, `${name} failed to build: ${JSON.stringify(!built.ok ? built.errors : [])}`).toBe(true);
    expect(built.value?.campaign.version, name).toBe(version);
  });
});

describe("W104.1 compatibility-sweep manifest — representative saves", () => {
  it.each(SAVE_FIXTURES)("names save fixture $name, and it exists", ({ name }) => {
    expect(existsSync(`${SAVES_DIR}${name}.json`), name).toBe(true);
  });
});

describe("W104.1 compatibility-sweep manifest — v0.10.0 compat baseline", () => {
  it.each(COMPAT_BASELINE_ENTRIES)("names compat baseline $label, and it exists", ({ label }) => {
    expect(existsSync(`${COMPAT_BASELINE_DIR}${label}.json`), label).toBe(true);
  });
});

// Kept for parity with the two files this manifest can never let drift silently, mirroring
// `regressionManifest.test.ts`'s own REPO_ROOT-relative existence checks.
describe("W104.1 compatibility-sweep manifest — the two producer scripts themselves", () => {
  it.each(["capture-compat-baseline.ts", "capture-save-fixtures.ts"])("names producer script %s, and it exists", (relativePath) => {
    expect(existsSync(`${REPO_ROOT}src/engine/scripts/${relativePath}`), relativePath).toBe(true);
  });
});
