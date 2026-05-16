import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeatEquationVisualizer } from "../HeatEquationVisualizer";

describe("HeatEquationVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<HeatEquationVisualizer />);
    expect(screen.getByRole("slider", { name: /alpha|α/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /dt/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /grid|nGrid/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /sine.mode.1|sine mode 1/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /gaussian/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
  });

  it("emits a t counter", () => {
    render(<HeatEquationVisualizer />);
    const counter = document.querySelector(".he-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/t\s*=\s*[\d.]+\s*s/i);
  });
});
