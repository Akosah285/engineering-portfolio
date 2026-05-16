import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FaradayVisualizer from "../FaradayVisualizer";

describe("FaradayVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<FaradayVisualizer />);
    expect(screen.getByRole("slider", { name: /^N\b|turns/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^B\b|field/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^A\b|area/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /omega|angular|ω/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /single.turn/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /high.turn|generator/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a peak-EMF counter", () => {
    const { container } = render(<FaradayVisualizer />);
    const counter = container.querySelector(".far-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/peak|emf|ε|V|period|T/i);
  });
});
