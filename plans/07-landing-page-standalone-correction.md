# Landing page — correcting the bundle for a standalone React site

**Status:** plan only. Nothing in here has been executed.

## Context

The landing-page bundle was reviewed, de-duplicated, moved to `plans/06-landing-page/`, and
corrected with a new `00-repository-reality.md` carrying the repository audit the bundle had
deferred. That work is committed — `4e3601b` (bundle as received), `9615d38` (consolidation) — on
branch `landing-page-specs`.

Two assumptions in that audit were wrong, and both are now settled by decision:

| Was assumed | Actually |
|---|---|
| Built inside the docs Docusaurus project, at `docs/src/pages/index.tsx` | **Standalone React site**, living under `site/` |
| Deployed via the docs' GitHub Pages pipeline | **Hosting undecided** — to be determined separately |

Two further decisions close the remaining questions: the project lives under `site/` (now vacant,
since the specs moved to `plans/06-landing-page/`), and **the README is explicitly out of scope** —
no pitch-ownership question, no README restructuring, no canonical-page decision.

The placement correction is large but simplifying. The **stack** correction is the larger one: the
bundle is premised on Docusaurus as "the host, router, documentation framework, and theme
foundation", and that premise is now void rather than merely qualified.

**Scope:** documents under `plans/06-landing-page/`, plus this plan. No code. No `docs/`, no
`.config/`, no `build/`, no `README.md`.

---

## Resolved: the no-JavaScript requirement is dropped

**Decision: a client-rendered React SPA. The requirement that content survive without JavaScript
is struck from the bundle.**

Docusaurus satisfied that requirement invisibly by prerendering every route. A plain React SPA
does not, so the requirement goes rather than sitting in acceptance lists nothing meets. The
toolchain is now unconstrained — plain Vite plus React is sufficient, with no SSG plugin, static
export or islands framework needed. This also unblocks every edit in this plan; nothing waits on
a further decision.

Seven statements to strike or rewrite:

| Location | Wording | Action |
|---|---|---|
| `00-handoff-readme.md:182` | "content remains available without client-side JavaScript" — *completion requirement* | Strike |
| `01-implementation-plan.md:320` | "understandable and navigable with CSS disabled, JavaScript disabled, keyboard only, or a screen reader" — *Gate 2 deliverable* | **Rewrite, do not strike** — see below |
| `01-implementation-plan.md:306` | "Keep primary copy statically rendered" | Strike |
| `specifications/12-implementation-roadmap.md:57` | "complete page readable without JavaScript" — *Phase 1 acceptance* | Strike |
| `specifications/08-motion-and-interaction.md:59` | "All content must remain visible without JavaScript" | Rewrite as the reveal-safety rule below |
| `specifications/13-agent-implementation-brief.md:73` | "Keep primary content statically rendered" | Strike |
| `specifications/11-responsive-accessibility-performance.md:119` | "Prefer static server rendering through Docusaurus"; and "Avoid client-only rendering for primary content" | Strike both |

### What must survive the edit

This is the part worth getting right. The no-JavaScript requirement is entangled with three
*separate* requirements in the same sentences, and a careless strike takes them with it.

- **Keyboard-only and screen-reader operation.** `01-implementation-plan.md:320` bundles four
  distinct things into one clause — "CSS disabled, JavaScript disabled, keyboard only, or a screen
  reader". Only the JavaScript clause goes. Keyboard and screen-reader operation remain hard
  requirements, and CSS-disabled remains a reasonable semantic-HTML check.
- **Reduced motion.** "Never hide content waiting for intersection"
  (`specifications/08-motion-and-interaction.md`) is about `prefers-reduced-motion`, not about
  JavaScript being absent. Unaffected and still required.
- **Reveal safety.** The pattern of *content visible by default, animation added only after
  initialization* was written to satisfy the no-JS rule, but it independently protects against an
  `IntersectionObserver` that never fires — an element already in view on load, an observer error,
  a bailed-out effect. Keep it, restated: **a failed or absent reveal must leave content visible,
  never hidden.** That is now the load-bearing form of what the JS-off rule was protecting.
- **Minimal JavaScript.** The performance budget ("custom JS ideally under 20 KB compressed", no
  animation library, no unjustified dependency) is independent of rendering strategy and stands.

