---
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Game Interface — Absurd Adventure Stage and Dashboard

**Document status:** Revision 2 — W63 shipped as Revision 1; §8 is restated as the W66
mobile-first target, proven by the browser test harness W65 stands up, and §§1–7 are unchanged.

**Reading order:** after [`13-playable-web-demo.md`](13-playable-web-demo.md). That document
owns the browser boundary and delivery model; this one owns how the established multi-campaign
play surface should look, move, and communicate.

> **Scope of this document**
>
> Turn `/play/` from a well-styled form into an unmistakable game interface. The visual target
> combines the theatrical scene framing and tactile choice language of a 1990s graphic
> adventure with the busy, satirical status-board energy of a life-simulation board game.
> The result is original work: no copied art, logos, fonts, interface layouts, characters,
> screenshots, sounds, or trade dress from the reference games.

---

## 1. Outcome and Boundary

The finished page should read in this order, before the visitor has read a word:

1. **This is a game.** A framed scene, physical-looking controls, and a visible player status
   area replace the current document-and-buttons silhouette.
2. **This game is knowingly ridiculous.** Bureaucratic stamps, celestial filing tabs,
   suspicious meters, over-labelled panels, and small reactive jokes make the interface part
   of the comic voice.
3. **The story is still the authority.** Decoration frames the authored scene and choices; it
   never rewrites them, changes availability, predicts results, or calculates state.

W63 is a presentation slice over the existing `BrowserClient` and `SessionStore`. It changes
no campaign outcome, action id, projection, persistence format, replay fixture, engine type, or
client-parity rule. React may derive presentation state from the DTO it already receives — for
example, whether a scene ended or whether a visible stat increased — but it may not infer a
game rule or expose hidden state.

W66 extends the same boundary to the device most visitors arrive on. It adds a fourth thing
the page must say before a word is read: **this is comfortable to play on a phone.** The
cabinet, its jokes, and its palette survive intact; what changes is that the phone stops being
the shrunken case and becomes the composed one. Nothing in §8 may relax any sentence above.

## 2. The Two Reference Qualities

The references contribute qualities, not assets or a layout to clone.

| Reference quality | Translation for this project |
|---|---|
| Graphic-adventure stage | One dominant illustrated scene frame, a strong lower action deck, chapter-card transitions, and controls that feel handled rather than submitted |
| Life-simulation board | Chunky status modules, playful meters, visible progress, comic labels, and the sense that several improbable systems are being tracked at once |
| Shared 1990s tactility | Painted texture, bevels, shadows, imperfect edges, saturated accents, and immediate button feedback |
| SubZeroDev voice | Deadpan microcopy, administrative absurdity, cosmic escalation, and jokes delivered as evidence rather than decoration pasted everywhere |

The page must not become pixel-art cosplay. It should feel like a modern browser game that
remembers when interfaces had props, scenery, and nerve.

## 3. Visual Grammar

### 3.1 The stage

The active game sits inside a responsive **cabinet** with four layers:

- a top marquee for campaign title, chapter/scene status, save condition, and the route back
  to the story shelf;
- a dominant scene viewport containing the authored text over an original atmospheric
  backdrop or campaign-colour field;
- a lower action deck containing the available choices as large verb-like controls;
- a side or bottom status console containing only the current `PlayerView` projection.

The cabinet is asymmetric and slightly over-engineered on purpose. Panels may overlap by a
few pixels, labels may resemble stamped metal or paper tabs, and one or two decorative gauges
may be comically specific. The reading order and click targets remain conventional.

### 3.2 Colour and material

The base palette is midnight blue-black, aged parchment, oxidized brass, dusty teal, warning
red, and one campaign accent. Materials are suggested with CSS gradients, restrained noise,
borders, and original raster art; they are never photo-realistic. Text always sits on a
controlled solid or near-solid surface rather than directly on a noisy image.

