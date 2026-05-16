import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LagrangeSplineVisualizer } from "../LagrangeSplineVisualizer";

describe("LagrangeSplineVisualizer", () => {
  it("renders preset chips + toggles + canvas", () => {
    render(<LagrangeSplineVisualizer />);
    expect(
      screen.getByRole("option", { name: /runge.s function.*equispaced/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /runge.s function.*chebyshev/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /smooth sine/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/lagrange|spline|interpolat|node/i);
  });

  it("emits a nodes counter", () => {
    render(<LagrangeSplineVisualizer />);
    const counter = document.querySelector(".ls-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/\d+\s*nodes/);
  });
});
