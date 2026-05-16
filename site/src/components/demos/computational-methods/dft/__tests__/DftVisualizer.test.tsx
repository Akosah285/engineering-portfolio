import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DftVisualizer } from "../DftVisualizer";

describe("DftVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<DftVisualizer />);
    expect(screen.getByRole("slider", { name: /^n\b|^sample count/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^sample rate|^rate/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /single sinusoid/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /sum of sinusoids/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /square wave/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /noisy/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/dft|spectrum|frequency|signal|fourier/i);
  });

  it("emits an N counter", () => {
    render(<DftVisualizer />);
    const counter = document.querySelector(".df-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/N\s*=\s*\d+/);
  });
});
