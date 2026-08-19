/**
 * Tier 1 and Tier 2 as an author-facing check — `design/30-slices.md` § W77.
 *
 * Contract: `04-core.md` §11 ("Tier 1 — load-time, hard fail", "Tier 2 — load-time,
 * warning"), §12 (`ReasonCode`, message resolution), §17 (identifier conventions);
 * `03-story-graph-kind.md` §11; `02-architecture.md` §9, §9.2.
 *
 * Those two tiers already run on every campaign, at registry-construction time
 * (`buildValidatedContentRegistry`, `src/core/validation/tiered.ts`) — the only way to
 * see what they found was to be the program that caught a registry build failing. This
 * script is the author-facing door onto the same checks: it calls
 * `buildValidatedContentRegistry` with a batch of exactly one campaign and renders
 * whatever comes back, authoring no rule of its own (W77.5).
 *
 * Lives outside `src/`, alongside `validate-campaign.ts` (Tier 3) — authoring-time
 * tooling, not shipped engine code (architecture §9.2), so neither the determinism guard
 * nor the dependency-arrow rule applies here.
 *
 * Run with `npm run check-content -- <campaign-module>` from `src/engine/` — the module
 * name under `src/campaigns/` (`bulgaria-bureaucracy`, `stable-life`, …), not
 * `Campaign.id` (see `moduleKeyFor` below for why).
 */

import type { CommandResult } from "../src/core/kernel/reasons.js";
import { CORE_REASON_MESSAGES } from "../src/core/kernel/reasons.js";
import type { KindRegistry } from "../src/core/kernel/types.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { LocKey } from "../src/core/localization/types.js";
import type { ValidationError, ValidationWarning } from "../src/core/validation/types.js";
import { buildValidatedContentRegistry } from "../src/core/validation/tiered.js";

import { storyGraphKind } from "../src/kinds/story-graph/kind.js";
import { simulationKind } from "../src/kinds/simulation/kind.js";
import { worldGraphKind } from "../src/kinds/world-graph/kind.js";

import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildBulgariaStableLifeCampaign, BULGARIA_STABLE_LIFE_CAMPAIGN_ID } from "../src/campaigns/bulgaria-stable-life.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "../src/campaigns/stable-life.js";
import { buildStableLifeHousingCampaign, STABLE_LIFE_HOUSING_CAMPAIGN_ID } from "../src/campaigns/stable-life-housing.js";
import { buildStableLifeEventsCampaign, STABLE_LIFE_EVENTS_CAMPAIGN_ID } from "../src/campaigns/stable-life-events.js";
import { buildStableLifePossessionsCampaign, STABLE_LIFE_POSSESSIONS_CAMPAIGN_ID } from "../src/campaigns/stable-life-possessions.js";
import { buildStableLifeEffectsCampaign, STABLE_LIFE_EFFECTS_CAMPAIGN_ID } from "../src/campaigns/stable-life-effects.js";
import { buildWorldGraphMvpCampaign, WORLD_GRAPH_MVP_CAMPAIGN_ID } from "../src/campaigns/world-graph-mvp.js";

export const KINDS: KindRegistry = {
  "story-graph": storyGraphKind,
  simulation: simulationKind,
  "world-graph": worldGraphKind,
} as KindRegistry;

interface CatalogueEntry {
  campaignId: string;
  build: () => CommandResult<BuiltCampaign>;
}

/**
 * Every committed campaign this checker will run over, keyed by the source file
 * (`src/engine/src/campaigns/<key>`) that declares it — the key, not just the campaign
 * id, is what lets the coverage test (W77.4) below cross-check against the directory
 * listing. `demo-cli.ts` and `export-campaigns.ts` each hand-maintain their own version
 * of this same list today (W77 introduces the shared one; migrating those two onto it is
 * out of scope here).
 */
export const CAMPAIGN_CATALOGUE: Readonly<Record<string, CatalogueEntry>> = {
  "bulgaria-bureaucracy.ts": { campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, build: buildBulgariaBureaucracyCampaign },
  "bulgaria-stable-life.ts": { campaignId: BULGARIA_STABLE_LIFE_CAMPAIGN_ID, build: buildBulgariaStableLifeCampaign },
  "stable-life.ts": { campaignId: STABLE_LIFE_CAMPAIGN_ID, build: buildStableLifeCampaign },
  "stable-life-housing.ts": { campaignId: STABLE_LIFE_HOUSING_CAMPAIGN_ID, build: buildStableLifeHousingCampaign },
  "stable-life-events.ts": { campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, build: buildStableLifeEventsCampaign },
  "stable-life-possessions.ts": { campaignId: STABLE_LIFE_POSSESSIONS_CAMPAIGN_ID, build: buildStableLifePossessionsCampaign },
  "stable-life-effects.ts": { campaignId: STABLE_LIFE_EFFECTS_CAMPAIGN_ID, build: buildStableLifeEffectsCampaign },
  "world-graph-mvp.ts": { campaignId: WORLD_GRAPH_MVP_CAMPAIGN_ID, build: buildWorldGraphMvpCampaign },
};

/**
 * Every other module under `src/campaigns/*.ts` that exports something shaped like a
 * campaign builder, named here with the reason it is not in the catalogue above — on the
 * record rather than silently absent (W77.4). A module that exports a campaign builder
 * and appears in neither map fails `check-content.test.ts`'s coverage test.
 */
