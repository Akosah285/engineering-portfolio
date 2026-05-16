import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewtonsMethodVisualizer } from "../NewtonsMethodVisualizer";

describe("NewtonsMethodVisualizer", () => {
  it("renders all sliders + preset chips + canvas", () => {
    render(<NewtonsMethodVisualizer />);

    expect(
      screen.getByRole("slider", { name: /initial guess|x₀|x0/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /tolerance/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /max iterations/i }),
    ).toBeTruthy();

    expect(
      screen.getByRole("option", { name: /square root of 2/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /bad seed/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();

    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/newton|root|iterat/i);
  });

  it("emits a step counter starting at 0", () => {
    render(<NewtonsMethodVisualizer />);
    const counter = document.querySelector(".nm-visualizer__counter");
    expect(counter).toBeTruthy();
    const normalised = (counter?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(normalised).toBe("step 0 / 20");
  });
});
