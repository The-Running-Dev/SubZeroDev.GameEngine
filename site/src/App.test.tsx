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
});
