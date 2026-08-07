import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { GameState, KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildWhatWouldLuciferDoCampaign, whatWouldLuciferDoSource, WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID } from "./what-would-lucifer-do.js";

const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;

function mustBuild(): BuiltCampaign {
  const result = buildWhatWouldLuciferDoCampaign();
  if (!result.ok || !result.value) throw new Error("What Would Lucifer Do? did not build");
  return result.value;
}

const built = mustBuild();
const content = built.campaign.content as StoryGraphCampaign;

function engine() {
  const registry = buildValidatedContentRegistry([built], kinds);
  if (!registry.ok || !registry.value) throw new Error("What Would Lucifer Do? did not validate");
  return createEngine({ kinds, registry: registry.value, ids: createCountingIds() });
}

interface Run {
  readonly state: GameState;
  readonly pages: readonly string[];
  readonly endingId: string;
  readonly achievements: readonly string[];
}

/**
 * Plays `script` in order: at every choice page the head of the queue is taken when it is
 * available, otherwise the first available action is (which is how the discovery hub's
 * auto-cascade and any one-way pages behind a `random` node are crossed without the script
 * needing to know which branch the seed picked, or having to enumerate every side page).
 * Every scripted id must eventually be consumed.
 */
function play(script: readonly string[], seed: string): Run {
  const api = engine();
  const created = api.createGame({ campaignId: WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID, seed });
  if (!created.ok || !created.value) throw new Error("createGame failed");

  let state = created.value;
  const pages: string[] = [(state.kindState as StoryGraphKindState).currentNodeId];
  const queue = [...script];

  for (let guard = 0; state.status === "active" && guard < 300; guard += 1) {
    const actions = api.availableActions(state).filter((action) => action.available);
    if (actions.length === 0) throw new Error(`no available action at ${pages.at(-1)}`);
    const head = queue[0];
    const scripted = head !== undefined && actions.some((action) => action.id === head);
    const actionId = scripted ? queue.shift()! : actions[0]!.id;
    const result = api.submitAction(state, actionId);
    if (!result.ok || !result.value) throw new Error(`${actionId} rejected at ${pages.at(-1)}`);
    state = result.value;
    pages.push((state.kindState as StoryGraphKindState).currentNodeId);
  }

  if (state.status !== "ended") throw new Error(`script did not reach an ending (last page ${pages.at(-1)})`);
  if (queue.length > 0) throw new Error(`script left ${queue.join(", ")} unconsumed`);

  const kindState = state.kindState as StoryGraphKindState;
  return { state, pages, endingId: kindState.endingId!, achievements: kindState.unlockedAchievements };
}

// Every scored prediction's correct and "conventional wrong" (reasonable_assumption-tagged,
// where authored) choice id, in the order the campaign presents them.
const WRONG = {
  ch1_scene1: "police",
  ch1_scene2: "reverse",
  ch2_p1: "ch2_p1_lift",
  ch2_p2: "ch2_p2_slow",
  ch3_p1: "ch3_p1_perfect",
  ch3_p2: "ch3_p2_quiet",
  ch3_p3: "ch3_p3_shrink",
  ch4_p1: "ch4_p1_apply",
  ch4_p2: "ch4_p2_accept",
  ch4_p3: "ch4_p3_ignore",
  ch5_p1: "ch5_p1_unplug",
  ch5_p2: "ch5_p2_human",
  ch5_p3: "ch5_p3_optimistic",
  ch6_p1: "ch6_p1_tolerate",
  ch6_p2: "ch6_p2_stop",
  ch6_p3: "ch6_p3_nothing",
  ch7_p1: "ch7_p1_grateful",
  ch7_p2: "ch7_p2_ask_visa",
  ch8_p1: "ch8_p1_mercy",
  ch8_p2: "ch8_p2_close",
  ch8_p3: "ch8_p3_prototype",
  ch8_p4: "ch8_p4_nothing",
  ch8_p5: "ch8_p5_test",
  ch8_p6: "ch8_p6_villain",
  ch8_p7: "ch8_p7_because",
  ch8_p8: "ch8_p8_joke",
} as const;

