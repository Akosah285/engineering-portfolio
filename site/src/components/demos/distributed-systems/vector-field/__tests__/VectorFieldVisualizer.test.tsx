import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VectorFieldVisualizer from "../VectorFieldVisualizer";

describe("VectorFieldVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<VectorFieldVisualizer />);
    expect(screen.getByRole("slider", { name: /coloring|color/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /field|kind/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^nx\b|grid.*x/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^ny\b|grid.*y/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /uniform.flow/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /vortex/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a max-magnitude counter", () => {
    const { container } = render(<VectorFieldVisualizer />);
    const counter = container.querySelector(".vf-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/max|f|div|curl/i);
  });
});
