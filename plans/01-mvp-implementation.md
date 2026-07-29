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
> - **Phases 2–9 have been removed from this document.** They duplicated work that
>   [`TODO.md`](../docs/docs/engine/TODO.md) now owns as units **W0–W19**, the
>   authoritative execution order (as this document's own Authority section says) — and the
>   duplicate had already drifted out of agreement with the specs. See *Where the
>   Implementation Work Lives* below for what was removed and why. The mapping they had:
>
>   | Phase (removed) | Unit(s) in `TODO.md` |
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
>   CI never had a phase here; it is **W0**, planned in
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
      implementation is layered onto the branch. **This box is the maintainer's sign-off —
      it is not self-certified by the reviewing agent.** The evidence gathered for it, all
      re-runnable: engine `npm ci` / typecheck / lint / test green (15 tests); the
      determinism eslint guard verified to reject `Math.random`, `Date.now`, and
      `Math.pow`; docs production build green with `onBrokenLinks: 'throw'`; 0 unresolved
      cross-document `§` references; every internal markdown link resolving; the W0–W19
      graph free of unknown, forward, and cyclic dependencies with every unit carrying
      *Depends on* and *Done when*; all 18 [`MVP.md`](../docs/docs/engine/MVP.md) §5 boxes
      mapped to a unit; `git diff --check` clean.

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

- `core/determinism/pcg32.ts` — `RngState`, `Pcg32`, and `deriveStream`.
- `core/persistence/canonical.ts` — `canonicalStringify`, `serialize`, and `deserialize`.
- Tests alongside both modules.

The following Phase 1 components do not yet exist: the core contract types, pure
`Engine`, session store, projection mechanism, content registry/loader, validation,
localization/reason-code tables, and determinism harness.
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

Before story-graph achievement work ([`TODO.md`](../docs/docs/engine/TODO.md) **W8**, the
profile store, and **W13**, endings and achievements), add:

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
## Where the Implementation Work Lives

The Phase 2–9 sections this plan originally carried — their *What to Implement* bodies,
verification checklists, and the `Allowed APIs` copy-list — **have been removed**, not lost.
They were a second copy of work that [`TODO.md`](../docs/docs/engine/TODO.md) now owns as
units **W0–W19**, each with its own contract references, dependencies, and done-criteria.

Two copies of the same checklist is a drift surface, and it had already drifted: the
removed Phase 3 list still required *"RNG state writes back only after successful
resolution"*, which the derived-not-carried decision
([`04-core.md`](../docs/docs/engine/04-core.md) §8) made false — there is no persisted RNG
state to write back. The removed `Allowed APIs` list had likewise gone stale, omitting
`InitialStateResult` (D3), `ProfileStore` / `PlayerProfile` (D5), and `AuthoredText` /
`BuiltCampaign` (D7) — all core types added when those very decisions were applied.

The specifications are the API authority; `TODO.md` is the work authority. Neither is
restated here. The phase → unit mapping is in the banner at the top of this document.

## Peer-Review Checklist

Reviewers should confirm:

- [x] The plan copies authoritative contracts rather than inventing APIs.
- [x] B1–B3 cover completion and validation of the branch's existing rename work.
- [x] D1–D8 identify every known decision that can change implementation.
- [x] Profile and session persistence remain outside deterministic `GameState`.
- [x] Core/kind/campaign ownership is not duplicated.
- [x] Text and MCP remain presentation adapters over one session surface.
- [ ] The final evidence matches the complete MVP Definition of Done —
      [`MVP.md`](../docs/docs/engine/MVP.md) §5, verified at **W19**.

Dependency ordering and per-phase guards were checked here and now live on the units:
the W0–W19 graph has no unknown, forward, or cyclic dependencies, and every unit carries
both *Depends on* and *Done when*.

## Suggested Review Order

1. Branch decisions B1–B3 and the rendered documentation.
2. Contract decision gates D1–D8 — the rationale, which is not duplicated elsewhere.
3. Everything else: [`TODO.md`](../docs/docs/engine/TODO.md), in unit order.
