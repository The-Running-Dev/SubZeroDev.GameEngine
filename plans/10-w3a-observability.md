# W3a — Observability: Emitter, Events, and Sinks

**Status:** Draft — implementing immediately after this document (user directive: "plan
and execute").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W3a

**Scope:** The core half of the operational event channel — `Emitter`, the per-resolution
`ResolutionEmitter` handle already typed on `KindContext`, the core event set (05 §8), and
two sinks (`nullEmitter`, `recordingEmitter`). Replaces the `noopResolutionEmitter` stub
W3 left in `kernel/engine.ts` with real emission. **Not in scope:** stamping, spans,
`attempt`, `jsonlEmitter`, `withEmitter` — all W7's, because they need a clock, which only
the session-store layer has. Kind-emitted events (`kind.<kindId>.*`) come with the kind
units (W11, W12); this unit builds the *mechanism* that will enforce their namespace, not
any real kind event.

## Authority

- [`docs/docs/engine/05-observability.md`](../docs/docs/engine/05-observability.md) — read
  in full for this plan. §§1–5, §7–§10, §12 are TODO's stated W3a scope; §6/§6.1 (the
  boundary/stamping) and §13 (deferred items) are explicitly out.
- `04-core.md` §3.1, §4, §14 — `KindContext`, `createEngine`, the determinism harness.
- `kernel/engine.ts` (W3, merged) — every `// TODO(W3a)` comment marks a call site this
  unit replaces.
- `kernel/types.ts`, `observability/types.ts`, `kernel/reasons.ts`, `determinism/{types,rng}.ts`
  — read in full; no changes needed to any of them, this unit is additive.

## The Nine Core Events, and Which Are Wireable Now

05 §8's table, cross-checked against what actually exists in this codebase:

| Event | Wireable now? | Why |
|---|---|---|
| `core.game.created` | Yes | `createGame` success path |
| `core.action.accepted` | Yes | `submitAction` success path |
| `core.action.rejected` | Yes | every `submitAction` rejection path |
| `core.game.ended` | Yes | `createGame`/`submitAction` when status becomes `"ended"` |
| `core.rng.stream.derived` | Yes | every `rngHandleFor` call inside a `KindContext` |
| `core.serialize.completed` | Yes | `Engine.serialize` |
| `core.deserialize.rejected` | Yes | every `deserialize` rejection path |
| `core.validation.completed` | **No** | fires at registry construction (04 §11); no registry builder exists yet — W4/W5 |
| `core.migration.applied` | **No** | fires when a save is migrated; W3's `migrate` is a pass-through stub (Decision 5, plan 09) — no real migration exists yet |

The last two get their `EventName`/severity defined in `CORE_EVENTS` (so the constant
table is complete and the doc/code agree) but no call site — commented as deferred, not
silently dropped.

## Design

### Files

```
src/engine/src/core/observability/
  events.ts        # new — CORE_EVENTS: { name, severity } per the table above
  events.test.ts     # new — every CORE_EVENTS name matches its severity per 05 §8
  emitter.ts        # new — nullEmitter, createRecordingEmitter, safeEmit, emitSystemEvent,
                     #        makeResolutionEmitters (core view + forKind view)
  emitter.test.ts    # new
src/engine/src/core/kernel/
  engine.ts          # edit — wire real emission, remove noopResolutionEmitter
  engine.test.ts      # edit — new describe("observability", ...) block
```

### `makeResolutionEmitters` — one shared ordinal counter, two views

05 §5 fixes `(gameId, seq, ordinal)` as the ordering key for one resolution, and `ctx.emit`
is described as *the* per-resolution handle (singular) — but the core needs to emit its
own bookend events (`core.action.accepted`, etc.) from the **same** ordinal sequence the
kind's `kind.*` events share, and only kind-emitted events carry `kindId` (`GameEvent.kindId?`,
"set on kind-emitted events," 05 §3). Two views over one shared counter, closed over the
same sink/gameId/seq:

```typescript
interface ResolutionEmitters {
  readonly core: ResolutionEmitter;                                    // no kindId
  forKind(kindId: KindId, declaredEventNames: readonly EventName[]): ResolutionEmitter;  // stamps kindId
}
```

