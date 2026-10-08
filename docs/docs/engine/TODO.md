---
slug: todo
---

<!-- Generated from design/30-slices.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# TODO

**Status:** Delivery ledger. All 125 W-numbered units have landed or been cancelled, and each
is retired to one row under [Landed](#landed). Slices from S121 on are `## S<n>` sections above
*Landed*, in the agent kit's slice format; each reads `Status: todo` until the pull request that
builds it sets `Status: done`. S121–S128 fix the reproduced defects of the 2026-10-03 repository
review, planned in
[`plans/53`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/53-repository-review-2026-10-03-fixes.md).

> **Where a retired unit's full text is.** Every W unit's body — what it delivers, its numbered
> acceptance criteria, its scope, and the programme prose that grouped units together — is in this
> ledger as it stood at
> [`7081402`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/7081402c6dccc277b23250d44a22b022a16fd683/design/30-slices.md).
> Most units also have an execution record under
> [`plans/`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/tree/main/plans). Each row's
> anchor is the unit's id in lower case, so a link ending in `#w90` still lands on W90's row.
>
> The contracts the units were built against are unchanged:
> [`04-core.md`](04-core.md), [`03-story-graph-kind.md`](03-story-graph-kind.md),
> [`10-simulation-kind.md`](10-simulation-kind.md), [`12-world-graph-kind.md`](12-world-graph-kind.md)
> and [`05-observability.md`](05-observability.md). The register of unknowns is
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).

## Carried Forward

Open items the retired bodies carried that were never sliced. They are moved here so that none is
lost. None is sliceable as written: each needs a contract or design decision first.

