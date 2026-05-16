import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SolarTrackerVisualizer from "../SolarTrackerVisualizer";

describe("SolarTrackerVisualizer", () => {
  it("renders preset chips, sliders, reset, and a direction counter", () => {
    const { container } = render(<SolarTrackerVisualizer />);

    expect(screen.getByRole("option", { name: /morning.east/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /noon.balanced/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /evening.west/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /slightly.east/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /panel angle \(°\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /deadband/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /sky scenario/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset solar tracker/i })).toBeTruthy();

    const counter = container.querySelector(".st-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/direction:/i);
  });

  it("morning-east scenario reports direction: east", () => {
    const { container } = render(<SolarTrackerVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /morning.east/i }));
    const counter = container.querySelector(".st-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/direction:\s*east/i);
  });
});
