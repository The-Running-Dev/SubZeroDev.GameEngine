/**
 * Story-graph kind — composing modules into a host (`Kind.composeContent`).
 *
 * Contract: `03-story-graph-kind.md` §1.1, §5 (`copy`); `04-core.md` §10.4, §17
 * (*Composed ids*).
 *
 * The core has already checked the envelope — every module exists, is pinned to its authored
 * version, is this kind, and is already composed itself. What is left is this kind's half:
 * the module opted in, its exits and bindings fit, and the attachments land on a choice
 * node. Only when all of that holds is anything merged; the result is then validated as
 * ordinary content (`validate.ts`), so a dangling exit target or an alias that collides with
 * a host node is found there, not here.
 */

import type { Condition } from "../../core/condition/types.js";
import type { CommandResult } from "../../core/kernel/reasons.js";
import type { Campaign, CampaignInclude, ComposedAttachment, ComposedModule } from "../../core/registry/types.js";
import type { ValidationError } from "../../core/validation/types.js";
import type { StoryGraphAttachment, StoryGraphCampaign, StoryGraphIncludeBinding } from "./campaign.js";
import type { AutoNode, Choice, Node } from "./nodes.js";
import { isAssignable, type Consequence, type VariableSchema } from "./variables.js";
import type { AchievementDefinition } from "./achievements.js";

function error(code: string, path: string): ValidationError {
  return { code, messageKey: `story-graph.reason.${code}`, path };
}

function invalidIdentifier(path: string): ValidationError {
  return { code: "invalid_identifier", messageKey: "core.reason.invalid_identifier", path };
}

/** A null-prototype copy — every map here is keyed by content-controlled ids. */
function record<T>(entries: Iterable<readonly [string, T]> = []): Record<string, T> {
  const out = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) out[key] = value;
  return out;
}

function stringMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return record();
  return record(Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** A binding as authored, with every malformed part read as absent rather than trusted. */
function readBinding(binding: unknown): Required<StoryGraphIncludeBinding> {
  const raw = (typeof binding === "object" && binding !== null ? binding : {}) as Partial<StoryGraphIncludeBinding>;
  return { exits: stringMap(raw.exits), inputs: stringMap(raw.inputs), outputs: stringMap(raw.outputs) };
}

/** Every condition a campaign carries — `showWhen`, `requirements`, achievement conditions. */
function conditionsOf(content: StoryGraphCampaign): Condition[] {
  const conditions: Condition[] = [];
  for (const node of Object.values(content.nodes)) {
    if (node.kind !== "choice") continue;
    for (const choice of node.choices) {
      if (choice.showWhen) conditions.push(choice.showWhen);
      if (choice.requirements) conditions.push(choice.requirements);
    }
  }
  for (const achievement of content.achievements) conditions.push(achievement.condition);
  return conditions;
}

function readsEnding(condition: Condition): boolean {
  if ("all" in condition) return condition.all.some(readsEnding);
  if ("any" in condition) return condition.any.some(readsEnding);
  if ("not" in condition) return readsEnding(condition.not);
  if ("exists" in condition || "count" in condition) return false;
  return condition.field === "ending";
}

/** The host's own authored ids carry no `:` — so no composed id can collide with one (04 §17). */
function hostIdentifierErrors(content: StoryGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [id, node] of Object.entries(content.nodes)) {
    if (id.includes(":")) errors.push(invalidIdentifier(id));
    if (node.kind === "choice") {
      for (const choice of node.choices) if (choice.id.includes(":")) errors.push(invalidIdentifier(choice.id));
    }
  }
  for (const name of Object.keys(content.variables)) if (name.includes(":")) errors.push(invalidIdentifier(name));
  for (const achievement of content.achievements) {
    if (achievement.id.includes(":")) errors.push(invalidIdentifier(achievement.id));
  }
  return errors;
}

