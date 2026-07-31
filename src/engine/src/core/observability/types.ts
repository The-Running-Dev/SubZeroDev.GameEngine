/**
 * Observability — the clock-free event channel.
 *
 * Contract: `05-observability.md` §3–§5.
 *
 * **The invariant: dropping every event changes nothing.** `emit` returns `void`, the
 * core isolates every call, and no `EngineEvent` field is populated from a clock or an
 * RNG draw. Timestamps and trace ids are stamped at the session-store boundary, which is
 * where a clock legitimately exists — see `EmittedRecord`.
 *
 * Distinct from `StateChange`, which is domain data: localized, returned, persisted, and
 * shown to players. An event is operational and discardable.
 */

import type { ReasonCode } from "../kernel/reasons.js";
import type { KindId } from "../kernel/types.js";

export type Severity = "trace" | "debug" | "info" | "warn" | "error";

/** Dotted, namespaced, stable; additive, never renamed. The core emits `core.*`; a kind
 *  may emit only `kind.<kindId>.*`, and only names it declared in `Kind.eventNames`. */
export type EventName = string;

export type EventScope = "game" | "system";

export type EventData = Readonly<Record<string, string | number | boolean>>;

export interface EngineEventBase {
  readonly name: EventName;
  /** Fixed per name, not per call site (05 §7). */
  readonly severity: Severity;
  /** 0-based, monotonic within this resolution — restarts each resolution, so a stream
   *  does not depend on how many games ran before. */
  readonly ordinal: number;
  readonly reason?: ReasonCode;
  readonly data?: EventData;
}

export interface GameEvent extends EngineEventBase {
  readonly scope: "game";
  readonly gameId: string;
  /** The action sequence this resolution belongs to. */
  readonly seq: number;
  /** Set on kind-emitted events. */
  readonly kindId?: KindId;
}

/**
 * For the two events that have no game to name — registry validation and a rejected
 * deserialize both happen before, or instead of, a game existing.
 */
export interface SystemEvent extends EngineEventBase {
  readonly scope: "system";
}

export type EngineEvent = GameEvent | SystemEvent;

/** A sink. Never throws — and if it does, the core isolates it. */
export interface Emitter {
  emit(event: EngineEvent): void;
}

/**
 * The per-resolution handle on `KindContext`. `gameId`, `seq` and `ordinal` are supplied
 * by the core; the caller gives the rest. Scoped, used, and discarded — nothing carries
 * back into state.
 */
export interface ResolutionEmitter {
  emit(
    name: EventName,
    severity: Severity,
    detail?: { reason?: ReasonCode; data?: EventData },
  ): void;
}

/**
 * What a sink receives **at the boundary**, once time and trace context have been added.
 * The core never constructs one of these — that is the whole point of the split.
 */
export interface EmittedRecord {
  /** Verbatim, unmodified. */
  readonly event: EngineEvent;
  /** ISO-8601, from the host clock — never from the core. */
  readonly emittedAt: string;
  /** Per session-store command. */
  readonly traceId: string;
  /** Per unit of work within it. */
  readonly spanId: string;
  /** Per-session submission counter — disambiguates a repeated `seq` after a rejection. */
  readonly attempt: number;
  /** The store's key; absent for pure-engine-only use. */
  readonly sessionId?: string;
}

/**
 * A **boundary** sink — distinct from `Emitter` (05 §6, §10; `plans/14-w7-session-store.md`
 * Decision 2). `nullEmitter`/`recordingEmitter` are `Emitter`s and run at the core layer,
 * where no `EmittedRecord` exists yet. `jsonlEmitter` implements this instead: it only ever
 * runs inside the session store, after a per-command decorator has already built the
 * `EmittedRecord` from a bare `EngineEvent`.
 */
export interface EmittedRecordSink {
  write(record: EmittedRecord): void;
}
