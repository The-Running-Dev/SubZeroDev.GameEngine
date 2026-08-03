import type { RngHandle } from "../../../core/determinism/types.js";
import type { WorldGraphSystemId } from "./order.js";

/** Disposable storage owned by exactly one atomic tick. */
export interface TickScratch {
  readonly tickRngHandles: Map<WorldGraphSystemId, RngHandle>;
}

export function createTickScratch(): TickScratch {
  return { tickRngHandles: new Map() };
}
