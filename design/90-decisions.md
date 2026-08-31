# Decisions

> Canonical decision and open-item register for the agent-kit workflow. Settled architectural
> decisions are recorded in `10-design.md`; this file owns their indexed resolution history,
> deferred items, and judgement calls that may need revisiting.

## Open

Open work remains indexed in the embedded register below. `/track` must not duplicate items that
already name their owning plan, specification section, or GitHub issue.

<!-- human-doc:start path="engine/OPEN-QUESTIONS.md" -->
---
sidebar_label: Open Questions
slug: open-questions
---

# Open Questions & Known Concerns

**Document status:** Living register. Captures unknowns, gaps, and deferred decisions so
they are *planned, not rediscovered as bugs* — the project's working convention.

> **Scope.** A single place to see what is *not* settled. Full entries for concerns first
> surfaced here; pointers for items that already live in another doc — this register
> **indexes, it does not duplicate** (duplication is itself a drift surface).
>
> - The finalized MVP contracts: [`03-story-graph-kind.md`](03-story-graph-kind.md) ·
>   [`04-core.md`](04-core.md)
> - The task list: [`TODO.md`](TODO.md) · the MVP target: [`MVP.md`](MVP.md)

---

## 1. MVP-Relevant Gaps — All Resolved

Every gap that blocked the story-graph MVP has been decided and written into the
contracts. Kept here as a **decision log**: what the question was, what won, and where the
answer now lives — so a later reader finds the reasoning without re-opening the argument.

| # | The gap | Resolved as | Lives in |
|---|---|---|---|
| 1.1 | `PlayerProfile` was defined only in the simulation kind, but the MVP DoD requires cross-session achievements | A **`ProfileStore` beside the session store**. `profileId` on `CreateSessionConfig`, never on `NewGameConfig` or `GameState`; records keyed `campaignId + achievementId`; the store upserts *after* a successful action; no `profileId` → anonymous, no read or write; missing/corrupt loads empty with a warning; a failed write never rolls back the game action | [`04-core.md`](04-core.md) §7.1 · [`03`](03-story-graph-kind.md) §7 |
| 1.2 | Base reason codes had no player-facing strings | The **core ships default-English messages** under a reserved `core.reason.*` namespace. Registry merge **rejects overrides** — a campaign cannot restyle an engine-level error. Validation fails if any registered code lacks a message | [`04-core.md`](04-core.md) §12 |
| 1.3 | The authoring → registry build step was prose, not a type | A **typed source/runtime split**: `AuthoredText`, per-kind `…CampaignSource`, a pure builder returning `BuiltCampaign`. Parsing and file I/O live in an outer adapter. One locale (English) for the MVP | [`04-core.md`](04-core.md) §10.1 · [`03`](03-story-graph-kind.md) §1 |
| 1.4 | Could a campaign settle straight to an ending at turn 0? | **Valid**, and it plays. Validation emits a Tier 2 `no_reachable_choice` — warns the author without banning vignettes or single-scene fixtures | [`04-core.md`](04-core.md) §11 · [`03`](03-story-graph-kind.md) §11 |
| 1.5 | `Kind.initialState` returned a bare `KState`, so a start that settled to an ending was recorded `active` | `initialState` returns **`InitialStateResult<KState>`** — `AdvanceResult` minus `error`, since a pre-validated campaign cannot fail to start. The core takes `status` from it and never inspects `kindState` | [`04-core.md`](04-core.md) §3, §4 |
| 1.6 | `params` were written to the replay log but never handed to the kind | **`Kind.advance` receives `params`.** The story-graph kind declares none and rejects a non-empty object with `unexpected_params` — never silently ignored | [`04-core.md`](04-core.md) §3 · [`03`](03-story-graph-kind.md) §8.2 |
| 1.7 | The story-graph kind declared no reason codes, and hidden-choice rejection was undefined | Three added codes (`not_a_choice_node`, `unexpected_params`, `settle_guard_tripped`) plus base reuse. **A `showWhen`-hidden choice returns `unknown_action`** — identical to a nonexistent id, so a probing client cannot confirm a secret path exists | [`03`](03-story-graph-kind.md) §8.3 |
| 1.8 | `GameState.formatVersion` and `SaveEnvelope.saveFormatVersion` both versioned "the format" | **Both kept, distinction documented.** `Engine.serialize`/`deserialize` round-trip a bare envelope with no wrapper — the golden files compare exactly that string — so the envelope needs its own stamp | [`04-core.md`](04-core.md) §2, §10.2 |

> **Nothing MVP-blocking is currently open.** When the next gap appears, add it here as a
> full entry, and move it into this table once decided.

## 2. Deferred by Decision — Post-MVP (Indexed; Live Elsewhere)

Settled as out of MVP scope. Listed so they resurface deliberately, not by accident.