Campaign theming is presentation metadata owned by the site composition root: an accent,
backdrop id, emblem id, and optional short eyebrow. It is not campaign data and cannot affect
resolution. An unknown campaign receives the complete default cabinet, never an unstyled page.

### 3.3 Type and iconography

- Display type may be condensed, hand-painted, or poster-like, but body and choice text use a
  highly readable face.
- Uppercase is reserved for small labels, stamps, and marquee text; authored prose is never
  transformed to uppercase.
- Icons are original, decorative, and paired with text. No essential action is icon-only.
- Numbers in meters use tabular figures so the console does not jump as state changes.

### 3.4 Absurdity budget

The joke density is controlled. Each visible state gets one **hero absurdity** and at most two
minor ones:

- shelf: a filing-cabinet catalogue with an implausibly official featured-story seal;
- playing: a reactive status prop such as an “Administrative Threat Level” lamp;
- saving: a stamp or pneumatic-tube flourish whose honest status text still says what happened;
- ended: a wildly over-formal outcome placard and a clear next action.

Jokes never replace campaign text, error text, disabled reasons, button labels, or accessible
names. If every surface shouts, the interface has failed.

## 4. Story Shelf

The catalogue becomes a **case-board / archive shelf**, not a grid of generic cards.

- Each campaign is a dossier with original emblem, duration, short description, and status.
- The featured campaign receives scale and position, not a flashing badge or forced modal.
- Selecting a dossier opens a compact briefing panel before `Start`; keyboard focus follows
  the same order as the visual shelf.
- Content notices are integrated into the briefing as plainly worded information. They are
  never dressed as a joke and never concealed behind hover.
- Returning from play restores the visitor's shelf position and selected dossier.

The shelf remains data-driven from the existing browser catalogue. Visual metadata is a
closed site-owned mapping keyed by campaign id; adding a campaign without a mapping is safe.

## 5. Playing Layout

### 5.1 Scene viewport

The scene text is the focal point. It occupies a broad, quiet plate inside the more exuberant
cabinet, supports long prose without internal scrolling at ordinary desktop sizes, and grows
naturally on small screens. Decorative background art is dimmed or masked behind it.

The viewport may display presentation-only context already known to the client — campaign
title, current turn, and ended state — but never raw node ids, localization keys, seed,
action log, or opaque kind state.

### 5.2 Action deck

Choices become large physical-looking controls arranged as a deliberate deck, not HTML form
rows. Their full authored labels remain visible. Hover, focus, pressed, busy, unavailable,
and rejected states are visually distinct:

- hover lifts or illuminates;
- keyboard focus uses a high-contrast outline outside the control;
- pressed visibly depresses before the committed transition;
- busy locks the whole deck against double submission and announces the operation;
- unavailable remains legible with its adjacent reason;
- rejected returns to rest without pretending the scene advanced.

The action deck may use numbered keyboard hints when they are real shortcuts. It must not
reorder actions for visual balance.

### 5.3 Status console

Visible stats become gauges, counters, inventory-like chips, or labelled readouts selected by
value type. The console is a rendering of `PlayerView`, not a second state model. Every gauge
also prints its value; every change is understandable without colour or animation.

Empty state is intentional: campaigns with no visible stats get a campaign-flavoured prop and
a short truthful label, not a fabricated score. The console collapses below the action deck on
narrow screens and never precedes the scene in reading order.

## 6. Transitions, Motion, and Sound

Motion makes state changes feel theatrical while remaining brief:

- starting a campaign closes the briefing like a dossier and reveals the cabinet;
- a committed action uses one 180–300 ms scene transition, then focuses the new scene heading;
- changed visible stats receive one restrained pulse or mechanical tick;
- saving uses one stamp/tube flourish only after success;
- an ending receives a chapter-card reveal without delaying access to its actions.

Reduced motion removes transforms, parallax, wipes, flicker, and staged delays completely.
No interaction waits for an animation to finish before the authoritative state is usable.

