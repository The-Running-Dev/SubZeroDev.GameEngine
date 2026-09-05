# Design State Index

> **Generated, not authored.** Every table below sits inside a marked region that
> `tools/Update-DesignProjection.ps1` rewrites from the records under `design/state/`. A hand
> edit between two markers is discarded on the next run; prose outside them is kept. `/track`
> regenerates this file in the same commit as the work-mirror refresh it projects, which is
> what keeps `ProjectionStale` from firing.

**What this repository actually keeps.** Only the work mirror — `design/state/work/`, one
`WorkRef` per issue, written by `/track` and by nothing else. There are no `Unit`, `Invariant`,
`Contract`, `Decision` or `Question` records here, so the five tables that project them render
their empty-set placeholder and will keep doing so until this repository adopts those record
kinds. That is the state described in `AGENTS.md`, *Writing a design-state record*: decisions
are written to `design/90-decisions.md`'s own register, in prose, not as records. The
**Outstanding work** table is therefore the only one carrying real rows today.

## Units

<!-- units:start -->
| Id | Kind | Anchor |
|---|---|---|
| _(no active unit records yet)_ | | |
<!-- units:end -->

## Bound by

Which units bind each invariant.

<!-- bound-by:start -->
| Invariant | Bound by |
|---|---|
| _(no invariant records yet)_ | |
<!-- bound-by:end -->

## Consumers

Which units consume each contract.

<!-- consumers:start -->
| Contract | Consumers |
|---|---|
| _(no contract records yet)_ | |
<!-- consumers:end -->

## Decision affects

The units a decision is in force for.

<!-- decision-affects:start -->
| Decision | In force for |
|---|---|
| _(no decision records yet)_ | |
<!-- decision-affects:end -->

## Question affects

The units a question blocks, and the units that have answered it.

<!-- question-affects:start -->
| Question | Blocks | Answered |
|---|---|---|
| _(no question records yet)_ | | |
<!-- question-affects:end -->

## Outstanding work

Open `WorkRef` records, ordered by rank. A projection of `design/state/work/`, never a second
read of the tracker — a closed record stays on disk but is not outstanding work and is not
rendered here.

