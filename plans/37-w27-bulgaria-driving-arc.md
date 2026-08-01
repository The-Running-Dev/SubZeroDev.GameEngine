# W27 — Bulgaria Adventure: The Driving Arc

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Finish the Bulgaria
Adventure*, proposed as W27, the first of its four remaining-arc checkboxes.

**Scope:** Author one new `story-graph` campaign — the Driving arc (`games/bulgaria.md`'s
"Driving" and "BMW Ownership" scenes) — as its own standalone campaign source, mirroring
`bulgaria-bureaucracy.ts`'s established pattern exactly: source file, content tests, a
determinism-harness test, and (if cheap) replay-corpus fixtures. No engine or kind changes —
`story-graph` is fully built; this is content only.

**Depends on:** Nothing engine-side. Chosen over the other three remaining arcs for reasons
in *Why Driving First*.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md), Tranche B —
"the lowest-risk work remaining in the entire programme."

> **Renumbered relative to `plans/36`.** That plan tentatively earmarks W27–W33 for the
> simulation kind, explicitly as a proposal — "numbers assigned when each is cut." Since
> neither track had cut a number yet and this one is being cut first, it takes **W27**; the
> simulation kind's numbers shift to W28–W34 whenever that programme actually starts. `plans/36`
> itself is not edited to reflect this — it's a point-in-time record of reasoning done before
> this unit existed, the same treatment `plans/32`/`plans/33` give their own superseded claims.

---

## Why Driving First

