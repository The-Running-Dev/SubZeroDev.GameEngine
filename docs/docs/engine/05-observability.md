---
sidebar_label: Observability
---

# Observability — Logging and Tracing

**Document status:** Revision 1 — new contract, MVP scope

**Reading order:** after [`04-core.md`](04-core.md), which owns the types this extends.
The `GameState` envelope (04 §2), `KindContext` (04 §3.1), the session store (04 §7) and
the determinism harness (04 §14) are all assumed.

> **Scope of this document**
>
> How the engine reports **what it is doing** — the operational event channel, the rules
> that keep it from breaking determinism, the sinks it writes to, and where tracing
> attaches.
>
> It does **not** cover `StateChange` or `OutcomeMessage` ([`04-core.md`](04-core.md)
> §12). Those are domain records shown to players and authors; §1 below draws the line
> and explains why it matters.

---

## 1. Two Channels, Deliberately Separate

The engine already had a way of saying what happened before this document existed. Adding
a second one is only safe if the split is stated outright, because the two look alike and
the cost of conflating them is a core that quietly depends on its own logs.

| | Domain records | Operational events |
|---|---|---|
| Types | `StateChange`, `OutcomeMessage` (04 §12) | `EngineEvent` (§3) |
| Audience | Players and content authors | Developers and operators |
| Delivery | Returned in `AdvanceResult` | Emitted to a sink (§4) |
| Localized | Yes — `LocKey` into the string tables | **Never** — keys and ids only (§3.2) |
| Part of the result | Yes | **No** — see §2 |
| May be dropped | No | **Yes, always, with no behavioural difference** |

> **Why not extend `StateChange` instead.** It is the obvious move and it is wrong.
> `StateChange` is an audit record emitted by typed reducers (04 §12) — it carries a
> `visible` flag because a client may show it, and a `reason: ReasonCode` because the
> player is owed an explanation. Operational events answer a different question, for a
> different reader, at a volume no player should ever see. Merging them would put
> debug-level detail behind a `visible: false` flag inside the returned result, which
> means it is inside the value the session store persists and the projection filters —
> exactly the coupling §2 exists to prevent.

**The duplication rule.** An operational event must not carry information the envelope,
`AdvanceResult`, or the action log already own. It may carry *references* to them —
`gameId`, `seq`, a `ReasonCode`, a node id — but a log record is never the place a fact
first appears. If something matters to the game, it belongs in state or in the result; if
it only matters to whoever is debugging, it belongs here.

---

## 2. The Determinism Rule

There is exactly one invariant, and everything else in this document follows from it:

> **Removing every event changes nothing.** For any game, replaying `{seed, actionLog}`
> with a sink that records and with a sink that discards must produce byte-identical
> `serialize()` output, an identical `AdvanceResult`, and an identical action log.

This is the property that lets the core log at all. It is enforced three ways.

**`emit` returns `void`.** There is no channel back. A kind cannot branch on whether a
sink is attached, what it did with an event, or whether it succeeded, because none of
those facts are expressible in the type. This is deliberate and load-bearing — a return
value here would make logging an input to the simulation.

**No clock, no randomness, no allocation of identity.** The core never stamps a
timestamp, never draws a trace id, never calls `Date.now`. The determinism guard in
`src/engine/eslint.config.js` ([Engine Package](/docs/guide/engine-package)) already bans
the first and third; this document adds no
exception, and every field that conventionally needs a clock or an RNG is supplied at the
boundary instead (§6). This follows the line 04 §2 already drew for the envelope and 04
§7 drew for the session record — observability does not get a special case.

**The harness asserts it.** The determinism harness (04 §14) gains a sink-independence
check: every golden fixture runs twice, once with `nullEmitter` and once with
`recordingEmitter`, and the two `serialize()` outputs must be identical bytes (§12).

> **On `advance` being "pure".** 04 §3 documents `advance` as pure — *same
> `(state, action, params, ctx)` → same result*. Emitting is a side effect, and pretending
> otherwise would be dishonest. The precise claim is narrower and still strong: `advance`
> is pure **with respect to its return value and to state**. It has one write-only side
> channel whose observable effect on the game is nil by construction (`void` return) and
> by test (§12). That is the same bargain the RNG handle strikes in 04 §3.1 — a handle is
> supplied, used, and discarded, and the state carries nothing of it.

