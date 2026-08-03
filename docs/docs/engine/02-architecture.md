---
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Architecture

**Document status:** Revision 1 — architecture settled; content model written (§4 →
[`03-story-graph-kind.md`](03-story-graph-kind.md))

**Project stage:** Design

> **Scope of this document**
>
> Every settled architectural decision, with the reasoning. This is the contract the
> content model and the API are built against.
>
> - Why the platform exists: [`01-vision.md`](01-vision.md)
> - **These decisions turned into buildable types:** [`04-core.md`](04-core.md)
>   (the Kind interface, the `GameState` envelope, the API, session store, projection,
>   validation, MCP schemas)
> - The flagship kind's content types: [`03-story-graph-kind.md`](03-story-graph-kind.md)
> - The engine specification this one was **derived from**:
>   `games/04-engine-specification.md` — provenance rather than authority; see
>   [`04-core.md`](04-core.md), *Reused, not re-derived*

This document reuses, by design, large parts of the Life in the Fast Lane engine
specification. Where it says "carried over from the simulation kind," the mechanism is
already specified there and is not re-derived here — it is core every kind shares.

---

## 1. The Three Layers

```text
          ┌─────────────────────────────────────────────┐
Clients   │ web · mobile · CLI · Discord · chat · MCP    │  presentation only
          └───────────────────────┬─────────────────────┘
                                  │  one API, one MCP surface
          ┌───────────────────────▼─────────────────────┐
Kinds     │ story-graph  │  simulation   │  world-graph   │  engine-owned logic
          │ (nodes,      │  (weekly tick,│  (space, ticks,│
          │  choices)    │   needs)      │   agents)      │
          └───────────────────────┬─────────────────────┘
                                  │
          ┌───────────────────────▼─────────────────────┐
Core      │ session state · seeded RNG · projection ·    │  game-agnostic core
          │ conditions · save/migration · registry · API │
          └─────────────────────────────────────────────┘
```

- **Clients** present state and submit choices. No game logic, ever.
- **Kinds** are game-logic modules written as reviewed engine code. Each defines how
  one category of game plays: what a "turn" is, what state it needs, how it advances.
- **The core** is everything neither client-specific nor kind-specific.

A **campaign** is a *kind identifier plus data conforming to that kind's schema.*
Publishing a new campaign of an existing kind requires no engine change and is what AI
authoring produces. A new *kind* is an engine feature, added deliberately.

> **Decision (N2, campaign-definition, kind-boundary).** The source specification's
> "engine = story engine, campaign = story nodes" could not host a simulation. Making
> the engine a *core* and a game a *kind + data* is what lets one platform run
> both a branching story and a weekly-tick life sim behind one API. The alternative —
> a single universal rules DSL expressive enough for both — means building a
> programming language, which is where narrative engines die. The other alternative —
> downloadable code kinds — puts arbitrary code inside a hosted deterministic engine,
> a security and reproducibility hazard. Engine-owned kinds draw the clean line:
> **kind = code (engine-owned), campaign = data (author-owned).**

---

## 1a. Is It a Kind? The Test

§1 says a new kind is "an engine feature, added deliberately" but does not say how to tell
one from a campaign. That question has now been asked three times — for `simulation`, for
`world-graph`, and implicitly every time a plugin mechanism is proposed — and
answered each time from memory. It is the **first** question any new game raises, so it is
written down here as a procedure.

**The test:**

> A kind exists only when its `advance` **cannot be expressed as validated data over an
> existing kind.**

Ask in order; stop at the first yes:

1. **Can an existing kind's `advance` run it with different campaign data?** → It is a
   **campaign**. This is the common case and the one §4a calls the volume play.
2. **Can it run with different data plus content types that kind already interprets?** →
   Still a **campaign**, possibly one that extends that kind's content schema.
3. **Does it need new code inside `advance`, such that putting that code behind a
   data-driven switch would amount to building a programming language?** → It is a **kind**.

### Three things that never qualify

| Not a reason | Why |
|---|---|
| **Richer or larger state** | `kindState` is `unknown` to the core ([`04-core.md`](04-core.md) §2). The core does not read it, so its size and shape cost the core nothing. If state richness qualified, any campaign with more variables would be a new kind |
| **A different turn *quantum*** | `end_week` and `advance_ticks n` differ by a parameter, not a model. Both are *mutate pending configuration, then resolve a block of simulated time* |
| **A different setting, theme, or locale** | That is precisely what a campaign and a culture pack are for (§4a) |

