import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import App from "./App";
import RoadmapApp from "./roadmap/RoadmapApp";
import {
  assertMinGap,
  assertMinHitArea,
  assertNoHorizontalOverflow,
} from "./test/browser/assertions";
import { clearEmulatedMedia, emulateMedia } from "./test/browser/cdp";

/**
 * W105.5: the two published entry surfaces this repository owns -- the landing
 * page and the roadmap -- rendered at the widths already committed for this
 * site (390px portrait phone, 1280px desktop; the retired
 * `viewport.browser.test.tsx` and `visual-baseline.browser.test.tsx` used the
 * same pair) and checked for the four failures the criterion names: horizontal
 * overflow, clipped navigation, an unreachable primary link, and overlap.
 *
 * jsdom cannot back any of these -- it performs no layout, so every assertion
 * here reads a real `getBoundingClientRect` from a real Chromium tab. The
 * documentation entry pages are Docusaurus routes built from a container image
 * and are reviewed as committed screenshots instead (`site/screenshots/`),
 * because nothing in this package renders them.
 */

const WIDTHS = [
  { label: "phone", width: 390, height: 844 },
  { label: "desktop", width: 1280, height: 800 },
] as const;

/** Every link the header exposes at both widths, in DOM order. */
/**
 * These are inline text links in running copy, not buttons -- 44px (14 §8's
 * touch-target rule for the retired play cabinet) does not apply and never
 * did. The floor here is only "laid out, with real area a pointer can land
 * on", which is what an *unreachable* link fails.
 */
const MIN_HIT_PX = 16;

const NAV_LANDING = ["Roadmap", "Play", "Documentation", "GitHub"] as const;
const NAV_ROADMAP = ["Home", ...NAV_LANDING] as const;

/**
 * `ExternalLink` appends a visually-hidden " (opens in a new tab)" to its
 * label, so a link's accessible name is either the label or the label plus
 * that suffix. Matching on both keeps one lookup for internal and external
 * links alike.
 */
function byLabel(label: string) {
  return (accessibleName: string): boolean =>
    accessibleName === label ||
    accessibleName === `${label} (opens in a new tab)`;
}

function navLinks(names: readonly string[]): HTMLElement[] {
  const nav = screen.getByRole("navigation", { name: "Explore the project" });
  return names.map((name) => {
    const link = screen
      .getAllByRole("link", { name: byLabel(name) })
      .find((candidate) => nav.contains(candidate));
    if (link === undefined) {
      throw new Error(`header navigation is missing the "${name}" link`);
    }
    return link;
  });
}

/** Fully laid out inside the viewport, horizontally -- nothing cut off at either edge. */
function assertNotClipped(element: Element, viewportWidth: number): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.left < -0.5 || rect.right > viewportWidth + 0.5) {
    throw new Error(
      `expected the element to sit inside 0..${viewportWidth}px, got left ${rect.left.toFixed(2)}px, right ${rect.right.toFixed(2)}px`,
    );
  }
}

afterEach(async () => {
  await page.viewport(1280, 800);
  await clearEmulatedMedia();
});

describe.each(WIDTHS)(
  "published entry pages at $label ($width px)",
  ({ width, height }) => {
    // The reveal-on-scroll hook starts sections hidden until an intersection is
    // observed; reduced motion is the shipped path that renders them immediately,
    // so measuring under it measures the whole page rather than its first screen.
    async function mount(node: React.ReactElement): Promise<void> {
      await page.viewport(width, height);
      await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }]);
      render(node);
    }

    it("renders the landing page without horizontal overflow", async () => {
      await mount(<App />);
      await screen.findByRole("heading", { level: 1 });
      assertNoHorizontalOverflow();
    });

    it("renders the roadmap without horizontal overflow", async () => {
      await mount(<RoadmapApp />);
      await screen.findByRole("heading", { level: 1 });
      assertNoHorizontalOverflow();
    });

    it("keeps the landing navigation unclipped, reachable and non-overlapping", async () => {
      await mount(<App />);
      const links = navLinks(NAV_LANDING);
      for (const link of links) {
        assertNotClipped(link, width);
        assertMinHitArea(link, MIN_HIT_PX);
      }
      for (let i = 1; i < links.length; i += 1) {
        assertMinGap(links[i - 1]!, links[i]!, 0);
      }
    });

    it("keeps the roadmap navigation unclipped, reachable and non-overlapping", async () => {
      await mount(<RoadmapApp />);
      const links = navLinks(NAV_ROADMAP);
      for (const link of links) {
        assertNotClipped(link, width);
        assertMinHitArea(link, MIN_HIT_PX);
      }
      for (let i = 1; i < links.length; i += 1) {
        assertMinGap(links[i - 1]!, links[i]!, 0);
      }
    });

    it("keeps every landing primary call to action reachable", async () => {
      await mount(<App />);
      for (const name of [
        "Read the architecture",
        "View the documentation",
        "Play the adventures",
      ]) {
        const [link] = screen.getAllByRole("link", { name: byLabel(name) });
        assertNotClipped(link!, width);
        assertMinHitArea(link!, MIN_HIT_PX);
      }
    });
  },
);

/**
 * `assertNotClipped` is the one check here with no self-test in
 * `assertions.browser.test.ts`, because it is local to this file. Same rule
 * as that module's: a capability that has never failed is not known to
 * constrain anything.
 */
describe("assertNotClipped", () => {
  it("fails for the right reason when an element runs past the right edge", async () => {
    await page.viewport(390, 844);
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:300px;top:0;width:200px;height:20px";
    document.body.append(el);
    try {
      expect(() => assertNotClipped(el, 390)).toThrow(/inside 0\.\.390px/);
    } finally {
      el.remove();
    }
  });

  it("passes when the same element fits", async () => {
    await page.viewport(390, 844);
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:100px;top:0;width:200px;height:20px";
    document.body.append(el);
    try {
      expect(() => assertNotClipped(el, 390)).not.toThrow();
    } finally {
      el.remove();
    }
  });
});
