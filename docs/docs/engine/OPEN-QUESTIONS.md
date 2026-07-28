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

- **Provisional simulation numbers** — drift rates, scenario economics, `demandBand`
  thresholds, housing-quality formula, travel costs. Need a balancing pass once the sim
  harness runs. ([`TODO.md`](TODO.md) → Known open items; simulation kind.)
- **`wisdom` attribute has no consumer** — needs one to earn its place
  (`games/04-engine-specification.md` §8.4).
- **`packages/` vs `src/engine/` naming** — the simulation docs
  (`games/05-text-client.md` header, `games/04` §20)
  describe an aspirational `packages/` monorepo; the code is `src/engine/`. Reconcile when
  the layout is actually built out.
- **`history` in the simulation kind's state** — the upstream model carries
  `history: HistoryEntry[]`, a narrative record of what happened. That overlaps
  `StateChange[]`, which `advance` already returns (04 §12), and the event stream
  ([`05-observability.md`](05-observability.md)). Three records of the same events is the
  duplication rule [`10-simulation-kind.md`](10-simulation-kind.md) §2 exists to prevent, so
  `history` is **not adopted** until it is established what it holds that `StateChange` does
  not — most likely player-facing narrative framing, which would make it a projection
  concern rather than state. **Revisit when** the simulation kind's field detail is ported
  (10 §14).
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
- **Doc-tree numbering merge** — the engine specs and the game specs both start at `01-`.
  This was a live problem when they shared one tree; the repo split
  ([`02-architecture.md`](02-architecture.md) §12) has largely dissolved it. **Open:**
  confirm nothing depends on a merged numbering and close the item.

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

---

*Add to this register whenever a decision is deferred or an assumption is made — rather than
leaving it in a commit message or a chat, where the next person will not find it.*