Audio is not required by W63. If added later, it is opt-in, muted by default until the visitor
interacts, independently controllable, and never the only signal for feedback.

## 7. Original Asset System

All campaign art is either original project art or CSS-native decoration. Raster assets are
PNG or JPG, with explicit dimensions and responsive crops. Every meaningful image has useful
alternative text; atmospheric backdrops use empty alternative text.

The first asset set is deliberately small:

- one default cabinet backdrop;
- one emblem and one backdrop treatment per campaign shown on the shelf;
- a reusable family of stamps, tabs, gauges, lamps, and frames;
- one ending placard treatment.

Assets load locally from the static build. The page makes no runtime image, font, analytics,
or content request. A failed decorative image load leaves a complete, readable CSS cabinet.

## 8. Responsive and Accessible Behaviour

**Revision 2.** Revision 1 asked the desktop hierarchy to adapt rather than shrink, and the
shipped cabinet does adapt — but it was measured on a desktop. Its authored prose, choice
labels, and controls all resolve below 14 px on a phone, its controls fall short of a
comfortable touch target, and every turn asks the player to scroll past the scene to reach the
choices and then be scrolled back when the scene changes. A retro interface may be cramped on
purpose; it may not be uncomfortable by accident.

The palette, the terminal voice, the stamped labels, the scan-line and offset-shadow
treatments, and the campaign accents are **not** what changes. Retro is the look, not the
size — nothing in this section is served by making the interface look modern.

### 8.1 Type and target floors

One fluid scale governs every width. These are **floors measured at 320 px**, not desktop
values scaled down, and they apply to the desktop compositions too:

| Role | Floor | Notes |
|---|---|---|
| Authored scene prose | 1.125 rem, line-height at least 1.6 | the largest text on the page after the campaign title |
| Choice label | 1.0625 rem | wraps to as many lines as it needs; never truncated, ellipsised, or scaled to fit |
| Cabinet control and shelf dossier title | 1 rem | |
| Visible stat label and value | 0.9375 rem | tabular figures retained |
| Reason, arrival receipt, journey entry, save state | 0.875 rem | player-facing text has no smaller tier |
| Stamped marquee, eyebrow, and disk labels | 0.75 rem | the only permitted small type: decorative, or duplicated by a larger label nearby |

Every interactive control presents a hit area of at least 44 × 44 px at every width, produced
by real padding rather than a transparent overlay, and adjacent choice controls are separated
by at least 8 px of non-actionable space so a mis-tap cannot commit a different turn. Uppercase
transformation is confined to the stamped-label row above; authored prose, choice labels,
reasons, and error text are never uppercased.

### 8.2 The phone reading model

Below 768 px a turn is **two snapped pages**, not one scrolling document:

1. **Scene page** — the authored text fills the viewport. The marquee condenses to a single
   line, and a footer cue names what waits below (“3 choices ⌄”).
2. **Choice page** — the action deck fills the viewport as full-width cards. A condensed
   one-line echo of the scene stays pinned above them so the player never chooses blind, and
   activating that echo returns to the scene page.

The paging is a reading aid, and the rules that keep it one are load-bearing:

- The two pages are one ordinary, continuously scrollable column with
  `scroll-snap-type: y proximity`. Snapping assists; it never traps, never blocks a scroll
  between the pages, and never prevents a tall device from showing both at once.
- Both pages are present in the DOM at all times, in reading order — scene, then actions, then
  status. No choice is conditionally unmounted, hidden behind a gesture, or reachable only
  after an animation.
- The cue is a real button that moves to the choice page. It is never the only route there.
- Committing an action lands the player on the **new** turn's scene page, with focus moving to
  the scene as §6 requires. It never leaves them on a stale choice page.
- No gesture is introduced: no swipe, horizontal paging, drag, long-press, edge gesture, or
  pull-to-refresh interception. Vertical scrolling behaves exactly as the browser's default.