---

## 3. The Event

```typescript
type Severity = "trace" | "debug" | "info" | "warn" | "error";

type EventName = string;         // dotted, namespaced, stable; additive, never renamed

type EventScope = "game" | "system";

interface EngineEventBase {
  readonly name: EventName;      // "core.action.rejected" — §3.1
  readonly severity: Severity;   // fixed per name, not per call site — §7
  readonly ordinal: number;      // 0-based, monotonic within this resolution — §5
  readonly reason?: ReasonCode;  // when the event corresponds to a rejection or outcome
  readonly data?: EventData;     // structured detail — §3.2
}

/** Emitted while resolving a specific game. */
interface GameEvent extends EngineEventBase {
  readonly scope: "game";
  readonly gameId: string;       // from the envelope (04 §2)
  readonly seq: number;          // the action sequence this resolution belongs to
  readonly kindId?: KindId;      // set on kind-emitted events (§9)
}

/** Emitted where no game exists, or where the input claiming to be one is untrusted. */
interface SystemEvent extends EngineEventBase {
  readonly scope: "system";
}

type EngineEvent = GameEvent | SystemEvent;

type EventData = Readonly<Record<string, string | number | boolean>>;
```

Every field is derivable from state and the resolution in progress. Nothing here requires
a clock, an RNG draw, or ambient process state, which is what makes the whole record
reproducible (§5).

> **Why the scope split rather than optional `gameId`.** Two of the core events in §8
> genuinely have no game to name. `core.validation.completed` runs at registry
> construction, before any game exists; `core.deserialize.rejected` fires on an envelope
> the engine has just refused to trust, so reading a `gameId` out of it would be
> propagating exactly the field it declined to accept. Making `gameId` merely optional
> would leave both cases legal *and* undistinguished, so a consumer could not tell "no
> game" from "forgot to set it". A discriminated union makes each case say which it is,
> and makes `event.scope === "game"` the guard that gives a consumer `gameId` and `seq`.

### 3.1 Naming and Namespaces

Event names are dotted, lowercase, and namespaced by owner. The namespace rule mirrors the
reserved `core.reason.*` discipline in 04 §12, and exists for the same reason — so a name
cannot collide and a reader always knows who emitted it.

| Prefix | Owner | Example |
|---|---|---|
| `core.*` | The core. **Reserved** — a kind may not emit into it | `core.action.rejected` |
| `kind.<kindId>.*` | That kind, and only that kind | `kind.story-graph.settle.step` |
| `session.*` | The session store, above the pure engine (04 §7) | `session.resume.miss` |
| `client.*` | Clients and the MCP adapter (04 §13) | `client.mcp.tool.called` |

Names are **additive and never renamed**, on the same reasoning as reason codes (04 §12):
dashboards, alerts, and saved queries reference them, and a rename silently breaks every
consumer. A name that turns out wrong is superseded by a new one and the old one retired
in a documented step, never repointed.

### 3.2 What `data` May Carry

`data` values are primitives — `string | number | boolean`. Three rules govern content:

- **Ids and keys, never rendered prose.** An event referencing a message carries its
  `LocKey`, not the resolved string. Logs stay locale-independent and a log line cannot
  drift from what the player actually saw.
- **No player-authored text.** Nothing typed by a player and nothing interpolated from
  campaign narrative. This keeps the stream safe to ship to a hosted operator without a
  redaction pass — a property that is far cheaper to preserve than to retrofit.
- **No secrets from the projection boundary.** Hidden variables (04 §9) may appear in
  `trace`/`debug` events, which is the point of them, but a sink carrying those must never
  be wired to a client-visible surface. §10 makes that a sink-selection rule rather than a
  per-event judgement call.

---

## 4. The Emitter

```typescript
interface Emitter {
  /** Record one event. Never throws. Returns nothing, by design (§2). */
  emit(event: EngineEvent): void;
}

/** The default. Discards everything; the engine behaves identically with it. */
declare const nullEmitter: Emitter;
```

**Where it comes from.** The engine is constructed with one, defaulting to `nullEmitter`
so observability is opt-in and an embedder that wants none pays nothing:

```typescript
function createEngine(
  registry: ContentRegistry,
  kinds: KindRegistry,
  emitter?: Emitter,          // defaults to nullEmitter
): Engine;
```