### What it costs, so the test is worth applying

A kind is a `KindId` widening, a full `Kind` implementation (04 §3), its own reason codes,
event namespace, validator, projection and `outcome` — and because kinds are engine-owned
(N2), **every new kind is an engine release.** A campaign is none of that.

### Worked applications

| Candidate | Verdict | By which step |
|---|---|---|
| Bulgaria adventure | Campaign | 1 — story-graph's `advance` runs it as data |
| Life in the Fast Lane | Kind (`simulation`) | 3 — a weekly resolution pipeline over needs, jobs and events is not expressible as story-graph data |
| Bulgaria culture pack | Campaign | 1 — same kind, replaced strings and campaigns (§4a) |
| Resort management | Kind (`world-graph`) | 3 — A\* pathfinding and guest utility scoring are code; a data-driven switch over them is the DSL N2 rejected ([`12-world-graph-kind.md`](12-world-graph-kind.md) §2) |
| Mountain hotel, theme park, festival ground | **Campaign** | 1 — `world-graph`'s `advance` runs all of them as data. This is the row that pays for the test |

> **Why the last row matters most.** The resort draft proposed a kind by listing spatial
> maps, hundreds of agents, queues and pathfinding — all *state*, which step 1's table
> disqualifies. It reached the right answer for a reason that would also have licensed a
> kind per resort theme. The test separates the two: one new kind, then every hotel, park
> and nightclub after it is data.

---

## 2. Session Model

The engine core is a **pure function**, identical in discipline to the simulation
kind's §11.3:

```text
advance(state, action) → new state
```

It never mutates caller state and holds no session itself. **Sessions live in a thin
store above the engine**, keyed by id: the store holds the serialized state blob, hands
it to the engine on each call, and persists what comes back.

```text
client ──{ sessionId, choice }──▶ session store ──{ state, action }──▶ engine (pure)
client ◀──── scene + visible state ──── session store ◀──── new state ─────┘
```

> **Decision (N3).** The source specification's "Create/Resume Session" language
> implies server-held sessions; the simulation kind's engine is a pure function. Both
> are satisfied by keeping the **core pure** and making sessions a **store concern**.
> The client never holds authoritative state (it holds a `sessionId`), which preserves
> "the engine owns the truth." A stateless variant — the client carries the state blob
> and passes it back each call — was rejected: it hands authoritative state to the
> client and makes resume-on-another-device and AI clients awkward. A stateful engine
> object was rejected for the reasons already litigated in the simulation kind's §11.3
> (loses replay, comparison, testability).

**Consequence for the API.** Every operation takes a `sessionId`. The engine's purity
means a session is fully reconstructable from `{ campaignId, campaignVersion, seed,
action log }` — the determinism harness (§8) depends on this.

---

## 3. State and Variables

### 3.1 Two State Shapes, by Kind

- The **simulation kind** carries structured, fully-typed state (`ActorState`,
  `WorldState`, …) — already specified.
- The **story-graph kind** carries a **typed variable schema declared by the
  campaign**, plus the shared subsystems in §6.

### 3.2 Story-Graph Variables Are Fully Typed

Every variable a story-graph campaign uses is declared up front with a name, a type,
and an initial value. A consequence that writes an undeclared or mistyped variable is
a **load-time error**. Reading an undeclared variable is a load-time error.

> **Decision (N6).** A loose variable bag (the Twine/Ink default) reintroduces exactly
> the bug the simulation kind removed in its §10.4: a typo creates a silent ghost
> variable, and nothing can check that a consequence references a real one. A
> middle option — declared-but-untyped variables, catching typos without type
> checking — was on the table and rejected in favour of **full typing**. The value is
> load-time rejection of an entire class of content bug, at the cost of authors
> declaring variables before use.

```typescript
// illustrative — full types land in 03-story-graph-kind.md
interface VariableSchema {
  [name: string]: {
    type: "bool" | "int" | "enum";   // `string` was dropped — 03 §2
    initial: boolean | number | string;
    values?: string[];        // for enum
    visible?: boolean;        // surfaced as a player stat — see §6.2
  };
}
```

Consequences mutate variables through **typed operations** (`set`, `increment`,
`decrement` on ints; `set` on bool/enum), never through arbitrary string paths. This
is the audit-record discipline from the simulation kind's §10.4, carried over.

---

## 4. The Story-Graph Kind: One Content Type

The story-graph kind has a **single content type — the node.** A node is a scene:
display text plus a set of choices. A choice may be gated by requirements and carries
consequences, one of which is the transition to the next node.

