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
| 225 | #225 | Migrate pre-resume orphaned local saves to the new save-index scheme | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 226 | #226 | SaveRecordStore.delete() has a TOCTOU race with a concurrent put() for the same saveId | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 229 | #229 | resolveApplications removes a JobOpening entirely on hire, not decrementing positionsAvailable | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 234 | #234 | Spike: generic scene-presentation layer (Municipality reference) — not engine work, will move to SubZeroDev.Presentation | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 237 | #237 | validateUnreachableItems predates `shop`: a purchasable item is reported unreachable | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 364 | #364 | Mirror the simulation-kind lifecycles once GameOfLife S7 lands — and do not write them here first | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 371 | #371 | A kind's event severities are literals at each emit call; only the core fixes them in one table | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 375 | #375 | Test-DesignState.ps1: 9 findings against this repository's own tree (ContractListUnreadable, ProjectorFailed, TrackerUnavailable, etc.) | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| 413 | #413 | 48 slices predate the issue-per-slice convention: W0-W40, W61, W63-65, W90-92 have no GitHub issue | — | `49aa72904ff5ba1151b7c41e60d770a3547649d1` |
| 425 | #425 | WorldState.npcs and WorldState.locations are declared but permanently unpopulated dead state | — | `49aa72904ff5ba1151b7c41e60d770a3547649d1` |
| 465 | #465 | W109 — A Uniform That Makes Its Wearer More Employable | W109.1, W109.2, W109.3, W109.4, W109.5, W109.6 | `3f2121db187e020d84618c5d3c39aa2884edecda` |
| 466 | #466 | W110 — An NPC Who Already Remembers You | W110.1, W110.2, W110.3, W110.4 | `3f2121db187e020d84618c5d3c39aa2884edecda` |
| 467 | #467 | W111 — Conditions That Can Ask "Do You Own One?" | W111.1, W111.2, W111.3, W111.4, W111.5, W111.6 | `3f2121db187e020d84618c5d3c39aa2884edecda` |
| 468 | #468 | W112 — A Car That Costs Money to Run | W112.1, W112.2, W112.3, W112.4, W112.5, W112.6 | `3f2121db187e020d84618c5d3c39aa2884edecda` |
| 469 | #469 | W113 — Utilities and Transport on the Weekly Bill | W113.1, W113.2, W113.3, W113.4, W113.5, W113.6, W113.7 | `3f2121db187e020d84618c5d3c39aa2884edecda` |
| milestone/1 | #213 | Dead references to bulgaria-bureaucracy.determinism.test.ts, deleted in #189 | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/2 | #215 | Batch invariance (world-graph's load-bearing property) is tested at exactly one data point | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/2 | #216 | world-graph: 21 source modules (~2,100 LOC) have no adjacent test file | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/13 | #266 | Forking a session at an earlier point should be a store operation | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/13 | #287 | `CampaignSummary` carries only a `titleKey`, and no session-free way to resolve it, so campaign selection cannot render | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #292 | Content packs compose at campaign granularity, but dynamic content injection needs node granularity | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #293 | A session belongs to exactly one campaign, and nothing decides what happens if content spans two | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/1 | #300 | Campaign sources here are fixtures now, but nothing in the tree says so | — | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #395 | W107 — 0.11 Release Candidate Verification | W107.1, W107.2, W107.3, W107.4, W107.5, W107.6, W107.7 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
| milestone/6 | #396 | W108 — Publish 0.11 Readiness | W108.1, W108.2, W108.3, W108.4, W108.5, W108.6 | `f0735fc59fcfd879911771fefdeb1f41cc90f252` |
<!-- outstanding:end -->
