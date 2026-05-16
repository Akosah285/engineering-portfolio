import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LatchVsFfVisualizer from "../LatchVsFfVisualizer";

describe("LatchVsFfVisualizer", () => {
  it("renders preset chips, sliders, reset, and a divergence counter", () => {
    const { container } = render(<LatchVsFfVisualizer />);

    expect(screen.getByRole("option", { name: /slow.clock/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /d.changes.mid.enable/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /clean.edges/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /glitchy/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /cursor \(sample idx\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /input pattern/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset latch vs flip-flop/i })).toBeTruthy();

    const counter = container.querySelector(".lvf-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/divergent samples/i);
  });

  it("d-changes-mid-enable pattern reports nonzero divergence", () => {
    const { container } = render(<LatchVsFfVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /d.changes.mid.enable/i }));
    const counter = container.querySelector(".lvf-visualizer__counter");
    expect(counter?.textContent ?? "").toMatch(/divergent samples:\s*[1-9]\d*/i);
  });
});
