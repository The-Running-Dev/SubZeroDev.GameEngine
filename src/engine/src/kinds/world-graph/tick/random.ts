import type { RngHandle, StreamId } from "../../../core/determinism/types.js";
import type { WorldGraphSystemId } from "./order.js";
import type { TickScratch } from "./scratch.js";

export interface AgentDrawSource {
  readonly id: string;
  readonly drawCount: number;
}

export interface AgentDrawResult<T> {
  readonly value: T;
  readonly drawCount: number;
}

export interface TickRandom {
  tickRng(system: WorldGraphSystemId): RngHandle;
  drawAgent<T>(agent: AgentDrawSource, draw: (rng: RngHandle) => T): AgentDrawResult<T>;
}

export function createTickRandom(
  processingTick: number,
  derive: (streamId: StreamId) => RngHandle,
  scratch: TickScratch,
): TickRandom {
  return {
    tickRng(system) {
      const existing = scratch.tickRngHandles.get(system);
      if (existing) return existing;
      const handle = derive({ kind: "tick", tick: processingTick, system });
      scratch.tickRngHandles.set(system, handle);
      return handle;
    },
    drawAgent(agent, draw) {
      const value = draw(derive({ kind: "agent", agentId: agent.id, seq: agent.drawCount }));
      return { value, drawCount: agent.drawCount + 1 };
    },
  };
}
