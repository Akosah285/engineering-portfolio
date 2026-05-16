import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LorenzVisualizer } from "../LorenzVisualizer";

describe("LorenzVisualizer", () => {
  it("renders all sliders + preset chips + canvas", () => {
    render(<LorenzVisualizer />);
    expect(screen.getByRole("slider", { name: /^dt/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^integration time|^t.end|^end time/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^speed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /lorenz butterfly/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /van der pol/i })).toBeTruthy();
    expect(screen.getAllByRole("option", { name: /pendulum/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/lorenz|trajectory|rk4|integrat/i);
  });

  it("emits a step counter", () => {
    render(<LorenzVisualizer />);
    const counter = document.querySelector(".lz-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/step 0 \/ \d+/);
  });
});
