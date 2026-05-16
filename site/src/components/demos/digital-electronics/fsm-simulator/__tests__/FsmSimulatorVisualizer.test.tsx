import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FsmSimulatorVisualizer from "../FsmSimulatorVisualizer";

describe("FsmSimulatorVisualizer", () => {
  it("renders preset chips, sliders, reset, and a state counter", () => {
    const { container } = render(<FsmSimulatorVisualizer />);

    expect(screen.getByRole("option", { name: /start.then.pause/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /start.pause.resume/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /reset.from.running/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /never.started/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /step \(0\.\.n\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /input sequence/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset fsm simulation/i })).toBeTruthy();

    const counter = container.querySelector(".fsm-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/state=(IDLE|RUNNING|PAUSED)/);
  });

  it("after start-then-pause sequence at step=4, state is PAUSED", () => {
    const { container } = render(<FsmSimulatorVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /start.then.pause/i }));

    const stepSlider = screen.getByRole("slider", { name: /step \(0\.\.n\)/i }) as HTMLInputElement;
    fireEvent.change(stepSlider, { target: { value: "4" } });

    const counter = container.querySelector(".fsm-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/state=PAUSED/);
  });
});
