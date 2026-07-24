/**
 * PCG32 — seeded, deterministic, serializable PRNG.
 *
 * Implements pcg32 (pcg_setseq_64_xsh_rr_32) faithfully, using BigInt for exact
 * 64-bit integer arithmetic. BigInt is deterministic across engines (unlike floating
 * point), which is the whole point: the engine spec (§3) requires a seeded, serializable
 * generator so that a game replays byte-for-byte from seed + inputs.
 *
 * Reference: M.E. O'Neill, pcg-random.org (minimal C implementation).
 */

export interface RngState {
  readonly algorithm: "pcg32";
  readonly state: string; // 64-bit, hex, zero-padded to 16 chars
  readonly increment: string; // 64-bit, hex, zero-padded — the stream selector (always odd)
}

const MULT = 6364136223846793005n;
const MASK64 = (1n << 64n) - 1n;
const MASK32 = 0xffffffffn;
const u64 = (x: bigint): bigint => x & MASK64;
const u32 = (x: bigint): bigint => x & MASK32;
const hex64 = (x: bigint): string => x.toString(16).padStart(16, "0");

/**
 * A mutable generator. The engine core is pure at the boundary: derive a generator
 * from `GameState.rng`, use it during one resolution, then write `toState()` back into
 * the new state. Same input state → same draws → same output state.
 */
export class Pcg32 {
  private st: bigint;
  private readonly inc: bigint;

  private constructor(state: bigint, increment: bigint) {
    this.st = u64(state);
    this.inc = u64(increment) | 1n; // increment must be odd
  }

  /** Seed exactly as the reference pcg32_srandom_r does. */
  static seed(initState: bigint, initSeq: bigint): Pcg32 {
    const rng = new Pcg32(0n, u64(initSeq << 1n) | 1n);
    rng.next();
    rng.st = u64(rng.st + u64(initState));
    rng.next();
    return rng;
  }

  static fromState(s: RngState): Pcg32 {
    if (s.algorithm !== "pcg32") throw new Error(`unknown rng algorithm: ${s.algorithm}`);
    return new Pcg32(BigInt(`0x${s.state}`), BigInt(`0x${s.increment}`));
  }

  toState(): RngState {
    return { algorithm: "pcg32", state: hex64(this.st), increment: hex64(this.inc) };
  }

  /** Next 32-bit unsigned integer, 0 .. 2^32 − 1. */
  next(): number {
    const old = this.st;
    this.st = u64(old * MULT + this.inc);
    const xorshifted = u32(((old >> 18n) ^ old) >> 27n);
    const rot = old >> 59n; // 0 .. 31
    const out = u32((xorshifted >> rot) | (xorshifted << ((32n - rot) & 31n)));
    return Number(out);
  }

  /** Uniform integer in [0, bound), rejection-sampled to remove modulo bias. */
  private bounded(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) throw new Error(`bounded: bad bound ${bound}`);
    const b = BigInt(bound);
    const threshold = (1n << 32n) % b; // == (-bound) mod bound, unsigned
    for (;;) {
      const r = BigInt(this.next());
      if (r >= threshold) return Number(r % b);
    }
  }

  /** Uniform integer in [minInclusive, maxInclusive]. */
  nextInt(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) throw new Error(`nextInt: max < min (${maxInclusive} < ${minInclusive})`);
    return minInclusive + this.bounded(maxInclusive - minInclusive + 1);
  }

  /** Uniform integer 1 .. 100. */
  nextPercent(): number {
    return this.nextInt(1, 100);
  }

  /** Uniform pick from a stably-ordered array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick: empty array");
    return items[this.bounded(items.length)]!;
  }

  /**
   * Weighted pick from a stably-ordered array. Weights must be positive integers.
   * Order matters for determinism — callers pass authored content order, which is
   * stable (unlike Record iteration; see engine spec §2.2).
   */
  weightedPick<T>(items: readonly { readonly item: T; readonly weight: number }[]): T {
    if (items.length === 0) throw new Error("weightedPick: empty array");
    let total = 0;
    for (const { weight } of items) {
      if (!Number.isInteger(weight) || weight <= 0) throw new Error(`weightedPick: weight must be a positive integer, got ${weight}`);
      total += weight;
    }
    let roll = this.bounded(total);
    for (const { item, weight } of items) {
      if (roll < weight) return item;
      roll -= weight;
    }
    return items[items.length - 1]!.item; // unreachable when weights sum correctly
  }
}

/** FNV-1a 64-bit hash of a string — deterministic. */
function fnv1a64(s: string): bigint {
  let h = 14695981039346656037n;
  const prime = 1099511628211n;
  for (let i = 0; i < s.length; i++) {
    h = u64((h ^ BigInt(s.charCodeAt(i))) * prime);
  }
  return h;
}

/** SplitMix64 finalizer — spreads a 64-bit seed into a well-mixed 64-bit value. */
function splitmix64(x: bigint): bigint {
  let z = u64(x + 0x9e3779b97f4a7c15n);
  z = u64((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
  z = u64((z ^ (z >> 27n)) * 0x94d049bb133111ebn);
  return u64(z ^ (z >> 31n));
}

/**
 * Derive an independent generator for a named substream (engine spec §3.2). The same
 * (seed, streamId) always yields the same generator; different streamIds are
 * independent, so adding a draw in one stream never perturbs another.
 */
export function deriveStream(seed: string, streamId: string): Pcg32 {
  const base = fnv1a64(`${seed}::${streamId}`);
  const initState = splitmix64(base);
  const initSeq = splitmix64(initState);
  return Pcg32.seed(initState, initSeq);
}
