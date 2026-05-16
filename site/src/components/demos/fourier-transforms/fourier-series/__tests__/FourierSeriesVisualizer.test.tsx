import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FourierSeriesVisualizer } from "../FourierSeriesVisualizer";

describe("FourierSeriesVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<FourierSeriesVisualizer />);
    expect(screen.getByRole("slider", { name: /^max harmonics|^harmonics/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^step delay|^delay/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /square wave \(gibbs\)/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /sawtooth/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /triangle/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/fourier|harmonic|partial|gibbs/i);
  });

  it("emits a harmonic counter", () => {
    render(<FourierSeriesVisualizer />);
    const counter = document.querySelector(".fs-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/N\s*=\s*1/);
  });
});
