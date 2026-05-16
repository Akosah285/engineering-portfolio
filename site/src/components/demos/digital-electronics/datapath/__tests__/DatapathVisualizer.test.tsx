import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DatapathVisualizer from "../DatapathVisualizer";

describe("DatapathVisualizer", () => {
  it("renders preset chips, controls, reset, and a register counter", () => {
    const { container } = render(<DatapathVisualizer />);

    expect(screen.getByRole("option", { name: /add.two/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /countdown/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /bitmask/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /shift.double/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: "PC (program counter)" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Program" })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset datapath/i })).toBeTruthy();

    const counter = container.querySelector(".dp-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/R0=\d+/);
  });

  it("after picking 'add two' and stepping all the way, R2 holds the sum", () => {
    const { container } = render(<DatapathVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /add.two/i }));

    const pc = screen.getByRole("slider", {
      name: "PC (program counter)",
    }) as HTMLInputElement;
    fireEvent.change(pc, { target: { value: "3" } });

    const counter = container.querySelector(".dp-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/R2=8/);
  });
});
