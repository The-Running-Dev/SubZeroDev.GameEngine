---
sidebar_label: Extensibility
---

# Extensibility — Ports and Seams

**Document status:** Revision 1 — new contract, MVP scope

**Reading order:** after [`04-core.md`](04-core.md), whose types this organises, and
alongside [`05-observability.md`](05-observability.md), whose `Emitter` is the worked
example every port here follows.

> **Scope of this document**
>
> Where the engine can be extended, by whom, and the single rule that decides. It names
> the **ports** a host may supply, the one place they are supplied, and what is
> deliberately not open.
>
> It does **not** reopen [`02-architecture.md`](02-architecture.md) §1 decision **N2**.
> Kinds remain engine-owned code; §7 says what that does and does not permit.

---

## 1. What This Is, and What It Is Not

**This is not a plugin system.** There is no manifest, no loader, no dynamic discovery, no
marketplace. Adding an extension means writing an implementation and passing it in at
construction — a compile-time decision, reviewed like any other code.

That is the honest scope, and it is chosen rather than settled for. A general plugin
system solves a problem this platform does not yet have, and the shape it tends to grow
into — a rules language expressive enough for arbitrary third-party behaviour — is the one
architecture §1 explicitly identifies as "where narrative engines die."

**What it is:** a stated set of **ports** — interfaces the engine depends on and a host
supplies — so that swapping persistence, observability, or identity is a documented
one-line change rather than an archaeology exercise.

> **Why this document exists at all, given nothing is currently blocked.** Three seams
> already existed before it, and they were supplied three different ways: a registry
> (`KindRegistry`, `ContentRegistry`), a constructor parameter (`Emitter`, 05 §4), and
> "implement the interface and wire it yourself" (`SessionStore`, `ProfileStore`, 04 §7).
> Adding a fourth meant picking one of three conventions arbitrarily. That inconsistency
> is what makes an engine feel closed — not the absence of a loader.

---

## 2. The Rule

One rule decides every question in this document:

> **A host may supply anything that cannot change `serialize()` output.**

Everything else follows. The rule is not a guideline: it is checkable by the determinism
harness already specified in 04 §14 and 05 §12, because "cannot change `serialize()`
output" is exactly what those fixtures assert.

Its consequence is the useful part:

**The determinism boundary is the trust boundary.** They are the same line. Code that
cannot affect replay also cannot affect the outcome of a game, so it needs no sandbox, no
capability system, and no review beyond ordinary engineering. Code that *can* affect replay
needs all three — which is why it is not open (§7).

That equivalence is what makes this document short. There is no risk gradient to manage,
no partial trust to model. A seam is on one side of the line or the other.

---

## 3. The Seam Map

| Seam | Side | Open to a host? | Contract |
|---|---|---|---|
| `Kind` | **Inside** — is the game logic | **No** — engine-owned (§7) | 04 §3 |
| `Condition` operators | **Inside** — evaluated during resolution | **No** — frozen set | 04 §18 |
| `IdSource` | Outside — values enter state but are opaque to it | **Yes** | §5.1 |
| `SessionStore` | Outside — holds serialized blobs | **Yes** | §5.2 |
| `ProfileStore` | Outside — durable, beside the session store | **Yes** | §5.2 |
| `Emitter` | Outside — write-only, returns `void` | **Yes** | 05 §4 |
| `Clock` | Outside — boundary only, never reaches the core | **Yes** | §5.4 |
| Clients | Above everything — presentation only | **Yes**, no registration needed | 02 §1 |
| Campaigns, content packs | Data, validated in tiers | **Yes**, already the content path | 04 §10.1 |

Two entries are worth reading twice.

**`IdSource` is inside-looking but outside the line.** A `gameId` is written into the
envelope and therefore into `serialize()` output, which looks like a violation. It is not:
the engine never *interprets* the value, never branches on it, and never derives anything
from it. Replay determinism is a property of a fixture holding its inputs fixed, and
`gameId` is an input like `seed`. §5.1 makes that explicit rather than leaving it to be
inferred.

**`Clock` never crosses into the core at all.** The core has no clock and the eslint guard
enforces it (04 §2). The port exists so the *boundary* — the session store, stamping
records (05 §6) — has a seam a test can freeze, not so the engine gains a way to ask the
time.

---

## 4. The Composition Root

Every port is supplied in exactly one place, in exactly one shape.

