import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LuDecompositionVisualizer } from "../LuDecompositionVisualizer";

describe("LuDecompositionVisualizer", () => {
  it("renders sliders + preset chips + canvas controls", () => {
    render(<LuDecompositionVisualizer />);
    expect(screen.getByRole("slider", { name: /b0|b_0|b₀/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /b1|b_1|b₁/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /well.conditioned|well conditioned/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /needs.pivot|needs pivot/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a det(A) counter", () => {
    render(<LuDecompositionVisualizer />);
    const counter = document.querySelector(".lu-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/det\(A\)\s*=\s*-?[\d.]+/i);
  });
});
