---
sidebar_label: Session Capture
---

# Session Capture — Turning a Played Session Into a Fixture

**Document status:** Revision 1 — new contract, post-MVP, gated on the hosting layer

**Reading order:** after [`07-replay.md`](07-replay.md), which defines the fixture this
produces and the oracle that consumes it. [`05-observability.md`](05-observability.md) §3.2
sets the privacy rule this extends.

> **Scope of this document**
>
> How a session played on a real deployment becomes a `ReplayFixture` — what is taken, what
> is refused, when it may be taken at all, and how long it lives.
>
> It is **mostly a privacy contract**, not a mechanical one. The mechanics are already
> settled by 07; nothing new is needed to *replay* a captured session. What needs deciding
> is what may be captured from a person and kept.

---

## 1. Why This Is Separate From Replay

07 §9 deferred this deliberately, and the reason holds: the two share a runner and almost
nothing else.

| | Replay oracle (07) | Session capture (here) |
|---|---|---|
| Input | Fixtures **you wrote** | Sessions **someone played** |
| Risk | A false positive wastes an afternoon | A mistake exposes a person's behaviour |
| Blocked by | Nothing — it is engineering | Consent, retention, jurisdiction |
| Needed when | The second engine version exists | A deployment has real players |

**It is gated on the hosting layer, which MVP §4 defers entirely.** There is nothing to
capture from a local text client that the developer did not type themselves. Specifying it
now is worth doing because the *shape* of what may be taken constrains the session store and
the observability boundary, and both are being built — but nothing here is MVP work.

---

## 2. What Is Captured

**A `ReplayFixture` (07 §2), and nothing else.** Capture invents no format:

```typescript
interface ReplayFixture {          // 07 §2, unchanged
  readonly name: string;
  readonly config: NewGameConfig;         // campaignId, seed
  readonly campaignVersion: string;
  readonly capturedUnder: string;         // engine version
  readonly submissions: readonly Submission[];
}
```

That it needs no new type is the strongest argument for this design. A captured session is
byte-for-byte the same artefact the test suite already runs, so a support case reproduces
with no translation step and can be promoted into the corpus without conversion (§7).

---

## 3. What Is Refused

Three rules, and the second is the one that makes the first honest.

**3.1 No identity.** `profileId`, `sessionId`, account identifiers, addresses, and host
metadata are never written into a fixture. They live on the session store's own record
(04 §7) and stay there. A fixture names a *campaign* and a *seed*, never a person.

**3.2 Only declared params.** `ActionParams` is
`Readonly<Record<string, string | number | boolean>>` (04 §7) — **arbitrary caller-supplied
keys and values.** Capturing them verbatim would put whatever a client chose to send into a
stored artefact, which is exactly the hole
[`05-observability.md`](05-observability.md) §8 closed for `actionId`.

> **So capture keeps only the parameters the kind declares**, dropping every other key. The
> `story-graph` kind declares none and rejects a non-empty `params` with `unexpected_params`
> (03 §8.2), so for the MVP kind this reduces to *params are never captured at all*. The rule
> is written for the kinds that will declare them.
>
> An `actionId` that resolved to no declared action is likewise dropped, for the same reason
> and by the same rule as 05 §8 — an unmatched id is caller-supplied text.

**3.3 No timing.** No wall-clock, no durations, no inter-action intervals. They are not
replay inputs (04 §2 keeps clocks out of `GameState` entirely), and timing is behavioural
data with no compensating value here.

---

## 4. The Seed Is the Sharp Edge

A fixture must carry its seed — `{seed, submissions}` is the whole replay input, and without
it nothing reproduces. But a seed plus a submission list reproduces **one specific person's
session exactly**, which is precisely what makes it useful and precisely what makes it
sensitive.

There is no clever way out of this, and the document does not pretend otherwise:

- A fixture is **personal data** while it is a capture, and must be handled as such —
  access-controlled, retained under §6, deleted on request.
- It stops being personal data only when it is **de-identified by review** at promotion
  (§7), which for a story-graph fixture is usually automatic: campaign id, seed, and a list
  of choice ids carry nothing about who made them once identity (§3.1) is absent.
- A fixture is never attached to a public issue, a shared log stream, or anything an
  operator can read casually. That is a wiring rule, like the sink-selection rule in
  05 §10.

---

## 5. When a Capture May Be Taken

Two triggers, both narrow:

| Trigger | Who | Bound |
|---|---|---|
| **On an engine fault** | Automatic | Only on `error`-severity events (05 §7) — a settle guard trip, a rejected envelope. Not on ordinary rejected actions, which are normal play |
| **On explicit report** | The player, or an operator acting on their report | One session, named |

**Never as background collection.** Capturing every session because it might be useful is
what turns a debugging tool into surveillance, and the oracle does not need volume — 07 §4
wants a small corpus of *meaningful* fixtures, not a large one.

---

## 6. Retention

- **Bounded by default.** A capture that has not been promoted (§7) within its retention
  window is deleted, and the window is short — measured in days, not indefinitely "until
  someone looks."
- **Deletion on request removes captures too.** A capture is derived from a person's play,
  so a deletion request must reach it. Because captures carry no `profileId` (§3.1), the
  *store* must maintain the capture-to-account mapping outside the fixture — which is the
  hosting layer's job and is named as such in §8.
- **Deleting a capture never deletes a promoted fixture** — see §7 for why that asymmetry is
  deliberate and what it costs.

---

## 7. Promotion Is a One-Way Door

07 §4 says a confirmed bug becomes a committed golden fixture. **Committing to git is
permanent**, and this is the moment that matters most:

> **Promotion is a reviewed, human step. A capture is never promoted automatically.**

At promotion the reviewer confirms identity is absent (§3.1), undeclared params are absent
(§3.2), and the fixture is renamed to describe the *bug* rather than the session. What is
committed is then a test artefact, not a record of a person.

The asymmetry with §6 is deliberate and worth stating: retention deletion cannot reach a
promoted fixture, because it is in the history of a public repository. That is exactly why
promotion is gated on review rather than convenience — the moment before commit is the last
one at which the decision is reversible.

---

## 8. What the Hosting Layer Owns

Named so the boundary is not assumed:

- **Lawful basis and consent** for capturing play, and how it is presented.
- **The capture-to-account mapping** that makes §6 deletion possible without putting
  identity in the fixture.
- **Jurisdictional retention limits**, where they are shorter than the default.
- **Access control** on stored captures.

None of that is engine work. The engine's obligation is to make a fixture that is *safe to
keep* — which is what §3 is for — and to make sure nothing in the replay path needs anything
more.

---

## 9. Deferred

- **Capture of `simulation`-kind sessions with declared params.** The §3.2 rule is written
  for it; the kind does not exist yet, and its parameter set will need its own review, since
  a declared parameter is not automatically a safe one.
- **Automatic de-identification checks at promotion.** §7 is a human step. A lint that
  refuses a fixture containing an undeclared key would make it harder to get wrong, and is
  worth adding once there is a corpus to run it against.
- **Capture from clients other than the hosted one.** A self-hosting operator running their
  own deployment has their own obligations; this document does not attempt to specify them.
