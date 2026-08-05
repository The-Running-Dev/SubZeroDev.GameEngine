import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PlayApp from "./PlayApp";

describe("PlayApp cabinet presentation", () => {
  it("renders a selectable dossier shelf and opens a plain-language briefing", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    expect(
      screen.getByRole("heading", { name: "Adventure disk library" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));

    expect(
      screen.getByRole("heading", { name: "The Bureaucracy" }),
    ).toBeVisible();
    expect(
      screen.getByText("Estimated duration: 10–15 min per route"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Load selected adventure" }),
    ).toBeVisible();
  });

  it("uses a labelled notice dialog and restores focus after closing it", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    const open = screen.getByRole("button", {
      name: "Load selected adventure",
    });
    await user.click(open);
    expect(
      screen.getByRole("dialog", { name: "Before loading this program" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(open).toHaveFocus();
  });

  it("starts the cabinet without exposing engine internals", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));

    expect(
      await screen.findByRole("heading", { name: /handwritten/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Player status" }),
    ).toBeVisible();
    expect(screen.getByText("GAME SAVED")).toBeVisible();
    expect(
      screen.queryByText(/actionLog|kindState|seed/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("PROGRAM LOADED. YOUR STORY BEGINS HERE."),
    ).toBeVisible();
  });

  it("records only committed projected pages in the read-only journey", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));
    await user.click(
      await screen.findByRole("button", {
        name: /Wait for the municipal registry/i,
      }),
    );

    expect(screen.getByText("Last command")).toBeVisible();
    expect(screen.getByText("Wait for the municipal registry")).toBeVisible();
    expect(screen.getByText("// accepted")).toBeVisible();

    await user.click(screen.getByText("Travel log"));
    expect(screen.getByText(/Where I came from:/)).toBeVisible();
    expect(
      screen.queryByText(/actionLog|kindState|currentNodeId|seed/i),
    ).not.toBeInTheDocument();
  });
});