export const EXCLUDED_MODULES: Readonly<Record<string, string>> = {
  "adventure-builder.ts":
    "a two-argument builder utility parameterized by config and source, wrapped by every per-campaign zero-argument builder already in the catalogue above — not itself one campaign.",
  "bulgaria-bureaucracy.bg.ts":
    "the second-locale fixture (W60) for bulgaria-bureaucracy — not separately authored content, and its coverage is W78's concern, not this checker's.",
  "tier3-unreachable-ending-fixture.ts":
    "deliberately unreachable by construction, for validate-campaign.ts's Tier 3 check — this checker covers Tier 1/2 only (out of scope, per design/30-slices.md § W77).",
  "bulgaria-bureaucracy.broken.ts":
    "deliberately-broken fixtures, exercised directly by this checker's own tests (W77.3) rather than through the catalogue, so a real author-facing run never reports them.",
  "stable-life.broken.ts":
    "deliberately-broken fixtures, exercised directly by this checker's own tests (W77.3) rather than through the catalogue, so a real author-facing run never reports them.",
};

export interface CampaignFinding {
  code: string;
  message: string;
  path?: string;
}

export interface ContentCheckResult {
  errors: CampaignFinding[];
  warnings: CampaignFinding[];
}

function resolveMessage(key: LocKey, tables: readonly ReadonlyMap<LocKey, string>[]): string {
  for (const table of tables) {
    const text = table.get(key);
    if (text !== undefined) return text;
  }
  // Every registered reason code and every campaign's own titleKey/content LocKeys are
  // guaranteed resolvable by the tiers this checker delegates to (04 §12, §11) — this
  // fallback exists so a gap surfaces as a visible key rather than the checker crashing.
  return key;
}

function toFinding(entry: ValidationError | ValidationWarning, tables: readonly ReadonlyMap<LocKey, string>[]): CampaignFinding {
  const message = resolveMessage(entry.messageKey, tables);
  return entry.path !== undefined ? { code: entry.code, message, path: entry.path } : { code: entry.code, message };
}

/**
 * Runs Tier 1 and Tier 2 over one already-built campaign, through
 * `buildValidatedContentRegistry` — the same sanctioned entry point the registry path
 * itself uses (W77.5) — with a batch of exactly this one campaign. Every finding's
 * `messageKey` is resolved to text (never left as a bare key, W77.1): the declaring
 * kind's own `reasonMessages` first, then the core's `CORE_REASON_MESSAGES`, then this
 * campaign's own built string table — the same order 04 §11's "which string table
 * validation checks against" resolves a campaign's own `LocKey`s against.
 */
export function checkBuiltCampaign(built: BuiltCampaign, kinds: KindRegistry = KINDS): ContentCheckResult {
  const kind = kinds[built.campaign.kindId];
  const tables = [kind?.reasonMessages, CORE_REASON_MESSAGES, built.strings].filter(
    (table): table is ReadonlyMap<LocKey, string> => table !== undefined,
  );

  const result = buildValidatedContentRegistry([{ campaign: built.campaign, strings: built.strings }], kinds);

  return {
    errors: result.errors.map((error) => toFinding(error, tables)),
    warnings: result.warnings.map((warning) => toFinding(warning, tables)),
  };
}

/** W77.2: any Tier 1 error is a non-zero exit; Tier 2 warnings alone still exit zero. */
export function hasFailures(result: ContentCheckResult): boolean {
  return result.errors.length > 0;
}

function printReport(campaignId: string, result: ContentCheckResult): void {
  console.log(`Checked "${campaignId}": ${result.errors.length} error(s), ${result.warnings.length} warning(s).\n`);

  for (const finding of result.errors) {
    console.log(`  ERROR    ${finding.code}${finding.path !== undefined ? ` (${finding.path})` : ""} — ${finding.message}`);
  }
  for (const finding of result.warnings) {
    console.log(`  WARNING  ${finding.code}${finding.path !== undefined ? ` (${finding.path})` : ""} — ${finding.message}`);
  }
}

/**
 * The CLI argument names a catalogue *module* (`bulgaria-stable-life`, `stable-life`, …),
 * not `Campaign.id` — the Bulgarian resolution's `bulgaria-stable-life.ts` deliberately
 * builds a campaign whose id is `"stable-life"`, the same id the base pack it replaces
 * uses (11 §3, `stable-life-packs.ts`), so `Campaign.id` cannot address one catalogue
 * entry unambiguously the way the module name can.
 */
function moduleKeyFor(argument: string): string {
  return `${argument}.ts`;
}

async function main(): Promise<void> {
  const moduleName = process.argv[2];
  const entry = moduleName !== undefined ? CAMPAIGN_CATALOGUE[moduleKeyFor(moduleName)] : undefined;

  if (!entry) {
    const known = Object.keys(CAMPAIGN_CATALOGUE).map((file) => file.replace(/\.ts$/, "")).join(", ");
    console.error(`Usage: check-content <campaign-module>\nKnown campaign modules: ${known}`);
    process.exitCode = 1;
    return;
  }

  const built = entry.build();
  if (!built.ok || !built.value) {
    console.error(`check-content: campaign failed to build — ${JSON.stringify(built.errors)}`);
    process.exitCode = 1;
    return;
  }

  const result = checkBuiltCampaign(built.value);
  printReport(entry.campaignId, result);
  process.exitCode = hasFailures(result) ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
