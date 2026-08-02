# Roadmap Page — Design and Implementation Plan

**Status:** Proposed; design and implementation plan only. No page code is included in this
change.

**Route:** `/roadmap/`

**Purpose:** Add a public, readable account of what has been built, what is happening next,
and how a question about *Jones in the Fast Lane* became forty-one merged work units. The
page should feel like the existing landing page, remain truthful to `main`, and be useful to
people who do not want to read an engine contract before breakfast.

---

## Handoff — Start Here

Read these completely before implementation:

1. `CLAUDE.md` and `agent.md`.
2. `site/src/App.tsx`, `site/src/index.css`, `site/src/landing.css`, and
   `site/src/css/motion.css` — the implemented visual system, not merely its older design
   documents.
3. `site/vite.config.ts`, `site/scripts/verify-build.mjs`, and
   `build/Merge-LandingPage.ps1` — the static build and GitHub Pages boundary.
4. `docs/docs/engine/TODO.md` — the canonical unit-by-unit delivery ledger.
5. `plans/39-world-graph-kind-programme.md` — the authoritative W41–W49 programme and
   milestone definitions.
6. `plans/40-w41-engine-consumer-boundary.md` — W41's partial publication state.

Then implement the sequence in this plan. Do not infer roadmap state from `README.md`; its
current status prose is stale. Do not claim that package publication has happened until the
tag workflow and package registry prove it.

---

## 1. Repository Reality

### 1.1 The existing site is two static applications in one deployment

- `site/` is a standalone Vite + React application served at `/`.
- `docs/` is Docusaurus served beneath `/docs/`.
- `build/Merge-LandingPage.ps1` overlays the complete Vite `dist/` tree onto the built docs
  artifact while protecting the `docs/` subtree.
- GitHub Pages has no server-side rewrite for an SPA route. A clean `/roadmap/` URL therefore
  needs a real `roadmap/index.html` in the Vite output; client-side routing alone would make a
  direct visit return 404.

The roadmap belongs in `site/`, not in Docusaurus. It is a narrative public page, not another
contract document.

### 1.2 What the rendered landing page actually uses

The page was inspected from source and rendered locally at 1280×720 and 390×844.

| Element | Implemented choice |
|---|---|
| Background | `#090a0d` |
| Primary text | `#f4f5f7` |
| Muted text | `#a2a9b4` |
| Warm narrative text | `#d8d0c2` |
| Accent | `#82d8ff` |
| Surfaces | `#101218` and `#151821` |
| Body/display font | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Technical labels | `ui-monospace, Consolas, monospace` |
| Desktop hero | 44px, weight 650, line-height 0.98 at 1280px |
| Mobile hero | 30.4px at 390px, with no horizontal overflow |
| Page measure | 72rem, plus 1.5rem inline padding |
| Visual grammar | documentary section labels, large editorial headings, ruled rows, sparse raised surfaces, pale-blue links, dry italic commentary |
| Motion | progressive enhancement only; reduced-motion users receive the full content without transition dependency |

Do not add a web-font request. The current stack deliberately falls back to the operating
system when Inter is unavailable. Matching the site means reusing this stack, not introducing
a new font payload.

### 1.3 Accuracy drift that must be corrected with the page

The roadmap would immediately contradict the current landing page unless these adjacent lines
are updated in the same implementation:

- The worked-example note says the engine does not exist yet. It now does.
- The worlds section says none of the worlds are playable yet. The honest current distinction
  is that tested engine scenarios exist, while polished player-facing games do not.
- `README.md` still describes code as complete only through W11 and calls W12–W14 next. Its
  coarse status section needs refreshing, followed by regeneration of
  `docs/src/pages/index.md` through the repository's documented generator path.

This is not a general landing-page rewrite. Change only factual status copy and the navigation
needed to discover `/roadmap/`.

---

## 2. Audience and Communication Contract

The primary reader is curious about the project but does not know what a deterministic kernel,
projection boundary, replay oracle, or content registry is. The page should answer, in order:

1. Did this project actually build anything?
2. What can it do now?
3. How did it get here?
4. What is being built next?
5. Where can I inspect the evidence or read the detailed plan?

Technical names may appear as optional labels and links. They must not carry the explanation.
Translate each phase into an outcome a general reader can understand.

Examples:

- Prefer “The same choices now replay to the same ending” over “canonical serialization and
  cross-version replay corpus.”
- Prefer “A second kind can run a whole week of a life” over “simulation tick pipeline.”
- Prefer “Sun Trap is next: guests, queues, litter, and consequences” over a list of state
  interfaces.

### Tone

Use the landing page's dry, self-aware voice. Humor is seasoning, not the information
architecture.

