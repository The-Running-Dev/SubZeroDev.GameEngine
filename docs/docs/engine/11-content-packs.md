---
sidebar_label: Content Packs
---

# Content Packs — Resolution and Identity

**Document status:** Revision 1 — new contract, post-MVP

**Reading order:** after [`04-core.md`](04-core.md) §10.1, whose `ContentRegistry` this
extends, and [`02-architecture.md`](02-architecture.md) §4a, which promises the capability
this specifies.

> **Scope of this document**
>
> How a set of content packs resolves into the single frozen `ContentRegistry` the engine
> runs against — merge, override, dependency — and the identity that keeps a game
> reproducible when its content came from several packs.
>
> It does **not** specify authoring. `04-core` §10.1 already does: `AuthoredText`,
> per-kind source types, the pure builder, and the rule that parsing and files live outside
> the engine.

---

## 1. The Gap This Closes

`02-architecture` §4a states that content packs are the platform's customization story and
"the volume play": one kind, many settings, no engine change. It is the capability the
project set out to support.

**`04-core` §10.1 does not model it.** The registry is `campaigns` and `strings` — no pack,
no manifest, no ordering, no dependency. The mechanism §4a points to lives in
`games/04-engine-specification.md` §4.1–4.2, one of the genuinely-still-upstream references
(04, *Reused, not re-derived*).

So the architecture promises something the contract cannot express. This document is the
contract, and it changes `ContentRegistry` in exactly one way — §4.

---

## 2. What a Pack Is

```typescript
interface ContentPack {
  readonly id: string;                       // stable published id (04 §17)
  readonly version: string;
  readonly kindId: KindId;                   // a pack targets exactly one kind
  readonly dependsOn: readonly PackRef[];    // §5
  readonly campaigns: readonly BuiltCampaign[];   // 04 §10.1 — already the built form
  readonly strings: ReadonlyMap<LocKey, string>;
}

interface PackRef { readonly id: string; readonly version: string; }
```

A pack carries **built** campaigns, not source. Authoring happens first and produces
`BuiltCampaign` (04 §10.1); a pack is a distribution unit of the result. That keeps the
authoring boundary exactly where it is and means pack resolution never parses anything.

**A culture pack is not a distinct type.** 02 §4a calls out culture packs — a wholesale
reskin and relocalization — as the motivating case, but structurally it is a content pack
whose contribution is mostly `strings`. Giving it its own type would add a concept the
resolver would then have to special-case for no gain.

---

## 3. Resolution

Packs resolve to a registry by a **pure, ordered fold**:

```typescript
function resolvePacks(packs: readonly ContentPack[]): ResolvedRegistry;
```

The order is the caller's, and it is significant — later packs override earlier ones. Three
rules govern what "override" means, and they are deliberately different per collection:

| Collection | Rule on collision |
|---|---|
| `campaigns` | **Whole-campaign replace**, keyed by `campaign.id`. Never a field-level merge |
| `strings` | **Per-key replace.** This is what makes a culture pack work |
| `dependsOn` | Not merged — resolved before the fold (§5) |

> **Why campaigns replace wholesale and strings replace per key.** They are the two halves
> of §4a's promise and they need opposite rules. A culture pack must be able to restyle
> *one line* without restating a campaign, so strings merge finely. But a campaign is a
> validated graph — nodes referencing nodes, requirements referencing variables (03 §11) —
> and a field-level merge across packs can produce a campaign neither pack validated, whose
> dangling reference appears only at play. Wholesale replacement means what runs is always
> something a pack author validated as a unit.

**Resolution is pure and total.** It performs no I/O, and it either produces a registry or
fails with a list of conflicts — never a partial one. The result is validated (04 §11) and
frozen exactly as a single-campaign registry is today; the engine cannot tell how many packs
it came from, which is the point.

---

## 4. The One Change to `ContentRegistry`

