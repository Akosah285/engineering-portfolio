import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EulerBucklingVisualizer } from "../EulerBucklingVisualizer";

describe("EulerBucklingVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<EulerBucklingVisualizer />);
    expect(screen.getByRole("slider", { name: /^L\b/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /E.*GPa/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /area/i })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /pinned.pinned|pinned pinned/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /fixed.free|fixed free|cantilever/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a P_cr counter", () => {
    render(<EulerBucklingVisualizer />);
    const counter = document.querySelector(".eb-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/P_cr\s*=\s*[\d.]+\s*kN/i);
  });
});
