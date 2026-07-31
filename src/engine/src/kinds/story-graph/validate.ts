/**
 * Story-graph kind — Tier 1/2 content validation (03 §11).
 *
 * Contract: `03-story-graph-kind.md` §11.
 *
 * Reuses rather than re-derives: `validateConditionFields` (W10) for every
 * `showWhen`/`requirements`/achievement `condition`; `placeholderNames` (`text.ts`) for
 * "text interpolates only visible variables," so the interpolation regex and this check
 * can never drift apart. Node-id and variable-name "duplicate" checks are absent on
 * purpose — both are `Record` keys by the time a kind ever sees this content, so
 * duplicates are already impossible by construction (plan 21, Decision 3).
 *
 * Every check runs independently and collects into one report — nothing short-circuits,
 * matching `validation/tiered.ts`'s own `validateCoreOwnedFields` style (plan 21,
 * Decision 5).
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult, ValidationWarning } from "../../core/validation/types.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { Node } from "./nodes.js";
import type { VariableSchema, Consequence } from "./variables.js";
import { validateConditionFields } from "./conditions.js";
import { placeholderNames } from "./text.js";

function error(code: string, path: string): ValidationError {
  return { code, messageKey: `story-graph.reason.${code}`, path };
}

function warning(code: string, path: string): ValidationWarning {
  return { code, messageKey: `story-graph.reason.${code}`, path };
}

function requireLocKey(strings: ReadonlyMap<LocKey, string>, key: LocKey): ValidationError | undefined {
  if (strings.has(key)) return undefined;
  return { code: "missing_string_key", messageKey: "core.reason.missing_string_key", path: key };
}

// ---------------------------------------------------------------------------
// Tier 1
// ---------------------------------------------------------------------------

/** `startNodeId` and every `goto`/`RandomTransition.goto` resolve to a real node. */
function validateReferences(content: StoryGraphCampaign, nodeIds: ReadonlySet<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!nodeIds.has(content.startNodeId)) {
    errors.push(error("dangling_reference", content.startNodeId));
  }

  for (const node of Object.values(content.nodes)) {
    if (node.kind === "choice") {
      for (const choice of node.choices) {
        if (!nodeIds.has(choice.goto)) errors.push(error("dangling_reference", choice.goto));
      }
    } else if (node.kind === "auto") {
      if (!nodeIds.has(node.goto)) errors.push(error("dangling_reference", node.goto));
    } else if (node.kind === "random") {
      for (const transition of node.transitions) {
        if (!nodeIds.has(transition.goto)) errors.push(error("dangling_reference", transition.goto));
      }
    }
  }

  return errors;
}

/**
 * Choice ids within one `ChoiceNode`, and achievement ids across the whole campaign —
 * the two places a duplicate id is actually reachable content (plan 21, Decision 3).
 */
function validateDuplicateIds(content: StoryGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of Object.values(content.nodes)) {
    if (node.kind !== "choice") continue;
    const seen = new Set<string>();
    for (const choice of node.choices) {
      if (seen.has(choice.id)) errors.push(error("duplicate_id", choice.id));
      seen.add(choice.id);
    }
  }

  const seenAchievements = new Set<string>();
  for (const achievement of content.achievements) {
    if (seenAchievements.has(achievement.id)) errors.push(error("duplicate_id", achievement.id));
    seenAchievements.add(achievement.id);
  }

  return errors;
}

/** Every `LocKey` the content references resolves in `strings`; a visible variable has one at all. */
function validateLocKeys(content: StoryGraphCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (key: LocKey | undefined): void => {
    if (key === undefined) return;
    const e = requireLocKey(strings, key);
    if (e) errors.push(e);
  };

  check(content.descriptionKey);
  for (const node of Object.values(content.nodes)) {
    check(node.textKey);
    if (node.kind === "choice") {
      for (const choice of node.choices) {
        check(choice.labelKey);
        check(choice.requirementFailKey);
      }
    }
  }
  for (const achievement of content.achievements) {
    check(achievement.nameKey);
    check(achievement.descriptionKey);
  }
  for (const [name, decl] of Object.entries(content.variables)) {
    if (!decl.visible) continue;
    if (decl.labelKey === undefined) {
      errors.push(error("missing_label_key", name));
    } else {
      check(decl.labelKey);
    }
  }

  return errors;
}

