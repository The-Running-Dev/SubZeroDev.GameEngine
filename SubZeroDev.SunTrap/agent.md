# Agent — Lessons Learned

Retrospective notes for whoever (human or agent) works this **game** repo next. Standing
*instructions* live in [`CLAUDE.md`](CLAUDE.md). This file is what was learned the hard way.

Keep it short — it loads into context, so length is a recurring cost. Add a lesson only when
it would have changed a decision.

> **Most of what follows is inherited, not earned here.** This repository is new: its
> documents were written in one pass during the engine's design work and no code exists yet.
> The lessons below come from the engine repo, and are recorded because they are the ones
> most likely to repeat in *this* repo, not because they have already bitten in it. Delete
> any that turn out not to apply; add the ones that actually cost something.

---

## Where This Design Came From

These documents began as an eight-document draft that proposed a new engine kind and, in
doing so, **wrote a parallel engine** — its own state envelope, its own `createGame` /
`executeCommand` / `advanceTicks` API, its own status union. Roughly seven of its operations
already existed on the engine, under different names.

That is the shape of the mistake this repo is most prone to, and it was not obvious from
inside the draft: every individual paragraph read like reasonable game design. It only became
visible when each claim was checked against the engine's actual contract.

**So: when a document here starts describing how something *works* rather than what it
*contains*, that is the signal to stop and check the engine.**

## Inherited Hazards

- **Envelope duplication.** Caught four times in the engine. It arrives here as a field added
  to a shape in `06-content-and-systems` that the engine already owns. Check the envelope,
  the campaign, and the registry before adding any field.
- **Counts drift from what they count.** "All eight operations" against a nine-row table
  survived two full review passes in the engine repo, and there were three instances of the
  same defect in total. When a document states a number, count the list.
- **A stale cross-reference is invisible.** Section numbers cited across documents rot
  silently when a document is restructured. The engine repo gates this in CI; this repo has
  no such gate yet, so cross-references here are checked by hand or not at all.
- **A diff cannot show a rendering bug.** Markdown joins consecutive lines, so a metadata
  field or blockquote label needs a **blank line** after it. Never trailing double-spaces —
  `git diff --check` rejects those.
- **Theme words smuggle in engine decisions.** The kind was nearly named
  `management-simulation`; "management" is a genre, and naming by genre would have licensed a
  new kind per resort theme. Name things after structure, not flavour.

## What Worked (Keep Doing)

- **Decide via questions, then batch-write.** Surface real forks one or a few at a time, get
  sign-off, *then* edit. Never bulk-apply findings unreviewed.
- **Verify against the artefact.** Every claim about the engine should be checked against the
  published spec, not recalled. Several confident recollections were wrong.
- **State what was deliberately not done.** Deferred items with a "revisit when" are worth
  more than silence, and they stop the same argument being had twice.

## Known Weak Points in These Documents

Stated plainly so the next reader does not mistake polish for validation.

- **Nothing here has been played, built, or tested.** The design is unproven in every
  respect. The MVP in `04-mvp.md` exists precisely to find out which parts are wrong.
- **All balance numbers are placeholders.** Tick duration, the utility formula, prices,
  wages, thresholds — every one is a guess awaiting a balance pass.
- **The documents were written and reviewed by the same author.** Internal consistency was
  checked; correctness of the design was not, and could not be.
- **`06-content-and-systems` is the least validated document.** It fixes field-level shapes
  ahead of any implementation, which is the part most likely to change on contact with code.

## Open Questions

Live in [`05-roadmap-risks-and-open-questions.md`](05-roadmap-risks-and-open-questions.md).
Its §4 is the register; **§5 lists what the engine has already closed** — check there before
re-opening an argument that was settled upstream.

## Orientation in One Paragraph

This repo = **Sun Trap**, a satirical resort-management game. It is *content and design*, not
an engine. It runs on the `world-graph` kind — a navigable world with autonomous inhabitants —
which is engine-owned code in
[SubZeroDev.GameEngine](https://github.com/The-Running-Dev/SubZeroDev.GameEngine), specified
at <https://game-engine.subzerodev.com/docs/engine/world-graph-kind>. The engine owns
determinism, state boundaries, the action list, projection, validation and the client
contract; this repo owns maps, scenarios, definitions, balance, narrative voice and the
visual client. The sibling game on the `simulation` kind is
[SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) — the model
for how a game repo relates to the engine. Build order: prove the kind headlessly, then a
proving CLI, then a visual client. Nothing is implemented yet.