### Two consequences the bundle must now state

Both are direct facts about client-rendered pages, not speculation:

1. **Open Graph and social-preview tags must live in the static HTML shell**, not be injected by
   React. Slack, Discord, Twitter/X, LinkedIn and iMessage unfurlers do not execute JavaScript, so
   React-injected meta tags are invisible to them and every shared link renders bare. For a
   marketing landing page whose main distribution is a pasted link, this is the single most
   consequential effect of the decision. `specifications/11-responsive-accessibility-performance.md`
   has an SEO and social-previews section; it needs this constraint written into it.
2. **Search-engine coverage is weaker and depends on the crawler executing JavaScript.** Worth one
   honest line rather than a mitigation strategy — the page is one route with no organic-search
   ambition stated anywhere in the bundle, so this is a noted tradeoff, not a problem to solve.

One small explicit choice, flagged rather than assumed: whether to include a `<noscript>` line so
a JavaScript-disabled visitor sees something rather than a blank page. One sentence of markup;
worth a deliberate yes or no rather than an omission.

---

## What survives, what dies, what is new

### Survives unchanged

- **`00-repository-reality.md` §1** — architecture model `Core → Kinds → Campaigns → Clients`, no
  `Mechanics` layer, three engine-owned Kinds.
- **§2** — capability matrix, four classifications, staleness warning.
- **§8** — what the bundle got right.
- **Review findings 1, 4, 5, 7, 9, 10** — duplicates, architecture, capability claims,
  `AGENTS.md`, internal contradictions, gate scope.
- **The whole editorial layer** — `02-approved-homepage-copy.md`, and
  `specifications/01`–`06`, `14`. Voice, origin story, storyboard beats, copy, content inventory.
  None of it depends on the stack.
- **`specifications/07-visual-design-system.md`** — tokens, typography scale, spacing, layout,
  diagram style. Framework-agnostic, apart from one line about preserving "Docusaurus dark/light
  compatibility".
- **`specifications/08-motion-and-interaction.md`** — motion principles, timings, reduced-motion
  rules, the refusal to fake a technical demo. Its one "visible without JavaScript" line is
  restated as the reveal-safety rule, per the decision above; everything else stands.

### Dies

- **§5 in full — the homepage retirement procedure.** All five ordered steps. The generated docs
  homepage stays; `.config/DocumentationRules.psd1` is not edited, the docs installer is not
  re-run, `CLAUDE.md` and `docs/docusaurus.config.ts` are not touched, and
  `build/ConvertTo-DocumentationHomepage.ps1` remains in use.
- **§6 — "Who owns the pitch."** Removed entirely. The README is out of scope.
- **Both VERIFY AT BUILD unknowns.** Both concerned the docs base image masking or colliding with
  `src/pages/index.*` and `src/css/custom.css`. A standalone project shares neither. They close as
  **moot** — not deferred, not resolved, no longer questions.
- **Every GitHub Pages consideration.** Hosting is undecided and is not Pages.
- **§7's "site tooling is out of scope" conclusion.** A standalone React project owns its own
  `package.json`, so formatter, linter, type check and component tests become expected rather than
  impossible. The bundle's original test plan becomes achievable.
- **`specifications/09-docusaurus-architecture.md` as written.** See below — this is the one file
  that needs rewriting rather than annotating.
- **The no-JavaScript requirement**, in all seven places, along with the static-rendering
  instructions that existed to serve it. Struck by decision, with the three adjacent requirements
  it was tangled with preserved explicitly.

### New

**1. Hosting is undecided.** Record it as unknown; do not reconstruct it. Until a host is chosen,
the bundle cannot specify build commands, deploy steps, domain, canonical URL, Open Graph URL, or
sitemap entries. The docs deployment is unrelated and untouched.

**2. Links into the docs become cross-site absolute URLs.** From a standalone site,
`/docs/engine/architecture` is not a path — it is
`https://game-engine.subzerodev.com/docs/engine/architecture`. Consequences: every CTA is
external; nothing validates these links (Docusaurus' `onBrokenLinks` governs only the docs site,
and `build/Test-Documentation.ps1` skips site-absolute targets by design); so **the route
inventory in §3 becomes the only check on them.** Worth a re-check whenever the docs are
restructured, since a renamed spec silently breaks a landing-page CTA.

