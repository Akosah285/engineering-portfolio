import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import VhdlWaveformVisualizer from "../VhdlWaveformVisualizer";

describe("VhdlWaveformVisualizer", () => {
  it("renders preset chips, sliders, reset, and a rising-edge counter", () => {
    const { container } = render(<VhdlWaveformVisualizer />);

    expect(screen.getByRole("option", { name: /3.bit.counter/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /4.bit.counter/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /shift.register/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /toggle.ff/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /cursor \(half-cycle\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /vhdl pattern/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset vhdl waveform/i })).toBeTruthy();

    const counter = container.querySelector(".vhdl-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/rising edges/i);
  });

  it("4-bit counter pattern shows rising edges count > 0 on q0", () => {
    const { container } = render(<VhdlWaveformVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /4.bit.counter/i }));
    const counter = container.querySelector(".vhdl-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/rising edges \(q0\):\s*[1-9]\d*/i);
  });
});
