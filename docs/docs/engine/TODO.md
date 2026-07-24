# Narrative Engine — TODO

**Status:** Living task list. Ordered. The MVP boundary is marked; everything below it
is post-MVP.

> Definition of done for the MVP is in [`MVP.md`](MVP.md). Each game carries its own
> done-criteria in `games/`. This list is *what to do*, in order.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 0 — Specify the story-graph kind

Nothing can be built until the flagship kind's content types exist.

- [x] Write [`03-story-graph-kind.md`](03-story-graph-kind.md): `Node`, `Choice`,
      `Requirement` (reuses the `Condition` tree verbatim), `Consequence`, `Ending`,
      `VariableSchema`, `AchievementDefinition`, seeded random-transition node, the turn/
      settle semantics, projection, and a worked Bureaucracy-arc example. **Done.**
- [x] **Decide `executeAction`'s fate — removed.** No client calls it; the plan flow
      (`addAction → validateActionPlan → executeActionPlan → endWeek`) covers execution
      (`games/05-text-client.md` §6). A method with no
      caller is a hypothesis — re-add with a caller if a real need appears. **Done.**
- [x] **Finalize the MVP contracts** (`03`, `04-core`): campaign/content identity
      split reconciled (04 §10.1), `visited` semantics + start-of-game RNG stream pinned
      (03 §8.2, 04 §4/§8), `AdvanceResult` shape tightened. MVP Definition of Done agreed
      ([`MVP.md`](MVP.md) §5). **Done.**

## Phase 1 — Core (shared by every kind)

Spec: [`04-core.md`](04-core.md) — the Kind interface, `GameState` envelope,
API, session store, projection, validation, reason codes, MCP schemas, determinism
harness.

> **Implementation.** The reference implementation lives in `src/engine/` in **this repo**
> — the engine code and these specs sit together. The `[x]` Phase-1 items below are built
> there.

- [x] **Write the core spec** ([`04-core.md`](04-core.md)) — the seam and
      the platform types, so Phase 1+ builds against contracts, not decisions. Forced the
      `03` state reconciliation (envelope vs kind-state). **Done.**

- [x] Project scaffold: `src/engine/` package, TypeScript (strict), vitest, eslint with the
      determinism guard (bans `Math.random`, `Math.pow/exp/log/sin/cos/tan`, `Date.now`).
- [x] Version control: this repo (engine **source + specs**). Companions: the game
      [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) and
      the hosting layer [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform).
      All private.
- [x] Seeded PRNG (PCG32) + named substreams; serializable RNG state.
      `src/core/rng/pcg32.ts` — **verified bit-identical to the reference vectors.**
- [x] Canonical serialization (sorted keys, rejects non-finite) + `serialize` /
      `deserialize`. `src/core/serialize/canonical.ts`.
- [ ] Pure engine core contract: `advance(state, action) → state`, immutable.
- [ ] Session store: create / resume / persist a state blob by id.
- [ ] Projection: `getState` returns the visible view, never raw state.
- [ ] Content registry + loader (in-memory, no engine I/O).
- [ ] Tiered content validation: Tier 1 (hard fail) + Tier 2 (warning).
- [ ] Reason-code enum + localization string tables.
- [ ] Determinism harness: golden-file fixture runner + property test (N seeds, twice).
- [ ] Run `npm install && npm test` in CI (logic verified in Node during dev; not yet
      run through the vitest toolchain).

## Phase 2 — The story-graph kind

- [ ] Node / choice resolution against the Phase-0 types.
- [ ] Typed variable schema: declare, validate, typed get/set consequences.
- [ ] Requirement evaluation via the `Condition` tree.
- [ ] Seeded random-transition node.
- [ ] Endings + achievement evaluation (unlock once, write to profile).

## Phase 3 — Content: the Bureaucracy arc

- [ ] Author 6–8 Bulgaria bureaucracy nodes (`games/bulgaria.md`): Municipality,
      Government Office, Room 14/6.
- [ ] Variable schema for the arc; requirement-gated retries; one ending; the
      "It Builds Character" achievement.
- [ ] A deliberately broken copy, to prove Tier 1/2 validation rejects it.

## Phase 4 — Clients

- [ ] Text client: the plain proving instrument; drives every public engine method
      (API coverage checklist).
- [ ] MCP server: the same operations as tools; verify an agent completes the arc.

## Phase 5 — Prove it

- [ ] Every box in [`MVP.md`](MVP.md) §5 checked.
- [ ] **MVP DONE.**

---

## Post-MVP — depth

### Depth: Life in the Fast Lane (the `simulation` kind)

- [ ] Build the simulation kind per `games/04-engine-specification.md` (Phases 1–4 there).
- [ ] "Stable Life" scenario playable to a win and a loss.
- [ ] Its Definition of Done: `games/life-in-the-fast-lane.md`.

### Depth: finish the Bulgaria adventure

- [ ] The remaining four arcs (Inheritance, Enterprise, Driving, Return).
- [ ] Its full Definition of Done: `games/bulgaria-adventure.md`.

### Breadth: the first culture pack

- [ ] Bulgaria culture pack over the simulation kind — Jones-in-Bulgaria content,
      no engine change ([`02-architecture.md`](02-architecture.md) §4a).

### Breadth: the platform

- [ ] More clients (web, Discord).
- [ ] AI-assisted authoring (content only; engine validates).
- [ ] The hosted service — only once all of the above works
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)).
- [ ] Content-pack merge / override / dependency rules — before mods, not before MVP
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform) → Known deferred gaps).

### Content tooling — a first-class workstream, not an afterthought

> Peer review's sharpest point: as campaigns grow, the runtime stabilizes while
> **tooling becomes the larger effort.** Named here so it is planned, not discovered.

- [ ] Content validator / linter (the Tier 1/2 checks, as an author-facing tool).
- [ ] Graph visualization + a visual node editor.
- [ ] Content diff and balancing tools.
- [ ] Localization tooling (string-table extraction, coverage, translation).
- [ ] Authoring assistants (AI-drafted content → the same validation, §9).

---

## Known open items carried in

> Full register of unknowns, gaps, and deferred decisions:
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).


- [ ] `wisdom` attribute has no consumer in the simulation kind — needs one to earn its
      place (`games/04-engine-specification.md` §8.4).
- [ ] Provisional numbers across the simulation kind (drift rates, scenario economics,
      `demandBand` thresholds, housing-quality formula, travel costs) need a balancing
      pass once the sim harness runs.
- [ ] Consolidating the two doc trees (`docs/` under the engine) — a deliberate deferred
      restructure ([`02-architecture.md`](02-architecture.md) §12).
