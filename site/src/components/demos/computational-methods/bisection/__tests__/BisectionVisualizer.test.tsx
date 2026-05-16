import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BisectionVisualizer } from "../BisectionVisualizer";

describe("BisectionVisualizer", () => {
  it("renders all sliders + preset chips + canvas", () => {
    render(<BisectionVisualizer />);
    expect(screen.getByRole("slider", { name: /^left endpoint/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^right endpoint/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^tolerance/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^max iterations/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /square root of 2/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /transcendental/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/bisection|root|bracket/i);
  });

  it("emits a step counter starting at 0", () => {
    render(<BisectionVisualizer />);
    const counter = document.querySelector(".bi-visualizer__counter");
    expect(counter).toBeTruthy();
    const normalised = (counter?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(normalised).toBe("step 0 / 30");
  });
});
