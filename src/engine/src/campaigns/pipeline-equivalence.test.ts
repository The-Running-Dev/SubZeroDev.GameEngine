/**
 * W97.5's before/after proof for the two tick-driven kinds.
 *
 * `20-contract.md` §20 permits `simulation`'s fifteen end-of-week systems and
 * `world-graph`'s twenty tick systems to be reshaped onto one shared substrate, on the
 * condition that doing so changes nothing observable. "Nothing observable" is four separate
 * claims, and this file pins all four against the committed replay corpus — every
 * `stable-life-*`, `long-horizon-*` and `world-graph-mvp-*` fixture, not a hand-picked pair
 * — so a reshape that silently drops a system, reorders two, or moves an event fails here
 * rather than in a downstream host:
 *
 * - **Serialization.** The exact `serialize()` string after the last submission.
 * - **Outcome and visible changes.** Terminal status, and every `StateChange` each
 *   submission reported, in submission order.
 * - **The event stream.** Every event a recording emitter saw, in order, with its data —
 *   which is what makes `kind.simulation.system.ran`'s per-system trace a real ordering
 *   detector rather than a comment. §20 settles the two kinds' emission asymmetry by
 *   keeping the substrate emission-free and pre-wrapping list entries, so `simulation` must
 *   still emit one `system.ran` per system and `world-graph` must still emit none.
 * - **Emitter independence.** The null emitter reaches the same state as the recording one
 *   (05-observability.md's invariant: dropping every event changes nothing).
 *
 * These are vitest snapshots deliberately, unlike the `.replay.test.ts` files' committed
 * `Outcome` JSON: this suite is a *within-build* before/after gate over one commit's own
 * refactor, not the cross-version oracle 07-replay.md §1 defines. Regenerating a snapshot
 * here is therefore always a claim that a behaviour change was intended.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createRecordingEmitter, nullEmitter } from "../core/observability/emitter.js";
import type { EngineEvent } from "../core/observability/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { Engine, GameState, KindRegistry } from "../core/kernel/types.js";
import type { CommandResult, StateChange } from "../core/kernel/reasons.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildStableLifeCampaign } from "./stable-life.js";
import { buildStableLifeEffectsCampaign } from "./stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "./stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "./stable-life-possessions.js";
import { buildStableLifeEventsCampaign } from "./stable-life-events.js";
import { buildLongHorizonWinCampaign, buildLongHorizonLossCampaign } from "./long-horizon.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";
import { CORPUS_DIR, FIXTURES_DIR, fixtureNamesByPrefix, loadFixture } from "./replay-corpus.js";

function unwrap(built: CommandResult<BuiltCampaign>, what: string): BuiltCampaign {
  if (!built.ok || !built.value) throw new Error(`expected ${what} to build`);
  return built.value;
}

/** A fresh engine per run: `createCountingIds` counts from zero, so reusing one across two
 *  runs would make the second differ from the first in exactly the ids this suite is trying
 *  to hold still. */
function buildEngine(campaigns: readonly BuiltCampaign[], kinds: KindRegistry): Engine {
  const registry = buildValidatedContentRegistry([...campaigns], kinds);
  if (!registry.ok || !registry.value) throw new Error("expected the campaigns to validate");
  return createEngine({ kinds, registry: registry.value, ids: createCountingIds() });
}

function simulationEngine(): Engine {
  return buildEngine(
    [
      unwrap(buildStableLifeCampaign(), "stable-life"),
      unwrap(buildStableLifeEffectsCampaign(), "stable-life-effects"),
      unwrap(buildStableLifeHousingCampaign(), "stable-life-housing"),
      unwrap(buildStableLifePossessionsCampaign(), "stable-life-possessions"),
      unwrap(buildStableLifeEventsCampaign(), "stable-life-events"),
      unwrap(buildLongHorizonWinCampaign(), "long-horizon-win"),
      unwrap(buildLongHorizonLossCampaign(), "long-horizon-loss"),
    ],
    { "simulation": simulationKind } as unknown as KindRegistry,
  );
}

function worldGraphEngine(): Engine {
  return buildEngine(
    [unwrap(buildWorldGraphMvpCampaign(), "world-graph-mvp")],
    { "world-graph": worldGraphKind } as unknown as KindRegistry,
  );
}

interface RunTrace {
  readonly serialized: string;
  readonly status: GameState["status"];
  readonly changes: readonly (StateChange | string)[];
}

