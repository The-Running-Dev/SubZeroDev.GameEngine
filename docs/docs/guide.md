---
sidebar_position: 1
sidebar_label: Developer Guide
---

<!-- design-digest: e67a4a44106978204df6f37df1929f700c1b274f94608335988751679228ab5e -->

> Generated from `design/` by `/make-human-docs`. Do not edit by hand — edit the
> design docs and regenerate. `/reconcile` reports when this has gone stale.

The five agent-kit documents under `design/` are the canonical source. The detailed pages under
`docs/docs/engine/` are generated from marked blocks in those files and must not be edited
directly.

# Developer Guide

SubZeroDev.GameEngine is a deterministic narrative-game engine written in TypeScript. Node.js
is the currently proven runtime; W61 adds the first browser delivery without forking the engine.
The engine separates game-independent execution from game-category rules and campaign data, then
exposes every game through one session API. Text, MCP, and browser clients are siblings over that
API; none owns rules or authoritative state.

Use this guide when integrating the package, implementing a client or campaign, or extending an
engine-owned kind. The exact public types, signatures, error tables, persisted schemas, and
assertable invariants are in the
[generated contract](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/design/20-contract.md).

## What exists today

- The core engine, content builder, validation, session/profile stores, save migration,
  observability, deterministic harness, and cross-version replay are implemented.
- `story-graph` is complete through content, projection, text client, and MCP. The Bulgaria
  Bureaucracy arc and four additional arcs provide real fixtures.
- `simulation` has state, content definitions, weekly resolution, validation, a registered kind,
  a full player projection (`SimulationView`), and Stable Life winning/losing replay fixtures.
  Text-client and MCP parity now match `story-graph`'s row of the API coverage checklist, one
  for one.
- `world-graph` is a real, registered kind: `worldGraphKind` is exported from the package root,
  and its twenty-system tick pipeline — build, utility, routing, queues, staff, finance,
  incidents, and terminal precedence — is registered, ordered, and tested. Five of the twenty
  systems are known-and-retained stubs or partial implementations; see
  `design/90-decisions.md`, *Known-and-retained implementation gaps: `world-graph` tick
  systems*. It is registered and usable the same way `story-graph` and `simulation` are, within
  that scope.
- A public `/play/` browser demo runs the Bureaucracy MVP locally in the browser through the
  same session-store boundary as the text and MCP clients. Additional campaigns and durable
  browser saves are deliberately later work.
- Content packs, the `ExperimentSource` port, and privacy-safe session capture are specified but
  not implemented. All three are deferred: content packs and experiment gating to post-MVP
  content-pack work, capture to the hosting layer that gates it.

## The mental model

```mermaid
flowchart TD
  Client["Text, MCP, web, or another client"] --> Store["Session-store API"]
  Store --> Engine["Pure core engine"]
  Engine --> Kind["Engine-owned kind"]
  Kind --> Campaign["Validated campaign data"]
  Engine --> State["GameState envelope"]
  Store --> Persistence["Session and profile adapters"]
  Engine -. discardable .-> Events["Operational events"]
```

The split is strict:

- The **core** owns the envelope, seeded streams, canonical serialization, session-independent
  execution, projection orchestration, saves, validation vocabulary, and shared scene/action
  shapes.
- A **kind** owns one category's turn model, kind state, action meanings, scene, projection,
  validation, event names, reason codes, migration, and terminal identity.
- A **campaign** is immutable validated data for one kind.
- The **session store** owns persisted state and command ordering. The engine itself retains no
  session.
- A **client** presents projected DTOs and submits declared inputs. If it needs to calculate an
  outcome, inspect raw state, or emulate a missing store operation, the boundary has been broken.

## Install and consume the package

The published package is `@the-running-dev/game-engine`. Its root export is intentionally
explicit: consumers receive the supported engine, builder, session, observability, localization,
and kind surfaces without reaching into internal paths.

Create one composition root for the process:

1. Build and validate a content registry.
2. Register the implemented kinds required by those campaigns.
3. Create the pure engine with the registry, kinds, and optional deterministic id/event ports.
4. Create the session service with the engine and concrete session/profile persistence.
5. Give clients only the session service.

The engine package performs no filesystem or network I/O while resolving play. Parsing JSON or
YAML, reading campaign files, database access, clocks, hosting, and process lifetime belong to
outer adapters.

## Build content before creating the engine

Authors may write player-facing text inline as keyed authored text. The pure content builder:

