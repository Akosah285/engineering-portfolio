import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import InterruptPollingVisualizer from "../InterruptPollingVisualizer";

describe("InterruptPollingVisualizer", () => {
  it("renders preset chips, sliders, reset, and a latency counter", () => {
    const { container } = render(<InterruptPollingVisualizer />);

    expect(screen.getByRole("option", { name: /sparse/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /bursty/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /steady.stream/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /high.rate/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /poll period \(ms\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /interrupt latency \(ms\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /workload/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset interrupt vs polling/i })).toBeTruthy();

    const counter = container.querySelector(".ip-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/poll mean:/i);
  });

  it("counter reports finite numbers for both modes", () => {
    const { container } = render(<InterruptPollingVisualizer />);
    const counter = container.querySelector(".ip-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/poll mean:\s*\d+(\.\d+)?ms/i);
    expect(counter?.textContent ?? "").toMatch(/isr mean:\s*\d+(\.\d+)?ms/i);
  });
});