**3. `site/` needs no `.gitignore` change.** The existing `node_modules/` and `dist/` patterns
match at any depth, so a Vite-style project under `site/` is already covered. Worth stating so
nobody adds a redundant rule — and worth noting that `.gitignore` carries a comment explaining
why `build/` is deliberately *not* ignored, so that file is not a casual edit.

**4. The determinism eslint guard does not apply here.** It lives in
`src/engine/eslint.config.js` and covers the engine's `src/`. A landing page may use `Date.now`
and `Math.random` freely. Worth one line, because "determinism is enforced" is prominent in
`CLAUDE.md` and an implementer may reasonably wonder.

---

## Changes to make

### `plans/06-landing-page/00-repository-reality.md`

§1, §2 and §8 are untouched. Everything else moves.

- **Replace §5** with *why the landing page does not live in the docs project*. Same evidence
  inverted: `/` in the docs site is a generated file behind a required CI drift check
  (`GeneratedFiles` in `.config/DocumentationRules.psd1`, `build/Test-Documentation.ps1`,
  `docs-ci.yml`) and `CLAUDE.md` says "Do not edit; edit the README". Under the old assumption
  that was a blocker to clear; it is now simply the boundary. State that nothing under `docs/`,
  `.config/`, `build/` or `README.md` changes.
- **Delete §6.**
- **Add a placement and stack section**: standalone React site under `site/`; hosting undecided
  and not GitHub Pages; the no-JavaScript decision above with its two options; what stays
  unspecifiable until hosting is chosen.
- **Rescope §4.** Keep the base-image overlay explanation only as *why the docs project cannot
  host or tool this page*. Drop the path-rebasing instruction and both VERIFY AT BUILD items,
  noting they closed as moot.
- **Rewrite §3's route forms** as absolute cross-site URLs, with the "only check on these links"
  note. The `/blog/…`, `/architecture/…` and "Explore the concepts" corrections stand.
- **Rewrite §7.** The standalone project owns its tooling; the manual-check table stays, since
  accessibility, reduced motion, contrast and 320px are manual regardless of stack. **Remove the
  "content available without JavaScript" row** and add two rows in its place: social-preview
  unfurl verified against the built HTML, and reveal-safety — content visible when the observer
  does not fire.
- **Add the two small notes** — `.gitignore` coverage, determinism guard not applicable.
- **Add a standing rule**, learned twice now: *where the bundle has no fact, the entry is "not
  decided" — never the most plausible reconstruction.*

### `plans/06-landing-page/specifications/09-docusaurus-architecture.md` — rewrite in place

This is the one document whose premise is void rather than qualified. It opens with "Docusaurus
remains the host, router, documentation framework, and theme foundation" and specifies `Layout`
from Docusaurus, a route table including `/blog/`, and theme-compatibility rules.

Rewrite it as the React site architecture, keeping the filename — the bundle's numbering is
positional and `specifications/README.md` lists files by name, so renaming means chasing
cross-references for no gain. Retain what is still true and good:

- CSS Modules for component styles, global tokens for colors/typography/spacing/motion/widths
- copy in a structured content module rather than large JSX text blocks, without building a CMS
- prefer native browser APIs and CSS; `IntersectionObserver` and CSS transitions; no animation
  library unless the design genuinely cannot be done without one
- no utility framework introduced for one page
- SEO title and description fields (values pending the domain)
- analytics only if it answers a real question

Replace: Docusaurus `Layout` with the site's own shell; the route table with a single route plus
external links; theme-compatibility rules with the site's own light/dark decision; and the
"documentation framework" framing throughout.

### Smaller stack edits

Each is a line or two, and each currently instructs an implementer to preserve something that will
not exist:

- `00-handoff-readme.md` — "custom Docusaurus homepage" in the objective; "documentation behavior
  remains unchanged" and "existing theme control only if consistent with the site" in the
  completion requirements. The docs are a different site now, so these become trivially true and
  should say so rather than imply integration work.
