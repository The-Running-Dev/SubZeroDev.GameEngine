import type { StateChange } from "../../../core/kernel/reasons.js";
import type { WorldGraphSystemId } from "./order.js";
import { compareDefinitionId, worldGraphSystemIndex } from "./order.js";

type ChangeValue = string | number | boolean;

export interface TickChanges {
  record(
    system: WorldGraphSystemId,
    path: string,
    value: ChangeValue,
    reason: string,
    visible: boolean,
    previous?: ChangeValue,
  ): void;
}

interface OrderedChange {
  readonly systemIndex: number;
  readonly ordinal: number;
  readonly change: StateChange;
}

function compare(left: OrderedChange, right: OrderedChange): number {
  return left.systemIndex - right.systemIndex
    || compareDefinitionId(left.change.path, right.change.path)
    || compareDefinitionId(left.change.reason, right.change.reason)
    || left.ordinal - right.ordinal;
}

/** One-call change owner: scalar coalescing plus causal membership transitions. */
export class BatchChanges implements TickChanges {
  private readonly scalars = new Map<string, OrderedChange>();
  private readonly memberships: OrderedChange[] = [];
  private nextOrdinal = 0;

  record(
    system: WorldGraphSystemId,
    path: string,
    value: ChangeValue,
    reason: string,
    visible: boolean,
    previous?: ChangeValue,
  ): void {
    if (path.length === 0 || reason.length === 0) throw new Error("World-graph changes require a path and reason");
    const ordinal = this.nextOrdinal;
    this.nextOrdinal += 1;
    const change: StateChange = {
      path,
      op: "set",
      value,
      reason,
      visible,
      ...(previous === undefined ? {} : { previous }),
    };
    const ordered = { systemIndex: worldGraphSystemIndex(system), ordinal, change };
    if (path.endsWith(".exists")) {
      if (typeof value !== "boolean" || (previous !== undefined && typeof previous !== "boolean")) {
        throw new Error("World-graph membership changes must be boolean");
      }
      this.memberships.push(ordered);
      return;
    }

    const key = `${path}\u0000${reason}`;
    const existing = this.scalars.get(key);
    if (!existing) {
      this.scalars.set(key, ordered);
      return;
    }
    this.scalars.set(key, {
      ...existing,
      change: { ...existing.change, value, visible },
    });
  }

  finish(): StateChange[] {
    const scalars = [...this.scalars.values()].filter(({ change }) => (
      change.previous === undefined || change.previous !== change.value
    ));
    return [...scalars, ...this.memberships].sort(compare).map(({ change }) => change);
  }
}