/** A node's rendered text interpolates only declared, visible variables (03 §3.1). */
function validateTextInterpolation(content: StoryGraphCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const visibleNames = new Set(Object.keys(content.variables).filter((name) => content.variables[name]!.visible));

  for (const node of Object.values(content.nodes)) {
    const text = strings.get(node.textKey);
    if (text === undefined) continue; // already reported by validateLocKeys
    for (const name of placeholderNames(text)) {
      if (!visibleNames.has(name)) errors.push(error("non_visible_variable_in_text", name));
    }
  }

  return errors;
}

/** Every `RandomTransition.weight` is a positive integer; every `random` node has at least one. */
function validateRandomTransitions(content: StoryGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [nodeId, node] of Object.entries(content.nodes)) {
    if (node.kind !== "random") continue;
    if (node.transitions.length === 0) {
      errors.push(error("invalid_transition_weight", nodeId));
      continue;
    }
    for (const transition of node.transitions) {
      if (!Number.isInteger(transition.weight) || transition.weight <= 0) {
        errors.push(error("invalid_transition_weight", nodeId));
      }
    }
  }

  return errors;
}

/**
 * A parallel, non-throwing version of `variables.ts`'s `checkSetValue`/`requireInt` —
 * validation collects every error, those throw fast-fail at runtime (plan 21,
 * Decision 2). "In range" (03 §11) is read as "a valid enum member," not a numeric-range
 * check: `applyConsequences` clamps an out-of-range `set`, it never rejects one.
 */
function validateConsequenceValue(schema: VariableSchema, consequence: Consequence): ValidationError | undefined {
  // Object.hasOwn, not a truthy check: schema is content-controlled, so a var named
  // e.g. "toString" must not resolve an inherited Object.prototype value as if it were
  // declared — the same guard runtime's requireDecl (variables.ts) already uses.
  if (!Object.hasOwn(schema, consequence.var)) return error("undeclared_variable", consequence.var);
  const decl = schema[consequence.var]!;

  if (consequence.op === "increment" || consequence.op === "decrement") {
    if (decl.type !== "int") return error("invalid_consequence_value", consequence.var);
    // Runtime (applyConsequences's requireFiniteInt) throws on a non-finite-integer `by`;
    // Tier 1 must reject the same content, or a validated campaign can still crash at
    // runtime the moment this consequence applies.
    return Number.isInteger(consequence.by) ? undefined : error("invalid_consequence_value", consequence.var);
  }

  switch (decl.type) {
    case "bool":
      return typeof consequence.value === "boolean" ? undefined : error("invalid_consequence_value", consequence.var);
    case "int":
      return typeof consequence.value === "number" && Number.isInteger(consequence.value)
        ? undefined
        : error("invalid_consequence_value", consequence.var);
    case "enum":
      return typeof consequence.value === "string" && (decl.values?.includes(consequence.value) ?? false)
        ? undefined
        : error("invalid_consequence_value", consequence.var);
  }
}

function validateConsequences(schema: VariableSchema, consequences: readonly Consequence[] | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const consequence of consequences ?? []) {
    const e = validateConsequenceValue(schema, consequence);
    if (e) errors.push(e);
  }
  return errors;
}

function validateAllConsequences(content: StoryGraphCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const node of Object.values(content.nodes)) {
    if (node.kind === "choice") {
      for (const choice of node.choices) errors.push(...validateConsequences(content.variables, choice.effects));
    } else if (node.kind === "auto") {
      errors.push(...validateConsequences(content.variables, node.effects));
    } else if (node.kind === "random") {
      for (const transition of node.transitions) errors.push(...validateConsequences(content.variables, transition.effects));
    }
  }
  return errors;
}