- **Session capture** ([`08-session-capture.md`](08-session-capture.md)). The hosting gate is met:
  [SubZeroDev.Adventures](https://github.com/The-Running-Dev/SubZeroDev.Adventures) is a hosted
  deployment. What blocks it is a missing contract surface. [08 §3.2](08-session-capture.md#3-what-is-refused)
  keeps only the parameters a kind declares, and no kind declares its parameters anywhere the core
  can read. Either the `Kind` interface gains a declared-parameter surface, or §3.2 is restated
  against something a host can enforce.
- **Hosted engine edge.** The `.NET Platform edge → Node engine workload` process boundary, proposed
  to follow W62: a generated JSON/HTTP service contract first, MCP as a projection, and one
  in-memory remote session before persistence, accounts, catalogue or metering.
- **More clients**, such as Discord.
- **Content tooling not yet built.** The visual node editor needs a design decision on where it
  lives, what it emits, and whether authored source or the built campaign is its file format.
  Content balancing tools are unbuilt. AI authoring assistants need a dependency decision, and
  W77's author-facing validator is their precondition.
- **Experiment attribution.** [06 §4](06-extensibility.md#4-the-composition-root) settles
  `SessionHost.experiments` as the already-resolved, non-null assignment map. The declaration and
  record-stamping implementation were last recorded as not yet brought into line with it.
- **Simulation balance.** Drift rates, scenario economics, `demandBand` thresholds and the
  housing-quality formula are placeholder numbers. Balancing is game-side; the engine owes the
  levers, which [§7.14](10-simulation-kind.md#714-remaining-campaign-physics-524) contracts and
  W117–W119 shipped.
- **Three `docs-template` hardening findings, to raise upstream**, from the automated review of
  [PR #3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3): the docs workflows pin
  the mutable `:latest` tag
  ([comment](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660515997));
  the link validator does not constrain resolved targets to the repository root
  ([comment](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660516002));
  and file enumeration walks excluded trees before filtering them
  ([comment](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660516006)).
- **The world-graph programme gate.** An immutable published package version must carry the
  replay-guarded third kind, so Sun Trap can install it without a sibling checkout. `v0.10.0` is
  tagged; publication is an external release action this ledger does not evidence.
- **The games' own Definitions of Done** live with the games:
  `games/life-in-the-fast-lane.md` and `games/bulgaria-adventure.md` in
  [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife).

## S121 — Hidden Outcomes Stay Hidden

Status: done
Delivers: A player, or a rival AI, reading what an action did sees only what the campaign meant
          them to see. A hidden variable's new value or a hidden message no longer arrives in the
          response, so no client can reveal it.
Touches: `src/engine/src/core/session/store.ts`, `src/engine/src/core/session/types.ts`,
         `20-contract.md` §7 and §12
Depends on: none
Acceptance:
  - S121.1 `submitAction` and `previewAction` return only `StateChange` and `OutcomeMessage`
    records whose `visible` is `true`, on accept and on reject. The whole serialized result
    contains no hidden record's value.
  - S121.2 The gate applies to every audience, `ai` included.
  - S121.3 The profile fold still reads the unfiltered result: an achievement unlocked by a
    `visible: false` change is recorded on the profile, and is absent from the returned changes.
  - S121.4 The MCP `choose` and `preview_action` tools carry the same filtered result. The review's
    probe campaign, a hidden story-graph variable set by a choice, leaks nothing through either.
  - S121.5 The pure engine's `ActionResult` is unchanged and still carries every record.
Out of scope: Filtering inside the engine, `Scene` or `PlayerView` (already projections), and
              the attempt counter and revision (S122).

## S122 — A Rejected Action No Longer Strands a Shared Session

Status: done
Delivers: A host running several engine instances over one database can tell a real collision
          from a rejected move. A player who submits an invalid action, or previews one, can keep
          playing, and a player who loses a genuine race refreshes once and continues from the
          winner's move.
Touches: `src/engine/src/core/session/store.ts`, `src/engine/src/core/session/types.ts`,
         `20-contract.md` §7.2
Depends on: S121
Acceptance:
  - S122.1 `StoredSessionRecord.revision` is `0` when `createSession`, `loadGame` or
    `branchSession` first writes a record, and rises by one on each accepted `submitAction`
    write. A rejected submission leaves it unchanged, so the next valid action commits under an
    adapter that holds §7.2's compare-and-swap rule.
  - S122.2 `previewAction` leaves it unchanged, with the same consequence.
  - S122.3 Two store instances over one compare-and-swap adapter: the losing write raises
    `concurrent_modification`, and its retry re-reads persistence and builds on the winning
    write.
  - S122.4 `storage_failure` restores the cached record and keeps it, without re-reading
    persistence. Every field the refused `put` carried is rolled back.
  - S122.5 A submission already queued behind a conflicted write is refused as well. It is never
    committed as a successor of the refused write.
  - S122.6 A record read from persistence is the store's own copy, so an adapter that returns its
    stored object by reference still compares correctly.
  - S122.7 §7.2 states the rule: compare `revision`, never `attemptCounter`.
Out of scope: Adventures' migration (a `revision` column, its compare-and-swap predicate, and the
              branded conflict). That lands in Adventures after an engine release.

## S123 — A Save Exists Only Once It Is Stored

Status: done
Delivers: A player whose save failed is never shown that save in their list or offered it to
          load, so a save that would vanish on the next restart is never presented as kept.
Touches: `src/engine/src/core/session/store.ts`, `20-contract.md` §7.2
Depends on: S122
Acceptance:
  - S123.1 When `saves.put` throws, `saveGame` raises `storage_failure`, and `listSaves` on the
    same instance does not include the refused save.
  - S123.2 `loadGame` of the refused save's id raises `unknown_save`.
  - S123.3 A fresh store instance over the same adapter agrees with S123.1 and S123.2.
  - S123.4 The session survives the failure: the next `saveGame` is durable, listed, and
    loadable from a fresh instance.
  - S123.5 `createSession`, `loadGame` and `branchSession` already write before caching. This was
    audited and left unchanged. §7.2 states the general rule: a failed write leaves no cache
    trace.
Out of scope: Bounding the save cache (S126/S127, D4).

## Landed

Ordered by id. *Criteria* is the range of numbered acceptance
criteria; units sliced before criteria were numbered show a dash. *Merge* is the merge commit of
the last pull request listed.

| Slice | Name | Pull requests | Criteria | Merge |
|---|---|---|---|---|
| <a id="w0"></a>W0 | CI and Documentation Gates | [#3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3), [#6](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/6) | — | [`98ccee9`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/98ccee99813d61b514f1048b87cce45dadb91776) |
| <a id="w1"></a>W1 | Core Contract Types and Module Skeleton | [#17](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/17) | — | [`f7d8f59`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/f7d8f598ef7e6591aa2184285bf5bc25a4525345) |
| <a id="w2"></a>W2 | RNG Handle and Stream Derivation | [#22](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/22) | — | [`9f90eae`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9f90eae1d8a00b95286da3ef99a64d128e7007dc) |
| <a id="w3"></a>W3 | Pure Engine Kernel | [#33](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/33) | — | [`7a46e57`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/7a46e5720c45d9b1c57d1958f875302ee6499ac9) |
| <a id="w3a"></a>W3a | Observability: Emitter, Events, and Sinks | [#34](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/34) | — | [`4567e43`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/4567e432a8eae80d2b0fb30f11427759875d1240) |
| <a id="w4"></a>W4 | Registry, Authoring Builder, Localization | [#35](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/35) | — | [`a7e9dc3`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a7e9dc3e1d60ad6ab792011c0ea424fbadc1e1ab) |
| <a id="w5"></a>W5 | Tiered Validation | [#36](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/36) | — | [`71ff9e8`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/71ff9e8858acc5de41aa099793e043021985ac30) |
| <a id="w6"></a>W6 | Projection | [#37](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/37) | — | [`b4d2af9`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b4d2af9575694a3bd1246b88c784ce48849af9e8) |
| <a id="w7"></a>W7 | Session Store | [#38](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/38) | — | [`10b4ce9`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/10b4ce9f96836741651399c0b332023fc1530317) |
| <a id="w8"></a>W8 | Profile Store | [#39](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/39) | — | [`d9af5d8`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/d9af5d8dbd0bc88829c8d43571aee92b874b2536) |
| <a id="w9"></a>W9 | Variables and Consequences | [#41](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/41) | — | [`9359a12`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9359a12d86014b8d6cbd9648ebbf07dfdfabba01) |
| <a id="w10"></a>W10 | Conditions and Requirements | [#43](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/43) | — | [`388f2dd`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/388f2dd4a2515cc414d30d2bb419c214acdfbbe4) |
| <a id="w11"></a>W11 | Nodes, Turn, and Settle | [#44](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/44) | — | [`6d85917`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6d8591728194881e34c1c6b53147b42cc20dbe0f) |
| <a id="w12"></a>W12 | Scene, Actions, Projection, Reason Codes | [#47](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/47) | — | [`9eb400a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9eb400ac9da2083fec4f17d699aad7cb74bff07f) |
| <a id="w13"></a>W13 | Endings and Achievements | [#51](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/51) | — | [`0fb7cff`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/0fb7cffe499b914c29250b8b817e5e348f2b0595) |
| <a id="w14"></a>W14 | Story-Graph Validation | [#55](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/55) | — | [`231683f`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/231683ffc50ef31e190c48612dfb7007f7e8f0dd) |
| <a id="w15"></a>W15 | The Bureaucracy Campaign and Broken Fixtures | [#60](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/60) | — | [`75fc64a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/75fc64a4887a026c6b5e46641540013f8f94aa58) |
| <a id="w16"></a>W16 | Text Client | [#63](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/63) | — | [`5d6e418`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/5d6e418ba435482262adf3fddecfbaf1cb0e44b3) |
| <a id="w17"></a>W17 | MCP Server | [#66](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/66) | — | [`74d81b7`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/74d81b7912b574c83ed0bc9ac3716a1b1dcd53ed) |
| <a id="w18"></a>W18 | Determinism Harness | [#70](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/70) | — | [`bf106d6`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/bf106d657295c4cc3c3d958c420f3be08a1dfd61) |
| <a id="w19"></a>W19 | MVP Acceptance | [#71](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/71) | — | [`dcb7803`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/dcb78038cbe8bb8e002f0651c9551b47ff874bb5) |
| <a id="w20"></a>W20 | Engine Versioning and Release Tags | [#73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73) | — | [`e26fa9d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e26fa9dbc9e1a2814443bfff952a15562b608dc8) |
| <a id="w21"></a>W21 | Replay Oracle: Outcome and the Runner | [#73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73) | — | [`e26fa9d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e26fa9dbc9e1a2814443bfff952a15562b608dc8) |
| <a id="w22"></a>W22 | Replay Oracle: The Corpus | [#73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73) | — | [`e26fa9d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e26fa9dbc9e1a2814443bfff952a15562b608dc8) |
| <a id="w23"></a>W23 | Replay Oracle: CI Wiring | [#73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73) | — | [`e26fa9d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e26fa9dbc9e1a2814443bfff952a15562b608dc8) |
| <a id="w24"></a>W24 | Core Spec Reconciliation | [#77](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/77) | — | [`f203325`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/f20332518331a6bd1714dcbd44156db7ad592d65) |
| <a id="w25"></a>W25 | Simulation Kind Seam Reconciliation | [#80](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/80) | — | [`399391b`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/399391b8e12a393fe11ec2aa4f67252168507b29) |
| <a id="w26"></a>W26 | Toolchain Upgrade | [#82](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/82) | — | [`0d3cbb1`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/0d3cbb1f693113ab65dcf360fbf7d4f95d277206) |
| <a id="w27"></a>W27 | Bulgaria Adventure: The Driving Arc | [#86](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/86) | — | [`25a9411`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/25a9411e3afea417e3235d439dc5b7853605e98a) |
| <a id="w28"></a>W28 | Bulgaria Adventure: The Return Arc | [#87](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/87) | — | [`c186f4d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/c186f4d02b3ccfe3fa5a77d650890b058b5973db) |
| <a id="w29"></a>W29 | Bulgaria Adventure: The Inheritance Arc | [#88](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/88) | — | [`265a1ca`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/265a1ca95ba0766405341bca20d04aad86d9c049) |
| <a id="w30"></a>W30 | Bulgaria Adventure: The Enterprise Arc | [#89](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/89) | — | [`d8d8821`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/d8d8821e6d8ae8965bedf9cea45d65036dbd2c66) |
| <a id="w31"></a>W31 | Save Migration | [#92](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/92) | — | [`588567d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/588567d2d4ff84f7b38a904b62c586b315122f07) |
| <a id="w32"></a>W32 | Simulation Kind: State Types | [#94](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/94) | — | [`fc1b29b`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/fc1b29b06a034ece06eab2735cdeb263cf9d5368) |
| <a id="w33"></a>W33 | Simulation Kind: Actor State | [#95](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/95) | — | [`2f0b7ea`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/2f0b7ea3a3079d7ba38b5c97f5a7a1713ae59cc0) |
| <a id="w34"></a>W34 | Simulation Kind: Content Definition Types | [#96](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/96) | — | [`9f157cb`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9f157cbdb768863601e4e462b7ce291b3d4db5de) |
| <a id="w35"></a>W35 | Simulation Kind: Resolution and Systems | [#97](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/97) | — | [`f1d7a21`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/f1d7a21cc2cd1bc29d777c9ebf11086cdd722fb6) |
| <a id="w36"></a>W36 | Simulation Kind: State, Variables, and the Plan | [#98](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/98) | — | [`4c80b05`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/4c80b054e344576504af40affe3d27d17c957ff3) |
| <a id="w37"></a>W37 | Simulation Kind: The Week | [#99](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/99) | — | [`0815702`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/08157023d778a792fab225f3a827b0d3d63922e7) |
| <a id="w38"></a>W38 | Simulation Kind: Content-Definition Types | [#100](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/100) | — | [`bdd07d6`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/bdd07d6ba14a08cc10ed01847c384c144641468c) |
| <a id="w39"></a>W39 | Simulation Kind: Wiring the "Stable Life" Vertical Slice | [#101](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/101) | — | [`1206daf`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/1206dafcbaf1556bba56e4b12ab27a58c3b45d0b) |
| <a id="w40"></a>W40 | Simulation Kind: The "Stable Life" Scenario, Validation, and Corpus | [#102](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/102) | — | [`9fdf77c`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9fdf77c63773ea0bc0ffc288fbba0995ee04c3ff) |
| <a id="w41"></a>W41 | Engine Consumer Boundary | [#108](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108) | — | [`db9c62a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/db9c62aec509ed083179a73ae2ec49b1b53d3d26) |
| <a id="w42"></a>W42 | World-Graph Runtime State Contract | [#116](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/116) | — | [`5f5f8f5`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/5f5f8f542f619e70b2a15d8952998e48d12766d1) |
| <a id="w43"></a>W43 | World-Graph Content Definition Contract | [#119](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/119), [#121](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/121) | — | [`4ab8b0a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/4ab8b0a73928a3320491c79afbd58837ca9e647a) |
| <a id="w44"></a>W44 | World-Graph Resolution Contract | [#120](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/120) | — | [`5eca57b`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/5eca57b9dc50b939fe55d7ef7a06edac9f38c346) |
| <a id="w45"></a>W45 | World-Graph Kind Skeleton and Immediate Actions | [#125](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/125) | — | [`c6662bb`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/c6662bb6b638e70348a133f8c028b2e18f26963c) |
| <a id="w46"></a>W46 | World-Graph Deterministic Tick Pipeline | [#128](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/128) | — | [`6301a49`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6301a497cc956c4e47df584c7b0b9d3c0455b71c) |
| <a id="w47"></a>W47 | World-Graph MVP Vertical Slice | [#131](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/131) | — | [`2390750`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/23907505b64042b9dbc744ba4edac0c53122c673) |
| <a id="w48"></a>W48 | Preview/Client Parity | [#133](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/133) | — | [`c81227d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/c81227dca661e028cd8b50ab7fbcffe9be09c2f6) |
| <a id="w49"></a>W49 | World-Graph Validation, Scenario and Replay Guard | [#134](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/134), [#138](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/138) | — | [`6e3d38e`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6e3d38e77d0e34686dc4e0956b2ff01da9b8af3d) |
| <a id="w50"></a>W50 | Simulation Kind: Projection and Client Parity | [#166](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/166) | W50.1–W50.8 | [`bb97138`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/bb971389a7fa888d1937d8390b2a24872dbbf0d9) |
| <a id="w51"></a>W51 | Simulation Kind: Derived Values, Modifiers, and Effects | [#194](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/194), [#204](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/204) | W51.1–W51.6 | [`6b573d3`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6b573d314bde4ce5c8466da49457a44f7b63bca5) |
| <a id="w52"></a>W52 | Simulation Kind: The Scenario Campaign and Full Validation | [#227](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/227) | W52.1–W52.6 | [`a9b7307`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a9b73078a0db1e69f9351a3c305fc9a25a2bdf96) |
| <a id="w53"></a>W53 | Simulation Kind: Employment and Income | [#228](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/228) | W53.1–W53.6 | [`4034606`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/403460677a6f3f4c4e5644e69f8a7040c07a1e92) |
| <a id="w54"></a>W54 | Simulation Kind: Education and Skills | [#230](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/230) | W54.1–W54.6 | [`bd163f9`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/bd163f91c58412013084c3829306a63d0d346f5d) |
| <a id="w55"></a>W55 | Simulation Kind: Housing, Debt, and Reconciliation | [#232](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/232) | W55.1–W55.6 | [`1e63ce5`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/1e63ce57e924724399f6077ced701fbef876ccd2) |
| <a id="w56"></a>W56 | Simulation Kind: Possessions, Places, and People | [#236](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/236) | W56.1–W56.6 | [`e20cfdb`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e20cfdbd5318ed08ea333695ba927de7cee26136) |
| <a id="w57"></a>W57 | Simulation Kind: Events, Opportunities, Headlines, and Achievements | [#265](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/265) | W57.1–W57.7 | [`9d69704`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9d69704dc45197fab7632aebc6654d16050d221d) |
| <a id="w58"></a>W58 | Content Pack Resolution and Content Identity | [#238](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/238) | W58.1–W58.8 | [`1dda794`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/1dda794480d671c4ae59f177e1304a6d719dd952) |
| <a id="w59"></a>W59 | Experiment Gates and the `ExperimentSource` Port | [#239](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/239) | W59.1–W59.6 | [`fffe42e`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/fffe42e79641b1ad9994eb7ca2bad9a8d77e2606) |
| <a id="w60"></a>W60 | A Second Locale, End to End | [#240](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/240) | W60.1–W60.5 | [`214a6cc`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/214a6cc7f51b19893299654060c8f53c1df081a3) |
| <a id="w61"></a>W61 | Public Playable Web Demo | [#183](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/183), [#184](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/184) | W61.1–W61.10 | [`cd75c37`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/cd75c3783bd8afd75cacae6a699e6ae4906f2488) |
| <a id="w62"></a>W62 | Platform Static Host Image | [#264](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/264) | W62.1–W62.9 | [`6013c69`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6013c69fe0174374bd1182aa66c46cc3a70a224b) |
| <a id="w63"></a>W63 | Absurd Game Interface | [#188](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/188), [#190](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/190) | W63.1–W63.10 | [`a94da4b`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a94da4bf5eb5bdbd108c4e9b64abb6f1322592a3) |
| <a id="w64"></a>W64 | Replayable Story Campaign Expansion | [#189](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/189), [#191](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/191) | W64.1–W64.13 | [`c1db016`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/c1db0160acb047a70fb93612d7951256e2d58fe8) |
| <a id="w65"></a>W65 | Browser Test Harness for the Site | [#201](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/201) | W65.1–W65.8 | [`8e9378d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/8e9378d82c52f692b3ce6acae798137f289f6bab) |
| <a id="w66"></a>W66 | The Play Surface on a Phone | [#205](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/205) | W66.1–W66.12 | [`a115098`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a115098a131b3d5a511048bfc27391325d937c9b) |
| <a id="w67"></a>W67 | Restore the Story-Graph Regression Evidence | [#261](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/261) | W67.1–W67.7 | [`ce90041`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/ce900416b948ed268b236f67584066878f778acc) |
| <a id="w68"></a>W68 | Make the Browser Save Adapter Actually Restore | Cancelled — [#271](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/271) | W68.1–W68.7 | — |
| <a id="w69"></a>W69 | Consume the Reusable Landing-Page Package | [#272](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/272) | W69.1–W69.8 | [`38b7c34`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/38b7c34eaddf2c35d8fbbaa7c5d8e3da30451e6d) |
| <a id="w70"></a>W70 | Gate `/play/`'s Startup Request Surface | Cancelled — [#271](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/271) | W70.1–W70.6 | — |
| <a id="w71"></a>W71 | The Bulgaria Culture Pack: Mechanism and Voice | [#314](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/314) | W71.1–W71.6 | [`f0d1fee`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/f0d1fee3ef28b4d4eab3bd9033795cf7de8cd6d9) |
| <a id="w72"></a>W72 | The Bulgaria Culture Pack: The Full Setting | [#317](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/317) | W72.1–W72.5 | [`66075df`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/66075df095bc61d3cb9528ce0caaabdf11cdd547) |
| <a id="w73"></a>W73 | Tier 3 Validation as an Author-Facing Check | [#319](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/319) | W73.1–W73.6 | [`1bdb5b6`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/1bdb5b6a40e56fe70ba8faebd3f1e7b33b23ddf5) |
| <a id="w74"></a>W74 | Campaign Content Ownership: The Authoring Seam | [#298](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/298), [#299](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/299), [#332](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/332) | W74.1–W74.8 | [`cbbe0cd`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/cbbe0cde444788050e0a9def90b7fd9bf450b607) |
| <a id="w74a"></a>W74a | The Bureaucracy Fixture, Frozen Byte-for-Byte | [#333](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/333) | W74a.1–W74a.5 | [`7cb09a0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/7cb09a07a51514deef178b4273481d8a34dd8e74) |
| <a id="w74b"></a>W74b | Retire the Engine's Own Play Surface | [#335](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/335) | W74b.1–W74b.6 | [`5c26ab0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/5c26ab0530b4746b69938735c8c80710feebb7ff) |
| <a id="w74c"></a>W74c | The Breaking Ownership Release | [#336](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/336) | W74c.1–W74c.7 | [`3fee866`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/3fee866fbaac51b90b9f7a297f320f1062a71456) |
| <a id="w75"></a>W75 | Classified Persistence Conflicts | [#311](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/311) | W75.1–W75.7 | [`6f5adb4`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6f5adb47531fb1929d0e03c98b573cf3abb7fe0c) |
| <a id="w76"></a>W76 | A Folded Registry Keeps Its Resolution | [#337](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/337) | W76.1–W76.10 | [`b1cd9be`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b1cd9bed82fb32daf31707d144d84f8e2164066a) |
| <a id="w77"></a>W77 | Tier 1 and Tier 2 as an Author-Facing Check | [#338](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/338) | W77.1–W77.7 | [`6dd7b4f`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6dd7b4f4453b5856a3f9e43e5a52931921b63dd6) |
| <a id="w78"></a>W78 | Localization Coverage and String Extraction | [#340](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/340) | W78.1–W78.6 | [`77e35c7`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/77e35c7761864a2b05585dd6b282d2b4c89b5b65) |
| <a id="w79"></a>W79 | What Changed Between Two Resolutions | [#342](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/342) | W79.1–W79.6 | [`b6f8bb2`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b6f8bb288452b804022f070026f84d13f6b4a98f) |
| <a id="w80"></a>W80 | Seeing a Story Graph | [#343](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/343) | W80.1–W80.6 | [`1ba588e`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/1ba588e30eb0140a02754f804bf85125fd6c16d9) |
| <a id="w81"></a>W81 | Construction Finishes What `build` Starts | [#345](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/345) | W81.1–W81.10 | [`b589b6c`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b589b6c58f5c10b28dddd5579686b63c8ed7d79b) |
| <a id="w82"></a>W82 | A Kiosk That Ran Out Can Be Refilled | [#347](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/347) | W82.1–W82.8 | [`aa56f77`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/aa56f7799d3a8d311d9b8f2378c85d61a3414cf0) |
| <a id="w83"></a>W83 | Buildings Get Dirty, Wear Out, and Break | [#348](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/348) | W83.1–W83.7 | [`04c1baf`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/04c1baf19f93f740e01b54a38925e7edbabe3dcd) |
| <a id="w84"></a>W84 | Incidents That Happen On Their Own | [#360](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/360) | W84.1–W84.9 | [`8fdded3`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/8fdded3afdacf133fbdf8d23dd32d07e17082125) |
| <a id="w85"></a>W85 | The Resort Tells You What Needs Attention | [#361](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/361) | W85.1–W85.10 | [`3ea878e`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/3ea878e0d318f498646620a28f6b59f268606f10) |
| <a id="w86"></a>W86 | The Story-Graph Kind Says Why | [#362](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/362) | W86.1–W86.7 | [`450935c`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/450935cc1b0a24b09a98b5d9476890e36192a1e4) |
| <a id="w87"></a>W87 | The World-Graph Kind Says What Its Ticks Did | [#363](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/363) | W87.1–W87.7 | [`24641e0`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/24641e0e625b3d96d41c5b73640d8be9a35dd9b0) |
| <a id="w88"></a>W88 | The Simulation Kind Nobody Outside the Package Can Use | [#367](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/367) | W88.1–W88.6 | [`8115478`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/8115478aa9caefa5d53596c32f3348e6167601c0) |
| <a id="w89"></a>W89 | A Game-Length Life | [#376](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/376) | W89.1–W89.8 | [`71e7364`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/71e7364c85cb68e0115a95b9c960263dbb0ed9bb) |
| <a id="w90"></a>W90 | Canonical and Public Truth | [#377](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/377) | — | [`274fa6e`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/274fa6e492defd5634a6c35972b47a199802366d) |
| <a id="w91"></a>W91 | Reproducible Package and Release Gate | [#379](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/379) | — | [`63a0c12`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/63a0c1231f582f2b05632a11a37188e3b8fd1537) |
| <a id="w92"></a>W92 | Local and CI Gate Health | [#378](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/378) | — | [`fab72b1`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/fab72b1cd3fed40d71d80fd7144863543b2d5fcb) |
| <a id="w93"></a>W93 | World-Graph Spatial and Audit Correctness | [#398](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/398) | W93.1–W93.6 | [`f0735fc`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/f0735fc59fcfd879911771fefdeb1f41cc90f252) |
| <a id="w94"></a>W94 | Simulation Resolution Correctness | [#400](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/400) | W94.1–W94.7 | [`e103de6`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e103de63996c6005aaae3f251e8c5267010ac72e) |
| <a id="w95"></a>W95 | Effect and Audit Semantics | [#403](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/403), [#404](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/404) | W95.1–W95.7 | [`6c1fb4f`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6c1fb4f6c5043e912cf72e8660cb0ccef653098a) |
| <a id="w96"></a>W96 | Mechanical Regression Boundaries | [#408](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/408) | W96.1–W96.7 | [`bb62ffe`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/bb62ffe83ac920ceeb8db7ce16e6d4516f8336e7) |
| <a id="w97"></a>W97 | Immutable Projections and Shared Pipelines | [#409](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/409) | W97.1–W97.6 | [`b9ecdc2`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b9ecdc274c0bf093dc235b4e08776bd666f6a6fe) |
| <a id="w98"></a>W98 | Catalog and Projection Completeness | [#414](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/414) | W98.1–W98.7 | [`d7ca8eb`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/d7ca8eb9886cd9cfe0b38e7780d73d18d9730c5f) |
| <a id="w99"></a>W99 | Session Lifecycle Operations | [#416](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/416) | W99.1–W99.8 | [`51ad81a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/51ad81af88a16d84b24ce8b6e77b7e80ac575e14) |
| <a id="w100"></a>W100 | Campaign-Tunable Weekly Rules | [#419](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/419) | W100.1–W100.7 | [`3d496b3`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/3d496b3fdb8e705f31632980890f9bf42884bf77) |
| <a id="w101"></a>W101 | Projects, Businesses, and Rival Scarcity | [#421](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/421) | W101.1–W101.8 | [`b595fe2`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/b595fe2e7e7e92e9c3e62715998b2a7fe89bfa22) |
| <a id="w102"></a>W102 | Profile Chains and Simulation Save Migration | [#423](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/423) | W102.1–W102.8 | [`6e4a7bb`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/6e4a7bb855ac3559953594104d71cc7f4f304390) |
| <a id="w103"></a>W103 | Companion Contracts and Ownership Reconciliation | [#424](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/424), [#427](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/427), [#451](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/451) | W103.1–W103.8 | [`e52e7a1`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e52e7a104311c3afa431d412f3ef8f778d402ba1) |
| <a id="w104"></a>W104 | Release 0.11 Compatibility Sweep | [#447](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/447), [#448](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/448) | W104.1–W104.7 | [`9ece598`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9ece598028240b7541ad6fc16a1041a2fb669f48) |
| <a id="w105"></a>W105 | Documentation and Landing Publication Review | [#455](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/455) | W105.1–W105.7 | [`9439b99`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9439b99a2c9f2d2263a0c2ce03c0b73a3b883180) |
| <a id="w106"></a>W106 | Tracker Evidence Closure | [#456](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/456) | W106.1–W106.7 | [`865f827`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/865f827b050eb92ca1894a8e89e743ae5112e41b) |
| <a id="w107"></a>W107 | 0.11 Release Candidate Verification | [#460](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/460), [#461](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/461) | W107.1–W107.7 | [`a84d9c9`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a84d9c99824b7cc9ca4f7735961a3a4fdf7b814d) |
| <a id="w108"></a>W108 | Publish 0.11 Readiness | [#471](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/471), [#474](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/474), [#475](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/475) | W108.1–W108.6 | [`651a2a4`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/651a2a4ea87a3d8fb0dab70d0a7337d7e8b8270c) |
| <a id="w109"></a>W109 | A Uniform That Makes Its Wearer More Employable | [#478](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/478) | W109.1–W109.6 | [`a2850f4`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a2850f40d24f516243a71055375b5937c746bbd4) |
| <a id="w110"></a>W110 | An NPC Who Already Remembers You | [#479](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/479) | W110.1–W110.4 | [`85f59c5`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/85f59c55f19c35e1841469bf607a9e150bb2b824) |
| <a id="w111"></a>W111 | Conditions That Can Ask "Do You Own One?" | [#481](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/481) | W111.1–W111.6 | [`ef8abff`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/ef8abffdf7aff049a26f20cf36cfeaa58a95c217) |
| <a id="w112"></a>W112 | A Car That Costs Money to Run | [#490](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/490) | W112.1–W112.6 | [`a431ed2`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/a431ed2c29e3a3d8f71b838b35b4a5dba8b4b9ab) |
| <a id="w113"></a>W113 | Utilities and Transport on the Weekly Bill | [#491](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/491) | W113.1–W113.7 | [`aadb482`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/aadb482a493a0e2e75b3c402370f83846243096d) |
| <a id="w114"></a>W114 | The NPCs Are Actually There | [#495](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/495) | W114.1–W114.5 | [`7d8850d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/7d8850df21d99d6b224d38fea6b9cd720e3d3e38) |
| <a id="w115"></a>W115 | A Resort a Client Can Actually Draw | [#518](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/518) | W115.1–W115.11 | [`8e13420`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/8e13420fb16c3ee765ac209c66d2939c91b484a8) |
| <a id="w116"></a>W116 | A Campaign Cannot Ask About a Field Its Collection Lacks | [#538](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/538) | W116.1–W116.8 | [`7fc2237`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/7fc2237aa0d80df87c284409a182ff41b3eff93d) |
| <a id="w117"></a>W117 | Two Campaigns, One Lever, Different Weeks | [#542](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/542) | W117.1–W117.7 | [`19442c4`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/19442c4ae46d5842011a629a900eb3449a61e344) |
| <a id="w118"></a>W118 | The Week's Own Rules Belong to the Campaign | [#544](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/544) | W118.1–W118.7 | [`c187ee6`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/c187ee6fc655c6b2f22634a745518d48218031a2) |
| <a id="w119"></a>W119 | Every Fixed Action Price Is the Campaign's | [#548](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/548) | W119.1–W119.7 | [`5435b74`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/5435b742b52f9bcaf69455a6da7fe1e93d8ff2ac) |
| <a id="w120"></a>W120 | One Campaign Can Include Another | [#568](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/568) | W120.1–W120.10 | [`7081402`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/7081402c6dccc277b23250d44a22b022a16fd683) |
