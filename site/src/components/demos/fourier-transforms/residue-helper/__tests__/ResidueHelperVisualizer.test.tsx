import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ResidueHelperVisualizer from "../ResidueHelperVisualizer";

describe("ResidueHelperVisualizer", () => {
  it("renders preset chips, sliders, reset, and an enclosed-poles counter", () => {
    const { container } = render(<ResidueHelperVisualizer />);

    expect(screen.getByRole("option", { name: /1\/z\b/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /squared.plus/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /z.times/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /exp.z.*over/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /contour radius/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /function/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset residue helper/i })).toBeTruthy();

    const counter = container.querySelector(".rh-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/enclosed poles:/i);
  });

  it("1/(z²+1) at radius 1.5 encloses both poles ±i", () => {
    const { container } = render(<ResidueHelperVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /squared.plus/i }));
    const r = screen.getByRole("slider", { name: /contour radius/i }) as HTMLInputElement;
    fireEvent.change(r, { target: { value: "1.5" } });

    const counter = container.querySelector(".rh-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/enclosed poles:\s*2/i);
  });
});
