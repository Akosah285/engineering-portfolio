import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MqttVisualizer from "../MqttVisualizer";

describe("MqttVisualizer", () => {
  it("renders preset chips, sliders, reset, and an events counter", () => {
    const { container } = render(<MqttVisualizer />);

    expect(screen.getByRole("option", { name: /qos.0/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /qos.1/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /qos.2/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /no.match/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /cursor \(event idx\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /scenario/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset mqtt visualizer/i })).toBeTruthy();

    const counter = container.querySelector(".mqtt-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/events:/i);
  });

  it("QoS 2 handshake reports 8 events; no-match reports 0", () => {
    const { container } = render(<MqttVisualizer />);

    fireEvent.click(screen.getByRole("option", { name: /qos.2/i }));
    expect(container.querySelector(".mqtt-visualizer__counter")?.textContent ?? "")
      .toMatch(/events:\s*8/i);

    fireEvent.click(screen.getByRole("option", { name: /no.match/i }));
    expect(container.querySelector(".mqtt-visualizer__counter")?.textContent ?? "")
      .toMatch(/events:\s*0/i);
  });
});