const CORRECT = {
  ch1_scene1: "laugh",
  ch1_scene2: "thumbsup",
  ch2_p1: "ch2_p1_correct",
  ch2_p2: "ch2_p2_correct",
  ch3_p1: "ch3_p1_correct",
  ch3_p2: "ch3_p2_correct",
  ch3_p3: "ch3_p3_correct",
  ch4_p1: "ch4_p1_correct",
  ch4_p2: "ch4_p2_correct",
  ch4_p3: "ch4_p3_correct",
  ch5_p1: "ch5_p1_correct",
  ch5_p2: "ch5_p2_correct",
  ch5_p3: "ch5_p3_correct",
  ch6_p1: "ch6_p1_correct",
  ch6_p2: "ch6_p2_correct",
  ch6_p3: "ch6_p3_correct",
  ch7_p1: "ch7_p1_correct",
  ch7_p2: "ch7_p2_correct",
  ch8_p1: "ch8_p1_correct",
  ch8_p2: "ch8_p2_correct",
  ch8_p3: "ch8_p3_correct",
  ch8_p4: "ch8_p4_correct",
  ch8_p5: "ch8_p5_correct",
  ch8_p6: "ch8_p6_correct",
  ch8_p7: "ch8_p7_correct",
  ch8_p8: "ch8_p8_correct",
} as const;

const ORDER = [
  "ch1_scene1", "ch1_scene2", "ch2_p1", "ch2_p2", "ch3_p1", "ch3_p2", "ch3_p3",
  "ch4_p1", "ch4_p2", "ch4_p3", "ch5_p1", "ch5_p2", "ch5_p3", "ch6_p1", "ch6_p2", "ch6_p3",
  "ch7_p1", "ch7_p2", "ch8_p1", "ch8_p2", "ch8_p3", "ch8_p4", "ch8_p5", "ch8_p6", "ch8_p7", "ch8_p8",
] as const;

/** First `n` predictions correct, then wrong through the rest. */
function firstNCorrect(n: number, overrides: Partial<Record<(typeof ORDER)[number], string>> = {}): string[] {
  return ORDER.map((id, index) => overrides[id] ?? (index < n ? CORRECT[id] : WRONG[id]));
}

const ALL_WRONG = firstNCorrect(0);
const ALL_CORRECT = firstNCorrect(26);

const SCRIPTS: readonly { readonly name: string; readonly ending: string; readonly script: readonly string[] }[] = [
  { name: "walk away", ending: "walk_away", script: ["leave"] },
  { name: "novice", ending: "tier_novice", script: [...ALL_WRONG, "novice"] },
  { name: "reasonable human being", ending: "reasonable_human_being", script: [...ALL_WRONG, "reasonable_human"] },
  {
    name: "apprentice",
    ending: "tier_apprentice",
    // ch8_p3 answered with the deliberately-absurd-but-still-an-underestimate option, for
    // "The Correct Answer Was Somehow Worse".
    script: [...firstNCorrect(8, { ch8_p3: "ch8_p3_sentient" }), "apprentice"],
  },
  {
    name: "fluent",
    ending: "tier_fluent",
    // Reads the full AI Model Selection Policy before answering, for "Reasoning Should Scale".
    script: (() => {
      const base = firstNCorrect(14);
      const idx = base.indexOf(CORRECT.ch5_p3);
      base.splice(idx, 0, "read_policy");
      return [...base, "fluent"];
    })(),
  },
  { name: "disturbing", ending: "tier_disturbing", script: [...firstNCorrect(20), "disturbing"] },
  { name: "transcendent", ending: "tier_transcendent", script: [...ALL_CORRECT, "transcendent"] },
  { name: "there is no fucking way", ending: "no_fucking_way", script: [...ALL_CORRECT, "no_fucking_way"] },
];

