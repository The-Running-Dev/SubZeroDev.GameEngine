# Publication review screenshots (W105.5)

Reviewed renderings of the two published entry surfaces, at the widths this site already
commits to elsewhere — 390×844 (portrait phone) and 1280×800 (desktop). The retired
`viewport.browser.test.tsx` and `visual-baseline.browser.test.tsx` used the same pair, and
`vitest.browser.config.ts` still opens its tab at 1280×800.

| File                                       | Surface               | Served from                  |
| ------------------------------------------ | --------------------- | ---------------------------- |
| `landing-{phone-390,desktop-1280}.png`     | `/`                   | this package's `dist/`       |
| `roadmap-{phone-390,desktop-1280}.png`     | `/roadmap/`           | this package's `dist/`       |
| `docs-index-{phone-390,desktop-1280}.png`  | `/docs/`              | the `docs/` Docusaurus image |
| `docs-vision-{phone-390,desktop-1280}.png` | `/docs/engine/vision` | the `docs/` Docusaurus image |

Each was captured full-page with reduced motion emulated, so the reveal-on-scroll sections
render rather than staying hidden below the first screen.

**What the review found:** no horizontal overflow at either width on any of the eight
renderings (`documentElement.scrollWidth` equals `clientWidth` in every case), no clipped
navigation, no overlapping controls, and every primary link laid out and reachable. On the
phone width the documentation site collapses its sidebar behind the hamburger control and
puts wide tables in their own scroll containers, so the page itself never scrolls sideways.

These are evidence, not a gate. The gate for the two surfaces this package _can_ render is
`src/publication.browser.test.tsx`, which asserts the same four properties from real layout in
a Chromium tab on every `npm run check`. Nothing here renders the Docusaurus routes — those
are built from a container image — so for those two pages the screenshots are the whole record.
Recapture them when either surface changes materially.