**How a kind reaches it.** `KindContext` (04 §3.1) gains one field:

```typescript
interface KindContext {
  readonly registry: ContentRegistry;
  readonly campaign: Campaign;
  readonly rng: RngHandle;              // §8 — per-resolution, discarded after
  readonly seq: number;
  readonly emit: ResolutionEmitter;     // this document — per-resolution, discarded after
}

interface ResolutionEmitter {
  /** `gameId`, `seq` and `ordinal` are supplied by the core; the caller gives the rest. */
  emit(
    name: EventName,
    severity: Severity,
    detail?: { reason?: ReasonCode; data?: EventData },
  ): void;
}
```

> **Why a per-resolution handle rather than the raw `Emitter`.** It is the same shape as
> `ctx.rng`, and for the same reasons. The core derives a handle for *this* resolution,
> the kind uses it, and it is discarded when `advance` returns — nothing is written back.
> The handle owns the `ordinal` counter (§5), which is what keeps ordinals per-resolution
> and therefore reproducible; a shared counter would number events by how many games
> happened to run before this one, which is exactly the kind of ambient state that makes a
> stream non-reproducible. It also means a kind cannot forge `gameId` or `seq`, so
> correlation cannot be corrupted by a kind's bug.

---

## 5. Correlation Without a Clock

Tracing conventionally identifies work with random ids and orders it with timestamps. The
core can do neither. It does not need to: the envelope already carries a unique
deterministic key.

**`(gameId, seq, ordinal)` orders every event of an *accepted* resolution.** `gameId` is
unique per game (04 §2), `seq` is the action sequence, and `ordinal` is monotonic within one
resolution (§4).

Two limits on that, both real, both consequences of things 04 already decided:

- **A rejected action does not advance `seq`.** 04 §3 is explicit that a rejected action
  leaves state unchanged and appends nothing to the action log, so `seq` — which is the
  log's length — is the same on the next attempt. Two rejected submissions at the same
  position therefore produce the *same* triple. The core cannot fix this without a counter
  that is not derivable from `{seed, actionLog}`, which would be ambient state of exactly
  the kind §2 forbids. The boundary disambiguates instead, with `attempt` (§6).
- **`gameId` is runtime identity, not replay input.** `NewGameConfig` carries a seed, not a
  game id, so a replay of the same fixture is a *different game* and its events carry a
  different `gameId`. That is correct behaviour, not a defect — but it means `gameId` must
  be normalized out of any stream comparison (§12).

With those two stated, the property that remains is still the valuable one:

> **The replayable event stream is deterministic.** The same `{seed, actionLog}` produces
> the same sequence of `EngineEvent`s — same names, same order, same ordinals, same data —
> modulo `gameId`. Rejected attempts are not part of it, because they are not in the action
> log and so are not replayed at all.

Which makes the log a first-class debugging instrument rather than a best-effort one:

- A divergence between two runs can be found by **diffing their event streams**, which
  points at the resolution and the emission site, instead of bisecting `serialize()` output
  that only says *that* the bytes differ.
- An event stream can be **golden-filed** alongside the state golden files (04 §14, §12
  below), so an unintended behavioural change is caught at the step that caused it.
- Support can ask for a stream and reason about it without needing the player's machine.

---

## 6. The Boundary — Stamping and Tracing

Everything a real operator needs and the core cannot produce is added exactly once, at the
session store (04 §7), which is already the layer that does I/O and already owns wall-clock
timestamps for its records (04 §7, §2).

```typescript
interface EmittedRecord {
  readonly event: EngineEvent;   // verbatim, unmodified
  readonly emittedAt: string;    // ISO-8601, from the host clock — never from the core
  readonly traceId: string;      // per session-store command
  readonly spanId: string;       // per unit of work within it
  readonly attempt: number;      // per-session submission counter — disambiguates §5
  readonly sessionId?: string;   // the store's key; absent for pure-engine-only use
  readonly experiments?: Readonly<Record<string, string>>;  // resolved once per session
}
```

`attempt` is what closes the rejected-action collision in §5. The store counts submissions
per session, including rejected ones, so `(gameId, attempt, ordinal)` is unique on a live
stream even where `(gameId, seq, ordinal)` repeats. It lives here rather than on
`EngineEvent` precisely because it is *not* derivable from `{seed, actionLog}` — putting it
in the core would be the ambient state §2 forbids, and would make the replayable stream
depend on how many invalid submissions a player happened to make.

