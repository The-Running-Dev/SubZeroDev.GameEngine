import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { GameState, KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildBulgariaBureaucracyCampaign, bulgariaBureaucracySource } from "./bulgaria-bureaucracy.js";
import { buildBulgariaDrivingCampaign, bulgariaDrivingSource } from "./bulgaria-driving.js";
import { buildBulgariaEnterpriseCampaign, bulgariaEnterpriseSource } from "./bulgaria-enterprise.js";
import { buildBulgariaInheritanceCampaign, bulgariaInheritanceSource } from "./bulgaria-inheritance.js";
import { buildBulgariaReturnCampaign, bulgariaReturnSource } from "./bulgaria-return.js";
import { buildLuciferChroniclesCampaign, luciferChroniclesSource } from "./lucifer-chronicles.js";

interface Fixture {
  readonly name: string;
  readonly source: StoryGraphCampaignSource;
  readonly built: BuiltCampaign;
  readonly routes: readonly [string, string, string];
  readonly minimumVisible: number;
  readonly legacyEndingNode: string;
}

function mustBuild(name: string, result: ReturnType<typeof buildBulgariaReturnCampaign>): BuiltCampaign {
  if (!result.ok || !result.value) throw new Error(`${name} did not build`);
  return result.value;
}

const FIXTURES: readonly Fixture[] = [
  { name: "Return", source: bulgariaReturnSource, built: mustBuild("Return", buildBulgariaReturnCampaign()), routes: ["smile", "explain", "laugh"], minimumVisible: 20, legacyEndingNode: "home_again" },
  { name: "Bureaucracy", source: bulgariaBureaucracySource, built: mustBuild("Bureaucracy", buildBulgariaBureaucracyCampaign()), routes: ["wait", "ask_guard", "coffee"], minimumVisible: 20, legacyEndingNode: "reward" },
  { name: "Driving", source: bulgariaDrivingSource, built: mustBuild("Driving", buildBulgariaDrivingCampaign()), routes: ["believe_him", "ask_another_opinion", "ignore_warning"], minimumVisible: 25, legacyEndingNode: "ending_trusting" },
  { name: "Inheritance", source: bulgariaInheritanceSource, built: mustBuild("Inheritance", buildBulgariaInheritanceCampaign()), routes: ["request_records", "call_mother", "cut_padlock"], minimumVisible: 25, legacyEndingNode: "ending_resolved" },
  { name: "Enterprise", source: bulgariaEnterpriseSource, built: mustBuild("Enterprise", buildBulgariaEnterpriseCampaign()), routes: ["offer_coffee", "ask_who_invited_them", "hide"], minimumVisible: 30, legacyEndingNode: "ending" },
  { name: "Lucifer Chronicles", source: luciferChroniclesSource, built: mustBuild("Lucifer", buildLuciferChroniclesCampaign()), routes: ["play_ben", "play_lucifer", "play_support"], minimumVisible: 30, legacyEndingNode: "ben_ending_incident_resolved" },
];

const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;

function engineFor(fixture: Fixture) {
  const registry = buildValidatedContentRegistry([fixture.built], kinds);
  if (!registry.ok || !registry.value) throw new Error(`${fixture.name} did not validate`);
  return createEngine({ kinds, registry: registry.value, ids: createCountingIds() });
}

function play(fixture: Fixture, route: string, seed = `${fixture.name}-${route}`, openingAction?: string): { state: GameState; pages: string[] } {
  const engine = engineFor(fixture);
  const created = engine.createGame({ campaignId: fixture.built.campaign.id, seed });
  if (!created.ok || !created.value) throw new Error("create failed");
  let state = created.value;
  const pages = [(state.kindState as StoryGraphKindState).currentNodeId];
  let first = true;
  for (let guard = 0; state.status === "active" && guard < 120; guard += 1) {
    const actions = engine.availableActions(state).filter((action) => action.available);
    const action = first
      ? actions.find((candidate) => candidate.id === route)
      : openingAction === undefined ? actions[0] : actions.find((candidate) => candidate.id === openingAction);
    if (!action) throw new Error(`${fixture.name}/${route} has no available action at ${pages.at(-1)}`);
    const result = engine.submitAction(state, action.id);
    if (!result.ok || !result.value) throw new Error(`${fixture.name}/${route} rejected ${action.id}`);
    state = result.value;
    pages.push((state.kindState as StoryGraphKindState).currentNodeId);
    first = false;
    openingAction = undefined;
  }
  if (state.status !== "ended") throw new Error(`${fixture.name}/${route} did not end`);
  return { state, pages };
}

