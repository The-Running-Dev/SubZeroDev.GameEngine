import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PlayApp from "./PlayApp";

describe("PlayApp cabinet presentation", () => {
  it("renders a selectable dossier shelf and opens a plain-language briefing", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    expect(
      screen.getByRole("heading", { name: "The story shelf" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));

    expect(
      screen.getByRole("heading", { name: "The Bureaucracy" }),
    ).toBeVisible();
    expect(
      screen.getByText("Estimated duration: 10–15 min per route"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open dossier and start" }),
    ).toBeVisible();
  });

  it("uses a labelled notice dialog and restores focus after closing it", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    const open = screen.getByRole("button", { name: "Open dossier and start" });
    await user.click(open);
    expect(
      screen.getByRole("dialog", { name: "Before opening this file" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(open).toHaveFocus();
  });

  it("starts the cabinet without exposing engine internals", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Open dossier and start" }),
    );
    await user.click(
      screen.getByRole("button", { name: "I understand — start" }),
    );

    expect(
      await screen.findByRole("heading", { name: /handwritten/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Status console" }),
    ).toBeVisible();
    expect(screen.getByText("LOCAL CHECKPOINT")).toBeVisible();
    expect(
      screen.queryByText(/actionLog|kindState|seed/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Your story begins here.")).toBeVisible();
  });

  it("records only committed projected pages in the read-only journey", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Open dossier and start" }),
    );
    await user.click(
      screen.getByRole("button", { name: "I understand — start" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /Wait for the municipal registry/i,
      }),
    );

    expect(screen.getByText("You chose")).toBeVisible();
    expect(screen.getByText("Wait for the municipal registry")).toBeVisible();
    expect(screen.getByText("which brought you here.")).toBeVisible();

    await user.click(screen.getByText("Journey so far"));
    expect(screen.getByText(/Where I came from:/)).toBeVisible();
    expect(
      screen.queryByText(/actionLog|kindState|currentNodeId|seed/i),
    ).not.toBeInTheDocument();
  });
});
