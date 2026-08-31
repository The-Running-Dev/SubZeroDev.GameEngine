import { describe, it, expect } from "vitest";
import { validateCampaign } from "./validate.js";
import { buildValidatedContentRegistry } from "../../core/validation/tiered.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { Node } from "./nodes.js";
import type { VariableSchema } from "./variables.js";
import type { Campaign, BuiltCampaign } from "../../core/registry/types.js";
import type { Kind, KindRegistry } from "../../core/kernel/types.js";
import type { ValidationResult } from "../../core/validation/types.js";

// A minimal but complete, valid worked example — the shape of 03 §12's Bureaucracy arc.
const validSchema: VariableSchema = {
  patience: { type: "int", initial: 10, min: 0, max: 10, visible: true, labelKey: "stat.patience" },
  documents_collected: { type: "bool", initial: false },
};

const validCampaign: StoryGraphCampaign = {
  descriptionKey: "campaign.desc",
  variables: validSchema,
  startNodeId: "municipality",
  achievements: [
    {
      id: "it_builds_character",
      nameKey: "ach.builds_character.name",
      descriptionKey: "ach.builds_character.desc",
      condition: { field: "var.documents_collected", operator: "equals", value: true },
      hidden: true,
    },
  ],
  nodes: {
    municipality: {
      id: "municipality",
      kind: "choice",
      textKey: "node.municipality.text",
      choices: [
        {
          id: "wait",
          labelKey: "choice.wait",
          effects: [{ op: "decrement", var: "patience", by: 2 }],
          goto: "clerk_review",
        },
        {
          id: "coffee",
          labelKey: "choice.coffee",
          effects: [{ op: "set", var: "documents_collected", value: true }],
          goto: "clerk_review",
        },
      ],
    },
    clerk_review: {
      id: "clerk_review",
      kind: "random",
      textKey: "node.clerk_review.text",
      transitions: [
        { weight: 1, goto: "room_14" },
        { weight: 1, goto: "reward" },
      ],
    },
    room_14: { id: "room_14", kind: "auto", textKey: "node.room_14.text", goto: "reward" },
    reward: {
      id: "reward",
      kind: "auto",
      textKey: "node.reward.text",
      goto: "ending",
    },
    ending: { id: "ending", kind: "ending", textKey: "node.ending.text", endingId: "it_builds_character" },
  },
};

const validStrings = new Map([
  ["campaign.title", "Bureaucracy"],
  ["campaign.desc", "d"],
  ["node.municipality.text", "Closed until 11:30."],
  ["node.clerk_review.text", "The clerk reviews your papers."],
  ["node.room_14.text", "Room 14 sends you onward."],
  ["node.reward.text", "You have {patience} patience left."],
  ["node.ending.text", "The end."],
  ["choice.wait", "Wait"],
  ["choice.coffee", "Buy coffee"],
  ["ach.builds_character.name", "It Builds Character"],
  ["ach.builds_character.desc", "Survive the bureaucracy."],
  ["stat.patience", "Patience"],
]);

function campaignEnvelope(content: StoryGraphCampaign): Campaign {
  return { id: "bureaucracy", kindId: "story-graph", version: "1", titleKey: "campaign.title", content };
}

describe("validateCampaign — a fully valid campaign", () => {
  it("passes with zero errors and zero warnings", () => {
    const result = validateCampaign(campaignEnvelope(validCampaign), validStrings);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe("validateCampaign — Tier 1: dangling references", () => {
  it("fails on a dangling startNodeId", () => {
    const content = { ...validCampaign, startNodeId: "nowhere" };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "dangling_reference" && e.path === "nowhere")).toBe(true);
  });

  it("fails on a dangling choice goto", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      municipality: {
        ...(validCampaign.nodes.municipality as Extract<Node, { kind: "choice" }>),
        choices: [{ id: "wait", labelKey: "choice.wait", goto: "nowhere" }],
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "dangling_reference" && e.path === "nowhere")).toBe(true);
  });

  it("fails on a dangling auto node goto", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      room_14: { id: "room_14", kind: "auto", textKey: "node.room_14.text", goto: "nowhere" },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "dangling_reference" && e.path === "nowhere")).toBe(true);
  });

  it("fails on a dangling random transition goto", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      clerk_review: {
        id: "clerk_review",
        kind: "random",
        textKey: "node.clerk_review.text",
        transitions: [{ weight: 1, goto: "nowhere" }],
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "dangling_reference" && e.path === "nowhere")).toBe(true);
  });
});

describe("validateCampaign — Tier 1: undeclared variables", () => {
  it("fails on an undeclared variable in a Consequence", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      room_14: {
        id: "room_14",
        kind: "auto",
        textKey: "node.room_14.text",
        effects: [{ op: "increment", var: "nope", by: 1 }],
        goto: "reward",
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "undeclared_variable" && e.path === "nope")).toBe(true);
  });

  it("fails on an undeclared variable in a Condition, via unknown_condition_field (W10)", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      municipality: {
        ...(validCampaign.nodes.municipality as Extract<Node, { kind: "choice" }>),
        choices: [
          {
            id: "wait",
            labelKey: "choice.wait",
            requirements: { field: "var.nope", operator: "equals", value: true },
            goto: "clerk_review",
          },
        ],
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "unknown_condition_field" && e.path === "var.nope")).toBe(true);
  });
});

