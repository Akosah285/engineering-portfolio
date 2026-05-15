import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SliderRow } from "../SliderRow";

describe("<SliderRow>", () => {
  it("renders a labeled range input", () => {
    render(
      <SliderRow
        label="Learning rate"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        onChange={vi.fn()}
      />,
    );
    const slider = screen.getByRole("slider", { name: /learning rate/i });
    expect(slider).toBeDefined();
    expect((slider as HTMLInputElement).type).toBe("range");
  });

  it("shows the current value next to the label", () => {
    const { container } = render(
      <SliderRow
        label="Frequency"
        min={0}
        max={1000}
        step={1}
        value={440}
        onChange={vi.fn()}
        format={{ unit: "Hz" }}
      />,
    );
    const output = container.querySelector("output.slider-row__value");
    expect(output?.textContent?.replace(/\u00a0/g, " ")).toBe("440 Hz");
  });

  it("reflects min and max as tick labels by default", () => {
    render(
      <SliderRow
        label="Volume"
        min={0}
        max={100}
        step={1}
        value={50}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("100")).toBeDefined();
  });

  it("hides tick labels when hideTicks is set", () => {
    const { container } = render(
      <SliderRow
        label="Volume"
        min={0}
        max={100}
        step={1}
        value={50}
        onChange={vi.fn()}
        hideTicks
      />,
    );
    expect(container.querySelector(".slider-row__ticks")).toBeNull();
  });

  it("emits onChange with the new numeric value on user input", () => {
    const onChange = vi.fn();

    function Controlled() {
      const [v, setV] = useState(0.5);
      return (
        <SliderRow
          label="x"
          min={0}
          max={1}
          step={0.1}
          value={v}
          onChange={(next) => {
            onChange(next);
            setV(next);
          }}
        />
      );
    }
    render(<Controlled />);
    const slider = screen.getByRole("slider", { name: /^x$/i });
    // Native range inputs in JSDOM don't react to arrow keys with onChange,
    // so simulate the change event the way React owns it.
    fireEvent.change(slider, { target: { value: "0.7" } });
    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it("connects label to input via htmlFor", () => {
    const { container } = render(
      <SliderRow
        label="Pitch"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        onChange={vi.fn()}
        id="pitch-slider"
      />,
    );
    const label = container.querySelector("label");
    const input = container.querySelector("input");
    expect(label?.getAttribute("for")).toBe("pitch-slider");
    expect(input?.id).toBe("pitch-slider");
  });

  it("renders an optional description and wires aria-describedby", () => {
    render(
      <SliderRow
        label="Damping"
        description="Controls how fast oscillations decay."
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        onChange={vi.fn()}
        id="damping"
      />,
    );
    const desc = screen.getByText("Controls how fast oscillations decay.");
    expect(desc).toBeDefined();
    const slider = screen.getByRole("slider", { name: /damping/i });
    expect(slider.getAttribute("aria-describedby")).toBe("damping-desc");
  });

  it("disables the input when disabled prop is set", () => {
    render(
      <SliderRow
        label="Gain"
        min={0}
        max={10}
        step={1}
        value={5}
        onChange={vi.fn()}
        disabled
      />,
    );
    const slider = screen.getByRole("slider", { name: /gain/i });
    expect((slider as HTMLInputElement).disabled).toBe(true);
  });

  it("auto-generates a unique id when none provided", () => {
    const { container } = render(
      <>
        <SliderRow
          label="A"
          min={0}
          max={1}
          step={0.1}
          value={0}
          onChange={vi.fn()}
        />
        <SliderRow
          label="B"
          min={0}
          max={1}
          step={0.1}
          value={0}
          onChange={vi.fn()}
        />
      </>,
    );
    const inputs = container.querySelectorAll("input");
    expect(inputs.length).toBe(2);
    expect(inputs[0]?.id).not.toBe("");
    expect(inputs[1]?.id).not.toBe("");
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
  });
});
