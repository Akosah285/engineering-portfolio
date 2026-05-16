import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FtSignalsVisualizer } from "../FtSignalsVisualizer";

describe("FtSignalsVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<FtSignalsVisualizer />);
    expect(screen.getByRole("slider", { name: /^param/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^omega max|^max omega|^omega/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /^rect/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^triangle/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /two.sided exp/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /causal exp/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /gaussian/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/fourier|transform|signal|frequency|time/i);
  });

  it("emits a param counter", () => {
    render(<FtSignalsVisualizer />);
    const counter = document.querySelector(".ft-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/param\s*=/);
  });
});
