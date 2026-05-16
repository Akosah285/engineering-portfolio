import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TorsionVisualizer } from "../TorsionVisualizer";

describe("TorsionVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<TorsionVisualizer />);
    expect(screen.getByRole("slider", { name: /torque/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /length/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /outer.*radius/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /solid.*thin|solid thin/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /hollow.*thin wall/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a tau_max counter", () => {
    render(<TorsionVisualizer />);
    const counter = document.querySelector(".tr-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/τ_max\s*=\s*[\d.]+\s*MPa/i);
  });
});