- One joke or aside per phase at most.
- Jokes target the project's escalating scope, bureaucracy, queues, package publishing, and
  the author's decision-making—not users or contributors.
- Every status remains clear if all italic commentary is removed.
- Never joke around a caveat in a way that obscures it.
- Do not invent metrics, dates, confidence percentages, or release promises.

Proposed voice samples, subject to final copy editing:

- Hero: **“How a Quick Question Became 41 Work Units.”**
- Deck: “The engine now tells stories, simulates a week, remembers what happened, and can be
  packed for other projects. This was not the original plan. There was not an original plan.”
- MVP aside: “At this point, calling it an accident became administratively difficult.”
- Package aside: “The door exists. The package has not yet been carried through it.”
- World-graph teaser: “Next: guests, queues, litter, and the mathematically reproducible decline
  of a resort.”

---

## 3. Information Architecture

### 3.1 Header

Reuse the wordmark and header geometry. Navigation becomes consistent across both public pages:

- Home
- Roadmap
- Documentation
- GitHub

On `/`, “Home” may remain represented by the wordmark rather than duplicated in the text nav.
On `/roadmap/`, the wordmark links to `/`, and Roadmap receives an accessible current-page state
(`aria-current="page"`) plus a restrained accent treatment.

Add a Docusaurus navbar item for Roadmap using a raw `<a href="/roadmap/">`, following the
existing reason the home brand uses a normal navigation rather than Docusaurus client routing.

### 3.2 Hero — the status in one screen

The roadmap hero should be shorter than the landing hero. It is an orientation, not a second
origin story.

- Eyebrow: `THE ROADMAP`
- H1: `How a Quick Question Became 41 Work Units.`
- One plain-language deck.
- A compact, verified fact strip:
  - `41` merged work units
  - `2` implemented kinds
  - `5` Bulgaria story arcs
  - `1` third kind waiting in the queue
- One quiet aside: “The queue is deterministic.”
- Jump links: `Built`, `Now`, `Next`, `Later`.

The figures are a snapshot, not a marketing counter. Put them in the roadmap data module and
cover them with tests. If implementation happens after another unit merges, recompute them from
`TODO.md` and `main` before writing copy.

### 3.3 “Previously, on the game engine” — delivered history

Do not render W0–W41 as forty-one equal cards. That is technically complete and editorially
unreadable. Group them into six human-scale chapters, each with:

- a work-unit range;
- a plain-language title;
- two or three sentences describing the outcome;
- a visible status label (`SHIPPED` for W0–W40, `NOW` for W41);
- one dry aside where useful;
- links to the canonical roadmap and a representative merged commit or PR.

