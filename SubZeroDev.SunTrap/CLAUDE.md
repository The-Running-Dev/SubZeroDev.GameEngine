# Project Instructions

## What This Project Is

**Sun Trap — the game.** A satirical resort-management simulation: its **design** and,
later, its **content and client**. It is *not* an engine. It runs on the `world-graph` kind
in a platform that lives in another repository.

```text
SubZeroDev.GameEngine     the deterministic platform — another repository
  └── world-graph         the kind — engine-owned code, engine repository
        └── Sun Trap      this repository — campaigns, design, client, balance
```

**Companions:**
- **Engine** — [SubZeroDev.GameEngine](https://github.com/The-Running-Dev/SubZeroDev.GameEngine):
  the core, the kinds, the contracts. Published specs at
  <https://game-engine.subzerodev.com/docs/>.
- **Sibling game** — [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife):
  Life in the Fast Lane, on the `simulation` kind. Same relationship to the engine that this
  repository has. When unsure how a game repo should relate to the engine, look there.
- **Hosting / NEaaS** — [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform):
  deferred, and not this project's concern.

## The Boundary — Read This Before Anything Else

**Most of what feels like a game decision here has already been decided by the engine, and
those decisions are not re-openable in this repository.** The single most likely failure
mode in this repo is re-specifying something the engine owns, in slightly different words,
and creating a contradiction nobody notices until implementation.

The kind contract is
[World-Graph Kind](https://game-engine.subzerodev.com/docs/engine/world-graph-kind). Read it
before writing anything that describes behaviour rather than content.

| The engine decides | Do not re-specify here |
|---|---|
| What may live in game state | No `version`, `gameId`, `seed`, `status`, `metadata`, action log, or persisted RNG state in any shape this repo defines |
| The action list and parameters | `build`, `demolish`, `hire_staff`, `fire_staff`, `assign_staff`, `set_price`, `open_building`, `close_building`, `dismiss_alert`, `advance_ticks` — that is the set |
| Determinism | Integers only, ties break by entity id, canonical iteration order, engine-derived entity ids, no `Math.sqrt` in distance, no serialized caches |
| Batch invariance | A batch of ticks reaches the same world as the same ticks taken singly. Presentation speed is never a game input |
| Win and loss | Not engine statuses. The envelope has `active | ended | abandoned`; win/loss is terminal identity, published ids only |
| Reason codes and event names | Defined in the kind contract. A new one is an engine change, not a content change |
| Content pack merging | Campaigns replace wholesale, strings replace per key |
| The client contract | A client is a projection of the session store, never a participant |

**If something here needs the engine to change, that is an engine issue in the engine
repository — not a paragraph here describing different behaviour.** Say so explicitly and
stop; do not work around it locally.

## What This Repository Owns

Maps, scenarios, building and product definitions, guest archetypes, balance numbers,
narrative voice, the visual client, the balance harness, and this game's own definition of
done.

## The Docs

Read in order. Numbering is positional.

| File | Holds |
|---|---|
| `README.md` | What this is, its relationship to the engine, the originality boundary |
| `01-vision.md` | Why the game exists, what it should feel like, what is out of scope |
| `02-game-design.md` | Gameplay: map, guests, buildings, queues, staff, economy, incidents, objectives |
| `03-client-specification.md` | The visual client — what it renders, and what it may never do |
| `04-mvp.md` | The smallest slice that proves the game, and its definition of done |
| `05-roadmap-risks-and-open-questions.md` | Phases, risks, what is undecided, and §5 — what the engine has already closed |
| `06-content-and-systems.md` | Field-level shapes: guest, building, staff, queue, construction. `kindState` internals |

**Numbering is positional.** Inserting a doc between existing ones means renumbering
everything after it and rewriting every cross-link. Prefer appending; use a letter suffix
(`03a`) if something genuinely must sit in the middle.

### Where Drift Will Happen

**`06-content-and-systems` ↔ the engine's kind contract.** `06` defines shapes that must obey
rules stated in the engine. Its §1 restates those rules deliberately, as a checklist — when
the engine's contract changes, §1 is the first thing to reconcile, and every shape below it
the second.

**Envelope duplication.** The engine names this as its own recurring defect and it has been
caught four times there. It arrives here as: adding a field to a shape in `06` that the
engine already owns. Before adding any field, ask whether the envelope, the campaign, or the
registry already holds it.

**Counts drifting from what they count.** "All eight operations", "the two kinds", "six of
the eight" — every one of those was wrong at some point in the engine repo, and each survived
multiple review passes. When a document states a number, check it against the list it counts,
not against memory.

**Balance numbers leaking into contracts.** Tick duration, utility weights, price elasticity
are *balance*, revisited every playtest. They belong in content, never in a sentence that
reads like a rule.

## Working Conventions

Findings and review items are presented **one at a time for sign-off**, not applied in bulk.
When a suggestion is declined, record it in the affected document (or
`05-roadmap-risks-and-open-questions.md` §4) as a known-and-retained issue rather than
dropping it silently.

**Verify, don't assert.** Check claims against the artefact — the engine's published spec,
the actual file, the real output — not against what you remember writing.

**Design before content, content before client.** The engine's own order is spec → tests →
plain client → UI, and it exists because building ahead of the contract is where drift
starts.

## Originality

This game is **inspired by the resort-management genre and reproduces none of it.** Identity,
art, writing, scenarios, building names, maps, balance and UI are original. No proprietary
names, assets, text or expression from any existing title may appear in this repository. This
is not a stylistic preference — treat it as a hard constraint on every asset and every line of
content.

Lessons learned the hard way live in [`agent.md`](agent.md).
