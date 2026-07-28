/**
 * Projection — the narrowing mechanism and its audiences.
 *
 * Contract: `04-core.md` §9.
 *
 * The core runs the mechanism; the kind supplies the narrowing via `Kind.project`. The
 * core guarantees the envelope's own hidden fields — `seed`, `actionLog`, raw
 * `kindState` — never reach a client except through that call.
 */

import type { GameStatus } from "../kernel/types.js";

/**
 * `"ai"`, not `"agent"`: `agent` already means a *simulated entity* in `StreamId`
 * (04 §8) and throughout the world-graph kind, where guests and staff are agents.
 * A spatial kind full of autonomous entities made the collision unavoidable, so the
 * audience took the new name and `agent` now means exactly one thing.
 *
 * Widening the `ai` view is a difficulty setting — declared and visible, never granted
 * by accident.
 */
export type ProjectionAudience = "player" | "ai";

export interface PlayerView {
  gameId: string;
  status: GameStatus;
  /** Kind-narrowed — e.g. `StoryGraphView` (03 §9). */
  kindView: unknown;
}
