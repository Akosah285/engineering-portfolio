import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MohrCircleVisualizer } from "../MohrCircleVisualizer";

describe("MohrCircleVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<MohrCircleVisualizer />);
    expect(screen.getByRole("slider", { name: /sigma.*x|σ.*x/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /sigma.*y|σ.*y/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /tau|τ/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /uniaxial/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /pure shear/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a sigma1 counter", () => {
    render(<MohrCircleVisualizer />);
    const counter = document.querySelector(".mc-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/σ1\s*=\s*-?[\d.]+\s*MPa/i);
  });
});
