import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LaplaceRectVisualizer from "../LaplaceRectVisualizer";

describe("LaplaceRectVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<LaplaceRectVisualizer />);
    expect(screen.getByRole("slider", { name: /nGrid|grid/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /top/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /bottom/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /left/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /right/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /omega|ω/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /hot.top/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /alternating/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits an iterations counter", () => {
    const { container } = render(<LaplaceRectVisualizer />);
    const counter = container.querySelector(".lp-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/iter|residual|converged/i);
  });
});
