import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GradientDescentVisualizer } from "../GradientDescentVisualizer";

describe("GradientDescentVisualizer", () => {
  it("renders all four sliders + preset chips + canvas", () => {
    render(<GradientDescentVisualizer />);

    // Sliders
    expect(screen.getByRole("slider", { name: /learning rate/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /momentum/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /start x/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /start y/i })).toBeTruthy();

    // Preset chips for the 5 PRESETS (rendered as role=option inside listbox)
    expect(screen.getByRole("option", { name: /bowl \(vanilla\)/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rosenbrock/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /vanishing plateau/i })).toBeTruthy();

    // Pause + Reset action buttons (use exact name to disambiguate)
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();

    // Narration line (aria-live region) describes the default state
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/quadratic|gradient descent/i);
  });

  it("emits a step counter starting at 0", () => {
    render(<GradientDescentVisualizer />);
    // Counter renders across split text nodes; query the parent by class.
    const counter = document.querySelector(".gd-visualizer__counter");
    expect(counter).toBeTruthy();
    const normalised = (counter?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(normalised).toBe("step 0 / 400");
  });
});