`experiments` lives here for the identical reason, one layer further out. It is the same
assignment map `applyExperimentGates` resolved for this session
([`11-content-packs.md`](11-content-packs.md) §5a), narrowed to the entries with a real
assignment — `null` ("not enrolled," 06 §5.5) never reaches this map, so its presence here
already means something — attached here so an event can be attributed to a variant without
the core ever knowing one exists. Unlike `traceId`/`spanId`/`attempt`, which are
per-*command*, this is per-*session*: resolved once at session creation and stamped
unchanged onto every event that session emits, the same lifetime `sessionId` already has.

### 6.1 How Per-Command Context Reaches an Event

`createEngine` takes one long-lived `Emitter` (§4), but every record above needs values
that change per command — and two commands may be in flight at once. Ambient
"current span" state would misattribute events between concurrent sessions, so the
contract does not use any.

**The store decorates, per command.** For each command it wraps its base emitter in a
short-lived one that closes over that command's `traceId`, `spanId`, `attempt` and
`sessionId`, and hands *that* to the engine call:

```typescript
interface Engine {
  // …existing members (04 §4)…
  /** The same engine, with every event stamped for one command. */
  withEmitter(emitter: Emitter): Engine;
}
```

The decorator is created and discarded inside one command, so nothing is shared between
concurrent commands and no mutable context outlives the call. This is the same
per-resolution-handle discipline `ctx.rng` and `ctx.emit` already follow (§4), applied one
layer out — the engine itself stays free of ambient state, and correctness does not depend
on an async-context mechanism the runtime may or may not provide.

The store opens one span per command (`submitAction`, `createSession`, `resumeSession`,
`saveGame`, `loadGame`), and core events emitted during that command become events within
that span. The mapping is mechanical:

| Engine concept | Tracing concept |
|---|---|
| One session-store command | One span |
| `gameId` | Span attribute |
| `seq` | Span attribute |
| `(gameId, seq, ordinal)` | Ordering key within the span |
| `EngineEvent.name` | Event name |
| `severity` | Log severity |
| `ReasonCode` | Status / error attribute on rejection |

**In the MVP:** the boundary stamps records, opens spans as a plain nesting of ids, and
writes through a sink (§10). **Deferred** (§13): an OpenTelemetry exporter, sampling, and
propagation of an inbound trace context from a hosted caller. The shape above is chosen so
that adding an exporter is an adapter, not a redesign.

---

## 7. Severity and Volume

Severity is fixed per event **name**, not chosen per call site, so a given name always
means the same thing to an alert.

| Level | For | Expected volume |
|---|---|---|
| `trace` | Step-by-step interior: each settle step, each requirement evaluated | Very high — off outside development |
| `debug` | One record per meaningful decision: a transition taken, a consequence applied | High |
| `info` | Lifecycle: game created, action accepted, game ended, save written | One or a few per action |
| `warn` | Recoverable and worth noticing: Tier 2 validation warning at load, profile read degraded to "no achievements" (04 §7.1) | Rare |
| `error` | The engine could not do what was asked: settle guard tripped, deserialize rejected an envelope | Should be zero |

> **A rejected player action is not an `error`.** Submitting an unavailable choice is
> ordinary play, answered by a `ReasonCode` (04 §12) and surfaced to the player. It emits
> `core.action.rejected` at `info`. Reserving `error` for engine faults is what keeps
> "errors should be zero" a usable operational statement.

---

## 8. Core Events

The normative starter set. Additive: more may be added, none renamed (§3.1).

| Name | Severity | When | Key `data` |
|---|---|---|---|
| `core.game.created` | `info` | `createGame` returns | `campaignId`, `campaignVersion`, `kindId` |
| `core.action.accepted` | `info` | An action advanced the game | `actionId` |
| `core.action.rejected` | `info` | An action was refused; state unchanged | `actionId` **only if it resolved** (below); `reason` set |
| `core.game.ended` | `info` | `status` became `"ended"` | — |
| `core.rng.stream.derived` | `trace` | A stream was derived from `(seed, streamId)` (04 §8) | `streamId` |
| `core.serialize.completed` | `debug` | Canonical serialization ran | `bytes` |
| `core.deserialize.rejected` | `error` | A malformed envelope was refused (04 §10.2) | `reason` set |
| `core.validation.completed` | `info` | Tiered validation ran (04 §11) | `tier`, `errors`, `warnings` |
| `core.migration.applied` | `warn` | A save was migrated; `replayCompatible: false` (04 §10.2) | `fromVersion`, `toVersion` |

