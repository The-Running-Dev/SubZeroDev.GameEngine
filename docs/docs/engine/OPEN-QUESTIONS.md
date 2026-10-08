---
sidebar_label: Open Questions
slug: open-questions
---

# Open Questions & Known Concerns

<!-- Generated from design/90-decisions.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

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

- **No customer, alternative, or monetization thesis — deferred, and now recorded as deferred
  rather than merely absent.** The brief states what the platform is, who plays it, and what it
  refuses to do; it says nothing about who would buy it, what they would otherwise use, or how it
  would earn. That silence is deliberate, not an oversight. This repository ships a deterministic
  engine, its specifications, and its authoring tools; the commercial layer is a different
  repository —
  [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform), the deferred
  hosting / NEaaS layer. Stating a monetization thesis here would put product strategy in the
  document that owns *engine* scope, and every reader of the non-goals would then have to work out
  which of the two they bind. **Owner:** the repository owner
  ([@The-Running-Dev](https://github.com/The-Running-Dev)); this is a product decision, and no
  specification pass settles it on their behalf. **Revisit when** Platform work actually starts —
  the first point at which a named customer, a named alternative, and a price have somewhere to
  live that is not this repository.
- **Package visibility, decided: public.** `src/engine/package.json` carries no `"private"`
  field and publishes to `npm.pkg.github.com`; [Engine Package](/docs/guide/engine-package)
  states the choice is deliberate. `plans/39-world-graph-kind-programme.md` and
  `plans/40-w41-engine-consumer-boundary.md` both specified private GitHub Packages at the
  time they were written and are annotated in place ("What shipped did not honour this") —
  left as historical record of the original plan rather than rewritten, since a plan
  document records intent at the time, not current fact. This is the final answer;
  [issue #302](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/302) tracked
  deciding it and is closed by this entry.
- **The no-engine-API browser smoke — retired, not reassigned.** `design/15-platform-static-host.md`
  §6 and `13-playable-web-demo.md` §6 named a browser production smoke proving `/play/` made no
  engine API request and no request outside the same-origin `campaigns/` files; W69 removed the
  route and the smoke together, leaving open whether the property moved to a replacement owner
  (`10-design.md` §6, *CI, Publication, and Deployment Boundary*, mirroring §4's disposition for
  the Node-only-import property) or retired outright. It retires: §4's property survived because
  it is still true of the package [SubZeroDev.Adventures](https://github.com/The-Running-Dev/SubZeroDev.Adventures)
  bundles, and that repository's `scripts/verify-build.mjs` asserts it there. This property is not
  still true anywhere — Adventures is deliberately a hosted Fastify API with Postgres persistence
  and accounts, the opposite of "no backend, no engine API, same-origin files only." There is no
  surviving host to assert it over, so no replacement check is created.
  [Issue #273](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/273) tracked
  deciding it and is closed by this entry.
- **Provisional simulation numbers** — drift rates, scenario economics, `demandBand`
  thresholds, housing-quality formula. **Balancing them is the game's work, not the
  engine's** (`20-contract.md`'s *Reused, not re-derived*; [12 §15](12-world-graph-kind.md#15-validation)).
  What the engine owes is the levers: need drift, the late fee, the eviction ladder,
  performance drift and every action's time cost and restore amount are still `const`s no
  campaign can reach ([TODO.md](TODO.md) P3). Tracked as
  [issue #524](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/524), which
  supersedes [issue #267](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/267).
  Two of the four have no running input at all: the housing-quality formula is contracted
  and never computed, and `sectorDemand` never moves (`design/90-decisions.md`, the 2026-09-27
  `/align` entry on #267).
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
- **`ChainScope`'s `"profile"` value has nowhere to persist — closed by W102's contract gate.**
  A `"profile"`-scoped event chain (10 §2.2) must survive the game it started in, and
  `PlayerProfile` had no field for kind-declared data. It has one now:
  `PlayerProfile.kindData` (04 §7.1), a core-opaque slice per kind, written through the same
  mirror the achievement and terminal upserts use and read back at `createSession` through
  `NewGameConfig.kindProfileData`. Found while porting `WorldState` (10 §2.2, the field-detail
  port `plans/36-simulation-kind-programme.md` proposed as W27 and cut as **W32**); tracked as
  [issue #268](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/268), which the
  four W102 gate entries below close. **What did not close** is the next item.
- **Cumulative weeks played across every game under one profile.** 10 §2.2 described a
  `"profile"`-scoped chain as advancing on this, and the shape W102 gave it records
  `furthestStep` only. The aggregate has no formulation that is at once idempotent (which
  `Kind.profileData.fold` requires), bounded (which §7.1's 65 536-byte slice cap requires), and
  correct under two live sessions sharing one `profileId` (which §7's second lock domain exists
  because hosts allow): a sum fails the first, per-game keying fails the second, and a
  settle-on-game-change counter fails the third. **Revisit when** a campaign actually wants a
  chain that paces on elapsed play rather than on progress — until one does, the decision about
  which of the three properties to give up has no evidence to be made on. Carried in
  `20-contract.md`'s own `## Unresolved` section, which is the checkable copy.
- **The hosted MCP contract's W48 mirror — resolved, moved rather than edited in place.**
  [Issue #269](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/269) tracked
  SubZeroDev.Platform's `docs/docs/mcp-tool-contract.md` lagging the engine's tenth operation,
  `preview_action`. Platform's own S2.11 retired that copy rather than editing it: the table now
  lives in `SubZeroDev.ServiceContract`'s `mcp-tool-contract.md`
  ([`5d3fb8e`](https://github.com/The-Running-Dev/SubZeroDev.ServiceContract/blob/5d3fb8e6ebeb8fb6200e36ebc61df107ad355ce7/mcp-tool-contract.md),
  package `0.6.0`), which documents all thirteen `SessionStore` operations with `preview_action`
  named as the tenth. Platform's hosted surface
  (`workloads/game-service/src/mcp-surface.ts` @
  [`665103a`](https://github.com/The-Running-Dev/SubZeroDev.Platform/blob/665103a3cdd182b1bc248c5aa08d2202fb6ac041/workloads/game-service/src/mcp-surface.ts))
  builds its tool table from `contract.operations` at runtime instead of a hand-maintained list,
  so there is no longer a Platform-side row set that can independently lag. Closed as resolved.
- **A shared simulation substrate for tick-driven kinds — resolved by W97, closed as done.**
  [Issue #270](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/270) asked for a
  `SystemPipeline` once `simulation` and `world-graph` both existed. W97
  ([PR #409](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/409)) had already
  built the part that is shared: the contract's §20 ordered system runner, which both kinds now
  run on, held against the replay corpus. Per-system stream keying and derived entity ids were
  not extracted, because unifying either would change one kind's replay output. The full
  reasoning and the revisit trigger, a third tick-driven kind, are in the 2026-10-03 entry
  below.
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
| [#278](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/278) | `VisibleStat` omits the declared range, so clients read `Campaign.content` to get it — resolved by W98 (#414): gates 2 and 3 below |
| [#279](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/279) | `listCampaigns()` is synchronous, so no remote store can implement it — resolved by W98 (#414): gate 1 below |
| [#280](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/280) | Reproducing a stored session's blob requires pinning `IdSource.newGameId` |
| [#281](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/281) | `SessionStore` has no concept of a caller, so authorization lives outside it — resolved by W99 (#415): `20-contract.md` §7.4, *Authorization is host-owned, and `SessionStore` stays caller-agnostic*, with its reopening trigger |
| [#282](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/issues/282) | `Kind.outcome` has no shape a host can read generically — resolved by W98 (#414): gate 4 below, `20-contract.md` §3.2, *`KindOutcome` — Terminal Identity a Host Can Read*; win/loss disposition deliberately left off the base |

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

### Found by the 2026-10-03 repository review

`plans/53-repository-review-2026-10-03-fixes.md` fixes the review's reproduced defects as
S121–S128. What those slices audited but deliberately did not fix is recorded here.

**Content epochs: injecting content into a running session. Designed 2026-10-08.** The
review found that `deserialize` accepts a state whose `campaignVersion` differs from the
registry's. Rejecting the mismatch was turned down (plan 53, D3): since W120 `campaignVersion` is
the resolution digest and attachments are part of it, so injecting a side quest changes the
version of every live session on that campaign, and a rejection would end exactly the sessions
injection exists for. The design is
[`16-content-epochs.md`](16-content-epochs.md): an adoption is a logged `LoggedContent` entry,
sessions adopt at four adoption points or stay pinned, content resolves by the state's own
version through a content-addressed archive, and the kind judges through `Kind.adoptContent?`.
The contract is `20-contract.md` C21–C27, §2, §3, §4, §7, §10 and story-graph §8.1, and the
judgement calls are the 2026-10-08 entries in the decision log, including the three that resolve
the red team's F1–F3 (`design/redteam/2026-10-08-10-design.md`). Two refinements on the settled
directions: absent the seam, a session stays pinned rather than adopting additive change by
default, and the replay oracle's new failure widens `campaign_version_missing` rather than
replacing it. **Not yet built** — the next step is `/agentkit:plan`.

**Resolved by design, 2026-10-08 — the `campaignVersion` gap on raw `deserialize`.** S125 made
raw `deserialize` reject a `kindId` that is not its campaign's, but left `campaignVersion`
uncompared, so a session serialized under one resolution was accepted under another. Content
epochs replace the gap rather than patching it: `deserialize` resolves the state's
`(campaignId, campaignVersion)` through the archive and refuses `unknown_campaign` when it does
not resolve (`20-contract.md` §4, C22). The gap stays open in code until that slice lands.

**The content registry holds the host's campaign objects by reference, so "frozen" means
validated, not immutable.** S124 made the engine own the `params` it logs. The review asked for
the same audit of host-supplied campaigns, and the answer is that nothing copies or freezes
them. `buildContentRegistry` (`src/engine/src/core/registry/build.ts`) puts each
`BuiltCampaign.campaign` into `ContentRegistry.campaigns` as the same object, and
`composeCampaigns` (`src/engine/src/core/registry/compose.ts`) passes an uncomposed campaign through unchanged. A
composed campaign is a shallow copy whose `content` the kind's `composeContent` built, and
that may share sub-objects with its modules. A host that mutates a campaign's `content` after
`buildValidatedContentRegistry` returns therefore changes the content every live session
resolves against, with no validation. `Campaign.content` is typed `unknown`, so no
`readonly` modifier protects it either. Every host in this repository and in Adventures builds
its campaigns once and never touches them again, so this is a latent hazard with no observed
instance. It is not a slice's fix. A deep copy or deep freeze of arbitrary kind content
changes the registry's cost and its contract (`20-contract.md` §10.1). It also interacts with
content epochs (above), whose whole purpose is to change a running campaign's content
deliberately, through a validated path. **Resolved for archived content, 2026-10-08:** the
in-memory archive's `publish` stores deep-frozen copies (functions by reference), so nothing it
serves can change after it validated it (`16-content-epochs.md` §4.3). **Retained for the
default epoch:** a registry handed straight to `createEngine` is still held by reference. A host
that wants the guarantee there publishes its registry through the archive. **Revisit** if a host
is found mutating construction-time content.

**Simulation and world-graph check their `kindState` at the top level only.** S126 added
`Kind.validateState` (`20-contract.md` §3), and story-graph checks its state against its
campaign: the current node exists and every declared variable has its type. The other two
kinds check that each top-level field is present with the right container type and trust the
records underneath — about thirty record types in simulation, and the map, entities and
finances in world-graph. A state that passes the top level but carries a malformed record
still fails inside `advance` rather than at the boundary. A deep check is a per-record
validator for each of those types, which would duplicate the type definitions in code and
drift from them unless it is generated. Nothing in either kind reads a raw state that the
engine did not write itself, except a hand-edited or corrupted save. **Revisit** when a host
accepts saves from a source it does not control, or when a schema generator for kind state
exists to produce the validators.

**The session store reports nothing about its own memory.** S127 bounded the store's lock and
session maps, and a host with persistence can now cap the session cache with
`sessionCacheLimit`. A host still cannot see how full that cache is, how often it misses, or how
large the stored blobs are. Without that, it chooses a limit blind. The review proposed cache,
session and blob metrics alongside the bound. They are an observability question rather than a
memory defect: whether they are `EngineEvent`s, `EmittedRecord`s or a separate gauge port
changes 05's channel contract, and no host has asked for them yet. **Revisit** when a host
tunes `sessionCacheLimit` in production, or when the Platform host needs capacity telemetry.

The review also made six recommendations that are not defects (plan 53 §3). Each is recorded
here once, with what would make it worth acting on. None blocks the defect fixes, and several
are product calls rather than engineering ones.

**A story extension is merged by shapes the engine does not contract.** Adventures merges
extension JSON into a base campaign before validation
(`SubZeroDev.Adventures/shared/campaign-extension.ts`), adding nodes, choices and achievements
by reading the portable story shape directly. Its own header names this as the fallback
GameEngine#292 left: a kind-owned `mergeContent` was evaluated and declined because text deltas
covered the frequent cases, and the fallback was acknowledged to break silently on a submodule
bump. The review proposes either a narrow, stable story-extension contract or a versioned,
compatibility-tested set of portable shapes. It warns against a general merge framework for
kinds that have no consumer. **Subsumed by content epochs, 2026-10-08**
([`16-content-epochs.md`](16-content-epochs.md) §10): delivery is an epoch, and authoring is an
attachment (11 §3a, `20-contract.md` §10.4), which is already the stable, engine-owned extension
shape. No separate story-extension contract is designed. What the merge does that attachments do
not is registered below as attachment gaps. Until attachments cover it the merge stays
Adventures', and an engine change to the portable story shape is a breaking change for it.

**No measured operating envelope.** No benchmark says how large a world, how long a session or
how many ticks per request the engine supports. The review names three costs it can see in the
source without having measured any:

- the world-graph pathfinder (`canonicalPathWithCost` in
  `src/engine/src/kinds/world-graph/spatial.ts`) re-sorts its open set on every expansion and
  scans every edge to find a position's neighbours;
- the world materializes its spatial data into state;
- `submitAction` copies the whole `actionLog` on every accepted action, so cumulative copying is
  quadratic in the number of actions.

The proposal is to measure before optimizing: fixed seeds, several map and population sizes,
short and long histories, p50/p95 action latency, state bytes, per-session memory and save time,
with hardware and runtime recorded. Supported limits are then chosen from the measurements. The
likely remedies are an adjacency index, a deterministic priority queue, revision-scoped derived
caches, and snapshot-plus-log storage. Any of them must keep canonical tie-breaking and
world-graph batch invariance, and the per-action tick cap stays. **Revisit** when a consumer
reports latency or memory pressure, or before any public claim about world size or session
length.

**Large modules carry several responsibilities each.** Simulation's resolvers
(`src/engine/src/kinds/simulation/resolvers.ts`) and end-of-week systems (`endOfWeek.ts`),
world-graph's tick pipeline (`src/engine/src/kinds/world-graph/tick/pipeline.ts`) and the
session store (`src/engine/src/core/session/store.ts`) are the largest source files in the
package, each running to a thousand lines or more. The review's concern is change coupling and
review difficulty, not line count. It recommends moving coherent systems and pure helpers into
named modules, keeping the orchestration order and the public interfaces, and no new framework.
**Revisit** when a change to one of these files would be easier to make or review with a
system extracted first. Do the extraction in that change's slice, with replay equivalence as
its proof, not as a standalone refactor.

**The documentation front door is too expensive.** The five canonical design files total about
1.2 MB, most of it in `20-contract.md` and this file. A new reader has no short path to what the
engine does today. The review recommends:

1. a capability map that separates *implemented*, *exercised by a consumer*, *externally
   playtested* and *planned*;
2. a first author journey small enough to finish in one sitting: one campaign, one condition,
   one hidden variable, an ending, then validate, play, save and replay;
3. separate entry points for player promises, author guidance, implementer contracts and
   history;
4. canonical contracts partitioned into bounded, linkable topics through the generator, never
   by hand-maintained copies;
5. active instructions kept short, with incident narratives moved into indexed history;
6. volatile facts generated rather than written.

S128 fixed the one instance of item 6 the review named (`agent.md`'s test count). The rest is a
documentation-architecture pass, not a fix. Item 4 in particular interacts with the
generator's marked-block scheme and with the kit's five-file layout. **Revisit** when a new
contributor or a new consumer repository has to onboard, or when a canonical file no longer fits
the context a generator or reviewer can read in one pass.

**"Three game directions are proven" overstates the evidence.** `00-brief.md` says so of Life
in the Fast Lane, Bulgaria: Make-Your-Own-Adventure and Sun Trap. All three kinds have
implementations and replay fixtures, but only the story route has a real application on it
(Adventures). GameOfLife is a design and specification repository, and SunTrap states that it
has no executable game. The review asks for the claim to be qualified, so that contributors and
the project's own prioritization can tell an implemented kind from a shipped game. It also asks
the README to drop its implication that nobody had made gameplay reusable (Unreal's Gameplay
Ability System and ink both have) in favour of a positive, testable promise, keeping the humour. Both are brief-level wording and the owner's call. **Revisit** at the next
`/agentkit:brief` pass, or sooner if the claim is repeated somewhere a reader will act on it.

**The name "GameEngine" invites the wrong comparison.** The review argues that "game engine"
names an implementation category, suggests graphics-heavy tooling, and hides the non-game
scenario uses. It shortlists *SubZeroDev.Scenarios* and *SubZeroDev.ScenarioKit*. Its collision
screen was preliminary, not a domain, package-registry or trademark search. If the project is
renamed, the review asks for it to be deliberate: brand, repository and package together, with
an alias period, and kind ids and save formats kept stable, because a rename must not break a
saved game. This is a product decision, not an engineering one. **Revisit** when the owner
decides the ecosystem's public positioning, and before any package is published under a second
name.

### Found by the content-epochs design

`16-content-epochs.md` (2026-10-08) left these open deliberately. Its §11 is the source; each is
recorded here once.

**The catalog does not list a campaign that first appears in a publication.** `listCampaigns`
reads the session layer's construction-time registry, so such a campaign is playable through the
channel but absent from `CampaignCatalog`. Whether listing reads the channel, and with which
scope, is a client-surface decision (`20-contract.md`, *Unresolved*). **Revisit** when a host
publishes a new campaign id rather than a new version of an existing one.

**Simulation and world-graph declare no `adoptContent`.** Every session of theirs stays pinned to
the epoch it started on, which is safe and loses nothing they have today. Each kind's
compatibility rule is its own design: simulation's long horizon makes it the kind where a content
revision most needs to reach a running game. **Revisit** when a host publishes content for
either kind to live sessions.

**The durable archive is unspecified.** The in-memory archive never evicts. A host's durable
archive must keep every epoch a stored session, save or committed fixture names, and proving
that needs records the engine never sees (`16-content-epochs.md` §6). Its interface beyond
`ResolutionArchive` and its eviction policy are host-owned. **Revisit** when the first host
persists publications across restarts.

**Overlay privacy beyond capture.** 08 §4 now treats a per-profile overlay's `ResolutionId` as
personal data in a captured fixture. Whether an overlay's existence leaks through anything else a
host exposes — a catalog, an error, a timing difference in adoption — is not designed.
**Revisit** before a host ships per-profile overlays.

**Attachments cannot yet do everything the Adventures extension merge does.** The merge adds
achievements and adds more than one choice to a host node; 04 §10.4's attachment model does
neither. Each is a gap in attachments, not a reason for a second extension contract (story
extension, above). **Revisit** when Adventures moves its extensions onto attachments, which is
what retires its merge.

### Found by the content-epochs red-team revision

**Capture does not refuse a migrated session that carries no migration entry.** 08 refuses a
session whose log carries a migration entry, but nothing in 08 checks `replayCompatible`. A
session migrated across campaign versions before it ever adopted, or migrated in kind shape only,
carries no entry, so capture would turn it into a fixture whose actions were taken on content
the fixture does not name. The gap predates content epochs. Narrowing F1's migration entry to
epoch-bearing logs (2026-10-08) left it as it was rather than opening it. The likely fix is one
line in 08: refuse every `replayCompatible: false` session. It was kept out of the F1 revision
because it is a separate unit. **Revisit** before capture is built.

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
