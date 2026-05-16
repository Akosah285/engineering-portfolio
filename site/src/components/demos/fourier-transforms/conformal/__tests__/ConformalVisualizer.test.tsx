import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConformalVisualizer from "../ConformalVisualizer";

describe("ConformalVisualizer", () => {
  it("renders preset chips, sliders, reset, and a sampled-points counter", () => {
    const { container } = render(<ConformalVisualizer />);

    expect(screen.getByRole("option", { name: /identity/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /squared/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /exponential/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /joukowski/i })).toBeTruthy();

    expect(screen.getByRole("slider", { name: /probe centre re\(z\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /probe centre im\(z\)/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /conformal map/i })).toBeTruthy();

    expect(screen.getByRole("button", { name: /reset conformal map/i })).toBeTruthy();

    const counter = container.querySelector(".cm-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/sampled/i);
  });

  it("identity map reports sampled-N == finite-N", () => {
    const { container } = render(<ConformalVisualizer />);
    fireEvent.click(screen.getByRole("option", { name: /identity/i }));
    const txt = container.querySelector(".cm-visualizer__counter")?.textContent ?? "";
    const sampled = Number((txt.match(/sampled\s*(\d+)/i) ?? [])[1] ?? 0);
    const finite = Number((txt.match(/finite\s*(\d+)/i) ?? [])[1] ?? 0);
    expect(sampled).toBeGreaterThan(0);
    expect(finite).toBe(sampled);
  });
});