/** This kind's checks on one include; nothing is merged unless every include passes. */
function includeErrors(host: Campaign, hostContent: StoryGraphCampaign, include: CampaignInclude, module: StoryGraphCampaign): ValidationError[] {
  const path = `${host.id}.${include.alias}`;
  if (!module.module) return [error("include_not_module", path)];
  if (conditionsOf(module).some(readsEnding)) return [error("include_not_module", path)];

  const errors: ValidationError[] = [];
  const binding = readBinding(include.binding);

  const endingIds = new Set<string>();
  for (const node of Object.values(module.nodes)) if (node.kind === "ending") endingIds.add(node.endingId);
  for (const endingId of endingIds) {
    if (!Object.hasOwn(binding.exits, endingId)) errors.push(error("exit_unmapped", `${path}.exits.${endingId}`));
  }
  for (const endingId of Object.keys(binding.exits)) {
    if (!endingIds.has(endingId)) errors.push(error("exit_unmapped", `${path}.exits.${endingId}`));
  }

  // Inputs flow host → module, outputs module → host; a pair is checked in its direction.
  const pairs = [
    ["inputs", binding.inputs, module.module.inputs] as const,
    ["outputs", binding.outputs, module.module.outputs] as const,
  ];
  for (const [direction, bound, declared] of pairs) {
    for (const [moduleVar, hostVar] of Object.entries(bound)) {
      const at = `${path}.${direction}.${moduleVar}`;
      const moduleDecl = declared.includes(moduleVar) && Object.hasOwn(module.variables, moduleVar) ? module.variables[moduleVar]! : undefined;
      const hostDecl = Object.hasOwn(hostContent.variables, hostVar) ? hostContent.variables[hostVar]! : undefined;
      if (!moduleDecl || !hostDecl) {
        errors.push(error("binding_undeclared", at));
        continue;
      }
      const assignable = direction === "inputs" ? isAssignable(moduleDecl, hostDecl) : isAssignable(hostDecl, moduleDecl);
      if (!assignable) errors.push(error("binding_type_mismatch", at));
    }
  }

  return errors;
}

/** Rewrites every module-scoped reference in a condition to its composed id. */
function prefixCondition(condition: Condition, p: (id: string) => string): Condition {
  if ("all" in condition) return { all: condition.all.map((c) => prefixCondition(c, p)) };
  if ("any" in condition) return { any: condition.any.map((c) => prefixCondition(c, p)) };
  if ("not" in condition) return { not: prefixCondition(condition.not, p) };
  if ("exists" in condition || "count" in condition) return condition;
  for (const scope of ["var.", "visited.", "achieved."]) {
    if (condition.field.startsWith(scope)) return { ...condition, field: scope + p(condition.field.slice(scope.length)) };
  }
  return condition; // `turn` is the host's (03 §1.1)
}

function prefixConsequence(consequence: Consequence, p: (id: string) => string): Consequence {
  if (consequence.op === "copy") return { ...consequence, var: p(consequence.var), from: p(consequence.from) };
  return { ...consequence, var: p(consequence.var) };
}

function prefixEffects(effects: Consequence[] | undefined, p: (id: string) => string): { effects?: Consequence[] } {
  return effects !== undefined ? { effects: effects.map((c) => prefixConsequence(c, p)) } : {};
}

function withEffects(effects: Consequence[]): { effects?: Consequence[] } {
  return effects.length > 0 ? { effects } : {};
}

