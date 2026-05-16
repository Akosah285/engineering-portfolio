import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RpmVisualizer from "../RpmVisualizer";

describe("RpmVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<RpmVisualizer />);
    expect(screen.getByRole("slider", { name: /trueRpm|true.*rpm|speed/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^ppr\b|pulses.*rev/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /window/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^N\b|moving|average/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /noise/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /low.rpm.clean/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /high.rpm/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits an RPM counter", () => {
    const { container } = render(<RpmVisualizer />);
    const counter = container.querySelector(".rpm-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/rpm|instant|window|avg/i);
  });
});