```typescript
interface ContentRegistry {
  readonly campaigns: ReadonlyMap<string, Campaign>;
  readonly strings: ReadonlyMap<LocKey, string>;
  readonly resolution: ResolutionId;          // NEW — §6
}

type ResolutionId = string;
```

Nothing else. The engine still sees campaigns and strings; `resolution` exists so a game can
say what content it ran against (§6), and is otherwise inert.

---

## 5. Dependencies

`dependsOn` names packs a pack requires, by id **and version**. Resolution:

1. **Topologically sorts** the requested set with its transitive dependencies.
2. **Fails on a cycle** — packs are content, and a content cycle has no meaningful fold.
3. **Fails on a version conflict** — two packs requiring incompatible versions of a third is
   an error, not something to resolve by picking one.

> **No version-range solving.** `PackRef` is an exact `{id, version}`. Ranges invite a
> solver, a solver invites backtracking, and a backtracking resolver is a source of
> non-determinism in the one place this platform can least afford it: which content a game
> ran against. If two packs genuinely need different versions of a third, that is a content
> decision for a human, made once, not an algorithm's job to paper over at load.

---

## 6. Identity, and Why Determinism Needs It

This is the part that is not obvious, and it is the reason this document is a contract
rather than a convention.

`GameState` records `campaignId` and `campaignVersion` (04 §2). Under packs, **that is no
longer enough to identify what was played.** A culture pack can replace a string a node
displays, or replace a whole campaign, while `campaignId` and `campaignVersion` stay
identical. Two players on the same campaign version, with different packs resolved, are
playing different games — and a replay of one against the other's registry would diverge
with nothing in the envelope to explain it.

**Two options, and only one of them is workable.**

Adding a pack list to `GameState` fails immediately: it is unbounded, it is host
configuration rather than game state, and it breaks the envelope's rule that identity fields
live in exactly one place (04 §2).

**So `campaignVersion` identifies the resolution, not the pack.** `resolvePacks` computes a
`ResolutionId` — a canonical digest over the ordered `{id, version}` list — and stamps the
`Campaign.version` of every campaign it produces with it. A game therefore records a version
that is unique to the *content it actually ran against*, and:

- **The envelope is unchanged.** No new field, no new rule.
- **Replay is honest.** Loading a fixture whose `campaignVersion` no longer resolves is
  `unrunnable: campaign_version_missing` — the verdict 07 §6 already defines, now reachable
  for the reason it was written for.
- **A migrated save stays `replayCompatible: false`** (04 §10.2) on exactly the same
  grounds.

> **The cost, stated plainly:** re-ordering packs changes every campaign version, so every
> existing save becomes a different version of the content. That is correct — the content
> genuinely did change — but it means pack order is not a knob to fiddle with on a live
> deployment, and a host that reorders should expect saves to require migration.

---

## 7. Validation

Pack resolution adds three checks to the tiered validator (04 §11):

| Tier | Check |
|---|---|
| 1 | A pack's `kindId` matches every campaign it carries; a `dependsOn` names a pack present in the set; no cycle |
| 1 | No campaign id collides *within* one pack — across packs is an override, within one is an authoring error |
| 2 | A pack overrides a campaign or string that no earlier pack supplied — legal, and almost always a typo |

That last one earns its place: a culture pack whose key is misspelled silently contributes
nothing, and the failure is invisible at play — the original string simply renders.

---

## 8. What Is Deferred

- **Pack discovery and distribution.** How a host finds packs is its business; resolution
  takes an ordered array and does not care where it came from.
- **Partial or lazy loading.** The registry is frozen and pre-validated before the engine
  sees it (04 §10.1), which a lazily-loaded pack would break.
- **Community submission and trust.** A pack is data and is validated like any other content
  (02 §4a), so it needs no sandbox — but *who may publish one* is a hosting question, and
  sits with the third-party discussion in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).
- **Per-locale pack splitting.** The MVP ships one locale (04 §10.1). A locale-only pack is
  already expressible as a pack contributing nothing but `strings`.
