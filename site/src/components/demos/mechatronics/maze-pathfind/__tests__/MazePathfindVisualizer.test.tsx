import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MazePathfindVisualizer from "../MazePathfindVisualizer";

describe("MazePathfindVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<MazePathfindVisualizer />);
    expect(screen.getByRole("slider", { name: /algorithm|search/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /grid|size/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /wall|density/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /seed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /open.grid.bfs/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /maze.astar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a visited/path counter", () => {
    const { container } = render(<MazePathfindVisualizer />);
    const counter = container.querySelector(".mp-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/visited|path|cells|len/i);
  });
});
