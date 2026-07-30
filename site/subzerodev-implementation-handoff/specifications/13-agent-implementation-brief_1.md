# Agent Implementation Brief

Use this document as the direct prompt for a coding agent after supplying the repository.

## Objective

Design and implement a polished custom Docusaurus landing page for the SubZeroDev Game Engine.

The page should feel like a beautifully designed technical essay rather than a normal documentation homepage or generic SaaS landing page.

## Product idea

The engine is a deterministic gameplay and simulation platform based on reusable mechanics, validated commands, replayable worlds, and separation between mechanics, content, and presentation.

Primary line:

> Build mechanics once. Create infinite games.

Signature line:

> Well... why not?

## Origin

The project began because the author missed *Jones in the Fast Lane* and asked an LLM to explain its mechanics.

The LLM described jobs, needs, education, schedules, money, progression, relationships, and random events, then began suggesting implementation ideas.

The author realized those mechanics should not be written for only one game.

This escalated into a reusable deterministic game engine.

The page must tell this true story rather than invent a corporate origin.

## Tone

- dry
- intelligent
- deadpan
- technically credible
- quietly confident
- approximately 5–10% humor
- never parody
- never generic marketing

Reference feeling:

> Apple-like restraint, Stripe-like clarity, Linear-like typography, with Douglas Adams-style deadpan timing.

Do not clone those brands.

## Required page sequence

1. Hero
2. Origin hook
3. Repeated-mechanics problem
4. Reusability realization
5. Architecture
6. The engine does not know what a dragon is
7. Games are data / gameplay is code
8. Things the engine refuses to do
9. Things it happily does
10. Full origin story
11. Architecture/docs/GitHub CTAs
12. Signature footer

## Technical instructions

1. Inspect repository instructions and conventions before editing.
2. Implement as a custom Docusaurus React homepage.
3. Reuse existing dependencies and design tokens where appropriate.
4. Avoid adding an animation library unless clearly necessary.
5. Keep primary content statically rendered.
6. Use semantic HTML.
7. Ensure keyboard access.
8. Support reduced motion.
9. Make mobile layout deliberate.
10. Preserve normal documentation behavior.
11. Do not invent routes, engine features, benchmarks, or implementation status.
12. Use actual repository terminology after inspection.
13. Run all available validation and build steps.
14. Report changed files, decisions, tests, and unresolved questions.

## Suggested files

```text
src/pages/index.tsx
src/pages/index.module.css
src/components/landing/*
src/css/landing/*
src/data/landingPageContent.ts
```

Adjust to repository conventions.

## Constraints

Do not:

- create a giant feature-card grid
- use gradient-heavy AI visuals
- add particle effects
- add fake testimonials
- use 3D decorative renders
- overuse icons
- make every line a joke
- rewrite the documentation voice
- use profanity in primary public copy
- claim the engine supports features not present in the repository

## Acceptance criteria

- visually compelling at first glance
- recognizably not a stock template
- narrative remains understandable without animation
- architecture is clear and accurate
- humor is memorable but restrained
- page works at 320px width
- keyboard focus is visible
- reduced motion works
- build passes
- internal links work
- docs remain conventional
