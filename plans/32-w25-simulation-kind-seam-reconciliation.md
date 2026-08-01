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

## Resolved Decisions

All three open questions are answered. Two of the answers changed the proposal above; §*Proposed
Changes* is restated at the end of this section to match.

### R1. Finding C — add `goal.achieved` now — **approved**

§11 gains one row mirroring `goal.failed`:

| Name (after `kind.simulation.`) | Severity | Emitted at |
|---|---|---|
| `goal.achieved` | `info` | A goal's completion condition met |

`info` matches `goal.failed`, and `GoalState.status` already carries `"completed"` as a first-class
value (upstream §5.5), so the event names a transition the state machine already makes.

### R2. Finding F — the reconciled `outcome()` shape

The question assumed three fields needed reconciling. Checking the upstream source establishes
that one of them should not exist at all.

**Evidence:**

| # | Fact | Source |
|---|---|---|
| 1 | **This kind has no ending concept.** Searching the 102 KB upstream spec for `ending` returns only substring hits inside `pendingEventResponses`, `pendingApplications` and `endsChain`. No `Ending` type, no `endingId`, nothing | `04-engine-specification.md`, full-text |
| 2 | Failure is **per-goal** — there is no game-level failure condition type | §14.7, `GoalDefinition.failureConditions?: Condition` |
| 3 | Goals individually complete or fail | §5.5, `GoalState.status: "active" \| "completed" \| "failed"` |
| 4 | The scenario declares the tie-break when both fire in one week | §12.3, `goalFailurePrecedence: "goals_win" \| "failure_wins"`, default `goals_win` |
| 5 | The week cap is a **third** terminal path, and this kind already names it | §14.7 `ScenarioDefinition.weekLimit?`; 10 §10's `week_limit_reached` reason code |
| 6 | The runner imposes no shape — each kind narrows freely | `core/replay/types.ts:71`, `terminal?: unknown` |

**Proposed:**

```typescript
outcome(state: SimulationKindState): {
  resolution: "goals_met" | "failed" | "week_limit_reached" | null;  // null while active
  goalsMet: readonly string[];      // completed GoalDefinition ids, sorted
  goalsFailed: readonly string[];   // failed GoalDefinition ids, sorted
}
```

Three changes from what §12 carries today:

1. **`endingId` is removed.** Fact 1 — it has no referent in this kind, and is inherited from
   `story-graph`'s shape rather than derived from this one. A field that is permanently `null`
   asserts the kind has a concept it does not.

   > **This is *not* a sixth envelope-duplication entry, and should not be recorded as one.**
   > An earlier draft of this plan called it "the view-side form of ledger entry 3." That is
   > wrong, and worth correcting precisely because `CLAUDE.md` warns the ledger has already
   > drifted once by being written from memory. Envelope duplication is *two* sources of truth
   > for one value — a kind carrying what the envelope, `Campaign` or registry already owns.
   > `endingId` here has **no** source of truth: nothing owns it, because the concept does not
   > exist in this kind. It is the opposite failure — **a kind inheriting a sibling kind's
   > shape instead of deriving its own** — and absorbing it into the ledger would inflate the
   > count with an unrelated defect, which is the exact mechanism that caused the drift
   > `CLAUDE.md` records. Leave the ledger at five.
2. **`resolution` has three values, not two.** Collapsing `week_limit_reached` into `failed`
   discards a distinction the kind already makes in its own reason codes (fact 5). Running out
   of weeks is not the same terminal state as tripping a failure condition, and a regression
   oracle that cannot tell them apart is weaker for no gain.
3. **`goalsFailed` is added.** Facts 3 and 4 together mean a game can end `goals_met` *while*
   some goals failed. Without this field, "every goal met" and "goals met under `goals_win`
   while two others failed" produce byte-identical outcomes, and the oracle cannot distinguish
   two materially different playthroughs.

**Deliberately excluded:**

- **`failureId`** — `world-graph` carries one because its failure conditions are independent of
  its objectives. This kind's hang off goals (fact 2), so the failing goal is already in
  `goalsFailed`. When several fail in the same week, *which one ended it* is an artifact of
  iteration order, not a fact about the game; publishing it would make the oracle sensitive to a
  sort order rather than to behaviour.
- **The week it ended on** — excluded by 07 §3.4 along with money and needs, all of which a
  balance pass changes legitimately.
- **`goalFailurePrecedence`** — campaign data, not outcome.

Both arrays are **sorted**, per the canonical-iteration rule.

### R3. Section placement — the original proposal was wrong against *both* siblings

The instinct behind the question was right: 03 and 10 do not have matching section lists, and
matching them was never the requirement. Comparing all three kind docs settles it.

| | `03` story-graph | `10` simulation | `12` world-graph |
|---|---|---|---|
| Validation | **§11**, after §10 Determinism | *absent* | **§15**, after §14 Content |
| `initialState` | folded into **§8** *Runtime State and the Turn* | *absent* | folded into §3/§4 |
| "What remains" | — | §14, last | §17, **last** |

