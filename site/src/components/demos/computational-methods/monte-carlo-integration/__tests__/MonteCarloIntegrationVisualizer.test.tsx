import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonteCarloIntegrationVisualizer } from "../MonteCarloIntegrationVisualizer";

describe("MonteCarloIntegrationVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<MonteCarloIntegrationVisualizer />);
    expect(
      screen.getByRole("slider", { name: /^n samples|^samples/i }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^seed/i })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /x.*2.*dx|x squared/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /sin.*x.*dx|sine/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /e.*x.*dx|exponential/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /runge/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/integrat|monte carlo|estimate|sample/i);
  });

  it("emits an n counter", () => {
    render(<MonteCarloIntegrationVisualizer />);
    const counter = document.querySelector(".mi-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/n\s*=\s*\d+/);
  });
});
