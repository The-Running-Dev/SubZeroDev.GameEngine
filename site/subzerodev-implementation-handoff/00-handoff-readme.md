# SubZeroDev Landing Page — Implementation Handoff

## Objective

Design and implement a custom Docusaurus homepage for the SubZeroDev Game Engine.

The homepage should feel like a restrained, technically credible editorial essay that gradually reveals the serious architecture behind the project's accidental origin.

The primary product line is:

> Build mechanics once. Create infinite games.

The signature is:

> Well... why not?

---

## Authority order

When instructions, terminology, claims, or wording differ, use this order:

1. **Repository instructions and verified repository evidence**
2. **`01-implementation-plan.md`**
3. **`02-approved-homepage-copy.md`**
4. **Files inside `specifications/`**

Repository evidence includes:

- `AGENTS.md` and other repository instructions;
- actual code and exported APIs;
- current architecture documentation;
- existing routes;
- package and build configuration;
- established brand assets and design tokens;
- current tests and CI requirements.

The specification files preserve product reasoning, creative context, alternatives, and implementation guidance. They are not all final decisions. Do not revive an older alternative when the plan or approved copy has already resolved it.

---

## Required working method

### First: repository truth audit

Before changing code, inspect the repository and produce a short findings note covering:

- actual engine name and capitalization;
- verified architecture layer names;
- implemented, contractual, planned, and unsupported capabilities;
- existing homepage and Docusaurus structure;
- documentation, architecture, GitHub, and blog routes;
- current navbar, footer, theme, fonts, logo, and visual tokens;
- package manager and required validation commands;
- accessibility or browser-support conventions;
- conflicts between the approved copy and repository evidence;
- proposed homepage integration strategy.

Do not edit the homepage until this audit is complete.

### Second: reconcile claims

Every technical statement in the approved copy must be checked against the repository.

If a statement is:

- **implemented**, it may be stated directly;
- **an architectural contract**, label or phrase it appropriately;
- **planned**, do not present it as current behavior;
- **unsupported**, remove it or request clarification.

Pay particular attention to:

- determinism;
- replay;
- command validation;
- serialization;
- time progression;
- renderer independence;
- multiple presentations;
- AI and human use of the same command interface;
- `Core`, `Mechanics`, `Kinds`, `Campaigns`, and `Games`.

### Third: implement by gated phases

Follow `01-implementation-plan.md` in order:

1. Repository truth audit
2. Product claims and content lock
3. Static semantic page
4. Visual system and responsive composition
5. Architecture interaction
6. Motion and progressive enhancement
7. Verification and release readiness

Do not make motion or interaction responsible for primary content.

---

## Binding creative direction

The design concept is:

> Cold logic, warm accident.

The page should be:

- minimal;
- editorial;
- technical;
- deliberate;
- dark by default unless repository conventions require another choice;
- typography-led;
- spacious;
- quietly confident;
- dryly funny in approximately 5–10% of the copy.

The architecture is the primary visual material.

Avoid:

- generic SaaS layouts;
- giant feature-card grids;
- decorative 3D objects;
- stock game imagery;
- neon cyberpunk styling;
- generic AI gradients;
- particles;
- scroll-jacking;
- fake terminals;
- fake testimonials;
- invented metrics;
- excessive icons;
- unsupported technical claims.

Do not position the project as:

- a replacement for Unity, Unreal, or Godot;
- a no-code game creator;
- an unconstrained AI game generator;
- a universal engine for every genre;
- production-ready unless the repository proves that status.

---

## Content rules

- Preserve the Jones in the Fast Lane origin.
- Preserve “Build mechanics once. Create infinite games.”
- Preserve “Well... why not?”
- Use the opening origin section as the trigger and the later origin section as the resolution; do not tell the same story twice.
- Let the page become more technical and less humorous as it approaches documentation.
- Keep AI references limited to the true origin and any verified command-boundary discussion.
- Prefer short, concrete statements over marketing adjectives.
- Do not rewrite the documentation voice to match the homepage.

The copy in `02-approved-homepage-copy.md` is approved editorial direction, subject only to repository truth and route verification.

---

## Completion requirements

The implementation is complete only when:

- the homepage is recognizably product-specific;
- the origin story and architectural insight form one coherent narrative;
- architecture terminology is verified;
- the complete story works without animation;
- content remains available without client-side JavaScript;
- architecture interaction supports keyboard, pointer, and touch;
- reduced-motion behavior is complete;
- focus is visible;
- WCAG AA contrast is met;
- the page works without horizontal overflow at 320px;
- routes and CTA destinations are real;
- documentation behavior remains unchanged;
- repository-required checks and production build pass;
- no unsupported capability is presented as current fact.

---

## Required final report

Report:

- repository findings and terminology decisions;
- claims changed after verification;
- files changed;
- major visual and interaction decisions;
- validation performed and results;
- accessibility and responsive checks;
- known limitations;
- deferred enhancements;
- unresolved questions.

Do not report a claim as verified unless it was supported by repository evidence or an authoritative project document.

