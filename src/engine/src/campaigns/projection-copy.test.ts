/**
 * The copy boundary at the `Kind.project` seam (`20-contract.md` §9.1, W97.1/W97.2).
 *
 * §9.1 places the rule on the *kernel*, not on kinds: every core surface that carries a
 * `kind.project` result to a caller returns a structural clone of it. All three shipped
 * kinds alias `kindState` while projecting — `simulation` returns eight `player.*` objects
 * and arrays by reference, `story-graph` returns `unlockedAchievements`, `world-graph`
 * returns `map.spawnPoints` and `map.exits` — and §9.1 explicitly permits that. So this
 * suite deliberately does *not* check any kind for aliasing. It checks the only thing a
 * caller can rely on, against the real campaigns, on both bound surfaces:
 *
 * - `Engine.view(state, audience)`, which already cloned before W97, and
 * - `Scene.view` from `Engine.scene(state)`, which did not — §6 declares that field to *be*
 *   the §9 projection, so one surface was guarded and its documented twin was not. That gap
 *   is what this suite exists to keep closed.
 *
 * The mutation is exhaustive rather than sampled: `mutateEverything` walks the returned view
 * and writes into every array and every plain object reachable at any depth. A rule that
 * held only for the top level, or only for the first array it happened to meet, fails here.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { nullEmitter } from "../core/observability/emitter.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { ActionParams, Engine, GameState, KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { ProjectionAudience } from "../core/projection/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";
import { buildStableLifeCampaign, STABLE_LIFE_CAMPAIGN_ID } from "./stable-life.js";
import { buildWorldGraphMvpCampaign, WORLD_GRAPH_MVP_CAMPAIGN_ID } from "./world-graph-mvp.js";

function unwrap(built: CommandResult<BuiltCampaign>, what: string): BuiltCampaign {
  if (!built.ok || !built.value) throw new Error(`expected ${what} to build`);
  return built.value;
}

function engineFor(built: BuiltCampaign, kinds: KindRegistry): Engine {
  const registry = buildValidatedContentRegistry([built], kinds);
  if (!registry.ok || !registry.value) throw new Error("expected the campaign to validate");
  return createEngine({ kinds, registry: registry.value, ids: createCountingIds() }).withEmitter(nullEmitter);
}

function play(engine: Engine, campaignId: string, seed: string, submissions: readonly { actionId: string; params?: ActionParams }[]): GameState {
  const created = engine.createGame({ campaignId, seed });
  if (!created.ok || !created.value) throw new Error(`createGame rejected — ${created.errors[0]?.code ?? "unknown"}`);
  let state = created.value;
  for (const submission of submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (!result.ok || !result.value) throw new Error(`submitAction("${submission.actionId}") rejected — ${result.errors[0]?.code ?? "unknown"}`);
    state = result.value;
  }
  return state;
}

/**
 * Writes into every container reachable from `value`, at any depth, and reports how many it
 * touched. Arrays get a sentinel pushed; plain objects get a sentinel key. The count is
 * returned so each case can assert the walk actually found something — a mutator that
 * silently traversed nothing would make every assertion below pass vacuously, which is the
 * one way this suite could lie.
 */
function mutateEverything(value: unknown, seen = new Set<unknown>()): number {
  if (value === null || typeof value !== "object") return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  let mutated = 0;
  if (Array.isArray(value)) {
    for (const entry of value) mutated += mutateEverything(entry, seen);
    (value as unknown[]).push("MUTATED-BY-CALLER");
    return mutated + 1;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) mutated += mutateEverything(record[key], seen);
  record["mutatedByCaller"] = "MUTATED-BY-CALLER";
  return mutated + 1;
}

interface Case {
  readonly kindName: string;
  readonly build: () => { engine: Engine; state: GameState };
  readonly audiences: readonly ProjectionAudience[];
}