/** Merges one already-checked include into the host's nodes, variables and achievements. */
function mergeInclude(
  nodes: Record<string, Node>,
  variables: VariableSchema,
  achievements: AchievementDefinition[],
  include: CampaignInclude,
  module: StoryGraphCampaign,
  errors: ValidationError[],
): void {
  const alias = include.alias;
  const p = (id: string): string => `${alias}::${id}`;
  const binding = readBinding(include.binding);

  for (const [name, decl] of Object.entries(module.variables)) variables[p(name)] = decl;

  for (const [id, node] of Object.entries(module.nodes)) {
    const composedId = p(id);
    switch (node.kind) {
      case "choice":
        nodes[composedId] = {
          ...node,
          id: composedId,
          choices: node.choices.map((choice) => ({
            ...choice,
            ...(choice.showWhen ? { showWhen: prefixCondition(choice.showWhen, p) } : {}),
            ...(choice.requirements ? { requirements: prefixCondition(choice.requirements, p) } : {}),
            ...prefixEffects(choice.effects, p),
            goto: p(choice.goto),
          })),
        };
        break;
      case "random":
        nodes[composedId] = {
          ...node,
          id: composedId,
          transitions: node.transitions.map((t) => ({ ...t, ...prefixEffects(t.effects, p), goto: p(t.goto) })),
        };
        break;
      case "auto":
        nodes[composedId] = { ...node, id: composedId, ...prefixEffects(node.effects, p), goto: p(node.goto) };
        break;
      case "ending": {
        // An exit: copy the bound outputs out, then continue in the host (03 §1.1).
        const copies = Object.entries(binding.outputs).map(
          ([moduleVar, hostVar]): Consequence => ({ op: "copy", var: hostVar, from: p(moduleVar) }),
        );
        const exit: AutoNode = { id: composedId, kind: "auto", textKey: node.textKey, ...withEffects(copies), goto: binding.exits[node.endingId]! };
        nodes[composedId] = exit;
        break;
      }
    }
  }

  for (const achievement of module.achievements) {
    achievements.push({ ...achievement, id: p(achievement.id), condition: prefixCondition(achievement.condition, p) });
  }

  // The entry: the alias itself, copying the bound inputs in on every entry.
  if (Object.hasOwn(nodes, alias)) {
    errors.push(error("duplicate_id", alias));
    return;
  }
  const entryId = module.module?.entryNodeId ?? module.startNodeId;
  const entryNode = Object.hasOwn(module.nodes, entryId) ? module.nodes[entryId] : undefined;
  const copies = Object.entries(binding.inputs).map(
    ([moduleVar, hostVar]): Consequence => ({ op: "copy", var: p(moduleVar), from: hostVar }),
  );
  nodes[alias] = {
    id: alias,
    kind: "auto",
    // Never rendered — an `auto` node is a pass-through. A missing entry node falls back to
    // the module's description; its dangling `goto` is `validate.ts`'s to report.
    textKey: entryNode?.textKey ?? module.descriptionKey,
    ...withEffects(copies),
    goto: p(entryId),
  };
}

/** `Kind<StoryGraphKindState>.composeContent` (04 §3, §10.4). */
export function composeContent(
  host: Campaign,
  modules: readonly ComposedModule[],
  attachments: readonly ComposedAttachment[],
): CommandResult<StoryGraphCampaign> {
  const hostContent = host.content as StoryGraphCampaign;
  const included = [...modules, ...attachments.map((attachment) => attachment.module)];

  const errors: ValidationError[] = [...hostIdentifierErrors(hostContent)];
  for (const { include, campaign } of included) {
    errors.push(...includeErrors(host, hostContent, include, campaign.content as StoryGraphCampaign));
  }
  if (errors.length > 0) return { ok: false, errors, warnings: [] };

  const nodes = record(Object.entries(hostContent.nodes));
  const variables = record(Object.entries(hostContent.variables));
  const achievements = [...hostContent.achievements];

  for (const { include, campaign } of included) {
    mergeInclude(nodes, variables, achievements, include, campaign.content as StoryGraphCampaign, errors);
  }

  // Each attachment appends one choice after the node's authored ones, in the order
  // composition was handed them (11 §3a); its `goto` is the include's entry.
  for (const { payload, module } of attachments) {
    const { hostNodeId, choice } = payload as StoryGraphAttachment;
    const node = Object.hasOwn(hostContent.nodes, hostNodeId) ? nodes[hostNodeId] : undefined;
    if (!node) {
      errors.push(error("dangling_reference", hostNodeId));
      continue;
    }
    if (node.kind !== "choice") {
      errors.push(error("attachment_node_not_choice", hostNodeId));
      continue;
    }
    if (node.choices.some((existing) => existing.id === choice.id)) {
      errors.push(error("attachment_choice_collision", `${hostNodeId}.${choice.id}`));
      continue;
    }
    const attached: Choice = { ...choice, goto: module.include.alias };
    nodes[hostNodeId] = { ...node, choices: [...node.choices, attached] };
  }

  if (errors.length > 0) return { ok: false, errors, warnings: [] };
  return { ok: true, value: { ...hostContent, nodes, variables, achievements }, errors: [], warnings: [] };
}
