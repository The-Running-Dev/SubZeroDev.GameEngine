/**
 * The ordered system pipeline (`20-contract.md` §20).
 *
 * Two kinds resolve a turn by running an ordered list of systems: `simulation`'s end-of-week
 * pass and `world-graph`'s tick. Their orders are normative and owned by those kinds, not
 * here. This module owns only the *substrate* they run on — what applying an ordered list
 * means — and §20 defines that as a fold over an explicit list and nothing more:
 *
 * - **Order is the caller's, verbatim.** Never sorted, filtered, deduplicated, reordered or
 *   skipped. There is no registry of systems here and no opinion about which belong.
 * - **Every entry runs, every time.** No short-circuit, no early exit. A terminal or failed
 *   result is a value carried in the frame, never a control-flow signal — `world-graph` §4.1's
 *   "a terminal result does not interrupt the tick" is a consequence of this rather than an
 *   exception to it. Where a turn stops early it stops in the caller's own loop around this.
 * - **Each entry is a total function from frame to frame,** threaded in sequence. This module
 *   is generic over the frame and reads no field of it.
 * - **It emits nothing.** No `Emitter`, no randomness, no clock. Where a kind wants a
 *   per-system trace event, the entry's own `run` closes over the system and the emission
 *   together at the point the list is built — which is how `simulation` keeps
 *   `kind.simulation.system.ran` and `world-graph` keeps emitting no per-system event, on one
 *   substrate with no flag distinguishing them.
 * - **It never catches.** A throwing system propagates to the caller with no partial commit
 *   and no substitute frame. A throw is an engine defect, not a game outcome; catching one
 *   would convert a wrong state into a state that still serializes.
 *
 * Engine-internal by contract: exported from neither the package root nor `/authoring`, and
 * no host supplies, replaces, wraps or observes one — a pipeline sits inside the determinism
 * boundary, which by `06-extensibility.md` §2 is the same line as the trust boundary.
 * `src/authoring.test.ts` is what actually holds that closed, against both surfaces' committed
 * export lists.
 */

/**
 * One entry in a caller's ordered list.
 *
 * `id` is the caller's own label — this module never reads, compares or interprets it, since
 * doing so would be an opinion about the list's contents. It is carried because both callers
 * have kind-specific system ids that must survive the refactor unchanged, and because a list
 * of anonymous closures is unreadable at the point it is built.
 */
export interface SystemEntry<Frame> {
  readonly id: string;
  readonly run: (frame: Frame) => Frame;
}

/**
 * Applies `systems` to `initial` in the given order and returns the final frame.
 *
 * Deliberately not `Array.prototype.reduce`: the loop is the whole of the semantics, and a
 * `reduce` invites a later contributor to add an accumulator, a short-circuit, or a
 * try/catch that §20 forbids.
 */
export function runSystems<Frame>(initial: Frame, systems: readonly SystemEntry<Frame>[]): Frame {
  let frame = initial;
  for (const system of systems) {
    frame = system.run(frame);
  }
  return frame;
}