describe("validateCampaign — Tier 1: duplicate ids", () => {
  it("fails on two choices sharing an id within one node", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      municipality: {
        id: "municipality",
        kind: "choice",
        textKey: "node.municipality.text",
        choices: [
          { id: "wait", labelKey: "choice.wait", goto: "clerk_review" },
          { id: "wait", labelKey: "choice.coffee", goto: "clerk_review" },
        ],
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "duplicate_id" && e.path === "wait")).toBe(true);
  });

  it("fails on two achievements sharing an id", () => {
    const content = { ...validCampaign, achievements: [...validCampaign.achievements, validCampaign.achievements[0]!] };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "duplicate_id" && e.path === "it_builds_character")).toBe(true);
  });
});

describe("validateCampaign — Tier 1: missing LocKeys", () => {
  it("fails on a missing node textKey", () => {
    const strings = new Map(validStrings);
    strings.delete("node.municipality.text");
    const result = validateCampaign(campaignEnvelope(validCampaign), strings);
    expect(
      result.errors.some((e) => e.code === "missing_string_key" && e.path === "node.municipality.text"),
    ).toBe(true);
  });

  it("fails on a missing choice labelKey", () => {
    const strings = new Map(validStrings);
    strings.delete("choice.wait");
    const result = validateCampaign(campaignEnvelope(validCampaign), strings);
    expect(result.errors.some((e) => e.code === "missing_string_key" && e.path === "choice.wait")).toBe(true);
  });

  it("fails on a missing achievement nameKey", () => {
    const strings = new Map(validStrings);
    strings.delete("ach.builds_character.name");
    const result = validateCampaign(campaignEnvelope(validCampaign), strings);
    expect(
      result.errors.some((e) => e.code === "missing_string_key" && e.path === "ach.builds_character.name"),
    ).toBe(true);
  });

  it("fails when a visible variable declares no labelKey at all", () => {
    const schema: VariableSchema = { ...validSchema, patience: { type: "int", initial: 10, visible: true } };
    const content = { ...validCampaign, variables: schema };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "missing_label_key" && e.path === "patience")).toBe(true);
  });
});

describe("validateCampaign — Tier 1: text interpolation", () => {
  it("fails when text interpolates a non-visible variable", () => {
    const strings = new Map(validStrings);
    strings.set("node.reward.text", "You collected documents: {documents_collected}.");
    const result = validateCampaign(campaignEnvelope(validCampaign), strings);
    expect(
      result.errors.some((e) => e.code === "non_visible_variable_in_text" && e.path === "documents_collected"),
    ).toBe(true);
  });

  it("fails when text interpolates an undeclared variable", () => {
    const strings = new Map(validStrings);
    strings.set("node.reward.text", "Value: {nope}.");
    const result = validateCampaign(campaignEnvelope(validCampaign), strings);
    expect(result.errors.some((e) => e.code === "non_visible_variable_in_text" && e.path === "nope")).toBe(true);
  });

  it("does not fail when text interpolates a visible variable", () => {
    const result = validateCampaign(campaignEnvelope(validCampaign), validStrings);
    expect(result.errors.some((e) => e.code === "non_visible_variable_in_text")).toBe(false);
  });
});

describe("validateCampaign — Tier 1: random transition weights", () => {
  it("fails on a non-positive-integer weight", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      clerk_review: {
        id: "clerk_review",
        kind: "random",
        textKey: "node.clerk_review.text",
        transitions: [{ weight: 0, goto: "reward" }],
      },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_transition_weight" && e.path === "clerk_review")).toBe(true);
  });

  it("fails on a random node with zero transitions", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      clerk_review: { id: "clerk_review", kind: "random", textKey: "node.clerk_review.text", transitions: [] },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_transition_weight" && e.path === "clerk_review")).toBe(true);
  });
});

