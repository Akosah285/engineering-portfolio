import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Stress3dVisualizer from "../Stress3dVisualizer";

describe("Stress3dVisualizer", () => {
  it("renders preset chips, sliders, reset, and a von-Mises counter", () => {
    const { container } = render(<Stress3dVisualizer />);

    expect(screen.getByRole("option", { name: /uniaxial/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /pure.shear/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /hydrostatic/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /triaxial/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /σx \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /σy \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /σz \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /τxy \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /τxz \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /τyz \(mpa\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /loading preset/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset 3d stress/i })).toBeTruthy();

    const counter = container.querySelector(".s3d-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/σ_vm|von mises/i);
  });

  it("uniaxial-tension preset reports σ_vm ≈ 100 MPa", () => {
    const { container } = render(<Stress3dVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /uniaxial/i }));
    const counter = container.querySelector(".s3d-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/σ_vm\s*=\s*100(\.0+)?/i);
  });
});
