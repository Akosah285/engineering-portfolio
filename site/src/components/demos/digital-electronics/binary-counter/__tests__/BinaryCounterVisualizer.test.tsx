import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BinaryCounterVisualizer from "../BinaryCounterVisualizer";

describe("BinaryCounterVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<BinaryCounterVisualizer />);
    expect(screen.getByRole("slider", { name: /bits/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /nTicks|ticks/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /initial|start/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /4.bit.up/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /4.bit.down/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a count counter", () => {
    const { container } = render(<BinaryCounterVisualizer />);
    const counter = container.querySelector(".bc-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/count|0x|carry|\d/i);
  });
});
