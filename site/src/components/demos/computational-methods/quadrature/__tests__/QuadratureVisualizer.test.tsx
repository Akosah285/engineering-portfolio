import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuadratureVisualizer } from "../QuadratureVisualizer";

describe("QuadratureVisualizer", () => {
  it("renders all sliders + preset chips + canvas + rule buttons", () => {
    render(<QuadratureVisualizer />);

    // Sliders
    expect(screen.getByRole("slider", { name: /lower|a/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /upper|b/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /subintervals|n/i }),
    ).toBeTruthy();

    // Function preset chips
    expect(screen.getByRole("option", { name: /quadratic/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /gaussian/i })).toBeTruthy();

    // Rule selector buttons
    expect(screen.getByRole("option", { name: /rectangle/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /simpson/i })).toBeTruthy();

    // Reset action
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();

    // Narration mentions the demo subject
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/integ|quadratur|midpoint|rule/i);
  });

  it("emits a subinterval counter", () => {
    render(<QuadratureVisualizer />);
    const counter = document.querySelector(".qd-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/n\s*=\s*8/);
  });
});