Two corrections follow:

- **Validation belongs late, not after §8.** Both siblings place it after the determinism and
  content material, not next to conditions. The original proposal (after §8 *Conditions and
  Requirements*) matched neither.
- **Initialization should not be a new section at all.** *Neither* sibling gives `initialState`
  its own top-level section — 03 folds it into §8 *Runtime State and the Turn*, 12 into its turn
  sections. The equivalent home here is **§3 *The Turn Is a Week***, which already owns the week
  lifecycle. Adding a section 03 itself does not have would make 10 the outlier.

**Revised placement:**

- **Initialization → folded into §3.** No new section, no renumbering.
- **Validation → a new §14**, after §13 *Determinism*, matching 03's position exactly.
  *What Remains Upstream* moves §14 → §15, staying last as it does in 12.

**This is the cheapest correct option, and the cost is bounded and enumerated.** External
documents reference **10 §2, §3, §6, §7 and §14**. Under this placement §1–§13 keep their
numbers, so only `10 §14` moves:

| File | Line | Reference |
|---|---|---|
| `12-world-graph-kind.md` | 500 | "as Life in the Fast Lane does for `simulation` (10 §14)" |
| `12-world-graph-kind.md` | 511 | "the same reasoning, as 10 §14" |
| `OPEN-QUESTIONS.md` | 64 | "when the simulation kind's field detail is ported (10 §14)" |
| `plans/32` (this file) | — | Finding E's table header |
| `plans/36` | 36 | "In 10 §14's table?" |

Plus 10's own two internal references to §14, in its status line and §2.

The original two-insertion proposal would have moved §6, §7 **and** §14, breaking references in
the same five files plus `plans/32`'s Finding H and `12` §447 — for no reader benefit, since it
also placed both sections where neither sibling puts them.

---

## Proposed Changes (revised per R1–R3)

1. **§2** — add the `completed`/`failed` → `ended` mapping (Finding F), cross-referencing 12 §8.
2. **§3** — fold in `initialState`/`InitialStateResult`: the campaign→starting-state mapping and
   that `status` is always `"active"` from `initialState` (Finding A, placed per R3).
3. **§8** — one sentence bounding its scope to conditions and requirements, deferring
   `Modifier`/`Reward` to the content-type port (Finding H).
4. **§10** — one line citing W24's now-codified `<kindId>.reason.*` convention (Finding D).
5. **§11** — add the `goal.achieved` row (R1).
6. **§12** — replace `outcome()` with R2's shape.
7. **New §14 — Validation**, after §13 (Finding B, placed per R3). States the Tier 1/2
   obligation, names the categories needing rules once the content port lands, and explicitly
   defers the concrete rules — worded like the existing `history` deferral.
8. **§14 → §15** *What Remains Upstream*: renumber, complete its table with Finding E's eight
   types and Finding H's §13.3–§13.4, and soften the closing claim to match.
9. **Update the five external `10 §14` references** listed in R3, plus 10's own two.

No other content changes. §1, §4–§7, §9, §13 keep both their text and their numbers.

## Done-When

- `initialState`/`InitialStateResult` semantics are stated **within §3**, not as a new section
  (R3).
- **§14 Validation** exists, after §13, even if its concrete rules stay deferred to the content
  port.
- The `completed`/`failed` → `ended` mapping is stated in §2.
- `outcome()` matches R2 exactly: `endingId` gone, three-value `resolution`, `goalsMet` and
  `goalsFailed` both sorted.
- §11 carries `goal.achieved`, so nothing populates `goalsMet` unobserved.
- §15's table lists every type `SimulationKindState` names, plus §13.3–§13.4.
- **§1–§13 keep their numbers.** Only *What Remains Upstream* moves (§14 → §15) — verified by
  grepping `10 §` across the repository, not assumed.
- The five external `10 §14` references in R3's table are updated, plus 10's own two.
- No content from §1–§14 as they exist today is lost.
- `build/Test-Documentation.ps1` passes, and `./docs.ps1 -BuildOnly` passes (both Docusaurus
  link checks are `'throw'`).

---

## Explicitly Not In Scope

- Porting any of the field-level content (§15 after this unit) — that is the work this unit unblocks
  ([`plans/36-simulation-kind-programme.md`](36-simulation-kind-programme.md)), not this unit.
- Deciding `history`'s fate — tracked in `OPEN-QUESTIONS.md` §2, gated on the content port for both
  `simulation` and `world-graph`, and explicitly to be resolved "both together or not at all."
- Documenting `<kindId>.reason.*` in `04-core.md` §12 — that is W24's job (Finding D).
- Any code under `src/engine/` — there is no simulation kind implementation to reconcile
  against yet. This pass is doc-against-doc and doc-against-interface only.
