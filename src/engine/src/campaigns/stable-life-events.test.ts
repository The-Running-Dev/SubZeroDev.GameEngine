/**
 * "Stable Life: Events" — the two W57 claims the replay `Outcome` cannot carry.
 *
 * Contract: `10-simulation-kind.md` §3, §7.9, §12; `04-core.md` §7.1.
 *
 * `Outcome` (07-replay.md §2) is deliberately narrow — `finalStatus`, decisions,
 * achievement ids, and the kind's terminal identity. The headline lives in `kindState`,
 * which `Outcome` excludes on purpose, and "the unlock survives a *new session*" is a
 * `SessionStore`/`ProfileStore` fact rather than a replay one. So both are proved here by
 * driving the real engine, exactly the way `stable-life.replay.test.ts` proves W55.6's
 * eviction divergence rather than leaning on the `it.each` loop.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createInMemorySessionStore } from "../core/session/store.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import type { Engine, KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import type { SimulationKindState } from "../kinds/simulation/state.js";
import { buildStableLifeEventsCampaign, STABLE_LIFE_EVENTS_CAMPAIGN_ID } from "./stable-life-events.js";

const SEED = "stable-life-events-headline-seed";

function build(): { engine: Engine; registry: ContentRegistry; kinds: KindRegistry } {
  const built = buildStableLifeEventsCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life: Events campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected it to validate");
  return {
    engine: createEngine({ kinds, registry: registryResult.value, ids: createCountingIds() }),
    registry: registryResult.value,
    kinds,
  };
}

/** The `kindState` after each `end_week`, in order. */
function weeklyStates(count: number): SimulationKindState[] {
  const { engine } = build();
  const created = engine.createGame({ campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, seed: SEED });
  if (!created.ok || !created.value) throw new Error("expected createGame to succeed");

  let state = created.value;
  const out: SimulationKindState[] = [];
  for (let i = 0; i < count; i += 1) {
    const result = engine.submitAction(state, "end_week");
    if (!result.ok || !result.value) throw new Error(`end_week #${i} was rejected`);
    state = result.value;
    out.push(state.kindState as SimulationKindState);
  }
  return out;
}

describe("W57.4 — the headline changes only because an event fired that week", () => {
  it("week one is eventless and quiet; week two fires an event and the headline changes with it", () => {
    const [first, second] = weeklyStates(2);

    // Week one: nothing eligible fired (`event-power-cut` is gated to week two), strangeness
    // is untouched, and the headline sits in the quiet band.
    expect(first!.world.strangenessBase).toBe(0);
    expect(first!.world.headlinePool.shownThisWeek).toBe("headline-quiet");

    // Week two: the event fires, moves strangeness past `headline-strange`'s own
    // `minStrangeness`, and `headline` — which §3 runs *after* `events` — reads the moved
    // value rather than the one the week started with.
    expect(second!.world.strangenessBase).toBe(5);
    expect(second!.world.headlinePool.shownThisWeek).toBe("headline-strange");
  });

  it("nothing but the event separates the two weeks — the player did the same thing both times", () => {
    const [first, second] = weeklyStates(2);
    // Same empty plan, same actions, same everything the player controls. The only input
    // that differs is whether an event fired, which is the whole claim.
    expect(first!.plan?.actions).toEqual([]);
    expect(second!.plan?.actions).toEqual([]);
    expect(first!.world.headlinePool.shownThisWeek).not.toBe(second!.world.headlinePool.shownThisWeek);
  });
});

describe("W57.5 — an unlock reaches the ProfileStore and outlives the session", () => {
  it("upserts through ProfileStore, and a new session with the same profileId still sees it", async () => {
    const { registry, kinds } = build();
    const profiles = createInMemoryProfileStore();
    const store = createInMemorySessionStore({
      engine: createEngine({ kinds, registry, ids: createCountingIds() }),
      registry,
      profiles,
    });

    const { sessionId } = await store.createSession({
      campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, seed: SEED, profileId: "player-1",
    });
    // Two weeks: the first emits the `need_drift` changes the achievement counts, the
    // second is where `achievements` sees the counter and unlocks.
    await store.submitAction(sessionId, "end_week");
    await store.submitAction(sessionId, "end_week");

    const { profile } = await profiles.load("player-1");
    expect(profile.achievements).toEqual([
      { campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, achievementId: "achievement-first-week" },
    ]);

    const second = await store.createSession({
      campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, seed: SEED, profileId: "player-1",
    });
    expect(second.sessionId).not.toBe(sessionId);
    const { profile: stillThere } = await profiles.load("player-1");
    expect(stillThere.achievements).toEqual([
      { campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, achievementId: "achievement-first-week" },
    ]);
  });

  it("never records the same achievement twice, however many weeks run", async () => {
    const { registry, kinds } = build();
    const profiles = createInMemoryProfileStore();
    const store = createInMemorySessionStore({
      engine: createEngine({ kinds, registry, ids: createCountingIds() }),
      registry,
      profiles,
    });

    const { sessionId } = await store.createSession({
      campaignId: STABLE_LIFE_EVENTS_CAMPAIGN_ID, seed: SEED, profileId: "player-2",
    });
    for (let i = 0; i < 4; i += 1) await store.submitAction(sessionId, "end_week");

    const { profile } = await profiles.load("player-2");
    expect(profile.achievements).toHaveLength(1);
  });
});

describe("W57.2 — a deferred response is presented the week after it was rolled", () => {
  it("queues the choice-bearing event in week three and presents it in week four", () => {
    const states = weeklyStates(3);
    const third = states[2]!;
    expect(third.pendingEventResponses).toHaveLength(1);
    expect(third.pendingEventResponses[0]).toMatchObject({
      eventId: "event-odd-letter", rolledWeek: 3, presentWeek: 4,
    });
    // The week it was rolled in is over — `calendar.currentWeek` has already moved to the
    // week it is presented in, which is what "presented by the next week's start-of-week
    // events phase" means for a client reading `presentWeek`.
    expect(third.calendar.currentWeek).toBe(4);
  });

  it("does not queue it any earlier — weeks one and two carry no pending response", () => {
    const states = weeklyStates(2);
    expect(states[0]!.pendingEventResponses).toEqual([]);
    expect(states[1]!.pendingEventResponses).toEqual([]);
  });
});