- `01-implementation-plan.md` — §6's "Preserve Docusaurus layout behavior"; §7's light-mode
  strategy, which offers "follow the current site theme automatically" as an option that no longer
  exists; §11's suggested structure, which rebases from `src/…` to `site/src/…`; §12's regression
  section, which tests docs routes, navbar, footer and style leakage into documentation — all of
  which become vacuous and should be replaced with the real regression risk, which is nothing,
  since the sites are independent.
- `specifications/10-component-specifications.md` — "Should not duplicate the full default
  Docusaurus footer if both are rendered" in `LandingFooter`.
- `specifications/11-responsive-accessibility-performance.md` — "Use existing Docusaurus
  breakpoints if available"; the whole "Rendering" subsection, which mandates static rendering and
  forbids client-only rendering, both now struck; and the SEO and social-previews section, which
  gains the static-Open-Graph-tags constraint.
- `specifications/12-implementation-roadmap.md` — its existing banner gains the stack change;
  Phase 0's `src/css/custom.css` inspection item is now meaningless.
- `specifications/13-agent-implementation-brief.md` — "Implement as a custom Docusaurus React
  homepage"; "Reuse existing dependencies and design tokens", of which there are none; the
  suggested file list, which rebases to `site/`.
- `specifications/07-visual-design-system.md` — the single "preserve Docusaurus dark/light
  compatibility" line.

### `plans/06-landing-page/README.md`

- Reframe the defect list: the generated docs homepage is a **placement constraint**, not a
  blocker; "no local Docusaurus project" is why the page needs its own project rather than a
  defect in the bundle.
- Record the settled decisions: standalone React under `site/`, hosting undecided, README out of
  scope.
- Replace the open decisions with the no-JavaScript question, and hosting.
- Remove both VERIFY AT BUILD items and the canonical-page decision.

### `plans/06-landing-page-spec-review.md`

- Finding 2: blocker → placement constraint. Finding 3: blocker → why a standalone project is
  required. Finding 6: gains the absolute-URL consequence. Finding 8: marked out of scope by
  decision, with the observation itself left intact.
- Peer review: withdraw the retirement-cost critique; keep the errata-pattern critique; add the
  no-JavaScript finding.

### Commit

One corrective commit on top of `9615d38`. **Not an amend** — the audit was wrong in two specific,
instructive ways, and the history should show the assumptions being corrected rather than conceal
them.

---

## Review of this plan

### The errata approach has reached its limit, and this plan admits it

Every previous round preserved the authored documents and pushed corrections into
`00-repository-reality.md`. This plan breaks that pattern: it rewrites
`09-docusaurus-architecture.md` in place and makes stack edits across seven more files.

