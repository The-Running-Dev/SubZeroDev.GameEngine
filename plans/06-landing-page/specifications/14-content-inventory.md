# Content Inventory and Decision Log

## Core retained phrases

### Primary

> Build mechanics once. Create infinite games.

> Well... why not?

### Origin

> I missed Jones in the Fast Lane.

> So I asked an LLM how it worked.

> That was a mistake.

### Escalation

> Then it started suggesting implementation details.

> That was unfortunate.

> Wait. Why would I write this for one game?

> That question changed everything.

### Problem

> Game engines solved rendering.

> Then we spent thirty years rewriting inventory systems.

> That seemed... inefficient.

### Engine abstraction

> The engine doesn't know what a dragon is.

> Or a detective.

> Or a hotel.

> Or a spaceship.

> Or Bulgaria.

> It only understands deterministic simulation.

### Philosophy

> Games are data. Gameplay is code.

### Humans and AI

> Humans and AI submit the exact same commands.

> Equality is important.

> Especially when both are about to violate validation rules.

### Closing

> Started because someone asked an LLM the wrong question.

> Built because nobody stopped asking better ones.

## Optional phrases

- Apparently that seemed reasonable.
- Started as a joke. Escalated responsibly.
- No inventory systems were harmed during the making of this engine. Probably.
- JavaScript frameworks reproduce faster than rabbits.
- Future Us will probably appreciate the effort.
- It should have given a shorter answer.
- Seriously. Why not?
- Reality remains inconvenient.

## Phrases to avoid or use sparingly

- revolutionary
- next generation
- future of gaming
- disrupt
- unlock
- seamless
- powerful
- robust
- enterprise-grade
- AI-powered, unless specifically relevant and accurate
- any line implying the project took years when it took less than a week to begin

## Decisions already made

- `Well... why not?` stays.
- The origin story is a homepage element, not hidden background.
- The page is a standalone React SPA under `site/`, not part of the documentation site.
- Dark only. No light mode, no toggle.
- The homepage may be funny; the docs should become serious.
- Humor target is restrained.
- No generic SaaS look.
- No elaborate illustration required.
- Typography and whitespace carry the design.
- The truth is more memorable than a polished origin myth.

## Repository-specific decisions — ALL RESOLVED

Every item below was an open question requiring inspection. The audit in
`00-repository-reality.md` answered all of them; that document is the authority.

| Was open | Resolved |
|---|---|
| Exact engine name and capitalization | SubZeroDev Game Engine |
| Actual layer terminology | `Core → Kinds → Campaigns → Clients` (§1). No `Mechanics`, no `Games` |
| Existing visual brand | None to inherit — new standalone project |
| Current homepage route and component | The docs site's `/` is README-generated and stays. The landing page is separate (§5, §6) |
| GitHub link, architecture path, docs entry route | Route inventory (§3), as absolute cross-site URLs |
| Light-mode requirements | Dark only. No toggle, no `prefers-color-scheme` branch (§6) |
| Whether the default navbar/footer should remain | Not applicable — the site owns its own shell |
| Whether a live demo exists | No. Blocked until `advance(state, action)` exists. Do not fake one |
| Whether replay and AI command validation are implemented | Replay is **planned** (post-MVP); command validation is a **contract**. Capability matrix, §2 |

One item genuinely remains open: **hosting**, which is undecided and not to be reconstructed.

The capability matrix is a snapshot. Re-check it whenever a work item lands — see §2.
