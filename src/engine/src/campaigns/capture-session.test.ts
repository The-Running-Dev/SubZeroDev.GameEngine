/**
 * S139.1 — a session captured through `SessionLayer.captureSession` is a `ReplayFixture` the
 * oracle accepts: played from a committed fixture's own submissions, the capture carries the
 * same config, starting epoch and submissions, and replays to the committed `Outcome`
 * (20-contract.md, "Capturing a session"). One real campaign per kind; the story-graph one
 * crosses an epoch, so the capture's `{ adopt }` entry is exercised against real content.
 *
 * Lives beside the campaigns rather than under `core/session/` for the reason every replay
 * suite does: `src/core/**` may not import a kind, even in a test.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createContentArchive, type ContentArchive } from "../core/registry/archive.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createSessionLayer } from "../core/session/store.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign, ContentRegistry } from "../core/registry/types.js";
import type { ReplayFixture } from "../core/replay/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildBulgariaBureaucracyCampaign } from "./bulgaria-bureaucracy.js";
import { resolveStableLifeRegistry, stableLifeBasePack, bulgariaCulturePack } from "./stable-life-packs.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";
import { FIXTURES_DIR, loadExpectedOutcome, loadFixture } from "./replay-corpus.js";

interface Composition {
  readonly kinds: KindRegistry;
  readonly registry: ContentRegistry;
  readonly archive?: ContentArchive;
}

function validated(campaigns: readonly BuiltCampaign[], kinds: KindRegistry): ContentRegistry {
  const result = buildValidatedContentRegistry(campaigns, kinds);
  if (!result.ok || !result.value) throw new Error(`expected the campaign to validate: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** The shipped Bureaucracy plus the derived `2.1.0` epoch `bureaucracy-epoch-crossing`
 *  adopts — the same derivation `bulgaria-bureaucracy.replay.test.ts` publishes. */
function bureaucracy(): Composition {
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const content = built.value.campaign.content as StoryGraphCampaign;
  const next: BuiltCampaign = {
    ...built.value,
    campaign: {
      ...built.value.campaign,
      version: "2.1.0",
      content: { ...content, variables: { ...content.variables, forms_refiled: { type: "int", initial: 0 } } },
    },
  };
  const registry = validated([built.value], kinds);
  const archive = createContentArchive({ kinds, initial: registry });
  if (!archive.publish(validated([next], kinds)).ok) throw new Error("expected the next epoch to publish");
  return { kinds, registry, archive };
}

function bulgarianStableLife(): Composition {
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const result = resolveStableLifeRegistry([stableLifeBasePack, bulgariaCulturePack], kinds);
  if (!result.ok || !result.value) throw new Error(`expected the Bulgarian pack set to resolve — ${JSON.stringify(result.errors)}`);
  return { kinds, registry: result.value };
}

function worldGraphMvp(): Composition {
  const kinds = { "world-graph": worldGraphKind } as unknown as KindRegistry;
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("expected world-graph MVP campaign to build");
  return { kinds, registry: validated([built.value], kinds) };
}

const engineFor = (composition: Composition) =>
  createEngine({ kinds: composition.kinds, registry: composition.registry, ids: createCountingIds(), ...(composition.archive ? { archive: composition.archive } : {}) });

/** Plays `fixture` through a session layer and captures the session it leaves. An adoption is
 *  the channel's offer, which the layer takes after an accepted action (16 §5.3) — so one the
 *  fixture records after an action is offered before that action is submitted. */
async function playAndCapture(compose: () => Composition, fixture: ReplayFixture): Promise<ReplayFixture> {
  const composition = compose();
  let offer: string | undefined;
  const layer = createSessionLayer({
    engine: engineFor(composition),
    registry: composition.registry,
    content: { current: () => offer },
  });
  const { sessionId } = await layer.createSession(fixture.config);
  for (const [index, submission] of fixture.submissions.entries()) {
    if ("adopt" in submission) continue;
    const next = fixture.submissions[index + 1];
    if (next !== undefined && "adopt" in next) offer = next.adopt;
    expect((await layer.submitAction(sessionId, submission.actionId, submission.params)).ok).toBe(true);
  }
  return layer.captureSession(sessionId, fixture.name);
}

/** The oracle's own context, with its own profile store: the capture is replayed by a
 *  process that shares nothing with the one that played it. */
function oracle(compose: () => Composition): ReplayRunnerContext {
  const composition = compose();
  return {
    engine: engineFor(composition),
    kinds: composition.kinds,
    registry: composition.registry,
    profiles: createInMemoryProfileStore(),
    profileId: "capture-round-trip-profile",
  };
}

describe("S139.1 — a captured session replays to the committed Outcome, per kind", () => {
  const cases: readonly [string, string, () => Composition][] = [
    ["story-graph, across an epoch", "bureaucracy-epoch-crossing", bureaucracy],
    ["simulation", "bulgaria-stable-life-win", bulgarianStableLife],
    ["world-graph", "world-graph-mvp-win", worldGraphMvp],
  ];

  it.each(cases)("%s: %s", async (_label, name, compose) => {
    const committed = loadFixture(name, FIXTURES_DIR);
    const captured = await playAndCapture(compose, committed);

    expect(captured.config).toEqual(committed.config);
    expect(captured.campaignVersion).toBe(committed.campaignVersion);
    expect(captured.submissions).toEqual(committed.submissions);
    expect(await runReplayFixture(oracle(compose), captured, loadExpectedOutcome(name, FIXTURES_DIR))).toEqual({ kind: "match" });
  });
});
