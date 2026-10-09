import { describe, it, expect } from "vitest";
import type { Campaign } from "../../core/registry/types.js";
import type { KindContext } from "../../core/kernel/types.js";
import { adoptContent } from "./adopt.js";
import { storyGraphKind } from "./kind.js";
import { availableActions } from "./scene.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { ChoiceNode } from "./nodes.js";
import type { StoryGraphKindState } from "./state.js";
import { validateStoryGraphState } from "./validateState.js";

// v1: one choice node with a way on, a second node already visited, an ending, an achievement.
const SOURCE: StoryGraphCampaign = {
  descriptionKey: "d",
  variables: {
    money: { type: "int", initial: 2, min: 0, max: 10 },
    stamped: { type: "bool", initial: false },
  },
  startNodeId: "hall",
  achievements: [{ id: "first_queue", nameKey: "a.n", descriptionKey: "a.d", condition: { field: "turn", operator: "greater_or_equal", value: 1 }, hidden: false }],
  nodes: {
    hall: {
      id: "hall",
      kind: "choice",
      textKey: "node.hall",
      choices: [{ id: "queue", labelKey: "choice.queue", goto: "window" }],
    },
    window: {
      id: "window",
      kind: "choice",
      textKey: "node.window",
      choices: [{ id: "leave", labelKey: "choice.leave", goto: "done" }],
    },
    done: { id: "done", kind: "ending", textKey: "node.done", endingId: "done" },
  },
};

function campaign(content: StoryGraphCampaign, version: string): Campaign {
  return { id: "queue", kindId: "story-graph", version, titleKey: "t", content };
}

/** v1 with `edit` applied to a deep copy. */
function target(edit: (c: StoryGraphCampaign) => void): Campaign {
  const content = structuredClone(SOURCE);
  edit(content);
  return campaign(content, "2");
}

// Partway through: standing in the hall again after visiting the window, one achievement.
function midGame(overrides?: Partial<StoryGraphKindState>): StoryGraphKindState {
  return {
    currentNodeId: "hall",
    variables: { money: 4, stamped: true },
    turn: 3,
    visitedCounts: { hall: 2, window: 1 },
    unlockedAchievements: ["first_queue"],
    ...overrides,
  };
}

const FROM = campaign(SOURCE, "1");

const hall = (c: StoryGraphCampaign): ChoiceNode => c.nodes.hall as ChoiceNode;

/** v1 plus a node, a choice into it, and a variable — purely additive. */
const ADDITIVE = target((c) => {
  c.variables.patience = { type: "int", initial: 5 };
  c.variables.mood = { type: "enum", initial: "calm", values: ["calm", "cross"] };
  c.nodes.annex = {
    id: "annex",
    kind: "choice",
    textKey: "node.annex",
    choices: [{ id: "return", labelKey: "choice.return", goto: "hall" }],
  };
  hall(c).choices.push({ id: "annex", labelKey: "choice.annex", goto: "annex" });
});

describe("S132.1 — story-graph adopts additive content", () => {
  it("declares adoptContent", () => {
    expect(typeof storyGraphKind.adoptContent).toBe("function");
  });

  it("inserts each variable the target adds at its initial value and changes nothing else", () => {
    const state = midGame();
    const before = structuredClone(state);
    const decision = storyGraphKind.adoptContent!(state, FROM, ADDITIVE);

    expect(decision.adopt).toBe(true);
    if (!decision.adopt) return;
    expect({ ...decision.state.variables }).toEqual({ money: 4, stamped: true, patience: 5, mood: "calm" });
    expect({ ...decision.state, variables: null }).toEqual({ ...before, variables: null });
    expect(state).toEqual(before);
  });

  it("adopts a target identical to the source unchanged", () => {
    const decision = adoptContent(midGame(), FROM, campaign(structuredClone(SOURCE), "2"));
    expect(decision).toEqual({ adopt: true, state: midGame() });
  });

  it("keeps a carried variable's value even where the target changes its initial", () => {
    const to = target((c) => {
      c.variables.money!.initial = 9;
    });
    const decision = adoptContent(midGame(), FROM, to);
    expect(decision.adopt && decision.state.variables.money).toBe(4);
  });
});

