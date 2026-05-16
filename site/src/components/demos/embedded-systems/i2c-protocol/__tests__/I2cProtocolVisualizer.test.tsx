import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import I2cProtocolVisualizer from "../I2cProtocolVisualizer";

describe("I2cProtocolVisualizer", () => {
  it("renders preset chips, sliders, reset, and an acks counter", () => {
    const { container } = render(<I2cProtocolVisualizer />);

    expect(screen.getByRole("option", { name: /sensor.read.1b/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /eeprom.write/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /display.init/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /empty.frame/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /cursor \(event idx\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /transaction/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset i2c protocol/i })).toBeTruthy();

    const counter = container.querySelector(".i2c-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/acks:/i);
  });

  it("eeprom-write-2byte transaction reports acks=3, bytes=2", () => {
    const { container } = render(<I2cProtocolVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /eeprom.write/i }));
    const counter = container.querySelector(".i2c-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/acks:\s*3/i);
    expect(counter?.textContent ?? "").toMatch(/bytes:\s*2/i);
  });
});