> **Decision (N7).** The source specification listed *story nodes*, *events*, and
> *random events* as three separate kinds of content and never distinguished them.
> They collapse into one:
> - A **random event** is a node whose transition is a **seeded random pick** from a
>   weighted set — the only place randomness enters the story-graph kind.
> - An **event** not reached by a player choice is a node entered by a consequence's
>   `goto`.
>
> Condition-triggered *interrupt* events (the simulation kind's model, where something
> fires regardless of the current node) were deliberately **not** included in v1. They
> drag in the deferred-response / pending-interrupt machinery the simulation kind
> needed, which is heavy for a flagship. The door is left open to add them as a later
> kind feature if a campaign proves it needs them.

The full node / choice / requirement / consequence / ending types are specified in
[`03-story-graph-kind.md`](03-story-graph-kind.md). They reuse the simulation kind's
`Condition` tree (§13.1 there) for requirements verbatim.

---

## 4a. Content Packs and Culture Packs

A campaign is data within a kind (§1). Some of that data is the game's *setting* — its
jobs, places, events, characters, prices, and the language and voice it speaks in. A
**content pack** is a bundle of that setting data. A **culture pack** is a content pack
that reskins and relocalizes a campaign wholesale: same mechanics, different world.

This is the customization the project set out to support — *expand or reskin the
environment without touching the engine* — and the machinery already exists in the
simulation kind:

- **Content registry + pack manifest** (`games/04-engine-specification.md` §4.1–4.2) — a game loads a resolved set of content packs; the engine never reads files or recompiles.
- **Localization as string tables** (`games/04-engine-specification.md` §2.4) — every player-facing string is a key; a language is a string-table swap.
- **Swappable narrator voice** (`games/02-narrative-voice.md`) — the voice lives entirely in the string table, so a culture pack changes tone by changing content, not code.

So **Jones-in-Bulgaria is a simulation-kind culture pack**: Life in the Fast Lane's
mechanics unchanged, with Bulgarian jobs, bureaucratic events, inheritance disputes,
prices, and a Bulgarian-inflected narrator swapped in. No engine change, no new kind —
exactly the "culture pack for the game" the project envisioned.

> **Why this matters to the platform.** Culture packs are the volume play: one kind,
> many settings. The simulation kind can host Jones-in-Bulgaria, Jones-in-Corporate,
> Jones-in-Startup — each a content pack, none an engine change. This is also what a
> hosted service ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)) would sell:
> creators author packs, the engine runs them.
>
> A culture pack is distinct from a **new kind** (engine code, §1) and from a
> **story-graph campaign** (different kind, different game). The two games in
> `games/` show the split: the Bulgaria culture pack
> belongs to Life in the Fast Lane (simulation), the
> Bulgaria adventure is a separate story-graph game.
> They share only the source scenes (`bulgaria.md`).

Content and culture packs are validated identically to any other content (§9): the
engine does not care whether a pack was hand-authored, AI-authored, or community-
submitted — it validates the data against the kind's schema either way.

---

## 5. Determinism and Randomness

Each kind **declares its own determinism contract**; the core provides the
machinery.

- The **story-graph kind** is trivially deterministic — a choice leads to a fixed node
  — *except* at random-transition nodes, which draw from the core's **seeded
  PRNG** (PCG32 with named substreams, carried over from the simulation kind's §3).
- The **simulation kind** uses the full seeded apparatus already specified.

> **Decision (N5).** The source specification listed "deterministic engine" and
> "random events" together without reconciling them. The reconciliation: randomness is
> *core-provided and seeded*, and *each kind decides how much of it to use.* A
> story graph with no random-transition nodes needs no RNG at all and replays
> identically from its choice log; one with random transitions replays identically
> from seed + choice log. Either way, determinism is a testable property, not a claim.

`Math.random` and non-bit-stable transcendental math are banned in all resolution
paths, per the simulation kind's §2.1. This is core law, not per-kind.

---

## 6. Shared Subsystems in the Story-Graph Kind

The source specification listed achievements, statistics, relationships and time in
its engine responsibilities, save format, or API, but modeled none of them. All four
are **in scope for the story-graph kind v1** (N12), specified as follows.

### 6.1 Achievements

Ported from the simulation kind's achievement model. A campaign declares achievements
as **conditions over its variables**; the core evaluates them and unlocks each
exactly once. The Bulgarian ending "It Builds Character" is one such achievement.

Whether achievements are game-scoped or persist across a player profile follows the
simulation kind's resolution (profile-scoped, written outside authoritative game
state so they never affect determinism).