All four remaining arcs (`bulgaria-adventure.md`'s table) are nominally "independent," but
reading the actual built Bureaucracy campaign against both the design doc and the raw source
material turned up two things that make Driving the safer first pick — not just an arbitrary
choice among four options that all looked the same.

### Finding 1: The design doc's ending assignment for Enterprise is already wrong

`bulgaria-adventure.md`'s table assigns `games/bulgaria.md`'s "Ultimate Bulgarian Reward" scene
— and by extension its achievement — to the **Enterprise** arc. But the actual built
`bulgaria-bureaucracy.ts` already consumes both:

```typescript
reward: {
  kind: "ending",
  text: { text: "Congratulations. After seven years of paperwork, you finally receive: €300, and 28 years of unresolved legal responsibility." },
  endingId: "ultimate_reward",
  outcome: "win",
}
// achievements: [{ id: "it_builds_character", condition: { field: "ending", operator: "equals", value: "ultimate_reward" }, ... }]
```

This is verbatim the "Ultimate Bulgarian Reward" text from `bulgaria.md`, and the exact
achievement bulgaria.md's own text names ("Achievement Unlocked: 'It Builds Character.'"). W15
made a real authoring decision — reusing this scene as Bureaucracy's climax — that the design
doc was never updated to reflect. Whoever builds **Enterprise** now needs either new climax
content and a new achievement id, or a decision that Enterprise simply doesn't get this
achievement. That's a real design question with no obvious answer, not a content-authoring
task — it belongs to whichever unit builds Enterprise, not this one.

**Recorded, not fixed here**: this is exactly the kind of finding this repo's working
convention says to keep rather than drop silently. Added to `OPEN-QUESTIONS.md` §2 as part of
this unit (see *Proposed Changes*).

### Finding 2: "Return seeds variables the other arcs read" isn't achievable as written

`bulgaria-adventure.md` says of Return: "seeds variables the other arcs read." But every arc is
built as its **own standalone `Campaign`** — confirmed by how Bureaucracy is actually wired:
`bulgaria-bureaucracy.ts` is a fully self-contained `id: "bulgaria-bureaucracy"` campaign with
its own `startNodeId`, not a sub-graph inside one larger multi-arc campaign. `story-graph`'s
`Campaign` type has exactly one `startNodeId` and no mechanism for one campaign's `kindState`
to be read by another's — sessions are per-campaign (04 §7). There is no seam through which
Return's variables could reach Inheritance, Enterprise, or Driving's state at all.

The likely intent is narrative continuity in prose (playing Return first sets a scene the
others assume), not a mechanical dependency — but as written, the design doc claims a technical
property the architecture doesn't support. **This means building arcs in any order is safe** —
nothing actually depends on Return running first — which is itself part of why Driving (not
Return) is a fine place to start.

**Recorded, not fixed here**: same treatment as Finding 1.

### Why this makes Driving the right first pick

- **No achievement or reward-scene conflict.** Driving's two scenes (Driving, BMW Ownership)
  and its one stated mechanic ("a 'trust the mechanic' flag") don't touch the consumed
  Ultimate-Reward material at all.
- **Explicitly the smallest scope** — `bulgaria-adventure.md` calls it "a short two-scene arc,"
  the smallest of the four by its own description.
- **No real ordering dependency** — Finding 2 establishes that Return's "seeds variables" claim
  isn't mechanically real, so nothing is lost by not doing Return first.
- **Proves a pattern Bureaucracy never needed**: Bureaucracy has exactly one ending. Driving
  is small enough to cheaply demonstrate a **branching ending** — two possible endings gated by
  an earlier choice — which is a real capability of this kind that no shipped content exercises
  yet, and which future arcs (especially Inheritance, whose stated exercise is "branching on
  prior choices") will need to have already been proven out once.

---

## The Proposed Content

Translating `bulgaria.md`'s two scenes into the authoring form `bulgaria-bureaucracy.ts`
established. Revised once from the first draft: rather than staging an invented `resolution`
node purely to hold a `showWhen` pair, the gate applies directly to BMW Ownership's own four
sourced choices, split 3-true/1-false — matching the ratio the Driving scene's own four choices
already establish (only actively questioning counts as skepticism; believing, ignoring, and
blasting music are all forms of not checking).

```yaml
id: bulgaria-driving
kind: story-graph
version: "1.0.0"
startNodeId: driving

variables:
  trust_mechanic: { type: bool, initial: false, visible: true, labelKey: stat.trust_mechanic }

nodes:
  driving:
    kind: choice
    text: "You pass the annual inspection. Five minutes later the dashboard lights up like a
           Christmas tree. The mechanic confidently says: 'It was already like that.'"
    choices:
      - id: believe_him
        effects: [{ op: set, var: trust_mechanic, value: true }]
        goto: bmw_ownership
      - id: ask_another_opinion
        effects: [{ op: set, var: trust_mechanic, value: false }]
        goto: bmw_ownership
      - id: ignore_warning
        effects: [{ op: set, var: trust_mechanic, value: true }]
        goto: bmw_ownership
      - id: turn_up_music
        effects: [{ op: set, var: trust_mechanic, value: true }]
        goto: bmw_ownership

  bmw_ownership:
    kind: choice
    text: "Your BMW develops a mysterious noise. Three mechanics diagnose: suspension,
           transmission, 'they all do that.' A fourth mechanic fixes it with a hammer."
    choices:
      - id: pay_immediately
        showWhen: { field: var.trust_mechanic, operator: equals, value: true }
        goto: ending_trusting
      - id: buy_him_lunch
        showWhen: { field: var.trust_mechanic, operator: equals, value: true }
        goto: ending_trusting
      - id: never_ask_questions
        showWhen: { field: var.trust_mechanic, operator: equals, value: true }
        goto: ending_trusting
      - id: ask_what_he_fixed
        showWhen: { field: var.trust_mechanic, operator: equals, value: false }
        goto: ending_skeptical

  ending_trusting:
    kind: ending
    text: "[written during implementation, reviewed before commit]"
    endingId: trusting_the_mechanic
    outcome: neutral

  ending_skeptical:
    kind: ending
    text: "[written during implementation, reviewed before commit]"
    endingId: asked_for_a_second_opinion
    outcome: neutral
```

A trusting player sees three of `bmw_ownership`'s choices (all reaching `ending_trusting`, with
genuinely different flavor along the way); a skeptical player sees exactly one
(`ask_what_he_fixed`, reaching `ending_skeptical`). Neither player ever sees the other branch's
option — `showWhen` omits it entirely, not grayed-out-with-a-reason the way `requirements` +
`requirementFailKey` would. No extra node is needed to stage the branch; it rides on content
`bulgaria.md` already supplies.

**No achievement.** `bulgaria-adventure.md` names one for Enterprise only; nothing in Driving's
stated exercises calls for one, and inventing one would be scope Driving doesn't need.

---

## Settled

1. ~~Branching mechanism~~ — resolved above: gate BMW Ownership's real choices directly, no
   invented `resolution` node.
2. **Ending flavor text** — left for implementation, reviewed before commit.
3. **`trust_mechanic` is visible** — matches Bureaucracy's precedent (both its variables are
   `visible: true`), simplest to test, low stakes either way.

