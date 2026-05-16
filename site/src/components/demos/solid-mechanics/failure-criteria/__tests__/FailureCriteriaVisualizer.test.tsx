import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FailureCriteriaVisualizer from "../FailureCriteriaVisualizer";

describe("FailureCriteriaVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<FailureCriteriaVisualizer />);
    expect(screen.getByRole("slider", { name: /s1|σ1|sigma.*1/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /s2|σ2|sigma.*2/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /sy|σy|yield/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /pure.tension/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /biaxial/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a safety-factor counter", () => {
    const { container } = render(<FailureCriteriaVisualizer />);
    const counter = container.querySelector(".fc-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/SF|safety|factor|tresca|mises|rankine/i);
  });
});
