import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BodePlotVisualizer } from "../BodePlotVisualizer";

describe("BodePlotVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<BodePlotVisualizer />);
    expect(screen.getByRole("slider", { name: /^start decade/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^end decade/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^points per decade|^points/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /first.order/i })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /underdamped|second.order/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /lead compensator/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /lag compensator/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /notch/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/bode|magnitude|phase|frequency|transfer/i);
  });

  it("emits a points counter", () => {
    render(<BodePlotVisualizer />);
    const counter = document.querySelector(".bo-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/\d+\s*points/);
  });
});
