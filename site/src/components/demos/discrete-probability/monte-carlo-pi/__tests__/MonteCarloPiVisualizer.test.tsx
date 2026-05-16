import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonteCarloPiVisualizer } from "../MonteCarloPiVisualizer";

describe("MonteCarloPiVisualizer", () => {
  it("renders all sliders + preset chips + canvas", () => {
    render(<MonteCarloPiVisualizer />);
    expect(screen.getByRole("slider", { name: /seed/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /target|samples/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /speed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /slow & visible/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /standard/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /noisy small sample/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/monte\s*carlo|π|pi|sample/i);
  });

  it("emits a sample counter starting at 0", () => {
    render(<MonteCarloPiVisualizer />);
    const counter = document.querySelector(".mc-visualizer__counter");
    expect(counter).toBeTruthy();
    const normalised = (counter?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(normalised).toBe("n 0 / 10000");
  });
});
