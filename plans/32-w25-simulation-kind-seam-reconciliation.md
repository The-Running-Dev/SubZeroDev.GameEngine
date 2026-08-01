# W25 — Simulation Kind Seam Reconciliation

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — proposed as W25, under
*Depth: Life in the Fast Lane*, satisfying that section's first checkbox ("Specify the kind
first, in this repository").

**Scope:** Doc-only. Bring [`10-simulation-kind.md`](../docs/docs/engine/10-simulation-kind.md)
up to date against conventions the codebase settled *after* the doc was written, close two
places where it is silent about a `Kind` interface member every kind must implement, and fix
three internal inconsistencies. No code changes — nothing under `src/engine/` is touched.

**Depends on:** **W24** (Core Spec Reconciliation, `plans/34-…`). See *Sequencing* below —
this dependency was found while writing this plan and is the reason both units are numbered
the way they are.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md).

> **Renumbered.** This plan was first drafted as W24 with no dependencies. Finding D below
> established that reconciling this document *before* the core conventions it would need to
> cite would create a new inconsistency rather than remove one, so the core pass took W24 and
> this became W25. The plan file keeps its number (32) — `plans/` numbering is positional and
> append-only, and has never tracked W-numbers (plan 28 is W20).

---

## Why This Doc, Why Now

`10-simulation-kind.md` was written in PR #16, before W1 even started. TODO.md's own checkbox
("Specify the kind first, in this repository") describes exactly what this document already
claims to be — the seam-only contract, analogous to `03-story-graph-kind.md` — so on its face
the checkbox looks satisfiable by marking it done.

It shouldn't be. Several conventions that now genuinely exist in the codebase postdate this
doc, two full `Kind` interface members are never mentioned in it, and three of its own sections
disagree with each other or with the envelope. Building against a seam doc with holes in it is
how this project's recurring defect (`CLAUDE.md`, *Where Drift Happens*) happens again, one
level up — kind-doc-to-core-interface drift instead of kind-doc-to-kind-type drift. Closing it
before the "then build it" TODO item starts is cheap; finding it mid-build is not.

Chosen over the two other near-term candidates (the ~45KB field-level port, and the next
Bulgaria arc) because it is small, decidable without new design work, and is a real
prerequisite either way: the field port needs a seam that isn't quietly missing two interface
members.

---

## Sequencing — Why W24 Comes First

Finding D started as "no change needed" and turned into this unit's dependency.

The `<kindId>.reason.*` messageKey convention is real in code (`kinds/story-graph/reasons.ts`)
but is documented nowhere — not in `03-story-graph-kind.md` §8.3, not in `04-core.md` §12.
TODO.md already carries it as a *Known Open Item*. If this unit made `10-simulation-kind.md`
state the convention while 03 and 04 stayed silent, the result would be one kind doc asserting
a rule the core contract doesn't define and the sibling kind doc doesn't follow — a new
inconsistency, not a fixed one.

The same applies to the two `StateChange` shapes (achievement unlock, consequence applied),
both of which are invented-but-load-bearing conventions that TODO.md flags as needing
codification in `04-core.md` §12. A simulation kind emits both.

So: **W24 codifies the conventions in the core contract; W25 reconciles this kind against a
core that has them.** Doing it in the other order means writing §10 (Reason Codes) twice.

---

## Findings

