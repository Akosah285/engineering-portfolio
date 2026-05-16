import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KarnaughMinimizerVisualizer from "../KarnaughMinimizerVisualizer";

describe("KarnaughMinimizerVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<KarnaughMinimizerVisualizer />);
    expect(screen.getByRole("slider", { name: /nVars|variables/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /and.gate/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /xor/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /majority/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a cubes/literals counter", () => {
    const { container } = render(<KarnaughMinimizerVisualizer />);
    const counter = container.querySelector(".km-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/cube|literal|implicant|prime/i);
  });
});
