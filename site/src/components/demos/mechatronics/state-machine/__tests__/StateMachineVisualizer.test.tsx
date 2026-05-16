import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateMachineVisualizer } from "../StateMachineVisualizer";

describe("StateMachineVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<StateMachineVisualizer />);
    expect(screen.getByRole("slider", { name: /step delay/i })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /find.wall|find wall/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /goal.from.start|goal from start/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
  });

  it("emits a step counter starting at 0", () => {
    render(<StateMachineVisualizer />);
    const counter = document.querySelector(".sm-visualizer__counter");
    expect(counter).toBeTruthy();
    const text = (counter?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(text).toMatch(/step\s+0\s*\/\s*\d+/i);
  });
});
