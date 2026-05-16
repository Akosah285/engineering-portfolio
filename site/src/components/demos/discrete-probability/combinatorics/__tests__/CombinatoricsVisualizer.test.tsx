import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombinatoricsVisualizer } from "../CombinatoricsVisualizer";

describe("CombinatoricsVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<CombinatoricsVisualizer />);
    expect(screen.getByRole("slider", { name: /^n/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^k/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lottery/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeInTheDocument();
  });

  it("emits a C(n, k) counter", () => {
    render(<CombinatoricsVisualizer />);
    expect(screen.getByText(/C\(\d+, \d+\) = \d+/)).toBeInTheDocument();
  });
});
