import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ShearMomentVisualizer from "../ShearMomentVisualizer";

describe("ShearMomentVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<ShearMomentVisualizer />);
    expect(screen.getByRole("slider", { name: /L|span/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /P\s*\(|point\s*load/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /xP|position/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /w\s*\(|udl|intensity/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /centered.point/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /uniform.load/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a max-moment counter", () => {
    const { container } = render(<ShearMomentVisualizer />);
    const counter = container.querySelector(".sm-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/m_?max|max.*moment|kN/i);
  });
});