That is the right call — a banner saying "ignore the premise of this entire document" is not a
correction, it is a warning label — but it is worth being honest that the errata strategy did not
survive contact with a stack change. The earlier peer review predicted this ("at some point
correcting the source files in place becomes cheaper than another correction layer"); the
prediction came true one decision later.

The consequence: after this pass, `00-repository-reality.md` is authoritative on *facts about the
repository* and the specs are corrected on *facts about themselves*. That is a cleaner division
than the current arrangement, where the errata carries both.

### The no-JavaScript requirement should have surfaced two rounds ago

It was sitting in seven places the whole time, in documents I had read in full. It only became
visible when the stack changed — because Docusaurus satisfied it invisibly, so nothing in the
bundle ever had to think about it.

That is the same class of error as the placement and hosting assumptions: **a constraint met by
accident is indistinguishable from a constraint understood**, until the thing meeting it is
removed. Worth extending the standing rule to cover it — not just "where there is no fact, write
undecided", but also "where a requirement is satisfied by the framework, say so, because it stops
being satisfied when the framework changes."

Dropping the requirement is a defensible call and it is now made. But note what it cost to
discover: three rounds of correction, each triggered by a decision rather than by reading. The
remaining risk is that the bundle contains other requirements Docusaurus was silently meeting —
route handling, heading-anchor generation, theme toggling, `prefers-color-scheme` wiring, image
handling. None is as load-bearing as prerendering, and I have not audited for them. That is worth
one pass over `specifications/07`, `10` and `11` while making these edits, rather than a fourth
correction round later.

### The riskiest edit is the strike, not any of the rewrites

Every other change in this plan replaces wrong text with right text, and a mistake shows up as an
obvious contradiction. The no-JavaScript strike is different: it **removes** text, and a mistake
shows up as a requirement that quietly no longer exists.

`01-implementation-plan.md:320` is the specific hazard — one clause carrying four requirements,
of which exactly one is being dropped. Strike the sentence and keyboard-only and screen-reader
operation vanish from a Gate deliverable with nothing announcing it. Same shape of risk in
`08-motion-and-interaction.md`, where the JS line sits inside the reveal-safety logic.

That is why the table above marks two of the seven as **rewrite, do not strike**, and why the
"what must survive" list is written out rather than left to judgement at edit time. Worth
re-reading the four surviving requirements against the diff afterwards, not just the gate.

### Scope is large but no longer sequenced

This plan touches ten documents. With the rendering question settled, nothing blocks anything —
the §5/§6/§7 rewrites, the `09` rewrite, the seven stack edits and the strike can all go in one
pass. The earlier draft split them into three waves; that split is now unnecessary and has been
dropped.

### What I am least sure of

Rewriting `09-docusaurus-architecture.md` under its existing filename leaves a document whose name
describes a framework it no longer covers. The alternative — rename to `09-site-architecture.md`
and update `specifications/README.md` plus any cross-references — is cleaner but touches more.
I have recommended keeping the name; it is the weaker half of that trade and worth overruling if
you would rather the filenames tell the truth.

---

## Verification

1. **Gate passes.** Expect 50 files — this plan is the only addition; no bundle files added or
   removed.

   ```bash
   ./build/Test-Documentation.ps1
   ```

2. **No Docusaurus-as-host instruction survives.** Every hit must be descriptive context about the
   *docs* site, never an instruction for the landing page:

   ```bash
   grep -rn 'Docusaurus' plans/06-landing-page/
   ```

3. **No retirement or docs-system instruction survives:**

   ```bash
   grep -rn 'NoHomepage\|retire\|DocumentationRules\|ConvertTo-DocumentationHomepage' plans/06-landing-page/
   ```

4. **No GitHub Pages assumption survives**, and hosting reads as undecided throughout.

5. **Paths point at `site/`.** No `docs/src/…` remains as a target for landing-page files.

6. **Route forms are absolute.** No bare `/docs/…` remains as a CTA destination.

7. **Scope held.** `git status` shows changes only under `plans/`. Nothing under `docs/`,
   `.config/`, `build/`, `src/`, or `README.md`.

8. **The strike removed only what it should.** All four adjacent requirements still present:

   ```bash
   grep -rn 'keyboard\|screen reader\|reduced motion\|prefers-reduced-motion' plans/06-landing-page/
   ```

9. **No no-JavaScript requirement survives**, and no static-rendering instruction with it:

   ```bash
   grep -rn 'without JavaScript\|without client-side\|statically rendered\|static server rendering\|client-only' plans/06-landing-page/
   ```

---

## Settled

- **Standalone React site**, client-rendered SPA. Plain Vite plus React is sufficient.
- **Lives under `site/`** — vacant since the specs moved to `plans/06-landing-page/`.
- **No-JavaScript requirement dropped**, with keyboard, screen-reader, reduced-motion and
  reveal-safety requirements preserved explicitly.
- **README out of scope** — no pitch-ownership question, no canonical-page decision.
- **Dark mode only.** `color-scheme: dark` on the root, no `prefers-color-scheme` branch, no theme
  toggle. Strike the three-option light-mode list in `01-implementation-plan.md` §7 and the
  "preserve Docusaurus dark/light compatibility" line in
  `specifications/07-visual-design-system.md`. See `plans/08-landing-page-design-review.md` §11.
- **Hosting undecided**, recorded as unknown. Nothing about it reconstructed.

## Open

Both minor, and neither blocks the edits.

1. **`<noscript>` fallback** — one sentence of markup so a JavaScript-disabled visitor sees
   something rather than a blank page. Worth a deliberate yes or no.
2. **Whether `specifications/09-docusaurus-architecture.md` keeps its filename** when its subject
   becomes React. Keeping it avoids chasing cross-references; renaming means the filename stops
   lying. Recommended keeping, but it is the weaker half of the trade.
