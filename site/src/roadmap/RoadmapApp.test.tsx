import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RoadmapApp from "./RoadmapApp";
import {
  completedWorkUnitCount,
  currentAct,
  nextActs,
  shippedChapters,
} from "./roadmapData";

describe("roadmap page", () => {
  it("renders one truthful headline and all status groups", () => {
    render(<RoadmapApp />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `How a Quick Question Became ${completedWorkUnitCount} Work Units.`,
    );
    expect(screen.getAllByText("DONE")).toHaveLength(8);
    expect(screen.getAllByText("NOW")).toHaveLength(1);
    expect(screen.getAllByText("NEXT")).toHaveLength(2);
    expect(screen.getAllByText("LATER")).toHaveLength(3);
    const checkpoint = screen.getByText("02 / NOW").closest("section");
    expect(checkpoint).not.toBeNull();
    expect(
      within(checkpoint as HTMLElement).getByRole("heading", {
        level: 2,
        name: currentAct.title,
      }),
    ).toBeVisible();
  });

  it("keeps shipped work chronological and future work explicitly future", () => {
    expect(shippedChapters.map((chapter) => chapter.workUnits)).toEqual([
      "W0–W8",
      "W9–W19",
      "W20–W26",
      "W27–W31",
      "W32–W40",
      "W41–W42",
      "W43–W44",
      "W45–W46",
    ]);
    expect(nextActs.map((chapter) => chapter.workUnits)).toEqual([
      "W47",
      "W48",
      "W49",
    ]);
    expect(nextActs.every((chapter) => chapter.status !== "done")).toBe(true);
    expect(currentAct.workUnits).toBe("W47");
    expect(shippedChapters[0]?.links[0]?.href).toMatch(
      /^https:\/\/github\.com\/The-Running-Dev\/SubZeroDev\.GameEngine\/commit\/[0-9a-f]{40}$/,
    );
  });

  it("marks the roadmap navigation as the current page", () => {
    render(<RoadmapApp />);
    expect(screen.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
