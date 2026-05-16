import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdcSamplingVisualizer from "../AdcSamplingVisualizer";

describe("AdcSamplingVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<AdcSamplingVisualizer />);
    expect(screen.getByRole("slider", { name: /^f\b|frequency/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /fs|sample\s*rate/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /bits/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /amp|amplitude/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /no.alias|clean/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /aliased|fold/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits an aliased-frequency counter", () => {
    const { container } = render(<AdcSamplingVisualizer />);
    const counter = container.querySelector(".adc-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/alias|hz|f_?alias/i);
  });
});
