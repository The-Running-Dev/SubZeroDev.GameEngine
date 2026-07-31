# W7 — Session Store

**Status:** Draft — implementing immediately after this document (user directive: "do next
milestone, open PR").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W7

**Scope:** The in-memory `SessionStore`: `listCampaigns`, `getScene`, `getView`,
`getStrings`, `createSession`, `resumeSession`, `submitAction`, `saveGame`, `loadGame`.
Persist canonical blobs, not live objects. Own the observability boundary (05 §6, §6.1) —
the half W3a deliberately left out, because stamping needs a clock, which only this layer
has.

**Depends on:** W3a, W3, W6 — all done.

## What's Actually Left to Build

Unlike W6, this one is genuinely new production code. Nothing under `src/core/session/`
exists but the `SessionStore`/`ProfileStore` *types* (W1 scaffold). This unit builds:

1. `Engine.withEmitter(emitter): Engine` (05 §6.1) — a small addition to the pure engine
   (`kernel/types.ts`, `kernel/engine.ts`), needed because the store must stamp every
   command's events without the pure engine ever holding a clock itself.
2. The boundary sink shape and `jsonlEmitter` (05 §10), the half `observability/emitter.ts`
   explicitly deferred to this unit.
3. `createInMemorySessionStore(...)` (`session/store.ts`) — the concrete `SessionStore`.
4. A default `Clock` (`composition/defaults.ts`), since none exists yet and `Clock` is now
   consumed for the first time.

**Explicitly not this unit's job:** `ProfileStore` wiring (TODO lists it as W8 — "profileId
on `CreateSessionConfig`, and the post-action idempotent upsert" is W8's own scope, and no
kind exists yet that produces an `achievement_unlocked` `StateChange` for the store to act
on). `CreateSessionConfig.profileId` is accepted by the type but inert here.

## Decisions

### 1. `SessionHost` / `createSessionLayer` (06 §4) are not built here — a genuine spec gap, not a deferral of convenience

`composition/types.ts` already commits (from W1) to:

```typescript
export interface SessionHost {
  readonly engine: Engine;
  readonly sessions: SessionStore;
  readonly profiles?: ProfileStore;
  readonly clock?: Clock;
}
```

`06-extensibility.md` §4 pairs this with `function createSessionLayer(host: SessionHost):
SessionStore`. Read literally, that function takes an *already-complete* `SessionStore` as
one of its own inputs and returns another `SessionStore` — which only makes sense if
`sessions` is meant to be a lower-level, storage-only port (a raw blob CRUD surface) that
`createSessionLayer` wraps with the observability stamping and profile-upsert behaviour
this document describes, and `SessionHost.sessions`'s declared type (`SessionStore`, the
full nine-operation API) is a copy/paste mismatch — the storage-only interface it should
have been named was never separately defined anywhere in `04-core.md` or here.

TODO's own W7 done-criteria never name `SessionHost` or `createSessionLayer` — the unit is
specified entirely in terms of the nine `SessionStore` operations and the stamping
behaviour, both of which this plan builds directly. Forcing a fit to the ambiguous
composition-root shape would mean guessing at an unstated `SessionRecordStore` port design
under a unit that doesn't ask for one. Building the concrete store directly against
`session/types.ts`'s `SessionStore` interface satisfies every stated done-criterion without
that guess.

**Recorded as a known-and-retained open item** (Working Conventions in `CLAUDE.md`) rather
than silently dropped: added to `TODO.md`'s "Known Open Items Carried In" once this unit
lands, pointing back here.

### 2. The boundary sink is a new type, `EmittedRecordSink` — distinct from `Emitter`

05 §10's table says "a sink is an `Emitter` implementation," but 05 §6 also says a sink
receives an `EmittedRecord` — a different shape from `EngineEvent` (nested `event` field,
plus `emittedAt`/`traceId`/`spanId`/`attempt`/`sessionId`). Those can't both be literally
true for `jsonlEmitter`: `nullEmitter` and `recordingEmitter` are genuinely `Emitter`s,
constructed once and handed to `EngineHost.emitter` / used directly in tests at the *core*
layer, where no `EmittedRecord` exists yet. `jsonlEmitter` is described as "at the
boundary, stamped per §6" — it only ever runs inside the store, after stamping has already
happened.

Resolution: add

```typescript
export interface EmittedRecordSink {
  write(record: EmittedRecord): void;
}
```

to `observability/types.ts`, beside `Emitter`. `jsonlEmitter` implements this, not
`Emitter`. The store builds one short-lived `Emitter` **decorator** per command (05 §6.1's
"wraps its base emitter in a short-lived one") that closes over that command's
`traceId`/`spanId`/`attempt`/`sessionId`, and on every `emit(event)` call builds the
`EmittedRecord` and forwards it to the store's configured `EmittedRecordSink`. That
decorator — not `jsonlEmitter` directly — is what's passed to `engine.withEmitter(...)`.

