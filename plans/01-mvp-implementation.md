# Game Engine MVP — Implementation Plan

**Status:** Approved — PR #1 merged; execution starts at W0

**Merged:** `f5cfb71` — Rename Narrative Engine to Game Engine (#1)

**Scope:** Implement the finalized story-graph MVP without silently altering the
authoritative specifications. The Game Engine rename and contract review are complete.

> ## ⚠ Read this before acting on anything below
>
> **This document is a historical record, not a task list.** Everything it proposed has
> since been decided and written into the specifications. Working from it directly will
> cause already-applied edits to be re-applied.
>
> - **D1–D8 are applied.** Each is in the specs and logged in
>   [`OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md) §1, which is now a
>   decision log, not a gap list. Instructions below of the form *"correct the pseudocode
>   before implementation"* are **already done** — do not redo them.
> - **The Phase 0–9 sequence below is superseded** by the units of work **W0–W19** in
>   [`TODO.md`](../docs/docs/engine/TODO.md), which is the authoritative execution order
>   (as this document's own Authority section says). Mapping:
>
>   | Phase here | Unit(s) in `TODO.md` |
>   |---|---|
>   | 2 — Core contracts / modules | W1 |
>   | 3 — Pure engine kernel | W2, W3 |
>   | 4 — Registry, validation, localization, projection | W4, W5, W6 |
>   | 5 — Session and profile persistence | W7, W8 |
>   | 6 — Story-graph kind | W9–W14 |
>   | 7 — Bureaucracy campaign and fixtures | W15 |
>   | 8 — Text and MCP clients | W16, W17 |
>   | 9 — Determinism harness and verification | W18, W19 |
>
>   CI has no phase here; it is **W0**, planned in
>   [`02-w0-ci-workflow.md`](02-w0-ci-workflow.md).
>
> **What is still worth reading here:** the *rationale* behind each contract decision,
> and the anti-pattern guards, which remain accurate and are not duplicated elsewhere.

## Authority and Change Control

The specifications remain authoritative:

- [`docs/docs/engine/02-architecture.md`](../docs/docs/engine/02-architecture.md) — settled
  architecture decisions.
- [`docs/docs/engine/04-core.md`](../docs/docs/engine/04-core.md) — core contracts and
  types.
- [`docs/docs/engine/03-story-graph-kind.md`](../docs/docs/engine/03-story-graph-kind.md) —
  story-graph contracts and algorithms.
- [`docs/docs/engine/MVP.md`](../docs/docs/engine/MVP.md) — Definition of Done.
- [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — authoritative implementation
  order.
- [`docs/docs/engine/OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md) — unresolved
  decisions and known concerns.

This plan is a proposed execution artifact, not a replacement or amendment. If
implementation exposes a required contract change, stop and propose that change for
sign-off before editing a specification. Findings and decisions are reviewed one at a
time, following the repository convention in [`CLAUDE.md`](../CLAUDE.md).

## Goal

Deliver the MVP defined in `MVP.md`: a human or AI player can complete the Bureaucracy
arc through both a text client and MCP, using the same deterministic engine, with
save/resume, projection, validation, and achievement persistence.

## Out of Scope

- The `simulation` kind and Life in the Fast Lane.
- Campaign migration execution beyond the interfaces required to load current saves.
- Culture packs and the remaining Bulgaria arcs.
- Web, mobile, and Discord clients.
- Hosting, accounts, billing, analytics, multiplayer, and AI-assisted authoring.

---

## Phase 0 — Complete and Validate the Working Branch

The branch contains two committed documentation changes before this plan:

- `0c1cb9b` — rename “Narrative Engine” to “Game Engine” in the repository README and
  title-case its section headings.
- `5db125f` — apply the product rename across project instructions, lessons learned,
  specification documents, Docusaurus configuration, and the implementation README;
  remove the branded prefix from specification H1s; title-case affected H1–H4 headings.

There are no runtime changes in those commits. The changed files are:

- `README.md`.
- `CLAUDE.md` and `agent.md`.
- `docs/docs/engine/01-vision.md`.
- `docs/docs/engine/02-architecture.md`.
- `docs/docs/engine/03-story-graph-kind.md`.
- `docs/docs/engine/04-core.md`.
- `docs/docs/engine/MVP.md`.
- `docs/docs/engine/OPEN-QUESTIONS.md`.
- `docs/docs/engine/TODO.md`.
- `docs/docusaurus.config.ts`.
- `src/engine/README.md`.

### What to Complete

#### B1 — Rename the Private Package — **Resolved**

The product is branded “Game Engine,” while `src/engine/package.json` and the H1 in
`src/engine/README.md` retain the private npm identifier `narrative-engine`.

**Decision:** Rename the private package identifier to `game-engine` and change the
implementation README H1 to `Game Engine (Implementation)`. Update any generated
lockfile package metadata and exact technical references in the same change.

Do not treat generic lower-case phrases such as “narrative game engine” or “narrative
engines” as stale branding; they describe the product category.

#### B2 — Enforce Title Case Across All Documentation — **Not adopted**

**Original proposal:** Use Title Case for every Markdown heading in all repository
documentation, not only the files already touched by the rename — auditing every tracked
`*.md` file while preserving code spans, identifiers, acronyms, and product spelling.

**Outcome: rejected during peer review, and never executed.** The cost was churn across
ten spec files that invalidates every heading anchor, in a site whose broken-link check
was `warn` at the time — so the build could not have caught what it broke, while B3 below
made manual anchor verification a branch-acceptance gate. B2 would have manufactured the
work B3 paid for. The headings the rename commits already title-cased were left as they
are; the remainder were not touched.

*(Recorded rather than deleted: the repository convention is that a declined suggestion is
written down as known-and-retained, not dropped silently.)*

#### B3 — Documentation Acceptance Criteria — **Resolved**

**Decision:** Build and render the Docusaurus documentation after B1 and B2. This is a
mandatory branch-acceptance check, not optional follow-up. Confirm:

- The site title and navbar say “Game Engine.”
- Shortened document H1s remain clear in the generated sidebar and pages.
- Heading-case changes do not break anchors or cross-document links.
- Existing links to companion repositories still resolve as intended.
- No leftover template documentation appears in the generated sidebar.
- Broken anchors or links fail the Docusaurus build and branch acceptance.
- Visual inspection evidence is recorded for navigation, representative pages, and the
  generated sidebar before peer-review approval.

### Documentation References

- The merged rename diff: `git show f5cfb71`.
- Documentation build instructions: `README.md`, “Build the Docs Site.”
- Docusaurus configuration: `docs/docusaurus.config.ts` and `docs/sidebar.ts`.
- Docker wrapper: `docs.ps1` and `docs/Dockerfile`.
- Known docs-image assumptions: `agent.md`, “Open Concerns & Assumptions.”

### Verification Checklist

- [x] The private package identifier and implementation README use the approved
      `game-engine` / “Game Engine” names.
- [x] Every heading in every tracked Markdown document uses Title Case.
- [x] Code identifiers, acronyms, and product names retain their canonical casing inside
      headings.
- [x] Full-repository searches find no stale user-facing “Narrative Engine” branding.
- [x] Remaining `narrative-engine` occurrences match the B1 decision.
- [x] `git diff --check main...HEAD` passes.
- [x] The docs image builds successfully.
- [x] Rendered navigation, headings, anchors, and links are visually checked.
- [ ] Peer review approves the post-merge cleanup and documentation follow-ups before W0
      implementation is layered onto the branch.

### Anti-Pattern Guards

- Do not mechanically replace generic descriptive uses of “narrative.”
- Do not leave generated lockfile metadata or exact technical references on the old
  package identifier.
- Do not claim the documentation is valid from textual diff checks alone.
- Do not limit the heading audit to files already changed on this branch.
- Do not mechanically alter code spans, identifiers, acronyms, or product names merely
  to satisfy ordinary-word capitalization.

---

## Phase 1 — Documentation Discovery and Contract Decision Gates

### Confirmed Current State

The only implementation under `src/engine/src/` is:

- `core/rng/pcg32.ts` — `RngState`, `Pcg32`, and `deriveStream`.
- `core/serialize/canonical.ts` — `canonicalStringify`, `serialize`, and `deserialize`.
- Tests alongside both modules.

The following Phase 1 components do not yet exist: the core contract types, pure
`Engine`, session store, projection mechanism, content registry/loader, validation,
localization/reason-code tables, and determinism harness.

### Allowed APIs

Copy these contracts from the specifications; do not invent parallel surfaces:

- `GameState`, `GameStatus`, `LoggedAction`: `04-core.md` §2.
- `Kind<KState>`, `AdvanceResult<KState>`, `KindContext`: `04-core.md` §3.
- `KindRegistry`, `createEngine`, `Engine`: `04-core.md` §4.
- `NewGameConfig`: `04-core.md` §5.
- `Scene`, `SceneBody`, `AvailableAction`, `ActionParams`: `04-core.md` §6.
- `SessionStore`, `SessionHandle`, `SaveHandle`, `CampaignSummary`: `04-core.md` §7.
- `StreamId`, `RngHandle`: `04-core.md` §8.
- `ProjectionAudience`, `PlayerView`: `04-core.md` §9.
- `ContentRegistry`, `Campaign`, `SaveEnvelope`: `04-core.md` §10.
- Validation and command-result types: `04-core.md` §§11–12.
- `PlaythroughFixture`: `04-core.md` §14.
- Story-graph content and runtime types: `03-story-graph-kind.md` §§1–9.

The conceptual phrase `advance(state, action) → state` does not introduce a second
public engine method. The documented public operation is `Engine.submitAction`; a
kind implements `Kind.advance`.

### Resolved Contract Decisions

Apply each approved decision to the authoritative specifications before coding the
affected phase, so implementation never has to choose between contradictory contracts.

#### D1 — `ActionResult` Uses `value` — **Resolved**

`ActionResult extends CommandResult<GameState>`, which places the new state in `value`,
while the `submitAction` pseudocode returns a `state` property.

**Decision:** The declared type is authoritative. Successful actions return the new
`GameState` in `ActionResult.value`; there is no parallel `state` property. Correct the
`submitAction` pseudocode in `04-core.md` before implementation so the contract and
algorithm agree.

#### D2 — Use the Declared Action Stream — **Resolved**

The declared `StreamId` is `{ kind: "action"; seq: number }`; one pseudocode line uses
`{ action: seq }`.

**Decision:** Use `{ kind: "action", seq }` everywhere. Correct the `submitAction`
pseudocode in `04-core.md` before implementation; do not introduce an alternate stream-id
shape.

#### D3 — Return an Initial-State Result — **Resolved**

`createGame` may settle directly to an ending, but its pseudocode initializes
`status: "active"`.

**Decision:** Add the following core contract:

```typescript
interface InitialStateResult<KState> {
  state: KState;
  status: "active" | "ended";
  changes: StateChange[];
  messages: OutcomeMessage[];
}
```

Change `Kind.initialState(campaign, ctx)` to return `InitialStateResult<KState>`.
`createGame` copies its `state` into `kindState`, uses its `status` for the envelope, and
surfaces its initial changes/messages through the command result. Correct `04-core.md`
and the story-graph start-settlement description before implementation. The core must
not inspect kind-specific state to infer status.

#### D4 — Pass Action Parameters to Kinds — **Resolved**

`Engine.submitAction` accepts and logs `params`, but `Kind.advance` does not receive
them.

**Decision:** Change the kind contract to:

```typescript
advance(
  state: KState,
  actionId: string,
  params: ActionParams | undefined,
  ctx: KindContext,
): AdvanceResult<KState>;
```

Pass the same canonicalizable params object to the kind and `LoggedAction`. The
story-graph kind accepts no parameters for MVP actions and returns a validation error
when a non-empty params object is supplied. Future kinds may define parameter schemas,
but undocumented parameters are never silently ignored.

#### D5 — Cross-Kind Player Profile Boundary — **Resolved**

Before story-graph achievement work (`TODO.md` Phase 2; this plan’s Phase 6), add:

```typescript
interface CreateSessionConfig extends NewGameConfig {
  profileId?: string;
}

interface AchievementRecord {
  campaignId: string;
  achievementId: string;
}

interface PlayerProfile {
  formatVersion: 1;
  profileId: string;
  achievements: readonly AchievementRecord[];
}

type ProfileWarningCode =
  | "profile_missing"
  | "profile_corrupt"
  | "profile_write_failed";

interface ProfileWarning {
  code: ProfileWarningCode;
  profileId: string;
}

interface ProfileLoadResult {
  profile: PlayerProfile;
  warnings: readonly ProfileWarning[];
}

interface ProfileSaveResult {
  ok: boolean;
  warnings: readonly ProfileWarning[];
}

interface ProfileStore {
  load(profileId: string): Promise<ProfileLoadResult>;
  save(profile: PlayerProfile): Promise<ProfileSaveResult>;
}
```

**Decision:** Profile identity belongs to `CreateSessionConfig` and the session record,
never `NewGameConfig` or `GameState`. Achievement identity is qualified by
`campaignId + achievementId`.

An omitted `profileId` creates an anonymous session: no profile read or write occurs,
and achievements persist only in that game’s deterministic kind state. Cross-session
achievement persistence requires an explicit `profileId`.

The story-graph kind records deterministic per-session unlocks in
`StoryGraphKindState.unlockedAchievements` and emits an `achievement_unlocked`
`StateChange`. After a successful action, `SessionStore` idempotently upserts those
records through `ProfileStore`. Profile data and write outcomes never affect action
resolution or replayable state.

A missing or corrupt profile loads as an empty profile and returns a warning. A profile
write failure also returns a warning but does not invalidate or roll back the completed
game action. Missing and corrupt results return an empty format-version-1 profile for
the requested `profileId` with `profile_missing` or `profile_corrupt`; write failure
returns `profile_write_failed`.

#### D6 — Core Owns Base Reason Localization — **Resolved**

**Decision:** The core ships immutable default-English strings for every
`BASE_REASON_CODE` under reserved `core.reason.*` localization keys. Registry
construction merges core strings with kind and campaign strings but rejects any attempt
to override the reserved core namespace.

Kinds own localization strings for reason codes they add; campaigns own their narrative
strings. Registry validation fails when any registered reason code lacks a localized
message. Clients resolve reason keys through the merged registry and never string-match
English.

#### D7 — Typed Authoring-to-Registry Boundary — **Resolved**

Before campaign content, define:

```typescript
interface AuthoredText {
  key: LocKey;
  text: string;
}

interface BuiltCampaign {
  campaign: Campaign;
  strings: ReadonlyMap<LocKey, string>;
}
```

Add an explicit `StoryGraphCampaignSource` authoring type whose player-facing fields use
`AuthoredText`; keep it separate from runtime `StoryGraphCampaign`, whose fields use
`LocKey`.

**Decision:** A pure builder validates source data, replaces `AuthoredText` values with
their keys, and returns `BuiltCampaign`. Conflicting duplicate keys fail; repeated
identical key/text pairs deduplicate. Registry assembly validates every built campaign,
merges protected core and kind strings, then freezes campaigns and strings.

YAML/JSON parsing and filesystem access belong to an outer adapter and feed unknown data
into source-schema validation; neither belongs in the engine. The MVP requires one
default locale, English. Additional locales are post-MVP.

#### D8 — Allow Zero-Choice Campaigns With a Warning — **Resolved**

**Decision:** A campaign that settles directly to an ending during `createGame` is valid
and loads successfully. `InitialStateResult.status` reports `"ended"` and the initial
scene/view exposes the ending normally.

Validation emits a Tier 2 `no_reachable_choice` warning when no choice node is reachable
from the start. This warns authors that the campaign is non-interactive without
forbidding deliberate vignettes or test campaigns.

### Phase 1 Verification

- [x] D1–D4 have explicit dispositions before core implementation begins.
- [x] D5 is resolved before achievement persistence.
- [x] D6 is resolved before the text client renders reasons.
- [x] D7 is resolved before authored campaign content is loaded.
- [ ] D8 is represented in initial-settlement and validation tests.
- [x] No specification has been silently changed to accommodate implementation.

### Phase 1 Anti-Pattern Guards

- Do not infer missing APIs from naming or pseudocode.
- Do not implement both competing result shapes.
- Do not put profiles, timestamps, or host metadata in replayable state.
- Do not revisit the B1 package decision as incidental implementation cleanup.

---

## Phase 2 — Core Contracts and Module Boundaries

### What to Implement

Create focused modules matching `04-core.md` §1.1:

```text
src/engine/src/core/
  kernel/
  session/
  persistence/
  projection/
  validation/
  registry/
  localization/
  determinism/
```

Copy the documented types into the module that owns each responsibility. Add a small
public barrel only after the ownership boundaries compile cleanly.

Use `kindState: unknown`; each kind narrows its own state. Keep `KindRegistry` fixed and
engine-owned.

### Documentation References

- `04-core.md` §§1.1–3, 5–12.
- `04-core.md` §§15 and 17 for envelope ownership and identifiers.
- Existing strict configuration in `src/engine/tsconfig.json`.

### Verification Checklist

- [ ] `npm run typecheck` passes.
- [ ] Contract tests or compile-only fixtures cover all declared public shapes.
- [ ] A dependency scan shows no core import from `kinds/`, `clients/`, or `mcp/`.
- [ ] `GameState` contains no clock, profile, or duplicated kind state.
- [ ] Optional properties satisfy `exactOptionalPropertyTypes`.

### Anti-Pattern Guards

- Do not type `kindState` as a union of known kinds.
- Do not duplicate campaign identity inside kind content.
- Do not add convenience fields absent from the specification.
- Do not weaken strict TypeScript settings to make contracts compile.

---

## Phase 3 — Pure Engine Kernel

### What to Implement

Copy the orchestration pattern from `04-core.md` §4:

- `createEngine(registry, kinds)`.
- `createGame(config)`.
- `scene(state)`.
- `view(state, audience)`.
- `availableActions(state)`.
- `submitAction(state, actionId, params?)`.
- Canonical `serialize(state)`.
- Validated `deserialize(data)` returning `CommandResult<GameState>`.

Wrap the existing PCG32 implementation behind the documented `RngHandle`. Derive the
start and action streams using the resolved D2 shape. A rejected action returns the
original state unchanged and does not advance RNG or append the action log.

### Documentation References

- `04-core.md` §§2–5 and §8.
- `04-core.md` §12 for result, change, and message types.
- `src/engine/src/core/rng/pcg32.ts` for actual RNG APIs.
- `src/engine/src/core/serialize/canonical.ts` for the serialization primitive.

### Verification Checklist

- [ ] `createGame` produces a valid envelope with a recorded seed.
- [ ] Successful actions append exactly one monotonic `LoggedAction`.
- [ ] Rejected actions preserve byte-identical serialized state.
- [ ] RNG state writes back only after successful resolution.
- [ ] Every operation returns a new envelope and leaves caller input unchanged.
- [ ] Deserialization rejects invalid envelopes instead of trusting the JSON cast.
- [ ] Unit tests cover missing kinds, missing campaigns, ended sessions, and unknown actions.

### Anti-Pattern Guards

- Do not mutate caller state or arrays.
- Do not use `Math.random`, wall-clock APIs, or non-bit-stable math.
- Do not expose the raw `Pcg32` object in persisted state.
- Do not treat `StateChange.path` as a mutation path.

---

## Phase 4 — Registry, Validation, Localization, and Projection

### What to Implement

Implement:

- A frozen, in-memory `ContentRegistry`.
- A loader boundary that performs no I/O inside the engine.
- Tier 1 errors and Tier 2 warnings through each kind’s `validateCampaign`.
- Identifier and localization-key validation.
- The resolved base reason-code string table.
- `Engine.view` and projection enforcement.

The loader may read authoring data outside the engine package boundary, but it must hand
the engine a resolved, prevalidated registry. Implement the D7 contract rather than
ad-hoc YAML/JSON handling in the kernel.

### Documentation References

- `04-core.md` §§9–12 and §§17–18.
- `03-story-graph-kind.md` §11 for kind-specific checks.
- `OPEN-QUESTIONS.md` §§1.2–1.4.

### Verification Checklist

- [ ] A broken campaign fails registry construction with Tier 1 errors.
- [ ] Unreachable content produces a Tier 2 warning without preventing load.
- [ ] Duplicate and malformed identifiers fail validation.
- [ ] Missing `LocKey` values fail validation.
- [ ] Projections exclude seed, RNG, action log, raw kind state, and hidden values.
- [ ] The engine kernel performs no filesystem or network I/O.

### Anti-Pattern Guards

- Do not freeze an unvalidated registry.
- Do not string-match localized English in clients.
- Do not leak hidden state to the `agent` audience by default.
- Do not expand the frozen Condition operator set.

---

## Phase 5 — Session and Profile Persistence

### What to Implement

Implement the `SessionStore` surface from `04-core.md` §7 with an in-memory adapter
first:

- `listCampaigns`.
- `getScene` and `getView`.
- `createSession` and `resumeSession`.
- `submitAction`.
- `saveGame` and `loadGame`.

Persist canonical state blobs, not mutable engine objects. Add the separately approved
profile store from D5. Achievement persistence failures must degrade to no achievements,
not fail the game.

### Documentation References

- `04-core.md` §§7 and 10.
- `03-story-graph-kind.md` §7.
- `OPEN-QUESTIONS.md` §1.1.
- `MVP.md` §5, “Persistent.”

### Verification Checklist

- [ ] Save mid-session, load, and continue without state loss.
- [ ] Two sessions cannot mutate each other’s state.
- [ ] Store metadata never appears in serialized `GameState`.
- [ ] Profile unlocks survive across sessions.
- [ ] Missing and corrupt profiles degrade exactly as approved in D5.

### Anti-Pattern Guards

- Do not place authoritative state in clients.
- Do not use in-memory object identity as persistence.
- Do not place `savedAt`, owner ids, or profile data in `GameState`.
- Do not let profile reads affect deterministic resolution.

---

## Phase 6 — Story-Graph Kind

### What to Implement

Copy the types and algorithms from `03-story-graph-kind.md`:

- `StoryGraphCampaign` and variable declarations.
- Choice, random, auto, and ending nodes.
- Typed `Consequence` reducers with clamp-after-all-effects semantics.
- The frozen Condition evaluator and story-graph field namespace.
- `StoryGraphKindState`.
- `submitChoice` followed by `settle`.
- Scene/actions and `StoryGraphView` projection.
- Ending and achievement evaluation.
- Tier 1/2 story-graph validation.

Every `enter(nodeId)` increments its visit count, including the starting node and
settlement pass-through nodes. Use the current action RNG handle for random transitions
and the start handle during initial settlement.

### Documentation References

- `03-story-graph-kind.md` §§1–11.
- Copy the exact transition algorithms from §8.2.
- Copy the projection contract and exclusions from §9.
- `04-core.md` §15 for the core-to-kind mapping.

### Verification Checklist

- [ ] Typed reads and writes reject undeclared or mismatched variables.
- [ ] Integer effects clamp once after the transition’s complete effect list.
- [ ] `showWhen` choices are absent; unmet `requirements` choices are disabled with reasons.
- [ ] Auto/random chains settle to a choice or ending.
- [ ] A 64-step non-terminating settlement fails safely.
- [ ] Random transitions reproduce from the same seed and action log.
- [ ] Hidden variables, choices, and achievements never appear in projection.
- [ ] Achievements unlock once and persist through the profile boundary.

### Anti-Pattern Guards

- Do not add free-string variables or a direct `unlock` consequence.
- Do not merge `showWhen` and `requirements`.
- Do not duplicate envelope fields in `StoryGraphKindState`.
- Do not iterate state-affecting records without stable sorting.
- Do not allow arbitrary string paths to mutate state.

---

## Phase 7 — Bureaucracy Campaign and Validation Fixtures

### What to Implement

Copy the worked authoring example from `03-story-graph-kind.md` §12 into the resolved D7
authoring format. Supply all localization strings. Add:

- The valid Bureaucracy campaign.
- A dangling-node fixture.
- An undeclared-variable fixture.
- An unreachable-node fixture.
- A settlement-cycle fixture.

Keep envelope identity in `Campaign`; the story-graph content contains only
kind-specific data.

### Documentation References

- `03-story-graph-kind.md` §12.
- `MVP.md` §§3 and 5.
- `TODO.md` Phase 3.

### Verification Checklist

- [ ] The valid campaign loads without Tier 1 errors.
- [ ] The Bureaucracy loop reaches the `office_visits >= 3` gate.
- [ ] The seeded clerk transition reproduces.
- [ ] The deliberately broken fixtures produce their expected tiers and paths.
- [ ] Every authored string resolves through the registry.

### Anti-Pattern Guards

- Do not hard-code campaign behavior into the kind.
- Do not repeat campaign identity in `StoryGraphCampaign`.
- Do not suppress Tier 2 warnings merely to produce a clean load.

---

## Phase 8 — Text and MCP Clients

### What to Implement

Implement two sibling adapters over `SessionStore`:

1. A plain text client that exercises every public store operation.
2. An MCP server exposing the exact tool surface from `04-core.md` §13.

Both clients render only `Scene`, `AvailableAction`, `PlayerView`, messages, and visible
changes. Neither client imports kind reducers or reads raw state.

### Documentation References

- `04-core.md` §§6–7 and §13.
- `02-architecture.md` §10.
- `MVP.md` §5, “Two clients, one game” and “Honest.”

### Verification Checklist

- [ ] Both clients complete the same campaign with the same seed and choices.
- [ ] The text client covers every public session-store operation.
- [ ] MCP schemas match the documented arguments and results.
- [ ] Neither client imports `kinds/` or accesses persisted `GameState`.
- [ ] Requirement failures render stable codes and localized reasons.

### Anti-Pattern Guards

- Do not add client-specific game operations.
- Do not recompute requirements or outcomes in a client.
- Do not create an AI-only rules path.
- Do not expose raw save blobs as a substitute for session ids.

---

## Phase 9 — Determinism Harness and MVP Verification

### What to Implement

Copy the `PlaythroughFixture` runner from `04-core.md` §14:

1. Create a game from fixed config and seed.
2. Replay each logged action.
3. Canonically serialize the final state.
4. Compare against a committed golden file.

Add repeated-seed property tests and the end-to-end save/load, projection, validation,
text-client, and MCP scenarios required by `MVP.md`.

### Documentation References

- `04-core.md` §14.
- `MVP.md` §5.
- `TODO.md` Phase 5.

### Verification Checklist

- [ ] `npm test`.
- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] `npm run build`.
- [ ] `git diff --check`.
- [ ] Same seed plus action log produces byte-identical output.
- [ ] `deserialize(serialize(state))` is deeply equal to state.
- [ ] A one-byte golden-file change fails.
- [ ] N seeds run twice with identical results.
- [ ] The full suite runs in Node without DOM, network, or AI dependencies.
- [ ] Every checkbox in `MVP.md` §5 is checked with test evidence.

### Anti-Pattern Guards

- Do not update golden files automatically without reviewing the semantic diff.
- Do not claim determinism from unit RNG tests alone.
- Do not skip client-boundary and projection tests.
- Do not mark the MVP complete while any Definition-of-Done item lacks evidence.

---

## Peer-Review Checklist

Reviewers should confirm:

- [x] The plan copies authoritative contracts rather than inventing APIs.
- [x] B1–B3 cover completion and validation of the branch’s existing rename work.
- [x] D1–D8 identify every known decision that can change implementation.
- [x] Phase boundaries follow dependency order and can run in separate contexts.
- [x] Each phase has explicit verification and anti-pattern guards.
- [x] Profile and session persistence remain outside deterministic `GameState`.
- [x] Core/kind/campaign ownership is not duplicated.
- [x] Text and MCP remain presentation adapters over one session surface.
- [ ] The final evidence matches the complete MVP Definition of Done.

## Suggested Review Order

1. Branch decisions B1–B3 and the rendered documentation.
2. Contract decision gates D1–D8.
3. Phase 2 module/type boundaries.
4. Phase 3 engine result and RNG semantics.
5. Phase 5 profile boundary.
6. Phase 6 settlement and projection semantics.
7. Final verification coverage.
