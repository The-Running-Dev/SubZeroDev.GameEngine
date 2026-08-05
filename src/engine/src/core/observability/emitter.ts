/**
 * Sinks and the per-resolution `ResolutionEmitter` factory.
 *
 * Contract: `05-observability.md` §§2, 4–5, 9–10.
 *
 * Stamping, spans, and `attempt` live in `session/store.ts` (W7) — they need a clock,
 * which only the session-store layer has (05 §6). `jsonlEmitter` lives here, beside the
 * other sinks, but is an `EmittedRecordSink` rather than an `Emitter` — see the type's own
 * doc comment and `plans/14-w7-session-store.md` Decision 2.
 */

import type {
  EmittedRecord,
  EmittedRecordSink,
  EngineEvent,
  Emitter,
  EventData,
  EventName,
  ResolutionEmitter,
  Severity,
  SystemEvent,
} from "./types.js";
import type { KindId } from "../kernel/types.js";
import type { ReasonCode } from "../kernel/reasons.js";

// ---------------------------------------------------------------------------
// Sinks (05 §10)
// ---------------------------------------------------------------------------

/** The default. Discards everything; the engine behaves identically with it (05 §2). */
export const nullEmitter: Emitter = {
  emit: () => {
    // Discards deliberately.
  },
};

export interface RecordingEmitter extends Emitter {
  /** In emission order. A snapshot array — mutating it does not affect recording. */
  readonly events: readonly EngineEvent[];
}

/**
 * A fresh recorder per call — unlike `nullEmitter`, this can't be a shared singleton;
 * each test or harness run needs isolated storage.
 */
export function createRecordingEmitter(): RecordingEmitter {
  const events: EngineEvent[] = [];
  return {
    emit: (event) => {
      events.push(event);
    },
    get events() {
      return [...events];
    },
  };
}

/**
 * A conforming sink must not throw (05 §10); the core isolates the call anyway, as
 * defence in depth — "the invariant is worth more than the principle." Swallowed
 * deliberately: it cannot be logged through the emitter that just failed, and routing it
 * anywhere else reintroduces the coupling this exists to avoid.
 */
export function safeEmit(sink: Emitter, event: EngineEvent): void {
  try {
    sink.emit(event);
  } catch {
    // Discarded — see the doc comment above.
  }
}

/** `NODE_ENV=production` is the one place this codebase already relies on to distinguish
 *  a shipped build from every other build (dev, CI, `vitest`'s own default of `"test"`) —
 *  there is no other dev-only guard idiom here to match. */
function isProductionBuild(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

/**
 * A kind/core call site emitting an undeclared or out-of-namespace event name is a coding
 * defect, not a runtime condition to model — 05 §9/§10's "fail in development builds"
 * means every non-production build (dev, CI, tests) still throws, so the defect is caught
 * long before it ships. In a production build the throw is downgraded to the same silent
 * drop `safeEmit` already gives a misbehaving *sink*: a faulty emit call site must not be
 * able to abort the game resolution that triggered it (05 §2's "removing every event
 * changes nothing" — that has to hold for a malformed event too, not just a dropped one).
 */
function rejectUndeclaredName(message: string): void {
  if (!isProductionBuild()) {
    throw new Error(message);
  }
  // Production: no event is built or emitted for the malformed name — degrading further
  // by emitting it anyway would defeat the namespace/declaration check this exists to
  // enforce. The caller's resolution continues unaffected either way.
}

/**
 * "Development, and the text client" (05 §10). One JSON object per line, written through
 * an injected `write` rather than a concrete stream — keeps this testable without touching
 * the filesystem, and lets a real caller wire it to `fs.appendFileSync`, a `WriteStream`,
 * or `process.stdout` as they see fit. Same "must not throw" contract as any other sink:
 * a `write` that throws is swallowed here, for the identical reason `safeEmit` swallows.
 */
export function jsonlEmitter(write: (line: string) => void): EmittedRecordSink {
  return {
    write(record: EmittedRecord) {
      try {
        write(JSON.stringify(record));
      } catch {
        // Discarded — see safeEmit's doc comment; the same reasoning applies here.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// System-scope events (05 §3, §8 — no game exists yet, or the input isn't trusted)
// ---------------------------------------------------------------------------

export function emitSystemEvent(
  sink: Emitter,
  name: EventName,
  severity: Severity,
  detail?: { reason?: ReasonCode; data?: EventData },
): void {
  const event: SystemEvent = {
    scope: "system",
    name,
    severity,
    // Each system-scope call emits at most one event, so there is nothing to order.
    ordinal: 0,
    ...(detail?.reason !== undefined ? { reason: detail.reason } : {}),
    ...(detail?.data !== undefined ? { data: detail.data } : {}),
  };
  safeEmit(sink, event);
}

// ---------------------------------------------------------------------------
// Per-resolution emitters (05 §4–§5, §9)
// ---------------------------------------------------------------------------

export interface ResolutionEmitters {
  /** No `kindId` stamped. Only names under `core.*` are accepted (05 §3.1). */
  readonly core: ResolutionEmitter;
  /**
   * Stamps `kindId`. Only names under `` kind.${kindId}. `` **and** present in
   * `declaredEventNames` are accepted (05 §3.1, §9) — engine construction separately
   * checks every declared name is in-namespace (see `kernel/engine.ts`), so a name that
   * passes both checks is guaranteed well-formed.
   */
  forKind(kindId: KindId, declaredEventNames: readonly EventName[]): ResolutionEmitter;
}

/**
 * One shared ordinal counter for the whole resolution — `(gameId, seq, ordinal)` orders
 * every event of it (05 §5), whether the core or the kind emitted it. Call once per
 * resolution (once per `createGame`, once per `submitAction`, once per read); ordinals
 * restart at 0 each time by construction, since a fresh counter is created here.
 */
export function makeResolutionEmitters(sink: Emitter, gameId: string, seq: number): ResolutionEmitters {
  let ordinal = 0;

  function build(
    name: EventName,
    severity: Severity,
    detail: { reason?: ReasonCode; data?: EventData } | undefined,
    kindId: KindId | undefined,
  ): void {
    const event: EngineEvent = {
      scope: "game",
      name,
      severity,
      ordinal: ordinal++,
      gameId,
      seq,
      ...(kindId !== undefined ? { kindId } : {}),
      ...(detail?.reason !== undefined ? { reason: detail.reason } : {}),
      ...(detail?.data !== undefined ? { data: detail.data } : {}),
    };
    safeEmit(sink, event);
  }

  return {
    core: {
      emit(name, severity, detail) {
        if (!name.startsWith("core.")) {
          rejectUndeclaredName(
            `core resolutionEmitter: "${name}" is outside the core.* namespace (05-observability.md §3.1)`,
          );
          return;
        }
        build(name, severity, detail, undefined);
      },
    },
    forKind(kindId, declaredEventNames) {
      const prefix = `kind.${kindId}.`;
      return {
        emit(name, severity, detail) {
          if (!name.startsWith(prefix) || !declaredEventNames.includes(name)) {
            rejectUndeclaredName(
              `kind "${kindId}" resolutionEmitter: "${name}" must be declared in Kind.eventNames and start ` +
                `with "${prefix}" (05-observability.md §3.1, §9)`,
            );
            return;
          }
          build(name, severity, detail, kindId);
        },
      };
    },
  };
}
