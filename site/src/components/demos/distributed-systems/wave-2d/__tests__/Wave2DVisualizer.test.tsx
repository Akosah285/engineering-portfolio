import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Wave2DVisualizer from "../Wave2DVisualizer";

describe("Wave2DVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<Wave2DVisualizer />);
    expect(screen.getByRole("slider", { name: /nGrid|grid/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^c\b|speed/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^dt\b|timestep/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /source/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /single.pulse/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /two.source/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a step/maxAmp counter", () => {
    const { container } = render(<Wave2DVisualizer />);
    const counter = container.querySelector(".w2-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/step|n\s*=|max|amp|cfl/i);
  });
});