describe("validateCampaign — Tier 1: consequence type checking", () => {
  function withRoom14Effect(effect: { op: "set" | "increment" | "decrement"; var: string; value?: unknown; by?: number }) {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      room_14: {
        id: "room_14",
        kind: "auto",
        textKey: "node.room_14.text",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        effects: [effect as any],
        goto: "reward",
      },
    };
    return { ...validCampaign, nodes };
  }

  it("fails when a set value's type doesn't match a bool variable", () => {
    const content = withRoom14Effect({ op: "set", var: "documents_collected", value: 1 });
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_consequence_value" && e.path === "documents_collected")).toBe(
      true,
    );
  });

  it("fails when a set value's type doesn't match an int variable", () => {
    const content = withRoom14Effect({ op: "set", var: "patience", value: "high" });
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_consequence_value" && e.path === "patience")).toBe(true);
  });

  it("fails on increment/decrement against a non-int variable", () => {
    const content = withRoom14Effect({ op: "increment", var: "documents_collected", by: 1 });
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_consequence_value" && e.path === "documents_collected")).toBe(
      true,
    );
  });

  it("does not fail on an out-of-range but type-correct set value — clamped at runtime, not rejected", () => {
    const content = withRoom14Effect({ op: "set", var: "patience", value: 999 });
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "invalid_consequence_value")).toBe(false);
  });

  it("fails on a non-finite or non-integer by operand, not just the target variable's type", () => {
    const nonInteger = withRoom14Effect({ op: "increment", var: "patience", by: 1.5 });
    expect(
      validateCampaign(campaignEnvelope(nonInteger), validStrings).errors.some(
        (e) => e.code === "invalid_consequence_value" && e.path === "patience",
      ),
    ).toBe(true);

    const nan = withRoom14Effect({ op: "decrement", var: "patience", by: NaN });
    expect(
      validateCampaign(campaignEnvelope(nan), validStrings).errors.some(
        (e) => e.code === "invalid_consequence_value" && e.path === "patience",
      ),
    ).toBe(true);
  });

  it("treats a consequence.var colliding with an Object.prototype member as undeclared, not falling through", () => {
    const content = withRoom14Effect({ op: "set", var: "toString", value: "anything" });
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.errors.some((e) => e.code === "undeclared_variable" && e.path === "toString")).toBe(true);
    expect(result.errors.some((e) => e.code === "invalid_consequence_value")).toBe(false);
  });
});

describe("validateCampaign — Tier 2: reachability", () => {
  it("warns on an unreachable node, without appearing in errors or blocking ok", () => {
    const nodes: Record<string, Node> = {
      ...validCampaign.nodes,
      orphan: { id: "orphan", kind: "auto", textKey: "node.room_14.text", goto: "reward" },
    };
    const content = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.warnings.some((w) => w.code === "unreachable_node" && w.path === "orphan")).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("warns on an exitless auto/random cycle", () => {
    const nodes: Record<string, Node> = {
      municipality: validCampaign.nodes.municipality!,
      clerk_review: {
        id: "clerk_review",
        kind: "random",
        textKey: "node.clerk_review.text",
        transitions: [{ weight: 1, goto: "loop_a" }],
      },
      loop_a: { id: "loop_a", kind: "auto", textKey: "node.room_14.text", goto: "loop_b" },
      loop_b: { id: "loop_b", kind: "auto", textKey: "node.room_14.text", goto: "loop_a" },
    };
    const content: StoryGraphCampaign = { ...validCampaign, nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.warnings.some((w) => w.code === "unreachable_cycle" && w.path === "loop_a")).toBe(true);
    expect(result.warnings.some((w) => w.code === "unreachable_cycle" && w.path === "loop_b")).toBe(true);
  });

  it("warns no_reachable_choice when no ChoiceNode is reachable from startNodeId", () => {
    const nodes: Record<string, Node> = {
      start: { id: "start", kind: "auto", textKey: "node.room_14.text", goto: "ending" },
      ending: { id: "ending", kind: "ending", textKey: "node.ending.text", endingId: "vignette" },
    };
    const content: StoryGraphCampaign = { ...validCampaign, startNodeId: "start", nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.warnings.some((w) => w.code === "no_reachable_choice")).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("warns no_reachable_ending when no EndingNode is reachable from startNodeId", () => {
    const nodes: Record<string, Node> = {
      start: { id: "start", kind: "choice", textKey: "node.municipality.text", choices: [] },
    };
    const content: StoryGraphCampaign = { ...validCampaign, startNodeId: "start", nodes };
    const result = validateCampaign(campaignEnvelope(content), validStrings);
    expect(result.warnings.some((w) => w.code === "no_reachable_ending")).toBe(true);
  });
});

describe("validateCampaign — through buildValidatedContentRegistry (integration)", () => {
  function makeStoryGraphKind(): Kind<unknown> {
    return {
      id: "story-graph",
      version: "1.0.0",
      reasonCodes: [],
      reasonMessages: new Map(),
      eventNames: [],
      initialState: () => ({ state: {}, status: "active", changes: [], messages: [] }),
      availableActions: () => [],
      scene: () => ({ textKey: "t", text: "" }),
      advance: (state) => ({ state, status: "active", changes: [], messages: [] }),
      project: () => ({}),
      validateCampaign: (campaign, strings): ValidationResult => validateCampaign(campaign, strings),
      outcome: () => ({ terminal: false, terminalId: null }),
    };
  }

  function built(campaign: Campaign, strings: Map<string, string>): BuiltCampaign {
    return { campaign, strings };
  }

  it("a Tier 1 failure blocks registry construction end to end", () => {
    const kinds = { "story-graph": makeStoryGraphKind() } as unknown as KindRegistry;
    const badCampaign = { ...validCampaign, startNodeId: "nowhere" };
    const result = buildValidatedContentRegistry(
      [built(campaignEnvelope(badCampaign), validStrings)],
      kinds,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "dangling_reference")).toBe(true);
  });

  it("a fully valid campaign builds a registry", () => {
    const kinds = { "story-graph": makeStoryGraphKind() } as unknown as KindRegistry;
    const result = buildValidatedContentRegistry([built(campaignEnvelope(validCampaign), validStrings)], kinds);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.get("bureaucracy")).toBeDefined();
  });
});