const CASES: readonly Case[] = [
  {
    kindName: "story-graph",
    audiences: ["player", "ai"],
    build: () => {
      const engine = engineFor(unwrap(buildBulgariaBureaucracyCampaign(), "bulgaria-bureaucracy"), { "story-graph": storyGraphKind } as unknown as KindRegistry);
      return { engine, state: play(engine, BULGARIA_BUREAUCRACY_CAMPAIGN_ID, "bureaucracy-seed-1", [{ actionId: "wait" }, { actionId: "registry_route_listen" }]) };
    },
  },
  {
    kindName: "simulation",
    audiences: ["player", "ai"],
    build: () => {
      const engine = engineFor(unwrap(buildStableLifeCampaign(), "stable-life"), { "simulation": simulationKind } as unknown as KindRegistry);
      // The committed stable-life-employment fixture's own submissions, so the state under
      // test is one the corpus already produces rather than a hand-typed guess.
      return { engine, state: play(engine, STABLE_LIFE_CAMPAIGN_ID, "stable-life-employment-seed", [
        { actionId: "plan.add", params: { actionType: "search_for_work" } },
        { actionId: "plan.add", params: { actionType: "apply_for_job", targetId: "job-cashier" } },
        { actionId: "end_week" },
        { actionId: "end_week" },
      ]) };
    },
  },
  {
    kindName: "world-graph",
    audiences: ["player", "ai"],
    build: () => {
      const engine = engineFor(unwrap(buildWorldGraphMvpCampaign(), "world-graph-mvp"), { "world-graph": worldGraphKind } as unknown as KindRegistry);
      return { engine, state: play(engine, WORLD_GRAPH_MVP_CAMPAIGN_ID, "world-graph-mvp-win-seed", [{ actionId: "hire_staff", params: { definitionId: "cleaner" } }, { actionId: "advance_ticks", params: { ticks: 10 } }]) };
    },
  },
];

describe("the kernel owns the copy boundary at Kind.project (20-contract.md §9.1)", () => {
  describe.each(CASES)("$kindName", ({ build, audiences }) => {
    it.each(audiences)("view(state, %s): mutating everything reachable changes nothing authoritative", (audience) => {
      const { engine, state } = build();
      const serializedBefore = engine.serialize(state);
      const actionLogBefore = JSON.stringify(state.actionLog);
      const reference = engine.view(state, audience);

      const mutated = mutateEverything(engine.view(state, audience));
      expect(mutated).toBeGreaterThan(0);

      expect(engine.serialize(state)).toBe(serializedBefore);
      expect(JSON.stringify(state.actionLog)).toBe(actionLogBefore);
      expect(engine.view(state, audience)).toEqual(reference);
    });

    it("scene(state).view: mutating everything reachable changes nothing authoritative", () => {
      const { engine, state } = build();
      const serializedBefore = engine.serialize(state);
      const actionLogBefore = JSON.stringify(state.actionLog);
      const reference = engine.scene(state);

      const mutated = mutateEverything(engine.scene(state).view);
      expect(mutated).toBeGreaterThan(0);

      expect(engine.serialize(state)).toBe(serializedBefore);
      expect(JSON.stringify(state.actionLog)).toBe(actionLogBefore);
      expect(engine.scene(state)).toEqual(reference);
      expect(engine.view(state, "player")).toEqual(reference.view);
    });

    it("mutating a view does not disturb the other projection surface", () => {
      const { engine, state } = build();
      const sceneReference = engine.scene(state);
      mutateEverything(engine.view(state, "player"));
      expect(engine.scene(state)).toEqual(sceneReference);

      const viewReference = engine.view(state, "player");
      mutateEverything(engine.scene(state).view);
      expect(engine.view(state, "player")).toEqual(viewReference);
    });

    it("two projections of one state are equal and never the same object (§9.1, identity)", () => {
      const { engine, state } = build();
      const first = engine.view(state, "player");
      const second = engine.view(state, "player");
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.kindView).not.toBe(second.kindView);
      expect(engine.scene(state).view.kindView).not.toBe(engine.scene(state).view.kindView);
    });
  });
});
