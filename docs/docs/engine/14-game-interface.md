---
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Game Interface — Absurd Adventure Stage and Dashboard

**Document status:** Revision 1 — agreed W63 design target

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

The same hierarchy adapts rather than merely shrinking:

| Width | Composition |
|---|---|
| 1280 px and above | Scene and status console side by side; action deck spans beneath the scene |
| 768–1279 px | Narrower console beside the scene or directly below when prose needs the width |
| 390–767 px | Single column: marquee, scene, actions, status; decoration simplifies |
| 320–389 px | Same order, smaller cabinet trim, full-width controls, no clipped labels or horizontal scrolling |

The route remains keyboard-complete. Native buttons stay native. Focus is never trapped in the
cabinet or shelf briefing. The content notice, if modal, receives correct dialog labelling,
initial focus, escape behavior, and focus restoration. Contrast meets WCAG AA for text and
essential controls in every campaign theme. Forced-colours mode retains borders, labels, and
focus. At 200% zoom the game remains playable without two-dimensional scrolling.

## 9. Performance and Failure Behaviour

- The initial `/play/` route remains useful before decorative art finishes loading.
- Responsive images avoid downloading desktop backdrops at phone sizes.
- No single decorative asset exceeds 500 KB and the initial W63 art budget is 1.5 MB compressed.
- Animation uses opacity and transform where practical; no permanent timer runs while idle.
- A rendering failure preserves `Restart` and `Return to stories` without exposing technical
  state. Persistence warnings remain visible and playable exactly as the browser contract says.
- The production build still emits a direct static `/play/` route and makes no runtime network
  request for engine or campaign content.

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

## 11. Explicit Non-Goals

- New campaigns, story nodes, endings, mechanics, projections, reason codes, or engine APIs.
- A separate visual language per kind; W63 designs the current story shelf and story-graph play
  surface, while leaving extension seams for later simulation and world-graph interfaces.
- Copying or tracing any reference-game asset, screen, character, logo, font, music, or sound.
- A canvas/WebGL rewrite, drag-and-drop verb parser, inventory puzzle system, or point-and-click
  navigation model.
- Mandatory audio, voice acting, cut-scenes, procedural art, or a downloadable asset pack.
- Sacrificing authored prose, mobile layout, accessibility, or load time for ornament.

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
| Proof | Interaction, accessibility, visual snapshots, and unchanged parity bytes |
