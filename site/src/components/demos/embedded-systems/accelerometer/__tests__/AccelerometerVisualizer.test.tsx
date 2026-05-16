import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AccelerometerVisualizer from "../AccelerometerVisualizer";

describe("AccelerometerVisualizer", () => {
  it("renders preset chips, sliders, reset, and a shakes counter", () => {
    const { container } = render(<AccelerometerVisualizer />);

    expect(screen.getByRole("option", { name: /flat.still/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /slow.tilt/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /two.shakes/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /upside.down/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /cursor \(sample idx\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /shake threshold \(g\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /motion pattern/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset accelerometer/i })).toBeTruthy();

    const counter = container.querySelector(".accel-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/shakes detected/i);
  });

  it("two-shakes pattern reports nonzero shakes at default threshold", () => {
    const { container } = render(<AccelerometerVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /two.shakes/i }));
    const counter = container.querySelector(".accel-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/shakes detected:\s*[1-9]\d*/i);
  });
});
