import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StepPositionVisualizer from "../StepPositionVisualizer";

describe("StepPositionVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<StepPositionVisualizer />);
    expect(screen.getByRole("slider", { name: /current|start/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /target/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /maxSteps|rate|speed/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /accel/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /trapezoidal|profile/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /short.move/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /reverse/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a steps/elapsed counter", () => {
    const { container } = render(<StepPositionVisualizer />);
    const counter = container.querySelector(".sp-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/step|elapsed|s\b|time/i);
  });
});
