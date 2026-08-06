import { act, render, screen } from "@testing-library/react";
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

  it("leaves initial focus alone until a notice has actually been dismissed", () => {
    render(<PlayApp />);

    expect(
      screen.getByRole("button", { name: "Load selected adventure" }),
    ).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("dismisses the notice with Escape and keeps Tab inside it", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    const open = screen.getByRole("button", {
      name: "Load selected adventure",
    });
    await user.click(open);

    const confirm = screen.getByRole("button", { name: "Continue loading" });
    const back = screen.getByRole("button", { name: "Back" });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(back).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab({ shift: true });
    expect(back).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Before loading this program" }),
    ).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });

  it("re-shows the content notice before any repeat run", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));
    await screen.findByText(/handwritten/i, { selector: ".scene-body" });

    await user.click(screen.getByRole("button", { name: "Quit to library" }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Before loading this program" }),
    ).toBeVisible();
  });

  it("ignores a submission that resolves after the player quits to the library", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));

    const action = await screen.findByRole("button", {
      name: /Wait for the municipal registry/i,
    });
    await act(async () => {
      action.click();
      screen.getByRole("button", { name: "Quit to library" }).click();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Adventure disk library" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Quit to library" }),
    ).not.toBeInTheDocument();
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
      await screen.findByText(/handwritten/i, { selector: ".scene-body" }),
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

  it("marks the authored scene as a labelled region with a short real heading, not the prose itself (W66.8)", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /The Bureaucracy/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));
    await screen.findByText(/handwritten/i, { selector: ".scene-body" });

    const region = screen.getByRole("region", { name: "Scene" });
    expect(region).toHaveFocus();
    expect(
      screen.queryByRole("heading", { name: /handwritten/i }),
    ).not.toBeInTheDocument();
  });

  it("names the scene-cue button after exactly the shown choices (W66's phone reading model)", async () => {
    const user = userEvent.setup();
    render(<PlayApp />);

    await user.click(screen.getByRole("button", { name: /Enterprise/i }));
    await user.click(
      screen.getByRole("button", { name: "Load selected adventure" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue loading" }));
    await screen.findByRole("button", { name: /choices? ⌄/ });

    const deck = document.querySelector(".action-deck");
    const shownChoices = deck?.querySelectorAll(".action-card").length ?? 0;
    expect(shownChoices).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", {
        name: new RegExp(`^${shownChoices} choices?`),
      }),
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
