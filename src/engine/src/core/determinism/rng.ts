/**
 * The `StreamId` → string encoder and the `RngHandle` factory.
 *
 * Contract: `04-core.md` §8.
 */

import type { RngHandle, StreamId } from "./types.js";
import { deriveStream } from "./pcg32.js";

/**
 * The normative `StreamId` → string mapping (04 §8). This is hashed, so changing it
 * changes every seeded outcome — the encoding is part of the contract, not an
 * implementation detail.
 */
export function encodeStreamId(streamId: StreamId): string {
  switch (streamId.kind) {
    case "action":
      return `action:${streamId.seq}`;
    case "system":
      return `system:${streamId.system}:${streamId.seq}`;
    case "agent":
      return `agent:${streamId.agentId}:${streamId.seq}`;
    case "tick":
      return `tick:${streamId.tick}:${streamId.system}`;
  }
}

/**
 * A scoped handle on the stream derived from `(seed, streamId)`. Forwards to the
 * underlying `Pcg32` but deliberately does not return it directly: `RngHandle` exposes
 * no `toState()`, so nothing can read generator state back into persisted state (04 §8).
 */
export function rngHandleFor(seed: string, streamId: StreamId): RngHandle {
  const gen = deriveStream(seed, encodeStreamId(streamId));
  return {
    nextInt: (minInclusive, maxInclusive) => gen.nextInt(minInclusive, maxInclusive),
    nextPercent: () => gen.nextPercent(),
    pick: (items) => gen.pick(items),
    weightedPick: (items) => gen.weightedPick(items),
  };
}