/**
 * Replays one committed fixture's submissions, keeping every reported change in submission
 * order. A rejected submission is recorded as a marker string rather than thrown on: the
 * corpus deliberately contains fixtures whose submissions are refused, and *which* ones are
 * refused is itself behaviour a reshape must not alter — throwing would discard that.
 */
function runFixtureTrace(engine: Engine, name: string): RunTrace {
  const fixture = loadFixture(name);
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`${name}: createGame rejected — ${created.errors[0]?.code ?? "unknown"}`);
  let state = created.value;
  const changes: (StateChange | string)[] = [];
  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (result.ok && result.value) {
      state = result.value;
      changes.push(...result.changes);
    } else {
      changes.push(`rejected:${submission.actionId}:${result.errors[0]?.code ?? "unknown"}`);
    }
  }
  return { serialized: engine.serialize(state), status: state.status, changes };
}

/** `createCountingIds` already fixes `gameId`, but stripping it keeps the comparison honest
 *  on its own terms rather than by relying on the `IdSource`. */
function normalizeEvents(events: readonly EngineEvent[]): unknown[] {
  return events.map((event) => {
    const clone: Record<string, unknown> = { ...event };
    delete clone["gameId"];
    return clone;
  });
}

const SIMULATION_FIXTURES = [
  ...fixtureNamesByPrefix("stable-life-", CORPUS_DIR),
  ...fixtureNamesByPrefix("long-horizon-", CORPUS_DIR),
];
const WORLD_GRAPH_FIXTURES = fixtureNamesByPrefix("world-graph-mvp-", CORPUS_DIR);

describe("the ordered system pipeline is behaviour-preserving (20-contract.md §20, W97.5)", () => {
  it("enumerates both tick-driven corpora, so an emptied corpus cannot pass vacuously", () => {
    // Against FIXTURES_DIR, never CORPUS_DIR: "this commit ships a corpus" does not get
    // weaker when the cross-version job repoints CORPUS_DIR at a baseline tag.
    expect(fixtureNamesByPrefix("stable-life-", FIXTURES_DIR).length).toBeGreaterThan(0);
    expect(fixtureNamesByPrefix("world-graph-mvp-", FIXTURES_DIR).length).toBeGreaterThan(0);
  });

  describe("simulation — the end-of-week pass", () => {
    it.each(SIMULATION_FIXTURES)("%s: serialization, status and changes are golden", (name) => {
      expect(runFixtureTrace(simulationEngine().withEmitter(nullEmitter), name)).toMatchSnapshot();
    });

    it.each(SIMULATION_FIXTURES)("%s: the event stream is golden, system.ran included", (name) => {
      const recorder = createRecordingEmitter();
      runFixtureTrace(simulationEngine().withEmitter(recorder), name);
      expect(normalizeEvents(recorder.events)).toMatchSnapshot();
    });

    it.each(SIMULATION_FIXTURES)("%s: the null emitter reaches the same state as a recording one", (name) => {
      const withNull = runFixtureTrace(simulationEngine().withEmitter(nullEmitter), name);
      const withRecording = runFixtureTrace(simulationEngine().withEmitter(createRecordingEmitter()), name);
      expect(withRecording.serialized).toBe(withNull.serialized);
      expect(withRecording.changes).toEqual(withNull.changes);
    });
  });

  describe("world-graph — the tick batch", () => {
    it.each(WORLD_GRAPH_FIXTURES)("%s: serialization, status and changes are golden", (name) => {
      expect(runFixtureTrace(worldGraphEngine().withEmitter(nullEmitter), name)).toMatchSnapshot();
    });

    it.each(WORLD_GRAPH_FIXTURES)("%s: the event stream is golden, and names no per-system event", (name) => {
      const recorder = createRecordingEmitter();
      runFixtureTrace(worldGraphEngine().withEmitter(recorder), name);
      // §20's emission asymmetry, asserted rather than assumed: the shared substrate emits
      // nothing, so world-graph must still produce no per-system trace event once its loop
      // is that substrate.
      expect(recorder.events.some((event) => event.name.endsWith("system.ran"))).toBe(false);
      expect(normalizeEvents(recorder.events)).toMatchSnapshot();
    });

    it.each(WORLD_GRAPH_FIXTURES)("%s: the null emitter reaches the same state as a recording one", (name) => {
      const withNull = runFixtureTrace(worldGraphEngine().withEmitter(nullEmitter), name);
      const withRecording = runFixtureTrace(worldGraphEngine().withEmitter(createRecordingEmitter()), name);
      expect(withRecording.serialized).toBe(withNull.serialized);
      expect(withRecording.changes).toEqual(withNull.changes);
    });
  });
});
