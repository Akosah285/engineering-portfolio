import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AluBitSliceVisualizer from "../AluBitSliceVisualizer";

describe("AluBitSliceVisualizer", () => {
  it("renders preset chips, sliders, reset, and a binary counter", () => {
    const { container } = render(<AluBitSliceVisualizer />);

    expect(screen.getByRole("option", { name: /add.with.carry/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /sub.with.borrow/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /signed.overflow/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /shl/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /operation/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /A \(0\.\.15\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /B \(0\.\.15\)/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset alu state/i })).toBeTruthy();

    const counter = container.querySelector(".alu-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/0b[01]{4}/);
  });

  it("updates counter when ADD-with-carry preset is selected", () => {
    const { container } = render(<AluBitSliceVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /add.with.carry/i }));
    const counter = container.querySelector(".alu-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/0b0110/);
  });
});
