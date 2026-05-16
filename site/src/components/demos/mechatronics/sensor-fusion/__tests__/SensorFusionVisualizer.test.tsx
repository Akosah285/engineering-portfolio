import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SensorFusionVisualizer from "../SensorFusionVisualizer";

describe("SensorFusionVisualizer", () => {
  it("renders preset chips, sliders, reset, and an RMS-error counter", () => {
    const { container } = render(<SensorFusionVisualizer />);

    expect(screen.getByRole("option", { name: /clean.tilt/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /gyro.drift/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /noisy.accel/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /step.change/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /alpha \(gyro weight\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /scenario/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset sensor fusion/i })).toBeTruthy();

    const counter = container.querySelector(".sf-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/rms error/i);
  });

  it("noisy-accel scenario reports finite RMS error", () => {
    const { container } = render(<SensorFusionVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /noisy.accel/i }));
    const counter = container.querySelector(".sf-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/rms error.*=\s*[\d.]+/i);
  });
});
