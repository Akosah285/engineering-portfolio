import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrussAnalyzerVisualizer from "../TrussAnalyzerVisualizer";

describe("TrussAnalyzerVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<TrussAnalyzerVisualizer />);
    expect(screen.getByRole("slider", { name: /load.*mag|magnitude/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /load.*joint|joint/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /zero|show.*member/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /simple.triangle/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /warren/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a forces counter", () => {
    const { container } = render(<TrussAnalyzerVisualizer />);
    const counter = container.querySelector(".tr-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/tension|compression|kN|max|member/i);
  });
});
