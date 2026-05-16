import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConvolutionVisualizer } from "../ConvolutionVisualizer";

describe("ConvolutionVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<ConvolutionVisualizer />);
    expect(screen.getByRole("slider", { name: /^n samples|^samples/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^slide speed|^speed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rect.*rect.*triangle/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rect.*expdecay|rect.*exp/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/convol|slide|signal|kernel/i);
  });

  it("emits a shift counter starting at 0", () => {
    render(<ConvolutionVisualizer />);
    const counter = document.querySelector(".cv-visualizer__counter");
    expect(counter).toBeTruthy();
    expect((counter?.textContent ?? "")).toMatch(/shift\s*0\s*\/\s*\d+/);
  });
});
