import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GamblersRuinVisualizer } from "../GamblersRuinVisualizer";

describe("GamblersRuinVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<GamblersRuinVisualizer />);
    expect(
      screen.getByRole("slider", { name: /^target wealth|^N\b|^total/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^starting|^initial|^k\b/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^win prob|^p\b|^probability/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^number of walks|^walks/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^seed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /fair coin/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /house edge/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /lucky player/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/ruin|walk|wealth|gambler/i);
  });

  it("emits a walks counter starting at 0", () => {
    render(<GamblersRuinVisualizer />);
    const counter = document.querySelector(".gr-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/walks\s*0\s*\/\s*\d+/);
  });
});
