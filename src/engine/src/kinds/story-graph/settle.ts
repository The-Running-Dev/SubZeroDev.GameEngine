/**
 * Story-graph kind — the settle loop and `initialState` (03 §8.2).
 *
 * Contract: `03-story-graph-kind.md` §8.2, §8.4.
 *
 * `initialState` matches the real `Kind<KState>.initialState` signature — the core's own
 * `createGame` (`kernel/engine.ts`, built in W3) already calls it exactly this way.
 * `settle`/`enterAndEmit` are narrower internal helpers with no interface obligation. See
 * `plans/18-w11-nodes-turn-and-settle.md`, Decision 1.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { InitialStateResult, KindContext } from "../../core/kernel/types.js";
import type { RngHandle } from "../../core/determinism/types.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import { applyConsequences, buildInitialVariables, type VariableSchema } from "./variables.js";
import type { Node } from "./nodes.js";
import type { StoryGraphCampaign } from "./campaign.js";
import { enter, type StoryGraphKindState } from "./state.js";

/** Default per 03 §8.2 — no unit before this one exposes a way to configure it. */
export const SETTLE_STEPS = 64;

/**
 * `nodes` is content-controlled (authored, potentially parsed from JSON/YAML), so a
 * plain truthy check on `nodes[nodeId]` would let an id like `"toString"` resolve an
 * inherited `Object.prototype` value instead of failing — the same class of gap W9's
 * `requireDecl` guards against for `VariableSchema`.
 */
function requireNode(nodes: Record<string, Node>, nodeId: string): Node {
  if (!Object.hasOwn(nodes, nodeId)) {
    throw new Error(`story-graph settle: node "${nodeId}" does not exist`);
  }
  return nodes[nodeId] as Node;
}

/**
 * `enter` plus the `node.entered` event (03 §8.4) — shared by `initialState` (the start
 * node) and `settle` (every pass-through), so "every entry counts" holds for both without
 * duplicating the event logic. See plan 18, Decision 2.
 */
function enterAndEmit(
  nodes: Record<string, Node>,
  state: StoryGraphKindState,
  nodeId: string,
  emit: ResolutionEmitter,
): StoryGraphKindState {
  const next = enter(state, nodeId);
  const node = requireNode(nodes, nodeId);
  emit.emit("kind.story-graph.node.entered", "debug", {
    data: { nodeId, nodeKind: node.kind, visitCount: next.visitedCounts[nodeId]! },
  });
  return next;
}

export interface SettleResult {
  state: StoryGraphKindState;
  status: "active" | "ended";
}

/**
 * Resolves `auto`/`random` pass-throughs from `state.currentNodeId` until landing on a
 * `choice` or `ending` node. Guarded by `SETTLE_STEPS`; a trip emits
 * `kind.story-graph.settle.guard_tripped` and throws — see plan 18, Decision 3 for why
 * this is not a `ValidationError`.
 *
 * **Caller contract:** `state.currentNodeId` must already have been entered (03 §8.2's
 * pseudocode always calls `enter` immediately before settling — `createGame` for the
 * start node, `submitChoice` for a choice's `goto`). `settle` only enters the nodes it
 * transitions *to*, never the node it starts on.
 */
export function settle(
  nodes: Record<string, Node>,
  schema: VariableSchema,
  initial: StoryGraphKindState,
  rng: RngHandle,
  emit: ResolutionEmitter,
): SettleResult {
  let state = initial;

  for (let step = 0; step < SETTLE_STEPS; step++) {
    const node = requireNode(nodes, state.currentNodeId);
    emit.emit("kind.story-graph.settle.step", "trace", {
      data: { step, nodeId: node.id, nodeKind: node.kind },
    });

    if (node.kind === "choice") {
      return { state, status: "active" };
    }

    if (node.kind === "ending") {
      return { state: { ...state, endingId: node.endingId }, status: "ended" };
    }

    if (node.kind === "auto") {
      const applied = applyConsequences(schema, state.variables, node.effects ?? []);
      state = enterAndEmit(nodes, { ...state, variables: applied.variables, turn: state.turn + 1 }, node.goto, emit);
      continue;
    }

    // random
    const picked = rng.weightedPick(node.transitions.map((t) => ({ item: t, weight: t.weight })));
    emit.emit("kind.story-graph.random.picked", "debug", {
      data: { nodeId: node.id, goto: picked.goto, weight: picked.weight },
    });
    const applied = applyConsequences(schema, state.variables, picked.effects ?? []);
    state = enterAndEmit(nodes, { ...state, variables: applied.variables, turn: state.turn + 1 }, picked.goto, emit);
  }

  emit.emit("kind.story-graph.settle.guard_tripped", "error", {
    reason: "settle_guard_tripped",
    data: { nodeId: state.currentNodeId },
  });
  throw new Error(`story-graph settle: SETTLE_STEPS (${SETTLE_STEPS}) exceeded at node "${state.currentNodeId}"`);
}

/** `Kind<StoryGraphKindState>.initialState` — enters `startNodeId`, then settles once. */
export function initialState(campaign: Campaign, ctx: KindContext): InitialStateResult<StoryGraphKindState> {
  const content = campaign.content as StoryGraphCampaign;

  const seeded: StoryGraphKindState = {
    currentNodeId: content.startNodeId,
    variables: buildInitialVariables(content.variables),
    turn: 0,
    visitedCounts: {},
    unlockedAchievements: [],
  };

  const entered = enterAndEmit(content.nodes, seeded, content.startNodeId, ctx.emit);
  const settled = settle(content.nodes, content.variables, entered, ctx.rng, ctx.emit);

  return { state: settled.state, status: settled.status, changes: [], messages: [] };
}