<!-- outstanding:start -->
| Rank | Issue | Title | Criteria | Mirrored at |
|---|---|---|---|---|
| 18 | #245 | Nothing checks emitted → registered for reason codes, and hand-auditing has now failed twice | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 19 | #267 | Provisional simulation-kind numbers need a balancing pass | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 22 | #270 | Extract a shared SystemPipeline substrate for tick-driven kinds (simulation + world-graph) | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 23 | #275 | `wisdom` attribute has no consumer in the simulation kind | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 24 | #276 | `SaveRecordStore.delete` has no caller anywhere | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 25 | #277 | There is no per-player save query, and two hosts have now invented one | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 26 | #278 | `VisibleStat` omits the declared range, so clients read `Campaign.content` to get it | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 27 | #279 | `listCampaigns()` is synchronous, so no remote store can implement it | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 28 | #280 | Reproducing a stored session's blob requires pinning `IdSource.newGameId` | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 29 | #281 | `SessionStore` has no concept of a caller, so authorization lives entirely outside it | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 30 | #282 | `Kind.outcome` has no shape a host can read generically | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 142 | #142 | World-graph: demolished guests always route to exits[0], not nearest exit | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 145 | #145 | World-graph: scenery placement has no rotation/bounds validation (unlike buildings) | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 146 | #146 | World-graph: staff assignment emits both StateChanges unconditionally, even when unchanged | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 168 | #168 | Design a defensive-cloning strategy for the Kind.project seam | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 180 | #180 | site/ declares five ESLint packages it never runs | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 195 | #195 | Enforce StatusEffect.stacking (refresh replaces, resets expiry) when an effect is applied | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 225 | #225 | Migrate pre-resume orphaned local saves to the new save-index scheme | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 226 | #226 | SaveRecordStore.delete() has a TOCTOU race with a concurrent put() for the same saveId | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 229 | #229 | resolveApplications removes a JobOpening entirely on hire, not decrementing positionsAvailable | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 234 | #234 | Spike: generic scene-presentation layer (Municipality reference) — not engine work, will move to SubZeroDev.Presentation | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 237 | #237 | validateUnreachableItems predates `shop`: a purchasable item is reported unreachable | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 350 | #350 | design/20-contract.md: audit codes table missing building_broken (W83) | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 364 | #364 | Mirror the simulation-kind lifecycles once GameOfLife S7 lands — and do not write them here first | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 371 | #371 | A kind's event severities are literals at each emit call; only the core fixes them in one table | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 375 | #375 | Test-DesignState.ps1: 9 findings against this repository's own tree (ContractListUnreadable, ProjectorFailed, TrackerUnavailable, etc.) | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 413 | #413 | 48 slices predate the issue-per-slice convention: W0-W40, W61, W63-65, W90-92 have no GitHub issue | — | `49aa72904ff5ba1151b7c41e60d770a3547649d1` |
| 418 | #418 | Conditions cannot address an actor-owned array by id | — | `49aa72904ff5ba1151b7c41e60d770a3547649d1` |
| 425 | #425 | WorldState.npcs and WorldState.locations are declared but permanently unpopulated dead state | — | `49aa72904ff5ba1151b7c41e60d770a3547649d1` |
| 433 | #433 | Test-DesignDrift.ps1 cannot see a criterion the slices doc has ticked | — | `dc7db7e3ee714ab8bd7237571965dc91aa7eb5c3` |
| 435 | #435 | Issue #391's checkbox mirror shows all W103 criteria ticked; design/30-slices.md ticks only three | — | `84dab74bd14f1a3c9acd2b86599acf5538b4cc7e` |
| milestone/3 | #203 | CI: cache Alpine chromium install in Verify Documentation Build | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/2 | #211 | Assert per-kind regression evidence exists, so deleting a test class fails the build | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/1 | #212 | Vision doc says "two kinds ship in v1"; the repository ships three | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/1 | #213 | Dead references to bulgaria-bureaucracy.determinism.test.ts, deleted in #189 | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/1 | #214 | Slice ledger checkboxes drifted from delivery reality: W50/W51/W66 unticked, W41–W49 not headings | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/2 | #215 | Batch invariance (world-graph's load-bearing property) is tested at exactly one data point | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/2 | #216 | world-graph: 21 source modules (~2,100 LOC) have no adjacent test file | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/3 | #217 | docs-deploy.yml never received the Playwright/Chromium fix docs-ci.yml's verify job got; last three deploys failed | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/4 | #218 | Envelope-duplication has recurred five times with no mechanical guard; add one | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/5 | #219 | design/ has no customer, competitive analysis, or monetization path — the commercial thesis is entirely unrecorded | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/13 | #266 | Forking a session at an earlier point should be a store operation | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/13 | #287 | `CampaignSummary` carries only a `titleKey`, and no session-free way to resolve it, so campaign selection cannot render | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #292 | Content packs compose at campaign granularity, but dynamic content injection needs node granularity | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #293 | A session belongs to exactly one campaign, and nothing decides what happens if content spans two | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/1 | #300 | Campaign sources here are fixtures now, but nothing in the tree says so | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #392 | W104 — Release 0.11 Compatibility Sweep | W104.1, W104.2, W104.3, W104.4, W104.5, W104.6, W104.7 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #393 | W105 — Documentation and Landing Publication Review | W105.1, W105.2, W105.3, W105.4, W105.5, W105.6, W105.7 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #394 | W106 — Tracker Evidence Closure | W106.1, W106.2, W106.3, W106.4, W106.5, W106.6, W106.7 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #395 | W107 — 0.11 Release Candidate Verification | W107.1, W107.2, W107.3, W107.4, W107.5, W107.6, W107.7 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #396 | W108 — Publish 0.11 Readiness | W108.1, W108.2, W108.3, W108.4, W108.5, W108.6 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
<!-- outstanding:end -->
