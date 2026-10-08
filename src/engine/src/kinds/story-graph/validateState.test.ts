/**
 * S126 — the story-graph kind judges its own `kindState` at the deserialize boundary.
 * Driven through `Engine.deserialize` with the real kind and a real campaign, so the test
 * covers the seam call as well as the check.
 */

import { describe, it, expect } from "vitest";
import { buildBulgariaBureaucracyCampaign } from "../../campaigns/bulgaria-bureaucracy.js";
import { createCountingIds } from "../../core/determinism/counting-ids.js";
import { createEngine } from "../../core/kernel/engine.js";
import type { GameState, KindRegistry } from "../../core/kernel/types.js";
import { buildValidatedContentRegistry } from "../../core/validation/tiered.js";
import { storyGraphKind } from "./kind.js";

function setup() {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registry = buildValidatedContentRegistry([built.value], kinds);
  if (!registry.ok || !registry.value) throw new Error("expected the real campaign to validate");
  const engine = createEngine({ kinds, registry: registry.value, ids: createCountingIds() });
  const created = engine.createGame({ campaignId: built.value.campaign.id, seed: "s126" });
  if (!created.ok || !created.value) throw new Error("expected createGame to succeed");
  return { engine, state: created.value };
}

/** The serialized state with its `kindState` replaced by `mutate`'s result. */
function withKindState(state: GameState, mutate: (kindState: Record<string, unknown>) => unknown): string {
  const raw = JSON.parse(JSON.stringify(state)) as { kindState: Record<string, unknown> };
  raw.kindState = mutate(raw.kindState) as Record<string, unknown>;
  return JSON.stringify(raw);
}

/** `record` without `field`. */
function without(record: Record<string, unknown>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== field));
}

const REJECTED = [{ code: "invalid_state", messageKey: "core.reason.invalid_state", path: "kindState" }];

describe("S126 — story-graph validateState", () => {
  it("a state the engine produced round-trips", () => {
    const { engine, state } = setup();
    expect(engine.deserialize(engine.serialize(state)).ok).toBe(true);
  });

  it.each<[string, (k: Record<string, unknown>) => unknown]>([
    ["kindState: null", () => null],
    ["kindState: an array", () => []],
    ["missing currentNodeId", (k) => without(k, "currentNodeId")],
    ["missing visitedCounts", (k) => without(k, "visitedCounts")],
    ["turn as a string", (k) => ({ ...k, turn: "3" })],
    ["turn negative", (k) => ({ ...k, turn: -1 })],
    ["unlockedAchievements as an object", (k) => ({ ...k, unlockedAchievements: {} })],
    ["a non-numeric visit count", (k) => ({ ...k, visitedCounts: { start: "1" } })],
    ["endingId as a number", (k) => ({ ...k, endingId: 7 })],
    ["currentNodeId naming no node", (k) => ({ ...k, currentNodeId: "no-such-node" })],
  ])("%s → invalid_state", (_label, mutate) => {
    const { engine, state } = setup();
    const result = engine.deserialize(withKindState(state, mutate));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(REJECTED);
  });

  it("a declared variable missing, or of the wrong type, → invalid_state; an undeclared one is tolerated", () => {
    const { engine, state } = setup();
    const variables = (state.kindState as { variables: Record<string, unknown> }).variables;
    const [name, value] = Object.entries(variables)[0] ?? [];
    expect(name).toBeDefined();

    const missing = withKindState(state, (k) => ({ ...k, variables: without(k["variables"] as Record<string, unknown>, name!) }));
    expect(engine.deserialize(missing).errors).toEqual(REJECTED);

    const wrongType = typeof value === "boolean" ? 1 : true;
    const retyped = withKindState(state, (k) => ({ ...k, variables: { ...(k["variables"] as object), [name!]: wrongType } }));
    expect(engine.deserialize(retyped).errors).toEqual(REJECTED);

    const extra = withKindState(state, (k) => ({ ...k, variables: { ...(k["variables"] as object), undeclared: 1 } }));
    expect(engine.deserialize(extra).ok).toBe(true);
  });
});
