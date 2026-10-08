/**
 * S126 — the world-graph kind judges its own `kindState` at the deserialize boundary, at the
 * top level. Driven through `Engine.deserialize` with the real kind and a real campaign.
 */

import { describe, it, expect } from "vitest";
import { buildWorldGraphMvpCampaign } from "../../campaigns/world-graph-mvp.js";
import { createCountingIds } from "../../core/determinism/counting-ids.js";
import { createEngine } from "../../core/kernel/engine.js";
import type { GameState, KindRegistry } from "../../core/kernel/types.js";
import { buildValidatedContentRegistry } from "../../core/validation/tiered.js";
import { worldGraphKind } from "./kind.js";

function setup() {
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("expected the world-graph MVP campaign to build");
  const kinds = { "world-graph": worldGraphKind } as unknown as KindRegistry;
  const registry = buildValidatedContentRegistry([built.value], kinds);
  if (!registry.ok || !registry.value) throw new Error("expected the world-graph MVP campaign to validate");
  const engine = createEngine({ kinds, registry: registry.value, ids: createCountingIds() });
  const created = engine.createGame({ campaignId: built.value.campaign.id, seed: "s126" });
  if (!created.ok || !created.value) throw new Error("expected createGame to succeed");
  return { engine, state: created.value };
}

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

describe("S126 — world-graph validateState", () => {
  it("a state the engine produced round-trips", () => {
    const { engine, state } = setup();
    expect(engine.deserialize(engine.serialize(state)).ok).toBe(true);
  });

  it.each<[string, (k: Record<string, unknown>) => unknown]>([
    ["kindState: null", () => null],
    ["kindState: a number", () => 0],
    ["missing tick", (k) => without(k, "tick")],
    ["missing guests", (k) => without(k, "guests")],
    ["missing resolution", (k) => without(k, "resolution")],
    ["tick as a string", (k) => ({ ...k, tick: "0" })],
    ["tick fractional", (k) => ({ ...k, tick: 1.5 })],
    ["map: null", (k) => ({ ...k, map: null })],
    ["buildings as an object", (k) => ({ ...k, buildings: {} })],
    ["resolution as an array", (k) => ({ ...k, resolution: [] })],
  ])("%s → invalid_state", (_label, mutate) => {
    const { engine, state } = setup();
    const result = engine.deserialize(withKindState(state, mutate));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(REJECTED);
  });
});
