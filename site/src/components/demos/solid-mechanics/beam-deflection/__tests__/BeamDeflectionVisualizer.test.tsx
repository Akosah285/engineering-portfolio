import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeamDeflectionVisualizer } from "../BeamDeflectionVisualizer";

describe("BeamDeflectionVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<BeamDeflectionVisualizer />);
    expect(screen.getByRole("slider", { name: /^L\b/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /E.*GPa/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /I.*cm/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /cantilever.*point/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /simply.supported.*udl/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a v_max counter", () => {
    render(<BeamDeflectionVisualizer />);
    const counter = document.querySelector(".bd-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/v_max\s*=\s*[\d.]+\s*mm/i);
  });
});
