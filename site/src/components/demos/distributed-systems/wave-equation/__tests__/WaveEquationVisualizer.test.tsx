import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WaveEquationVisualizer from "../WaveEquationVisualizer";

describe("WaveEquationVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<WaveEquationVisualizer />);
    expect(screen.getByRole("slider", { name: /c \(|wave speed/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /dt/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /nGrid|grid/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /mode/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /fundamental/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /second.harmonic/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a CFL/time counter", () => {
    const { container } = render(<WaveEquationVisualizer />);
    const counter = container.querySelector(".we-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/cfl|r\s*=|time|t\s*=/i);
  });
});
