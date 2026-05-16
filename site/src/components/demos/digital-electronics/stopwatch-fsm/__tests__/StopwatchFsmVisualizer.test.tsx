import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StopwatchFsmVisualizer from "../StopwatchFsmVisualizer";

describe("StopwatchFsmVisualizer", () => {
  it("renders preset chips, sliders, reset, and an elapsed counter", () => {
    const { container } = render(<StopwatchFsmVisualizer />);

    expect(screen.getByRole("option", { name: /start.stop.once/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /with.laps/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /reset.from.paused/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /never.pressed/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /current time \(ms\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /event log/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset stopwatch fsm/i })).toBeTruthy();

    const counter = container.querySelector(".sw-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/elapsed:/i);
  });

  it("with-laps preset reports at least one lap when scrubbed past lapReset events", () => {
    const { container } = render(<StopwatchFsmVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /with.laps/i }));

    const t = screen.getByRole("slider", { name: /current time \(ms\)/i }) as HTMLInputElement;
    fireEvent.change(t, { target: { value: "1500" } });

    const counter = container.querySelector(".sw-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/laps:\s*[1-9]\d*/i);
  });
});
