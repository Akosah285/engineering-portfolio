import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DomainColoringVisualizer from "../DomainColoringVisualizer";

describe("DomainColoringVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<DomainColoringVisualizer />);
    expect(screen.getByRole("slider", { name: /gridSize|resolution/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /fnSlot|function|f\(z\)/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /identity|^z\b/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /z.squared|z\^?2/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a function/grid counter", () => {
    const { container } = render(<DomainColoringVisualizer />);
    const counter = container.querySelector(".dc-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/f\(z\)|grid|function|px/i);
  });
});