describe("W64 story campaign expansion", () => {
  it("publishes one conflict-free v2 registry with no Tier 1 findings or Tier 2 warnings", () => {
    const registry = buildValidatedContentRegistry(FIXTURES.map((fixture) => fixture.built), kinds);
    expect(registry.ok).toBe(true);
    expect(registry.errors).toEqual([]);
    expect(registry.warnings).toEqual([]);
    expect(FIXTURES.map((fixture) => fixture.built.campaign.version)).toEqual(Array(6).fill("2.0.0"));
  });

  it.each(FIXTURES)("$name has the required reachable visible depth, seeded events, discoveries, and authored endings", (fixture) => {
    const content = fixture.built.campaign.content as StoryGraphCampaign;
    const nodes = Object.values(content.nodes);
    const visible = nodes.filter((node) => node.kind === "choice" || node.kind === "ending");
    const random = nodes.filter((node) => node.kind === "random");
    const discoveries = nodes.flatMap((node) => node.kind === "choice" ? node.choices.filter((choice) => choice.showWhen) : []);
    const endings = nodes.filter((node) => node.kind === "ending");
    expect(visible.length).toBeGreaterThanOrEqual(fixture.minimumVisible);
    expect(random.length).toBeGreaterThanOrEqual(2);
    expect(discoveries.length).toBeGreaterThanOrEqual(3);
    expect(endings.length).toBeGreaterThanOrEqual(3);
    for (const ending of endings) {
      const text = fixture.built.strings.get(ending.textKey);
      expect(text).toMatch(/\n\n/);
      expect(text).not.toMatch(/^Ending:|available conclusion/i);
    }
  });

  it.each(FIXTURES)("$name commits three materially different, deterministic route fixtures", (fixture) => {
    const completed = fixture.routes.map((route) => play(fixture, route));
    const repeated = fixture.routes.map((route) => play(fixture, route));
    const engine = engineFor(fixture);
    expect(completed.map(({ state }) => engine.serialize(state))).toEqual(repeated.map(({ state }) => engine.serialize(state)));
    expect(new Set(completed.map(({ state }) => (state.kindState as StoryGraphKindState).endingId)).size).toBeGreaterThanOrEqual(3);
    for (let left = 0; left < completed.length; left += 1) {
      for (let right = left + 1; right < completed.length; right += 1) {
        expect(completed[left]!.pages.slice(1, 3)).not.toEqual(completed[right]!.pages.slice(1, 3));
      }
    }
    const visibleCount = Object.values(fixture.source.nodes).filter((node) => node.kind === "choice" || node.kind === "ending").length;
    for (const route of completed) expect(route.pages.length / visibleCount).toBeLessThanOrEqual(0.7);
  });

  it("keeps both village-return opening choices completable", () => {
    const fixture = FIXTURES.find((candidate) => candidate.name === "Return")!;
    expect(play(fixture, "explain", "village-listen", "village_return_listen").state.status).toBe("ended");
    expect(play(fixture, "explain", "village-push", "village_return_push").state.status).toBe("ended");
  });

  it.each(FIXTURES)("$name exercises both outcomes of every authored random transition across fixed seeds", (fixture) => {
    const randomIds = Object.entries(fixture.source.nodes).filter(([, node]) => node.kind === "random").map(([id]) => id);
    const destinations = new Map(randomIds.map((id) => [id, new Set<string>()]));
    for (const route of fixture.routes) {
      for (let seed = 0; seed < 24; seed += 1) {
        const pages = play(fixture, route, `${fixture.name}-${route}-seed-${seed}`).pages;
        for (const randomId of randomIds) {
          const node = fixture.source.nodes[randomId];
          if (node?.kind !== "random") continue;
          for (const transition of node.transitions) if (pages.includes(transition.goto)) destinations.get(randomId)!.add(transition.goto);
        }
      }
    }
    for (const randomId of randomIds) {
      const node = fixture.source.nodes[randomId];
      if (node?.kind === "random") expect(destinations.get(randomId)!.size).toBe(node.transitions.length);
    }
  });

  it.each(FIXTURES)("$name migrates active, ended, and achievement-bearing v1 kind state without losing progress", (fixture) => {
    const migrate = fixture.built.campaign.migrateState;
    expect(migrate).toBeTypeOf("function");
    const base: StoryGraphKindState = {
      currentNodeId: fixture.source.startNodeId,
      variables: {},
      turn: 4,
      visitedCounts: { [fixture.source.startNodeId]: 1 },
      unlockedAchievements: ["legacy_achievement"],
    };
    const active = migrate!(base, "1.0.0");
    expect(active.ok).toBe(true);
    expect((active.value as StoryGraphKindState).unlockedAchievements).toEqual(["legacy_achievement"]);
    expect(Object.keys((active.value as StoryGraphKindState).variables).length).toBeGreaterThan(0);

    const ended = migrate!({ ...base, currentNodeId: fixture.legacyEndingNode, endingId: "legacy_ending" }, "1.0.0");
    expect(ended.ok).toBe(true);
    expect(Object.hasOwn(fixture.source.nodes, (ended.value as StoryGraphKindState).currentNodeId)).toBe(true);
  });

  it("migrates a completed Lucifer save to a matching v2 ending identity", () => {
    const fixture = FIXTURES.find((candidate) => candidate.name === "Lucifer Chronicles")!;
    const migrated = fixture.built.campaign.migrateState!({
      currentNodeId: "lucifer_ending_ticket_closed",
      endingId: "lucifer_ticket_closed",
      variables: {}, turn: 9, visitedCounts: {}, unlockedAchievements: [],
    }, "1.0.0");
    expect(migrated.ok).toBe(true);
    const state = migrated.value as StoryGraphKindState;
    expect(state.currentNodeId).toBe("lucifer_ending_support_manager");
    expect(state.endingId).toBe("lucifer_support_manager");
    expect((fixture.source.nodes[state.currentNodeId] as { endingId: string }).endingId).toBe(state.endingId);
  });

  it("keeps Bulgaria Bureaucracy migrations on the registry route", () => {
    const fixture = FIXTURES.find((candidate) => candidate.name === "Bureaucracy")!;
    const migrated = fixture.built.campaign.migrateState!({
      currentNodeId: "room_6", variables: { route: "archive_route" }, turn: 4, visitedCounts: {}, unlockedAchievements: [],
    }, "1.0.0");
    expect(migrated.ok).toBe(true);
    const state = migrated.value as StoryGraphKindState;
    expect(state.currentNodeId).toBe("registry_route_3");
    expect(state.variables.route).toBe("registry_route");
  });
});
