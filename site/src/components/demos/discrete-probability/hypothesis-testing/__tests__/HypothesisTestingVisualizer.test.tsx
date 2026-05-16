import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HypothesisTestingVisualizer } from "../HypothesisTestingVisualizer";

describe("HypothesisTestingVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<HypothesisTestingVisualizer />);
    expect(screen.getByRole("slider", { name: /x̄|xbar/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /n/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /weak effect|weak-effect/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeInTheDocument();
  });

  it("emits a sample size counter", () => {
    render(<HypothesisTestingVisualizer />);
    expect(screen.getByText(/n = \d+/i)).toBeInTheDocument();
  });
});
