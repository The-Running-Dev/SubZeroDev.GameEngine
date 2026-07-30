# Landing page — design review

**Status:** review only. Nothing applied.

Reviews the landing page **as designed** — section sequence, visual system, architecture diagram,
motion, responsive and accessibility decisions — as distinct from the repository-fact corrections
in `plans/07-landing-page-standalone-correction.md`.

Read against the now-settled context: standalone client-rendered React SPA under `site/`, hosting
undecided, docs on a separate domain, no-JavaScript requirement dropped.

Findings are ordered by severity. Each says what it is, why it matters, and what I would do. Where
something is a matter of taste rather than a defect, it says so.

---

## 1. Accuracy made the centerpiece weaker, and nothing has replaced it

**Defect.** The bundle's design thesis is that *"the architecture is the primary visual material"* —
no illustrations, no 3D, no stock art, because the diagram carries the page. It allocates the
widest canvas on the page to it (`07-visual-design-system.md`, "Architecture sections — wider
canvas"), and builds the only interactive component around it.

The invented five-layer model gave that canvas something to hold. The corrected model is
`Core → Kinds → Campaigns → Clients` — **four nodes in a straight vertical line.** That is a
bulleted list with better typography. It cannot carry a full-width canvas, and it certainly cannot
carry the claim that it *is* the design.

This is the most consequential design consequence of the correction, and no document has noticed
it: the page got more honest and its centerpiece got thinner.

**Recommendation — use the fan-out, which is both more accurate and more visual.** The thesis is
"build mechanics once, create many games". A linear chain asserts that. A branch *demonstrates* it:

```text
Core
  ↓
Kinds ─────┬──────────────┬──────────────┐
  ↓        │              │              │
Campaigns  story-graph    simulation     world-graph
  ↓        Bulgaria       Life in the    Sun Trap
Clients                   Fast Lane
```

`README.md`'s mermaid block already draws exactly this, with the three kinds on dotted branches.
It gives the diagram a shape, it puts three concrete game names on the page where the visitor can
see the payoff, and every element is verified fact. It also solves finding 4 below.

---

## 2. Two divergent token sets, silently

**Defect.** The colour tokens are specified twice, in `07-visual-design-system.md` and
`01-implementation-plan.md` §7, and **four values disagree**:

| Token | `07-visual-design-system` | `01-implementation-plan` §7 |
|---|---|---|
| `--landing-muted` | `#9ca3af` | `#a2a9b4` |
| `--landing-border` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.11)` |
| `--landing-accent` | `#7dd3fc` | `#82d8ff` |
| `--landing-accent-soft` | `rgba(125,211,252,0.12)` | `rgba(130,216,255,0.12)` |

Plus `07` has `--landing-danger-soft` and `--landing-success-soft` that the plan lacks, and the
plan has `--landing-origin-text: #d8d0c2` that `07` lacks.

Near-identical values that differ slightly are worse than values that differ obviously — nobody
notices, and both get implemented in different components. This is the same drift pattern
`CLAUDE.md` documents in the envelope-duplication ledger, in CSS.

**Recommendation.** One token set, in one document. The implementation plan's is the more complete
(it has `--landing-origin-text`, which the "warm accident" half of the concept actually needs), so
keep that and strike the block from `07`, leaving `07` to describe *usage rules* rather than
values. Also drop `--landing-danger-soft` and `--landing-success-soft`: the design explicitly
forbids red-cross iconography and says Refusals must not read as errors, so they are tokens
specified for a treatment the design rejects.

---

## 3. `--landing-border` cannot carry meaning at the specified opacity

**Accessibility defect.** `07-visual-design-system.md` lists "borders used as important
separators" among the things that must meet contrast, and specifies
`--landing-border: rgba(255,255,255,0.10)` against `--landing-bg: #090a0d`.

10% white over near-black is far below the 3:1 minimum WCAG sets for non-text elements that convey
meaning. So any border doing real work — the diagram's connectors, the ledger dividers between
Refusals items, the boundary of a selected architecture layer — fails, while the spec asserts it
passes.

**Recommendation.** Split the token by job. Keep `--landing-border` at ~0.10 for purely decorative
hairlines, and add a second token at roughly 0.25–0.30 for anything meaning-bearing — selection
state, diagram connectors, focus rings. Then state which is which, because "subtle 1px borders" as
a blanket rule is what produced the problem.

Related: the accent works as text or a border on dark, but if it is ever used as a **fill** behind
text, the foreground must be dark, not white. The spec never says which way round accent buttons
go.

---

## 4. The interactive diagram costs a lot and reveals four sentences

