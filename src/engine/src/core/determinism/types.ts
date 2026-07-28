/**
 * Determinism — the RNG handle, stream derivation, and the harness.
 *
 * Contract: `04-core.md` §8, §14.
 *
 * Randomness is *derived, never carried*. `deriveStream(seed, streamId)` is pure: the
 * same pair always yields the same generator, and different stream ids are independent.
 * A resolution takes a handle, draws, and drops it — there is no generator state in the
 * envelope, and `{ seed, actionLog }` is the complete replay input.
 */

/**
 * Identifies one derived stream. **The string encoding is normative** (04 §8) — it is
 * hashed, so changing it changes every seeded outcome:
 *
 * ```text
 * { kind:"action", seq }             → `action:${seq}`
 * { kind:"system", system, seq }     → `system:${system}:${seq}`
 * { kind:"agent",  agentId, seq }    → `agent:${agentId}:${seq}`
 * { kind:"tick",   tick, system }    → `tick:${tick}:${system}`
 * ```
 *
 * `agent.seq` is that agent's *own* draw counter, stored on the agent in `kindState` —
 * never the action seq, which would make an agent's randomness depend on how many
 * actions preceded it.
 */
export type StreamId =
  | { kind: "action"; seq: number }
  | { kind: "system"; system: string; seq: number }
  | { kind: "agent"; agentId: string; seq: number }
  | { kind: "tick"; tick: number; system: string };

/**
 * A scoped handle on one derived stream. Deliberately exposes no `toState()`: nothing
 * reads generator state back, which is what keeps it out of the envelope.
 */
export interface RngHandle {
  nextInt(minInclusive: number, maxInclusive: number): number;
  nextPercent(): number;
  pick<T>(items: readonly T[]): T;
  /** Every weight must be a positive integer; Tier 1 validation enforces it (04 §8). */
  weightedPick<T>(items: readonly { item: T; weight: number }[]): T;
}
