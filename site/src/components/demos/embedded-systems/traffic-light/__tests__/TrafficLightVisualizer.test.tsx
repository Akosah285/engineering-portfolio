import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrafficLightVisualizer } from "../TrafficLightVisualizer";

describe("TrafficLightVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<TrafficLightVisualizer />);
    expect(screen.getByRole("slider", { name: /green/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /yellow/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /all.red|allred/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /normal/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /flash/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
  });

  it("emits a t counter starting near 0", () => {
    render(<TrafficLightVisualizer />);
    const counter = document.querySelector(".tl-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/t\s*=\s*[\d.]+\s*s/i);
  });
});
