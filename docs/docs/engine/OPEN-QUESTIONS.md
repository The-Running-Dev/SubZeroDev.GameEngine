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

## 1. MVP-Relevant Gaps — Resolve Within Phases 1–5

These affect the story-graph MVP and should be closed as the phase that touches each is
built.

### 1.1 `PlayerProfile` Is Not a Core Concept — *Highest Priority*

The MVP Definition of Done requires the "It Builds Character" achievement to **persist to
a `PlayerProfile` across sessions** and to degrade to "no achievements" if the profile is
missing or corrupt ([`MVP.md`](MVP.md) §5; [`03-story-graph-kind.md`](03-story-graph-kind.md)
§7). But `PlayerProfile` is defined **only in the simulation kind**
(`games/04-engine-specification.md` §16.3) —
[`04-core.md`](04-core.md) has no profile at all.

A durable, cross-kind, out-of-game-state profile is a **platform** concern, not one kind's.
**Open:** where does it live (a core profile store beside the session store, 04 §7)?
Its shape, its persistence boundary (must stay outside `GameState` so it can't perturb
determinism), and the exact "missing/corrupt → degrade" contract. **Resolve before Phase 2
achievements.**

### 1.2 Base Reason-Code String Table Ownership

`BASE_REASON_CODES` (04 §12) are machine-readable, but their player-facing `LocKey`
messages are not enumerated anywhere. **Open:** does the core ship a base string table
for the base codes, or must every campaign supply those strings? Needed for the text
client's reason rendering (Phase 4).

### 1.3 Content Loader / Build Step Is Referenced, Not Typed

The registry is "built from files", with inline strings lifted into `registry.strings`
(04 §10.1; architecture §2.4.1). The build/extraction is described in prose but is not a
typed deliverable. **Open:** confirm the authoring-form → built-registry contract is
specified enough to implement before Phase 3 content.

### 1.4 A Campaign That Settles Straight to an Ending

`createGame` runs `settle` once; a degenerate campaign could land on an `ending` at turn 0
(03 §8.2). **Open:** is a zero-choice game valid, or should validation flag "no reachable
choice" (Tier 2)? Low stakes — decide when writing validation (Phase 2/3).

---

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
- **Doc-tree numbering merge** — both doc sets start at `01-`; merging the numbering
  schemes is deferred ([`02-architecture.md`](02-architecture.md) §12).

---

## 3. Judgement Calls to Revisit (Settled for the MVP)

Decided deliberately, each with a documented "revisit when." Listed here only as a pointer
so they are not forgotten.

- **Story-graph kind** — dropped the `string` variable type; no `unlock` consequence;
  `auto` vs a one-transition `random`; `SETTLE_STEPS` = 64; `visited` counts *every* entry.
  See [`03-story-graph-kind.md`](03-story-graph-kind.md) §13.
- **Core** — the `Condition` operator set is **frozen**; additions require a concrete
  campaign need. See [`04-core.md`](04-core.md) §18.

---

*Add to this register whenever a decision is deferred or an assumption is made — rather than
leaving it in a commit message or a chat, where the next person will not find it.*