```typescript
interface EngineHost {
  readonly kinds: KindRegistry;          // 04 §4 — engine-owned, not host-extensible (§7)
  readonly registry: ContentRegistry;    // 04 §10.1
  readonly ids?: IdSource;               // §5.1 — defaults to a random source
  readonly emitter?: Emitter;            // 05 §4 — defaults to nullEmitter
}

function createEngine(host: EngineHost): Engine;
```

Stores are composed one layer out, because they sit above the pure engine (04 §1):

```typescript
interface SessionHost {
  readonly engine: Engine;
  readonly sessions: SessionStore;       // §5.2
  readonly profiles?: ProfileStore;      // §5.2 — omitted → anonymous-only (04 §7.1)
  readonly clock?: Clock;                // §5.4 — defaults to the system clock
}

function createSessionLayer(host: SessionHost): SessionStore;
```

**Three rules make this uniform, and they are the whole convention:**

- **Every port is an interface, supplied by value.** Never a subclass, never a mutated
  global, never a module the engine imports by name. The dependency arrow keeps pointing
  inward (04 §1.1).
- **Every optional port has a default that works.** An embedder who supplies nothing gets a
  functioning engine. Optionality is what keeps the surface honest: a port nobody can
  usefully default is probably not a port.
- **A port is supplied once, at construction, and never swapped afterwards.** Replacing a
  store mid-session is not a supported operation, and permitting it would make every
  invariant in 04 conditional on when it was asked.

> **Why two roots rather than one.** The split mirrors 04 §1's two layers exactly. The pure
> engine must be constructible with no I/O at all — that is what makes the determinism
> harness able to run it (04 §14) — so anything doing I/O has to be composable *around* it
> rather than *into* it. One combined root would let a store be handed to the pure engine,
> which is the coupling the two-layer split exists to prevent.

---

## 5. The Port Catalogue

### 5.1 `IdSource` — the one that was missing

```typescript
interface IdSource {
  /** A new game id. Opaque to the engine: never parsed, compared, or derived from. */
  newGameId(): string;
  /** A new seed, when NewGameConfig omits one (04 §7). */
  newSeed(): string;
}
```

**This port closes a real gap rather than anticipating one.** `gameId` was declared on the
envelope (04 §2) and consumed by `createGame` (04 §4), but no document said where the value
came from; `seed` was only "store-generated", with no named mechanism. Those are the
**only two non-deterministic value sources in the engine**, and neither was a seam.

Three things follow from naming it:

- **`createGame` becomes testable.** With a counting `IdSource`, a fixture produces the
  same envelope every run — including `gameId` — which is what lets a golden file cover
  game creation instead of starting one action later.
- **The observability stream comparison gets simpler.** 05 §5 has to normalize `gameId`
  out of a golden event stream precisely because it is unpredictable. Under a fixed
  `IdSource` it is predictable, and the normalization becomes a convenience rather than a
  requirement.
- **A host that needs ids to mean something can have that.** ULIDs for sortability, a
  namespaced id for a multi-tenant deployment. The engine does not care, and the rule in §2
  is why it can afford not to.

The default is a random source. **It is the one place in the platform where randomness is
correct** — a fresh game genuinely should not be predictable — and it lives outside the
pure engine, so the determinism guard's ban on `Math.random` under `src/core/` stands
unqualified.

### 5.2 `SessionStore` and `ProfileStore`

Both are already defined (04 §7, §7.1). This document changes nothing about their shape; it
states that they are **ports** — the in-memory implementations the MVP ships are a default,
not the contract.

A host may supply Postgres, Redis, SQLite, or a file. The obligations are the ones 04
already implies, collected here so an implementer has them in one place:

- **Persist the canonical serialization, not live objects** (04 §7). A store that keeps
  object graphs will drift from what `deserialize` accepts.
- **Never write host metadata into `GameState`.** Timestamps, owner ids, and tenancy live
  on the store's own record (04 §2, §7).
- **A failed profile write must not roll back a game action** (04 §7.1). The game is the
  system of record; the profile is a projection of it.
- **A missing or corrupt profile degrades to "no achievements"**, never to a broken game
  (04 §7.1, 03 §7).

### 5.3 `Emitter`

Specified in full at [`05-observability.md`](05-observability.md) §4 and §10. It is listed
here because it is the **precedent** every other port follows: an interface, supplied at
construction, defaulted to a no-op, returning `void` so nothing about the host can reach
the game.