### 6.2 Player Statistics

**Not a separate system.** A statistic is a campaign variable marked `visible: true`
in the schema (§3.2). The v1 UI's "Player Stats" panel renders exactly those. This is
the cheapest possible way to honour the requirement — one flag on the variable
schema, no new machinery.

### 6.3 Relationships

A story-graph campaign that wants relationships declares them as **typed variables**
(e.g. an int per NPC), the same as any other state. The engine does not impose the
simulation kind's four-dimensional relationship model on story-graph campaigns —
that model is available in the simulation kind for games that need it, but for a
branching narrative a single tracked number per character is usually enough, and the
typed-variable mechanism already covers it. No dedicated relationship type is added to
the story-graph kind.

> **⚑ Judgement call.** N12 put relationships in scope, but the source content uses
> them only as flavour, never mechanically. Rather than port the simulation kind's
> heavy `RelationshipState`, relationships are expressed through the variable schema
> that already exists. If a story-graph campaign later needs affinity/trust/respect
> as distinct axes, that is a handful of declared int variables, not an engine change.

### 6.4 Time

Story-graph time is a **turn counter**, not a clock. The kind increments a
built-in `turn` value on each node transition, readable in requirements and
consequences like any variable. (It is kind-owned rather than core-owned because a
"turn" means something different per kind — a node transition here, a week in the
simulation kind — and because it lives inside the opaque `kindState`;
[`03-story-graph-kind.md`](03-story-graph-kind.md) §8.1.) The clock references in the Bulgarian content
("08:03", "opened at 08:00") are **scene text, not mechanics** — a campaign that wants
a mechanical clock declares an int variable and advances it in consequences.

> **⚑ Judgement call.** N12 put time in scope. The lightest honest model is a monotonic
> turn counter the core maintains; anything richer (an in-fiction clock, a
> calendar) is campaign-authored on top of a variable. The simulation kind's weekly
> calendar is a *kind* feature and does not belong in the story-graph core.

---

## 7. Projection and Hidden State

Carried over wholesale from the simulation kind's §6. Clients receive a **projection**
of state, not the state itself — variables marked hidden (event cooldowns, unrevealed
flags, achievement progress, the seed) never appear in what a client or AI agent can
read. The visible-stat marker (§6.2) is the story-graph kind's use of this boundary:
`visible: true` variables are in the projection, everything else is not.