> **An unresolved `actionId` is never logged.** `submitAction` takes an arbitrary string
> (04 §7), and an id matching nothing is ordinary play rather than an error — a hidden
> choice returns `unknown_action` deliberately (03 §8.3). So the rejected-action event
> carries `actionId` **only when it resolved to an action the campaign declares**; when it
> did not, the field is omitted and `reason` alone carries the meaning.
>
> Without that rule the no-player-text guarantee in §3.2 is not a guarantee: any caller
> could write arbitrary text into a hosted operator's logs by submitting it as an action id,
> and the claim that the stream ships without a redaction pass would be false. Omitting the
> field costs nothing diagnostically — `unknown_action` plus the resolution's `seq` already
> says what happened and where.

Note `core.game.created` and `core.action.accepted` carry no seed. A seed makes a game
reproducible by anyone holding the log, and the stream is not the place that decision gets
made — forensics attaches it deliberately instead (§11).

`core.validation.completed` and `core.deserialize.rejected` are `scope: "system"` (§3) —
the first runs before any game exists, the second on an envelope the engine has just
refused to trust. Every other event in the table is `scope: "game"`.

---

## 9. Kind Events

A kind emits under `kind.<kindId>.*` and nowhere else (§3.1). It declares its event names
the way it declares reason codes (04 §3, `Kind.reasonCodes`):

```typescript
interface Kind<KState> {
  // …existing members (04 §3)…
  readonly eventNames: readonly EventName[];   // names this kind may emit
}
```

**Engine construction** rejects a kind declaring a name outside its own namespace — the
same point at which kinds are registered and a missing kind is a construction error rather
than a runtime surprise (04 §4). Emitting an undeclared name fails in development builds.

Note the check lives at *engine* construction, not *registry* construction (04 §10.1),
which is where reason-code strings are validated. The two are different moments and the
difference is not cosmetic: reason codes need the content registry because they are
validated against the string tables a campaign supplies, whereas event names are validated
against the kind alone and need no content at all. Unlike reason codes, event names need
**no localized message** — they are never player-facing (§1), so the "validation fails if a
code has no string" rule in 04 §12 does not extend here.

The `story-graph` kind's set — settle steps, requirement evaluation, random transitions,
achievement unlocks — is specified in
[`03-story-graph-kind.md`](03-story-graph-kind.md) §8.4, beside the turn semantics it
describes. That placement is deliberate: the events are only meaningful next to the loop
that emits them, and splitting them from it is precisely the 03 ↔ 04 drift this project
keeps catching.

---

## 10. Sinks

A sink is an `Emitter` implementation. Three ship with the MVP:

| Sink | Purpose | Notes |
|---|---|---|
| `nullEmitter` | The default | Discards. The engine must behave identically with it — §2 |
| `recordingEmitter` | Tests and the harness | Keeps events in memory in emission order |
| `jsonlEmitter` | Development, and the text client | One JSON object per line, at the boundary, stamped per §6 |

**The sink contract:**

- **It must not throw — and the core defends anyway.** A conforming sink catches its own
  errors. The core additionally isolates every `emit` call, so a sink that throws is
  swallowed and the game continues unaffected.

  > **Both halves are required, and an earlier draft of this document had only the first.**
  > It said implementations catch their own errors and the core deliberately does *not*
  > wrap `emit`, on the reasoning that wrapping would imply throwing is expected. That is
  > a tidy principle and it is wrong here, because it contradicts §2. If a faulty sink can
  > abort a resolution, then attaching a sink can change the outcome of a game — which is
  > precisely what "removing every event changes nothing" denies. The invariant is worth
  > more than the principle, so the core catches. "Must not throw" remains a conformance
  > requirement on sinks; the core's `try` is defence in depth, not permission.

  What the core does with a swallowed error is deliberately narrow: it is discarded. It
  cannot be logged through the emitter that just failed, and routing it anywhere else would
  reintroduce the coupling this whole section avoids.
