import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EpicycleVisualizer } from "../EpicycleVisualizer";

describe("EpicycleVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<EpicycleVisualizer />);
    expect(screen.getByRole("slider", { name: /^num terms|^terms/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^sample points|^samples/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^cycle speed|^speed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^circle$/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /square wave/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /heart/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /figure-eight|lissajous/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/epicycle|fourier|terms|path/i);
  });

  it("emits a terms counter", () => {
    render(<EpicycleVisualizer />);
    const counter = document.querySelector(".ep-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/terms\s*\d+\s*\/\s*\d+/);
  });
});
