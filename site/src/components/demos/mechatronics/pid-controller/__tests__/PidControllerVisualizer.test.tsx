import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PidControllerVisualizer } from "../PidControllerVisualizer";

describe("PidControllerVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<PidControllerVisualizer />);
    expect(screen.getByRole("slider", { name: /^kp\b|^proportional/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^ki\b|^integral/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^kd\b|^derivative/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^setpoint/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^tau|^time constant|^plant/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /p only/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /tuned pid/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /aggressive/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/pid|control|setpoint|gain/i);
  });

  it("emits a time counter", () => {
    render(<PidControllerVisualizer />);
    const counter = document.querySelector(".pid-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/t\s*=\s*0/);
  });
});