1. validates the kind's source schema;
2. lifts text into the shared string table;
3. rejects one key paired with conflicting text;
4. converts the source into runtime content that carries localization keys;
5. runs kind validation;
6. merges protected core, kind, and campaign strings;
7. freezes campaigns and strings.

Do not hand the engine partially validated or mutable content. Registry construction is the
failure boundary: a Tier 1 error means there is no registry and therefore no playable engine.

### Validation tiers

- **Tier 1, hard failure:** duplicate or invalid ids, dangling references, undeclared variables,
  mistyped effects, missing strings, invalid weights, forbidden namespace writes, and other
  static contract violations.
- **Tier 2, warning:** unreachable content, suspicious cycles, non-interactive story campaigns,
  and similar structures that may be deliberate.
- **Tier 3, simulation/replay:** unwinnable states, never-satisfiable actions, and behavior that
  cannot be decided by reading definitions alone.

AI-authored content takes this same path. AI may draft campaign data; it does not author or load
executable kinds.

## Use the session API, not raw engine state

The session service is the application boundary. It provides campaign listing, creation,
resume, scene/view queries, localization strings, action submission, save, and load. The exact
operation signatures are in the [contract](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/design/20-contract.md#public-signatures).

Starting a session takes a campaign id, an optional explicit seed, an optional audience, and an
optional profile id — there is no `locale` parameter. When no seed is supplied, the session
boundary generates and persists one. The returned handle contains a `sessionId` and scene, never
the envelope.

Submitting an action follows one atomic path:

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Session service
  participant E as Pure engine
  participant K as Kind
  participant P as Persistence

  C->>S: submit(sessionId, actionId, declared params)
  S->>P: load complete serialized state
  S->>E: submitAction(state, action)
  E->>K: advance(kindState, action, scoped context)
  K-->>E: new kind state or structured rejection
  alt accepted
    E-->>S: new envelope + changes/messages
    S->>P: atomically persist envelope
    S-->>C: projected scene/result
  else rejected
    E-->>S: unchanged state + error
    S-->>C: error; no log or state write
  end
```

Different sessions may resolve concurrently. Commands for the same `sessionId` must be
serialized by the service/store so the second command reads the first command's committed state.
A query returns a projection of one complete stored revision, never a half-written result.

A stored session record carries more than the serialized envelope: an `audience`, an
`attemptCounter` that only `submitAction` increments, an optional `profileId`, a
`replayCompatible` flag that turns false forever once a migrated load touches the lineage, and
wall-clock `createdAt`/`updatedAt` timestamps set via the `Clock` port — all of it outside the
replayable `GameState` and never read by `advance`.

### Previewing an action

Clients may call `previewAction(sessionId, actionId, params?)` before submitting an action. It
uses the same authoritative resolution path as submission, but projects the prospective result
and discards its state: it never writes a session or profile, consumes a command attempt, adds to
the action log, or emits an action lifecycle event. Same-session previews share the command
queue, so they cannot present a result for a revision that a neighbouring submission has already
replaced. The text client and MCP `preview_action` tool expose the same operation; neither
duplicates placement or other kind rules.

### Profiles are optional mirrors

Pass a `profileId` when achievements should survive a session. After a successful action, the
session service idempotently mirrors new achievements to the profile store. Resolution never
reads the profile.

- No profile id means no profile read or write.
- A missing or corrupt profile behaves as empty and produces a warning.
- A failed profile write warns but does not roll back the completed game action.
- Do not put profile identity or profile contents into `GameState`.

Arbitrary kind-owned profile data is not currently supported. In particular, profile-scoped
simulation event chains remain outside the executable contract.

## Projection is mandatory

Clients receive a generic `Scene` and `PlayerView` plus a kind-projected view. They never receive:

- the seed or action log;
- raw `kindState`;
- non-visible story variables or visit counts;
- hidden choices;
- unrevealed simulation/world opportunities or entity internals;
- achievement conditions or other future-state hints.

Do not add a trusted-client escape hatch. The projection is what makes hidden information safe
across text, MCP, web, and AI audiences. If a new client needs more information, decide whether it
is genuinely player-visible and extend the relevant kind projection deliberately.

Client code switches on stable reason codes and renders localization keys. It never parses an
English error sentence. A missing localization key is a registry-build defect, not a client
fallback opportunity.

### Building the public browser demo

W61 adds one static `/play/` route to the existing React site. Keep its composition root separate
from its client: the root may assemble the engine, story-graph kind, validated Bureaucracy
campaign, and session store. Before start, it resolves the configured campaign title and passes a
frozen startup configuration with that plain title and campaign id to the page. The browser
adapter and React components use `SessionStore` as their only game-facing dependency; they do not
read a registry, and `Start` remains the action that creates the session. The package root must
export the committed campaign builder; do not deep-import a campaign or let a component construct
a registry.

The same supported engine entry point must bundle for Node.js and the browser. Remove Node-only
runtime filesystem/crypto imports and unguarded Node.js globals from that graph rather than
creating a reduced browser implementation. Save checksums remain SHA-256 over the same canonical
bytes; only the already-asynchronous `saveGame`/`loadGame` boundary may await standards-based
crypto. Gate this with a production browser bundle, not DOM-aware typechecking alone.

The first page exposes scenes, shown choices, disabled reasons, the projected state,
achievements, optional action preview, and same-page save/load checkpoints. Checkpoints are
in-memory: refresh intentionally starts a new demo. Do not make React persist raw state or save
envelopes to browser storage; durable saves require a host-owned persistence seam that does not
exist yet.

The route must be a real `play/index.html` in the static artifact, not an SPA fallback. Extend the
combined-site verification so `/`, `/roadmap/`, `/play/`, and `/docs/` survive one deployment and
the protected documentation subtree remains unchanged. The complete product, accessibility,
failure, parity, and non-goal boundary is in
[`13-playable-web-demo.md`](engine/13-playable-web-demo.md).

### Styling the game interface

W63 redesigns the existing story shelf and story-graph play surface as an original absurd
adventure cabinet: a dossier-like campaign shelf, dominant scene stage, tactile action deck,
and projected status console. The reference games supply qualities—graphic-adventure staging,
life-board density, and 1990s tactility—not assets or a screen to copy. Do not copy or trace
their art, layouts, characters, logos, fonts, sounds, or trade dress.

Keep this work above the client boundary. Components render the `BrowserClient` DTOs they
already receive; visual metadata such as campaign accent, backdrop, emblem, and eyebrow is a
closed site-owned mapping with a complete default. It cannot affect action order, availability,
resolution, persistence, or serialization. The scene renders authored prose unchanged, the
action deck retains full labels and engine order, and the status console reads only
`PlayerView`. Never surface raw node ids, localization keys, seed, action log, hidden variables,
or opaque kind state.

Treat absurdity as a budget: one hero joke and at most two minor jokes per visible state. A joke
may decorate a shelf, status prop, save flourish, or ending placard; it may not replace campaign
text, content notices, disabled reasons, error text, control labels, or accessible names. Every
gauge prints its value, campaigns without visible stats get an honest empty state, and missing
decorative art leaves a complete CSS interface.

The responsive reading order is marquee, scene, actions, then projected status. At 320 px the
trim simplifies and controls become full width; at desktop widths the status console may sit
beside the scene. Keep native controls, visible focus, forced-colours support, 200% zoom, and
WCAG AA contrast in every campaign theme. Reduced motion removes transforms, parallax, wipes,
flicker, and staged delay completely; authoritative state never waits for animation. Original
raster art is PNG/JPG, local to the static build, and stays inside the W63 asset budgets. The
complete visual grammar, proof matrix, and non-goals are in
[`14-game-interface.md`](engine/14-game-interface.md).

## Determinism rules that will bite you

The replay input is campaign identity, seed, and successful submitted actions. Preserve that
model by following these rules in every resolution path:

- Use only the scoped RNG supplied by the kind context or a stream derived from it.
- Never call ambient randomness, the wall clock, filesystem, network, or banned non-bit-stable
  mathematics.
- Do not persist an RNG cursor. Derive a fresh handle from seed and stable stream id.
- Do not let a client supply time or money costs that the engine can derive.
- Sort dictionary keys before any state-affecting traversal.
- Define explicit tie-breaks for every unordered candidate set.
- Keep money in integer cents and simulation rates in integer basis points.
- Keep wall-clock metadata outside the game envelope.
- Add new action parameters to the declared schema before allowing them to affect behavior.

The stream key matters as much as the generator. Per-action draws use the successful action
sequence. World-level autonomous draws use simulated tick and system. Agent draws use the
agent's own stored draw counter, not the number of client submissions that happened first.

The same-build harness proves byte identity, property-seed reproducibility, and emitter
independence: every golden fixture replays under `nullEmitter` and under `recordingEmitter` with
byte-identical `serialize()` output. It also proves event-stream reproducibility directly — the
same fixture, run twice under `recordingEmitter`, is asserted to yield the identical event
sequence (names, order, data), with `gameId` normalized out because a replay is a new game and
legitimately carries a new one. None of this by itself detects a deterministic behavior change;
that is the cross-version replay oracle's job.

## Story-graph campaigns

Use `story-graph` for authored branching narrative whose unit of play is one choice.

A campaign declares:

- bool, bounded int, and enum variables;
- choice, automatic, random, and ending nodes;
- choices with optional visibility and availability conditions;
- typed consequences over declared variables;
- conditional achievements;
- localization keys and authored text.

There are two different gates:

- `showWhen` removes a choice completely. Submitting its id returns the same result as submitting
  an unknown id, so clients cannot probe secret paths.
- `requirements` leaves the choice visible but unavailable and supplies a player-facing reason.

After every transition, the kind enters the destination, increments its visit count and turn,
applies achievement checks, and settles through automatic/random nodes until it reaches another
choice or ending. Random settlement uses the scoped seeded stream. A bounded settle guard turns a
pass-through cycle into a defect rather than an infinite loop.

Only variables declared visible appear in the player view or text interpolation. Relationships,
money, and campaign-specific clocks are ordinary typed variables; the kind does not impose the
simulation model on a branching story.

## Simulation campaigns

Use `simulation` for a weekly life simulation whose unit of play is a complete week. The player
builds an immutable plan with logged `plan.add`, `plan.remove`, and `plan.clear` actions, then
submits `end_week` to resolve it.

The week pipeline is contract behavior. Start-of-week time handling is split around effect expiry;
end-of-week systems run once in declared order. Income and expenses run before housing so current
wages can fund rent, while finance reconciliation runs after housing so arrears and eviction see
the rent decision from that week.

Important constraints:

- Plan time and money totals derive from planned actions; they are not serialized fields.
- Action costs come from content/engine rules, never caller input.
- The `custom` action is an adapter translation placeholder and has no resolver. Translate it to
  a concrete supported action before submission.
- Opportunities explicitly distinguish acceptance, decline, expiry, and revocation.
- Scheduled events fire once committed; cancellation requires an explicit shared chain id.
- Hidden exact economy values project as bands, not raw optimization inputs.

The player view (`SimulationView`) carries the calendar, identity, finances, needs, attributes,
education, career, housing, inventory, and relationships — with `luck` and relationship
`resentment` stripped, `flags`/`counters` withheld entirely, status effects reduced to their
visible fields, opportunities limited to what is currently offered and unexpired, and sector
demand exposed only as a band (`cold`/`steady`/`hot`), never the raw value that job-availability
rolls read. It also carries the pending plan itself, plus the domain a client needs to build one:
every currently-offerable action type (for `plan.add`) and the plan's own action list (so a client
can compute a valid `plan.remove` index). A separate, narrower `PublicWorldState` shape exists for
rival-agent strategy selection — the same world information a client's projection carries, with no
actor's own private state — but no unit yet wires a rival agent into `end_week`'s resolution, so
nothing constructs one at runtime yet.

The Stable Life fixtures prove winning and losing engine/replay paths. Do not rely on an answer
for a week that simultaneously reaches its limit and another terminal condition; that precedence
is explicitly unsettled and excluded from supported scenarios.

## World-graph campaigns

Use `world-graph` for a navigable world with autonomous inhabitants, where the unit of play is a
batch of simulated ticks rather than a single choice or a week. `worldGraphKind` is a real,
exported, registered kind — the same status as `story-graph` and `simulation` — with all twenty
tick systems registered, ordered, and tested for that ordering. Five of the twenty are
known-and-retained stubs or partial implementations (three no-op, two partial); see
`design/90-decisions.md`, *Known-and-retained implementation gaps: `world-graph` tick systems*,
for the current list.

Its load-bearing rule is **batch invariance**: advancing N ticks in one call must reach the same
kind state as any ordered partition of that N totalling the same number of ticks. Everything else
in the kind exists to make that true.

A scenario selects a map from the campaign-owned catalog; a pure builder validates and
materializes typed definitions before play begins. One atomic tick then runs a fixed, ordered
20-system pipeline: pathfinding and routing, queue and service handling, staff work, finance,
incidents, and terminal precedence, in that declared order every time.

Win and loss are read through `Kind.outcome`, not through `GameStatus` — the same terminal-identity
mechanism the replay oracle uses for every kind, not a `world-graph`-specific status field.

## Saves and migrations

A save wraps canonical serialized `GameState` with independently versioned save, serialization,
engine, kind, and campaign metadata plus a checksum and replay-compatibility flag.

Loading follows this order:

1. Validate the wrapper, checksum, serialization version, and state shape.
2. If the kind version changed, run the engine-owned kind-state migration.
3. If the campaign version changed, run the campaign migration against the migrated shape.
4. Validate the result.
5. Replace the session only after every step succeeds.

Missing or failed migration is loud and leaves the old record intact. Engine-version mismatch by
itself is provenance, not a reason to reject a load. Any successful migration permanently marks
the save lineage not replay-compatible because the old action log may no longer regenerate its
current state.

Published ids are stable. Renaming a node, definition, reason, or other persisted id is migration,
not cleanup.

## Replay and incident diagnosis

Use two complementary checks:

- The **determinism harness** reruns one build and compares canonical bytes and events.
- The **replay oracle** runs committed inputs across versions and compares only stable outcomes:
  submission decisions/reasons, achievements, and kind terminal identity.

Fixtures record submitted actions and declared params, not internal action-log entries or state.
Results are indexed by submission position because rejected submissions do not advance engine
sequence numbers.

Do not add prose, timestamps, balance values, or serialization bytes to a cross-version outcome.
Those legitimately change without changing what happened to the player.

A production incident should become a minimal replay fixture when privacy permits. The specified
capture flow excludes identity, timing, raw state, and undeclared parameters; capture happens only
for an explicit report or error event. Promotion into the committed corpus is reviewed and never
automatic. That hosting integration is not implemented yet.

## Observability without behavioral influence

The engine has two distinct outputs:

- `StateChange` is a localized domain audit record that the player may see.
- `EngineEvent` is operational telemetry for developers and content authors.

Operational events are clock-free inside resolution and use stable names, sequence, ordinal, and
sanitized scalar data. The session boundary may add timestamp, session id, and trace id afterward.

Kinds may emit only names they declare under `kind.<kindId>.*`. Emitting an undeclared name, or a
name outside that namespace, is a coding defect: it throws in every non-production build (dev, CI,
tests, `vitest`'s own default), so the mistake surfaces long before it ships. In a production
build (`NODE_ENV=production`) the same violation is silently dropped instead — no event is built
or emitted, and the resolution that triggered it continues unaffected, on the same "removing every
event changes nothing" reasoning that already governs a throwing sink.

An emitter returns nothing. Sink exceptions are isolated. Removing all events must leave the
serialized game byte-identical. Never include unresolved caller action ids, free text, identity,
or undeclared params in event data.

## Adding extension points

The practical test for a host port is: can it change canonical serialized game state? If yes, it
does not belong as a host-supplied port.

Existing host seams cover:

- deterministic game/session ids and seeds;
- session and profile persistence;
- operational event sinks;
- boundary clocks used only for metadata.

One seam is specified but not yet implemented: `ExperimentSource` resolves an A/B or feature-flag
variant at session-creation time so it can select content packs and tag events, but it is
boundary-only by design — a kind can never see or branch on a variant — and it is deferred along
with the content-pack resolution machinery it feeds. Do not build against it as a live seam yet.

Kinds, reducers, migrations, condition meaning, content validation, and deterministic tie-breaks
remain engine-owned. A new theme, scenario, culture, or body of content is not a new kind. Add a
kind only when turn model, runtime state, projection, and determinism contract diverge materially.

## Failure handling checklist

- Return stable structured errors, never string-matchable exceptions.
- Reject content before freezing the registry; expose no partial registry.
- On rejected game actions, persist nothing and append no action-log entry.
- On session write failure, do not acknowledge success; retry only after store recovery.
- On profile failure, preserve the successful game result and return a warning.
- On migration failure, retain the previous session/save untouched.
- On sink failure, preserve both returned and serialized game results.
- On unknown or hidden action, reveal no information beyond `unknown_action`.
- On unsupported deferred behavior, reject/exclude it rather than selecting plausible semantics.

## Verification before handing off a change

Run the checks appropriate to what changed:

```powershell
./build/Test-Documentation.ps1
Set-Location src/engine
npm run typecheck
npm run lint
npm test
Set-Location ../..
git diff --check
git status --short --branch
```

For documentation routes and heading anchors, also run the production Docusaurus build when
Docker and the generated `docs.ps1` are available. The development server is not the route/link
gate.

For engine behavior, add or update the narrow unit test, a same-build deterministic fixture when
serialization should remain stable, and a release replay fixture when the behavior is part of a
published campaign's stable outcome.