- **It must not call back into the engine.** No sink may invoke a store command or read
  game state; that is a re-entrancy hazard and, in a hosted context, a loop.
- **It must not be assumed synchronous or ordered across resolutions.** Within a
  resolution, ordinals order events (§5). Across them, a buffering sink may reorder.
- **Choosing a sink is a privacy decision.** Any sink at `trace` or `debug` may see hidden
  state (§3.2), so a sink wired to a client-visible or third-party surface must filter to
  `info` and above. This is a wiring rule, checked where the sink is constructed, rather
  than a judgement made per event.

---

## 11. Incident Forensics — A Bug Report Is a Fixture

The engine already has the property most systems build an incident pipeline to
approximate: `{seed, actionLog}` is the complete replay input (04 §2). So reproducing a
reported session needs no new machinery, and the report format is one the test suite
already runs:

```typescript
// 04 §14 — unchanged, and this is the point
interface PlaythroughFixture { name: string; config: NewGameConfig; actionLog: LoggedAction[]; }
```

**An incident report is a `PlaythroughFixture` plus the event stream that came with it.**
Attach the fixture and the run reproduces exactly; attach the stream and the emission site
is visible without rerunning anything. A confirmed bug is then committed as a golden
fixture (04 §14) with no translation step — the report *is* the regression test.

> **Why the seed is attached deliberately rather than logged.** §8 keeps the seed out of
> routine events. Anyone holding a seed and a log can replay a player's exact session, so
> the decision to capture it belongs to an explicit forensics path with its own handling,
> not to every `info` line in an operator's stream.

---

## 12. Validation and Tests

What the suite must show, beyond the per-unit criteria in [`TODO.md`](TODO.md):

- **Sink independence** — every golden fixture (04 §14) replays under `nullEmitter` and
  under `recordingEmitter`; `serialize()` output is byte-identical. This is §2 made
  executable, and it is the check that would catch a kind branching on emission.
- **Stream reproducibility** — the same fixture replayed twice under `recordingEmitter`
  produces the identical event sequence: same names, same order, same `data`, same
  ordinals. **`gameId` is normalized out of the comparison**, because a replay is a new
  game and legitimately carries a new id (§5); a golden stream that pinned it would fail on
  every run and teach the suite to be ignored.
- **Uniqueness holds where it is claimed** — across the events of one accepted resolution,
  and across accepted resolutions, `(gameId, seq, ordinal)` does not repeat. A test submits
  the *same invalid action twice* and asserts the triple **does** repeat, and that
  `attempt` (§6) is what distinguishes them — pinning the limitation rather than leaving it
  to be rediscovered as a deduplication bug.
- **System-scope events carry no game identity** — `core.validation.completed` and
  `core.deserialize.rejected` are `scope: "system"` and have no `gameId` or `seq` to
  fabricate (§3).
- **Namespace enforcement** — a kind emitting outside `kind.<kindId>.*`, or emitting a
  name absent from its `eventNames`, fails.
- **No clock, no randomness** — the determinism guard already bans `Date.now` and
  `Math.random` under `src/`; a test asserts no `EngineEvent` field is populated from
  either, by constructing events under a frozen environment.
- **A throwing sink does not break a game** — an emitter that throws on every call is
  installed, and a fixture still completes with byte-identical output. This test is only
  meaningful because the core isolates `emit` (§10); it is the executable form of that
  decision.
- **An unresolved action id never reaches the stream** — submitting an action id that
  matches nothing produces `core.action.rejected` with no `actionId` in `data` (§8).

---

## 13. What Is Deferred

Named here so the omissions are decisions rather than gaps:

- **OpenTelemetry export, sampling, and inbound trace-context propagation.** §6 fixes the
  shape so these arrive as an adapter. They belong with the hosting layer
  ([SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform)), which is
  itself deferred (MVP §4).
- **Metrics as a separate channel.** Counters and histograms are derivable from the event
  stream for now. A dedicated metrics API is worth adding when there is an operator asking
  for one, not before.
- **Per-campaign or per-kind log-level configuration.** One global level, set at
  construction, until a second one is genuinely needed.
- **Author-facing presentation of `kind.story-graph.*` events.** The events exist in the
  MVP and the diagnostic value is real, but surfacing them in an authoring tool is content
  tooling ([`TODO.md`](TODO.md), *Content Tooling*), not engine work.