Both views validate the namespace on every call and throw on violation — this is a
programming-error assertion (same style as `encodeStreamId`'s exhaustiveness guard), not a
player-facing rejection:

- `core` view: `name` must start with `"core."`.
- `forKind(kindId, eventNames)` view: `name` must start with `` `kind.${kindId}.` `` **and**
  be literally present in `eventNames` — 05 §9: "emitting an undeclared name fails in
  development builds," which is stronger than a prefix check alone.

This is also where `createEngine`'s construction-time check lives (05 §9, "Engine
construction rejects a kind declaring a name outside its own namespace"): for every kind
present in `host.kinds`, every entry of its `eventNames` must start with its own
`` `kind.${kind.id}.` `` prefix, checked once at `createEngine(host)`, throwing otherwise.

### `core.rng.stream.derived` applies to every `KindContext`, including reads

The event fires whenever a stream is derived from `(seed, streamId)` — that happens on
`ctx.rng` (the handle built for the resolution) and every call to `ctx.derive(...)`, in
**every** context: `createGame`'s start resolution, `submitAction`, and the read paths
(`scene`/`availableActions`/`view`), which also build a `KindContext` (plan 09, Decision
3). This is a change from W3: reads currently get the no-op stub; after this unit they get
a real `ResolutionEmitters` too, so `core.rng.stream.derived` and any `kind.*` event a
kind's `scene`/`availableActions`/`project` chooses to emit both actually reach the sink.
No core *lifecycle* event (`game.created`, `action.accepted/rejected`, `game.ended`) fires
for a read — nothing in 05 §8's table names one — so this isn't new scope, just the one
event that was always going to apply everywhere a stream gets derived.

### `submitAction`'s rejection paths all route through one `reject()` helper

W3 had three early-return rejection paths (`session_ended`, `unknown_kind`,
`unknown_campaign`) plus the kind's own `result.error`. All four must emit
`core.action.rejected` — including the three that currently return before a `Kind` or
`Campaign` is even resolved, which is fine: emitting only needs `gameId`/`seq`, both
available from `state` before any lookup. A single `reject(error, includeActionId?)`
closure, built once `emitters` exists (right after `seq` is computed, before the status
check), removes the duplication that would otherwise appear at all four call sites.

**The `actionId`-omission rule (05 §8's callout):** `data.actionId` is included only when
the id "resolved to an action the campaign declares." None of the three core-level
rejections ever asked the kind, so they never resolved anything — `includeActionId` is
`false` for all three. For the kind's own `result.error`, `includeActionId` is `true`
unless `result.error.code === "unknown_action"` (the one code that means "the kind didn't
recognize this id either").

### `serialize`/`deserialize`/`migrate` become host-aware

`serializeState`/`deserializeState`/`migrateState` (currently `(state)`/`(data)`) gain a
leading `host: EngineHost` parameter so they can reach `host.emitter`. **No change to the
public `Engine` interface** — `createEngine`'s returned closures already capture `host`,
so `Engine.serialize(state)`/`Engine.deserialize(data)` keep their existing signatures;
this is purely internal.

`core.deserialize.rejected` is `scope: "system"` (05 §8 says so explicitly) — no `gameId`,
so it can't go through `ResolutionEmitters` (which always builds a `GameEvent`). A small
`emitSystemEvent(sink, name, severity, detail)` helper builds a bare `SystemEvent` with
`ordinal: 0` (each deserialize call emits at most one event, so there's nothing to order).

`core.serialize.completed`'s `bytes` is computed with `new TextEncoder().encode(result).length`
— the actual UTF-8 byte count, not `string.length` (UTF-16 code units), since the event
name says "bytes."

### Sink isolation

`safeEmit(sink, event)` wraps every call into a caller-supplied `Emitter` in `try`/`catch`,
swallowing and discarding on throw (05 §10: "the core additionally isolates every `emit`
call... What the core does with a swallowed error is deliberately narrow: it is
discarded"). Used by both `ResolutionEmitters`' internal `build()` and `emitSystemEvent`.

### `nullEmitter` / `createRecordingEmitter`

`nullEmitter` is a singleton constant (`{ emit: () => {} }`), matching 05 §10's `declare
const nullEmitter: Emitter`. `recordingEmitter` can't be a singleton — each test needs
isolated storage — so it's a factory: `createRecordingEmitter(): RecordingEmitter` where
`RecordingEmitter extends Emitter { readonly events: readonly EngineEvent[] }`. Worth
flagging since the doc's naming implies a constant; the factory is the only workable
reading given the doc's own description ("keeps events in memory," which needs fresh
state per instance).

## Explicit Non-Goals (same reasoning as plan 09)

- No stamping, spans, `traceId`/`spanId`/`attempt`, `jsonlEmitter`, `withEmitter` — W7.
- No `core.validation.completed` or `core.migration.applied` call sites — nothing to wire
  them to yet (table above).
- No kind-emitted events from a real kind — W9–W14. Tests exercise the namespace
  enforcement mechanism against the same local stub `Kind` `engine.test.ts` already uses.
- No change to any `types.ts` file, and no change to `Engine`'s public interface.

## Test Plan

Mapped to TODO's W3a done-criteria, each gets at least one test in `emitter.test.ts` or a
new `describe("observability", ...)` block in `kernel/engine.test.ts`:

- [ ] `emit` returns `void`; no core code path reads a return value from a sink.
- [ ] A fixture (createGame + a couple of `submitAction` calls) replays byte-identically
      under `nullEmitter` and under `createRecordingEmitter()`'s emitter.
- [ ] The same fixture replayed twice under `createRecordingEmitter()` yields the
      identical event sequence — names, order, `data`, ordinals — comparing **modulo
      `gameId`** (05 §12 — a replay is a new game and legitimately gets a new id).
- [ ] Ordinals restart at 0 on each of two successive `submitAction` resolutions.
- [ ] `core.deserialize.rejected` is `scope: "system"` and carries no `gameId`/`seq`.
- [ ] A rejected unresolved action id (`unknown_action`) produces `core.action.rejected`
      with no `actionId` in `data`; a rejected *resolved* action (stub kind returns a
      different error code for a recognized id) carries `actionId`.
- [ ] The core's own emitter throws on a name outside `core.*`; a kind's `forKind` emitter
      throws on a name outside `` kind.<kindId>.* `` **and** on a name not in its declared
      `eventNames`.
- [ ] `createEngine` throws when a registered kind declares an `eventNames` entry outside
      its own namespace.
- [ ] A sink that throws on every call does not fail a game — `submitAction` and
      `createGame` still succeed with byte-identical `serialize()` output.
- [ ] No `EngineEvent` field is populated from a clock or an RNG draw (structural — the
      eslint guard already enforces this; one test constructs events and checks no
      timestamp-shaped field exists).

## Suggested Commit Breakdown

1. `observability/events.ts` + test — the `CORE_EVENTS` table alone, trivial and
   independent.
2. `observability/emitter.ts` + test — sinks, `safeEmit`, `emitSystemEvent`,
   `makeResolutionEmitters`.
3. `kernel/engine.ts` — wire it in, replacing `noopResolutionEmitter`.
4. `kernel/engine.test.ts` — the observability describe block.

All four are small enough to land as one PR, same as W3.