- Reduced motion makes the cue jump and the post-commit return instant. Snapping stays;
  smooth scrolling does not.

The status console follows the choice page in the same column, reached by scrolling on. It is
never a modal sheet and is never required in order to play. At 768 px and above the pages
dissolve into the compositions below and no snapping is applied.

### 8.3 Breakpoint composition

| Width | Composition |
|---|---|
| 1280 px and above | Scene and status console side by side; action deck spans beneath the scene |
| 768–1279 px | Narrower console beside the scene or directly below when prose needs the width |
| 390–767 px | Snapped scene page, then choice page, then status; full-bleed cabinet, simplified trim |
| 320–389 px | Same order and the same §8.1 floors; trim reduces further; no clipped label and no horizontal scrolling |

The two desktop rows are unchanged from Revision 1. Only §8.1's floors reach them.

### 8.4 Viewport, safe areas, and trim

- Full-height panels are measured in dynamic viewport units (`dvh`/`svh`), never `vh`, so a
  collapsing mobile toolbar cannot clip the last choice.
- Every edge that can meet a device inset — pinned echo, cue footer, final choice card, ending
  controls — adds `env(safe-area-inset-*)` padding. No control sits under a notch or home
  indicator.
- Below 768 px the cabinet is full-bleed: page padding goes to zero and the offset drop-shadow
  and double border collapse to a single edge treatment, because an offset shadow outside a
  full-width element is a horizontal-overflow defect at 320 px, not decoration.
- The document never scrolls horizontally at 320, 360, 390, 414, or 768 px in either
  orientation, and a landscape phone under 480 px tall keeps the same order and remains
  scrollable.
- Tap-highlight colour and text-size adjustment on rotation are set deliberately rather than
  left to the platform default. Pinch zoom is never disabled and the viewport is never scaled
  to a fixed width.

### 8.5 Keyboard and assistive behaviour

Everything Revision 1 required still binds: the route is keyboard-complete, native buttons stay
native, focus is never trapped outside the notice dialog, that dialog keeps its labelling,
initial focus, escape behaviour and focus restoration, contrast meets WCAG AA for text and
essential controls in every campaign theme, forced-colours mode retains borders, labels and
focus, and the game stays playable at 200% zoom without two-dimensional scrolling.

Revision 2 adds three:

- **The authored scene is a region, not a heading.** Marking a paragraph of prose as a heading
  makes the phone screen-reader's primary navigation mechanism — the heading rotor — useless,
  because every heading is a wall of story. The scene becomes a labelled region with a short
  real heading, and the post-commit focus target moves with it. This changes markup and the
  focus target; it changes no rendered authored text.
- The choice count named by the cue is derived from the same action list the deck renders, so
  it cannot disagree with what is below it, and it counts shown choices exactly as the deck
  shows them — unavailable ones included, hidden ones absent.
- At 200% zoom on a 390 px phone the layout stays in the narrow composition and still does not
  scroll in two dimensions.

## 9. Performance and Failure Behaviour

- The initial `/play/` route remains useful before decorative art finishes loading.
- Responsive images avoid downloading desktop backdrops at phone sizes.
- No single decorative asset exceeds 500 KB and the initial W63 art budget is 1.5 MB compressed.
- Animation uses opacity and transform where practical; no permanent timer runs while idle.
- A rendering failure preserves `Restart` and `Return to stories` without exposing technical
  state. Persistence warnings remain visible and playable exactly as the browser contract says.
- The production build still emits a direct static `/play/` route, and issues no runtime request
  beyond the same-origin `campaigns/` files `13-playable-web-demo.md` §6 specifies — no engine
  API, no third-party host, no analytics.

## 10. Proof

W63 is accepted by behavior and rendered evidence, not a subjective “looks game-like” claim:

- component tests cover shelf selection, briefing/content notice, every action-control state,
  empty and populated consoles, save feedback, ending actions, and focus restoration;