**Design defect.** The architecture explorer carries a substantial requirements load: semantic
buttons, `aria-pressed` or disclosure semantics, Tab/Shift+Tab/Enter/Space, a stable details
region, mobile disclosure behaviour, no hover-only content, reduced-motion handling, and a full
static fallback.

What it reveals is four short layer summaries. And because the spec *correctly* insists
interaction must never gate meaning, all four must be readable in the fallback anyway. So the
interaction's entire contribution is re-showing, on demand, text that is already on the page.

On mobile it is starker still: the spec has tapping a layer reveal its explanation directly beneath
it, which is the static list with extra steps.

There is a real counter-argument, though. Twelve sections of prose with no interactivity is a long
scroll, and this is the one moment the reader acts rather than reads. So the answer is not
drop-or-enrich.

**Recommendation: make each layer a link to its spec, and keep highlighting as CSS only.**

- `Core` → `/docs/engine/core`, `Kinds` → `/docs/engine/story-graph-kind`, `Campaigns` and
  `Clients` likewise, as absolute cross-site URLs.
- Semantically it becomes a list of links, so keyboard operation, focus handling and screen-reader
  semantics all come for free. No `aria-pressed`, no details region, no selection state, no separate
  mobile variant, no state/focus synchronization tests.
- The detail lives where detail belongs — the spec itself — instead of in a panel duplicating the
  summary directly above it.
- Hover and focus highlighting stays, as a CSS rule rather than a component.

This satisfies both halves of the original choice at close to zero cost, and it turns the page's
centerpiece into its best route into the documentation. It supersedes the earlier framing in this
review, which offered only "enrich it" or "drop it" — both worse than making it a link.

---

## 5. The page has one rhythm, and uses it five times

