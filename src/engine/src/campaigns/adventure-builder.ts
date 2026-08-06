import type { CommandResult } from "../core/kernel/reasons.js";
import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import { buildCampaign } from "../core/registry/build.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import {
  buildStoryGraphCampaign,
  type AchievementDefinitionSource,
  type ChoiceSource,
  type StoryGraphCampaignSource,
} from "../kinds/story-graph/source.js";

export interface AdventureEnding {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly outcome: "win" | "loss" | "neutral";
  readonly gate?: "memory" | "prepared";
}

export interface AdventureRoute {
  readonly id: string;
  readonly choiceId: string;
  readonly label: string;
  readonly memoryLabel: string;
  readonly scenes: readonly [string, string, string, string];
  readonly actionLabels: readonly [string, string, string, string, string, string, string, string];
  readonly eventLabels: readonly [string, string, string, string];
  readonly endings: readonly AdventureEnding[];
}

export interface AdventureConfig {
  readonly id: string;
  readonly namespace: string;
  readonly title: string;
  readonly description: string;
  readonly startNodeId: string;
  readonly intro: string;
  readonly statLabels: {
    readonly preparation: string;
    readonly connections: string;
    readonly pressure: string;
  };
  readonly routes: readonly [AdventureRoute, AdventureRoute, AdventureRoute];
  readonly startAliases?: readonly { readonly id: string; readonly label: string; readonly routeId: string }[];
  readonly retainedAchievements?: StoryGraphCampaignSource["achievements"];
}

function authored(namespace: string, id: string, field: string, text: string): AuthoredText {
  return { key: `${namespace}.${id}.${field}`, text };
}

function oneChoice(namespace: string, id: string, text: string, label: string, goto: string) {
  return {
    kind: "choice" as const,
    text: authored(namespace, id, "text", text),
    choices: [{ id: `${id}_proceed`, label: authored(namespace, id, "proceed", label), goto }],
  };
}

/**
 * Produces the repeated *shape* W64 requires while leaving every sentence, action and ending
 * campaign-authored. Each route remains separate for six visible pages, contains two seeded
 * flavour forks, and consults its first-page memory at the finale five submissions later.
 */