Verified against the current doc, `04-core.md`, `03-story-graph-kind.md`,
`12-world-graph-kind.md`, the code under `src/engine/src/`, and the upstream
`games/04-engine-specification.md` (readable locally at
`D:\Dropbox\Projects\SubZeroDev.GameOfLife\docs\docs\games\`).

### A. `initialState` / `InitialStateResult` — entirely unaddressed

`Kind.initialState(campaign, ctx): InitialStateResult<KState>` (04 §4) is a required member of
every kind. `03-story-graph-kind.md` gives it real space — the settle-at-creation case, where a
campaign can resolve straight to an ending before the player acts, and `InitialStateResult`
exists precisely so a kind can report that (04 §4: `KState` is opaque to the core, "so the kind
must *say so*"). `10-simulation-kind.md` never mentions `initialState` or `InitialStateResult`
once across its 14 sections.

There is no obvious analogue of "settle to an ending immediately" for a weekly-tick kind — a
week always needs at least one `end_week` to resolve anything — so the answer is probably
simple (`status` is always `"active"` from `initialState`). But "probably" is exactly what this
document exists to remove.

### B. `validateCampaign` / Tiered Validation — entirely unaddressed

04 §11 requires every kind to supply `validateCampaign`, feeding the core's Tier 1 (hard fail)
/ Tier 2 (warn) split. `03-story-graph-kind.md` §11 is a full section of kind-specific rules;
`12-world-graph-kind.md` §15 likewise. `10-simulation-kind.md` has no Validation section at
all — not even a stub. Concrete rules (referential integrity for job/course/housing ids,
declared-field conformance) are legitimately blocked on §14's content-type port, but the doc
should *say* that in a Validation section, the way it already handles `history` as a named
deferred question, rather than never raising the topic.

### C. `outcome().goalsMet` has no corresponding success event

§12's `outcome()` returns `goalsMet: readonly string[]`, implying something records when a goal
is met. §11's event table has `goal.failed` but no success counterpart, and nothing else in the
document explains how a goal becomes "met." Unlike A and B this is not an unaddressed interface
member — it is two parts of the same document disagreeing.

**Recommendation:** add the row now (`goal.achieved`, `info`, "A goal's success condition met"),
mirroring `goal.failed`. It is one table row, costs nothing, and does not prejudge `GoalState`'s
shape the way adopting `history` would. Flagged as a decision point rather than presupposed,
per this repo's one-at-a-time sign-off convention.

### D. `<kindId>.reason.*` namespacing — deferred to W24, not resolved here

Covered under *Sequencing* above. Once W24 codifies it in `04-core.md` §12, this unit's §10
(Reason Codes) cites it in one line. Without W24, this unit should not touch it.

### E. §14's "What Remains Upstream" table under-reports what remains — by eight types

This is the finding with the largest consequences for planning, and it is verifiable by
counting.

§2's `SimulationKindState` names ten types. §14's table accounts for **two** of them:

| Type in `SimulationKindState` (10 §2) | Upstream home | In §14's table? |
|---|---|---|
| `PlayerState` | §8.1–§8.9 (`ActorState`, line 1174) | **Yes** |
| *(content definitions)* | §14.1–§14.9 | **Yes** |
| `CalendarState` | §5.1 (line 576) | **No** |
| `WorldState` | §5.3 (line 637) | **No** |
| `StatusEffect` | §5.4 (line 741) | **No** |
| `Opportunity` | §5.4 (line 755) | **No** |
| `ScheduledEvent` | §5.4 (line 771) | **No** |
| `PendingEventResponse` | §5.4 (line 782) | **No** |
| `GoalState` | §5.5 (line 888) | **No** |
| `EconomyState` | §5.6 (line 921) | **No** |
| `WeeklyActionPlan` | §9.1 (line 1569) | **No** |

Upstream §5.1–§5.6 is roughly lines 532–956 — about 425 lines of type detail that
`SimulationKindState` directly depends on and that §14 does not list as outstanding. §14's
closing claim, "Nothing above changes this contract's shape," is true of what the table lists;
it is not a statement about the eight types the table omits.

The fix here is narrow — make §14's table complete — but the *planning* consequence is not:
the simulation port is materially larger than §14 currently implies, which is why
[`plans/36-simulation-kind-programme.md`](36-simulation-kind-programme.md) sizes it from the
upstream line counts rather than from this table.

### F. The `GameStatus` conflict is resolved for `world-graph` and unaddressed here

Upstream `GameStatus` is `"active" | "completed" | "failed" | "abandoned"` (line 562). The
envelope's is `"active" | "ended" | "abandoned"` (04 §2, `kernel/types.ts:23`). `completed` and
`failed` do not exist at the envelope level.

`12-world-graph-kind.md` §8 confronts this head-on: both map to `ended`, **the core has no
concept of winning**, and the win/loss distinction becomes terminal identity via `Kind.outcome`.
`10-simulation-kind.md` inherits the identical conflict from the identical upstream document
and never mentions it — §2's table says only `status` → "The envelope."

It compounds with Finding C. `world-graph`'s outcome carries an explicit discriminator
(`resolution: "objectives_met" | "failed" | null`); simulation's is
`{ endingId: string | null; goalsMet: readonly string[] }`, which has no way to express *failed*
— even though the upstream section this kind must port (§12.3) is literally titled "Goals and
**Failure** Precedence." So §12's `outcome()` is very likely under-specified, not merely
under-documented.

**Recommendation:** state the `completed`/`failed` → `ended` mapping in §2 (one row or one note,
mirroring 12 §8), and add a failure discriminator to §12's `outcome()`. The second half is a
real design decision, not a transcription — flagged for sign-off, not assumed.

### H. §8's scope is narrower than its title — `Modifier` and `Reward` have no home at all

§8 is titled *Conditions and Requirements* and addresses only the frozen operator set: "Reused
verbatim from the core's frozen operator set (04 §18)… This kind adds no operators." True, and
it covers upstream §13.1 and §13.2.

But upstream §13 has four subsections. **§13.3 `Modifier` and §13.4 `Reward` are simulation
mechanics, not condition operators**, and they appear nowhere in this document — not in §8, not
in §7 (Content Definition Types), not in §14's table. `Reward` alone is a thirteen-value
`RewardType` union covering credentials, skills, money, items, reputation, relationships,
unlocks, opportunities, flags, modifiers and counters — the entire outcome vocabulary of the
kind.

This compounds Finding E: the doc under-reports what remains both in `SimulationKindState`'s
types *and* in the mechanics hanging off `Condition`.

One of them carries a determinism hazard worth flagging in the same pass: `Modifier.operation`
includes `"multiply"` with a `value: number`, targeting paths that include money — which 10 §6
states is **integer cents, no floating point**. Upstream specifies no rounding rule. It is not
this unit's job to fix that (it belongs in the content-type port, `plans/36` W29, which records
it as Finding 2), but §14's table should name §13.3–§13.4 as outstanding so the port does not
inherit it silently.

**Change:** add §13.3–§13.4 to §14's table alongside the eight types from Finding E, and add
one sentence to §8 noting that its scope is conditions and requirements only, with modifiers
and rewards deferred to the content-type port.

### G. Checked, no drift found — recorded so these don't reopen

- **Envelope-duplication fix** (§2's table dropping `version`/`gameId`/`seed`/`status`/
  `actionLog`/`metadata`/`rng`) — correct, and matches `CLAUDE.md`'s ledger entry 4. Verified
  against upstream `GameState` (line 537): all seven are genuinely there upstream and genuinely
  gone here. No change.
- **Event namespace** — `kind.simulation.*` (§11) matches 05 §9 exactly. No change.
- **Where the rival lives** — §2 names `player` but no rival, which looked like a gap. It is
  not: upstream puts rivals in `WorldState.agents: AgentState[]` (line 649), which
  `SimulationKindState.world` already covers. No change.
- **`Kind.outcome`'s general shape** — a valid narrowing of `outcome(state): unknown` (04 §3),
  following story-graph's `endingId`-plus-extras pattern. The *shape* is fine; Finding F is
  about its contents.

---

## Proposed Changes

1. **New §X — Initialization**, after §4 (Actions), before §5 (Resolution): `initialState`'s
   campaign→starting-state mapping, and that `status` is always `"active"` for this kind, with
   Finding A's one-sentence reasoning.
2. **New §Y — Validation**, after §8 (Conditions and Requirements): states the Tier 1/2
   obligation, names the categories needing rules once §14 lands, and explicitly defers the
   concrete rules — worded like the existing `history` deferral, not left silent.
3. **§2** — add the `completed`/`failed` → `ended` mapping (Finding F), cross-referencing
   12 §8 so the two kinds visibly resolve it the same way.
4. **§11 Events** — add the `goal.achieved` row (Finding C), pending sign-off.
5. **§12 Terminal Identity** — add a failure discriminator to `outcome()` (Finding F), pending
   sign-off on its exact shape.
6. **§14** — complete the "What Remains Upstream" table with the eight missing types
   (Finding E) and upstream §13.3–§13.4 (Finding H), and soften the closing claim to match what
   the table now says.
6a. **§8** — one sentence bounding its scope to conditions and requirements, deferring
   `Modifier`/`Reward` to the content-type port (Finding H).
7. **§10 Reason Codes** — one line citing W24's now-codified `<kindId>.reason.*` convention.
8. **Renumbering** — two insertions shift the sections below them. Every in-document
   self-reference (`§12`, `§13`, `§14`) is checked and updated; cross-document references
   (`04 §14`, `05 §9`, `12 §8`) are unaffected. This is exactly the drift class `CLAUDE.md`
   warns about, applied within one document.

No other content changes. §3 (turn=week), §5–§7, §9 keep their text; only their numbers move.

---

## Open Questions for Sign-Off

1. **Finding C** — add `goal.achieved` now (recommended), or defer with a note like `history`'s?
2. **Finding F, second half** — what shape should the failure discriminator take? Mirroring
   `world-graph`'s `resolution: "goals_met" | "failed" | null` is the obvious candidate, but
   simulation has `endingId` *and* `goalsMet` already, so the three fields need reconciling
   rather than a fourth bolted on. This is the only genuine design decision in the unit.
3. **Section placement** for §X/§Y — proposed to mirror 03's ordering, but 03 and 10 don't have
   identical section lists; worth a reader-level sanity check before renumbering.

## Done-When

- `initialState`/`InitialStateResult` semantics are stated for this kind.
- A Validation section exists, even if its concrete rules stay deferred to §14.
- The `completed`/`failed` → `ended` mapping is stated, and `outcome()` can express failure.
- The `goalsMet`/`goal.failed` asymmetry is resolved or explicitly deferred, not silent.
- §14's table lists every type `SimulationKindState` names, plus §13.3–§13.4.
- Every in-document section cross-reference still resolves after renumbering.
- No content from §2–§14 as they exist today is lost, only renumbered.
- `./docs.ps1 -BuildOnly` passes (both link checks are `'throw'`).

---

## Explicitly Not In Scope

- Porting any of §14's field-level content — that is the work this unit unblocks
  ([`plans/36-simulation-kind-programme.md`](36-simulation-kind-programme.md)), not this unit.
- Deciding `history`'s fate — tracked in `OPEN-QUESTIONS.md` §2, gated on the §14 port for both
  `simulation` and `world-graph`, and explicitly to be resolved "both together or not at all."
- Documenting `<kindId>.reason.*` in `04-core.md` §12 — that is W24's job (Finding D).
- Any code under `src/engine/` — there is no simulation kind implementation to reconcile
  against yet. This pass is doc-against-doc and doc-against-interface only.