/** Every `var.*`/`turn`/`visited.*`/`achieved.*`/`ending` field path a `Condition` uses is legal (W10). */
function validateAllConditions(content: StoryGraphCampaign, nodeIds: ReadonlySet<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const node of Object.values(content.nodes)) {
    if (node.kind !== "choice") continue;
    for (const choice of node.choices) {
      if (choice.showWhen) errors.push(...validateConditionFields(choice.showWhen, content.variables, nodeIds));
      if (choice.requirements) errors.push(...validateConditionFields(choice.requirements, content.variables, nodeIds));
    }
  }
  for (const achievement of content.achievements) {
    errors.push(...validateConditionFields(achievement.condition, content.variables, nodeIds));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Tier 2
// ---------------------------------------------------------------------------

/** Every node reachable from `startNodeId` by following `goto` edges. A dangling `goto`
 *  (already a Tier 1 error) is skipped, not followed. */
function computeReachable(nodes: Record<string, Node>, startNodeId: string): Set<string> {
  const reachable = new Set<string>();
  const stack = [startNodeId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id) || !Object.hasOwn(nodes, id)) continue;
    reachable.add(id);

    const node = nodes[id]!;
    if (node.kind === "choice") for (const choice of node.choices) stack.push(choice.goto);
    else if (node.kind === "auto") stack.push(node.goto);
    else if (node.kind === "random") for (const transition of node.transitions) stack.push(transition.goto);
  }

  return reachable;
}

/** Every node that can reach a `choice`/`ending` node — the two are "escaped" by
 *  definition. Backward BFS from every choice/ending node over the reverse graph. */
function computeCanEscape(nodes: Record<string, Node>): Set<string> {
  const predecessors = new Map<string, string[]>();
  const addEdge = (from: string, to: string): void => {
    const list = predecessors.get(to);
    if (list) list.push(from);
    else predecessors.set(to, [from]);
  };

  const canEscape = new Set<string>();
  const stack: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.kind === "choice") for (const choice of node.choices) addEdge(id, choice.goto);
    else if (node.kind === "auto") addEdge(id, node.goto);
    else if (node.kind === "random") for (const transition of node.transitions) addEdge(id, transition.goto);

    if (node.kind === "choice" || node.kind === "ending") {
      canEscape.add(id);
      stack.push(id);
    }
  }

  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const pred of predecessors.get(id) ?? []) {
      if (!canEscape.has(pred)) {
        canEscape.add(pred);
        stack.push(pred);
      }
    }
  }

  return canEscape;
}

function validateReachability(content: StoryGraphCampaign): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const reachable = computeReachable(content.nodes, content.startNodeId);

  for (const id of Object.keys(content.nodes)) {
    if (!reachable.has(id)) warnings.push(warning("unreachable_node", id));
  }

  if (![...reachable].some((id) => content.nodes[id]!.kind === "choice")) {
    warnings.push(warning("no_reachable_choice", content.startNodeId));
  }
  if (![...reachable].some((id) => content.nodes[id]!.kind === "ending")) {
    warnings.push(warning("no_reachable_ending", content.startNodeId));
  }

  const canEscape = computeCanEscape(content.nodes);
  for (const id of reachable) {
    if (!canEscape.has(id)) warnings.push(warning("unreachable_cycle", id));
  }

  return warnings;
}

// ---------------------------------------------------------------------------

/** `Kind<StoryGraphKindState>.validateCampaign`. */
export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as StoryGraphCampaign;
  const nodeIds = new Set(Object.keys(content.nodes));

  const errors: ValidationError[] = [
    ...validateReferences(content, nodeIds),
    ...validateDuplicateIds(content),
    ...validateLocKeys(content, strings),
    ...validateTextInterpolation(content, strings),
    ...validateRandomTransitions(content),
    ...validateAllConsequences(content),
    ...validateAllConditions(content, nodeIds),
  ];

  const warnings = validateReachability(content);

  return { ok: errors.length === 0, errors, warnings };
}