export function createAdventureSource(config: AdventureConfig): StoryGraphCampaignSource {
  const nodes: StoryGraphCampaignSource["nodes"] = Object.create(null) as StoryGraphCampaignSource["nodes"];
  const routeValues = config.routes.map((route) => route.id);
  const startChoices: ChoiceSource[] = config.routes.map((route) => ({
    id: route.choiceId,
    label: authored(config.namespace, config.startNodeId, `choice_${route.choiceId}`, route.label),
    effects: [{ op: "set", var: "route", value: route.id }],
    goto: `${route.id}_1`,
  }));
  for (const alias of config.startAliases ?? []) {
    startChoices.push({
      id: alias.id,
      label: authored(config.namespace, config.startNodeId, `choice_${alias.id}`, alias.label),
      effects: [{ op: "set", var: "route", value: alias.routeId }],
      goto: `${alias.routeId}_1`,
    });
  }
  nodes[config.startNodeId] = {
    kind: "choice",
    text: authored(config.namespace, config.startNodeId, "text", config.intro),
    choices: startChoices,
  };

  const achievements: AchievementDefinitionSource[] = [...(config.retainedAchievements ?? [])];
  for (const route of config.routes) {
    const memoryVar = `remembered_${route.id}`;
    const prefix = route.id;
    nodes[`${prefix}_1`] = {
      kind: "choice",
      text: authored(config.namespace, `${prefix}_1`, "text", route.scenes[0]),
      choices: [
        {
          id: `${prefix}_listen`,
          label: authored(config.namespace, `${prefix}_1`, "listen", route.actionLabels[0]),
          effects: [
            { op: "set", var: memoryVar, value: true },
            { op: "increment", var: "connections", by: 1 },
          ],
          goto: `${prefix}_event_1`,
        },
        {
          id: `${prefix}_push`,
          label: authored(config.namespace, `${prefix}_1`, "push", route.actionLabels[1]),
          effects: [
            { op: "set", var: memoryVar, value: true },
            { op: "increment", var: "pressure", by: 1 },
          ],
          goto: `${prefix}_event_1`,
        },
      ],
    };
    nodes[`${prefix}_event_1`] = {
      kind: "random",
      text: authored(config.namespace, `${prefix}_event_1`, "text", "The day contributes its own amendment."),
      transitions: [
        { weight: 1, effects: [{ op: "increment", var: "preparation", by: 1 }], goto: `${prefix}_event_1a` },
        { weight: 1, effects: [{ op: "increment", var: "pressure", by: 1 }], goto: `${prefix}_event_1b` },
      ],
    };
    nodes[`${prefix}_event_1a`] = oneChoice(config.namespace, `${prefix}_event_1a`, route.eventLabels[0], route.actionLabels[2], `${prefix}_2`);
    nodes[`${prefix}_event_1b`] = oneChoice(config.namespace, `${prefix}_event_1b`, route.eventLabels[1], route.actionLabels[3], `${prefix}_2`);
    nodes[`${prefix}_2`] = {
      kind: "choice",
      text: authored(config.namespace, `${prefix}_2`, "text", route.scenes[1]),
      choices: [
        { id: `${prefix}_prepare`, label: authored(config.namespace, `${prefix}_2`, "prepare", route.actionLabels[4]), effects: [{ op: "increment", var: "preparation", by: 1 }], goto: `${prefix}_event_2` },
        { id: `${prefix}_improvise`, label: authored(config.namespace, `${prefix}_2`, "improvise", route.actionLabels[5]), effects: [{ op: "increment", var: "pressure", by: 1 }], goto: `${prefix}_event_2` },
      ],
    };
    nodes[`${prefix}_event_2`] = {
      kind: "random",
      text: authored(config.namespace, `${prefix}_event_2`, "text", "A seeded interruption arrives on schedule."),
      transitions: [
        { weight: 1, effects: [{ op: "increment", var: "connections", by: 1 }], goto: `${prefix}_event_2a` },
        { weight: 1, goto: `${prefix}_event_2b` },
      ],
    };
    nodes[`${prefix}_event_2a`] = oneChoice(config.namespace, `${prefix}_event_2a`, route.eventLabels[2], route.actionLabels[6], `${prefix}_3`);
    nodes[`${prefix}_event_2b`] = oneChoice(config.namespace, `${prefix}_event_2b`, route.eventLabels[3], route.actionLabels[7], `${prefix}_3`);
    nodes[`${prefix}_3`] = {
      kind: "choice",
      text: authored(config.namespace, `${prefix}_3`, "text", route.scenes[2]),
      choices: [
        { id: `${prefix}_steady`, label: authored(config.namespace, `${prefix}_3`, "steady", "Use what you prepared"), effects: [{ op: "increment", var: "preparation", by: 1 }], goto: `${prefix}_4` },
        { id: `${prefix}_call_in_favour`, label: authored(config.namespace, `${prefix}_3`, "favour", "Call in the favour you earned"), requirements: { field: "var.connections", operator: "greater_or_equal", value: 1 }, requirementFail: authored(config.namespace, `${prefix}_3`, "favour_fail", "No one owes you that favour yet."), effects: [{ op: "decrement", var: "pressure", by: 1 }], goto: `${prefix}_4` },
      ],
    };
    const endingChoices: ChoiceSource[] = route.endings.map((ending) => ({
      id: `choose_${ending.id}`,
      label: authored(config.namespace, `${prefix}_4`, `ending_${ending.id}`, ending.title),
      ...(ending.gate === "memory" ? { showWhen: { field: `var.${memoryVar}`, operator: "equals" as const, value: true } } : {}),
      ...(ending.gate === "prepared" ? {
        requirements: { field: "var.preparation", operator: "greater_or_equal" as const, value: 2 },
        requirementFail: authored(config.namespace, `${prefix}_4`, `ending_${ending.id}_fail`, "This ending needs more preparation."),
      } : {}),
      goto: `ending_${ending.id}`,
    }));
    nodes[`${prefix}_4`] = {
      kind: "choice",
      text: authored(config.namespace, `${prefix}_4`, "text", route.scenes[3]),
      choices: endingChoices,
    };
    for (const ending of route.endings) {
      nodes[`ending_${ending.id}`] = {
        kind: "ending",
        text: authored(config.namespace, `ending_${ending.id}`, "text", `${ending.title}\n\n${ending.text}`),
        endingId: ending.id,
        outcome: ending.outcome,
      };
    }
    for (const suffix of ["event_1a", "event_1b", "event_2a", "event_2b"] as const) {
      const nodeId = `${prefix}_${suffix}`;
      achievements.push({
        id: `found_${nodeId}`,
        name: authored(config.namespace, `achievement_${nodeId}`, "name", `Found: ${route.memoryLabel}`),
        description: authored(config.namespace, `achievement_${nodeId}`, "description", "Discover an optional page on this route."),
        hidden: true,
        condition: { field: `visited.${nodeId}`, operator: "greater_or_equal", value: 1 },
      });
    }
  }

  return {
    description: authored(config.namespace, "campaign", "description", config.description),
    variables: {
      route: { type: "enum", initial: config.routes[0].id, values: routeValues },
      preparation: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: authored(config.namespace, "var_preparation", "label", config.statLabels.preparation) },
      connections: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: authored(config.namespace, "var_connections", "label", config.statLabels.connections) },
      pressure: { type: "int", initial: 0, min: 0, max: 12, visible: true, label: authored(config.namespace, "var_pressure", "label", config.statLabels.pressure) },
      ...Object.fromEntries(config.routes.map((route) => [`remembered_${route.id}`, { type: "bool" as const, initial: false }])),
    },
    startNodeId: config.startNodeId,
    nodes,
    achievements,
  };
}