- browser tests complete one Bureaucracy run and both Lucifer roles through the redesigned UI;
- visual snapshots cover ready, playing, unavailable choice, saving warning, and ended states
  at 320 px, 390 px, 768 px, and 1280 px;
- automated accessibility checks plus a keyboard-only pass cover shelf, play, and ending;
- reduced motion, forced colours, 200% zoom, long authored text, and missing decorative assets
  each have a named check;
- browser/text-client parity and serialized outcomes remain byte-identical, demonstrating that
  the cabinet changed presentation only.

Revision 1 accepted that list on manual inspection, because `site/` had no browser test
harness — its tests run in jsdom, which performs no layout at all. W65 stands one up and
captures the shipped rendering as a baseline **before** anything moves. W66 then adds evidence
that is measured rather than eyeballed, because “feels fine on my phone” is the claim that
produced the sizes it replaces:

- computed type size and hit-area assertions for each §8.1 role, run at 320 px, not asserted
  against the stylesheet's source text;
- a full committed turn driven at 320 px, 390 px, and 768 px portrait plus one landscape
  phone, reaching a choice, committing it, and arriving on the next scene page;
- a horizontal-overflow assertion at every one of those widths, and at 200% zoom;
- a scroll-snap-disabled and a JavaScript-scroll-disabled pass proving both pages and every
  choice remain reachable by ordinary scrolling alone;
- screen-reader-shaped assertions that the scene is a region with a short heading, that the
  authored prose is not a heading, and that focus lands on the scene after a commit.

## 11. Explicit Non-Goals

- New campaigns, story nodes, endings, mechanics, projections, reason codes, or engine APIs.
- A separate visual language per kind; W63 designs the current story shelf and story-graph play
  surface, while leaving extension seams for later simulation and world-graph interfaces.
- Copying or tracing any reference-game asset, screen, character, logo, font, music, or sound.
- A canvas/WebGL rewrite, drag-and-drop verb parser, inventory puzzle system, or point-and-click
  navigation model.
- Mandatory audio, voice acting, cut-scenes, procedural art, or a downloadable asset pack.
- Sacrificing authored prose, mobile layout, accessibility, or load time for ornament.
- Modernising the palette, type family, or terminal voice in the name of a mobile refresh. §8
  changes size, spacing, and reading order only.
- A native shell, app-store wrapper, service worker, PWA install prompt, or offline mode.
- Gesture navigation, a bottom-sheet modal for choices, horizontal paging, a carousel, or any
  control whose only affordance is a swipe.
- Disabling pinch zoom, pinning a fixed viewport width, or a separate mobile route, bundle,
  component tree, or user-agent branch.

## 12. Decision Summary

| Decision | Choice |
|---|---|
| Core metaphor | Absurd adventure cabinet: scene stage + action deck + status console |
| Reference use | Qualities and era, never copied assets or trade dress |
| Authority | Existing `BrowserClient` DTOs and `SessionStore`; presentation only |
| Humour | One hero absurdity plus at most two minor jokes per visible state |
| Campaign themes | Closed, site-owned presentation metadata with a complete default |
| Assets | Original local PNG/JPG plus CSS-native frames and controls |
| Motion | Brief state punctuation; immediate and complete reduced-motion mode |
| Responsive order | Scene before actions before projected status at narrow widths |
| Primary device | Phone-first; the desktop compositions are the wider case, not the reference |
| Type and targets | Prose 1.125 rem, choices 1.0625 rem, 44 px minimum hit area, at every width |
| Phone turn shape | Two scroll-snapped pages — scene, then choices — in one ordinary scrolling column |
| Input | Vertical scroll and taps only; snapping is `proximity`, and no gesture is invented |
| Retro | Palette, type family, and voice are held fixed; only size, spacing, and order move |
| Proof | Interaction, accessibility, visual snapshots, and unchanged parity bytes |