describe("S132.2 — story-graph refuses content that would strand the player", () => {
  const refused = { adopt: false, reason: "content_incompatible" };

  it("refuses a currentNodeId the target lacks", () => {
    const to = target((c) => {
      delete c.nodes.hall;
      c.startNodeId = "window";
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
    // A played state always counts the node it stands on, so the visitedCounts rule refuses
    // this too; without that count, the current-node rule still does.
    expect(adoptContent(midGame({ visitedCounts: { window: 1 } }), FROM, to)).toEqual(refused);
  });

  it("refuses a current node that is an ending in the target", () => {
    const to = target((c) => {
      c.nodes.hall = { id: "hall", kind: "ending", textKey: "node.hall", endingId: "gone" };
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a current node that is an auto node in the target", () => {
    const to = target((c) => {
      c.nodes.hall = { id: "hall", kind: "auto", textKey: "node.hall", goto: "window" };
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a current node that is a random node in the target", () => {
    const to = target((c) => {
      c.nodes.hall = { id: "hall", kind: "random", textKey: "node.hall", transitions: [{ weight: 1, goto: "window" }] };
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a current choice node with no available choice once inserted variables apply", () => {
    // The only choice is now gated on a variable the target adds, whose initial value fails it.
    const to = target((c) => {
      c.variables.ticket = { type: "bool", initial: false };
      hall(c).choices[0]!.requirements = {
        field: "var.ticket",
        operator: "equals",
        value: true,
      };
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a visitedCounts key that names no target node", () => {
    const to = target((c) => {
      delete c.nodes.window;
      hall(c).choices[0]!.goto = "done";
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses an unlocked achievement the target lacks", () => {
    const to = target((c) => {
      c.achievements = [];
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a carried variable whose target VarType differs", () => {
    const to = target((c) => {
      c.variables.stamped = { type: "int", initial: 0 };
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("refuses a variable the source declared and the state carries that the target drops", () => {
    const to = target((c) => {
      delete c.variables.stamped;
    });
    expect(adoptContent(midGame(), FROM, to)).toEqual(refused);
  });

  it("tolerates a carried variable that neither campaign declares, as validateState does", () => {
    const state = midGame({ variables: { money: 4, stamped: true, legacy: 1 } });
    const decision = adoptContent(state, FROM, ADDITIVE);
    expect(decision.adopt && decision.state.variables.legacy).toBe(1);
  });
});

describe("S132.3 — availability is the scene's own", () => {
  // The hall's only choice shows only when an inserted variable's initial value allows it.
  function gatedBy(kind: "showWhen" | "requirements", initial: boolean): Campaign {
    return target((c) => {
      c.variables.ticket = { type: "bool", initial };
      hall(c).choices[0]![kind] = {
        field: "var.ticket",
        operator: "equals",
        value: true,
      };
    });
  }

  for (const kind of ["showWhen", "requirements"] as const) {
    for (const initial of [true, false]) {
      it(`adopts exactly when the scene offers an available choice (${kind}, initial ${initial})`, () => {
        const to = gatedBy(kind, initial);
        const decision = adoptContent(midGame(), FROM, to);
        // What the scene would show on the target, for the state the adoption would produce.
        const inserted = { ...midGame(), variables: { ...midGame().variables, ticket: initial } };
        const offered = availableActions(inserted, { campaign: to } as KindContext);
        expect(decision.adopt).toBe(offered.some((a) => a.available));
        expect(decision.adopt).toBe(initial);
      });
    }
  }
});

describe("S132.4 — every adopted state is valid against the target", () => {
  it("passes validateState on the target, and fails it on a target it was refused for", () => {
    const decision = adoptContent(midGame(), FROM, ADDITIVE);
    expect(decision.adopt).toBe(true);
    if (!decision.adopt) return;
    expect(validateStoryGraphState(decision.state, ADDITIVE)).toBe(true);
    // The unadopted state lacks the inserted variables, so it is not valid there.
    expect(validateStoryGraphState(midGame(), ADDITIVE)).toBe(false);
  });
});
