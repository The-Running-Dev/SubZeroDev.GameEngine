/**
 * W96.4 — the mechanical reason-completeness gate.
 *
 * Contract: `04-core.md` §12 ("validation fails if any registered reason code has no
 * localized message") and `Kind.reasonCodes`/`Kind.reasonMessages` (§3). `tiered.ts`'s
 * `missingReasonCodeMessages` already proves every code a kind *declares* in `reasonCodes`
 * has a message — but a `StateChange.reason` or `ValidationError.code` is typed as bare
 * `ReasonCode` (`type ReasonCode = string`) at every call site, so nothing stops a reason
 * from being emitted that was never added to `reasonCodes` in the first place. That gap is
 * exactly where a reason reaches a client "carried indirectly" — through `EffectContext`
 * (world-graph's `applyWorldEffects`, story-graph's `applyConsequences`) or a batch-change
 * recorder (world-graph's `TickChanges.record`, `BatchChanges`) — rather than as a literal
 * at the `reject(...)` call site a reviewer would actually read.
 *
 * This gate is dynamic, not static: it replays each kind's own committed regression corpus
 * (`fixtures/replay/`) end to end against that kind's real flagship campaign, collecting
 * every `StateChange.reason` and `ValidationError.code` actually produced — including every
 * accepted and every rejected submission — and checks each one is a member of
 * `kind.reasonCodes ∪ BASE_REASON_CODES` with a resolvable localized message. A reason that
 * reaches a client only through an effect or a recorder still shows up here, because the
 * fixture corpus already exercises those paths; a reason nothing in the corpus reaches would
 * not be caught, the same limit any coverage-driven check has.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import type { Engine, Kind, KindRegistry } from "../core/kernel/types.js";
import { BASE_REASON_CODES, CORE_REASON_MESSAGES } from "../core/kernel/reasons.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { ReplayFixture } from "../core/replay/types.js";
import { fixtureNamesByPrefix, loadFixture, FIXTURES_DIR } from "./replay-corpus.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { buildBulgariaBureaucracyCampaign } from "./bulgaria-bureaucracy.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { buildStableLifeCampaign } from "./stable-life.js";
import { buildStableLifeEffectsCampaign } from "./stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "./stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "./stable-life-possessions.js";
import { buildStableLifeEventsCampaign } from "./stable-life-events.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";

interface KindFixtureGroup {
  readonly label: string;
  readonly kindId: string;
  readonly kind: Kind<unknown>;
  /** A fixture's own `config.campaignId` picks which one it replays against (same pattern
   *  `stable-life.replay.test.ts`'s own `makeContext` uses), so every campaign this kind's
   *  corpus can name is registered together. */
  readonly buildCampaigns: readonly (() => CommandResult<BuiltCampaign>)[];
  readonly fixturePrefix: string;
}

const GROUPS: readonly KindFixtureGroup[] = [
  { label: "story-graph", kindId: "story-graph", kind: storyGraphKind, buildCampaigns: [buildBulgariaBureaucracyCampaign], fixturePrefix: "bureaucracy-" },
  {
    label: "simulation", kindId: "simulation", kind: simulationKind, fixturePrefix: "stable-life-",
    buildCampaigns: [buildStableLifeCampaign, buildStableLifeEffectsCampaign, buildStableLifeHousingCampaign, buildStableLifePossessionsCampaign, buildStableLifeEventsCampaign],
  },
  { label: "world-graph", kindId: "world-graph", kind: worldGraphKind, buildCampaigns: [buildWorldGraphMvpCampaign], fixturePrefix: "world-graph-mvp-" },
];

function buildEngine(group: KindFixtureGroup): Engine {
  const built = group.buildCampaigns.map((build) => {
    const result = build();
    if (!result.ok || !result.value) throw new Error(`${group.label}: expected a flagship campaign to build`);
    return result.value;
  });
  const kinds = { [group.kindId]: group.kind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry(built, kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error(`${group.label}: expected the flagship campaigns to validate`);
  return createEngine({ kinds, registry: registryResult.value });
}

/**
 * Replays one fixture's full submission list, collecting every *visible* audit reason and
 * every rejection code actually produced — accepted and rejected alike, exactly the corpus
 * a real session would have produced. An invisible `StateChange` (`visible: false`) is
 * internal bookkeeping a client is never shown — 04 §12's own `visible` field is what draws
 * that line — so it carries no localization obligation; a rejection is always surfaced via
 * `messages` (04 §3's own convention), so every collected code counts regardless.
 */
function replayAndCollect(engine: Engine, fixture: ReplayFixture): { reasons: Set<string>; codes: Set<string> } {
  const reasons = new Set<string>();
  const codes = new Set<string>();
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`${fixture.name}: expected createGame to succeed`);
  let state = created.value;
  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    for (const change of result.changes) if (change.visible) reasons.add(change.reason);
    for (const error of result.errors) codes.add(error.code);
    if (result.ok && result.value) state = result.value;
  }
  return { reasons, codes };
}

function hasLocalizedMessage(kind: Kind<unknown>, code: string): boolean {
  return CORE_REASON_MESSAGES.has(`core.reason.${code}`) || kind.reasonMessages.has(`${kind.id}.reason.${code}`);
}

describe("W96.4 mechanical reason-completeness gate", () => {
  for (const group of GROUPS) {
    it(`${group.label}: every reason/code the committed corpus actually produces is registered and localized`, () => {
      const engine = buildEngine(group);
      const names = fixtureNamesByPrefix(group.fixturePrefix, FIXTURES_DIR);
      expect(names.length, `${group.label}: expected at least one committed fixture`).toBeGreaterThan(0);

      const observed = new Set<string>();
      for (const name of names) {
        const { reasons, codes } = replayAndCollect(engine, loadFixture(name));
        for (const value of reasons) observed.add(value);
        for (const value of codes) observed.add(value);
      }
      expect(observed.size, `${group.label}: expected the corpus to actually produce some reason/code`).toBeGreaterThan(0);

      const registered = new Set<string>([...BASE_REASON_CODES, ...group.kind.reasonCodes]);
      const unregistered = [...observed].filter((value) => !registered.has(value));
      expect(unregistered, `${group.label}: reason/code observed but not in reasonCodes`).toEqual([]);

      const unlocalized = [...observed].filter((value) => !hasLocalizedMessage(group.kind, value));
      expect(unlocalized, `${group.label}: reason/code with no resolvable localized message`).toEqual([]);
    });
  }
});
