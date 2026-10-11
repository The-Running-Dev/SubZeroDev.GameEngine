import { describe, it, expect } from "vitest";
import { runFixture, traceFixture, type PlaythroughFixture } from "../core/determinism/harness.js";
import { createEngine } from "../core/kernel/engine.js";
import { createContentArchive } from "../core/registry/archive.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { IdSource } from "../core/composition/types.js";
import type { Engine, KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign, ContentRegistry } from "../core/registry/types.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { ChoiceNode } from "../kinds/story-graph/nodes.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { validateStoryGraphState } from "../kinds/story-graph/validateState.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";

// S132.4 against real content: the Bureaucracy campaign adopts a copy of itself extended by
// one node and one variable, and a log crossing that epoch replays byte-identically (C21).

const SEED = "bureaucracy-seed-1";
const IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };
const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
const PLAYED_BEFORE = ["wait", "registry_route_listen"];

function built(): BuiltCampaign {
  const result = buildBulgariaBureaucracyCampaign();
  if (!result.ok || !result.value) throw new Error("expected the real campaign to build");
  return result.value;
}

function validated(campaign: BuiltCampaign): ContentRegistry {
  const result = buildValidatedContentRegistry([campaign], kinds);
  if (!result.ok || !result.value) throw new Error(`expected the campaign to validate: ${result.errors.map((e) => e.code).join(", ")}`);
  return result.value;
}

const V1 = built();

/** Where the fixture stands when it adopts — read from v1, so the extension hangs off a node
 *  the player is actually on. */
function adoptionNode(): string {
  const engine = createEngine({ kinds, registry: validated(V1), ids: IDS });
  let state = engine.createGame({ campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED }).value!;
  for (const actionId of PLAYED_BEFORE) state = engine.submitAction(state, actionId).value!;
  return (state.kindState as StoryGraphKindState).currentNodeId;
}

const HOST_NODE = adoptionNode();

/** v1 plus an `annex` choice node reached from the host node, and a `patience` variable.
 *  The real campaign's `migrateState` migrates from 1.0.0 only, so the copy carries none —
 *  see the last test. */
function extended(withMigrateState = false): BuiltCampaign {
  const { migrateState, ...data } = V1.campaign;
  const content = structuredClone(data.content) as StoryGraphCampaign;
  content.variables.patience = { type: "int", initial: 3, min: 0, max: 5 };
  content.nodes.annex = {
    id: "annex",
    kind: "choice",
    textKey: "node.annex.text",
    choices: [{ id: "annex_return", labelKey: "choice.annex_return", effects: [{ op: "decrement", var: "patience", by: 1 }], goto: HOST_NODE }],
  };
  (content.nodes[HOST_NODE] as ChoiceNode).choices.push({ id: "annex_visit", labelKey: "choice.annex_visit", goto: "annex" });

  const strings = new Map(V1.strings);
  strings.set("node.annex.text", "A smaller queue, for people who have given up on the larger one.");
  strings.set("choice.annex_visit", "Try the annex");
  strings.set("choice.annex_return", "Return to the main hall");
  return {
    campaign: { ...data, version: "2.1.0", content, ...(withMigrateState && migrateState ? { migrateState } : {}) },
    strings,
  };
}

function buildEngine(target: BuiltCampaign): Engine {
  const initial = validated(V1);
  const archive = createContentArchive({ kinds, initial });
  const published = archive.publish(validated(target));
  if (!published.ok) throw new Error(`expected the extension to publish: ${published.errors.map((e) => e.code).join(", ")}`);
  return createEngine({ kinds, registry: initial, archive, ids: IDS });
}

const CROSSING: PlaythroughFixture = {
  name: "Bureaucracy, adopting its own one-node extension partway through",
  config: { campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED },
  actionLog: [
    { seq: 0, actionId: PLAYED_BEFORE[0]! },
    { seq: 1, actionId: PLAYED_BEFORE[1]! },
    { seq: 2, system: "content", from: V1.campaign.version, to: "2.1.0" },
    { seq: 3, actionId: "annex_visit" },
    { seq: 4, actionId: "annex_return" },
  ],
};

describe("S132.4 — the Bureaucracy campaign adopts its own additive extension", () => {
  it("adopts mid-arc, and the adopted state passes validateState against the target", () => {
    const engine = buildEngine(extended());
    let state = engine.createGame(CROSSING.config).value!;
    for (const actionId of PLAYED_BEFORE) state = engine.submitAction(state, actionId).value!;

    const result = engine.adoptContent(state, "2.1.0");
    expect(result.adopted).toBe(true);
    if (!result.adopted) return;
    const kindState = result.state.kindState as StoryGraphKindState;
    expect(kindState.variables.patience).toBe(3);
    expect(kindState.currentNodeId).toBe(HOST_NODE);
    expect(validateStoryGraphState(kindState, extended().campaign)).toBe(true);
    expect(engine.availableActions(result.state).map((a) => a.id)).toContain("annex_visit");
  });

  it("replays a log crossing the epoch byte-identically, entry by entry", () => {
    const first = traceFixture(buildEngine(extended()), CROSSING);
    const second = traceFixture(buildEngine(extended()), CROSSING);
    expect(first).toHaveLength(CROSSING.actionLog.length + 1);
    expect(second).toEqual(first);

    const final = JSON.parse(runFixture(buildEngine(extended()), CROSSING)) as {
      formatVersion: number;
      campaignVersion: string;
      kindState: StoryGraphKindState;
    };
    expect(final).toMatchObject({ formatVersion: 2, campaignVersion: "2.1.0" });
    expect(final.kindState.currentNodeId).toBe(HOST_NODE);
    expect(final.kindState.variables.patience).toBe(2);
    expect(final.kindState.visitedCounts.annex).toBe(1);
  });

  it("round-trips the crossed state through deserialize", () => {
    const engine = buildEngine(extended());
    const serialized = runFixture(engine, CROSSING);
    const loaded = engine.deserialize(serialized);
    expect(loaded.ok).toBe(true);
    expect(engine.serialize(loaded.value!)).toBe(serialized);
  });

  it("pins with migration_failed when the extension keeps the real migrateState, which migrates from 1.0.0 only", () => {
    const engine = buildEngine(extended(true));
    let state = engine.createGame(CROSSING.config).value!;
    for (const actionId of PLAYED_BEFORE) state = engine.submitAction(state, actionId).value!;
    expect(engine.adoptContent(state, "2.1.0")).toEqual({ adopted: false, reason: "migration_failed" });
  });
});
