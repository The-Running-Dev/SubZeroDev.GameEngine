# Post-MVP — The Whole Remaining Programme

**Units:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — everything below the
MVP boundary, plus every entry under *Known Open Items Carried In*.

**Scope:** The umbrella plan for what remains after W0–W23. Sequences the work, assigns
W-numbers, records which TODO entries turned out to be **stale** and why, and states which
units get their own `plans/*.md` now versus when they are actually cut. Planning only — no
document or code in this repository is changed by this plan.

**Depends on:** W0–W23 — all done and merged (`v0.1.0` … PR #73).

**Precedent:** [`plans/27-replay-oracle-programme.md`](27-replay-oracle-programme.md), which
did the same job for W20–W23 and established the convention this follows: *the programme doc
records sequencing and decisions; each unit gets its own plan when it is executed.*

---

## Why a Programme Doc and Not Twelve Plan Files

TODO.md's post-MVP section lists roughly thirty checkboxes across seven headings plus twelve
carried-in open items. Writing a detailed plan for each would produce a dozen documents whose
assumptions expire before they are read — several sit behind dependencies measured in
quarters (the hosted service, content packs, the culture pack), and two of the largest are
gated on design decisions that a later unit is explicitly meant to make.

The honest split, and the one `plans/27` already set:

- **Sequencing, dependencies, and the stale-item audit** — here, once, verifiable now.
- **Near-term units that are actionable today** — their own plan files, written now
  (`plans/32`, `plans/34`, `plans/35`, `plans/36`).
- **Everything else** — summarised here with a proposed W-number and a *"gets its own plan
  when cut"* marker, exactly as W21–W23 were handled before they were built.

---

## Findings — TODO.md Is Stale in Four Places

Checked against the code and the companion repositories before sequencing anything. Each of
these changes what the next work item should be, so they are stated first.

### 1. `KindContext.derive` and the `tick` stream are **already built** — the checkbox is wrong

TODO.md's *Depth: Sun Trap* section opens with:

> `KindContext.derive` and the `tick` stream (04 §3.1, §8). Both are specified and both are
> gaps `simulation` shares…

Both are implemented and have been since W1/W2:

| Claimed gap | Reality |
|---|---|
| `KindContext.derive` | `kernel/types.ts:82` declares it; `kernel/engine.ts:66` supplies it as `derive: deriveAndTrace`, tracing every derivation through `core.rng.stream.derived` |
| The `tick` stream variant | `determinism/types.ts:31` — `{ kind: "tick"; tick: number; system: string }`, one of four variants |
| The `agent` stream variant | `determinism/types.ts:30`, same |
| Their normative encoding | `determinism/rng.ts:15–33`, all four variants encoded, with an exhaustiveness guard |

W1 built the whole `StreamId` union and W2 built the encoder for all of it, not just the
variants story-graph needed. The checkbox describes a gap that closed before it was written
down. **Fix in W24.**

### 2. `10-simulation-kind.md` §14 under-reports the remaining port by eight types

`SimulationKindState` names ten types; §14's *What Remains Upstream* table accounts for two.
The other eight (`CalendarState`, `WorldState`, `StatusEffect`, `Opportunity`,
`ScheduledEvent`, `PendingEventResponse`, `GoalState`, `EconomyState`, `WeeklyActionPlan`)
live in upstream §5.1–§5.6 and §9.1 — roughly 425 further lines — and are listed nowhere as
outstanding. Full evidence table in
[`plans/32-w25-simulation-kind-seam-reconciliation.md`](32-w25-simulation-kind-seam-reconciliation.md),
Finding E.

**Consequence for this programme:** the simulation port is materially bigger than TODO.md
implies, which is why it gets its own programme doc
([`plans/36`](36-simulation-kind-programme.md)) sized from upstream line counts rather than
from that table.

### 3. The dev-dependency advisory item is both **unblocked** and **numerically stale**

TODO.md records "10 (3 moderate, 6 high, 1 critical)" and defers the fix until "the
determinism harness (W18) can prove the upgrade changed no behaviour."

- W18 **is done**, and W20–W23 added a second, stronger instrument (the replay oracle) that
  W18 did not have. The stated precondition is met twice over.
- `npm audit` today reports **6 (3 moderate, 2 high, 1 critical)** — transitive advisories
  resolved upstream on their own. The recorded numbers are wrong.

This is the one carried-in item that graduated from "deferred" to "actionable" purely because
earlier units landed. **Becomes W26** ([`plans/35`](35-w26-toolchain-upgrade.md)).

### 3a. The MVP's own coverage checklist reads as zero-percent complete

Found on a later verification pass, after the tranches below were drafted; numbered `3a` so the
findings above keep their references, the same convention architecture §4a uses.

`09-clients.md` §4 says of itself: *"`MVP.md` §5 requires 'No game logic lives in either client
— verified by the API coverage checklist.' **This is that checklist.**"* All eighteen boxes
(nine operations × two client columns) are `☐`.

W16 and W17 are both `[x]`, each with a done-criterion naming that table, and `MVP.md` §5 is
closed. The nine operations match `core/session/types.ts` one for one, so the work is genuinely
done — but a reader auditing the MVP-done claim follows it to its named instrument and finds
nothing ticked.

It changes no sequencing, which is why it is a finding here and an item in
[`plans/34`](34-w24-core-spec-reconciliation.md) rather than a tranche of its own. It is worth
stating at programme level because it is the only item that makes a **closed** milestone look
open.

### 4. `previewAction` is not a standalone unit and should not be scheduled as one

TODO.md lists it under *Depth: Sun Trap* as its own checkbox, which reads like schedulable
work. Both `12-world-graph-kind.md` §7 and `OPEN-QUESTIONS.md` §2 are explicit that it is
**deliberately not** actionable yet: amending `09-clients.md` §4's coverage checklist from
nine operations to ten also amends `MVP.md` §5 (a Definition-of-Done document) and the MCP
surface, and all three must change "in one change, not three" — when the kind that needs it is
actually built. Scheduling it earlier means editing a Definition-of-Done for a capability
nothing exercises. **Folded into the world-graph build, not scheduled separately.**

---

## The Sequence

Three tranches. Tranche A is small, actionable now, and unblocks the rest. Tranche B is the
main body of remaining engineering. Tranche C is gated on things outside this repository.

### Tranche A — Actionable now (doc and toolchain debt)

| W | Unit | Plan | Size | Depends on |
|---|---|---|---|---|
| **W24** | Core Spec Reconciliation | [`plans/34`](34-w24-core-spec-reconciliation.md) | Small, doc-only | — |
| **W25** | Simulation Kind Seam Reconciliation | [`plans/32`](32-w25-simulation-kind-seam-reconciliation.md) | Small, doc-only | W24 |
| **W26** | Toolchain Upgrade | [`plans/35`](35-w26-toolchain-upgrade.md) | Small, code | W18, W22 |

**W24 before W25** is a real ordering constraint, not tidiness: three conventions W25 would
need to cite (`<kindId>.reason.*`, and the achievement and consequence `StateChange` shapes)
exist only in code today. Reconciling the simulation doc against conventions the core contract
has not yet stated would make that doc assert rules `04-core.md` doesn't define and
`03-story-graph-kind.md` doesn't follow — a new inconsistency. Reasoning in full in
[`plans/32`](32-w25-simulation-kind-seam-reconciliation.md), *Sequencing*.

**W26 is independent of both** and can run in parallel or in any order. It is sequenced into
Tranche A rather than later because it is the first genuine *use* of the replay oracle: a
major-version bump of vitest and eslint is exactly the "did anything change behaviour?"
question W18 and W20–W23 were built to answer, and the answer is worth having before the large
units start rather than after.

### Tranche B — The main body

| W | Unit | Plan | Size | Depends on |
|---|---|---|---|---|
| **W27–W30** | Bulgaria Adventure — remaining four arcs | — (content, no plan file per arc) | Medium, content | — |
| **W31** | Save migration mechanism (04 §10.2) | — | Medium | — |
| **W32–W40** | The `simulation` kind — port and build | [`plans/36`](36-simulation-kind-programme.md) | **Large** — its own programme | W25 |
| **W41–W49 proposed** | The `world-graph` kind — consumer boundary, contract and build | [`plans/39`](39-world-graph-kind-programme.md) | **Large** — its own programme | W24; absorbs `previewAction` |
| **After world-graph** | Content tooling — validator, graph viz, diff, l10n | *when cut* | Large, several units | Kinds it validates |

**The Bulgaria arcs and the migration mechanism are both genuinely un-blocked today** and
could be pulled into Tranche A if the appetite is for content or for closing a known gap
rather than for the simulation kind. They are placed here only because neither is on the
critical path to anything else.

- **Bulgaria arcs** (Inheritance, Enterprise, Driving, Return) — pure `story-graph` content
  against a kind that is built, tested, and has a working authoring path. The lowest-risk
  work remaining in the entire programme, and the one that most directly grows the replay
  corpus. Its DoD is `games/bulgaria-adventure.md`.
- **Save migration** — `Engine.migrate` is a pass-through to `deserialize` today. Correct
  while exactly one `formatVersion` exists, and there is still exactly one. The trigger is
  the *second* `formatVersion`, which the simulation kind is likely to force. Worth cutting
  **before** that rather than during it.

### Tranche C — Gated outside this repository

| Unit | Gate |
|---|---|
| Session capture (`08-session-capture.md`) | The hosting layer — `MVP.md` §4 defers it; nothing to capture from a local client |
| Content packs (`11-content-packs.md`) | "Before mods, not before MVP" — needs a second content source to exist |
| The Bulgaria culture pack | The `simulation` kind being built (it is a pack *over* that kind) |
| More clients (web, Discord) | Nothing technical; the client contract (09) is proven by two |
| Additional locales | Nothing technical — string tables plus tooling, no type change |
| The hosted service | Everything above |
| `docs-template` hardening (3 findings) | A PR against the *template* repo, not this one |

**Session capture deserves one note.** It is the only Tranche C item with four concrete,
testable done-criteria already written (TODO.md, *Rigour: Session Capture*), and its refusal
rules are testable without a hosting layer. If the hosting layer slips indefinitely, the
privacy-contract half could be built and tested against synthetic sessions. Not recommended
now — building a capture path with nothing to capture from is speculative — but it is the
cheapest Tranche C item to pull forward if that changes.

---

## Milestones

| # | Reached when | Meaning |
|---|---|---|
| **M4 — The specs stop lying** | W24 + W25 merged | Every convention the code relies on is stated in a contract; both kind docs reconcile against the same core. The stale checkboxes are gone |
| **M5 — The oracle earns its keep** | W26 merged | A major dependency bump lands with the corpus proving it changed no behaviour — the first time the W20–W23 investment pays out rather than just standing by |
| **M6 — Cross-version proof** | A tag whose **predecessor carries a corpus** | `plans/27`'s M3 says the *second* tag; that is wrong — `v0.1.0` predates the corpus, so a second tag exercises the corpus-free guard, not the oracle. Needs `e26fa9d` tagged `v0.2.0` first, then W26 cuts `v0.3.0`. See [`plans/35`](35-w26-toolchain-upgrade.md), Decision 4 |
| **M7 — Two kinds run** | The simulation kind plays "Stable Life" to a win and a loss | The platform thesis moves from *proven* to *proven twice*. `02-architecture.md` N2's core/kind split stops being an assertion |
| **M8 — Depth** | Bulgaria's five arcs + the culture pack | Content breadth on both kinds |

M6 is worth stating separately from M5, and no longer for the reason `plans/27` gave. The
original framing — "cannot be demonstrated until a second tag exists" — undercounts by one.
`v0.1.0` was cut at `96586bf`, before W22 committed any fixture, so a second tag finds an empty
baseline and the comparison step is skipped rather than run. **M6 needs a tag whose predecessor
carries a corpus**, and the first commit that qualifies is `e26fa9d`. Full evidence and the fix
in [`plans/35`](35-w26-toolchain-upgrade.md), Decision 4.

---

## Decisions

### 1. Fix the stale TODO entries as part of W24, not as a separate housekeeping unit

Four TODO.md entries are wrong (Findings 1–4 above). The temptation is a quick standalone
"tidy TODO.md" commit. Rejected: three of the four are stale *because a contract document is
also silent or wrong* (the `derive` checkbox mirrors nothing in 04 §3.1's prose; the advisory
counts belong next to the upgrade that fixes them; `previewAction`'s status is stated
correctly in two other documents and wrongly only here). Fixing the checkbox without fixing
what made it wrong leaves the same defect one document over — which is this project's named
recurring failure mode. W24 fixes both halves together.

### 2. Do not extract a shared tick-pipeline substrate yet

`OPEN-QUESTIONS.md` §2 already declines this with a stated *revisit when*: the second
tick-driven kind is actually implemented. This programme does not overturn it. `simulation`
(Tranche B) is the first; `world-graph` is the second and is later still. The rule stands —
*one built instance is not a pattern* — and it is the same reasoning `plans/27` Decision 2
used to decline building `createSessionLayer` from one call site.

### 3. The simulation kind gets its own programme doc; the world-graph kind does not, yet

Both are large. The difference is that the simulation kind's source material is **readable
now** — `games/04-engine-specification.md` is present locally, and its section boundaries and
line counts make a defensible unit split possible today. The world-graph kind's content
(maps, scenarios, balance, client) lives in `SubZeroDev.SunTrap` and is design-only with no
code; `12-world-graph-kind.md` §17 explicitly leaves it there. Splitting that build now would
be sizing work against a document that does not exist yet.

> **Superseded.** `SubZeroDev.SunTrap` has since written that document —
> `docs/docs/design/content-and-systems.md`, `game-design.md`, `mvp.md` and
> `client-specification.md`, around 980 lines together, sized similarly to `simulation`'s own
> pre-port source. The precondition this decision names no longer holds.
> [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md) is that
> programme doc, cut once the source material existed to size it against — the same
> milestone `plans/36` reached for `simulation`.

### 4. W-numbers are assigned only when a unit is actually cut, never reserved ahead of it

Written when nothing past W27 existed yet, to avoid pre-assigning `W28`–`W40` before the
order those units would run in was decided — exactly the renumber-and-rewrite-every-
reference problem `TODO.md`'s own numbering note warns about. All of Tranche B named at the
time has since been cut, in this order: Bulgaria's four arcs (**W27–W30**), save migration
(**W31**), and the simulation kind's own nine units (**W32–W40**, `plans/36`). The
convention held throughout — none were reserved before the unit before them existed.

`plans/39`'s **W41–W49** for the world-graph kind is the same convention applied forward,
not an exception to it. The tranche table now repeats that current proposal so the umbrella
and sub-programme do not present different ranges, but **"proposed" is not "assigned."**

The distinction already mattered once. `plans/36`'s header proposed simulation's contract-
and-build split as **W27–W33**. Bulgaria's four arcs and save migration were cut first
(W27–W31), and simulation's real units landed at **W32–W40** — nine units, one more than
proposed and at later numbers. That proposal was still useful decomposition; it simply did
not reserve the labels.

World-graph's **W41–W49** is therefore the current decomposition, sized against real source
material, not a reservation. W41 is the real next number; W42–W49 are assigned only as those
units are cut and may shift if intervening work appears. Whatever follows world-graph —
content tooling or anything else — takes its number only when it is cut.

---

## Explicit Non-Goals

- **No document or code changes from this plan.** It is sequencing and an audit; W24 makes
  the first actual edit.
- **No re-litigation of settled deferrals.** `history`, third-party kinds, the OTel exporter,
  `SessionHost`/`createSessionLayer`, and the tick substrate all have documented *revisit
  when* conditions in `OPEN-QUESTIONS.md` §2. None of their conditions are met; none are
  reopened here.
- **No MVP scope reopening.** `MVP.md` §5 is checked and closed. Everything here builds on it.
- **No plan files for Tranche C.** Their gates are outside this repository; a plan written now
  would be fiction.
