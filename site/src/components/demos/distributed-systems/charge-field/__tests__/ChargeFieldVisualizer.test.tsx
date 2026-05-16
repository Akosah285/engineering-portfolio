import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ChargeFieldVisualizer from "../ChargeFieldVisualizer";

describe("ChargeFieldVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<ChargeFieldVisualizer />);
    expect(screen.getByRole("slider", { name: /^nx\b|grid.*x/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^ny\b|grid.*y/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /arrow.*scale/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /potential/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /single.positive/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /dipole/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a charges/max-E counter", () => {
    const { container } = render(<ChargeFieldVisualizer />);
    const counter = container.querySelector(".cf-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/charge|max|\|E\||field/i);
  });
});
