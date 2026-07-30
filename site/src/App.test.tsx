import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("landing page", () => {
  it("renders its one page-level heading and approved primary line", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Build mechanics once. Create infinite games.",
    );
    expect(screen.getAllByText("Well... why not?")).toHaveLength(2);
  });

  it("uses the verified absolute documentation routes", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: "Read the architecture" }),
    ).toHaveAttribute(
      "href",
      "https://game-engine.subzerodev.com/docs/engine/architecture",
    );
    expect(
      screen.getByRole("link", { name: "View the documentation" }),
    ).toHaveAttribute("href", "https://game-engine.subzerodev.com/docs/");
  });

  it("presents every architecture layer and kind as links without interaction", () => {
    render(<App />);

    expect(screen.getAllByRole("link", { name: "Core" })[0]).toHaveAttribute(
      "href",
      "https://game-engine.subzerodev.com/docs/engine/core",
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
    ).toHaveAttribute(
      "href",
      "https://game-engine.subzerodev.com/docs/engine/content-packs",
    );
  });
});