| Chapter | Units | Status | Public explanation | Evidence link |
|---|---:|---|---|---|
| The engine learns the rules | W0–W8 | Shipped | Reproducible randomness, saves, validation, sessions, and the boundary that keeps clients honest. | [`d9af5d8`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/d9af5d8dbd0bc88829c8d43571aee92b874b2536) |
| The first story survives contact with bureaucracy | W9–W19 | Shipped | Choices, consequences, endings, achievements, a text client, MCP tools, and the completed MVP. | [`dcb7803`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/dcb78038cbe8bb8e002f0651c9551b47ff874bb5) |
| The past becomes testable | W20–W26 | Shipped | Versions and recorded playthroughs can expose when a future release changes an old outcome. | [`e26fa9d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/e26fa9dbc9e1a2814443bfff952a15562b608dc8) |
| Bulgaria expands beyond one municipal office | W27–W31 | Shipped | All five story arcs exist, and old saves can migrate when the engine changes. | [`588567d`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/588567d2d4ff84f7b38a904b62c586b315122f07) |
| A week of life becomes a machine | W32–W40 | Shipped | The engine can run and replay a Stable Life win and loss. A polished player-facing game is still later work. | [`9fdf77c`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/9fdf77c63773ea0bc0ffc288fbba0995ee04c3ff) |
| The engine gets a front door | W41 | Now | A supported package boundary, tarball consumer test, and release workflow exist. Publication is still pending. | [`db9c62a`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/commit/db9c62aec509ed083179a73ae2ec49b1b53d3d26) |

The chapter copy should link technical nouns only when the link helps a curious reader go deeper.
Do not turn every sentence into a blue minefield.

### 3.4 “Now” — the honest checkpoint

Use the raised surface treatment once, for the page's current-state focal point.

Status copy:

- W41 is merged and its clean-consumer gate passes.
- The first private package version has not been published.
- Sun Trap cannot pin a package version until that owner-only publication step is complete.
- W42 is next according to `main`; do not display an unmerged branch as delivered work.

Primary links:

- [W41 merged PR](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108)
- [W41 detailed plan](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/40-w41-engine-consumer-boundary.md)
- [Canonical task ledger](/docs/engine/todo)

Suggested heading: **“Built. Gated. Not Yet Published.”**

### 3.5 “Next” — Sun Trap without the interface inventory

Present W42–W49 as three acts rather than eight engineering rows:

1. **Describe the resort** — W42–W44: settle what exists in the world and the order in which
   it changes.
2. **Make the resort move** — W45–W48: build actions, ticks, guests, queues, service, litter,
   cleaning, and previews.
3. **Prove the resort can succeed or collapse** — W49: validate it, record a win and loss,
   add it to replay protection, and publish a version Sun Trap can install.

Each act may disclose its W range in monospace secondary text. The main copy remains about the
observable result.

Link the whole section to:

- [World-graph programme](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md)
- [World-graph contract](/docs/engine/world-graph-kind)
- [Sun Trap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap)

Suggested heading: **“Next: Open the Resort. Regret the Resort.”**

### 3.6 “Later” — horizons, not promises

Show only the major deferred directions already named by the repository:

- session capture after hosting exists;
- content packs when there is a second real content source;
- more locales;
- experiments and longer-term platform work.

Render these as a short unnumbered list with `LATER` labels. Do not assign work-unit numbers,
dates, or percentages. Link to the relevant specs and `TODO.md` rather than expanding their
technical scope on this page.

Suggested aside: “Future Us has been notified. Future Us has not replied.”

### 3.7 Closing handoff

End with three choices:

- **Read the living roadmap** → `/docs/engine/todo`
- **Inspect every merged change** → `/docs/engine/changelog`
- **Browse the repository** → GitHub

Footer language and wordmark should match the landing page. Avoid repeating the landing page's
full philosophical ending.

---

## 4. Visual Design

### 4.1 Reuse, do not imitate

Extract the truly shared foundations instead of copying declarations into `roadmap.css`:

- color and measure tokens;
- base section widths and horizontal padding;
- wordmark, header, navigation, footer, focus, and visually-hidden styles;
- eyebrow/section-index treatment;
- link behavior;
- shared commentary style;
- shared reduced-motion behavior.

Keep landing-specific layouts—architecture diagram, trace, ledgers, worlds, and hero timing—in
`landing.css`. Keep roadmap timeline and checkpoint layouts in `roadmap.css`.

Suggested structure:

```text
site/src/
├── App.tsx
├── roadmap/
│   ├── RoadmapApp.tsx
│   ├── RoadmapApp.test.tsx
│   ├── main.tsx
│   ├── roadmap.css
│   └── roadmapData.ts
├── shared/
│   ├── ExternalLink.tsx
│   ├── SiteFooter.tsx
│   └── SiteHeader.tsx
└── css/
    ├── site.css
    └── motion.css
```

Exact filenames may change if a smaller extraction is clearer, but there must be one source for
shared tokens and header/footer behavior.

### 4.2 The timeline

Use a vertical editorial ledger, not a SaaS card grid and not a winding illustrated path.

Desktop:

- left rail: W range, status, and a pale-blue node on a 1px strong border;
- right rail: headline, plain-language outcome, optional aside, links;
- completed chapters are quiet and evenly spaced;
- the current checkpoint gets the single raised/accent-soft surface;
- future acts retain the rail but use muted nodes and explicit `NEXT`/`LATER` text.

Mobile:

- collapse to one column;
- keep the rail inset inside the 1.5rem page padding;
- put status and W range above the heading;
- never make the user horizontally scroll a commit hash or URL;
- keep links wrapping naturally and preserve a 44px practical tap target through padding or
  line-height where links stand alone.

Status must never be communicated by color alone. Use visible words: `SHIPPED`, `NOW`, `NEXT`,
and `LATER`.

### 4.3 Typography

- Use the existing sans stack for every editorial heading and paragraph.
- Use the existing monospace stack only for W ranges, statuses, commit hashes, and small factual
  labels.
- Keep the roadmap H1 on the same `clamp(1.9rem, 3.6vw, 2.75rem)` scale unless the final copy
  proves it needs a smaller mobile floor.
- Keep H2 scale, letter spacing, and line-height aligned with the landing page.
- Body copy should stay near 1.05–1.15rem with 1.5–1.65 line-height; this page is denser and must
  not use display-sized prose for every milestone.
- Use warm narrative text for outcomes, muted gray for caveats, and accent blue for labels and
  links.

### 4.4 Motion

Reuse `useRevealOnScroll` and the existing reveal CSS only for milestone groups below the first
viewport. The hero and current status paint immediately. No animated progress bar, counters,
parallax, or moving timeline line. Reduced-motion behavior remains a first-class tested state.

---

## 5. Content and Evidence Model

Create a typed `roadmapData.ts` rather than embedding every milestone directly in JSX.

Minimum shape:

```ts
type RoadmapStatus = "shipped" | "now" | "next" | "later";

type RoadmapChapter = {
  id: string;
  workUnits?: string;
  status: RoadmapStatus;
  title: string;
  summary: string;
  aside?: string;
  links: readonly {
    label: string;
    href: string;
    kind: "site" | "repository";
  }[];
};
```

This is a curated public narrative derived from repository evidence, not an automatic parser for
arbitrary prose. `TODO.md` remains canonical. Automation that scrapes Markdown headings would be
fragile today because W41's partial state and programme-level milestones do not share one uniform
syntax with W0–W40.

Add a short source comment above each completed group naming the `TODO.md` range and representative
merge commit. Use immutable full commit URLs for evidence and stable `blob/main` links for living
plans. Display short hashes, but store full hashes in URLs.

Before implementation is committed, rerun:

```powershell
git log --first-parent --pretty=format:'%H|%h|%s'
```

and compare the latest `main` state with `TODO.md` and `plans/39`. If W42 or package publication
has landed, update the grouping, counts, and “Now” section before shipping.

---

## 6. Static Route and Build Design

1. Add `site/roadmap/index.html` with roadmap-specific title, description, canonical URL,
   Open Graph URL, and entry script.
2. Configure Vite's Rollup input for both `site/index.html` and `site/roadmap/index.html`.
3. Emit `dist/index.html` and `dist/roadmap/index.html`; do not rely on SPA fallback.
4. Reuse existing favicon and social image for v1. A roadmap-specific OG image is optional and
   out of scope unless one is deliberately designed.
5. Extend `site/scripts/verify-build.mjs` to check:
   - both HTML entry points exist;
   - roadmap metadata points to `https://game-engine.subzerodev.com/roadmap/`;
   - shared required assets exist;
   - neither entry references development-only source paths after build.
6. Extend the merge verification so `artifacts/docs/roadmap/index.html` is proven present after
   overlay and the `docs/` subtree remains unchanged.

`build/Merge-LandingPage.ps1` already copies non-`index.html`, non-`assets` root entries from the
Vite build. The roadmap directory should therefore merge without a new copy mechanism, but add a
postcondition so that behavior is guaranteed rather than incidental.

---

## 7. Accessibility and Interaction

- One H1 on the roadmap page; milestone names are H2s beneath labelled sections.
- Use a semantic ordered list for chronological completed chapters and a second ordered list for
  next acts.
- Use text status labels in addition to color and rail-node treatment.
- Give the timeline a useful reading order with CSS decoration only; do not add ARIA roles to
  decorative rails or nodes.
- External repository links open in a new tab only if the existing site convention remains;
  include the visually hidden warning every time through the shared component.
- Internal `/`, `/roadmap/`, and `/docs/...` links navigate in place.
- Preserve visible focus rings and sufficient non-text contrast for structural rails.
- Test 320px, 390px, 768px, and 1280px widths with no horizontal overflow.
- Verify keyboard navigation reaches header, jump links, every evidence link, closing actions,
  and footer in visual order.
- The page must remain complete when IntersectionObserver is unavailable or reduced motion is on.

---

## 8. Implementation Sequence

### Phase 1 — Reconfirm truth immediately before coding

- Pull `main` and inspect `TODO.md`, `plans/39`, `plans/40`, tags, and the package registry state.
- Recount merged units and update the proposed hero facts.
- Capture representative full commit hashes for each completed chapter.
- Record any post-W41 merge in this plan before changing page copy.

### Phase 2 — Establish the shared shell

- Extract shared visual tokens and page-shell CSS with no rendered landing-page change.
- Extract header, footer, and external-link behavior into small shared components.
- Update landing tests to prove its existing headings and routes survive the extraction.
- Visually compare the landing page before and after at desktop and mobile widths.

### Phase 3 — Add the real static route

- Add `roadmap/index.html`, roadmap entry point, and multi-page Vite configuration.
- Add route-specific static metadata.
- Prove a direct local request for `/roadmap/` loads without first visiting `/`.

### Phase 4 — Build the roadmap narrative

- Add typed roadmap data and the six completed chapters.
- Add the current W41 checkpoint.
- Add the three world-graph acts and the uncommitted later horizons.
- Add milestone evidence links, canonical roadmap links, and closing actions.
- Apply the humor budget during copy editing, after factual copy is complete.

### Phase 5 — Connect the site

- Add Roadmap to the landing-page header and relevant closing navigation.
- Add Home and current-page treatment to the roadmap header.
- Add a raw Roadmap link to the Docusaurus navbar.
- Correct the stale landing-page and README status claims listed in §1.3.
- Regenerate `docs/src/pages/index.md` from `README.md` using the repository's documented
  generator rather than editing the generated file by hand.

### Phase 6 — Verify the deployment boundary

- Extend component tests and static-build verification.
- Run the Vite production build and verify both output HTML files.
- Build docs when the local tooling is available, merge the Vite output, and assert the roadmap
  route remains present while `docs/` is unchanged.
- Inspect the rendered roadmap at desktop and mobile widths, including reduced motion and keyboard
  focus.

---

## 9. Tests and Gates

### Component tests

- Exactly one roadmap H1 with the approved headline.
- All four visible status words exist.
- Five shipped chapters and one current W41 chapter render in chronological order.
- W41 is labelled current/partial, never fully published.
- W42–W49 are grouped into three future acts and never labelled shipped.
- Representative commit links use full GitHub commit URLs.
- Canonical roadmap, changelog, world-graph plan, and Sun Trap links are correct.
- Roadmap header has `aria-current="page"`; landing header links to `/roadmap/`.

### Static/build tests

- `dist/index.html` and `dist/roadmap/index.html` exist.
- Each has the correct title, canonical URL, Open Graph URL, description, and icons.
- A direct static request to `/roadmap/` succeeds.
- The merged Pages artifact contains `/roadmap/index.html` and leaves `/docs/` intact.

### Required local validation

```powershell
npm --prefix site run check
./build/Test-Documentation.ps1
git diff --check
git status --short --branch
```

Also run the production docs build and merge path when Docker and the installed docs tooling are
available. If unavailable, report that plainly and rely on the PR's `Verify Documentation Build`
check for the real combined artifact.

### Visual acceptance

- The roadmap is unmistakably part of the same site without duplicating the landing page.
- At 1280px the completed history scans as chapters, not a wall of cards.
- At 390px the rail, headings, hashes, and navigation fit without horizontal overflow.
- At 320px long headings and link labels wrap without one-word columns.
- The current checkpoint is the page's only dominant raised surface.
- Humor is noticeable but no status requires understanding a joke.
- Removing all CSS leaves a coherent chronological document.

---

## 10. Done When

- [ ] `/roadmap/` is emitted as a real static route and survives the docs/landing merge.
- [ ] The page uses shared site tokens, typography, header, footer, focus, and link behavior.
- [ ] W0–W41 are represented as five shipped chapters and one accurate current chapter.
- [ ] W41 is explicitly merged-but-unpublished until evidence changes.
- [ ] W42–W49 appear as three plain-language future acts linked to the authoritative programme.
- [ ] Deferred work is shown without dates, percentages, or invented work-unit numbers.
- [ ] Representative completed milestones link to immutable commits or merged PRs.
- [ ] The canonical living roadmap and changelog are prominent.
- [ ] Landing-page and README status contradictions are corrected in the same change.
- [ ] Component, accessibility, responsive, static metadata, multi-page build, and merged-artifact
      checks pass.
- [ ] The deployed route is not announced until the deploy workflow for the merge commit succeeds.

---

## 11. Explicit Non-Goals

- No CMS, GitHub API call, or client-side fetching at runtime.
- No automatic percentage-complete calculation; the programme grows by design.
- No forty-nine-card work-unit catalogue. `TODO.md` already owns that job.
- No dates or delivery forecasts for proposed work.
- No new web fonts, illustration system, icon library, charting library, or router dependency.
- No roadmap-specific backend or package-registry integration.
- No broad rewrite of the landing page or docs information architecture.
- No claim that a scenario is a polished player-facing game.
- No claim that the private package is published until the registry proves it.

---

## Decision Summary

| Decision | Choice |
|---|---|
| Page home | Standalone Vite page at `/roadmap/` |
| Routing | Real multi-page `roadmap/index.html`, not SPA fallback |
| Visual system | Shared extraction from the implemented landing page |
| Font | Existing Inter-first system stack; no new font download |
| Story shape | Five shipped chapters → W41 now → three next acts → later horizons |
| Detail level | Plain-language outcomes with optional technical links |
| Humor | Dry, sparse, and removable without losing meaning |
| Evidence | Curated data backed by `TODO.md`, programme docs, immutable commits, and merged PRs |
| Progress display | Status words and milestones; no percentage bar |
| Current truth | W41 merged and gated, publication pending; W42 next on `main` |
