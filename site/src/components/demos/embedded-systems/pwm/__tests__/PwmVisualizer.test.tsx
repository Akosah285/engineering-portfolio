import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PwmVisualizer } from "../PwmVisualizer";

describe("PwmVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<PwmVisualizer />);
    expect(screen.getByRole("slider", { name: /^frequency|^freq/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^duty/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^vhigh|^v high|^high voltage/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^vlow|^v low|^low voltage/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /motor control/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /heater/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /servo/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/pwm|duty|frequency|pulse|average/i);
  });

  it("emits a frequency/duty counter", () => {
    render(<PwmVisualizer />);
    const counter = document.querySelector(".pw-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/f\s*=/);
  });
});