export function buildAdventureCampaign(config: AdventureConfig, source: StoryGraphCampaignSource): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildStoryGraphCampaign(source);
  const campaign: Campaign = {
    id: config.id,
    kindId: "story-graph",
    version: "2.0.0",
    titleKey: `${config.namespace}.campaign.title`,
    content,
    migrateState: (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {}),
  };
  return buildCampaign(campaign, [authored(config.namespace, "campaign", "title", config.title), ...authoredText]);
}

/** Adds v2 declarations and remaps any v1 node/ending ids while retaining visit history. */
export function migrateV1AdventureState(
  value: unknown,
  fromVersion: string,
  source: StoryGraphCampaignSource,
  nodeMap: Readonly<Record<string, string>>,
  endingMap: Readonly<Record<string, string>> = {},
): CommandResult<unknown> {
  if (fromVersion !== "1.0.0" || typeof value !== "object" || value === null) {
    return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
  }
  const state = value as StoryGraphKindState;
  if (typeof state.currentNodeId !== "string" || typeof state.variables !== "object" || state.variables === null) {
    return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
  }
  const variables: StoryGraphKindState["variables"] = { ...state.variables };
  for (const [name, declaration] of Object.entries(source.variables)) {
    if (!Object.hasOwn(variables, name)) variables[name] = declaration.initial;
  }
  const visitedCounts: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [id, count] of Object.entries(state.visitedCounts ?? {})) {
    const mapped = nodeMap[id] ?? id;
    visitedCounts[mapped] = (visitedCounts[mapped] ?? 0) + count;
  }
  const currentNodeId = nodeMap[state.currentNodeId] ?? state.currentNodeId;
  if (!Object.hasOwn(source.nodes, currentNodeId)) {
    return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
  }
  const routeDeclaration = source.variables.route;
  if (routeDeclaration?.type === "enum" && routeDeclaration.values !== undefined) {
    const routeForCurrentNode = routeDeclaration.values.find((route) => currentNodeId.startsWith(`${route}_`));
    if (routeForCurrentNode !== undefined) variables.route = routeForCurrentNode;
  }
  const migrated: StoryGraphKindState = {
    ...state,
    currentNodeId,
    variables,
    visitedCounts,
    ...(state.endingId === undefined ? {} : { endingId: endingMap[state.endingId] ?? state.endingId }),
  };
  return { ok: true, value: migrated, errors: [], warnings: [] };
}