> **Decision (N11).** The source specification stored "flags" and "variables" but never
> said which are visible. Without an enforced projection, hidden narrative state (a
> secret the player hasn't uncovered, a flag tracking a future twist) leaks to any
> client that renders what it's given. The simulation kind already solved this with a
> typed projection; the story-graph kind uses the same machinery.

---

## 8. Save, Versioning, and Migration

Carried over from the simulation kind's §16, with one story-graph-specific hazard made
explicit.

A save contains everything needed to reproduce the session: campaign id, **campaign
version**, seed, variable state, the shared subsystems, the visible/hidden split, and
the action log.

> **Decision (N9).** The source specification stored "campaign version" in the save but
> never noticed the problem it implies: **a republished campaign can orphan existing
> saves.** If a node a save is sitting on is deleted or renamed in a new campaign
> version, the save points at nothing. This is the simulation kind's migration problem
> in narrative clothing, and it gets the same answer: a save records the campaign
> version it was made under; loading it against a *different* version runs migration,
> which must map old node ids forward or fail loudly rather than silently stranding the
> player. A migrated save is marked not-replay-compatible, exactly as in the simulation
> kind's §16.2.

**Determinism harness.** A story-graph campaign plus a seed plus a choice log
reproduces a session byte-for-byte — the golden-master + property-test harness from the
simulation kind's §18.4 applies unchanged. This is the concrete meaning of
"deterministic" for this kind.

---

## 9. AI Authoring Boundary

The source specification's AI-authoring section said "the engine always validates the
final result" without saying what that means. The kind-boundary decision makes it
precise:

**AI authors campaigns (data), never kinds (code).** An AI expands scenes, generates
choices, drafts NPCs and dialogue, rewrites tone, translates — all producing content
that conforms to a kind's schema. The engine then **validates that content against the
schema** exactly as it validates hand-authored content: tiered validation, carried
over from the simulation kind's §4.3.

- **Tier 1 (load-time, hard fail):** every node id referenced by a choice or `goto`
  exists; every variable read or written is declared; every requirement and consequence
  path resolves; no duplicate ids; string/localization keys present.
- **Tier 2 (load-time, warning):** unreachable nodes ("dead branches" — the source
  specification's "detect dead branches" is exactly this), cycles where a cycle is
  unexpected.
- **Tier 3 (simulation-time):** unwinnable campaigns, choices no reachable state can
  satisfy — found by running the campaign, not by reading it.

> **Decision (N10).** "The engine validates" is not a safety property until you say
> what validation *is*. It is schema conformance plus reachability, tiered by what is
> statically decidable — the same discipline the simulation kind arrived at. AI never
> routes around it, because AI output is data and all data is validated identically,
> whatever produced it.

---

## 10. The API and MCP Surface

One API serves every client and every kind. The source specification's operation list,
made concrete and session-keyed (§2):

| Operation | Notes |
|---|---|
| `listCampaigns` | Available campaigns, each tagged with its kind |
| `createSession` | `{ campaignId, seed? }` → `sessionId` |
| `resumeSession` | `{ sessionId }` → current scene + visible state |
| `getScene` | Current node's text and available (requirement-filtered) choices |
| `getView` | The **projection** (§7), never raw state |
| `submitAction` | `{ sessionId, actionId }` → new scene + visible state; for this kind an `actionId` *is* a choice id |
| `saveGame` / `loadGame` | Serialize / restore, version-stamped (§8) |

The names are the `SessionStore` surface as typed in [`04-core.md`](04-core.md) §7 —
kind-agnostic on purpose, since the same operations serve the simulation kind.

The **MCP server exposes these same operations as tools** (`start_game`,
`continue_game`, `choose`, `get_scene`, `get_state`, `save_game`, `load_game`,
`list_campaigns`). There is no AI-specific game path: an MCP agent and a browser both
call `submitAction`, both receive a projection, both play the identical game.

> **Decision.** The source specification already had this right — MCP as a first-class
> client, no special AI version. Making it *literally the same operations* rather than
> a parallel tool set is what guarantees it stays true. The kind is invisible at this
> surface: a client calls `getScene` whether the underlying campaign is a story graph
> or a simulation; each kind renders its current situation into the same scene shape.

---

## 11. What Is Settled, What Is Next

**Settled (this document):** the three-layer model; kinds as engine code; campaigns as
data; the pure-core / server-session split; typed variables; the single-node-type
story-graph model; determinism and seeded RNG; the four shared subsystems; projection;
save/versioning/migration; the AI-authoring boundary; the unified API/MCP surface.

**Delivered — [`03-story-graph-kind.md`](03-story-graph-kind.md)** (the concrete content
types: Node, Choice, Requirement reusing the simulation kind's `Condition` tree,
Consequence, Ending, VariableSchema, AchievementDefinition, and the seeded
random-transition node) **and [`04-core.md`](04-core.md)** (those decisions as platform
types). With both, the Bulgaria make-your-own-adventure can be authored as real,
validated content rather than mood text — a minimal slice of it is the MVP
([`MVP.md`](MVP.md)). The separate Bulgaria culture pack, which belongs to
Life in the Fast Lane, needs no new deliverable — it
is a content pack over the existing simulation kind (§4a).

**Next — build it.** The ordered task list is [`TODO.md`](TODO.md); what is still
unsettled is [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).

**Deferred — [`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform):** hosting,
accounts, billing, cloud sync, analytics, multiplayer, white-label.

---

## 12. Relationship to Life in the Fast Lane

Life in the Fast Lane, specified in full under `games/`, is
**the flagship campaign of the `simulation` kind.** Its engine specification (`games/
04-engine-specification.md`) is, in this platform's terms, *the simulation kind plus
its core contributions.* Much of what this document calls "the core" was
first designed there: the projection boundary, the condition DSL, seeded RNG
substreams, tiered content validation, the determinism harness, reason codes,
localization, save/migration.

> **Project split.** This repo (**SubZeroDev.GameEngine**) is the **Game Engine** —
> both its **source** (`src/engine/`, described at
> [Engine Package](/docs/guide/engine-package)) and its **specs** (a Docusaurus site under
> `docs/docs/engine/`). The **games** (Life in the Fast Lane, the Bulgaria adventure) live
> in [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife), and
> Sun Trap — the `world-graph` game — in
> [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap); the
> **hosting / NEaaS** layer in
> [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform). References
> to `games/…` throughout these docs point to SubZeroDev.GameOfLife specifically.