---

## Proposed Changes

1. **New file** `src/engine/src/campaigns/bulgaria-driving.ts` — the source above, following
   `bulgaria-bureaucracy.ts`'s exact shape (`StoryGraphCampaignSource`, `buildStoryGraphCampaign`,
   `buildCampaign`, an exported `BULGARIA_DRIVING_CAMPAIGN_ID` constant).
2. **New test file** `bulgaria-driving.test.ts` — content/behavior tests mirroring
   `bulgaria-bureaucracy.test.ts`'s coverage: both endings reachable, the `trust_mechanic` gate
   actually gates (the wrong-branch choice is absent, not just disabled — `showWhen` omits
   entirely, per 03 §4), validation passes with no Tier 1 errors.
3. **New test file** `bulgaria-driving.determinism.test.ts` — mirrors
   `bulgaria-bureaucracy.determinism.test.ts`: golden-filed `serialize()` for at least one path
   through each ending, round-trip, sink-independence. No `random` node here, so no seeded-draw
   test is needed (unlike Bureaucracy's `clerk_review`).
4. **Replay corpus fixtures**, if the above two land cleanly and cheaply — one fixture per
   ending, following W22's `fixtures/replay/*.{fixture,outcome}.json` pattern. Not blocking;
   the programme's Tranche A already established this pattern is cheap to extend once a
   campaign's determinism tests exist.
5. **`OPEN-QUESTIONS.md` §2** — record Findings 1 and 2 as named, retained issues: the
   Enterprise achievement/reward-scene conflict (revisit when Enterprise is actually built),
   and the Return variable-seeding claim (revisit when Return is actually built, or close it
   there if narrative-only is confirmed as the intent).
6. **`TODO.md`** — a `[x] W27` entry under *Depth: Finish the Bulgaria Adventure*, matching the
   established per-unit format; the section's remaining bullet narrows from "the remaining
   four arcs" to the remaining three.

---

## Done-When

- `bulgaria-driving.ts` builds a valid `Campaign` with no Tier 1 errors.
- Both endings are reachable, and reaching the wrong-branch choice is impossible (absent, not
  disabled) — the `showWhen` gate is verified by test, not inspection.
- `serialize()` output for at least one full path is golden-filed and round-trips.
- The determinism harness's sink-independence and replay-byte-identity checks pass, matching
  Bureaucracy's own coverage shape.
- `OPEN-QUESTIONS.md` records both findings.
- `npm run typecheck && npm run lint && npm test` all pass, test count grows (not just moves)
  from the current 39 files / 445 tests baseline.
- `build/Test-Documentation.ps1` passes if any spec-adjacent doc changes.

## Explicitly Not In Scope

- **The other three arcs.** Inheritance, Enterprise, Return are separate future units; Finding
  1 specifically means Enterprise needs its own design pass before it can even be scoped.
- **Resolving Findings 1 or 2** — recorded as open questions in `OPEN-QUESTIONS.md`, not settled
  by this unit.
- **A culture pack, or anything for `simulation`/`life-in-the-fast-lane`.** `bulgaria.md`'s
  scenes are shared source; this unit only touches the `story-graph`-kind adventure framing.
- **Any change to `story-graph`'s kind code.** Every primitive this content needs (`showWhen`,
  typed variables, multiple endings) already exists and is already tested against Bureaucracy.
