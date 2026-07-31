/**
 * Story-graph kind — the node graph (03 §3, §4).
 *
 * Contract: `03-story-graph-kind.md` §3, §4.
 *
 * `Choice`/`RandomTransition` (§4) aren't in this unit's own cited sections, but
 * `ChoiceNode`/`RandomNode` need them to compile — see
 * `plans/18-w11-nodes-turn-and-settle.md`, Decision 5. Nothing here evaluates
 * `showWhen`/`requirements`; that's W12's `availableActions`.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { Condition } from "../../core/condition/types.js";
import type { Consequence } from "./variables.js";

export interface Choice {
  id: string;
  labelKey: LocKey;

  showWhen?: Condition;
  requirements?: Condition;
  requirementFailKey?: LocKey;

  effects?: Consequence[];
  goto: string;
}

export interface RandomTransition {
  weight: number;
  effects?: Consequence[];
  goto: string;
}

interface NodeBase {
  id: string;
  textKey: LocKey;
}

export interface ChoiceNode extends NodeBase {
  kind: "choice";
  choices: Choice[];
}

export interface RandomNode extends NodeBase {
  kind: "random";
  transitions: RandomTransition[];
}

export interface AutoNode extends NodeBase {
  kind: "auto";
  effects?: Consequence[];
  goto: string;
}

export interface EndingNode extends NodeBase {
  kind: "ending";
  endingId: string;
  outcome?: "win" | "loss" | "neutral";
}

export type Node = ChoiceNode | RandomNode | AutoNode | EndingNode;

/**
 * `nodes` is content-controlled (authored, potentially parsed from JSON/YAML), so
 * `Object.hasOwn` guards against an id like `"toString"` resolving an inherited
 * `Object.prototype` value instead of a real missing-node error — the same class of
 * lookup `variables.ts`'s `requireDecl` guards. Shared here (rather than duplicated in
 * every module that walks a node map) since `settle.ts`, `scene.ts`, `advance.ts`, and
 * `view.ts` all need the identical check.
 */
export function requireNode(nodes: Record<string, Node>, nodeId: string): Node {
  if (!Object.hasOwn(nodes, nodeId)) {
    throw new Error(`story-graph nodes: node "${nodeId}" does not exist`);
  }
  return nodes[nodeId] as Node;
}
