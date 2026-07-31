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
