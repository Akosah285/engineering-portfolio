import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioFilterVisualizer } from "../AudioFilterVisualizer";

describe("AudioFilterVisualizer", () => {
  it("renders all sliders + preset chips + type buttons + canvas", () => {
    render(<AudioFilterVisualizer />);
    expect(screen.getByRole("slider", { name: /cutoff/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /q\b|quality|resonance/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /lowpass at 1 khz/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /notch at 60 hz/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^lowpass$/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^highpass$/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^bandpass$/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^notch$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺\s*reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/filter|lowpass|cutoff|frequenc/i);
  });

  it("emits a cutoff counter", () => {
    render(<AudioFilterVisualizer />);
    const counter = document.querySelector(".af-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/1000\s*hz/i);
  });
});
