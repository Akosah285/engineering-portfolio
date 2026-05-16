import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TruthTableVisualizer from "../TruthTableVisualizer";

describe("TruthTableVisualizer", () => {
  it("renders sliders, preset carousel, and table controls", () => {
    render(<TruthTableVisualizer />);
    expect(screen.getByRole("slider", { name: /gate|operation/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /nInputs|inputs/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /and.2input/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /xor/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("emits a rows/minterms counter", () => {
    const { container } = render(<TruthTableVisualizer />);
    const counter = container.querySelector(".tt-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/row|minterm|true|count/i);
  });
});
