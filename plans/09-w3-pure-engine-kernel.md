# W3 — Pure Engine Kernel Plan

**Status:** Draft — for review. Not implemented.

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W3

**Scope:** `createEngine`, `createGame` (consuming `InitialStateResult`), `submitAction`
(passing `params`, returning the new state in `value`), `scene`, `availableActions`,
`serialize`, and a validating `deserialize` returning `CommandResult<GameState>`. Per
TODO's own done-criteria, **not** in scope: wiring a real `Emitter`/`ResolutionEmitter`
(W3a), the story-graph kind (W9–W14), the registry/authoring builder (W4), or the
migration mechanism (explicitly out of MVP scope, `MVP.md` §4).

## Authority

- [`docs/docs/engine/04-core.md`](../docs/docs/engine/04-core.md) §§2–5, §12 — the
  envelope, the Kind seam, `createEngine`/`createGame`/`submitAction` pseudocode,
  reason codes and result types.
- [`docs/docs/engine/06-extensibility.md`](../docs/docs/engine/06-extensibility.md) §4–§5.1
  — `EngineHost`, `IdSource`, and the actual `createEngine(host)` signature (see Decision 1
  below — this supersedes 04 §4's snippet).
- [`docs/docs/engine/05-observability.md`](../docs/docs/engine/05-observability.md) §8 (the
  core event catalog, ~line 379) — used only to confirm which of W3's call sites are
  eventual emit points; no emitting is implemented in this unit.
- [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W1, W2 (done, both merged:
  [#17](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/17),
  [#22](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/22)), W3, W3a.
- Existing code, read in full for this plan: `src/engine/src/core/kernel/{types,reasons}.ts`,
  `determinism/{types,rng}.ts`, `registry/types.ts`, `observability/types.ts`,
  `projection/types.ts`, `validation/types.ts`, `localization/types.ts`,
  `persistence/{types,canonical}.ts`, `composition/types.ts`, `session/types.ts`.

This plan does not amend the specs on its own authority — the four items below are
flagged as decisions for you to confirm, not silently resolved. It implements only W3 and
stops before W3a.

---

## Decisions Needed

### 1. `createEngine`'s signature: follow `06-extensibility.md`, not `04-core.md` §4

`04-core.md` §4 shows `createEngine(registry, kinds, emitter?)` — three positional args.
`06-extensibility.md` §4–§5.1 (written later, explicitly closing a gap 04 left open —
*"the one that was missing"*) gives `createEngine(host: EngineHost): Engine` with
`EngineHost { kinds, registry, ids?, emitter? }`, matching `composition/types.ts` as
already committed. The two documents disagree and this is exactly the drift pattern
`CLAUDE.md` names.

**Recommendation:** implement against `EngineHost` (06, already typed in code) and add a
one-line note to `04-core.md` §4 pointing at 06 as the current signature, the same way §4
already treats `games/04-engine-specification.md` as superseded provenance. I'll make that
doc edit alongside the code unless you'd rather leave 04 §4 as illustrative pseudocode.

### 2. Three new base reason codes

`BASE_REASON_CODES` (7 codes) has nothing for three rejections TODO's W3 done-criteria
requires a test for:

| Path | Needed for | Proposed code |
|---|---|---|
| `createGame` — `campaignId` not in `registry.campaigns` | "unknown campaign" | `unknown_campaign` |
| `submitAction`/`createGame` — `state.kindId`/`campaign.kindId` not in `host.kinds` | "unknown kind" | `unknown_kind` |
| `deserialize` — structurally malformed envelope | — | `invalid_state` |

`unknown_action` and `session_ended` already exist and cover the other two required test
cases (unknown action comes from the kind's own `AdvanceResult.error`; ended-session is a
core-level check before delegating to the kind — see Design §3).

`OPEN-QUESTIONS.md` §1.2 records the base set as one of the eight decided MVP-blocking
gaps, at 7 codes. This proposal revises that count to 10. **Flagging rather than just
doing it**, since "finalized" was the word used there. If you'd rather keep the base set
closed, the alternative is folding all three into a single `invalid_request` — I'd lean
against that; it makes `ValidationError.code` less useful for a client branching on
reason, which is the whole point of the reason-code vocabulary (04 §12).

### 3. `KindContext` for read-only calls (`scene`, `availableActions`, `view`)

The `Kind` interface gives all three of these a full `KindContext` — including `rng` and
`emit` — even though none of them advance anything. Neither `04-core.md` §4 nor §3.1 says
what stream or emitter a *read* should get; the pseudocode only covers `createGame` and
`submitAction`. The event catalog (05 §8) has no event for a scene/view read, which at
least confirms these calls should emit nothing.

**Recommendation:** derive `ctx.rng` from a dedicated `{ kind: "system", system: "view",
seq: state.actionLog.length }` stream — distinct from the `action` stream so a kind that
ever drew randomness while rendering couldn't collide with the next `submitAction`'s draw
at the same seq — and pass the same no-op emitter stub as advance/initialState (Decision
4). Worth a short addendum to 04 §3.1 once you've confirmed it; I'll leave a `// see plan
09, Decision 3` comment at the call site either way.

### 4. `ctx.emit` is a local no-op stub, not W3a's real emitter

`ResolutionEmitter` is just `emit(name, severity, detail?): void` — trivial to satisfy.
The real `Emitter`, `nullEmitter`, `recordingEmitter`, and the `resolutionEmitter(emitter,
gameId, seq)` wrapper (ordinals, sink isolation, the full core event set) are W3a's job,
and W3a's own done-criteria (ordinal restart per resolution, sink-independence proof) are
substantial enough that building them ahead of schedule inside W3 would be scope creep and
likely rework once W3a's real contract lands. `EngineHost.emitter` is accepted and stored
but intentionally unused in this unit — `// TODO(W3a)` marks every call site. This isn't a
decision to confirm so much as a scope boundary I'm stating up front so it doesn't read as
an oversight during review.

### 5. `migrate` is a pass-through stub

`Engine.migrate(data): CommandResult<GameState>` is a required method on the interface,
but `MVP.md` §4 explicitly excludes migration from the MVP ("the mechanism is specified;
the MVP does not exercise it"), and no TODO unit owns building the real thing (worth a
`TODO.md` line item at some point — not blocking this plan). W3's `migrate` will delegate
straight to `deserialize` — there is exactly one `formatVersion` in existence, so there is
nothing to migrate *from* yet. No new behavior invented, interface satisfied.

---

## Design

### File layout

```
src/engine/src/core/
  kernel/
    engine.ts        # new — createEngine, Engine implementation
    engine.test.ts    # new
  composition/
    defaults.ts       # new — defaultIdSource
    defaults.test.ts   # new
  kernel/reasons.ts    # edit — add unknown_campaign, unknown_kind, invalid_state (Decision 2)
```

No change to any `types.ts` file — W1 already declared every type this unit implements
against.

### `defaultIdSource` (`composition/defaults.ts`)

06 §5.1: *"The default is a random source... the one place in the platform where
randomness is correct."* Implemented with `crypto.randomUUID()` (Node's Web Crypto,
already in the `lib`/`types` the package targets) — **not** `Math.random`, so this holds
even though the eslint determinism guard's `no-restricted-properties` rule is currently
scoped to all of `src/**/*.ts`, not just `src/core/**` as 06's prose assumes. No config
change needed; `crypto.randomUUID` was never the banned API.

```typescript
export const defaultIdSource: IdSource = {
  newGameId: () => crypto.randomUUID(),
  newSeed: () => crypto.randomUUID(),
};
```

### `createEngine(host: EngineHost): Engine`

Stores `host.kinds`, `host.registry`, `host.ids ?? defaultIdSource`, `host.emitter`
(unused, Decision 4). Returns an object implementing `Engine`. No validation at
construction time beyond what TypeScript already enforces on `host`'s shape — `host.kinds`
may legitimately contain only a subset of `KindId` (MVP registers `story-graph` only), so
"missing kind" stays a per-call rejection (`unknown_kind`), not a construction throw.

### `createGame(config: NewGameConfig): CommandResult<GameState>`

Follows 04 §4 exactly, adjusted for the two new rejections:

```text
1. campaign = registry.campaigns.get(config.campaignId)
   → undefined: return { ok:false, errors:[{ code:"unknown_campaign", messageKey:"core.reason.unknown_campaign", path: config.campaignId }] }
2. kind = kinds[campaign.kindId]
   → undefined: return { ok:false, errors:[{ code:"unknown_kind", messageKey:"core.reason.unknown_kind", path: campaign.kindId }] }
3. gameId = ids.newGameId()
4. seed = config.seed ?? ids.newSeed()
5. startHandle = rngHandleFor(seed, { kind:"system", system:"start", seq:0 })
6. startCtx = { registry, campaign, rng: startHandle, derive: (s) => rngHandleFor(seed, s), seq: 0, emit: noopResolutionEmitter }
7. init = kind.initialState(campaign, startCtx)
8. return { ok:true, value: { formatVersion: 1, gameId, kindId: campaign.kindId, campaignId: campaign.id, campaignVersion: campaign.version, seed, status: init.status, kindState: init.state, actionLog: [] }, errors:[], warnings:[] }
   // init.changes / init.messages: CommandResult<GameState> has no field for them (04 §12) —
   // they're dropped at this layer. Flagging: 04 §4 step 6 says "changes/messages ride out
   // on the CommandResult" but CommandResult<T> (§12) has no such fields, only ActionResult
   // does. createGame returns CommandResult<GameState>, not ActionResult. This looks like
   // the same class of drift as Decision 1 — I'll carry init.changes/messages nowhere
   // unless you want CommandResult widened, which would be a spec change beyond this unit.
```

That last point is a sixth thing worth your attention, surfaced inline rather than as a
numbered decision because it has only one reasonable reading: `Engine.createGame`'s return
type is fixed by the interface (`kernel/types.ts:200`, `CommandResult<GameState>`), so
`init.changes`/`init.messages` are computed and then discarded. A kind that settles at
start (03 §8.2) and wants its opening messages seen needs the client to call `scene()`
right after — which already returns the current text — so nothing is actually lost, just
not carried on this particular return value.

`formatVersion: 1` is hardcoded — it is the only version that has ever existed.

### `submitAction(state, actionId, params?): ActionResult`

04 §4's pseudocode, verbatim, plus the ended-session check TODO's done-criteria requires
and the two new rejections:

```text
1. if state.status !== "active":
     return { ok:false, value:undefined, errors:[{ code:"session_ended", messageKey:"core.reason.session_ended" }], warnings:[], changes:[], messages:[] }
2. kind = kinds[state.kindId]
   → undefined: return { ok:false, errors:[{ code:"unknown_kind", ... }], ... }  // defensive; see note below
3. seq = state.actionLog.length
4. handle = rngHandleFor(state.seed, { kind:"action", seq })
5. ctx = { registry, campaign: registry.campaigns.get(state.campaignId)!, rng: handle, derive: (s) => rngHandleFor(state.seed, s), seq, emit: noopResolutionEmitter }
6. result = kind.advance(state.kindState, actionId, params, ctx)
7. if result.error: return { ok:false, value:undefined, errors:[result.error], warnings:[], changes:[], messages:[] }
   // state and actionLog are untouched — the "byte-identical on rejection" done-criterion
8. newState = { ...state, kindState: result.state, status: result.status, actionLog: [...state.actionLog, { seq, actionId, params }] }
9. return { ok:true, value:newState, errors:[], warnings:[], changes:result.changes, messages:result.messages }
```

Step 2's defensive check: under normal operation a `GameState` only ever comes from this
engine's own `createGame`/`submitAction`/`deserialize`, all of which already validate
`kindId` against `kinds`, so it can't reach step 2 with an unknown kind through ordinary
use. It stays in as defense against a hand-built or cross-version `GameState` (exactly what
`deserialize` on a foreign save could hand back), and it's also the cheapest way to give
`unknown_kind` a `submitAction`-side test independent of `createGame`'s.

`registry.campaigns.get(state.campaignId)!` — the non-null assertion is safe under the same
"only this engine produces `GameState`" argument; `campaignId` was validated in
`createGame` and never changes afterward (no field on `GameState` lets a client alter it).

### `scene(state)`, `availableActions(state)`, `view(state, audience)`

All three build the same read-only `KindContext` (Decision 3):

```text
readCtx(state) = {
  registry, campaign: registry.campaigns.get(state.campaignId)!,
  rng: rngHandleFor(state.seed, { kind:"system", system:"view", seq: state.actionLog.length }),
  derive: (s) => rngHandleFor(state.seed, s),
  seq: state.actionLog.length,
  emit: noopResolutionEmitter,
}
```

- `view(state, audience)` — `{ gameId: state.gameId, status: state.status, kindView:
  kind.project(state.kindState, audience, readCtx(state)) }` (04 §9).
- `availableActions(state)` — `kind.availableActions(state.kindState, readCtx(state))`,
  forwarded as-is.
- `scene(state)` — assembles the full `Scene`: `body` from `kind.scene(...)`, `actions`
  from `kind.availableActions(...)`, `view` from `view(state, "player")` (Scene's bundled
  view has no audience parameter on `Engine.scene`, so it's hardcoded to `"player"` —
  matching `NewGameConfig.audience`'s own default).

### `serialize(state)` / `deserialize(data)` / `migrate(data)`

- `serialize` — `canonicalStringify(state)` from `persistence/canonical.ts`, unchanged.
  This is the function the determinism harness (W18) golden-files.
- `deserialize` — `JSON.parse` (via `canonical.ts`'s `deserialize<T>`, wrapped in
  try/catch for parse errors) then a hand-written structural check — no schema library;
  the package has zero runtime dependencies and stays that way. Checks: all required
  `GameState` fields present with the right primitive type, `kindId` is one of the three
  literal `KindId` values, `status` is one of the three literal `GameStatus` values,
  `actionLog` is an array of objects each shaped like `LoggedAction`. `kindState` is
  accepted as any present value (`unknown` to the core by design — §2). Any failure:
  `{ ok:false, errors:[{ code:"invalid_state", messageKey:"core.reason.invalid_state" }], warnings:[] }`.
  Success: `{ ok:true, value:<the state>, errors:[], warnings:[] }`.
- `migrate` — `return this.deserialize(data)` (Decision 5). One line, with a comment
  pointing at `MVP.md` §4 and noting the real mechanism isn't built.

---

## Test Plan

New file `kernel/engine.test.ts`. No shared/exported test-kind module — a local
`makeTestKind(overrides?)` factory defined in the test file, matching the
self-contained style of `canonical.test.ts`/`pcg32.test.ts`. It implements `Kind<TestKindState>`
with a trivial state shape (`{ counter: number }`), an `advance` that:
  - returns `AdvanceResult` with `status:"active"` and `counter + 1` for a known
    `actionId: "increment"`,
  - returns `AdvanceResult` with `status:"ended"` for `actionId: "end"`,
  - returns `error: { code:"unknown_action", messageKey:"core.reason.unknown_action" }` for
    anything else,
so every branch in `submitAction` has a real (if minimal) kind to exercise it against —
the actual story-graph kind doesn't exist until W9.

Mapped to TODO's done-criteria, each gets at least one test:

- [ ] A successful action appends exactly one monotonic `LoggedAction` (`seq` 0, 1, 2, ...
      across repeated calls).
- [ ] A rejected action (`actionId: "nope"`) leaves `serialize(state)` byte-identical
      before/after, and `actionLog` unchanged.
- [ ] Every `Engine` operation returns a new envelope object; the input `state` passed in
      is never mutated (assert with a frozen/deep-cloned input, or reference inequality
      plus a deep-equal against a pre-call clone).
- [ ] `deserialize` rejects: truncated JSON, valid JSON missing a required field, valid
      JSON with `kindId: "not-a-real-kind"`, valid JSON with `status: "paused"` — each
      returns `ok:false` with `invalid_state`, never throws, never casts.
- [ ] Unknown kind: `createGame` against a campaign whose `kindId` isn't in the `kinds` map
      passed to `createEngine` → `unknown_kind`. Separately, `submitAction` given a
      hand-built `GameState` with a foreign `kindId` → `unknown_kind` (the defensive path).
- [ ] Unknown campaign: `createGame({ campaignId: "does-not-exist" })` → `unknown_campaign`.
- [ ] Ended session: `submitAction` on a `state` with `status: "ended"` → `session_ended`,
      kind's `advance` never called (assert via a spy/counter on the test kind).
- [ ] Unknown action: `submitAction(state, "totally-unrecognized")` → the test kind's
      `unknown_action` error surfaces through `ActionResult.errors`.
- [ ] `createGame` on a kind that settles at start (`initialState` returning `status:
      "ended"`) produces a `GameState` with `status: "ended"` and an empty `actionLog`.
- [ ] `scene`/`availableActions`/`view` each call the kind with a `KindContext` whose `seq`
      equals `state.actionLog.length` and whose `rng` is independent of the `action`
      stream at the same seq (assert the two streams draw different values from a kind
      stub that draws from `ctx.rng`).

`composition/defaults.test.ts`: `defaultIdSource.newGameId()` and `.newSeed()` each return
a non-empty string, and two consecutive calls differ (birthday-bound sanity check, not a
uniqueness proof).

---

## Explicit Non-Goals

- No real `Emitter`/sinks/ordinals — W3a.
- No story-graph `Kind` implementation — W9–W14. Tests use the local stub above.
- No `ContentRegistry`/authoring builder — W4. Tests hand-construct a minimal
  `ContentRegistry` literal (a `Map` with one or two campaign entries) rather than going
  through a builder that doesn't exist yet.
- No real migration — Decision 5.
- No `SessionStore` — W7. `Engine` is the pure, stateless layer only.
- No change to any committed `types.ts` — this unit implements, it doesn't redesign.

## Suggested Commit Breakdown

1. `composition/defaults.ts` + test — small, independent, unblocks nothing else but is
   trivial to land first.
2. `kernel/reasons.ts` — add the three codes (Decision 2), if confirmed.
3. `kernel/engine.ts` + `engine.test.ts` — the unit itself.
4. Doc edit to `04-core.md` §4 (Decision 1) and `TODO.md` (tick W3, note the `migrate`
   gap per Decision 5) — same PR or a fast-follow, your call.

Stopping here. This is a plan, not a change — nothing above has been implemented.