**Design defect.** Vertical lists of short noun phrases are the page's signature device. It appears
in the origin trigger ("Jobs. Education. Money. Needs. Schedules. Relationships. Random events."),
the problem ("physics. Input. Audio. Networking." then "schedules. Economies. Progression.
Relationships. Consequences."), the abstraction section ("State. Commands. Rules. Time.
Relationships. Resources. Consequences."), the six Refusals, and the six Capabilities.

Five times in twelve sections. The device is excellent once and good twice; by the fifth the reader
has learned that a list means "skim". Worse, the lists **overlap**: *Relationships* appears in
three of them, *Consequences* in two. The copy deck never noticed because each section was written
well on its own.

**Recommendation.** Keep the device for the origin trigger (where it is doing real work — the LLM's
answer arriving as a flat enumeration is the joke) and for one of Refusals/Capabilities. Rewrite
the problem and abstraction sections into prose or a contrast layout. Remove the duplicate nouns
so each appears once, in the section where it lands hardest.

---

## 6. Refusals and Capabilities cancel each other out

**Design defect.** Six numbered items each, `01`–`06`, in deliberately matched vertical ledgers —
`10-component-specifications.md` says render Capabilities "similarly to Refusals for visual
symmetry". The result is twelve numbered short lines, back to back, in identical form, in the
longest text-only stretch of the page.

The symmetry is the problem, not the solution. Two identical blocks read as one long block, and
the rhetorical contrast the pairing exists to create is exactly what identical treatment destroys.

Content overlaps too: Refusal `01` ("Rewrite the same inventory system for every game") restates
the page's thesis, which by that point has been stated in the hero, the problem section and the
realization.

**Recommendation.** Cut both to four items, drop Refusal `01` as already-said, and break the
symmetry deliberately — one as a numbered ledger, the other as a tighter two-column or inline
treatment. Or merge them into a single side-by-side "refuses / does" contrast, which is one visual
event instead of two identical ones.

---

## 7. The hero promises something the page deliberately does not deliver

**Copy defect, small but first.** The hero closes with *"Scroll. It gets weirder."* The tone
progression is explicitly the opposite: mysterious → funny → **increasingly technical** →
joke-free by the CTA. Nothing gets weirder. The page gets more serious on purpose, and that is one
of its best decisions.

It is the first sentence the reader takes on trust, and it is inaccurate about the page's own
shape.

**Recommendation.** *"Scroll. It escalates."* — which is truthful, keeps the deadpan, and reuses an
approved recurring line ("This escalated."). *"Scroll. It gets technical."* also works and sets the
right expectation.

---

## 8. The origin story is told three times, not twice

**Copy defect.** The bundle is careful about this and still commits it. The trigger/resolution split
is sound: hook early, pay off late. But the *resolution* as written is largely a summary of the
middle of the page —

> If mechanics were reusable, the simulation should not depend on presentation.
> If the simulation was separate, commands could be validated.
> If commands were deterministic, worlds could be replayed.
> If content was data, humans and AI could use the same engine interface.

Those four lines restate the architecture, operating-contract and abstraction sections the reader
has just finished. The resolution's actual job — the emotional turn and the punchline — is the
material around them: *"the reasonable response would have been to enjoy the explanation, close the
conversation, and go to bed"*, and *"I still maintain this is entirely the LLM's fault. It should
have given a shorter answer."*

There is also a **fourth** telling available: the optional `StoryTimeline` component in
`10-component-specifications.md` with seven steps, and the timeline version in
`02-origin-story.md`.

**Recommendation.** Cut the four "If X, then Y" lines from the resolution. Keep the go-to-bed line
and the punchline.

**Drop `StoryTimeline`**, for two reasons. First, it fails its own admission criterion: the spec
says *"use only if it adds clarity without repeating the origin prose"*, and its seven steps —
*I miss Jones / Ask an LLM / Mechanics explained / Implementation suggested / Reuse discovered /
Determinism required / Engine appears* — are each already narrated, the first four in the trigger
and the last three across the realization and resolution. It can only repeat the origin prose, so
the condition is unsatisfiable by construction.

Second, and the deciding reason: it is **visually the same shape as the architecture diagram** —
vertical stacked nodes joined by arrows. Two of those on one page reads as the same component
twice, which flattens the one element that is supposed to be the page's single visual event. The
cost is not just repetition; it is dilution of the centerpiece.

---

## 9. The hero's reveal sequence fights the SPA decision

**Defect, newly created by the stack change.** `08-motion-and-interaction.md` specifies a five-stage
hero sequence: label, then headline fades in, then ellipsis, then signature, then scroll
invitation — with `--motion-story: 700ms` available and a stagger between each.

With prerendering, that sequence began from painted content. Client-rendered, it begins from a
blank screen: nothing, then bundle parse and mount, *then* a five-stage staggered reveal. The
bundle's own performance goals are "fast initial render" and "no layout shifts".

**Recommendation.** Hero content paints in full on mount — no reveal on the label, headline or
ellipsis. Stagger only the signature and the scroll invitation, which are the two lines whose
timing is actually a joke. This keeps the comic beat and removes a second of blankness in front of
the page's most important words.

---

## 10. The specified type scale overflows the specified minimum width

**Defect.** `--text-hero: clamp(3rem, 8vw, 7.5rem)` floors at 48px. The headline's longest line,
*"Create infinite games."*, is 22 characters — roughly 500px at 48px in a geometric sans. The
requirement is no horizontal overflow at 320px.

So on a phone the line must wrap, which turns the deliberate two-line headline into four lines. And
if the deliberate break is enforced with a `<br>` or `white-space: nowrap` — which
`04-voice-and-tone.md` asks for, "preserve punctuation and deliberate line breaks" — it overflows
instead.

Two requirements in the bundle are in direct conflict at 320px, and neither document mentions the
other.

**Recommendation.** Drop the clamp floor to ~2rem for the hero and let the two-line break be a
`min-width` enhancement rather than a fixed structure — deliberate breaks above the mobile
breakpoint, natural wrapping below it. State that explicitly, because "preserve deliberate line
breaks" reads as unconditional.

---

## 11. Light mode — RESOLVED: dark only

`01-implementation-plan.md` §7 offered three light-mode strategies, one of which was "follow the
current site theme automatically". Standalone, there is no site theme to follow, so that option was
already gone. The entire visual system is specified in dark and there is no light palette anywhere
in the bundle.

**Decided: dark only, explicitly.** What that means concretely:

- Strike the three-option list in `01-implementation-plan.md` §7 and state the commitment in its
  place, so the plan's own warning — *"do not allow an accidental half-supported light mode"* — is
  satisfied by a decision rather than left as a risk.
- Set `color-scheme: dark` on the root. Without it, form controls, scrollbars, focus rings and
  autofill styling render in the browser's light defaults against a near-black page, which is the
  most common way a "dark-only" site ends up looking half-finished.
- **Do not** respond to `prefers-color-scheme`. There is one palette; branching on a preference
  that has nothing to branch to is how the accidental half-supported mode appears.
- No theme toggle. `07-visual-design-system.md`'s line about preserving "Docusaurus dark/light
  compatibility" goes with it — there is no Docusaurus and no light mode to stay compatible with.
- Contrast targets in finding 3 are therefore the *only* set that needs verifying, which removes a
  whole second pass.

If the intent was instead to support both light and dark, this is a materially larger piece of
work: a light palette does not exist, and every token, the diagram's line weights, the
`--landing-origin-text` warmth and the accent's contrast behaviour would each need a second value
designed rather than derived.

---

## 12. Three documents give the ellipsis three different treatments

**Inconsistency, minor.** The `...` is a real design element here — a timed pause in the hero, and a
recurring motif.

- `04-voice-and-tone.md`: "preserve visible punctuation, especially ellipses"
- `10-component-specifications.md`: "decorative ellipsis should be hidden from screen readers if
  needed"
- `11-responsive-accessibility-performance.md`: "ellipsis should not create confusing repeated
  punctuation"

Three plausible rules, no single answer.

**Recommendation.** One rule: the ellipsis is decorative, `aria-hidden`, and never the only carrier
of meaning or timing. Where a pause matters semantically, the surrounding copy carries it.

---

## 13. The signature easter egg has no touch or keyboard story

**Defect, low stakes.** *"Well... why not?"* becomes *"Seriously. Why not?"* on hover or focus. On
touch there is no hover. And making a decorative line focusable adds a tab stop that announces
nothing meaningful to a screen-reader user, which is a small accessibility cost for a joke.

**Recommendation.** Either make it a real `<button>` with an accessible name so the interaction is
honest, or make it hover-only and explicitly desktop-only, accepting that touch users never see it.
Both are fine; the current spec is neither. Given the spec says it must be "accessible and not
required to understand the page", hover-only-and-admitted is the simpler truth.

---

## 14. The longest text-only stretch is where the page asks the most

**Structural observation.** The twelve sections run: hero, origin trigger, problem, realization,
**architecture**, abstraction, operating contract, refusals, capabilities, origin resolution, docs
handoff, footer.

The architecture diagram is the page's only visual event. Everything after it — abstraction,
operating contract, refusals, capabilities — is four consecutive text-only sections, and it is also
the most technically demanding stretch. That is where readers leave.

**Recommendation.** This resolves itself if findings 5 and 6 are taken: prose instead of a fourth
list, and one merged contrast block instead of two identical ledgers. If the fan-out diagram from
finding 1 is adopted, consider whether the operating contract can attach to it visually rather than
standing alone — the command boundary is a property of the Core layer, and showing it there is
stronger than asserting it two sections later.

---

## What the design gets right

Genuinely, and worth protecting through the edits above:

- **No illustration requirement.** Committing to typography, spacing and structure instead of stock
  art or 3D is the right call for this audience and it is why the page can be built at all.
- **The refusals/capabilities device** as a concept. Stating what a system *will not* do is a
  stronger credibility signal than a feature list, and it is rare.
- **Humor as a fixed budget** — 5–10%, declining as the page gets technical, with the page required
  to stand up if every joke is removed. That is a discipline most projects do not impose.
- **Interaction never gates meaning.** Correct, and the reason finding 4 is a cost question rather
  than an accessibility one.
- **Reduced motion treated as a first-class state**, not an afterthought bolted on.
- **The refusal to fake a technical demo.** `08-motion-and-interaction.md` says a
  command-validation demo should exist only when backed by real engine behaviour. For a project
  whose entire pitch is determinism, faking that would be the one unrecoverable lie.
- **No feature-card grid, no fake testimonials, no invented metrics.** The bundle's list of things
  to avoid is more useful than most style guides' lists of things to do.
- **The origin story on the homepage rather than an About page.** It is the most memorable thing
  about this project and hiding it would be a mistake.

---

## Decisions this review asks for

| # | Decision | Recommendation |
|---|---|---|
| 1 | Architecture diagram: linear chain or fan-out to the three kinds | **Fan-out** — more accurate and more visual |
| 2 | Diagram interaction | **Each layer is a link to its spec**; hover/focus highlight in CSS only. No details region, no ARIA state |
| 3 | Which token set is canonical | **`01-implementation-plan.md` §7**, strike the other |
| 4 | ~~Light mode~~ | **RESOLVED — dark only**, `color-scheme: dark`, no `prefers-color-scheme` branch, no toggle |
| 5 | Refusals/Capabilities | **Four items each**, break the symmetry |
| 6 | Hero reveal | **Paint immediately**, stagger only the last two lines |
| 7 | Signature easter egg | **Hover-only and admitted**, or a real button |
| 8 | `StoryTimeline` | **Drop** |

Findings 3, 8, 10 and 12 are corrections rather than choices — a contrast failure, a repetition, an
overflow conflict and an inconsistency. They need doing regardless of the decisions above.