### 3. `withEmitter` reconstructs the engine over a new `EngineHost.emitter`

`createEngine(host)` is already cheap and pure (no I/O at construction — it only validates
kind event namespaces, per `kernel/engine.ts`'s existing loop). `withEmitter(emitter)` is
implemented as `createEngine({ ...host, emitter })`. That satisfies 05 §6.1's "the same
engine, with every event stamped for one command" without adding any new state-holding
machinery to `Engine` itself, and re-validates nothing user-visible (the namespace check is
idempotent over the same `host.kinds`).

### 4. `attempt` increments once per `submitAction` call, and only that command

TODO's done-criterion is specific: "`attempt` increments on **rejected** submissions too."
Nothing in 04 §7 or 05 §6 defines what `attempt` means for `createSession`, `resumeSession`,
`saveGame`, or `loadGame` — none of those can produce the `(gameId, seq, ordinal)` collision
§5 names, since none of them can be resubmitted against an unmoved `seq` the way a rejected
action can. Each session record carries one `attemptCounter`, starting at 0; only
`submitAction` increments it before dispatching (so the first submission stamps `attempt:
1`, not `0` — chosen so a default-initialized counter and "no submissions yet" are
distinguishable, and rejected attempts still visibly move it). Every other command stamps
the counter's current value without incrementing it.

### 5. `traceId` and `spanId` are both freshly generated per command, and are not the same value

05 §6.1: "The store opens one span per command... `traceId`: per session-store command;
`spanId`: per unit of work within it." The MVP has exactly one unit of work per command —
there is no sub-span anywhere in this unit — so `spanId` never repeats within a `traceId`
here, but they are still minted as two independent random ids (both via
`crypto.randomUUID()`, matching `defaultIdSource`'s own choice and reasoning: this is
host/store metadata, never entering `GameState`, so it sits outside the determinism
boundary and outside the eslint `Math.random` guard's concern entirely). Keeping them
distinct rather than aliasing `spanId` to `traceId` is what leaves room for a real
sub-span later without a shape change.

### 6. Persistence stores the canonical blob, and every command round-trips through it

06 §5.2: "Persist the canonical serialization, not live objects." Each session record holds
`{ sessionId: string; blob: string; audience: ProjectionAudience }` — `blob` is
`engine.serialize(state)`, never a held `GameState` reference. Every command
`deserialize`s the current blob, operates, and (on a state-changing command)
`serialize`s the result back into the record. This is stricter than the public API alone
would force (no caller can ever obtain a raw `GameState` through `SessionStore`'s surface,
so a held object wouldn't actually leak) — it's still the specified discipline, and it's
what catches a future kind whose `kindState` stops round-tripping cleanly, at the point
the drift happens rather than later.

### 7. `getStrings` returns the full frozen registry table, not a per-campaign narrowing

04 §7 states the table is "narrowed to one session's campaign and locale," but
`ContentRegistry.strings` (04 §10.1) is one flat, already-merged `ReadonlyMap<LocKey,
string>` with no campaign partition — registry assembly merges core, kind, and every
campaign's strings into a single frozen map (04 §10.1). There is no data in the registry
today to narrow *by*. The MVP ships one locale and, in practice, one campaign at a time
(`MVP.md` §3), so returning the whole table is observably indistinguishable from a correct
per-campaign narrowing for every fixture this unit runs against. Documented rather than
silently narrowed-in-name-only; genuine per-campaign partitioning is a registry-shape
question for whenever a second campaign coexists with the first, out of scope here.

### 8. Session/save ids come from `crypto.randomUUID()` directly, not a new `IdSource` method

`IdSource` (06 §5.1) is scoped to exactly the two non-deterministic values that enter
`GameState`: `gameId` and `seed`. A `sessionId`/`saveId` never enters `GameState` — they're
store metadata, the same category `traceId`/`spanId` fall into (Decision 5). Extending the
`IdSource` port for them would blur a port that's deliberately narrow; `defaultIdSource`
itself uses `crypto.randomUUID()` for exactly this "legitimately unpredictable" reason (06
§5.1), so the store does the same directly rather than inventing a second identity port
for values the engine never sees.

### 9. Concurrency is proven with a real `await` boundary, not asserted from single-threaded ordering

JS's single-threaded event loop makes two `submitAction` calls started via `Promise.all`
still run their synchronous portions atomically unless something actually yields. To make
"two concurrent commands never cross-attribute an event" a meaningful test rather than a
tautology, the command pipeline contains one `await Promise.resolve()` between minting the
command's `traceId`/`spanId` and invoking the decorated engine call. That's enough for two
interleaved `submitAction` calls (different sessions) to genuinely interleave their
decorator construction and event emission, so a test asserting every emitted record's
`sessionId` matches the session that produced it is proving isolation, not restating
JS's run-to-completion semantics.

## Design

### New/changed files

| File | Change |
|---|---|
| `observability/types.ts` | Add `EmittedRecordSink` (Decision 2). |
| `observability/emitter.ts` | Add `jsonlEmitter(write: (line: string) => void): EmittedRecordSink`; update the file's header comment (no longer defers the boundary half). |
| `kernel/types.ts` | Add `withEmitter(emitter: Emitter): Engine` to `Engine`. |
| `kernel/engine.ts` | Implement `withEmitter` in `createEngine`'s returned object (Decision 3). |
| `composition/types.ts` | No change — `SessionHost` left as-is per Decision 1. |
| `composition/defaults.ts` | Add `defaultClock: Clock` (`now: () => new Date().toISOString()`), the first port here that legitimately needs `Date.now` — lives outside `src/core/**` determinism guard concerns since `Clock` is boundary-only (06 §5.4) and this file already sits outside `kernel`/kind resolution. |
| `session/store.ts` **(new)** | `createInMemorySessionStore(options): SessionStore` — the whole of this unit's real logic. |
| `session/store.test.ts` **(new)** | Acceptance tests, one per Test Plan item below. |
| `observability/emitter.test.ts` | Add `jsonlEmitter` coverage. |
| `kernel/engine.test.ts` | Add `withEmitter` coverage. |
| `docs/docs/engine/TODO.md` | Check off W7; add the Decision-1 gap to "Known Open Items Carried In". |

### `createInMemorySessionStore` shape

```typescript
interface InMemorySessionStoreOptions {
  engine: Engine;
  registry: ContentRegistry;
  clock?: Clock;                    // defaults to defaultClock
  recordSink?: EmittedRecordSink;   // defaults to a no-op sink
}
```

Internal state: two `Map`s, `sessions: Map<string, SessionRecord>` and `saves: Map<string,
SaveRecord>`, both process-lifetime only (no persistence across restarts — "in-memory," as
named). Every command:

1. Look up the record (throw/reject on an unknown `sessionId` — no `ReasonCode` fits "the
   session id itself doesn't exist," since that's a host-routing error, not a game
   rejection; matches how `resumeSession`/`getScene` etc. have no `CommandResult` wrapper
   in `session/types.ts` today, i.e. a rejected `Promise` is the only channel available).
2. Mint `traceId`, `spanId`; for `submitAction`, increment and capture `attemptCounter`
   first (Decision 4).
3. `await Promise.resolve()` (Decision 9).
4. Build the per-command decorator `Emitter` closing over
   `{ traceId, spanId, attempt, sessionId }` and `clock`, forwarding stamped
   `EmittedRecord`s to `recordSink`.
5. `engine.withEmitter(decorator).deserialize(record.blob)`, operate, and — for a
   state-changing command whose result is `ok` — `serialize` the new state back into
   `record.blob`.

### Test Plan

Directly against TODO's W7 done-criteria, one test (or small group) each:

- [ ] Save mid-session → `loadGame` → `submitAction` continues correctly, and the
      resulting `actionLog` has no gap.
- [ ] Two sessions created from the same campaign submit different actions; each session's
      `getScene` only ever reflects its own actions.
- [ ] `SaveHandle`/`CampaignSummary`/`Scene`/`PlayerView`/`StringTable` — a `JSON.stringify`
      scan of every store return value never contains a host-only field name
      (`savedAt`, `ownerId`, etc. — the store never introduces these fields, so this is
      really "the store adds no metadata field to any DTO," proven the same black-box way
      W6's projection test proved exclusion).
- [ ] Every emitted `EmittedRecord` for one command carries the same `traceId`/`spanId`;
      two different commands (even on the same session) mint different ones.
- [ ] `attempt` is 1 on a session's first `submitAction`, unchanged by a `getScene` in
      between, and increments again on a *second* `submitAction` even when the first was
      rejected (same `seq` both times, different `attempt`).
- [ ] Two `submitAction` calls against two different sessions, run concurrently via
      `Promise.all`, never cross-attribute an emitted record's `sessionId` (Decision 9).
- [ ] `jsonlEmitter` writes exactly one JSON-parseable line per `EmittedRecord`, in order.
- [ ] `Engine.withEmitter` returns an engine whose emitted events reach the new emitter and
      not the original one; all other behaviour (`createGame`, `submitAction` results) is
      unchanged by the swap.

### Explicit Non-Goals

- `ProfileStore` wiring — W8.
- `SessionHost`/`createSessionLayer` — Decision 1; recorded as an open item, not built.
- Any persistence backend beyond an in-memory `Map` — later units may add one behind the
  same `SessionStore` interface without changing this unit's tests.
- OpenTelemetry export, sampling, real trace-context propagation — 05 §13, explicitly
  deferred past the MVP.