- **The engine package published *public*, and the plans specify private — tracked as
  [issue #302](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/302).**
- **Provisional simulation numbers** — drift rates, scenario economics, `demandBand`
  thresholds, housing-quality formula, travel costs. Need a balancing pass once the sim
  harness runs. Tracked as [issue #267](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/267).
- **`end_week`'s `plan_empty` gate is declared but not wired — W50.4.** §10 names
  `plan_empty` for "`end_week` with nothing planned, where the campaign forbids it," and
  `availableActions` (`src/engine/src/kinds/simulation/available.ts`) always returns
  `end_week` with `available: true`. `SimulationCampaign` declares no toggle to condition a
  disablement branch on, and `stable-life` never forbids an empty plan, so wiring the gate
  now would be dead code exercised by no scenario. **Revisit when** a campaign actually
  needs to forbid an empty-plan `end_week` — the natural home is a new
  `SimulationCampaign`/`ScenarioDefinition` field, decided against that concrete need.
- **`packages/` vs `src/engine/` naming, and companion delivery — decided for W41.** The
  simulation docs (`games/05-text-client.md` header, `games/04` §20) describe an
  aspirational `packages/` monorepo; the built package is `src/engine/`
  ([Engine Package](/docs/guide/engine-package)). Keep the built layout. W41 in
  [`plans/39`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md)
  makes it a private GitHub Packages npm artefact named
  `@the-running-dev/game-engine`, with one root export, declarations, exact semver
  consumption and a packed-tarball consumer smoke test. A sibling `file:` link is allowed
  only as local convenience, never CI or release evidence; Git dependencies are rejected
  because they expose repository layout and build side effects as the delivery contract.
  **Revisit when** a second independently versioned package actually exists and makes a
  monorepo/workspace layout useful rather than aspirational.
- **`packVersion` is duplicated per pack file, not shared engine code.** The 2026-08-18 W71
  decision above makes a pack's `version` a content digest rather than a hand-written number,
  but the function that computes it (`packVersion` in
  `src/engine/src/campaigns/stable-life-packs.ts`) is local and unexported — each pack file
  must call its own copy, and `ContentPack.version` stays a plain `string` the type system
  does not check (`10-design.md` §6). The guarantee the decision was meant to
  make self-enforcing is currently enforced by convention again, one level down. W79's
  `campaignContentDigest` (`src/engine/scripts/diff-resolution.ts`) is now a second,
  independent copy of the same idea — a canonical digest over a campaign's content fields
  excluding the ones stamped after the fact — with its own field list (it excludes
  `campaign.version`, which `packVersion` includes, since W79 diffs already-resolved
  campaigns whose `version` is the resolution stamp itself). **Revisit when** a second pack
  is authored outside `stable-life-packs.ts` — that is the concrete case for promoting
  `packVersion` to an exported engine helper that both call, rather than doing it
  speculatively ahead of a second caller.
- **`history` in the simulation kind's state** — the upstream model carries
  `history: HistoryEntry[]`, a narrative record of what happened. That overlaps
  `StateChange[]`, which `advance` already returns (04 §12), and the event stream
  ([`05-observability.md`](05-observability.md)). Three records of the same events is the
  duplication rule [`10-simulation-kind.md`](10-simulation-kind.md) §2 exists to prevent, so
  `history` is **not adopted** until it is established what it holds that `StateChange` does
  not — most likely player-facing narrative framing, which would make it a projection
  concern rather than state. **Revisit when** the simulation kind's field detail is ported
  (10 §15). The same question arises for `world-graph`, which declines `history`
  on identical grounds ([`12-world-graph-kind.md`](12-world-graph-kind.md)
  §3) — resolve both together or not at all.
- **`world-graph`'s three evaluated-but-unstored guest opinions.** The game design has guests
  evaluate ten factors; `GuestOpinions` ([`12-world-graph-kind.md`](12-world-graph-kind.md)
  §3.2) stores **seven**. *Staff behaviour*, *accessibility* and *noise* are treated as
  evaluation inputs the utility model reads from world state at decision time (§3.3), not as
  impressions a guest carries between decisions — a guest can weigh noise without storing a
  `noise` opinion. **Revisit when** W44's utility model names a system that *writes* one of
  the three between ticks. That is the condition that would make it state; until one exists,
  a field no system writes, no reason code reads and no projection carries is not state, and
  adding it to `serialize()` output is how the `rng` and `totalTimeCost` defects happened.
  The same test retires the condition vocabulary (drunkenness, sunburn, confusion and the
  rest) to content: each is an evaluation input or a within-batch transient.
- **`ticksPerDay`'s value is Sun Trap's, and only its value.** The "today" accumulator
  boundary is `floor(tick / ticksPerDay)` (§3.3), a pure function of `tick` and campaign
  data, so the rule needed no answer from the game. **Revisit when** the companion confirms
  the number — which changes balance and no contract. Two other gates once filed here as
  blocking are settled in the contract itself: rotation declares all four values and Tier 1
  narrows it, and `Building.entrances` left runtime state as a derived value, leaving only
  the *authored offset shape* open — and that is W43's, where a `BuildingDefinition` exists
  to hold it.
- **`ChainScope`'s `"profile"` value has nowhere to persist** — a `"profile"`-scoped event
  chain (10 §2.2) is meant to survive past the game it started in and advance on cumulative
  weeks played across every game under one profile, but the only cross-game store this
  platform has is `PlayerProfile` (04 §7.1: `{ formatVersion, profileId, achievements }`),
  which has no field for arbitrary kind-declared profile-scoped data. Found while porting
  `WorldState` (10 §2.2, the field-detail port `plans/36-simulation-kind-programme.md`
  proposed as W27 and cut as **W32**). Tracked as
  [issue #268](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/268).
- **The hosted MCP contract still needs its W48 mirror.** The engine-side contract and façade
  now expose ten operations, including `preview_action`, but SubZeroDev.Platform's
  `mcp-tool-contract.md` still lists the original nine. The engine repository cannot make a
  companion-repository edit in the same commit. Tracked as
  [issue #269](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/269).
- **A shared simulation substrate for tick-driven kinds** — `simulation` and
  `world-graph` are the same archetype: mutate pending configuration, then resolve
  a block of simulated time through an ordered system pipeline (12 §2). Both hand-roll that
  pipeline, and it is where determinism defects concentrate — the two-phase time ordering in
  10 §3 is exactly the class of bug a shared, tested runner would stop recurring per kind. A
  `SystemPipeline` in the core (ordered registration, deterministic per-system stream keying,
  stable iteration, derived entity ids) would make kind N+1 cheaper. **Not extracted while
  `simulation` was the only tick-driven kind; `world-graph` (W41–W49) now makes it two.**
  Tracked as [issue #270](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/270).
- **Third-party kinds, and the sandbox they would require** — architecture §1 **N2**
  rejected downloadable code kinds as a security and reproducibility hazard, and
  [`06-extensibility.md`](06-extensibility.md) §7 leaves that standing. It is a rejected
  *mechanism*, not a closed question: a WASM host with a deterministic ABI — no clock, no
  ambient float nondeterminism, fuel-metered — could satisfy 06 §2's rule. **Revisit when**
  there is a concrete demand for kinds the engine team did not write; the conventions in
  06 §8 are chosen so that revisiting costs no rework.
- **Observability beyond the event channel** — the OpenTelemetry exporter, sampling, and
  inbound trace-context propagation; metrics as a channel separate from events; per-kind
  log-level configuration; author-facing presentation of `kind.story-graph.*` events. The
  event contract itself is MVP scope and specified; these four are deliberately not
  ([`05-observability.md`](05-observability.md) §13). The first belongs with the hosting
  layer, which is itself deferred (MVP §4).
- **Doc-tree numbering merge — closed.** The engine specs and the game specs both start at
  `01-`, which was a live problem only while they shared one tree. They no longer do
  ([`02-architecture.md`](02-architecture.md) §12: separate repositories, separate
  Docusaurus sites, `games/…` citations are prose provenance rather than links). Confirmed
  nothing depends on a merged numbering: the engine specs never link into `games/…` as a
  route, and both of `docs/`'s link checks are `'throw'` (`agent.md`, *Two link checks*), so
  a real cross-repo link would already have failed the build if one existed. There is no
  merged numbering to collide, and none is coming — closing rather than leaving open.
- **`SessionHost` / `createSessionLayer` — closed, resolved exactly as this entry predicted.**
  The open question was that [`06-extensibility.md`](06-extensibility.md) §4 specified
  `createSessionLayer(host: SessionHost): SessionStore` over a `SessionHost` whose `sessions`
  field was itself typed `SessionStore` — which only reconciled if `sessions` meant a
  lower-level, storage-only port that the root wraps with stamping (05 §6.1) and
  profile-upsert (04 §7.1), a port `04-core.md` never named. That is now the built shape:
  `SessionPersistence` (04 §7.2) is the storage-only port, `SessionHost` carries it alongside
  `registry`, `clock` and `recordSink`, and `createSessionLayer` composes the core-owned store
  around it. **The deferral's trigger was wrong and worth remembering.** This entry said
  *revisit when a second `SessionStore` implementation is needed*; a second implementation was
  never wanted, and what forced the root was a host needing **durable records under the same
  store** — browser `localStorage` for W61's checkpoints. "Wait for a second instance of X"
  fails when the real demand is for a seam one level below X.
- **Enterprise's climax scene was already spent — resolved by building it (W30).**
  `games/bulgaria-adventure.md`'s arc table assigned `games/bulgaria.md`'s "Ultimate Bulgarian
  Reward" scene, and by extension its achievement, to Enterprise — but `bulgaria-bureaucracy.ts`
  had already consumed both verbatim as its own ending (`endingId: "ultimate_reward"`,
  achievement `it_builds_character`), a real W15 authoring decision the design doc never caught
  up to. Decided rather than deferred further: Enterprise gets **new** climax content (a
  `debt_cents` running stat replacing the accumulation half of the named exercise, one shared
  ending rather than a branch) and **no achievement** — the game's own Definition of Done needs
  only "at least one" across the whole game, already satisfied by Bureaucracy's, so Enterprise
  doesn't need its own to close the game's content requirement. Design proposed for sign-off
  before implementation, given inventing narrative content the source material doesn't supply
  is a bigger step than transcribing existing scenes. **Open remainder**: `games/bulgaria-
  adventure.md` itself still assigns "Ultimate Reward" and the achievement to Enterprise —
  that document lives in the companion `SubZeroDev.GameOfLife` repository, so correcting it is
  a follow-up there, same treatment as the Return finding below.
- **"Return seeds variables the other arcs read" isn't mechanically achievable — confirmed
  by building it (W28).** `games/bulgaria-adventure.md` says this of the Return arc, but every
  arc is built as its own standalone `Campaign` (confirmed by how Bureaucracy, Driving, and
  now Return are all wired: a self-contained `id`, its own `startNodeId`, no shared session).
  `story-graph`'s `Campaign` has no mechanism for one campaign's `kindState` to be read by
  another's — sessions are per-campaign (04 §7). `bulgaria-return.ts` was built standalone, with
  no variables at all, confirming the narrative-only reading rather than assuming it. **Open
  remainder**: `games/bulgaria-adventure.md` itself still claims the seeding property — that
  document lives in the companion `SubZeroDev.GameOfLife` repository, so correcting it is a
  follow-up there, out of scope for this repo. Nothing here blocks on it: arc build order was
  already safe regardless, and that has now been exercised three times over.
- **The replay-corpus test harness assuming one campaign per corpus directory — closed,
  resolved by prefix-filtering.** Filed after W22 built `bulgaria-bureaucracy.replay.test.ts`'s
  generic `readdirSync` scan of `fixtures/replay/` against only the Bureaucracy campaign's
  registry, before a second campaign existed to expose it. W40 hit exactly the predicted
  collision and fixed it by prefix-filtering both suites (`bureaucracy-`/`stable-life-`); W49
  and W67 followed the same per-kind prefix-filtering pattern rather than reopening the
  shared-vs-per-campaign design question. Tracked and closed `not_planned` as
  [issue #303](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/303) — the
  friction this entry named is resolved in practice, not merely worked around.

### Found by the first downstream host — SubZeroDev.Adventures

[SubZeroDev.Adventures](https://github.com/The-Running-Dev/SubZeroDev.Adventures) is the play
surface extracted from `/play/` ([`13-playable-web-demo.md`](13-playable-web-demo.md),
*Succeeded by SubZeroDev.Adventures*). It consumes this engine as a pinned submodule across a
repository boundary and adds a hosted API, Postgres persistence, and accounts. That makes it
the **first host to implement the ports against something other than a browser tab**, and eight
findings are what that exercise produced. They are recorded together because their shared
provenance is the evidence: each one is a place the contract held up in one host and bent in the
second.

**None of these was found by review.** They were found by building. That is worth stating,
because the standing bar in this register — *one built instance is not a pattern* — cuts both
ways: several of these clear it now, for the first time.

**Seven of the eight are issues, not bullets here.** This register indexes, it does not
duplicate, and each issue carries the *Done when* that a bullet had nowhere to put — so the
issue is the authority for those seven, not this section:

| Issue | Finding |
|---|---|
| [#276](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/276) | `SaveRecordStore.delete` has no caller anywhere |
| [#277](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/277) | No per-player save query, and two hosts have now invented one |
| [#278](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/278) | `VisibleStat` omits the declared range, so clients read `Campaign.content` to get it |
| [#279](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/279) | `listCampaigns()` is synchronous, so no remote store can implement it |
| [#280](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/280) | Reproducing a stored session's blob requires pinning `IdSource.newGameId` |
| [#281](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/281) | `SessionStore` has no concept of a caller, so authorization lives outside it |
| [#282](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/282) | `Kind.outcome` has no shape a host can read generically |

The eighth is kept in full because it is the only one that arrived with a working
implementation, and the caution attached to it is what a reader needs *before* copying that
implementation:

- **Session forking is built, and it bypasses the store.** Adventures replays a stored action
  log to an arbitrary `atSeq` and writes a new `StoredSessionRecord` straight to persistence,
  because no store operation covers it. This is
  [issue #266](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/266) with a
  working reference implementation — and a caution, since writing through the persistence port
  rather than the store leaves the store's in-memory session cache unaware of the new session.

One further item **was** a standing cross-repository hazard rather than an engine defect, and is
now resolved: **Adventures depended on `fromPortable` and the `Portable*` types** while
`src/engine/src/index.ts` marked them `// SPIKE: … not a contract export`, so a submodule bump
could legitimately break the downstream host. `6991e37` (0.6.0) graduated the format: that same
line now reads *"A real contract export"*, no `SPIKE` marker survives anywhere under
`src/engine/src/`, and §19 of `20-contract.md` states the surface. The dependency is sanctioned,
so the hazard is gone — kept rather than deleted because the fact that it was once unsanctioned
and was deliberately regularised is the reasoning a later reader of
[issue #285](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/285) will want. That
issue's premise no longer holds and it is `/track`'s to close.

**`incidents[].onStart`'s building-meter rule — closed by W84, not W47.** After W83, every
other effect list was accounted for: `products[].effects` and a building's `operation.effects`
defer as `service`, `scheduledChanges` and `policies[].whileActive` as `policy`, a
staff-resolved `onResolve` as `staff`, and a `wear` delta on `objectives.onCompleted`,
`failures.onTriggered`, or a duration-bearing `onResolve` is rejected (§9.2). `onStart` was
neither, and nothing misbehaved only because no system applied it yet — it was declared,
shape-validated, and dead. This entry named W47 as the unit that would make it live and own
the choice; the incidents family that actually did so is **W84**, and it resolved the
question this entry left open. `tick/pipeline.ts` calls `applyWorldEffects` on
`incidentDefinition.onStart` from exactly one site — system 16/17's roll, after system 14 has
already closed its broken-transition check for the tick — and `validate.ts`'s
`forbidUndeferrableWearDelta(entry.onStart, …)` extends the §9.2 rejection to it, with the
comment recording why: "onStart only ever runs from system 16's roll, always after system 14
closed its broken-transition check for the tick, so a wear delta there can never be seen
(W84)." No `start_incident` call site in systems 1 or 4 applies `onStart`, so the
legitimate-deferral reading was not the one built. The contract's own MVP worked example
(§13's litter incident) puts a `cleanliness` delta in `onStart`, not a `wear` one, so the
wear-only rule does not contradict it.

**Nothing checks *emitted → registered* for `StateChange.reason`, and it has now failed twice.**
`20-contract.md` §13 says so in its own words — a reason threaded through `EffectContext` is not
visible at any call site that also names a `visible` flag, so the usual audit (scan for `reason:`
beside `visible: true`) finds the direct codes and none of the indirect ones. That gap let five
world-graph codes go unregistered through three units and one reconciliation pass. W83's
`building_broken` was the second occurrence: it shipped as an eleventh `visible: true` audit code
against a table stating there were ten, with all six required checks green, and was caught by code
review rather than by any gate. The fix is a test that fails when a reason recorded with
`visible: true` is missing from the contract's audit table; it was scoped out of W83's review pass
as its own unit, because parsing a markdown table from a test is a new kind of coupling and wants
deciding on its own. Until it exists, the tables are kept correct by hand and this is the note
saying that is a manual control, not an enforced one.

**A deferred building-meter effect was marked `applied` before system 14 composed/clamped
it — closed by W95, not left as accepted.** `effects.ts`'s deferred branch still sets
`applied[index] = true` as soon as the local per-source delta is nonzero, not once the
final composed value actually differs from `previous` — unlike the non-deferred and
`guestMeters` branches, which wait for the clamped outcome — so `.applied` itself remains
technically premature for a deferred effect. Filed as
[issue #349](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/349), which
recorded three ways out: leave it; stop marking deferred meters applied at all (trades
over-reporting for under-reporting, not obviously better); or move the event emission into
system 14 alongside the composition. W95 took the third, narrower than first scoped: rather
than touching the shared `applyWorldEffects` interpreter seam across all six call sites, it
moved only the one thing that actually read `.applied` for a `building_meter_delta` effect —
`scenario` (system 1) now skips emitting for that kind entirely, and `cleanlinessWear`
(system 14) emits `kind.world-graph.scenario.effect.applied` itself, once, only when a
policy-sourced contribution's building/meter pair actually changed after the single clamp.
`effects.ts`'s `applied[index]` value for a deferred effect is therefore still not
meaningful on its own — it is only correct once combined with the caller no longer trusting
it for this kind. Revisit if a future caller reads `.applied` for a deferred
`building_meter_delta` directly, since it would reintroduce the same premature signal.

**`relationships` (`endOfWeek.ts`) is the simulation kind's only remaining end-of-week
stub, and W89 is the first thing able to observe that it stays one.** No weekly
relationship rule — decay, drift, or otherwise — is specified anywhere in
[`10-simulation-kind.md`](10-simulation-kind.md): §6.11 declares the state and §7.7 the
NPC, but nothing names what a week does to either, so the system can never emit anything
beyond `system.ran` (`resolvers.ts`'s own `socialize` is the only thing that moves a
`RelationshipState`, and only on the player's own action). W89's coverage
assertion (`long-horizon.replay.test.ts`) therefore reaches fourteen of the fifteen —
`relationships` is excluded by name rather than silently passed. Thirteen of those
fourteen are asserted over the two long runs together; `week_limit`, which neither long run
can reach without contradicting W89.2's two terminal paths, is the fourteenth and has its
own isolated test in the same file. **Revisit when** a weekly
relationship rule is actually specified; writing one is `/contract` work, not a slice's
(W56's own *Out of scope* already made this call once).

**`long-horizon-loss`'s `pendingEventResponses` grows unbounded across its own 160-week
run — a real instance of the exact defect shape W89 exists to be the first thing able to
see, found and deliberately not fixed here (W89's own *Out of scope*).** Nothing in
`endOfWeek.ts`'s `events` system (or anywhere else) expires a `PendingEventResponse` that
`respond_to_event` never answers; `long-horizon-loss`'s own weekly policy is deliberately
inactive (`long-horizon.ts`'s header explains why — the eviction-ladder arithmetic has to
stay exact), so it never answers one, and the collection grows from 0 to 37 entries over
the run. `long-horizon.replay.test.ts`'s own W89.6 assertion states this as an observed
ceiling for this fixture, not a claim of boundedness. **Revisit** by giving a
`PendingEventResponse` some expiry (an `expiresAtWeek`, mirroring `Opportunity`'s own
field) or an explicit "declined by default" resolution once its `presentWeek` has passed
by some stated margin — a real content/contract decision, not a slice-sized fix.
---

## 3. Judgement Calls to Revisit (Settled for the MVP)

Decided deliberately, each with a documented "revisit when." Listed here only as a pointer
so they are not forgotten.

- **Story-graph kind** — dropped the `string` variable type; no `unlock` consequence;
  `auto` vs a one-transition `random`; `SETTLE_STEPS` = 64; `visited` counts *every* entry.
  See [`03-story-graph-kind.md`](03-story-graph-kind.md) §13.
- **Core** — the `Condition` operator set is **frozen**; additions require a concrete
  campaign need. See [`04-core.md`](04-core.md) §18.
- **Core** — randomness is **derived, never carried**: streams are a pure function of
  `(seed, streamId)`, so `GameState` holds no generator state and the `StreamId` → string
  encoding is normative. Revisit only if a kind needs a generator that outlives one
  resolution. See [`04-core.md`](04-core.md) §8.
- **Story-graph** — `StoryGraphView` carries *only* what the generic `Scene` /
  `PlayerView` do not (turn, visible stats, achievements, ending); scene text and the
  choice list are the core's. Revisit if a client proves it needs a self-contained
  kind payload. See [`03-story-graph-kind.md`](03-story-graph-kind.md) §9.
- **Story-graph and simulation — `campaign.content as <KindCampaign>` remains unguarded.**
  `Campaign.content` is `unknown` by design (04 §2), and both older kinds read it via a bare
  `as` cast with no runtime shape check — `story-graph`'s `validate.ts`/`advance.ts`/
  `scene.ts`/`settle.ts`/`view.ts` and `simulation`'s `advance.ts`/`initial.ts`/
  `validate.ts` all do this identically. Malformed content (cross-version data, a hand-
  edited fixture) can throw during registry construction rather than surface as a
  structured `ValidationResult`, which is arguably not "total" per `validation/types.ts`'s
  own header comment. Flagged during W40's review (PR #102) against one file
  (`kinds/simulation/validate.ts`); declined there specifically because fixing one cast
  in isolation would have been inconsistent before a programme-owned revisit point existed.
  W45 establishes the convention for `world-graph`: its validator narrows the unknown root
  and malformed nested values into structured findings, then gameplay centralizes the
  validated-campaign assumption in one internal accessor. **Revisit when** story-graph or
  simulation next changes its content boundary; migrate that kind deliberately rather than
  turning W45 into an unrelated repo-wide rewrite.

- **W63 (Absurd Game Interface) — harnessed by W65; W63.7/W63.8 narrowed, not closed.** W63 was
  marked done on manual review at 320/390/768/1280 px because `site/` had no visual-regression
  or axe-style accessibility scanner and its tests ran in jsdom, which performs no layout at
  all — no computed size, hit area, or overflow could be asserted there. W65 stood up a real
  Chromium harness (`site/vitest.browser.config.ts`, the playwright browser provider) with
  committed self-tests proving each capability fails when the condition it checks is violated
  (`site/src/test/browser/assertions.browser.test.ts`), an axe-core scan across shelf,
  briefing, notice, playing, unavailable-choice, rejected, and ended
  (`site/src/play/browser/accessibility.browser.test.tsx`), and committed baseline snapshots for
  playing, unavailable-choice, persistence-warning, and ended at 320/390/768/1280 px
  (`site/src/play/browser/visual-baseline.browser.test.tsx`) — the pre-W66 baseline W66 must
  diff against. That is real infrastructure, but it does not fully cover what W63.7/W63.8
  actually ask for: the harness's own hit-area/gap/font/line-height assertions
  (`assertMinFontSize`/`assertMinLineHeight`/`assertMinHitArea`/`assertMinGap`) are self-tested
  against synthetic markup only, never applied to a real rendered `PlayApp` control; there is no
  ready-state visual snapshot alongside playing/unavailable-choice/persistence-warning/ended;
  and W63.8's keyboard-only, 200%-zoom, long-text, and missing-asset checks, plus forced-colours
  *application* behaviour (as opposed to the `matchMedia` signal alone), are not exercised at
  all. **Revisit when** a future slice drives those assertions and scenarios against the actual
  rendered UI; this entry stays open, narrowed to that remaining gap, rather than closed beside
  a harness that does not yet resolve it.

*Add to this register whenever a decision is deferred or an assumption is made — rather than
leaving it in a commit message or a chat, where the next person will not find it.*
<!-- human-doc:end -->

---

### 2026-08-04 — Kit catch-up install: adopted stable criterion ids and the human-first issue shape
Context: Installing/upgrading the agent kit to `dcd0d8f`. The kit's current `track.md`/`slices.md`/`slice.md` bundle two changes this repository had not adopted: stable per-criterion ids (`W<n>.<m>`) on slice acceptance criteria, and a human-first-narrative + `### Done when` + fenced `<!-- agent:start -->` shape for issues `/track` opens. This repository's ~140 already-merged W-units use neither.
Chosen: Adopt both, for new units only. Existing checked/delivered units are historical and are not retrofitted or reopened — `track.md` says so explicitly. The stable-id scheme is a natural extension of this repository's existing positional `W3a` unit numbering (never renumber, insert with a suffix instead), so the two conventions reinforce rather than compete.
Rejected: **Keep the older, simpler issue shape** — smaller diff, but leaves this repository permanently behind the kit's drift-detection mechanism (`/track` comparing criterion ids rather than prose), which is the reason the shape changed upstream. **Retrofit existing issues to the new shape** — rejected outright; the kit's own contract forbids rewriting a checkbox or narrative outside the fence, and 140 units is not worth the churn for a cosmetic uniformity gain.
Reversibility: cheap (only affects new issues going forward)

### 2026-08-04 — Adopted the kit's new agent.md lesson on flaky-test fixes
Context: The kit's seed gained "a fix that only changed the odds is not a fix" (intermittent failure traced to a stale connection-pool schema snapshot, found by a tight repro loop rather than trusting reduced test parallelism). This repository's `agent.md` is fully earned, not seeded, so per the installer a new kit lesson is offered individually rather than merged in bulk.
Chosen: Add it. Generic flaky-test lesson, not stack-specific, and `src/engine`'s vitest suite is exactly the kind of surface it applies to. The same lesson was independently approved for the sibling Blog repository minutes earlier, same reasoning.
Rejected: **Skip it** — not earned in this repository specifically; rejected because the lesson's generality outweighs that, same call made for Blog.
Reversibility: cheap

### 2026-08-04 — Kit upgrade to `8d4ffdb`: `/refine` and `/kit-help` overlaid rather than copied
Context: Upgrading the agent kit from `dcd0d8f` to `8d4ffdb`. Two new commands arrive written against the kit's own arrangement — they cite `AGENTS.md §` section names and use `S<n>` slice ids, neither of which is true here: `AGENTS.md` is a pointer to `CLAUDE.md`, and this repository retains the `W` prefix.
Chosen: Install both, and add a short repository-overlay paragraph at the top of each redirecting the citations to `CLAUDE.md` and the ids to `W`. Only the two id occurrences that would be *read as instructions* were rewritten inline (`/slice W<n>` in `/refine`'s routing table; the worked example and step 2–3 ids in `/kit-help`).
Rejected: **Mechanically replace every `AGENTS.md` reference with `CLAUDE.md`** — rejected because that is precisely the failure `AGENTS.md` itself documents: an earlier mechanical rewrite turned nine real references into paths that do not exist. An overlay note is checkable; a global substitution is not. **Skip the two commands** — rejected; `/kit-help` is the orientation entry point and `/refine` is the front door for asks between stages, and a repository missing both diverges from the kit for no stated reason.
Reversibility: cheap

### 2026-08-04 — `Measure-Session.ps1` installed at `tools/`, not `build/`
Context: The kit ships `tools/Measure-Session.ps1`, run as a `SessionEnd` hook, so that reported session costs are measured rather than estimated. This repository has no `tools/` directory and keeps its PowerShell scripts in `build/`, which would otherwise be the obvious home.
Chosen: Create `tools/` and install it there, matching the kit's hook path `${CLAUDE_PROJECT_DIR}/tools/Measure-Session.ps1`.
Rejected: **`build/Measure-Session.ps1`** — one home for PowerShell in this repository, and the naming matches. Rejected because `build/` is wired into the documentation gate and the Docusaurus build; a per-machine session-cost reporter is neither, and putting it there mixes a reporting helper into the repository's build surface. Reversing this costs one file move and two path edits (the hook, and the `CLAUDE.md` line naming it).
Reversibility: cheap

### 2026-08-04 — Adopted the kit's `SessionEnd` cost hook into the tracked `settings.json`
Context: `tools/Measure-Session.ps1` can only run from `hooks.SessionEnd`, which lives in `settings.json` — a file the installer otherwise treats as the target's own, because this repository's copy deliberately pins `model: opusplan` and `permissions.defaultMode: plan`.
Chosen: Add only the `hooks.SessionEnd` key, leaving `$schema`, `model` and `permissions` untouched. No `SessionEnd` hook existed to conflict with, and `pwsh` 7 is on `PATH`. `.claude/session-costs.tsv` is gitignored — it is per-machine and regenerable from the transcripts.
Rejected: **Install the script without the hook** — rejected because a reporting tool nothing invokes is a tool nobody runs; the rule it serves ("do not report a cost you did not measure") then has no mechanism behind it. **Merge the kit's whole `settings.json`** — rejected outright; it would overwrite the deliberate model and permission pins, which is the reason that file is off-limits in the first place.
Reversibility: cheap
### 2026-08-04 — Unattended kit upgrade to `9b8313c`: only the conflict-free gap items applied
Context: `/install-all` ran this repository non-interactively (no session available to answer a fork) against the four-commit gap since the recorded `8d4ffdb` install: `install-all.md` itself, one `AGENTS.md` routing row, a `Measure-Session.ps1` bugfix, and a kit-internal `90-decisions.md` entry that never installs into a target (only the heading, preamble, and `## Open` section do).
Chosen: Apply the three that had a stated deterministic resolution or no real alternative — `.claude/commands/install-all.md` created verbatim (it cites `INSTALL.md`'s own mechanics generically, not this repository's `AGENTS.md §`/`S<n>` scheme, so it needed no repository-overlay paragraph, unlike `/refine` and `/kit-help` at the `8d4ffdb` upgrade); `tools/Measure-Session.ps1` upgraded to the kit's fixed version (byte-identical to the `8d4ffdb` baseline beforehand, so this was a pure version-lag fix — the short-session-id guard and explicit `pwsh` invocation — not a target edit being overwritten); `CLAUDE.md`'s command-routing table gained the matching `/install-all` row kept at `sonnet`/`medium`. Left `.claude/commands/contract.md`, `design.md`, `kit-help.md`, `make-human-docs.md`, `pr.md`, `reconcile.md`, `redteam.md`, `refine.md`, `slice.md`, `slices.md`, and `track.md` untouched — each still carries the `8d4ffdb`-era repository-overlay paragraphs (§ citations routed to `CLAUDE.md`, `W<n>` ids), and `/install-all` treats any same-named command already present as a named fork with no default, never a diff to auto-merge, so these are recorded as needing a decision rather than silently overwritten or silently left stale.
Rejected: **Re-overlay the eleven customized commands against the current kit unattended** — the direction (kit content wins, repository ids and citations get an overlay paragraph) is established, but *which* kit-side wording changed since `8d4ffdb` is a per-file editorial judgment `INSTALL.md` never made deterministic, and guessing it across eleven files with no one to check the result is exactly what an unattended run must not do. **Treat `Measure-Session.ps1`'s divergence the same way (skip, needs a decision)** — rejected because there was no actual target edit in conflict; diffing against the recorded `8d4ffdb` baseline showed zero local drift, so upgrading it is the plain "re-install advances an unedited file" case the kit's own re-running policy describes, not a fork.
Reversibility: cheap — three small, independently revertible changes; nothing destructive, nothing staged or committed.

### 2026-08-04 — Kit catch-up install to `9b8313c`: `resolve.md`'s pagination and authorization fixes documented, not folded into the kit
Context: Diffing `.claude/commands/resolve.md` against the kit's current version during this install surfaced a real divergence with no decision-log entry. This repository's copy fetches review threads with `gh api graphql --paginate` and a cursor on both `reviewThreads` and each thread's `comments`, and states plainly that posting a reply or resolving a thread is an external write requiring authorization. The kit's copy still uses a single `first:100`/`first:10` page and softer "bring only the ambiguous ones" language. Unlike the eleven overlay commands, this is not a repository-specific citation/id rewrite — it is a functional fix, made locally in `a8aa714` ("Resolve agent-kit review findings") the same day the command was first installed verbatim in `0bb42b9`, in response to a PR review on this repository, not to the kit.
Chosen: Keep the local version and record why: a `first:100`/`first:10` page silently drops threads or comments past the page boundary on any PR large enough to matter — exactly the "appears nowhere in that listing" failure mode the command already warns about for `gh pr view` — and the authorization language matches this repository's own `AGENTS.md` rule that resolving or replying is an external write, not covered by the issue-opening carve-out.
Rejected: **Revert to the kit's plain version at this install** — rejected; it would reintroduce a known truncation bug and drop authorization gating this repository's own contract requires, to gain nothing but sameness with the kit. **Leave the gap undocumented** — rejected; per this repository's own install philosophy, an unexplained divergence gets rediscovered as a bug rather than recognized as a decision.
Reversibility: cheap — a future `/install` can still offer the kit's version explicitly if it later adopts the same fixes; nothing here forecloses that.

### 2026-08-04 — Kit upgrade to `9896915`: reconciled two parallel sessions' opposite calls on the same automation question, kept automation
Context: Two sessions upgraded the kit from `9b8313c` in parallel, on separate branches, each unaware of the other. One (merged first, as `#153`) upgraded to `92abff1` — the commit that automates `/slice` to branch, commit, push, and open its own draft PR, ticking `Done when` boxes itself — and adopted that policy in full, reasoning the maintainer had already answered the fork question for this install (adopt) and that splitting the git/PR half from the ticking half would leave `/track`'s auto-close relying on a signal this repository would not be producing. The other, on this branch, advanced four commits further to `9896915` (a `UserPromptSubmit` context-size warning hook, `Measure-Session.ps1` defaulting to JSON with `-Human` for the table plus a vendor-detection guard, and Pester CI for `tools/*.ps1`) and, not knowing `#153` had already merged the opposite call, recorded a decision to keep the pre-`92abff1` manual-gate workflow instead — leaving `slice.md`/`track.md`/`kit-help.md`'s workflow section and the `AGENTS.md` *Tracking work* carve-outs untouched.
Chosen: Keep `#153`'s automation — it is the merged, operative decision on `main`, and this branch's rejection of it was made in ignorance of that merge, not as a considered override of a live policy. Rebasing this branch onto `main` auto-merged `slice.md`/`track.md`/`pr.md`/`kit-help.md` cleanly from `main` (this branch's kit-upgrade commit never touched those four files, so there was no textual conflict, only the contradiction between the two decision-log entries and `kit.json`'s version pin). Pinned `kit.json` at `9896915` rather than rolling back to `92abff1`: it is a strict superset — the same automation, plus the four independent, non-conflicting fixes this branch's session added. Everything that session installed cleanly stands: the `UserPromptSubmit` hook in `.claude/settings.json`, `tools/Measure-Session.ps1`/`tools/Measure-Session.Tests.ps1`, `.github/workflows/verify.yml`, `install-all.md`'s two-hook wording, and the *Session boundaries*/*Budget discipline* `CLAUDE.md` additions.
Rejected: **Revert `main` to the manual-gate policy, undoing `#153`** — rejected; it would overturn a decision already accepted and merged by the maintainer, on the grounds of a rejection this branch's session reached without knowing that merge existed. **Roll `kit.json` back to `92abff1` instead of advancing to `9896915`** — rejected; nothing in the four later commits conflicts with automation, so there is no reason to leave the hook/measurement/CI fixes uninstalled just to match `#153`'s exact pin.
Reversibility: cheap — automation can still be revisited as its own decision later; nothing here is destructive, and the four independent fixes are each separately revertible.

### 2026-08-05 — Known-and-retained implementation gaps: `world-graph` tick systems
Context: `20-contract.md` §4.3–§4.22 specifies twenty tick systems in a fixed order, and §12's event table names emit sites in most of them. `src/engine/src/kinds/world-graph/tick/pipeline.ts` registers all twenty and runs them in that order — the ordering, the `processingTick` guard, and the "finalize exactly once" assertion are all real — but five of the twenty are not doing what the contract describes. Read against the source rather than against the delivery plans, the state is: `construction` (system 12), `buildings` (system 13) and `alerts` (system 19) are `(frame) => frame`, fully no-op; `cleanliness-wear` (system 14) implements one delta source only, the unresolved-incident litter penalty against `Building.cleanliness`, and none of the other documented sources, and never touches `wear` at all despite the system's name; `incidents` (system 16) resolves incidents whose `expiresAtTick` has passed and applies their `onResolve` effects, but never *rolls* a new incident, so the only incidents that exist are the ones `guest-service` creates from product litter. Everything else in the pipeline is genuine, including `finance`'s exact proration (§9.4), the objectives/failure terminal-identity logic, and `tick-finalize`'s cleanup.
Chosen: Record the five as known-and-retained, named individually, rather than softening §4's system descriptions or deleting the undelivered rows from §12's event table. The contract describes the target and is the reason a later unit knows what to build; this register is where "is it built?" is answered. §12's event rows are now marked *specified, not yet delivered* and point here, which was the same treatment `story-graph` §8.4 took at the time for its own six then-undelivered events (all six landed with W86). Naming the partial ones precisely matters more than the fully-stubbed ones: a system that returns `frame` unchanged is obvious in one line of source, whereas `cleanliness-wear` looks implemented and is the one most likely to be mistaken for complete.
Rejected: **Rewrite §4.12–§4.21 to describe only what runs today** — rejected; it would destroy the specification that the remaining units build against, and the world-graph contract's whole value is that the tick pipeline was specified in full before it was built (that is what `12-world-graph-kind.md` §5's batch invariance argument depends on). **Leave the gaps recorded only in the delivery plans (`plans/46`, `plans/48`)** — rejected; a plan documents one unit's scope at the moment it was written, and nobody re-reads a merged plan to answer "does this system work?". **Track them as GitHub issues instead of here** — not rejected so much as downstream: `/track` reads `design/30-slices.md`, and this register is the input that lets a work unit be written against a real gap. Revisit when: each system's own build unit lands, at which point its row moves out of this entry rather than the entry being edited in place.
Reversibility: cheap — documentation only; no code or contract behaviour changes.
**Amended 2026-08-20 by W81.** `construction` (system 12) is real as of this unit and leaves the list below. Re-reading systems 9 and 11 against the source while slicing W81 found the register incomplete rather than wrong: `task-generate` (system 9) and `staff-work` (system 11) were never on this list — both looked complete because every other documented task kind they touch (`clean`, `service`) was wired — but `StaffTaskType` and the `task-assign` comparator have always included `build` and `restock` as options neither system ever produced or applied. **The gap is seven systems, not five.** W81 wired the `build` half of both (a construction-site candidate in system 9, and status marking in system 11, with the effort application and completion itself living in system 12); the `restock` half is still missing and is W82's scope. `buildings` (system 13) and `alerts` (system 19) remain fully no-op; `cleanliness-wear` (14) and `incidents` (16) are unchanged from the description above.
**Amended again 2026-08-20 by W82.** The `restock` half W81 left open is wired: `task-generate` (system 9) now generates a restock candidate per below-capacity product, `staff-work` (system 11) marks a restocker's task `in_progress` on arrival — mirroring how it already treats `build` — and `buildings` (system 13) applies the assigned restocker's effort to finite inventory, clamped once at each product's capacity, and completes the task. `buildings` is real as of this unit and leaves the list below. `task-generate` and `staff-work` are now fully wired for every documented task kind (`service`, `clean`, `restock`, `build`) and leave this register entirely. **Three systems remain**: `alerts` (19) is fully no-op; `cleanliness-wear` (14) and `incidents` (16) are unchanged from the 2026-08-05 description.
**Amended again 2026-08-20 by W83.** `cleanliness-wear` (system 14) is real as of this unit for four of its five documented sources: `service` (deferred from system 4), `staff` (deferred from system 11, including cleaning's `onResolve` recovery), `policy` (deferred from system 1), and `litter` (ambient, computed here from unresolved litter-kind incidents) now compose in one sum per building/meter and clamp once, per §9's "systems 1, 4, and 11 explicitly defer building-meter deltas to system 14" rule; wear now moves and a zero-wear open or closed building becomes `broken`. The contract's third ordered slot, `incident`, has no independent mechanism the contract or the source distinguishes from `staff`'s deferred `onResolve` effect (see the `AskUserQuestion` resolution this unit's session recorded) and is left a no-op placeholder in the source's own comment — a future unit that gives it real content should also correct this entry rather than leaving both stale. **Two systems remain**: `alerts` (19) is fully no-op; `incidents` (16) is unchanged from the 2026-08-05 description.
**Amended again 2026-08-21 by W84.** `incidents` (system 16) is real as of this unit: it resolves due/condition-met occurrences as before, and now also rolls new ones by declared scope (world/zone/building), each definition's own trigger condition, roll chance, and selection weight, blocked by an active or still-cooling-down occurrence of the same definition at the same scope instance, using a per-call `tickRng("incidents")` handle so a split batch stays byte-identical to the whole one (§4.18, §5). `incidents` leaves the list below. **One system remains**: `alerts` (19), fully no-op.
**Amended again 2026-08-21 by W85, closing this entry.** `alerts` (system 19) is real as of this unit: still-locked achievements are evaluated by definition id against the post-resolution state first, with an unlock writing `unlockedAchievementIds.<id>.exists` under the core `achievement_unlocked` reason; then the three closed alert families — active incident, broken building, and scenario resolved — derive from the current tick's own source set, keyed on published ids only, raising a new alert only for a semantic key no uncleared alert already represents and marking a no-longer-active source's alert cleared. `alerts` leaves the list below. **Zero systems remain — every row this entry ever named is now real, and it needs no further amendment.**
Reversibility: cheap — documentation only.

### 2026-08-05 — Known-and-retained implementation gaps: `simulation` end-of-week systems
Context: `20-contract.md` §3 fixes the end-of-week systems in a normative order (fourteen at the time of writing; fifteen since W57 inserted `week_limit`), and §15 claims the contract's shape is whole. `src/engine/src/kinds/simulation/endOfWeek.ts` runs all fourteen in exactly that order and emits `kind.simulation.system.ran` for each, so the ordering property §3 exists to fix is genuinely delivered and genuinely tested. **Five of the fourteen bodies return their input unchanged: `inventory`, `relationships`, `events`, `headline`, `achievements`.** The other nine are real: `needs` (weekly drift with a single clamp and one `StateChange` per touched need, against provisional rates), `opportunities` (expiry only — revoke and offer are stubbed), `goals` and `failure` (full condition evaluation, `consecutiveWeeksSatisfied` accounting, and the `goalFailurePrecedence` tie-break), `employment`/`financeIncome`/`housing` (W53 — application resolution and hiring, performance drift and uncontested promotion, wage and overtime payment, unconditional rent levy), `education` (W54 — weekly enrollment advance, attendance accounting, the `CourseFailureRules` pass/fail decision, skill and credential awards), and `financeReconcile` (W55 — late fee, arrears, and one-rung eviction advancement). Each remaining stub carries a doc comment naming what it needs, and all five are blocked on content definition types the "Stable Life" slice deliberately did not wire.
**Amended 2026-08-08 by reconciliation.** This entry originally named *ten* stubs; W53, W54 and W55 turned five of them into real logic and none of the three updated it. Because `20-contract.md` §15 deliberately keeps no second copy and points readers here for "is this built?", the stale list was the single most misleading statement in the design — five shipped systems reported as no-ops. The list above was re-derived from source, not from the delivery plans. The standing obligation this creates: **a slice that turns a stub into real logic edits this entry in the same PR.**
**Amended again 2026-08-10 by reconciliation, and the obligation above did not hold.** Two units since — W56 (possessions, places and people) and W57 (events, opportunities, headlines, achievements) — turned four more of the five into real logic and neither edited this entry. Re-derived from source again: **`relationships` is the only remaining stub**, still `(state) => state`. `inventory` runs per-item maintenance decay against `MaintenanceRule.intervalWeeks` and emits `item_condition_decayed`; `events` fires scheduled events unconditionally, then rolls weighted eligible ones, queues `PendingEventResponse`s, and moves `strangenessBase`; `headline` filters by derived strangeness and draws from `HeadlinePoolState`; `achievements` evaluates conditions against flags written earlier in the same pass. `opportunities` is no longer "expiry only" either — it revokes, expires and offers, in §2.3's stated order. W57 additionally inserted a fifteenth system, `week_limit`, which is real from the moment it landed.
**A stronger sentence is not the fix, and this is the second piece of evidence for that.** The 2026-08-08 amendment wrote the obligation into the entry and two slices walked past it. This has the same shape as the *emitted → registered* gap `20-contract.md` §10 records — a rule with no gate, checked only when someone compares the two sets by hand. Naming it here rather than restating the obligation a third time, because the third time would be the padding.
Chosen: Record the remaining stubs by name here, and narrow §15's claim in the contract to say explicitly that "the shape is whole" is a statement about types and specification, not about implementation — pointing here for the current list rather than restating it. The stubs stay stubs: they are correct as stubs, because a system that runs in order and does nothing is materially different from a system that is absent, and §3's ordering guarantee is exactly what the empty bodies preserve. `history` is *not* on this list and must not be added to it — it is unadopted state (§2), so having no system is the correct behaviour, not a gap.
Rejected: **Delete the stub functions and shorten the pipeline to the real systems** — rejected; it would silently change the `system.ran` event stream that §11 says is the ordering regression detector, and re-inserting a system later would then be a behavioural change rather than filling in a body. **Restate the list inside §15 itself** — rejected on this repository's single-ownership rule; two copies of a list that changes every time a system lands is a guaranteed drift surface, and the copy that goes stale is always the one in the document nobody edits when code merges. (The 2026-08-08 amendment above is evidence for the rule, not against it: one copy went stale, and one copy was all that had to be fixed.) **Treat the remaining five as a defect rather than a retained gap** — rejected; they are the documented, deliberate scope boundary of the vertical slice, not an oversight. Revisit when: each system's content definition type is wired, one system at a time.
Reversibility: cheap — documentation only.

### 2026-08-05 — Experiments and content-pack seams: deferred, not forgotten
Context: Three specified seams have no implementation and no current consumer. `SessionHost.experiments` and the `ExperimentSource` port (`10-design.md` §4, §5.5) are named as a host-supplied port; `EmittedRecord.experiments` is the field that would carry an assignment out through the observability boundary; `ContentRegistry.resolution` is the pack-resolution record that `11-content-packs.md` makes `campaignVersion` a digest of. All three are post-MVP by the same dependency: they only mean anything once an ordered pack set can be resolved, and content packs are themselves post-MVP.
**Amended 2026-08-08 by W59.** The revisit condition below fired: content-pack work started, and W58 and W59 built two of the three. `ContentRegistry.resolution` is real (`registry/packs.ts` `computeResolutionId`), and so are `ExperimentSource`, `applyExperimentGates`, `resolveBucketKey` and `resolveExperimentAssignments` — all now exported from `src/engine/src/index.ts`, because `10-design.md` §5.5 puts the composition they serve (one registry per distinct assignment combination, one `Engine` per registry) *above* the session seam, and a host that cannot name them cannot do the job the design assigns it. **`EmittedRecord.experiments` is the one that did not get built, and the reason is a contract tension worth naming rather than a missed edit.** §5.5 places pack resolution host-side, above `createSessionLayer`; `05-observability.md` §6 has the session store stamping the assignment map onto every record. The store receives an already-resolved `ContentRegistry`, never the candidate pack array, so it has no way to derive the `experimentId` set that map is keyed by — which leaves `SessionHost.experiments` declared, exported, and read by nothing. Either the field carries a resolved assignment map rather than the port, or the store gains the candidate packs; both change `10-design.md` §4. **Retained knowingly, not overlooked:** W59's done-when criteria are all met without it, and picking one side inside an implementation PR would settle a public seam by accident. Revisit when: the first consumer needs an event attributed to a variant — that is the moment the tension has to be resolved rather than recorded.

**Amended 2026-08-26 by contract normalization.** The tension is resolved in favour of the already-resolved map. `SessionHost.experiments` is `Readonly<Record<string, string>>`: the host uses `ExperimentSource` while it still owns the candidate packs, removes `null` (not-enrolled) assignments, selects the registry and matching engine, then supplies the narrowed map to the session layer solely for stamping `EmittedRecord.experiments`. Candidate packs do not cross the seam. That alternative was rejected because the layer already receives a fixed `Engine` and `ContentRegistry`; giving it unresolved packs would make it responsible for selecting replacements for both, widen the composition root, and duplicate the host-side resolution §5.5 already assigns. Keeping `ExperimentSource` in the field was also rejected because the layer cannot discover which experiment ids to ask it about without those packs. The port remains exported and unchanged; only where its result crosses the seam is settled.

Chosen initially: Record all three explicitly as deferred, in one entry, so they read as a decision rather than as three separate oversights someone rediscovers by grepping the design for types with no implementation. The 2026-08-26 amendment resolves the public seam but does not claim the record-stamping implementation exists; the specification still makes that remaining deferral safe. `06-extensibility.md` §6's rule governs it: an experiment assignment can never reach resolution, and that constraint is worth having written down before anyone builds against it rather than after.
Rejected: **Delete the three from the design until they are built** — rejected; `ContentRegistry.resolution` in particular exists to answer a question the envelope otherwise cannot ("two players on the same campaign version with different packs are playing different games"), and removing it loses the reasoning, not just the field. **Fold them into the existing §2 deferred-by-decision register in this file** — rejected only because that register indexes items that live elsewhere, and these three currently have no owning revisit condition recorded anywhere; once one does, it belongs there. Revisit when: content-pack work starts, which is the first moment any of the three has a real consumer.
Reversibility: moderate — the field is public TypeScript surface, although no shipped code reads it. Reversing to candidate packs would also require an engine/registry selection mechanism inside the session layer, not just another type edit.

### 2026-08-05 — Two registry-build entry points, one of which validates
Context: `buildContentRegistry` (`src/engine/src/core/registry/build.ts`) assembles and freezes a `ContentRegistry` from already-built campaigns: it rejects duplicate campaign ids and writes into the protected `core.reason.*` namespace, merges core, kind and campaign strings, and freezes both maps. It does not run Tier 1 or Tier 2 validation. `buildValidatedContentRegistry` (`src/engine/src/core/validation/tiered.ts`) is the sanctioned path: it runs the core-owned Tier 1 checks and each campaign's `Kind.validateCampaign`, checks every used kind's `reasonMessages` for completeness, and only then delegates to `buildContentRegistry` — so "an unvalidated registry can never be frozen" holds by construction for anyone entering through it. Both are exported from the package.
Chosen: Keep both public, with the split as it stands, and record it as a deliberate API shape rather than leaving it to be inferred from two similarly named exports. The lower-level primitive earns its place: it is what the validating path delegates to, it is independently testable without a `KindRegistry`, and collapsing the two would put validation inside the assembly step, where a caller who has already validated cannot skip it. The named risk is real and is the reason this is written down: **nothing stops a consumer from calling `buildContentRegistry` directly and freezing an unvalidated registry**, and the engine downstream of that point assumes a pre-validated registry throughout (every kind reads `Campaign.content` through an unguarded cast — see this file's own §3 entry on that). The type system does not distinguish the two results; only the function name does.
Rejected: **Un-export `buildContentRegistry`** — the obvious fix, and rejected for now rather than on principle: it is currently the direct entry point for existing tests and callers that build a registry without a kind registry to validate against, so un-exporting it is a real breaking change to buy a guarantee the naming already signals. **Give the validated path a distinct branded return type** so an unvalidated registry cannot be passed to `createEngine` — the structurally correct answer, and the one to reach for if this ever bites; not taken now because it changes a public type across every consumer to defend against a mistake nobody has yet made. Revisit when: a second composition root exists, or the first time a caller actually freezes an unvalidated registry — either makes the branded type worth its cost.
Reversibility: moderate — un-exporting or branding later is a breaking change for consumers, which is exactly why the risk is recorded now rather than left implicit.

### 2026-08-05 — `SessionStore`'s error channel is a thrown `Error`, and that is the contract
Context: `20-contract.md` §7 types `createSession`, `loadGame`, `getScene`, `getView`, `getStrings` and `saveGame` as returning `Promise<SessionHandle>` / `Promise<Scene>` / `Promise<SaveHandle>` — none of which is a `CommandResult`, and none of which has any field an error could travel in. Only `submitAction`/`previewAction` return `SessionActionResult`, which carries `errors`. The implementation (`src/engine/src/core/session/store.ts`) therefore throws a plain `Error` for every failure those signatures cannot express: an unknown `sessionId` or `saveId`, a `createGame` the engine rejected, and a `loadGame` whose envelope resolution failed. The throws are consistent and carry the reason code in the message (`session store: loadGame rejected — ${code}`). This was already noted informally in `plans/14-w7-session-store.md`, Design item 1, which observes that no `ReasonCode` fits "the session id itself doesn't exist" because that is a host-routing error rather than a game rejection.
Chosen: Accept the throw as the de-facto contract and record it here, where it is findable, rather than leaving it in one merged plan's design section. The distinction the current shape draws is defensible: a rejected *action* is part of the game and belongs in a structured result a client renders; an unknown session id is a caller bug or a routing failure and belongs in the exception channel, the same category as `mustDeserialize`'s "a stored blob failed to deserialize against its own engine". Two save-boundary codes (`save_requires_migration`, `migration_failed`) are registered in `BASE_REASON_CODES` anyway, so the vocabulary and its localized messages exist for whenever a structured channel does.
Rejected: **Change the six signatures to return `CommandResult<T>`** — the consistent answer, and rejected for now because it is a breaking change to every client and MCP tool for cases none of them currently handles differently from a thrown error; the MCP adapter already maps a throw to a tool error. **Leave it undocumented on the grounds that the types already say it** — rejected; the types say what is *returned*, and are silent on what happens instead, which is precisely the kind of gap this register exists to close. Revisit when: `loadGame`'s migration failures need to reach a player rather than a log — that is the first case where the difference is user-visible rather than operational, and the two registered codes are already waiting for it.
Reversibility: moderate — widening the return types later is a breaking API change; the reason codes being pre-registered is what keeps the cost to signatures rather than vocabulary.
**Superseded in part, 2026-08-06** — the throw remains the channel, but it is no longer a plain `Error` carrying a code in its message. See *`SessionStoreError` replaces the plain throw* below.

### 2026-08-05 — Two independent lock domains in the session store
Context: `src/engine/src/core/session/store.ts` holds a serialized blob per session and mutates it in place, so every command is a read-modify-write across an `await`. It serializes them with two keyed lock domains, `sessionLocks` and `profileLocks`, each a `Map<string, Promise<unknown>>` chained through one `runExclusive` helper. `sessionLocks` queues everything touching one session's blob — `resumeSession`, `submitAction`, `previewAction`, `saveGame` — behind its predecessor for that session; `profileLocks` separately queues `upsertAchievements`, whose load-merge-save is its own read-modify-write and which two *different* sessions can enter concurrently, since sharing a `profileId` across sessions is the entire point of a profile. Different sessions interleave freely: the domains are keyed, not global. This is asserted by the store's concurrency tests and was absent from §7 entirely.
Chosen: Record it as a decision and state it in §7, which now describes both domains, the interleaving property, and why locking is a store-layer concern that cannot affect `serialize()` output. Two domains rather than one is the load-bearing part: a single global lock would serialize unrelated players, and session-keyed locking alone would leave the cross-session profile race open, which is the specific bug the second domain closes. It belongs in the contract because a second `SessionStore` implementation must reproduce it — an implementation that serialized only per session would pass every single-session test and corrupt profiles under two sessions sharing one.
Rejected: **Leave it as an implementation detail of the in-memory store** — rejected; §7 is the contract a second implementation is written against, and a concurrency property that only exists in one implementation's source is not a contract, it is an accident that happens to hold. **Collapse to one lock domain keyed by session** — rejected; it does not serialize the cross-session profile upsert at all, which is the case that motivated the second domain. **Collapse to one global lock** — rejected; correct but it discards cross-session concurrency, which is the property a hosted layer needs most.
Reversibility: cheap for the documentation; the locking itself is load-bearing and test-asserted, so changing it is not.

### 2026-08-05 — The save-envelope checksum covers `{ state, replayCompatible }`, not the whole envelope
Context: `20-contract.md` §10.2 lists `checksum: string` on `SaveEnvelope` and says nothing about its scope. `src/engine/src/core/persistence/envelope.ts` computes it as `sha256(canonicalStringify({ state, replayCompatible }))` — so `saveFormatVersion`, `serializationVersion`, `engineVersion`, `kindId`, `kindVersion`, `campaignId` and `campaignVersion` are all outside it. Those outer fields are instead protected by explicit cross-checks at load: `campaign.kindId` must match the outer `kindId`, and the outer `kindId`/`campaignId` must match the embedded (and therefore checksummed) `GameState`'s own. `replayCompatible` is inside the checksum specifically because it is the one field with no such cross-check available — flipping a migrated save's `false` back to `true` in a stored blob would otherwise silently defeat the sticky-forward rule §10.2 documents.
Chosen: Record the actual scope as the accepted design and state it in §10.2 rather than leaving the field unqualified. The reasoning holds: a checksum over the whole envelope would be self-referential unless the field were excluded from its own input, and the version fields are exactly the ones a legitimate migration path may need to compare *before* trusting the payload — cross-checking them against the checksummed state is strictly more useful than hashing them, because a mismatch names which field disagrees instead of only reporting "corrupt".
Rejected: **Widen the checksum to the whole envelope minus `checksum`** — rejected; it converts every specific cross-check failure into one undifferentiated corruption error, and the cross-checks are what let `resolveSaveEnvelope` distinguish `invalid_state` from `unknown_campaign` from `save_requires_migration`. **Leave §10.2 unqualified** — rejected; "checksum" with no scope reads as "the whole thing", which is the wrong assumption for anyone writing a second store or a save-file tool. Revisit when: a field is added to `SaveEnvelope` that has neither a cross-check nor checksum coverage — that field's protection has to be decided at the moment it is added, not inferred later.
Reversibility: cheap for the documentation; changing the scope would invalidate every existing save.

### 2026-08-05 — `Engine.kinds` exposed, so the session store reads one kind registry rather than taking a second
Context: `SessionStore`'s `saveGame`/`loadGame` need kind metadata outside gameplay — `Kind.version` to stamp `SaveEnvelope.kindVersion`, and `Kind.migrateState` to dispatch migration (`20-contract.md` §10.2). The store's options previously would have taken its own `kinds` registry alongside the `engine`, which is two independently-suppliable references to something that must be the same object. `src/engine/src/core/kernel/types.ts` now declares `readonly kinds: KindRegistry` on `Engine`, and `createInMemorySessionStore` reads `engine.kinds`. Raised in review on PR #92.
Chosen: Keep the exposed member and add it to §4's `Engine` interface, which was missing it. The argument is structural, not convenience: a second registry option could silently disagree with the one the engine actually resolves `state.kindId` against, and the failure would be a save stamped with a `kindVersion` from a kind that never played the game — detectable only at load, in a different process, possibly months later. Reading it off the engine makes the disagreement unrepresentable. It is `readonly` and the registry is already a frozen, engine-owned set (§4), so exposing it grants no mutation the host did not already have at construction.
Rejected: **Keep the second `kinds` option and document that it must match** — rejected; "must match" enforced by documentation is exactly the class of invariant that holds until it doesn't. **Have the store take a narrower accessor (`kindFor(kindId)`) instead of the whole registry** — rejected as more surface for no benefit; the registry is already frozen and the store's two uses are ordinary lookups.
Reversibility: cheap — removing the member later means reintroducing the option, which is a small breaking change to store construction only.

### 2026-08-05 — `system:"view"` is a third normative RNG stream
Context: `20-contract.md` §8 described the MVP as using the `action` stream plus one `system` stream, `system:"start"`. `src/engine/src/core/kernel/engine.ts` derives a third: the read-only calls (`scene`, `availableActions`, `view`) build their `KindContext` from `{ kind: "system", system: "view", seq }`, where `seq` is the current action-log length. It is a real derivation and a real stream key, hashed like any other, established in `plans/09-w3-pure-engine-kernel.md` Decision 3.
Chosen: Record it and list it in §8 alongside the other two. The reason it exists is worth keeping: `KindContext` is one type, so a read path has to supply an `rng` handle from somewhere, and supplying the *action* stream's would mean an accidental draw during rendering perturbs the next `submitAction` at the same `seq` — a determinism bug that would reproduce only when a client happened to render between two actions. A separate stream removes the failure mode by construction, at the cost of one `StreamId` encoding. Nothing draws on it today and nothing should: projection is a narrowing of state, not a resolution. It is normative anyway — the encoding is part of the contract (§8's stream-id mapping is normative in full), so changing it would change every seeded outcome the day a kind does draw.
Rejected: **Leave §8 saying "one `system` stream"** — rejected; it is simply false against the shipped engine, and §8's own claim that the `StreamId` → string mapping is normative makes an unlisted live stream a contract gap rather than a detail. **Have read paths take no `rng` at all** (a `KindContext` variant without one) — the cleaner design in the abstract, and rejected because it splits `KindContext` in two for every kind to satisfy a constraint the stream separation already enforces.
Reversibility: cheap for the documentation; the stream key itself is normative and changing it is not.

### 2026-08-05 — `previewAction` is deliberately not one of the spanned commands
Context: `05-observability.md` §6.1 names five commands that get a trace span and a stamping decorator: `createSession`, `resumeSession`, `submitAction`, `saveGame`, `loadGame`. `previewAction` is not among them, and `src/engine/src/core/session/store.ts` implements it accordingly — it takes the per-session lock (so it cannot evaluate one version of a session while a neighbouring command persists another), but it does not go through `withCommand`, does not increment `attemptCounter`, does not write `record.blob`, and does not touch profile persistence. On the engine side, `previewAction` runs the same `advance` path against a null emitter and emits no action lifecycle event.
Chosen: Record the exclusion as deliberate and state the store-side half in §7, which previously described the query/command split without saying which side `previewAction` falls on. It is a query that happens to run the write path: ordered like a write, because it must not read a torn state, and recorded like a read, because nothing it does is observable afterwards. The "emits no lifecycle event" guarantee is *already* in the contract — §4 states it — so the gap was never the engine half; it was that §7's own list of what a command does (span, attempt counter, blob write, profile upsert) never said `previewAction` opts out of all four.
Rejected: **Give `previewAction` a span and an attempt number for observability parity** — rejected; incrementing the attempt counter would make a preview indistinguishable from a rejected submission in the event stream, and the counter is what disambiguates the identical `(gameId, seq, ordinal)` two rejected attempts produce (05 §5–§6). A preview that consumed an attempt number would corrupt that. **Drop the session lock so a preview never blocks a submission** — rejected; a preview evaluated against a blob mid-overwrite could report a placement valid that the very next submission rejects, which is the exact failure preview exists to prevent.
Reversibility: cheap.

### 2026-08-05 — `advance_ticks` with a malformed `ticks` param returns `unknown_action`
Context: `20-contract.md` §11 registers `ticks_not_positive` for `advance_ticks` with `ticks` less than 1, and `tick_limit_reached` for exceeding the campaign cap. It says nothing about a `ticks` param that is *missing* or not an integer. `src/engine/src/kinds/world-graph/tick/batch.ts` handles that case by returning `core.reason.unknown_action` — the same code the kind returns for an action id it does not recognize at all. So `advance_ticks` with no params and `advance_tickz` are indistinguishable to a client.
Chosen: Accept the current behaviour and record it, rather than adding a code now. It is a repurposing, and worth naming as one: `unknown_action` means "the kind did not recognize this submission", and a verb whose required parameter is absent or of the wrong type has not been recognized as a well-formed submission — that reading is defensible and matches how the core treats the code elsewhere (05 §8 omits `actionId` from `core.action.rejected` for exactly this code, on the grounds that the kind did not recognize the id either). The concrete cost is small today: `advance_ticks` is the only world-graph verb whose params are structurally required, and a client that renders the verb from `availableActions` and submits an integer never hits it.
Rejected: **Add a dedicated `malformed_params` (or similar) code now** — rejected for this pass, not on the merits. A malformed-parameter code is arguably the right long-term answer and would be genuinely cross-kind: `story-graph` already distinguishes its own case (`unexpected_params` for a kind that declares none), simulation's `plan.*` verbs have required params too, and a code in the base set would serve all three. It is not added here because doing it properly means deciding the shape once across three kinds and the base vocabulary — a contract change, not a bug fix — and because the current behaviour is not wrong so much as coarse. **Reject with `ticks_not_positive` instead** — rejected outright; a missing param is not a non-positive one, and conflating them would give a client a message that names a value the caller never sent. Revisit when: a second kind needs the same distinction, or a client is actually observed unable to tell a typo'd verb from a malformed one.
Reversibility: cheap — adding a code is additive by §12's own "additive, never renamed" rule, so nothing here forecloses the better answer.

### 2026-08-06 — The session-store seam moved down: `SessionPersistence`, not `SessionStore`, is the host port
Context: `06-extensibility.md` §3 listed `SessionStore` as host-suppliable and §4's `SessionHost` carried `sessions: SessionStore`, which never reconciled with `createSessionLayer` *returning* one. Building browser checkpoints (W61) forced the question: the site needed durable records, not a different store. `src/engine/src/core/session/store.ts` now composes a core-owned store over an optional `SessionPersistence` — a pair of record stores for `StoredSessionRecord` and `StoredSaveRecord` — and `SessionHost` carries `registry`, `persistence?`, `profiles?`, `clock?` and `recordSink?`.
Chosen: Draw the seam one level below `SessionStore` and say so in `20-contract.md` §7.2 and `10-design.md` 06 §3/§4/§5.2. The store's own behaviour — two lock domains, the stamping decorator, save-envelope assembly, idempotent profile upsert — is four invariants a host would have to re-implement and nobody would check. A host that wants Postgres wants durable records, not a different concurrency model.
Rejected: **Keep `SessionStore` as the port and let hosts implement it whole** — rejected; that is the shape that produced a specification nobody could build against for four units. **Leave `SessionHost` documented as-is and treat the code as an unsanctioned divergence** — rejected; the code resolved a gap this register had been carrying since W7, correctly, and the specification was the side that was wrong.
Reversibility: moderate — `SessionPersistence` is exported and a published shape, so narrowing it later is breaking; widening it is additive.

### 2026-08-06 — `SessionStoreError` replaces the plain throw, and its three new codes are registered
Context: the 2026-08-05 entry above accepted a plain `Error` with the reason code interpolated into its message. `SessionPersistence` made that untenable: a storage failure is a condition a *player* sees ("could not be saved locally"), and a client reading it out of an English message is precisely what `20-contract.md` §12 and `09-clients.md` §3 forbid. The shipped `SessionStoreError` carries `operation` and a typed `code`, but three of its eight codes — `unknown_session`, `unknown_save`, `storage_failure` — were in no vocabulary and had no localized string.
Chosen: Register all three in `BASE_REASON_CODES` (§12) with shipped `core.reason.*` strings, so every member of `SessionStoreErrorCode` is a real `ReasonCode` a client renders through the string table. Also fixed: any exception an adapter raises is caught and re-raised as `storage_failure`, so a host's own exception type never crosses the boundary.
Rejected: **Narrow the JSDoc to say these are host diagnostics, not client-renderable** — rejected; the browser demo already renders a storage failure to a player, so the narrower claim would have been false the day it was written. **Invent a separate error vocabulary beside `ReasonCode`** — rejected; §12 is additive by rule, so there is no cost to growing it and a real cost to having two.
Reversibility: cheap — codes are additive and never renamed.

### 2026-08-06 — `isReadOnly` partitions `DerivedPath`; not every derived path is read-only
Context: `20-contract.md` §7.1 said a `Modifier.target` may "never" be a §6.1 `DerivedPath`, and §6.1 closed with "derived paths are read-only". But §6.1's own motivating example is a modifier that *sets* `player.needs.*` for three weeks, and that is a `DerivedPath` — so the literal rule made the section's own example a Tier 1 error and left the base/derived layering with nothing to layer. `src/engine/src/kinds/simulation/derived.ts` resolved it by treating only the four formula-only paths as read-only.
Chosen: The code's partition is canonical, and both §6.1 and §7.1 now state it as a table: derived paths *with a stored base* (`player.needs.*`, `player.attributes.*`, `player.skills.*`) are legal `Modifier` targets; the four with no stored counterpart (`player.housing.quality`, `player.career.effectivePerformance`, `calendar.energyRecoveryRate`, `world.strangeness`) are `read_only_field`. §14's Tier 1 check is written against the partition, not the union. The distinction is *has a writable field*, not *is computed on read*.
Rejected: **Make every `DerivedPath` read-only in code** — rejected; it deletes the mechanism §6.1 exists to describe.
Reversibility: cheap — a documentation correction over already-shipped behaviour.

### 2026-08-06 — Save checksums use a portable SHA-256 library, not async Web Crypto
Context: `13-playable-web-demo.md` §4 named Web Crypto SHA-256 as the browser checksum mechanism and explicitly permitted `saveGame`/`loadGame` to become async for it. `src/engine/src/core/persistence/envelope.ts` instead replaced `node:crypto` with `@noble/hashes` and kept `computeChecksum` synchronous.
Chosen: Keep the synchronous library, and record the two costs plainly in §4 rather than let them pass as implementation detail — the engine package now carries a runtime dependency where it had none, and it hashes with library code rather than the platform primitive. `crypto.subtle.digest` is async, so adopting it means async-ifying `computeChecksum`, `buildSaveEnvelope`, and every caller and test between, to obtain a digest that is byte-identical either way. The envelope, hex digest, and canonical bytes are unchanged, which is the only part that is contractual.
Rejected: **Switch to Web Crypto and propagate async** — rejected on cost, not merit; it remains the better answer if a synchronous checksum ever stops being needed. **Ship a browser-only checksum path** — rejected outright by §4's own "do not add a second checksum algorithm".
Reversibility: cheap in contract terms (the digest is the contract), moderate in code (the async refactor is real).

### 2026-08-06 — `__GAME_ENGINE_PRODUCTION__` is a build-time flag, documented as such rather than made a port
Context: `src/engine/src/core/observability/emitter.ts` reads a compile-time global to decide whether it is a shipped build, falling back to `process.env.NODE_ENV` when absent. `site/vite.config.ts` defines it. It appeared in no port catalogue, so a non-Vite browser embedder would silently get dev-mode emitter behaviour.
Chosen: Document it in `06-extensibility.md` §5.6 as the one build-time flag, explicitly not a port, naming the asymmetry: Node hosts define nothing and get the right answer; browser hosts must define it or fall through to *not* production. It cannot change `serialize()` output, which is why §2 permits it at all.
Rejected: **Move it onto `EngineHost` as a runtime value** — rejected; the point of a compile-time literal is that dev-only work can be eliminated by the bundler, and a constructor argument cannot be tree-shaken. **Leave it undocumented because the bundler config sets it** — rejected; that is true of exactly one embedder.
Reversibility: cheap.

### 2026-08-06 — Browser checkpoints become locally durable; `13` §5 rewritten rather than the code reverted
Context: `13-playable-web-demo.md` §5 required same-page-only checkpoints and said in terms that React "must not write a raw state or save envelope into `localStorage`", because "no browser storage port exists" and durable saves "require a host-owned persistence adapter or a new store port and therefore their own contract and slice". The port was then built (above) and `site/src/play/composition.ts` supplies a `localStorage` adapter — with no contract and no slice, and with `put` keyed on `campaignId` while `get` reads by `saveId`, so nothing it wrote was ever retrievable.
Chosen: Specify it. §5 is now Revision 2: the client still persists nothing and still holds only a `SessionStore`; the *site composition root* supplies a `SessionPersistence` adapter, which is host composition above the client boundary and inside 06 §2's rule. §5 and `20-contract.md` §7.2 both state that a save is addressed by `saveId`, because the adapter that got it wrong failed silently in both directions. Storage is best-effort: a failure surfaces as `storage_failure` and the run continues in memory. The code fix — the key, the load-on-mount path, and whether `SaveRecordStore.delete` stays — is sliced as **W68**, not applied here.
Rejected: **Revert the port and the adapter to match §5 as written** — rejected; the port is architecturally sound and the static host will want it. **Keep the port, drop the `localStorage` use** — rejected; it would ship a port with no consumer, which is the "one built instance is not a pattern" objection inverted.
Reversibility: moderate — the storage key and shape become a compatibility surface for anyone who has already played.

### 2026-08-06 — Restoring the deleted story-graph evidence, rather than recording its loss
Context: the W64 campaign rewrite deleted `bulgaria-bureaucracy.replay.test.ts`, five determinism golden snapshots and their tests, and `bulgaria-bureaucracy.observability.test.ts`. The three `bureaucracy-*.fixture.json`/`.outcome.json` pairs remain on disk with no reader, pinned at `campaignVersion: "1.0.0"` while campaigns now publish `2.0.0`. The W23 cross-version job still runs and is now blind to story-graph. All 683 tests pass; nothing reports the gap. `07-replay.md` §4 names those exact files as the corpus, `20-contract.md` §14 requires golden files and sink independence, and `MVP.md` §5's "Observable" box was what the jsonl test proved.
Chosen: Restore the evidence rather than amend the documents — story-graph is the flagship kind and is currently the only shipped kind with no cross-version oracle. Sliced as **W67**: regenerate the three fixture/outcome pairs against v2, restore the directory-enumerating replay test **plus an assertion over expected corpus membership**, restore a determinism golden and the jsonl observability test for one story-graph campaign. Not done in this reconciliation: a regenerated `.outcome.json` is a statement that the game changed (07 §4) and must be reviewed as one, not buried among documentation edits.
Rejected: **Amend 07 §4, §14 and 05 §12 to record the reduction** — rejected; it would leave the W23 job proving less than its name claims. **Restore only the replay corpus** — rejected; sink independence and stream reproducibility lose their real-campaign check, which 05 §12 says is the whole point of them.
Reversibility: cheap.

### 2026-08-06 — Campaign-shape builders named as tooling, in `10-design.md` §9.1
Context: `adventure-builder.ts` generates the graph topology for all six shipped story-graph campaigns from one parameterized config. No design document mentioned it, so a reader inferred either a fourth layer between kinds and campaigns, or that the shared shape was required.
Chosen: Name it in architecture §9.1, beside the AI-authoring boundary it shares reasoning with: a builder runs before the engine, emits an ordinary campaign source, is validated by the same tiers as hand-written content, and buys no exemption. The load-bearing sentence is that a campaign is **free not to use one** — the moment the shape is the only way a campaign can be expressed, it is a content schema and belongs in the kind contract instead.
Rejected: **Log it as an open register item only** — rejected; six campaigns already depend on it, which is past "one case". **Move it out of the engine package** — rejected; its output already goes through the ordinary validated registry path, so the layering objection is aesthetic.
Reversibility: cheap.

### 2026-08-06 — `TextClient` and all six campaign builders are sanctioned package-root exports
Context: `13-playable-web-demo.md` §3 sanctioned exporting *the Bureaucracy builder* so the site composition root could construct the demo without a deep import. `src/engine/src/index.ts` now exports six campaign builders and `TextClient`.
Chosen: Sanction both in §3, with a rule that keeps the set principled — **a builder, never its internals**: the root exports `build<Campaign>Campaign` and its id constant and nothing that would let a caller assemble or mutate nodes. `TextClient` is admitted for a second reason worth stating: 09 §1 makes the client rule testable as *two clients, same inputs, byte-identical `serialize()`*, and the browser parity test cannot instantiate the other client without it. A client in the engine's public surface is a mild oddity against 02 §1; the alternative is a parity proof that deep-imports `src/clients/`, which §3 exists to forbid.
Rejected: **Un-export `TextClient` and let the parity test deep-import** — rejected; it makes the test the one caller allowed to break the rule.
Reversibility: moderate — un-exporting is breaking for consumers.

### 2026-08-06 — The browser bundle gate becomes an assertion, not a build that happened to succeed
Context: `13-playable-web-demo.md` §4 names "a browser production-bundle smoke test" as the gate proving no Node-only module reached the bundle, and says in terms that typechecking DOM declarations does not prove it. `site/scripts/verify-build.mjs` asserted route metadata and the absence of `/src/` paths, and nothing about `node:` specifiers — the property rested on Vite failing to resolve them.
Chosen: Add the assertion, and restate §4 so the gate is the scan rather than the build succeeding. "The bundler would have complained" is the same class of claim §4 already rejects, and the site now depends on the engine by path, so an engine change can reintroduce a Node-only import with nothing watching.
Rejected: **Relax §4 to bundler enforcement** — rejected; Vite can externalize rather than fail under some configurations, so it would record a weaker guarantee than a reader will assume.
Reversibility: cheap.

### 2026-08-06 — The simulation kind's rejections now carry their player-facing message
Context: `20-contract.md` §3 states it as a universal rule, not a per-kind option: a rejected `AdvanceResult` attaches one `OutcomeMessage` built from the same `messageKey` the error carries (`{ key: messageKey, visible: true }`), "so a rejection is never silently swallowed by a client that only renders `messages`", and names world-graph's `actions/common.ts` helper and story-graph's own as the pattern. `kinds/story-graph/advance.ts` and `kinds/world-graph/actions/common.ts` both comply. `kinds/simulation/advance.ts`'s `rejected()` returned `messages: []`, so every simulation rejection — a `plan.remove` index that no longer exists, a missing or unrecognized `actionType`, a `custom` action reaching `end_week`, an unknown `actionId` — reached such a client as silence. Found by reconciliation reading the three kinds against §3 rather than against each other.
Chosen: Fix the code. Two of three kinds already honour the rule and the contract states it universally, so simulation was the outlier, not the precedent. A table-driven test now asserts the invariant across all four of this kind's rejection paths at once, rather than one assertion per path, so a fifth rejection added later fails the test unless it is added to the table.
Rejected: **Relax §3 to make the attached message optional per kind** — rejected; it moves the obligation onto every client to render `errors` as well as `messages`, which is a 09 §5 change this reconciliation did not scope and which breaks the rule for the two kinds already keeping it. **Fix it in `Engine.submitAction` instead, synthesizing the message centrally for every kind** — rejected; the core would then be manufacturing player-facing content from a kind's error, and a kind wanting different wording for a rejection than for its error would have no way to say so.
Reversibility: cheap — one helper and its test.

### 2026-08-06 — Two `StateChange.reason` values were outside the vocabulary; both are now registered
Context: `20-contract.md` §12 specifies `achievement_unlocked` and `consequence_applied` as the `reason` on two audit records, and both are emitted verbatim (`kinds/story-graph/achievements.ts`, `kinds/story-graph/variables.ts`); `core/session/store.ts` switches on the first to drive the profile upsert, exactly as §12 describes. Neither was in `BASE_REASON_CODES` or `STORY_GRAPH_REASON_CODES`, so neither had a shipped message. `StateChange.reason` is typed `ReasonCode` and `visible` gates client display, so §12's own guarantee — a client meeting an unfamiliar code "falls through to the localized message" — did not hold for them. `consequence_applied` rides on `visible: <the variable's own declaration>`, so this was a live hole rather than a theoretical one.
Chosen: Register both, split by who reads them. `achievement_unlocked` joins `BASE_REASON_CODES` because the session store switches on it kind-agnostically and would otherwise depend on a kind-owned code; `consequence_applied` joins `STORY_GRAPH_REASON_CODES` because only that kind has a consequence. §12 gains a callout stating that a `StateChange.reason` is an ordinary registered code with no exemption, and 03 §8.3 gains a third table beside its resolution and validation halves.
Rejected: **Document them as an exempt namespace** — rejected; `StateChange.reason` is typed `ReasonCode` and §12 presents one vocabulary, so a split would mean a client must know which sort of code it holds before it knows whether a lookup can succeed. **Put both in the base set** — rejected; a consequence is a story-graph concept and the core has no business shipping its message. **Record it as a known gap and change nothing** — rejected; unlike the deferred seams this register carries, this one is reachable by a client today.
Reversibility: cheap in one direction only — `ReasonCode` is additive and never renamed (§12), so registering costs nothing, but un-registering later would break any consumer that had begun resolving them.

### 2026-08-06 — `world-graph` §11 documents its validation codes, matching `story-graph` §8.3's split
Context: `20-contract.md`'s §11 for this kind listed the 13 gameplay reason codes. `kinds/world-graph/reasons.ts` registers 41: those 13 plus 28 campaign-validation codes that `validate.ts` produces. The file's own header records the split; the contract never did. Nothing failed — every code has a message, so the completeness check (04 §12) passed — but a reader of the contract could not learn what `validateCampaign` returns, and `world-graph` was the only kind whose author-facing vocabulary was undocumented.
Chosen: Split §11 into resolution and validation tables with a Tier column, transcribing the 28 with their trigger conditions. This is exactly the shape `03-story-graph-kind.md` §8.3 already uses, so it is transcription against a settled pattern rather than a new convention. The reuse of `duplicate_id` and `missing_string_key` across kinds is stated as deliberate rather than left to look like a collision.
Rejected: **Collapse the 28 onto fewer, broader codes to match §11 as written** — rejected; `validate.ts` currently tells an author which of 28 shapes is wrong across a map, a terrain graph, ten catalogues and a scenario, and one `invalid_definition` for all of them is a real loss of author-facing precision. **Leave §11 as the gameplay codes and note the rest live in code** — rejected; "see the source" is what a contract exists to avoid, and `story-graph` had already decided otherwise for the identical situation.
Reversibility: cheap — documentation only.

### 2026-08-06 — `13` §10/§11 restated for the shelf; the boundary is one kind, not one campaign
Context: `13-playable-web-demo.md` §11 read *First public campaign — Bulgaria Bureaucracy only* and §10 made "the other four Bulgaria arcs" an explicit non-goal. `site/src/play/composition.ts` builds six campaigns and features Lucifer Chronicles, which no canonical document named as a demo campaign at all. §3 of the same document had already been updated for the six sanctioned builder exports (see *`TextClient` and all six campaign builders* above), and §14 §1 describes "the established multi-campaign play surface" — so one document argued both sides, and under this repository's rule that non-goals are binding it forbade what it also documented.
Chosen: Update §1, §10 and §11 rather than cut the shelf. The line the original row was actually protecting is **one kind at `/play/`**, not one campaign, and that line is intact: Stable Life and the world-graph MVP are still out, and §10 now says so in those terms. Bureaucracy is restated as the *proof fixture* — the arc §7's parity and replay tests drive — which is the standing it always had and which "first campaign" was an imprecise way of naming. Lucifer Chronicles is named as the featured campaign so the front page of the public demo appears in a canonical document.
Rejected: **Cut `/play/` back to Bureaucracy to honour the non-goal** — rejected; it would revert W64 and most of W63, delete shipped and tested content, and contradict §14, which owns the shelf and was approved after §10 was written. **Mark §10/§11 superseded by §14 and leave both** — rejected on single ownership; 13 is read before 14, so the stale statement is the one a reader hits first, which is the failure mode that rule exists to prevent.
Reversibility: cheap for the documents; the shelf itself is W63/W64 work and reverting that is not.

### 2026-08-06 — Simulation `outcome()`'s multi-goal rule, recorded rather than left in a file header
Context: `20-contract.md` §12 for this kind fixes the three terminal values and explicitly leaves open how a *mix* of completed and failed goals resolves — it documents only that `goalFailurePrecedence` can produce `"goals_met"` while some goal failed. `kinds/simulation/outcome.ts` had to answer it to return anything, and chose: any failed goal makes the whole resolution `"failed"`. That choice was recorded only in the file's own header comment. It decides win and loss for Stable Life and feeds `Outcome.terminal`, which the replay oracle compares across versions (07 §3.3), so it is load-bearing and a change to it would read as a regression.
Chosen: Record it here, unchanged. The rule is defensible as the conservative reading and is verified only against single-goal tests, which the header already says; what was missing was a findable statement that a choice was made at all, rather than a contract gap that happened to have code behind it. `week_limit_reached` stays unreturnable for the separate reason the header gives — `state` alone carries no `weekLimit`, and §12 calls its precedence genuinely unresolved upstream.
Rejected: **Move the rule into §12 as settled** — rejected; §12's openness is accurate, and the first real multi-goal scenario is what should settle it, not a function that needed a total signature. **Leave it in the header** — rejected; a header is read by whoever is already editing that file, which is never the person asking "why did this playthrough report a loss?".
Reversibility: cheap as documentation; changing the rule itself is not, since it would alter committed `.outcome.json` baselines.

### 2026-08-08 — Twenty-eight audit `StateChange.reason` values were outside the vocabulary; the 2026-08-06 fix did not generalize
Context: The 2026-08-06 entry *Two `StateChange.reason` values were outside the vocabulary* registered `achievement_unlocked` and `consequence_applied` and added 04 §12's callout that an audit reason is an ordinary registered code with no exemption. Reconciliation found the identical defect at scale: `simulation` emitted **eighteen** unregistered reasons (thirteen `action_*` from W53/W55's resolvers, plus `need_drift`, `wage_payment`, `rent_charged`, `rent_overdue`, `eviction_advanced` from the end-of-week systems) and `world-graph` **ten** (`building_placed`, `construction_started`, `staff_hired`, `price_set`, `ticks_advanced`, `scenario_effect`, `guest_served`, `objective_met`, `failure_triggered`, `incident_resolved`). Every one of the twenty-eight rides on `visible: true`, so each reached a client with a `reason` the string table could not resolve. W54 registered its own eight audit codes correctly, which is why the simulation kind was internally inconsistent rather than uniformly wrong. The root cause is structural: `buildValidatedContentRegistry` (`core/validation/tiered.ts`) checks *registered → has a message* and nothing checks *emitted → registered*, so `missing_kind_reason_message` cannot fire for a code that was never declared, and every gate stayed green. `world-graph` compounded it — its `BatchChanges.record` (`tick/changes.ts`) takes `reason` as a plain `string`, and the 2026-08-06 `world-graph` §11 entry covered that kind's *validation* codes only, so its audit reasons fell between the two passes.
**Amended by a second pass the same day, and the amendment is the load-bearing part.** The first pass got `world-graph` wrong in both directions: it registered `tick` and `effect`, neither of which any production path emits (`"tick"` appears only as a system id and an RNG stream discriminant; `"effect"` appears only in test fixtures), and it missed the five *indirect* reasons above — `scenario_effect`, `guest_served`, `objective_met`, `failure_triggered`, `incident_resolved` — which are threaded in as `EffectContext.reason` (`tick/effects.ts`) and become visible only where that module records `finances.cashCents`. It also misclassified two entries in its own exclusion list: `incident_resolved` is `visible: false` at two `record()` sites but visible through its effect-context use, and `scenario` is not a `StateChange.reason` at all — it is a guest-intent discriminant (`actions/build.ts`) and a system id (`tick/order.ts`). This was not hypothetical: `world-graph-mvp`, the only shipped campaign of the kind, fires a `finance_delta` scheduled change at tick 10 and so emits an unresolvable visible `scenario_effect` in ordinary play.
Chosen: Register all twenty-eight in their own kinds' code arrays with shipped English messages; drop `tick` and `effect`. Restructure `20-contract.md` §10 into three tables (resolution, campaign validation, audit) matching `story-graph` §8.3, and give `world-graph` §11 the third table it lacked, split by **how the reason reaches the record** — direct literal versus effect-context — because that distinction, not the code list, is what the first pass could not see. Both callouts state plainly that the late-registration policy has no gate and that adding an audit reason means registering it in the same commit. Registration is additive and never renamed (04 §12), so this costs nothing downstream.
Rejected: **Also register the `world-graph` reasons recorded only with `visible: false`** (`alert_dismissed`, `building_demolished`, `staff_fired`, `staff_assigned`, `guest_spawned`) — rejected, and it is a genuine judgement call rather than an oversight: 04 §12 ties the obligation to `visible`, so an invisible record owes no message today. The risk is named rather than dismissed — flipping one of those flags to `true` re-arms the identical defect with no gate to catch it. **Keep `tick` and `effect` as reserved forward declarations** — rejected; both would ship a localized English message no path can ever produce, which is the exact inverse of the defect being fixed and would have to be documented as unreachable in the contract table. **Exempt audit reasons as a separate vocabulary** — rejected for the reason 2026-08-06 already gave: a client would have to know which sort of code it holds before knowing whether a lookup can succeed.
Reversibility: cheap in one direction only — registering costs nothing, un-registering would break any consumer that had begun resolving them. `tick`/`effect` are safe to drop precisely because they were never emitted, so nothing can have started resolving them.

### 2026-08-08 — Two specified seams wired: resolver `messages`, and the automatic `counters` fold
Context: Two things `20-contract.md` specifies for the simulation kind had no implementation. §5.3 declares `ActionOutcome.messages` and 04 §12 makes it the player-facing channel, but `advance.ts`'s `end_week` collected each resolver's `changes` and dropped its `messages`, returning `messages: []` unconditionally — harmless today because every resolver returns `[]`, and a silent loss the moment one does not. §6.2 specifies that `counters[change.reason]` increments automatically for every emitted `StateChange`, giving statistics like "times evicted" free off the reason-code taxonomy; nothing wrote to `player.counters` anywhere, while Tier 2 validation already warned on achievement conditions referencing counters nothing writes — a check guarding a mechanism that did not exist.
Chosen: Wire both. `messages` now accumulates alongside `changes`. `foldCounters` folds every emitted `StateChange` into `player.counters`, in two places: over the resolvers' changes **before** the end-of-week pass, and over the end-of-week systems' changes after it. §6.2 fixes the rule and not its timing, and this is the boundary chosen — a `goals`/`failure`/`achievements` condition can read what the player did this week, but not what the end-of-week systems themselves just emitted. Threading counters incrementally through all fourteen systems would close that gap and was judged disproportionate. Two consequences are worth stating because neither is obvious from §6.2's wording: the fold emits no `StateChange` of its own (a counter that audited itself would count its own audit record, unboundedly), and a counter counts **audit records, not actions** — `rest` emits two `StateChange`s, so three rests read as `action_rest: 6`.
Rejected: **Record `counters` as a known gap and wire only `messages`** — the smaller change, and rejected by the maintainer on the merits: the mechanism is specified, Tier 2 already depends on it, and deferring left a validator guarding nothing. **Delete §6.2's automatic half from the contract** — rejected; the contract's job is to specify the target, and this one was not wrong, only unbuilt. **Fold counters once at the end of resolution** — rejected; simpler, but it makes this week's own actions invisible to the systems that exist to react to them.
Reversibility: `messages` is cheap. The counters fold is not — it changes `serialize()` output, so the Stable Life client-parity golden snapshot was regenerated in the same commit; reverting means regenerating it again. `.outcome.json` baselines are unaffected, since `Outcome` carries no serialized state (07 §3.4).

### 2026-08-08 — W53/W55 mechanism and balance rules, recorded rather than left in file headers
Context: Four load-bearing rules landed in W53 and W55 documented only in `endOfWeek.ts`'s own comments, with no contract home and no register entry. (1) `financeReconcile` levies a **10% late fee** (`LATE_FEE_BPS = 1000`) on the rent `housing` failed to collect and advances `evictionStage` **exactly one rung** on a fixed six-stage ladder regardless of how large the shortfall is; §6.9 declares `EvictionStage` as a union and states no advancement rule, and the fee has no contract home at all. (2) `housing` charges rent **unconditionally**, letting `cashCents` go negative — deliberate, and load-bearing, because the resulting overdraft is how §3's own "wages before rent" ordering claim is proved by an actual overdraw rather than a bookkeeping flag; `missedCents` is computed from this week's charge against the cash on hand *before* it, never read back off a balance that may already carry prior arrears. (3) Hiring resolves in the `employment` end-of-week system rather than in the `apply_for_job` resolver, at most one hire per week, and a filled `JobOpening` is removed from the market so a second application fails `requirement_unmet`. (4) A promotion resets `Employment.startedWeek`, so `PromotionPath.minimumWeeksInRole` measures tenure **in the role** rather than since hire — without it a multi-step career path chains faster than the field intends.
Chosen: Record all four in one entry rather than four, because they share a cause: slice-time judgement calls left in headers. (1) and (2) are provisional balance material of the same status `TODO.md`'s *Known Open Items* gives this kind's other unbalanced numbers. (3) and (4) are mechanism, not balance, and are the two most likely to be contradicted by a later unit that assumes hiring is an action outcome or that tenure runs from the hire date.
Rejected: **Promote the late fee and eviction ladder into `20-contract.md` §6.9 as settled** — rejected; both are placeholder numbers awaiting the balancing pass, and writing a provisional constant into the contract makes it read as a fixed rule. **A separate entry per rule** — rejected; four headings for one slice's judgement calls obscures that they share a cause and a revisit condition. Revisit when: the simulation balancing pass runs, for (1) and (2); when contested promotions or multi-actor hiring land, for (3) and (4).
Reversibility: cheap as documentation; changing the rules themselves would alter committed replay fixtures.

### 2026-08-08 — Known-and-retained gap: `Employment.attendanceRatio` is declared but maintained by nothing
Context: `20-contract.md` §6.8 declares `Employment.attendanceRatio: number` as "0–100, rolling". `endOfWeek.ts`'s `resolveApplications` sets it to `100` at hire and no system ever updates it — not `employment`, which advances `performance` and promotions, and not any resolver. The contract never says which system maintains it, so this is a field ported with the rest of `CareerState` (W33) that has had no owner since. It is not merely unused: `100` is the *best possible* value, so anything built against it — a firing rule, a promotion gate, a performance factor — would silently read a perfect attendance record for every employee forever. The course-side analogue is genuinely maintained: `education` computes its own attendance ratio per enrollment from `attendedUnits / weeksCompleted` against `CourseFailureRules.minimumAttendanceRatio`, which is why the employment side reads as complete at a glance.
Chosen: Record it here as a known-and-retained gap rather than fixing it in a reconciliation. Deriving an attendance rule means deciding what a missed work week *is* — this kind has `work`/`work_overtime` resolvers and a `workedThisWeek` flag, but no concept of a scheduled shift to be absent from — and that is a mechanism decision belonging to whichever unit first needs attendance to matter, not a field to fill in. Naming the sharp edge is the point: the risk is a later unit reading it as maintained.
Rejected: **Drop the field from §6.8 until a system maintains it** — rejected; it is part of upstream's `Employment` shape and the port's own rule was to bring `ActorState` over whole rather than narrowly (§6.2). **Initialize it to 0 instead of 100 so the gap fails loudly** — rejected; it would make a newly hired employee look delinquent and could trip a future rule in the opposite, equally wrong direction. Revisit when: a firing, probation, or performance rule first reads attendance.
Reversibility: cheap — documentation only.

### 2026-08-08 — Known-and-retained gap: the W65.5 visual-baseline gate cannot run on macOS
Context: `site`'s `check` script chains `format:check && lint && typecheck && test && test:browser && test:build`, and `test:browser` runs `visual-baseline.browser.test.tsx` (W65.5), which asserts `toMatchScreenshot` at four widths across four states — sixteen assertions. Vitest names a reference screenshot per platform, so the committed corpus under `site/src/play/browser/__screenshots__/` holds thirty-two images: `-chromium-linux` and `-chromium-win32`, and no `-chromium-darwin`. On macOS every one of the sixteen is therefore missing on first run; the matcher's contract on a missing reference is to **write the new image and fail** ("No existing reference screenshot found; a new one was created"), so `npm run check` fails on a clean tree with no defect present, and leaves sixteen untracked PNGs behind. The other five sub-gates in the chain pass on macOS, but the chain's `&&` means `test:build` is never reached — a macOS `/verify` that only ran the aggregate would silently skip the build-verification step as well as the visual one.
Chosen: Accept the gate as linux/win32-only and record it here. CI is the platform of record — `ci.yml` runs it on Linux against the committed `-chromium-linux` set, so the gate is genuinely covering the branch, just not from a macOS checkout. A macOS `/verify` should run the five non-browser sub-gates individually, report `test:browser` as *did not run* rather than *failed*, and delete the generated `-chromium-darwin` files rather than leaving them staged for accidental commit. Naming the sharp edge is the point: the failure text reads like sixteen visual regressions and is nothing of the kind.
Rejected: **Commit the sixteen `-chromium-darwin` baselines** — rejected; they would enter the corpus without ever having been visually reviewed, which is the one thing a baseline must not be, and a third platform's images would then need regenerating on every UI change with no CI runner to catch them drifting. **Gate `test:browser` behind a platform check so `check` passes on macOS** — rejected; a gate that quietly skips itself is worse than one that cannot run, and it would hide the `test:build` truncation too. **Add `__screenshots__/*-darwin.png` to `.gitignore`** — rejected; it stops the accidental commit but leaves the chain still failing, addressing the symptom that costs least. Revisit when: a macOS CI runner exists, or the visual baselines move to a platform-independent renderer.
Reversibility: cheap — documentation only; no code or committed image changed.

### 2026-08-09 — The portable campaign format: a merged spike, specified rather than reverted
Context: `src/engine/src/spike/portable.ts` describes itself as "SPIKE — Throwaway. Not a contract, not referenced by `design/`," and `plans/spike-notes.md` states "no `/slice`, no `design/` edits, no docs regen, no PR." It merged as PR #224 and is now load-bearing in four ways at once: all nine shipped campaigns import `PortableCatalog`/`PortableMigration` from it; `fromPortable`, `PortableCampaign`, `PortableCatalog` and `PortableManifest` are package-root exports at `0.5.0`; `site/public/campaigns/` holds ten JSON files; and `site/src/play/composition.ts` fetches `manifest.json` plus every listed campaign at startup, making it the *only* path by which `/play/` obtains content. It introduces a second serialized representation of a campaign beside `BuiltCampaign`, and a data-driven `PortableMigration` that reconstitutes `Campaign.migrateState` — a function JSON cannot carry. Reconciliation found it by comparing package exports against every name in `design/`.
The concrete falsehood it left behind: `13-playable-web-demo.md` §6 said "The static deployment performs no runtime network request. Engine code and Bureaucracy content are bundled at build time," and `14-game-interface.md` §9 said the build "makes no runtime network request for engine or campaign content." Both were true of W61 and neither survived PR #224. Nothing caught it because nothing asserts it — `site/scripts/verify-build.mjs` scans for `node:` specifiers and dev paths and says nothing about requests.
Chosen: Specify what shipped and keep the code. §6 is restated to separate the two halves — engine code is bundled, campaign content is fetched same-origin from files the deployment already contains — and to state plainly what that costs (a round-trip to *start*, and a start-up failure the §9 error boundary owns) alongside the three properties that genuinely survive: no backend or engine API, an outage after load cannot change an outcome, and no third-party request. 14 §9 and 15 §6's smoke are brought into line. The missing gate is **W70**, not assumed: an assertion over the emitted bundle with a committed negative fixture, because a restated claim with no check is the same unasserted property 13 §4 already refused for `node:` specifiers.
Rejected: **Revert to build-time bundling and keep the documents as written** — rejected on cost, not principle. It would delete a pipeline nine campaigns and the live shelf depend on, and reinstate the index-coupled parallel-array defect between `built[]` and `descriptions[]` that the spike existed to remove — a positional coupling of the same shape as this repository's envelope-duplication ledger. **Write the gate in this reconciliation rather than slicing it** — rejected; a reconciliation edits documents, and a browser assertion with a negative fixture is a unit of work, not a documentation correction. **Leave the module labelled a throwaway spike** — rejected outright; it is in the package's exported surface at `0.5.0` (version bumped, not yet published — the registry's latest is still `0.4.0`), so un-exporting it is already breaking once that version ships, which is the same reasoning that made `TextClient` and `buildContentRegistry` sanctioned rather than tolerated.
Reversibility: moderate — `PortableCampaign` becomes a compatibility surface now that it is specified, and the ten committed JSON files are the deployed content; the documentation half is cheap, the format is not.

### 2026-08-09 — `RecordIdSource` is a second port beside `IdSource`, not a widening of it
Context: S1 (commit `42f34f6`, version bumped to `0.5.0`, not yet published) added `RecordIdSource { newSessionId, newSaveId }`, `SessionHost.recordIds?`, `defaultRecordIdSource`, and root exports of both — and touched **no file under `design/`**. No slice, no contract section, no register entry. `06-extensibility.md` §6 is a six-step checklist for exactly this, and none of steps 3–6 were run: no seam-map row, no catalogue entry, no stated implementer obligations, no determinism assertion. `session/store.ts` cited "20-contract.md's `RecordIdSource`", a section that did not exist. Found by comparing package-root exports against every name in `design/`.
Chosen: Document the port as built, retroactively completing §6's checklist — a seam-map row in 06 §3, the field on §4's `SessionHost`, a full §5.7 entry with obligations, and a paragraph in `20-contract.md` §7.2 where the two ids are actually minted. The source citation now points at 06 §5.7. The design is right and worth keeping: `IdSource` supplies `gameId` and `seed`, which are written into the envelope and are replay inputs; a session id and a save id are never in `GameState` at all — they key `StoredSessionRecord`/`StoredSaveRecord`, which is host metadata by construction. Two ports keep that distinction visible; the obligations that were missing are the ones a host actually needs (uniqueness within the store, never derived from game state, `traceId`/`spanId` not covered).
Rejected: **Widen `IdSource` with the two members and delete `RecordIdSource`** — rejected on both counts: it will be breaking for `0.5.0` consumers once that version ships, and it collapses "an opaque input the engine records" into "a key the engine never sees," so a host wanting deterministic save ids would also be redefining the game's seed. **Leave it undocumented because the default makes it invisible** — rejected; an optional port with a working default is exactly the kind of surface that gets discovered by grep years later, which is what §6 exists to prevent, and it is already committed to ship at `0.5.0`.
Reversibility: cheap as documentation; the port is part of the `0.5.0` exported surface (not yet published), so narrowing or removing it once published is breaking.

### 2026-08-09 — Three registry-and-vocabulary statements corrected against W58/W59
Context: Reconciliation against the built content-pack machinery found three places where the documents and the code disagreed, each in a different direction, none of them behavioural. (1) `20-contract.md` §12's `BASE_REASON_CODES` stopped at `achievement_unlocked`; `core/kernel/reasons.ts` ships six more from W58 (`pack_kind_mismatch`, `duplicate_campaign_id_in_pack`, `pack_dependency_missing`, `pack_dependency_version_conflict`, `pack_dependency_cycle`, `pack_override_unexpected`), each with a `core.reason.*` message. (2) `ContentRegistry.resolution` was declared three ways: absent from 04 §10.1, **required** in 11 §4, **optional** in `registry/types.ts`. (3) 11 §7 said pack resolution "adds three checks"; `registry/packs.ts` runs four — the fourth rejects a pack writing into `core.reason.*`.
Chosen: The code is correct in all three, and the documents move. The six codes join §12's list with a `content-pack resolution` comment and enter §12's own growth tally; §12 already instructs that the list be kept in step with `reasons.ts`, and codes are additive and never renamed, so this costs nothing. `resolution` becomes optional in both documents with the reason stated once in each: `buildContentRegistry` knows no packs exist, and requiring the field would mean manufacturing a digest over content that came from no pack — which under 11 §6 changes `campaignVersion`, and therefore the version every existing save records. §7 gains the protected-namespace row, stated as the rule 04 §12 already applies at assembly rather than as a new one, because a pack is a second way into the same string table and would otherwise be the one path by which a campaign *could* restyle an engine-level error.
Rejected: **Replace §12's literal array with a pointer to `reasons.ts`** on single ownership — genuinely tempting, and rejected because §12's commentary on *why* each group was added is the part a reader needs, and a pointer loses it; the list is restated deliberately and §12 already names the file that governs. **Make `resolution` required and have `buildContentRegistry` compute one** — rejected; it invents identity for content that has none and rewrites `campaignVersion` for every existing single-campaign registry. **Correct only 11 §4 and leave 04 §10.1's interface at its pre-pack shape** — rejected; §10.1 is the canonical `ContentRegistry` block, so a reader of the core contract would see an incomplete type.
Reversibility: cheap — documentation only; no code, no shipped behaviour, no serialized bytes changed.

### 2026-08-09 — Four design statements that had gone false about built code
Context: Reconciliation found four places describing shipped machinery as unbuilt. `07-replay.md` §3.2 said `createSessionLayer`/`SessionHost` is "specified but unbuilt" — it ships and is exported, and this register recorded the build on 2026-08-06. `10-design.md` 06 §4 annotated `experiments` as "not built" — W59 built the port, `applyExperimentGates`, `resolveBucketKey` and `resolveExperimentAssignments`, all root-exported. `30-slices.md`'s content-pack entry still instructed a future implementer to "add `ExperimentSource`" to `composition/types.ts`, where it already is, and its Known Open Items still carried the `SessionHost`/`createSessionLayer` reconciliation as open.
Chosen: Correct all four in place. §3.2 now says the root ships and that the replay runner bypasses it for its own stated reason — it needs the raw `GameState` no `SessionStore` returns — rather than for want of a root. 06 §4 replaces "not built" with what is actually missing: the *field's consumer*, because the session layer receives an already-resolved `ContentRegistry` and never the candidate pack array, so it cannot derive the `experimentId` set an assignment map is keyed by. That is a contract question, not an unwritten function, and it stays pointed here. The two ledger entries are ticked and restated.
Rejected: **Leave them and rely on this register**, on the grounds that its amendments are already correct — rejected for the reason this register keeps re-learning: a reader hits the specification before the decision log, so the stale sentence is the one that briefs them. **Delete 06 §4's `experiments` field until its consumer exists** — rejected; the field is exported at `0.5.0`, and removing a declared port to make a comment true would be the specification chasing the documentation.
Reversibility: cheap — documentation only.

### 2026-08-09 — Five composition-root and sink declarations corrected against the shipped surface
Context: A `/contract` derivation pass compared `20-contract.md` against `10-design.md` and against the package-root exports, and found five stale, missing, or misnamed declarations — none behavioural, all in the artifact that constrains an implementing agent. (1) `20-contract.md` §4's normative code block declared `createEngine(registry, kinds, emitter?)`, the pre-`IdSource` positional form; the shipped `createEngine(host: EngineHost)` appeared only inside the following blockquote. (2) `10-design.md` 05 §4 restated `KindContext` in full and its copy was missing `derive`, and restated the same superseded `createEngine` with no supersession note — while 05 §9 and §6.1 restate `Kind` and `Engine` *elliptically*, which is the convention the two full copies had drifted out of. (3) `EmittedRecordSink` is required by `SessionHost.recordSink` and exported from the package root, but was declared in no `design/` file; separately 05 §10 opened "A sink is an `Emitter` implementation" and listed `jsonlEmitter` under it, which `core/observability/types.ts` explicitly contradicts. (4) `WorldGraphOutcome` is exported from the package root; world-graph §8 stated the identical shape as an anonymous return literal and never named it. (5) `20-contract.md` §14 and 05 §10 both named `recordingEmitter`; the shipped export is `createRecordingEmitter`, a factory.
Chosen: The code is correct in all five, and the documents move. §4's block becomes `createEngine(host: EngineHost): Engine` with the positional form kept as provenance in the callout rather than as the declaration. 05 §4's two copies become elliptical. 05 §10 declares `EmittedRecordSink` and splits its table by type, stating the rule that decides which a sink is — a core-layer sink sees only the bare `EngineEvent`, a boundary sink sees the stamped `EmittedRecord`, and only the latter may see `emittedAt`/`traceId`/`spanId`/`attempt` because none is derivable from `{seed, actionLog}`. World-graph §8 names `WorldGraphOutcome`, with the reason stated as the export itself and the note that nothing imports it yet. Both `recordingEmitter` sites become `createRecordingEmitter()`.
Rejected: **Declare `EngineHost` inline in `20-contract.md`** — rejected; it would be a sixth type declared in both files, which is the drift surface findings (2) and (3) came from, and the contract already cites `Emitter`, `EventName`, `ResolutionEmitter` and `ResolutionId` into the design the same way. **Sync 05 §4's full copies rather than making them elliptical** — rejected; two live copies of a contract-owned type is a promise the next seam change re-opens this exact gap, and `derive` is load-bearing for world-graph batch invariance. **Un-export `WorldGraphOutcome`, keeping all three kinds' outcome shapes anonymous** — rejected; a breaking change to the `0.5.0` surface (version bumped, not yet published) to avoid naming three fields the contract already lists. **Rename the export to `recordingEmitter` to match the documents** — rejected; the factory/value asymmetry is real, since a recording sink holds state and `nullEmitter` does not, so the documents should carry it rather than flatten it.
Reversibility: cheap — documentation only; no code, no shipped behaviour, no serialized bytes changed. `WorldGraphOutcome` and `EmittedRecordSink` become specified compatibility surfaces now that they are named, which is what they already were as exports.

### 2026-08-10 — `week_limit_reached`'s precedence against `goals_met`/`failed` settled, and how `outcome()` learns it at all
Context: W57's issue named an explicit blocker: `20-contract.md` §12 called `week_limit_reached`'s precedence against `goals_met` "genuinely open — not merely undocumented here, but unresolved in the upstream source this section would port from," and the 2026-08-06 entry above deliberately left it that way, reasoning "the first real multi-goal scenario is what should settle it, not a function that needed a total signature." W57 is that scenario — it is the unit that dispatches `week_limit_reached` for the first time — so the deferral had reached the point it was deferred to. A second, sharper problem sat underneath the precedence question: `Kind.outcome(state: KState)` (04 §3) receives no campaign, so `ScenarioDefinition.weekLimit` is not reachable from `outcome()` at all, precedence aside — the header comment `state` alone carries no `weekLimit` was not a phrasing gap, it was a real seam problem no ordering decision could fix by itself.
Chosen: Two changes, made together because the second is what makes the first checkable. (1) Precedence: `goals`/`failure` always win. `week_limit_reached` is reported only for a week that resolves neither a goal nor a failure — the same reasoning already adopted for `goalFailurePrecedence`'s `"goals_win"` default (§3): the alternative reports the worst available ending for a player who did everything asked, over a clock edge they had no way to see coming, and the symmetric case (a week that both fails and exhausts the limit) reports the more specific `failed`. (2) Mechanism: `SimulationKindState` gains `resolution: SimulationResolution | null` (§2, §12), written once by a new `week_limit` system inserted into `END_WEEK_SYSTEM_ORDER` (§3) directly after `failure` and before `achievements` — only when `state.resolution` is still `null` at that point. `outcome()` now reads `state.resolution` back rather than attempting to compute it, which is exactly the pattern `12-world-graph-kind.md` §8's `WorldGraphKindState.resolution` already established for the identical structural reason (a campaign-only fact that a state-only function must still report). `achievements` runs after `week_limit` so an achievement condition can see the final resolution, consistent with W57.5 already requiring it run after `goals`/`failure`.
Rejected: **Give `outcome()` a second parameter carrying the campaign** — rejected; it would be the one kind whose `Kind.outcome` signature diverges from `story-graph` and `world-graph`, both of which manage an identical class of problem (terminal identity needing campaign-only facts) by writing the fact onto state instead. **Leave the precedence open and dispatch `week_limit_reached` only for weeks where no goal exists to compete with it** — rejected; every shipped scenario declares goals, so this would make the reason code permanently unreachable in practice, the exact "specified, not yet dispatched" status W57 exists to close. **Default to `"failure_wins"`-style behaviour, i.e. let `week_limit_reached` pre-empt a same-week `goals_met`** — rejected; it inverts the `goals_win` reasoning this contract already committed to for the adjacent tie, with no stated reason a clock-based ending should be treated more harshly than an authored failure condition.
Reversibility: moderate — `SimulationKindState.resolution` and `SimulationResolution` are new contract surface a W57 implementation will serialize; narrowing the precedence rule later is cheap as documentation but changes committed replay/outcome fixtures once code exists behind it.

### 2026-08-10 — `/play/` is retired in fact, and three design blocks are brought into line
Context: W69 ([PR #272](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/272)) dropped `/play/` from the site build while extracting the landing-page toolchain: `site/landing.config.ts` declares `/` and `/roadmap/` only, the `cta-play` link and its stylesheet rule came out of `App.tsx`/`landing.css`, the nav and CTA now point at `https://adventures.subzerodev.com`, and the follow-up narrowed `StaticArtifact.RequiredRelativePaths` and `host-image.yml`'s smoke to three routes. `30-slices.md` recorded all of it well — W69's status block names the W69.4 deviation, W68 and W70 are marked cancelled, and the lost browser smoke is [issue #273](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/273) — but the decision itself was never written here, and three design blocks still specified the route as shipped: `13-playable-web-demo.md` throughout (in the *future* tense, as a retirement in progress), `14-game-interface.md` §9 (outside Revision 3's stated §§1–8 historical range, so it read as live), and `15-platform-static-host.md` §4/§6 (Revision 1, an agreed W62 build target, with no historical marker at all).
Chosen: Record the retirement as a decision, and correct all three. `13` becomes Revision 4 — every future-tense retirement sentence moves to past tense, and its historical note now names the two consequences a reader would otherwise discover: §6's same-origin `campaigns/` fetch has no caller, so nine campaign JSON files and a manifest (781 KB) still ship in every artifact with nothing reading them, and §7's "a direct static request to `/play/` succeeds" is asserted by nothing because there is no such route. `14` becomes Revision 4 and extends its historical range to §§1–12, naming §9's stale delivery claim specifically. `15` is handled in its own entry below. One thing is stated rather than left to inference: **`site/src/play/` is still in the tree and still runs** — `09-clients.md` §4's browser-demo column cites `site/src/play/browser-client.test.ts`, which executes under both site test configurations, so the directory is live evidence for a live claim, not dead code awaiting deletion.
Rejected: **Leave the three blocks and rely on `30-slices.md`** — rejected for the reason this register keeps re-learning (2026-08-09, *Four design statements that had gone false*): a reader hits the specification before the ledger, so the stale sentence is the one that briefs them. **Delete `13` and `14` outright now that the route is gone** — rejected; `13` §3's dependency direction and §4's package constraints both outlive the route, and the record of what the first public browser client was is worth keeping. **Also remove `site/public/campaigns/` and `site/src/play/` in this pass** — rejected on scope: a reconciliation edits documents, and deleting a test suite that backs a ticked box in `09-clients.md` §4 is a work unit with its own argument to make. Revisit when: someone proposes removing either — the answer for `site/public/campaigns/` is probably yes and for `site/src/play/` probably no, and they should be decided separately rather than as one cleanup.
Reversibility: cheap as documentation. The route removal itself is W69's and is not.

### 2026-08-10 — `13` §4's browser-portability gate is deleted rather than replaced
Context: §4 is the section `13`'s own Revision 3 header named as *surviving* the Adventures move — "whichever repository ships a browser build, this section governs it" — and Revision 2 had deliberately strengthened it from "the bundler would have complained" into an assertion over the emitted bundle (2026-08-06, *The browser bundle gate becomes an assertion*). W69 made that assertion vacuous: `/play/` was the only route importing `@the-running-dev/game-engine`, so `site/scripts/verify-build.mjs`'s scan for `node:` specifiers and Node globals now runs over `dist/assets/*.js` bundles that contain no engine code. It passes, and guards nothing. Nothing reported this, because a scan finding zero hits is indistinguishable from a scan with nothing to find.
Chosen: Remove the gate language from §4 and keep every constraint §4 places on the package. §4 now states what the engine must not contain and names Adventures — which ships a browser build and carries the same scan in its own `scripts/verify-build.mjs` — as where the shipped bytes are proved to comply. `site/scripts/verify-build.mjs`'s scan is left in place: it costs nothing, and it re-arms itself the moment a built route imports the engine again. Chosen by the maintainer over the two alternatives below.
Rejected: **Restate §4 the same way but slice a unit that builds a minimal browser entry importing the package root purely so the scan has a subject** — rejected on cost: a build artifact whose only purpose is to be scanned, plus a slice, to buy back a property a downstream repository already asserts. **Keep the gate language as written** — rejected outright; it would leave a green check documented as coverage it does not provide, which is the exact failure mode §4's own wording rejects one level down. The cost of the chosen option is real and is why it is recorded: this repository ships a package a downstream browser host depends on, and now has no local proof that package stays browser-portable, so a submodule bump can break Adventures while every gate here stays green. Revisit when: Adventures reports a portability break that originated here, or a second downstream browser consumer exists — either makes a local gate worth its cost.
Reversibility: cheap — the scan is still in the tree, so restoring the requirement is a documentation edit plus a subject for it to scan.

### 2026-08-10 — `15-platform-static-host.md` marked historical, with its route lists corrected anyway
Context: The block is Revision 1, "agreed W62 build target", and W62 shipped — `src/host/` is in the tree and `.github/workflows/host-image.yml` still builds, smokes and publishes an immutable GHCR image on every merge. It was also the only one of the three `/play/`-naming blocks with no historical marker, and §4/§6 still described a four-route artifact and a browser production smoke that W69 removed.
Chosen: Mark the whole block historical (Revision 2), on the maintainer's call, and correct §4's route list and §6's smoke list in the same pass rather than retiring a document that is also wrong about what it retired. The correction is small and factual: three routes, and the missing-artifact fixture that proves the startup guard fails red now deletes `roadmap/index.html` rather than `play/index.html`. The no-SPA-fallback property is untouched and still asserted.
Rejected: **Correct §4/§6 in place and leave the block live** — recommended by this reconciliation and not taken. The argument for it was that the host is not retired: it still runs, and retiring its only contract leaves a live workflow with nothing to check itself against. The maintainer's call stands and the cost is recorded here rather than argued again: `host-image.yml` is not one of the three required checks (`CLAUDE.md`, *Git and Pull Requests*) and W62 deploys nothing, so nothing is *gated* on the retired contract — but a future change to that workflow or to `src/host/` now has no specification to check itself against, and the next reader has no document saying whether the host is meant to survive. **Delete the block and the host together** — rejected; that is a work unit with its own argument, not a documentation edit. Revisit when: someone touches `src/host/` or `host-image.yml` — that is the moment the missing contract is felt, and the moment to decide whether the host follows the play surface out of this repository.
Reversibility: cheap as documentation. Whether the host itself stays is undecided and unaffected by this entry.

### 2026-08-10 — Three simulation-contract statements corrected against W56/W57
Context: Reconciliation found three places where `20-contract.md` and the shipped simulation kind disagreed, none behavioural, all in the artifact an implementing agent reads. (1) §10's audit table stopped at the W53/W54/W55 codes; `src/engine/src/kinds/simulation/reasons.ts` registers seventeen more from W56 (`action_shop`, `action_maintain_item`, `action_repair_item`, `action_sell_item`, `action_travel`, `action_socialize`, `action_exercise`, `item_condition_decayed`) and W57 (`action_respond_to_event`, `action_accept_opportunity`, `action_decline_opportunity`, `event_fired`, `opportunity_offered`, `opportunity_expired`, `opportunity_revoked`, `headline_shown`, `world_strangeness_shifted`), every one emitted and every one carrying a shipped message. (2) `04-core.md` §3 declares `Kind.reasonMessages` as "one entry per `reasonCodes`"; `simulationKind` merges one more — `simulation.finance.investment.label`, the `LocKey` on the fixed investment account its `invest` resolver creates, which no `SimulationCampaign` collection exists to author. (3) §15 still said "§3's fourteen end-of-week systems" after W57 inserted `week_limit`, in the same callout that had already removed two counts for being wrong within two units of being written.
Chosen: The code is correct in all three and the documents move. §10 gains four rows and a second callout paragraph naming the new failure direction — W56 and W57 *did* register at the point of emission, which is the discipline the existing callout asks for, and the table was what went stale, so nothing checks *registered → tabulated* any more than it checks *emitted → registered*. §3's `reasonMessages` comment now states the completeness rule exactly (`registered → has a message`, nothing more) and names the second use as a channel rather than leaving it to read as a violation: a kind's engine-created content can reference a `LocKey` with no campaign field behind it, and `reasonMessages` is a `Kind`'s only route into the merged registry. §15's count is deleted rather than corrected, pointing at §3's list as the one enumeration.
Rejected: **Replace §10's table with a pointer to `reasons.ts`** — the same temptation §12 already refused for `BASE_REASON_CODES`, and refused here for the same reason: the *emitted by* column is the part a reader needs and a pointer loses it. **Add a `Kind.engineMessages` field for the non-reason strings** — rejected as a contract change to tidy one key; a second optional map on the seam, implemented by one kind, is more surface than the sentence it replaces. **Correct §15's count to fifteen** — rejected; that callout has now been wrong three times, and a count that has to be re-derived on every unit is a red item by `CLAUDE.md`'s own table.
Reversibility: cheap — documentation only; no code, no shipped behaviour, no serialized bytes changed.

### 2026-08-12 — Kit re-install (af610a6): design freeze, `/done` auto-run, and a Hard Rules/Verification gap closed
Context: `/install` re-run against kit commit `af610a6` (previously synced at `9896915`/`78ff0de`). The kit gained a `design/FROZEN.md` freeze mechanism with `/freeze` and `/unfreeze` commands and a "Stop if `design/` is frozen" gate on `/design`, `/contract`, `/slices`, `/reconcile` and `/track`; changed `/done` from ask-once-then-delete to auto-run without asking plus optional `-AutoStash` on a dirty tree; and — found only now, having apparently never been carried over by any prior install — CLAUDE.md was missing the kit's "Hard rules" bullets (no new dependencies/public interfaces without a decision-log entry or contract amendment, ask instead of assuming, one unit at a time, every unit ends runnable) and two Verification rules (a regression test is verified by reverting the fix; a schema/validator change is not done until it has rejected something).
Chosen: Install all four. The freeze section and `/freeze`/`/unfreeze` commands were added to CLAUDE.md and the five gated command files, adapted to this repo's conventions (`CLAUDE.md` as the reference target, not `AGENTS.md`; "unit"/W-ids, not "slice"/S-ids). `/done` and `tools/Invoke-DoneHousekeeping.ps1` were updated to the kit's current versions (both were `WouldUpdated`, not locally modified, so no target edits were at risk), and a `/done` delegation paragraph was added to *Git and Pull Requests* to match — this repo had never stated the rule at all. The Hard Rules and the two Verification rules were added verbatim, adapted only for terminology.
Rejected: **Skip the design freeze** — the repository has already lived the exact failure it prevents (this file's own 2026-08-08 "known-and-retained gap list... gone stale twice" entry, and `agent.md`'s "hand-maintained list against code as a drift surface" lesson), so declining new tooling built for that failure would have needed a reason this repo doesn't have. **Keep `/done`'s ask-once behavior** — rejected because it would leave this repo permanently flagged `Divergent` against the kit's default with no local edit backing the divergence; if the ask-once behavior is ever wanted back deliberately, that is a fresh decision, not a default to fall back into. **Leave the Hard Rules/Verification gap unaddressed** — rejected; nothing in this repo's history suggested the omission was deliberate, and the cost of stating five bullet points and two sentences is negligible next to the cost of a future install re-discovering the same gap from scratch.
Reversibility: cheap — documentation and command-file text only; `/freeze` has not been invoked, so `design/FROZEN.md` does not exist and nothing is actually frozen yet.

### 2026-08-12 — Published narrative content moves to Adventures.Content through an authoring seam
Context: nine narrative campaigns had become both Engine fixtures and the publication source,
while Adventures.Content already deployed their portable JSON. The portable format is no longer
a spike: hosts use `fromPortable` and manifest digests in production. Keeping campaign builders
on the package root made authored content look like a runtime dependency and made the Content
repository depend on Engine-private paths.

Chosen: `SubZeroDev.Adventures.Content` owns the nine published narrative sources and their
exporter. GameEngine adds `@the-running-dev/game-engine/authoring` for the shared story-graph
and adventure builders, portable author-time APIs, and replay helpers. The root keeps runtime
APIs only. A frozen `bulgaria-bureaucracy` remains Engine-owned regression evidence, never a
manifest entry or root export. The change is staged: `0.7.0` adds the subpath; `0.8.0` removes
the published sources and retired `/play/` artifacts after Content deployment.

Rejected: moving the shared adventure builder out of GameEngine — it is a reusable authoring
primitive and the retained regression fixture needs it. Retaining the in-repository `/play/`
artifact after its route retired — it ships unused content and has no live consumer.
Reversibility: the additive seam is cheap to revert before adoption; removing root exports is a
deliberate pre-1.0 breaking release, coordinated with Adventures and Content.

### 2026-08-13 — An adapter exception may be classified, once, and `concurrent_modification` is that once
Context: PR #306 (`slice/S1`, draft) added a `SessionPersistenceConflict` brand, a
`concurrent_modification` reason code, and root exports of both, mapping a branded session-write
failure away from `storage_failure`. `20-contract.md` §7.2 said the opposite in terms — "An
adapter throwing is `storage_failure`, **always**" — and the branch touched no file under
`design/`, which is the same defect this register already recorded against the earlier `S1`
(`42f34f6`, `RecordIdSource`): root exports, no slice, no contract section, no register entry.
The work itself is sound and could only live here, because the reason-code vocabulary is
engine-owned and no host can extend it. §7's two lock domains are the reason it is needed at
all: per-`sessionId` locking orders operations within one store instance, and a host running
several instances over one database has sessions nothing here serializes.
Chosen: Amend §7.2 rather than accept the code against a contradicting contract. The default is
unchanged and restated — any adapter exception is `storage_failure` — with exactly one carve-out,
bounded by two rules that preserve the original argument: the vocabulary stays closed (one brand,
one code, no host-extensible path), and a classified failure must be one the caller can act on
differently, which "re-read and retry" is and a quota error is not. The brand is a string on
`name`, not an `instanceof` check, so it survives a duplicated copy of the package. §12's list
and its growth tally move from host persistence's three codes to four, and `06-extensibility.md`
§5.2 gains the implementer obligation that was missing — brand a lost update and nothing else.
§7.2 also now states the invariant the implementation must satisfy: a rejected write may not
leave the store's cache ahead of persistence. `submitAction` mutates a cached record in place
before persisting it, and `getSession` is cache-first, so a conflict there would serve the
un-persisted state back to the retry the new message asks for. `storage_failure` tolerated that
divergence because its message promises only that the game is still playable; this code does not.
Rejected: **Take the code as written and leave §7.2 alone** — rejected outright; it is the hard
rule about interfaces absent from `20-contract.md`, and an invariant stated in the emphatic form
"always" is exactly the kind a later reader trusts without checking. **Reject the classification
and keep §7.2 as written** — rejected on the merits, not on process: the "a client can do nothing
different about either" prong is simply false for a lost update, and the alternative leaves a
host signalling conflicts outside the vocabulary, which is the unbounded surface §7.2 exists to
prevent. **Classify save writes and reads the same way** — rejected for now; the asymmetry is
deliberate and stays stated, and [issue #226](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/226)
already owns the save-side race. Revisit when that issue is resolved.
Reversibility: moderate. The documentation half is cheap, but `SESSION_PERSISTENCE_CONFLICT` and
`SessionPersistenceConflict` become root exports once the implementing unit lands, so narrowing
or removing them after that release is breaking.

### 2026-08-13 — W75's code landed with its own contract amendment, because the branch was cut from the draft
Context: the amendment recorded above was authored on a branch cut from `d44afde` — the `slice/S1`
draft's commit, open as PR #306 — rather than from `main`. Merging it (PR #307) therefore carried
six engine files onto `main` alongside the documentation, and that PR's description said
"documentation only" because it was written from the authoring commit's diff rather than the pull
request's cumulative diff against its base. Nothing broke: the three engine gates were run and
passed, and the code that landed is exactly what the amendment legitimises. But it landed in the
opposite order from the one this register argued for one entry earlier, and it landed unreviewed
as code, having been reviewed as prose.
Chosen: Keep the code and correct the record rather than revert. Reverting would remove a mapping
the contract now permits, to re-land it unchanged. `30-slices.md`'s W75 is restated to complete
rather than implement — `W75.1`, `W75.2`, `W75.3` and `W75.5` are marked as arrived, `W75.4` and
`W75.6` stay open, and ids are retained rather than renumbered so which-arrived-how stays legible.
PR #306 is closed as its commit is already on `main`, PR #307's description carries a correction
at the top, and issue #308 is rescoped to match.
The generalisable part is the check that was missing, not the mistake: **a pull request's scope
claim must be read off the base-to-head diff, never off the authoring commit.** A branch cut from
another branch's tip is invisible in `git status`, in the working-tree diff, and in the commit
being written — the three places a scope claim is usually checked. `git diff --stat <base>...HEAD`
is where it shows, and it is the one that governs.
Rejected: **Revert `d44afde` from `main` and re-land it under `/slice W75`** — rejected on cost.
It buys process fidelity and nothing else: the contract now permits the mapping, the tests pass,
and the re-land would be byte-identical. **Leave `30-slices.md` describing this unit as the code**
— rejected outright; `/slice` reads that file, not the issue, so a stale entry would have the next
session reimplement four criteria that already exist, which is precisely the drift this repository
keeps paying for.
Reversibility: cheap as documentation. The code is on `main` and shipping, so `W75.4` is now a
defect against a released behaviour rather than an unwritten criterion.

### 2026-08-13 — Fifteen command cores migrated to the kit's current version; thirteen gained a terse `vocabulary` companion (issue #309)
Context: `Kit Update` (#305) shipped `.claude/COMPANIONS.md` and `tools/Test-Companion.ps1`, which
require every `.claude/commands/*.md` core to declare a `<!-- companion:start -->` block. Only the
six cores #305 itself touched (`brief-check`, `done`, `fix`, `install`, `kit-sync`, `verify`) got
one; the other fifteen were left on pre-split bodies, failing `powershell` on every PR since.
Investigating (issue #309) found the validator is not the defect: `SubZeroDev.AgentKit`'s current
HEAD already carries the block on all twenty-one cores, added in the same commit (`4f3d988`) that
introduced the split, and its own CI already runs `Test-Companion.ps1`. The gap is local — this
repository's `.claude/kit.json` records `syncedCommit` at that same kit HEAD, but `Sync-Kit.ps1`
correctly left the fifteen divergent cores alone as `Unmigrated-Blocked`, since overwriting a local
edit with no companion to receive it is exactly what the split exists to prevent.
Chosen: adopt the kit's current core text for all fifteen. Diffing each against its kit version
found two kinds of local content the pre-split bodies had carried: prose "repository overlay"
paragraphs about `design/`'s compound files and generation workflow (already stated, in more
detail, in `CLAUDE.md` itself — a companion repeating it would be the second copy *Single
Ownership* forbids, and INSTALL.md's own "rules the target already states" step calls this outcome
`Already satisfied`), and literal `AGENTS.md`/`S<n>` references the core text uses generically that
this repository's own vocabulary — `CLAUDE.md`, the retained `W<n>` id scheme — actually names.
The second kind is exactly what `.claude/COMPANIONS.md`'s `vocabulary` category exists for, so
thirteen of the fifteen (all but `install-all` and `make-human-docs`, neither of which names this
repository specifically) got a short `-local.md` stating the substitution — not a restatement of
what the substituted text says. `pr.md` additionally gained a `tightened-authorization` section:
its kit core reads "never open a pull request as a draft," but `CLAUDE.md`, *Git and Pull Requests*
carves `/slice` out to open its PR as a draft and requires `/pr` to ask before marking it ready —
narrower than the core, and exactly the category's shape. `slice.md`'s core states the same
"never as a draft" line and does not allow `tightened-authorization` in its declared category
list, so it carries no override; `CLAUDE.md`'s own rule still governs in practice, since
`.claude/COMPANIONS.md`'s *Never* list makes a repository's instruction file outrank a core
regardless of what the core's declared categories permit — recorded here as a known, accepted gap
rather than silently left unexplained, and named as a candidate for a `SubZeroDev.AgentKit` issue
if `slice.md` should allow the category it is missing.
Rejected: **no companions at all**, matching the six cores #305 already merged verbatim — rejected
once the diff showed real, repository-specific substitutions (not just paraphrase) that
`.claude/COMPANIONS.md`'s `vocabulary` category was written for; leaving them unstated would have
been the same gap this repository's own history (2026-08-04, "`8d4ffdb` upgrade") already paid to
close once. **Full "repository overlay" paragraphs restored per file**, matching the pre-split
bodies almost verbatim — rejected as the duplicate `CLAUDE.md` content Single Ownership forbids,
now that a companion is not the only place that content could live. **Leave the fifteen cores as
they were and correct the checker instead** — the issue's own original second checkbox — rejected
once the checker was confirmed correct and already fixed upstream; the fifteen files, not
`Test-Companion.ps1`, were behind.
Reversibility: cheap — command-file and companion text only, and `Sync-Kit.ps1`'s own mechanism
(`Superseded`, once a companion exists) means any of these can gain a fuller companion later
without touching this entry.

### 2026-08-11 — The portable format graduated, and a frozen primitive was widened, in the same release window
Context: found by reconciliation, not by review. Two releases landed with no entry here at all —
the register jumps 2026-08-10 to 2026-08-12. `6991e37` (0.6.0) graduated the portable campaign
format out of spike status: `fromPortable`, `digestPortableCampaign` and the six `Portable*`
types became real contract exports, the `// SPIKE` marker was removed, and
`SubZeroDev.ServiceContract` now projects its content schema straight from `PortableCampaign`.
`ec92fba` (0.6.1) then made `ComparisonCondition.value` optional. Both are public types crossing
into or moving within contract status without a slice, which is the same defect this register
recorded twice against `S1` (`42f34f6`, `a349c2a`): root exports, no slice, no register entry.
Chosen: Record both, as one entry, and keep both changes. The graduation is what §19 already
describes as the end state and what the first downstream host had in practice been depending on
regardless — the alternative was leaving a live production dependency marked unsanctioned. The
widening is correct on the merits: `not_equals` against an absent field is authored as
`value: undefined`, and `JSON.stringify` drops an undefined-valued key, so a required `value` was
strictly stricter than any document this engine has ever emitted; `compare` already read a
missing `value` and an explicit `undefined` one identically, making it a type-only change. §18's
restated shape is corrected to match in the same pass.
Rejected: **Treat the widening as an unauthorised change to a frozen primitive and revert it** —
rejected on the merits. §18 freezes the *operator set*, and the bar it sets is against additions
that each cost validation, evaluation, projection, migration and tooling; an optional marker on
an existing field adds no operator and costs none of that. **Record only the widening and let
§19 stand for the graduation** — rejected because §19 records what is true now and not what was
decided or what was rejected, which is the whole job of this file.
Reversibility: the graduation is expensive to reverse — the exports are consumed downstream and
un-exporting them is breaking. The widening is cheap in this repository and moderate outside it:
narrowing `value?:` back to `value:` would reject documents a generated validator now accepts.

### 2026-08-13 — The 0.8.0 peg moved to 0.9.0, because 0.8.0 was spent on an additive release
Context: `20-contract.md` §19 and `10-design.md` §13 staged W74's ownership move as "root exports
stay through 0.7.0; the breaking 0.8.0 release removes them." W75's fix then bumped
`src/engine/package.json` from `0.7.0` to `0.8.0` and `v0.8.0` was tagged at `f00bb43`, the tip of
`main` — with every published campaign builder still a root export, `site/src/play/` still present,
and `scripts/export-campaigns.ts` still generating campaign files. Neither `0.6.x` nor `0.7.0` was
ever tagged, so `0.8.0` is the released version. W74.5 is honestly unstarted and gated on Content
having deployed; the defect is the peg, not the schedule.
Chosen: Re-peg both statements to "through 0.8.0 … the breaking 0.9.0 release," and add a line to
§19 recording that the peg has moved once, so the next bump checks this section first. The code is
correct and W74.5's criteria in `30-slices.md` are untouched.
Rejected: **Drop the version peg entirely** and name the change without a number — immune to
recurrence, but Adventures and Content are coordinating against exactly that number, and a
consumer's whole reason to read this section is to learn which upgrade breaks them. **Land the
removal now so 0.8.0 means what §19 said** — rejected outright: that is W74.5, a unit of work with
its own criteria and a cross-repository dependency, and a reconciliation pass implementing it is
the churn loop the design freeze exists to escape.
Reversibility: cheap — two canonical lines, plus a regenerate and re-stamp.

### 2026-08-13 — `submitAction` rolls back all three fields of a refused write, not two
Context: §7.2's blockquote, added eight days earlier, requires that a rejected write leave nothing
behind — "restore or evict that record when the write throws." W75.4 implemented it for
`record.blob` and `record.updatedAt`. `record.attemptCounter`, incremented before dispatch inside
the session lock, was left raised, and it is a field of `StoredSessionRecord` that the same refused
`put` carried. Because `getSession` is cache-first, nothing re-synced it: the cache stayed one
attempt ahead of persistence for the life of the session, and the stored counter skipped a value on
the next accepted write.
Chosen: Restore the counter alongside the other two, and extend the W75.4 test to assert it — the
counter is only observable on the next accepted write, so the test submits again and asserts the
persisted record carries `1`. Verified by reverting the fix: the assertion fails with
`attemptCounter: 2`.
Rejected: **Amend §7.2 to exempt the counter** — arguably the truer semantics, since a submission
that reached dispatch is an attempt whether or not its write survived. Rejected on two grounds: it
narrows a rule written eight days ago to fit the code that missed it, and §7.2 is a contract-
amendment surface that belongs to `/contract`, not to a reconciliation pass. **Record it as
known-and-retained** — rejected; the impact is small (trace stamping and a skipped counter value,
never `serialize()` output), but a stated invariant knowingly left unmet is what the envelope-
duplication ledger is made of.
Reversibility: cheap — three lines of code and one assertion.

### 2026-08-18 — A pack's `version` is a digest of what it ships, not a hand-written semver
Context: `11-content-packs.md` §6 makes `campaignVersion` identify the *resolution*, and
`computeResolutionId` digests the ordered `{id, version}` list of the resolved packs. That promise
holds only if a pack's `version` moves whenever the pack's content moves, and §6 never says how
that is guaranteed — it reads as a published version an author maintains by hand. W71 found the
guarantee cannot be a rule someone remembers: neither shipped pack authors its campaign in
`campaigns/stable-life-packs.ts`. The base pack builds from `stable-life.ts`, which has already
grown three times (W52, W53, W54) for reasons unrelated to packs; the Bulgarian pack builds from
`bulgaria-stable-life.ts`, authored independently. Nothing would have signalled to either file's
author that a constant in a third file had to move with theirs. The failure is silent and lands in
replay: a fixture captured under an older content set replays against different content and reports
`diverged`, when the honest verdict is `campaign_version_missing` (`07-replay.md` §6).
Chosen: Derive the version as `1.0.0+<canonical-digest-12>` over the pack's campaigns and its
sorted string table, making the property self-enforcing rather than remembered. The `1.0.0` prefix
stays for humans — semver build metadata, and `PackRef` compares versions exactly, never as a
range. Strings are sorted rather than left in insertion order, because the digest names what a pack
ships and reordering an authoring file ships the same content. The campaign's fields are listed
rather than the campaign digested whole: `Campaign.migrateState` (04 §10.1) is an optional
*function* and `canonicalStringify` rejects one outright, so digesting whole would take the module
down at import time the first time a campaign gained a migration.
Rejected: **Hand-write `"1.0.0"` and state the discipline in `11-content-packs.md` §6** — rejected
on the evidence above; the rule would have to be honoured by authors of files that do not mention
packs. **Digest the `BuiltCampaign` whole** — rejected; it makes a future `migrateState` a
load-time crash rather than a supported field. **Leave the reasoning in the file header** —
rejected for the reason this register has twice already recorded (2026-08-06, simulation
`outcome()`; 2026-08-08, W53/W55 mechanism rules): a rule that only a source comment states is one
a document-first reader never learns, and this one is load-bearing for a promise made in a
different document.
Reversibility: cheap in code, expensive in consequence — changing how the version is derived
changes every resolution digest, hence every `campaignVersion`, hence every existing save's
recorded content identity. §6 already states that cost for pack reordering; it applies here too.

### 2026-08-20 — A late `wear` delta is rejected; a late `cleanliness` delta is not
Context: W83 gave system 14 (`cleanliness-wear`) the wear-hits-zero broken transition, and added a
validator forbidding `building_meter_delta` on every effect list owned by a system that runs after
14 and never defers to it — `objectives.onCompleted` (17), `failures.onTriggered` (18), and
`incidents.onResolve` on a duration-bearing incident (16). The reasoning was sound but the guard
was too wide, and it contradicted §9.2's own sentence, "Systems after 14 apply their own group
locally—effects never wait for the next tick without persisted state." A code review found the
divergence: an objective reward as ordinary as `onCompleted: [{ building_meter_delta, cleanliness,
+20 }]` is exactly what §9.2 licenses, and W83 rejected the entire campaign for it. The contract
and the code disagreed, and neither side had recorded a decision.
Chosen: Narrow the guard to `meter: "wear"`, and amend §9.2 to say so. Only `wear` has a status
transition hanging off it, so only `wear` can be silently wrong when applied late: it clamps
independently and can never reach §4.16's `broken`. `cleanliness` has no transition, so a late
cleanliness delta is merely clamped locally, which is the behaviour §9.2 already describes. This
closes the real gap while keeping an authoring capability the contract promised.
Rejected: **Amend §9.2 to match the wide guard** — no code change, but it costs the capability
outright: objectives and failures could never touch a building meter, even harmlessly, and the
contract would be narrowed to fit an implementation accident rather than a reason. **Drop the
guard entirely and leave §9.2 as written** — restores conformance with no doc edit, but reinstates
the trap: a wear delta authored on an objective or failure silently cannot break a building, which
is the class of latent content bug W83 existed to remove.
Reversibility: cheap — the guard is one condition and the §9.2 sentence is one clause. Widening it
back would reject content that is valid under this entry, so it is a one-way door for any campaign
authored against it.

### 2026-08-21 — `/verify`'s repo-specific gate table moves into a companion, not the core
Context: `/kit-sync` fast-forwarded `~/.agent-kit` and found this repository's `.claude/commands/verify.md`
edited with no `.claude/commands/verify-local.md` beside it — an `Unmigrated-Blocked` core, per
`.claude/COMPANIONS.md`. The edit was the repository's own gate table (`ci.yml`, `verify.yml`,
`docs-ci.yml`, `host-image.yml` steps and their local-run commands), which the kit's `verify.md`
core declares as the `gate-commands` category a companion may override.
Chosen: Move the gate table verbatim into `.claude/commands/verify-local.md` under a `## gate-commands`
heading, then let the sync take the core outright (`Superseded`). `Test-Companion.ps1` confirmed
the split (22 cores checked, 0 findings).
Rejected: **Leave the core edited and skip the sync for this file** — keeps the repository unable
to receive any future `verify.md` update without repeating this exact reconciliation.
Reversibility: cheap — the companion is one file under a declared category; deleting it reverts to
the kit's own default gate discovery.

### 2026-08-21 — The same kit sync's design-state self-tests are skipped, not satisfied
Context: the 693fa16 kit sync also brought `tools/Test-DesignState.Tests.ps1`,
`tools/Read-DesignState.Tests.ps1`, `tools/Update-DesignProjection.Tests.ps1` and
`tools/Test-CIWorkflow.Tests.ps1`. Each carries a Describe block asserting "against this
repository's own tree" — literal content of `~/.agent-kit`'s own `design/state/` (9 Contract
records, `design/state-index.md`, a specific decision file, a `Check the design state against
the tree` CI step with `GH_TOKEN`). That block is true of the kit repository, which has adopted
its own design-state mechanism, but this repository has not: the 2026-08-19 kit entry, "Design
state becomes addressable records...", scoped the mechanism as "proven on this repository's
[the kit's] own `design/` as its first and only migration; the eighteen installed targets get a
compatibility promise and are not migrated." The self-tests were never audited against that
promise, so `verify.yml`'s "Run Pester tests" step (`# verification: true`) went red here with
12 failures plus one `BeforeAll`/`AfterAll` abort (S12.6, `Remove-Item design/state` on a tree
that has none), none of which are a defect in this repository's own content.
Chosen: guard each self-referential `Describe`/`It` with `-Skip:` computed at Pester discovery
time from whether `design/state/` (or, for `Test-CIWorkflow.Tests.ps1`, the "Check the design
state against the tree" workflow step) exists in this repository — false and unevaluated rather
than a false pass or fail, mirroring how `Test-DesignState.ps1` itself already treats an
installed target's missing `design/state/` (S12.6: `StateSetAbsent`, exit 2, never a silent 0).
Rejected: **Adopt design-state here to satisfy the tests** — turns a CI fix into an unscoped
feature adoption the user did not ask for, against "one unit at a time." **Exclude these four
`.Tests.ps1` files from `Sync-Kit.ps1`'s copy** — leaves the underlying kit defect (a test suite
not scoped for its own compatibility promise) unfixed upstream, and silently drops future
coverage this repository's tools/*.ps1 counterparts still need. **Delete the self-referential
blocks entirely** — loses real regression coverage the kit repository itself relies on when this
file is later resynced there.
Reversibility: cheap here — four `-Skip:` guards, reverted by deleting them. Not yet applied
upstream: `~/.agent-kit`'s own copies of these four files carry the same unguarded blocks, so an
unmodified future `/kit-sync` will overwrite this fix. Worth raising with the kit maintainer
directly rather than resolving unattended from this repository.

### 2026-08-23 — Four `world-graph` event severities corrected against the source, three in the code
Context: `20-contract.md` §12 fixes a severity per event name, and `05-observability.md` §7 states
why — "a given name always means the same thing to an alert" — with §12's own volume callout
making severity the operational control for a batch that emits on the order of 10⁵ events. Four
rows disagreed with `src/engine/src/kinds/world-graph/tick/pipeline.ts`: `guest.spawned`
(`trace` specified, `debug` emitted), `guest.served` (`trace`/`info`), `incident.resolved`
(`debug`/`info`, at both its call sites), and `tick.finalized` (`trace`/`debug`). All four date
from W46/W47 on 2026-08-03/04 and survived four reconciliations. `simulation` and `story-graph`
severities both matched their tables exactly; the divergence was world-graph-only.
Chosen: Split by row rather than by document. **The code moved for three.** `guest.served` was the
sharpest — §7 defines `info` as "one or a few per action" and this fires once per guest served per
tick, so a 360-tick batch put five-figure volume into the level a host runs to see notable things;
`guest.spawned` and `tick.finalized` are per-guest and per-tick on the same argument. **The
contract moved for one.** `incident.resolved` is now `info`, matching the code: incidents are rare,
and §12 already listed its sibling `incident.raised` at `info`, so raised-at-`info` and
resolved-at-`debug` would leave a host filtering at `info` watching incidents appear and never
resolve. §12 also gains a standing instruction to re-derive the severity column from the source
rather than from memory.
Rejected: **Move the code in all four** — the tidier rule ("the contract wins"), but it buys
consistency with a table at the cost of coherence between two halves of one transition.
**Move the contract in all four** — concedes the volume argument §12's own callout makes, and
would leave `05` §7's severity ladder describing something the shipped engine does not do.
Reversibility: cheap — three severity literals and one table cell.

### 2026-08-23 — `requirement.evaluated` short-circuits, and reports each leaf by `not` parity
Context: `20-contract.md` §8.4 said this event fires "once per requirement". W86 shipped it firing
once per *evaluated* leaf: `evaluateRequirements` in `src/engine/src/kinds/story-graph/advance.ts`
short-circuits `all`/`any` in parity with the frozen `evaluateCondition` (04 §18), and negates a
leaf's reported `satisfied` by the parity of the enclosing `not`s. Both behaviours came out of
PR #362's review and were written only into that function's doc comment, so the contract described
neither.
Chosen: Amend §8.4 to describe what ships, and record the reasoning here rather than leaving it in
a file header. The short-circuit is load-bearing, not incidental: a comparison against a
type-mismatched operand *throws*, so the guard-then-typed-compare idiom (`all: [x is set, x > 3]`)
only stays a clean `requirement_unmet` rejection while the guard can stop the walk — an eager walk
would buy one extra `trace` event and turn that rejection into a thrown engine error on a campaign
`availableActions` had already greyed out. Under `all` the short-circuit lands on exactly the
clause §8.4 exists to name. The parity rule follows from the event being the *only* signal a
negated requirement produces: `not: { achieved.bribed == true }` against a player who holds it is a
requirement that failed, and reporting the raw leaf value tells the author the opposite of what
happened. Under `not: { all: […] }` De Morgan makes per-leaf negation a convention rather than a
truth, and that is the accepted trade — the alternative, one event for the whole `not` subtree, is
always truthful but drops the one-event-per-leaf property the section leans on.
Rejected: **Make the walk exhaustive so the event count is predictable** — consistent with
`12-world-graph-kind.md` §9.1's no-short-circuit rule, but that rule holds *because* world-graph
condition leaves are pure; these are not, and the cost here is a thrown engine error on ordinary
play. **Record the divergence in the open register and change neither** — leaves §8.4 stating
something false about shipped behaviour, which is the failure this pass exists to prevent.
Reversibility: cheap — documentation only; the code is unchanged.

### 2026-08-23 — `choice.submitted` fires on submission, deliberately carrying an unresolved id
Context: §8.4 said this event is emitted "after the choice resolves". `advance.ts` emits it after
the current node is confirmed a `ChoiceNode` but before `node.choices.find(...)`, so it carries
whatever `choiceId` the caller sent — including one naming no choice, or one whose `showWhen`
fails. This is in tension with `05-observability.md` §8, which has the core omit an unresolved
`actionId` from `core.action.rejected` precisely so a caller cannot write arbitrary text into a
hosted operator's log.
Chosen: Amend §8.4 to say "on submission — before the id is resolved", and state the exception
explicitly rather than let it read as an oversight. An unknown or hidden id now shows as a
`choice.submitted`/`choice.rejected` pair rather than as silence, and silence is the hardest thing
to diagnose in a stream. The core's rule is about a hosted operator's log; this event is
namespaced to one kind and emitted at `debug`, which a host running `nullEmitter` (05 §2) never
sees, and §8.4 now tells a host that does raise the level how to filter it.
Rejected: **Move the emit after the choice lookup** — matches the old wording and extends the
no-player-text guarantee uniformly, but costs the submitted/rejected pairing, so an unknown id
produces a rejection with nothing showing what was rejected. **Omit `choiceId` when it did not
resolve**, mirroring 05 §8 exactly — the most internally consistent option and the one to revisit
first if a host ever runs `debug` in production; declined for now because the pair is the diagnostic
and no host runs kind-level `debug` today.
Reversibility: cheap — one table cell and a callout; the alternative is a three-line branch.

### 2026-08-23 — `09-clients.md` §4's browser column is Adventures', because its evidence left with W74b
Context: §4's whole stated value is that the ten-operation mapping is "checkable by counting, not by
reading intent", and one of its five columns — *Browser demo (W61)* — carried ten ticks resting on
`site/src/play/browser-client.test.ts`. W74b (`cf2d9eb`, 2026-08-19) deleted that file with the rest
of `site/src/play/`. The blockquote in `13-playable-web-demo.md`'s retirement narrative still read
"`site/src/play/` is still in the tree, and still runs", and cited the column as the live claim the
directory was evidence for — true when Revision 4 was written, false for four days and seven commits
to `10-design.md` after. The surrounding prose was already correct: §§1–2 and §§6–9 are marked
historical and §4's browser-portability gate is deleted. The column is what that pass missed.
Chosen: Repoint the column at `SubZeroDev.Adventures`, in the shape the *Hosted transport* column
already uses for Platform — name the owning repository, say the evidence lives there, and state
plainly that **no gate in this repository re-runs it**. The ticks now record what W61 demonstrated
and what Adventures is obliged to keep demonstrating. §13's peg sentence and the `site/public/`
campaign-file claim are corrected in the same pass; both were stale from the same commit.
Rejected: **Strike the column** — leaves §4 with three checkable columns and Platform's, and is the
tidier table, but it erases a real W61 result and quietly narrows what "no AI-specific path" (04 §13)
was ever demonstrated against. **Restore the evidence** — reverses W74b to satisfy a table, re-adds a
browser client to the repository that just retired one, and is a work unit with its own criteria
rather than a reconciliation edit.
Reversibility: cheap — one column header, one paragraph, one blockquote. Note the residual honestly:
this repository can no longer fail a build when the column stops being true.

### 2026-08-23 — A kind's own reference campaign is a sanctioned package-root export, and §19 now says so
Context: §19 sanctioned two categories of campaign — published narrative ones, which W74c removed
from the root, and frozen regression fixtures, which the same release removed. `src/engine/src/index.ts`
root-exports a third at `0.10.0`: `buildWorldGraphMvpCampaign` and `WORLD_GRAPH_MVP_CAMPAIGN_ID`. The
only statement that this is legitimate was a comment in `authoring.test.ts` — "content the engine
legitimately still ships" — while W88's own *Out of scope* read §19 as forbidding "exporting any
campaign". Two defensible readings of one section, with the deciding sentence in a test file.
Chosen: Name the category in §19. A kind's **reference campaign** — engine-owned, never Content's,
never a frozen fixture — is a root export, because it is what makes a registrable kind exercisable;
`world-graph` has no other content a host could register it against. The rule is bounded by the claim
`authoring.test.ts` actually enforces in both directions: the root publishes no *narrative* campaign.
A second kind adding one reference campaign follows this sentence; a second reference campaign for one
kind does not.
Rejected: **Remove both exports from the root** — the strictest reading, but a breaking change to a
published surface at 0.10.0 needs a version decision and is a work unit, and it would leave the
`world-graph` kind registrable with nothing to register. **Record it as known-and-retained** — leaves
§19 stating a rule the shipped surface breaks, which is the failure this pass exists to catch, and
leaves the sanction in a test comment where the next reader will not look.
Reversibility: cheap — one paragraph; the code is unchanged.

### 2026-08-23 — W88's export-split rule gets a decision entry, because a slice ledger is not the register
Context: W88 amended §19 with the rule that decides a kind's export split — the builder and its source
types are author-time and belong on `/authoring`; the campaign, state, view and outcome types are what
a runtime host compiles against and belong at the root — citing `design/30-slices.md, W88`. §19 states
the rule where a reader needs it, but the fork it resolved lives only in the slice: the two existing
kinds straddled the question (`world-graph` put all five at the root, `story-graph` put its campaign
and state types on `/authoring`), and `buildWorldGraphCampaign`'s root placement predates the subpath
and was noted rather than moved.
Chosen: Record it here as well, with the entry citing §19 rather than restating the rule — single
ownership keeps the rule in one place, and puts the *reasoning* where reasoning is indexed. The
trigger is that slices are retired: `W74.2`–`W74.5` already were, and this repository keeps the gap in
that numbering precisely as the record of a split. A rule whose only rationale lives in a retirable
ledger is one renumbering away from being unexplained.
Rejected: **Leave it in §19 alone** — the rule is stated and the reasoning is one link away, which is
defensible today and gets weaker every time the slice ledger is reorganised.
Reversibility: cheap — documentation only; no code, contract or behaviour change.

### 2026-08-24 — The work mirror's own directory retripped the design-state skip guard it predates
Context: the 2026-08-21 entry above guarded `tools/Test-DesignState.Tests.ps1`,
`tools/Read-DesignState.Tests.ps1` and `tools/Update-DesignProjection.Tests.ps1`'s self-referential
Describe blocks with `-Skip:` computed from whether `design/state/` exists, on the reasoning that this
repository's compatibility promise (2026-08-19) leaves it unmigrated. `c26b803`/`c8c2e29` (work-mirror
sync) then started writing `design/state/work/*.md` — a real, intentional adoption of the WorkRef
record shape, unrelated to full design-state migration — which made the directory exist and flipped
the guard, un-skipping 9 tests that immediately failed against a repository with no `state-index.md`,
no `Contract`/`Unit`/`Invariant`/`Decision` records, and no `Check the design state against the tree`
CI step. `verify.yml`'s "Run Pester tests" step went red on `main` at `7c86a22` as a result; the prior
session's `.claude/verify-report.json` entry on this branch's predecessor state (commit `8128a0f`)
already isolated the failures to this cause without fixing it.
Chosen: point the three guards at `design/state-index.md` instead of the `design/state/` directory —
the file the self-tests (S16.5) already treat as the migration's own marker, and one `design/state/`
can no longer answer now that a subdirectory of it has a second, legitimate occupant.
Rejected: **Exclude `design/state/work/` from the guard's Test-Path instead** — couples a generic
design-state guard to one specific mirror subdirectory's name, and breaks again the next time
something else adopts a `design/state/` subpath without adopting the whole migration. **Adopt
design-state here to satisfy the tests** — the same unscoped-feature-adoption rejection as
2026-08-21, unchanged by this branch.
Reversibility: cheap — three `Test-Path` targets, reverted by pointing them back.

### 2026-08-30 — Kit sync to `5095a55`: the 2026-08-24 design-state guard fix reverted, on explicit sign-off
Context: `/kit-sync` found `tools/Test-DesignState.Tests.ps1` and `tools/Update-DesignProjection.Tests.ps1`
`Divergent-Skipped` against the kit's newer copies — this repository's 2026-08-24 fix above still
checked `design/state-index.md`, while upstream still checks `design/state/units`. Recommended keeping
this repository's fix (the reasoning above is unchanged and neither `state-index.md` nor `state/units`
exists here, so both checks currently agree); the user chose to take the kit's version as-is instead.
Chosen: overwrite both files with the kit's copies. Verified with a full `tools/` Pester run before and
after (263/263 passing, 0 regressions) — today, `design/state/` still holds only `/track`'s work-mirror
(`design/state/work/`), so `Test-Path design/state/units` correctly evaluates false here regardless.
Rejected: **Keep this repository's `state-index.md` check** (my recommendation) — declined by the user.
Reversibility: cheap, but **watch this**: the 2026-08-24 failure mode (9 tests un-skipped and immediately
red) returns unchanged if `design/state/` ever grows another subdirectory before this repository adopts
`state-index.md` for real — the exact scenario that motivated the fix just reverted. Nothing distinguishes
"a real migration" from "another mirror subdirectory" for either check as they now stand.

### 2026-08-30 — Kit sync to `5095a55`: `Invoke-CodexCommand.Tests.ps1` merged, not replaced
Context: this repository's copy filters `.claude/commands/*-local.md` out of `$script:CommandNames`
(companions carry no Codex profile of their own); the kit's newer copy adds a "tier stamping" Describe
block covering `Invoke-CodexCommand.ps1`'s new `AGENTKIT_TIER` environment stamp, without that filter.
Taking either file whole would have broken the other repository's concern.
Chosen: take the kit's tier-stamping tests, keep this repository's `-local` filter in the shared
`$script:CommandNames`, so both the existing "has a mapping for every command file" test and the new
"stamps a tier for every command file" test exclude companion files correctly.
Rejected: **Kit's file as-is** — the new tier test would fail against every `*-local.md` companion.
**This repository's file as-is** — misses regression coverage for the new `AGENTKIT_TIER` stamp entirely.
Reversibility: cheap — a four-line `BeforeAll` block.

### 2026-08-30 — Kit sync to `5095a55`: `Update-WorkMirror.ps1` taken from the kit wholesale
Context: this repository had locally added an `Invoke-GhRaw` helper (a `[ref]$ExitCode`-parameter
signature) fixing gh's stdout being mis-decoded as the console's OEM code page instead of UTF-8, the
same class of bug Sync-Kit.ps1's `Invoke-GitRaw` fixed for git under #20. The kit's copy — which also
gained the closed-issue re-fetch/rewrite fix (#155/#156) and a signature-based no-op-write guard since
this repository's last sync — turned out to already carry its own `Invoke-GhRaw` (a different call
shape: returns `{Output; ExitCode}` instead of taking a `[ref]` out-param), fixing the identical bug.
No porting was needed; both fixes are equivalent in effect.
Chosen: overwrite with the kit's file entirely. Verified with a full `tools/` Pester run (263/263
passing) after the just-synced `Update-WorkMirror.Tests.ps1` — which already mocks `Get-IssuesByNumber`
and would not have passed against this repository's older implementation regardless of this decision.
Rejected: **Port only the closed-issue fix into this repository's file** — would have kept two
independently-evolving `Invoke-GhRaw` implementations of the same fix for no benefit.
Reversibility: cheap — one file, fully covered by the existing test suite.

### 2026-08-30 — `codex/PROFILES.md` installed
Context: the kit's installer skips `codex/PROFILES.md` by default, installing it only on evidence of
Codex use. This repository has actively maintained `tools/Invoke-CodexCommand.ps1` and its Pester
coverage since 2026-08-29 (the `/done` → `/clean` regression guard), which is exactly that evidence,
even though no `.codex/` directory or explicit profile reference exists.
Chosen: install it, per explicit sign-off.
Rejected: **Continue skipping** — the default, but no longer accurate once the profile-mapping tooling
is already load-bearing here.
Reversibility: cheap — one new file, unreferenced by anything if later deleted.

### 2026-08-30 — `AGENTS.md` gains a "Writing a design-state record" pointer heading
Context: this kit sync's `reconcile.md`/`contract.md`/`design.md` core updates all cite the
record-writing sequence as living at `` AGENTS.md § *Writing a design-state record* ``, replacing an
older citation to `` design/10-design.md § *Record* ``. Neither ever resolved in this repository:
`design/10-design.md` has no `## Record` heading, and `AGENTS.md` here is a deliberate pointer file
([`AGENTS.md`](../AGENTS.md), *Why this is a pointer*) carrying no content of its own. Separately, this
repository has never adopted the kit's full `design/state/` system — only `/track`'s work-mirror
(`design/state/work/`, 2026-08-24 above) — so the kit's own sequence (append to `90-decisions.md`, write
a decision record, update unit records, regenerate projections) does not actually apply here regardless.
Chosen: add a short heading to `AGENTS.md` stating that this repository's `design/state/` adoption
stops at the work-mirror, and that the full sequence does not apply — write the decision-log entry
alone. Satisfies the citation honestly without duplicating content this repository does not use.
Rejected: **Leave the citation broken and log this as a known gap instead** — declined; the fix costs
one paragraph and closing it now is cheaper than a second look later.
Reversibility: cheap — one heading, four sentences.

### 2026-08-30 — W97 contract gate 1: the kernel owns defensive copying at the `Kind.project` seam
Context: `design/30-slices.md` W97 is contract-gated on "a fresh `/contract` decision that assigns defensive-copy ownership at the `Kind.project` seam", and issue #168 (raised in review of PR #166) records the same question. Neither `10-design.md` §7 nor `20-contract.md` §9 said anything about it: both are entirely about *visibility* — which fields appear in a projection — and neither addresses whether the returned object shares memory with `GameState`. Read against the source rather than the documents, the kernel had **already chosen**, undocumented and applied inconsistently: `Engine.view` wraps its result in `structuredClone` (`src/engine/src/core/kernel/engine.ts`) with the rationale in a code comment, while `Engine.scene` builds the same `PlayerView` shape inline with no copy — and §6 declares `Scene.view` to *be* the §9 projection, so one surface is guarded and its documented twin is not. Behind that hole, all three kinds alias `kindState` while projecting: `simulation` returns eight `player.*` objects and arrays by reference, `story-graph` returns `unlockedAchievements`, `world-graph` returns `map.spawnPoints` and `map.exits`.
Chosen: The **kernel** owns it, stated in `20-contract.md` §9.1 as a new subsection, with a pointer at `project` in §3 rather than a second copy of the rule. Every core surface carrying a `kind.project` result returns a structural clone; `Engine.view` and `Scene.view` are both bound. A kind may alias `kindState` freely — explicitly permitted, since a projection legitimately reuses the value it narrows — and carries exactly one obligation in exchange: the result must be plain, structurally cloneable data. Object identity across two `view()` calls is explicitly *not* a guarantee. `Engine.availableActions` is stated as outside the rule, since `AvailableAction` is a flat record of primitives.
Rejected: **Kinds own it** — each `project` returns fresh deep structures. Rejected because it makes the invariant an instruction with no gate, re-obeyed by every future kind with nothing to catch a lapse, and this repository has recorded that precise shape failing twice already (the *emitted → registered* gap, and the end-of-week stub register, whose own entry concludes "a stronger sentence is not the fix"). It also means rewriting eleven aliasing sites across three kinds to buy a weaker guarantee than the one line already in `engine.ts`. **Both** — kernel clones *and* kinds return fresh — rejected on single ownership: two owners for one invariant, paying twice, with no way to tell which copy is load-bearing when one is later dropped.
Reversibility: moderate — the rule is a public-seam guarantee callers may build on (a client may now mutate a view freely), so withdrawing it later is a breaking behavioural change even though the code change is small.

### 2026-08-30 — W97 contract gate 2: the shared system pipeline is an emission-free fold that never catches
Context: W97's second gate wanted "a `/design` or `/contract` decision that fixes the shared pipeline's ordering/error semantics", and neither document contained one — no statement that the two kinds should share a substrate at all, and no rule anywhere about what happens when a system throws. `10-design.md`'s own preamble routes both questions here ("Kind-specific ordering belongs to `20-contract.md`"; "Exact error vocabulary belongs to `20-contract.md`"). Read against the source, the two pipelines are structurally dissimilar in a way that decided the shape of the answer: `world-graph` already has a substrate — `WorldGraphSystem = (frame) => frame`, a declared twenty-entry id list, a `for` loop with two invariant guards — and its loop emits **nothing**, each system emitting its own domain events. `simulation` has no substrate at all: fifteen bespoke signatures, no frame type, no loop, a `missedCents` handoff threaded from `housing` into `finance_reconcile` — and its *runner* emits `kind.simulation.system.ran` once per system, which its §11 keeps as the ordering regression detector.
Chosen: A new `20-contract.md` §20 owning the substrate's semantics only, leaving both normative orders owned by their kinds. Five rules: order is the caller's verbatim; every entry runs every time (no short-circuit — `world-graph` §4.1's "a terminal result does not interrupt the tick" becomes a consequence rather than an exception); each entry is a total frame-to-frame function threaded in sequence; the substrate emits nothing, draws no randomness and reads no clock; and it never catches, so a throwing system propagates with no partial commit. The emission asymmetry is settled by **pre-wrapping list entries** — where a kind wants a per-system trace event, the entry's own `run` closes over system and emission together at list-construction time. The section also states what it does *not* settle: whether a kind's systems are shaped to run on the substrate is that kind's internal matter.
Rejected: **The substrate always emits a per-system event** — uniform and simplest to state, but it adds twenty events to every world-graph tick, breaking W97.5's byte-identical event-stream criterion. **The substrate never emits and simulation loses `system.ran`** — deletes the stream §11 relies on to localize an ordering regression. **An optional per-entry emit hook the substrate honours** — preserves both streams correctly, but moves an emission concern inside the substrate and adds an ordering rule (after, not before) that pre-wrapping does not need. **Catch and convert a thrown system to a rejected `AdvanceResult`** — rejected outright: it would make an engine defect indistinguishable from a game outcome and produce a wrong state that still serializes, which is the one failure this engine's gates cannot catch.
Reversibility: cheap while unimplemented — no code has been written against §20, and the section constrains a module that does not exist yet. It becomes moderate once `simulation`'s systems are reshaped onto it, since that refactor is constrained to be behaviour-preserving.
### 2026-08-30 — W98 contract gate 1: the campaign catalog is asynchronous and carries its own string table
Context: `design/30-slices.md` W98 is contract-gated on "a fresh `/contract` pass that declares the asynchronous catalog result, session-free title resolution", and issue [#279](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/279) records the first half from the first downstream host. `listCampaigns(): CampaignSummary[]` is the only synchronous operation on an interface whose other nine are all `Promise`-returning, and a `fetch`-backed `SessionStore` cannot satisfy it — Adventures prefetches every summary at composition time and closes over them, which works and is not what the contract claimed. The second half was worse because nothing recorded it as a hole at all: `CampaignSummary.titleKey` is a `LocKey`, `getStrings` is keyed by `sessionId`, and a visitor choosing a campaign has no session — so the one screen every player sees first was the one screen the contract could not render. The text client's own coverage test names the gap in its title: *"listCampaigns — returns the real campaign, unresolved titleKey (no session yet)"*.
Chosen: `listCampaigns(profileId?: string): Promise<CampaignCatalog>`, with `CampaignCatalog = { campaigns, strings }`, stated in `20-contract.md` §7.3. `titleKey` stays a `LocKey` and the table beside it resolves it, so §7's no-baked-locale rationale extends one layer earlier unchanged. `strings` is bounded to exactly the keys the summaries carry — not the registry's table, which holds every node's authored prose and would hand a visitor the whole of every story before a session began. Order is the registry's own iteration order, not a new sort. The break is deliberate and compiler-caught: the old and new signatures share no usable call site, so every caller fails to build rather than reading `undefined`.
Rejected: **A resolved `title: string` on the summary** — smallest diff and simplest for a client, but it is the exact pattern §7 rejected for session DTOs, bakes a locale into a returned shape, and turns a second locale into a migration. **An eleventh operation, `getCatalogStrings()`** — most symmetrical with `getStrings`, but it breaks `09-clients.md` §4's ten-row checklist and its one-MCP-tool-per-operation count, which that section makes checkable *by counting*; the widest downstream edit, for a shape the single-operation form already delivers. **Document the in-memory requirement as deliberate** (#279's own alternative) — rejected; it would make "a store must be a registry before it is a store" a stated constraint to avoid changing one signature, and the hosted transport already disproves the constraint.
Reversibility: expensive. This is a breaking change to a package-root export with two known downstream consumers, so reverting it is a second break rather than a revert.

### 2026-08-30 — W98 contract gate 2: `VisibleStat` carries the declared range; the enum analogue is registered, not closed
Context: Issue [#278](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/278). The story-graph projection carries `{ var, labelKey, value }`, so rendering a stat as "3 / 12" rather than a bare "3" means reaching into `Campaign.content` for `min`/`max` — content the core deliberately keeps `unknown` above the kind. Adventures does exactly that, structurally and defensively, in `shared/campaign-registry.ts`. This is `CLAUDE.md`'s envelope-duplication ledger running backwards: that ledger tracks a kind *carrying* a field something else owns; this is a projection *omitting* one, forcing every client past the boundary to recover it. Same end state — the boundary stops being load-bearing.
Chosen: `VisibleStat` gains flat `min?` / `max?`, mirroring `VariableDecl` (03 §2) exactly including its optionality. Stated in `20-contract.md`'s story-graph §9, with the reasoning that copying a *declared bound* into a view is not duplication — the declaration stays the sole authority, nothing writes back, and the value is authored data a rebalance may change freely, unlike a terminal id.
Rejected: **A discriminated stat type keyed by `VarType`**, which would close the enum `values` gap in the same edit — rejected as public surface with no consumer: every visible stat in every shipped campaign is a bounded `int` (`adventure-builder.ts`), no campaign declares a visible `enum`, and no test could fail. **A grouped `range?: { min?, max? }`** — rejected; it stops mirroring `VariableDecl`, so a reader can no longer check the view against the declaration by looking at both. The enum analogue is recorded in the section itself rather than dropped, with the instruction for the day a campaign declares one.
Reversibility: cheap — two optional fields on a projection type; removing them breaks only a client that chose to render a range.

### 2026-08-30 — W98 contract gate 3: campaign progress is store-assembled onto the catalog, and is counts only
Context: #278's second bullet — "the same omission is checked for ending counts ('n of m discovered') and closed the same way if it applies" — and W98.4, which asks that "a fresh profile and a profile with one unlocked ending have distinct, exact projections". The structural constraint decides most of it: "discovered" is cross-session, so it can only come from the `ProfileStore`, and `Kind.project(state, audience, ctx)` has no profile and must not get one — a projection that varied by profile would no longer be reproducible from `{ seed, actionLog }`, and the determinism harness (§14) would be asserting something weaker than it claims. So W98.4's wording cannot be met inside `StoryGraphView`, and the surface it *can* be met on is the catalog gate 1 just created.
Chosen: `CampaignSummary.progress?: { discovered, total }`, present iff `listCampaigns` was given a `profileId`. `discovered` counts distinct `TerminalRecord.terminalId`s the profile holds for that campaign; `PlayerProfile` moves to `formatVersion: 2` with a `terminals` mirror upserted on the same write as the achievement mirror. `total` is `Kind.terminalCount(campaign)`, a new **optional** seam member — a kind that omits it yields no `progress` object at all, since a numerator with no denominator renders as progress toward an unknown target. Counts only, never ids: there is no field an ending id can travel in, which is the whole of the hidden-ending protection and makes it structural rather than a rule. The 1 → 2 profile migration is total and cannot fail (`terminals: []`), so it is stated rather than seamed.
Rejected: **Totals only, in `StoryGraphView`** — closes the content-reach half of #278 for nearly nothing (the kind already holds `ctx.campaign`), but there is no cross-session "discovered", so W98.4's profile clause would have had to be amended in the slice. **Declining, and stating ending counts as a host concern** — cheapest, and defensible on its own, but it leaves Adventures reaching into `Campaign.content` for the total, which is the erosion #278 was opened about; declining the ending half while fixing the `min`/`max` half needed an argument that does not exist. **Feeding the profile into `KindContext`** — rejected outright; it does not break `serialize()` but it does make a projection non-reproducible from state, which is a worse trade than the one it buys.
Reversibility: expensive. A profile `formatVersion` bump is durable player data, and `Kind.terminalCount` is a seam member; both are additive but neither is quietly withdrawable.

### 2026-08-30 — W98 contract gate 4: `Kind.outcome` gains a two-field cross-kind floor, and no win/loss disposition
Context: Issue [#282](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/282). `Kind.outcome(state): unknown`, so a host indexing "which ending did this finished session reach" calls it and then guesses at the returned object's fields; Adventures recognises `{ endingId }` and reports nothing for any other kind, degrading rather than guessing. Terminal identity is meant to be the cross-version-stable vocabulary (07 §3.3) — it is stable per kind and illegible across them, which is a vocabulary only one reader can parse. Gate 3 then made this urgent rather than merely untidy: `TerminalRecord.terminalId` is a cross-kind field, so declining here would have meant defining the same vocabulary in the profile schema instead, which is a worse place for it.
Chosen: `KindOutcome { terminal: boolean; terminalId: string | null }`, stated as `20-contract.md` §3.2, with `Kind.outcome` narrowed from `unknown` to it. Each kind widens rather than replaces, keeping every field it has today: `story-graph`'s `terminalId` is its `endingId`, `simulation`'s and `world-graph`'s is the `resolution` token. The two columns are explicitly *not* one vocabulary — a story-graph terminal is authored, the other two are declared from closed sets — and the section states the weaker guarantee a host actually needs: stable across engine versions, unique within its campaign, safe to persist and compare, with no requirement to know what the id means. `terminal` is a separate field from `terminalId !== null` so the two facts stay separable for a kind that ends without naming a terminal. World-graph's is the one outcome type that states `extends KindOutcome` in the tree, because it is the one that is exported and therefore named.
Rejected: **Adding `disposition: "win" | "loss" | "neutral" | null` to the base** — the field a host wants next, and left out deliberately: `outcome` receives `KState` and no campaign (the same constraint 10 §12 already records for `weekLimit`), and story-graph's win/loss lives on `EndingNode` in unreachable content, so supplying it means persisting the disposition into `StoryGraphKindState` — a `kindVersion` bump and a `Kind.migrateState` for every existing save. A defensible unit of work, not this one; the alternative route (`StoryGraphView.ending.outcome`) has carried it all along and is named in the section. **`terminalId` as `failureId` for world-graph** — rejected; `failureId` is present only on the losing branch, so a won game would carry a null terminal id and make `terminal` and `terminalId` disagree on exactly the games a host most wants to index. **Declining, per #282's own alternative** — foreclosed by gate 3, and the cost of reopening it is stated there.
Reversibility: moderate. Narrowing a return type from `unknown` is source-breaking for an implementer but not for a reader; the two fields are additive, and no kind lost a field.
### 2026-08-31 — W99 contract gate 1: a branch retains the source's `gameId` and mints only a new `sessionId`
Context: W99.2 requires that branching "allocates a new id through `IdSource`" **and** that "the branch serializes and replays byte-identically through the fork point". Those cannot both hold literally: `gameId` is a `GameState` field (§2) and therefore in `serialize()` output, so a branch minting a new one differs from its source in exactly that field. Nothing in `10-design.md` settles it, because session branching appears nowhere in the design at all — the word is not used as an operation. The evidence that does exist points one way: [issue #266](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/266), the tracked item with a working reference implementation in Adventures, states its two criteria as "the new session gets its identifier from the engine's own identifier source" and "the forked session replays byte-identically up to the fork point", and its complaint about the reference implementation is that it calls `randomUUID()` for the **session** id — the unguessable-id requirement `SubZeroDev.Platform`'s hosting contract §6.2 makes. The identifier the issue is about was never `gameId`.
Chosen: The branch retains the source's `gameId` and mints a new `sessionId` through `RecordIdSource.newSessionId()` (06 §5.7) — the port whose values never enter `GameState`, which is precisely the category a session id belongs to. Stated as `20-contract.md` §7.4, with the cost named rather than buried: **`gameId` now identifies a lineage, not a playthrough**, and two live sessions can share one. The two places that could have been damaged are not — §7.1's profile upsert is idempotent on `(campaignId, achievementId)` and `(campaignId, terminalId)`, so a branch re-earning its parent's achievement writes the same row twice and changes nothing; and a replay fixture (07 §2) holds `{ config, actionLog }`, which addresses inputs and never a session. Invariant B1 makes the byte-identical claim literal and checkable, and at `atActionCount = |actionLog|` it reduces to `serialize(branch) === serialize(source)`, which is the cheapest form and the one a golden file should hold.
Rejected: **Mint a new `gameId` via `IdSource.newGameId`**, which is what W99.2 literally says — rejected because it forces the byte-identical assertion to compare a serialization with `gameId` normalized out, and 06 §5.1 records that normalization as the specific defect the `IdSource` port existed to remove; re-introducing it to satisfy a phrase would trade a real guarantee for a wording. **Retain `gameId` and add a separate branch-identity field to the envelope** — the most explicit answer, and rejected as far outside this unit: a new `GameState` field changes every save's serialization and its `formatVersion`, which is a contract amendment with a migration attached, to record a fact nothing currently reads. Revisit when: something in the engine needs to distinguish two branches of one lineage from state alone — today nothing does, because the engine never parses, compares, or derives from `gameId` (06 §3).
Reversibility: expensive once branches exist. Sessions created under this rule are durable player data, and switching to a new `gameId` later would leave existing branches indistinguishable from their parents while new ones are not — a split population no migration can repair, since the original identity was never recorded separately.

### 2026-08-31 — W99 contract gate 2: `StoredSaveRecord` gains a `Clock`-stamped `savedAt`, and it is the save-list sort key
Context: W99.1 requires `listSaves` to return a player's saves "in a specified deterministic order", and requires that both existing hosts can then **delete their private shadow indexes** — the per-host save bookkeeping [issue #277](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/277) records two hosts having independently invented. `StoredSaveRecord` (§7.2) carried no timestamp: the only temporal field was `savedAtSeq`, which counts actions *within one session*, so two saves from two sessions routinely share a value and ordering by it is not a total order across a player's saves at all. `StoredSessionRecord` has carried `createdAt`/`updatedAt` since §7.2 was written, so the absence was an asymmetry rather than a considered omission.
Chosen: Add `savedAt: string` to `StoredSaveRecord`, stamped from the `Clock` port (06 §5.4) exactly as `createdAt` is and never from `Date.now`; order `listSaves` by `savedAt` descending, then `saveId` ascending. `SaveHandle` gains the same field so a caller holds the stamp without a round-trip, which is what makes §7.4's compare-and-delete precondition usable. The field stays on the record and out of `GameState`, so the §2 determinism rule is untouched — nothing in resolution reads it. `SaveRecordStore.listByProfile` returns records in any order and the store sorts, so the ordering guarantee is one implementation's rather than every adapter's.
Rejected: **Order by `savedAtSeq`, then `saveId`** — the only option needing no adapter change, and rejected because the tiebreak across sessions falls to a lexicographic comparison of random UUIDs: deterministic, and meaningless to a player. No host could render that order, so no host could retire its shadow index, and the operation would satisfy its signature while failing the thing it was asked for. **Leave ordering to the host**, as §7.3 does for the campaign catalog — rejected; §7.3 can defer because the registry's iteration order is at least stable and content-authored, whereas a save list has no such natural order, and W99.1 asks for a specified one rather than an absent one. Revisit when: a host needs saves ordered by something other than time — a title or a campaign — at which point the answer is client-side sorting over the returned array, not a second parameter here.
Reversibility: moderate. The type change is additive and free for any adapter storing the record as an opaque blob; a column-mapped adapter — Adventures' Postgres store is the case in hand — needs a migration backfilling existing rows, and §7.4 states the backfill value (the epoch, so unstamped saves sort last) rather than leaving each host to invent one.
