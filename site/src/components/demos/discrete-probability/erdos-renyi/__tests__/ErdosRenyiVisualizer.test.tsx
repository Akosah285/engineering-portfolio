import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErdosRenyiVisualizer } from "../ErdosRenyiVisualizer";

describe("ErdosRenyiVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<ErdosRenyiVisualizer />);
    expect(
      screen.getByRole("slider", { name: /^n nodes|^number of nodes/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("slider", {
        name: /^p\b|^edge probability|^probability/i,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^seed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /sparse/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /phase transition/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /giant component/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /dense/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/erdos|random graph|component|degree|node/i);
  });

  it("emits a nodes/edges counter", () => {
    render(<ErdosRenyiVisualizer />);
    const counter = document.querySelector(".er-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/\d+\s*nodes/);
  });
});
