import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BayesTheoremVisualizer } from "../BayesTheoremVisualizer";

describe("BayesTheoremVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<BayesTheoremVisualizer />);
    expect(screen.getByRole("slider", { name: /^prior/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^sensitivity/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^specificity/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /rare disease/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /covid/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/bayes|posterior|prior|test/i);
  });

  it("emits a population counter", () => {
    render(<BayesTheoremVisualizer />);
    const counter = document.querySelector(".bt-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/pop\s*=\s*\d+/);
  });
});