An OpenTelemetry exporter is an `Emitter` at the boundary — which is why 05 §13 can defer
it as an adapter rather than a redesign.

### 5.4 `Clock`

```typescript
interface Clock {
  /** ISO-8601 now. Boundary only — the core never receives this port. */
  now(): string;
}
```

Used by the session store for record timestamps and by the observability boundary for
`emittedAt` (05 §6). It exists so those can be frozen in a test, and so the single place
the platform reads a clock is a named one.

**It is deliberately absent from `EngineHost`.** Handing a clock to the pure engine would
make `Date.now` reachable from inside the determinism boundary through a supported API —
undoing by convenience what the eslint guard enforces by rule.

---

## 6. Adding a Port

The checklist, so a future seam does not invent a fourth convention:

1. **Establish which side of §2's line it is on.** If a host implementation could change
   `serialize()` output, it is not a port. Stop.
2. **Define it as an interface** in the `composition` module (04 §1.1), not beside its
   first consumer.
3. **Give it a default that works**, and make the field optional.
4. **Add it to the relevant root** — `EngineHost` if the pure engine needs it,
   `SessionHost` if only the boundary does.
5. **State the implementer's obligations**, as §5.2 does. An interface without them is a
   shape, not a contract.
6. **Add a determinism assertion**: a fixture replays byte-identically under the default
   implementation and under a deliberately different one. This is the executable form of
   step 1, and it is what catches a port that turned out to be inside the line.

---

## 7. Kinds Stay Engine-Owned

A new **kind** — a new category of game — is an engine feature. It is written in this
repository, under `kinds/`, reviewed and compiled in, exactly as `simulation` will be
alongside `story-graph`. That is not a restriction on what the platform can host; it is a
statement about who writes it.

Architecture §1 decision **N2** settled this, and nothing here disturbs it:

> downloadable code kinds put arbitrary code inside a hosted deterministic engine, a
> security and reproducibility hazard. Engine-owned kinds draw the clean line: **kind =
> code (engine-owned), campaign = data (author-owned).**

The reasoning is §2's rule read from the other end. A kind's `advance` *is* the game
logic — it is as far inside the determinism boundary as code can be. Third-party code
there could call a clock, draw unseeded randomness, or diverge across engine versions, and
byte-identical replay would stop being a property the platform can assert.

**What this permits, and what it does not:**

| Want | Path | Needs |
|---|---|---|
| A new game of an existing kind | A campaign — data | Nothing new |
| A new *type* of game | A kind, in-tree | Ordinary engine work |
| Different storage, logging, ids | A port (§5) | Nothing new |
| A stranger's kind, unreviewed | — | Reopening N2 (§9) |

Only the last is blocked, and it is blocked deliberately.

---

## 8. Keeping the Door Open, Cheaply

Third-party extension is **not** decided against forever — N2 rejected one *mechanism*
(downloadable code kinds) for stated reasons, and a different mechanism with a real sandbox
is a decision that can be revisited. The conventions above are chosen so that revisiting it
later costs no rework:

- **Interfaces, not inheritance**, so an implementation can be replaced by one that
  forwards across a sandbox boundary without changing a caller.
- **All host code outside the determinism boundary**, so the trust boundary is already
  drawn in the right place. Opening up later means sandboxing exactly *one* seam — kinds —
  rather than auditing every seam at once.
- **Ports are versioned with the contracts that own them** (04 §10.2's `formatVersion`
  discipline), so an out-of-tree implementation can state what it was built against.

That is the whole insurance policy, and it is close to free. What is deliberately *not*
being built now is the sandbox, the manifest, the loader, and the capability model — none
of which has a consumer, and all of which are cheaper to design against a real requirement
than against an imagined one.

---

## 9. What Is Deferred

Named so the omissions are decisions rather than gaps:

- **Third-party kinds, and the sandbox they require.** A WASM host with a deterministic
  ABI — no clock, no ambient float nondeterminism, fuel-metered — is the shape that could
  satisfy §2's rule. It reopens N2 and changes the platform's security model, so it belongs
  in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) with its cost stated, not in a spec.
- **Dynamic loading and manifests.** Compile-time composition is sufficient for
  first-party extension and has no discovery problem to solve.
- **A localization source port.** String tables come from the content registry (04 §10.1)
  today. Worth a port when a host needs strings from somewhere else; not before.
- **Capability declaration and per-port permissions.** Meaningful only once code is
  supplied by someone who is not trusted, which is the first item.
