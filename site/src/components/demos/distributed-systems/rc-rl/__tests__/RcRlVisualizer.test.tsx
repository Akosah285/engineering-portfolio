import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RcRlVisualizer from "../RcRlVisualizer";

describe("RcRlVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<RcRlVisualizer />);
    expect(screen.getByRole("slider", { name: /mode|circuit/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^R\b|resistance/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^C\b|capacitance/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^L\b|inductance/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /Vstep|voltage|step/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /fast.rc.charge/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rl.step/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a tau / t90 counter", () => {
    const { container } = render(<RcRlVisualizer />);
    const counter = container.querySelector(".rcrl-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/τ|tau|t90|t_90/i);
  });
});
