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

- **The engine package published *public*, and the plans specify private.** `v0.4.0`
  published `@the-running-dev/game-engine` to GitHub Packages on 2026-08-02 with
  `visibility: public`, verified against the packages API. Two plan documents still specify
  otherwise, each now carrying a pointer to this entry: `plans/39` Decision 4 ("a private
  GitHub Packages npm package") and `plans/40`'s non-goals ("**No public npm publication.**
  Private GitHub Packages only").

  Checking why turned up a larger stale premise: **both `SubZeroDev.GameEngine` and
  `SubZeroDev.SunTrap` are public repositories.** [`TODO.md`](TODO.md) described all
  companions as private until the same change that added this entry corrected it. Nothing was
  exposed that was not already public — the engine source has been readable throughout — so
  this is a contract-versus-reality gap, not an incident.

  Two coherent resolutions, and they differ in what they cost. **Accept public** and correct
  the documents: a private package fronting a public repository protects nothing and adds an
  authentication step to Sun Trap's CI for no benefit. **Or make it private** through the
  package's own settings — there is no REST API for visibility — and grant Sun Trap read
  access, which W41's ledger then needs reopened.

  **Revisit when:** Sun Trap's M1 actually consumes the package, since that is the first
  moment the authentication difference is felt rather than theorised.
- **Provisional simulation numbers** — drift rates, scenario economics, `demandBand`
  thresholds, housing-quality formula, travel costs. Need a balancing pass once the sim
  harness runs. ([`TODO.md`](TODO.md) → Known open items; simulation kind.)
- **`wisdom` attribute has no consumer** — needs one to earn its place
  (`games/04-engine-specification.md` §8.4).
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
  `WorldState` (10 §2.2, the field-detail port `plans/36-simulation-kind-programme.md` calls
  W27). **Revisit when** a unit actually needs a `"profile"`-scoped chain to persist —
  specifying a mechanism generically now, with exactly one (still-hypothetical) consumer,
  would be the same one-built-instance-is-not-a-pattern reasoning this register already
  applies to `createSessionLayer` and the tick-pipeline substrate.
- **The hosted MCP contract still needs its W48 mirror.** The engine-side contract and façade
  now expose ten operations, including `preview_action`, but SubZeroDev.Platform's
  `mcp-tool-contract.md` still lists the original nine. The engine repository cannot make a
  companion-repository edit in the same commit. **Revisit before the hosted MCP server
  publishes W48:** add `preview_action` with the same arguments and `SessionActionResult`
  return shape, preserving the one-operation/one-tool mapping from 09 §4.
- **A shared simulation substrate for tick-driven kinds** — `simulation` and
  `world-graph` are the same archetype: mutate pending configuration, then resolve
  a block of simulated time through an ordered system pipeline (12 §2). Both hand-roll that
  pipeline, and it is where determinism defects concentrate — the two-phase time ordering in
  10 §3 is exactly the class of bug a shared, tested runner would stop recurring per kind. A
  `SystemPipeline` in the core (ordered registration, deterministic per-system stream keying,
  stable iteration, derived entity ids) would make kind N+1 cheaper. **Not extracted now:**
  one built instance is not a pattern, and `simulation` is not built. **Revisit when** the
  second tick-driven kind is actually implemented, so the abstraction is drawn from two real
  cases rather than one and a specification.
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
- **`SessionHost` / `createSessionLayer` remain unbuilt** — [`06-extensibility.md`](06-extensibility.md)
  §4 specifies a composition root, `createSessionLayer(host: SessionHost): SessionStore`,
  producing a `SessionStore` from a `SessionHost` whose `sessions` field is already typed as
  one — which only reconciles if `sessions` was meant to be a lower-level, storage-only port
  that `createSessionLayer` wraps with stamping (05 §6.1) and profile-upsert (04 §7.1)
  behaviour, a port `04-core.md` never separately names. W7 built `createInMemorySessionStore`
  directly against `session/types.ts` instead, since W7's own done-criteria never named
  `SessionHost` or `createSessionLayer` (`plans/14-w7-session-store.md`, Decision 1). The
  replay regression oracle (W21) composes `createInMemorySessionStore` for the same reason —
  see [`07-replay.md`](07-replay.md) §3.2 — rather than resolving this gap, so it now has two
  real call sites and zero real implementations of the specified abstraction. **Revisit when**
  a second `SessionStore` implementation is actually needed: the composition-root generality
  should be drawn from two real cases, not one and a specification.
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
- **The replay-corpus test harness assumes one campaign per corpus directory** —
  `bulgaria-bureaucracy.replay.test.ts` (W22) does a generic `readdirSync` scan of
  `fixtures/replay/` to enumerate fixtures, but builds its `ReplayRunnerContext` from *only*
  the Bureaucracy campaign's registry. A second campaign's fixtures dropped into the same
  directory would be enumerated by that scan and then fail, since the registry they'd run
  against doesn't contain their campaign. W22 built this before a second campaign existed, so
  it was never wrong for its own scope — but it means today's replay-corpus pattern doesn't
  extend to a second campaign without either a multi-campaign registry in that shared context,
  or a parallel per-campaign test file scoping its own directory read by filename prefix.
  Found while implementing W27 (`plans/37-w27-bulgaria-driving-arc.md`), which has no replay
  fixtures as a result — not blocking that unit, but real friction for every arc after it.
  **Revisit when** a second campaign's replay coverage is actually wanted: decide the shared-vs-
  per-campaign shape once, from two real cases, rather than guessing ahead of one.

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

*Add to this register whenever a decision is deferred or an assumption is made — rather than
leaving it in a commit message or a chat, where the next person will not find it.*
<!-- human-doc:end -->
