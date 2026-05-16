import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BendingStressVisualizer from "../BendingStressVisualizer";

describe("BendingStressVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<BendingStressVisualizer />);
    expect(screen.getByRole("slider", { name: /^M\b|moment/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /kind|section/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /dim1|width|outer/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /dim2|height/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rect.shallow/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /solid.circle/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a sigma-max counter", () => {
    const { container } = render(<BendingStressVisualizer />);
    const counter = container.querySelector(".bn-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/sigma|σ|max|stress|MPa|Pa/i);
  });
});
