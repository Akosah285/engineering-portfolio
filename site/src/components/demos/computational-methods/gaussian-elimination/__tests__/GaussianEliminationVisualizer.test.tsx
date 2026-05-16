import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GaussianEliminationVisualizer } from "../GaussianEliminationVisualizer";

describe("GaussianEliminationVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<GaussianEliminationVisualizer />);
    expect(screen.getByRole("slider", { name: /^step delay|^delay/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /3x3 simple/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /needs swap/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /4x4/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /singular/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/gauss|elimin|pivot|row|matrix/i);
  });

  it("emits a step counter starting at 1", () => {
    render(<GaussianEliminationVisualizer />);
    const counter = document.querySelector(".ge-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/step\s*1/);
  });
});