describe("What Would Lucifer Do?", () => {
  it("builds and validates with no Tier 1 errors and no Tier 2 warnings", () => {
    const registry = buildValidatedContentRegistry([built], kinds);
    expect(registry.errors).toEqual([]);
    expect(registry.warnings).toEqual([]);
    expect(registry.ok).toBe(true);
    expect(built.campaign.id).toBe(WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID);
    expect(built.campaign.kindId).toBe("story-graph");
  });

  it("carries a playable amount of content: predictions, seeded events, gated discoveries, endings", () => {
    const all = Object.values(content.nodes);
    const visible = all.filter((node) => node.kind === "choice" || node.kind === "ending");
    const random = all.filter((node) => node.kind === "random");
    const endings = all.filter((node) => node.kind === "ending");
    const choices = all.flatMap((node) => (node.kind === "choice" ? node.choices : []));
    const discoveries = choices.filter((choice) => choice.showWhen !== undefined);

    expect(visible.length).toBeGreaterThanOrEqual(80);
    expect(choices.length).toBeGreaterThanOrEqual(100);
    expect(random.length).toBeGreaterThanOrEqual(4);
    expect(discoveries.length).toBeGreaterThanOrEqual(8);
    expect(endings.length).toBe(8);
    for (const ending of endings) {
      expect(built.strings.get(ending.textKey)).toMatch(/\n\n/);
    }
  });

  it("declares unique node, choice, ending and achievement ids", () => {
    const endingIds = Object.values(content.nodes).flatMap((node) => (node.kind === "ending" ? [node.endingId] : []));
    expect(new Set(endingIds).size).toBe(endingIds.length);

    const achievementIds = content.achievements.map((achievement) => achievement.id);
    expect(new Set(achievementIds).size).toBe(achievementIds.length);

    for (const node of Object.values(content.nodes)) {
      if (node.kind !== "choice") continue;
      const ids = node.choices.map((choice) => choice.id);
      expect(new Set(ids).size, `duplicate choice id in ${node.id}`).toBe(ids.length);
    }
  });

  it.each(SCRIPTS)("reaches the $name ending", ({ ending, script }) => {
    const run = play(script, `wwld-${ending}`);
    expect(run.state.status).toBe("ended");
    expect(run.endingId).toBe(ending);
  });

  it("reaches every authored ending across the committed scripts", () => {
    const reached = new Set(SCRIPTS.map(({ ending, script }) => play(script, `wwld-${ending}`).endingId));
    const authored = Object.values(content.nodes).flatMap((node) => (node.kind === "ending" ? [node.endingId] : []));
    expect([...reached].sort()).toEqual([...authored].sort());
  });

  it("unlocks every authored achievement across the committed scripts", () => {
    const unlocked = new Set(SCRIPTS.flatMap(({ ending, script }) => play(script, `wwld-${ending}`).achievements));
    const authored = content.achievements.map((achievement) => achievement.id);
    expect(authored.filter((id) => !unlocked.has(id))).toEqual([]);
  });

  it("does not unlock 'A 2004 Salary' unless both the decline and the apply are predicted correctly", () => {
    const declineWrong = firstNCorrect(26, { ch4_p2: WRONG.ch4_p2 });
    expect(play(declineWrong, "wwld-decline-wrong").achievements).not.toContain("declined_the_money");

    const applyWrong = firstNCorrect(26, { ch4_p3: WRONG.ch4_p3 });
    expect(play(applyWrong, "wwld-apply-wrong").achievements).not.toContain("declined_the_money");

    expect(play(ALL_CORRECT, "wwld-both-correct").achievements).toContain("declined_the_money");
  });

  it("replays byte-identically from the same seed and inputs", () => {
    const api = engine();
    for (const { ending, script } of SCRIPTS) {
      const first = play(script, `wwld-${ending}`);
      const second = play(script, `wwld-${ending}`);
      expect(api.serialize(first.state)).toEqual(api.serialize(second.state));
    }
  });

  it("produces materially different playthroughs from the same campaign", () => {
    const runs = SCRIPTS.map(({ ending, script }) => play(script, `wwld-${ending}`));
    for (let left = 0; left < runs.length; left += 1) {
      for (let right = left + 1; right < runs.length; right += 1) {
        expect(runs[left]!.pages).not.toEqual(runs[right]!.pages);
      }
    }
  });

  it("exercises both outcomes of every authored random transition across fixed seeds", () => {
    const randomIds = Object.entries(whatWouldLuciferDoSource.nodes)
      .filter(([, node]) => node.kind === "random")
      .map(([id]) => id);
    const seen = new Map(randomIds.map((id) => [id, new Set<string>()]));

    for (const { script } of SCRIPTS) {
      for (let seed = 0; seed < 24; seed += 1) {
        const pages = play(script, `wwld-seed-${seed}`).pages;
        for (const randomId of randomIds) {
          const node = whatWouldLuciferDoSource.nodes[randomId];
          if (node?.kind !== "random") continue;
          for (const transition of node.transitions) {
            if (pages.includes(transition.goto)) seen.get(randomId)!.add(transition.goto);
          }
        }
      }
    }

    for (const randomId of randomIds) {
      const node = whatWouldLuciferDoSource.nodes[randomId];
      if (node?.kind === "random") expect(seen.get(randomId)!.size, randomId).toBe(node.transitions.length);
    }
  });

  it("interpolates no variables into authored text, so no hidden variable can leak", () => {
    for (const node of Object.values(content.nodes)) {
      expect(built.strings.get(node.textKey)).not.toMatch(/\{[a-zA-Z_]/);
    }
  });
});
