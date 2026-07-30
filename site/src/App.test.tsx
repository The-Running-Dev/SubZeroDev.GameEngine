import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("landing page", () => {
  it("renders its one page-level heading and approved primary line", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Build Mechanics Once. Create Infinite Games.",
    );
    expect(screen.getAllByText("Well... why not?")).toHaveLength(2);
  });

  it("uses the verified root-relative documentation routes", () => {
    // Root-relative, not absolute: the landing page is packaged to be served
    // at "/" with the docs at "/docs" on the same origin.
    render(<App />);

    expect(
      screen.getByRole("link", { name: "Read the architecture" }),
    ).toHaveAttribute("href", "/docs/engine/architecture");
    expect(
      screen.getByRole("link", { name: "View the documentation" }),
    ).toHaveAttribute("href", "/docs/");
  });

  it("presents every architecture layer and kind as links without interaction", () => {
    render(<App />);

    expect(screen.getAllByRole("link", { name: "Core" })[0]).toHaveAttribute(
      "href",
      "/docs/engine/core",
    );
    expect(
      screen.getAllByRole("link", { name: "story-graph" })[0],
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "simulation" })[0],
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "world-graph" })[0],
    ).toBeVisible();
  });

  it("exposes banner, main and contentinfo landmarks", () => {
    // header and footer only carry these roles when they are NOT inside <main>.
    render(<App />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("gives the architecture diagram an announceable text alternative", () => {
    // aria-label is ignored on a bare div, so the group role is load-bearing.
    render(<App />);

    expect(
      screen.getByRole("group", { name: /Core is inherited by Kinds/i }),
    ).toBeInTheDocument();
  });

  it("keeps documentation links in place and announces the one that is not", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: "View the documentation" }),
    ).not.toHaveAttribute("target");
    expect(
      screen.getByRole("link", { name: /Browse the repository/ }),
    ).toHaveAccessibleName(/opens in a new tab/i);
  });

  it("links Campaigns at content packs rather than vision", () => {
    render(<App />);

    expect(
      screen.getAllByRole("link", { name: "Campaigns" })[0],
    ).toHaveAttribute("href", "/docs/engine/content-packs");
  });

  it("chains every section to the next with a real anchor, not just the hero", () => {
    // The hero's "Scroll. It escalates." used to be the only anchor on the
    // page, reaching exactly one section further. Every section now has both
    // a stable id and a link to the next one, so the chain reaches the end.
    render(<App />);

    const chain = [
      "top",
      "origin",
      "problem",
      "realization",
      "architecture",
      "abstraction",
      "contract",
      "principles",
      "resolution",
      "worlds",
      "continue",
    ];

    for (const id of chain) {
      expect(document.getElementById(id)).not.toBeNull();
    }

    const continueLinks = screen.getAllByRole("link", { name: /Continue/ });
    const targets = continueLinks.map((link) =>
      link.getAttribute("href")?.slice(1),
    );
    // Every section but the hero and the last one links to the next: nine
    // links, each one step ahead of the section that holds it.
    expect(targets).toEqual(chain.slice(2));
  });

  it("names the real campaigns in the closing payoff, not placeholder titles", () => {
    // The engine has no announced projects beyond the three flagship
    // campaigns already verified in the architecture diagram. This section
    // must reuse the same names, not invent new ones.
    render(<App />);

    const worldsSection = document.getElementById("worlds");
    expect(worldsSection).not.toBeNull();
    expect(worldsSection?.textContent).toContain(
      "Bulgaria: Make-Your-Own-Adventure",
    );
    expect(worldsSection?.textContent).toContain("Life in the Fast Lane");
    expect(worldsSection?.textContent).toContain("Sun Trap");
    // Nothing is playable yet -- "Coming Soon" would overclaim status.
    expect(worldsSection?.textContent).not.toMatch(/coming soon/i);
  });

  it("leaves revealed content visible when no observer exists", () => {
    // The failure mode worth testing: a reveal that never fires must not hide
    // content. Without IntersectionObserver the hook must decline to add
    // .js-reveal at all, since that class is what applies the hidden state.
    const original = window.IntersectionObserver;
    // @ts-expect-error deliberately removing the API to simulate absence
    delete window.IntersectionObserver;

    try {
      render(<App />);
      expect(document.documentElement.classList.contains("js-reveal")).toBe(
        false,
      );
      expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      window.IntersectionObserver = original;
    }
  });

  it("reveals content once it intersects, and unobserves it", () => {
    const observed: Element[] = [];
    const unobserved: Element[] = [];
    let trigger: ((entries: unknown[]) => void) | undefined;

    class FakeObserver {
      constructor(cb: (entries: unknown[]) => void) {
        trigger = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve(el: Element) {
        unobserved.push(el);
      }
      disconnect() {}
    }

    const original = window.IntersectionObserver;
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    try {
      render(<App />);
      expect(document.documentElement.classList.contains("js-reveal")).toBe(
        true,
      );
      expect(observed.length).toBeGreaterThan(0);

      const first = observed[0];
      trigger?.([{ isIntersecting: true, target: first }]);

      expect(first.getAttribute("data-reveal")).toBe("shown");
      expect(unobserved).toContain(first);
    } finally {
      window.IntersectionObserver = original;
      document.documentElement.classList.remove("js-reveal");
    }
  });
});
