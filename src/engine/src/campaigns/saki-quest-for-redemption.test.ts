import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { GameState, KindRegistry } from "../core/kernel/types.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { StoryGraphCampaign } from "../kinds/story-graph/campaign.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildSakiQuestCampaign, sakiQuestSource, SAKI_QUEST_CAMPAIGN_ID } from "./saki-quest-for-redemption.js";

const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;

function mustBuild(): BuiltCampaign {
  const result = buildSakiQuestCampaign();
  if (!result.ok || !result.value) throw new Error("Saki: Quest for Redemption did not build");
  return result.value;
}

const built = mustBuild();
const content = built.campaign.content as StoryGraphCampaign;

function engine() {
  const registry = buildValidatedContentRegistry([built], kinds);
  if (!registry.ok || !registry.value) throw new Error("Saki: Quest for Redemption did not validate");
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
 * available, otherwise the first available action is (which is how the one-way pages
 * behind a `random` node are crossed without the script needing to know which branch the
 * seed picked). Every scripted id must eventually be consumed.
 */
function play(script: readonly string[], seed: string): Run {
  const api = engine();
  const created = api.createGame({ campaignId: SAKI_QUEST_CAMPAIGN_ID, seed });
  if (!created.ok || !created.value) throw new Error("createGame failed");

  let state = created.value;
  const pages: string[] = [(state.kindState as StoryGraphKindState).currentNodeId];
  const queue = [...script];

  for (let guard = 0; state.status === "active" && guard < 200; guard += 1) {
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

const SCRIPTS: readonly { readonly name: string; readonly ending: string; readonly script: readonly string[] }[] = [
  {
    name: "redemption",
    ending: "redeemed",
    script: [
      "ask_again", "incident_review", "class_minor", "take_seriously", "conclude",
      "trial_apology", "apology_sincere", "trial_gift", "gift_drink", "trials_done",
      "meta_accept", "ship", "lead_with_apology", "judge_redeemed",
    ],
  },
  {
    name: "normal human being",
    ending: "speedrun",
    script: ["send_a_message", "speedrun_send"],
  },
  {
    name: "the story he asked for",
    ending: "normal_adult",
    script: ["ask_again", "incident_ask", "obey", "write_the_story"],
  },
  {
    name: "infrastructure",
    ending: "scope_creep",
    script: [
      "invent_one", "incident_review", "class_integrity", "take_theatrically", "conclude",
      "trial_reflection", "reflect_build", "trials_abandon", "meta_accept",
      "more_infrastructure", "commit_fully",
    ],
  },
  {
    name: "philosophical victory",
    ending: "philosophical",
    script: [
      "ask_again", "incident_review", "class_two", "take_lightly",
      "consult_god", "deflect", "consult_self", "dissent", "conclude",
      "trials_abandon", "meta_defend", "philosophy", "pursue",
    ],
  },
  {
    name: "the content pipeline",
    ending: "content_pipeline",
    script: [
      "invent_one", "incident_review", "class_integrity", "take_theatrically",
      "consult_bureaucrat", "ask_consent", "consult_agent", "accept_plan", "conclude",
      "trials_done", "meta_accept", "ship", "say_nothing", "judge_recursive",
    ],
  },
  {
    name: "the smallest possible reaction",
    ending: "idiot",
    script: [
      "ask_again", "incident_ask", "decline_scaffolded",
      "consult_common_sense", "decline_philosophy",
      "consult_common_sense", "decline_infrastructure",
      "consult_common_sense", "decline_scaffolded",
      "conclude", "trials_abandon", "meta_accept", "ship", "explain", "judge_idiot",
    ],
  },
  {
    name: "seen by nobody",
    ending: "unresolved",
    script: [
      "read_changelog", "ask_again", "incident_assume", "class_observability", "take_seriously",
      "consult_conscience", "conscience_accept",
      "consult_common_sense", "decline_scaffolded",
      "consult_bureaucrat", "file_form",
      "consult_god", "answer_honestly",
      "consult_agent", "accept_plan",
      "consult_self", "ratify",
      "consult_questlog", "keep_marker",
      "full_bench", "minute_it",
      "trial_apology", "apology_campaign",
      "trial_gift", "gift_statue",
      "trial_reflection", "reflect_build",
      "trials_done", "meta_accept", "delete", "lead_with_apology", "judge_unresolved",
    ],
  },
];

describe("Saki: Quest for Redemption", () => {
  it("builds and validates with no Tier 1 errors and no Tier 2 warnings", () => {
    const registry = buildValidatedContentRegistry([built], kinds);
    expect(registry.errors).toEqual([]);
    expect(registry.warnings).toEqual([]);
    expect(registry.ok).toBe(true);
    expect(built.campaign.id).toBe(SAKI_QUEST_CAMPAIGN_ID);
    expect(built.campaign.kindId).toBe("story-graph");
  });

  it("carries a playable amount of content: visible pages, seeded events, gated discoveries, endings", () => {
    const all = Object.values(content.nodes);
    const visible = all.filter((node) => node.kind === "choice" || node.kind === "ending");
    const random = all.filter((node) => node.kind === "random");
    const endings = all.filter((node) => node.kind === "ending");
    const choices = all.flatMap((node) => (node.kind === "choice" ? node.choices : []));
    const discoveries = choices.filter((choice) => choice.showWhen !== undefined);
    const gated = choices.filter((choice) => choice.requirements !== undefined);

    expect(visible.length).toBeGreaterThanOrEqual(45);
    expect(choices.length).toBeGreaterThanOrEqual(90);
    expect(random.length).toBeGreaterThanOrEqual(4);
    expect(discoveries.length).toBeGreaterThanOrEqual(8);
    expect(gated.length).toBeGreaterThanOrEqual(2);
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
    const run = play(script, `saki-${ending}`);
    expect(run.state.status).toBe("ended");
    expect(run.endingId).toBe(ending);
  });

  it("reaches every authored ending across the committed scripts", () => {
    const reached = new Set(SCRIPTS.map(({ ending, script }) => play(script, `saki-${ending}`).endingId));
    const authored = Object.values(content.nodes).flatMap((node) => (node.kind === "ending" ? [node.endingId] : []));
    expect([...reached].sort()).toEqual([...authored].sort());
  });

  it("unlocks every authored achievement across the committed scripts", () => {
    const unlocked = new Set(SCRIPTS.flatMap(({ ending, script }) => play(script, `saki-${ending}`).achievements));
    const authored = content.achievements.map((achievement) => achievement.id);
    expect(authored.filter((id) => !unlocked.has(id))).toEqual([]);
  });

  it("replays byte-identically from the same seed and inputs", () => {
    const api = engine();
    for (const { ending, script } of SCRIPTS) {
      const first = play(script, `saki-${ending}`);
      const second = play(script, `saki-${ending}`);
      expect(api.serialize(first.state)).toEqual(api.serialize(second.state));
    }
  });

  it("produces materially different playthroughs from the same campaign", () => {
    const runs = SCRIPTS.map(({ ending, script }) => play(script, `saki-${ending}`));
    for (let left = 0; left < runs.length; left += 1) {
      for (let right = left + 1; right < runs.length; right += 1) {
        expect(runs[left]!.pages).not.toEqual(runs[right]!.pages);
      }
    }
  });

  it("exercises both outcomes of every authored random transition across fixed seeds", () => {
    const randomIds = Object.entries(sakiQuestSource.nodes)
      .filter(([, node]) => node.kind === "random")
      .map(([id]) => id);
    const seen = new Map(randomIds.map((id) => [id, new Set<string>()]));

    for (const { script } of SCRIPTS) {
      for (let seed = 0; seed < 24; seed += 1) {
        const pages = play(script, `saki-seed-${seed}`).pages;
        for (const randomId of randomIds) {
          const node = sakiQuestSource.nodes[randomId];
          if (node?.kind !== "random") continue;
          for (const transition of node.transitions) {
            if (pages.includes(transition.goto)) seen.get(randomId)!.add(transition.goto);
          }
        }
      }
    }

    for (const randomId of randomIds) {
      const node = sakiQuestSource.nodes[randomId];
      if (node?.kind === "random") expect(seen.get(randomId)!.size, randomId).toBe(node.transitions.length);
    }
  });

  it("interpolates no variables into authored text, so no hidden variable can leak", () => {
    for (const node of Object.values(content.nodes)) {
      expect(built.strings.get(node.textKey)).not.toMatch(/\{[a-zA-Z_]/);
    }
  });
});
