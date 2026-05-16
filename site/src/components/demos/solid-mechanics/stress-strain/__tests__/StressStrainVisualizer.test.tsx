import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StressStrainVisualizer } from "../StressStrainVisualizer";

describe("StressStrainVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<StressStrainVisualizer />);
    expect(screen.getByRole("slider", { name: /E.*GPa/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /yield/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /ultimate/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /mild steel|mild.steel/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /aluminum/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a yield stress counter", () => {
    render(<StressStrainVisualizer />);
    const counter = document.querySelector(".ss-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/σ_y\s*=\s*\d+\s*MPa/i);
  });
});
