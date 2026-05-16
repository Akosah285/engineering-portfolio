import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CentralLimitVisualizer } from "../CentralLimitVisualizer";

describe("CentralLimitVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<CentralLimitVisualizer />);
    expect(screen.getByRole("slider", { name: /^n\b|^sample size/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^number of samples|^samples/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^seed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /uniform.*n=1/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /uniform.*n=30/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /exponential/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /bernoulli/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/central limit|clt|distribution|sample mean|normal/i);
  });

  it("emits an n counter", () => {
    render(<CentralLimitVisualizer />);
    const counter = document.querySelector(".cl-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/n\s*=\s*\d+/);
  });
});
